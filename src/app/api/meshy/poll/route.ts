// src/app/api/meshy/poll/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const OUTPUTS_BUCKET = "Outputs"; // case-sensitive
const SIGN_SECONDS = 60 * 30;
const MIN_PREVIEW_BYTES = 50_000;

// Only start 3D when order is paid (or later statuses)
const PAID_STATUSES = new Set(["paid", "in_production", "shipped"]);
function isPaidStatus(status: unknown) {
  return PAID_STATUSES.has(String(status ?? "").toLowerCase());
}

function isRetryableMeshyError(msg: unknown): boolean {
  const s = String(msg ?? "").toLowerCase();
  return (
    s.includes("server is busy") ||
    s.includes("try again later") ||
    s.includes("rate limit") ||
    s.includes("temporarily") ||
    s.includes("timeout")
  );
}

async function signedUrlOrNull(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(OUTPUTS_BUCKET)
    .createSignedUrl(path, SIGN_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

async function uploadToOutputs(path: string, buf: Buffer, contentType: string) {
  const { error } = await supabaseAdmin.storage.from(OUTPUTS_BUCKET).upload(path, buf, {
    upsert: true,
    contentType,
  });
  if (error) throw new Error(error.message);
}

type OrdersRow = {
  id: string;
  status: string | null;

  // preview pipeline
  meshy_image_task_id: string | null;
  clay_preview_path: string | null;

  // 3D pipeline (only after paid)
  meshy_model_task_id: string | null;
  model_glb_path: string | null;
  model_obj_path: string | null;

  // helpful debug
  meshy_model_attempts: number | null;
  meshy_model_last_error: string | null;

  generation_started_at: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const apiKey = process.env.MESHY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "MESHY_API_KEY is missing" }, { status: 500 });

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select(
        [
          "id",
          "status",
          "meshy_image_task_id",
          "clay_preview_path",
          "meshy_model_task_id",
          "model_glb_path",
          "model_obj_path",
          "meshy_model_attempts",
          "meshy_model_last_error",
          "generation_started_at",
        ].join(",")
      )
      .eq("id", orderId)
      .single<OrdersRow>();

    if (orderErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const status = String(order.status ?? "");
    const isPaid = isPaidStatus(status);

    // ------------------------------------------------------------------
    // 0) If preview already ready and NOT paid: do NOT generate 3D here.
    // ------------------------------------------------------------------
    if (order.clay_preview_path && !isPaid) {
      return NextResponse.json({
        status: "preview_ready",
        stage: "clay_preview",
        progress: 100,
        clayPreviewUrl: await signedUrlOrNull(order.clay_preview_path),
        modelGlbUrl: null,
        modelObjUrl: null,
        message: "Preview ready. Pay to start 3D generation.",
      });
    }

    // ------------------------------------------------------------------
    // 1) PREVIEW: poll image-to-image until we have clay_preview_path
    // ------------------------------------------------------------------
    if (!order.meshy_image_task_id) {
      // This means create-order didn't start the Meshy task correctly.
      return NextResponse.json({
        status: status || "created",
        stage: "clay_preview",
        progress: 0,
        message: "Waiting for Meshy image task…",
      });
    }

    if (!order.clay_preview_path) {
      const imgRes = await fetch(
        `https://api.meshy.ai/openapi/v1/image-to-image/${order.meshy_image_task_id}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      const imgTask: any = await imgRes.json().catch(() => ({}));

      if (!imgRes.ok) {
        return NextResponse.json(
          {
            status: "processing",
            stage: "clay_preview",
            progress: 0,
            message: "Could not fetch preview status from Meshy yet…",
            details: imgTask,
          },
          { status: 502 }
        );
      }

      const imgStatus = String(imgTask?.status ?? "");
      const imgProgress = Number(imgTask?.progress ?? 0);

      if (imgStatus === "FAILED") {
        const msg = String(imgTask?.task_error?.message ?? "Preview generation failed");
        await supabaseAdmin
          .from("orders")
          .update({ status: "failed", meshy_model_last_error: msg })
          .eq("id", orderId);

        return NextResponse.json({ status: "failed", stage: "clay_preview", progress: 0, message: msg });
      }

      // Still running
      if (imgStatus !== "SUCCEEDED" || (Number.isFinite(imgProgress) && imgProgress < 100)) {
        // keep order status as processing while preview is running
        await supabaseAdmin.from("orders").update({ status: "processing" }).eq("id", orderId);

        return NextResponse.json({
          status: "processing",
          stage: "clay_preview",
          progress: Number.isFinite(imgProgress) ? imgProgress : null,
          message: imgTask?.message ? String(imgTask.message) : null,
        });
      }

      // Completed: download result image
      const outUrl = String(imgTask?.image_urls?.[0] ?? "");
      if (!outUrl) {
        return NextResponse.json({
          status: "processing",
          stage: "clay_preview",
          progress: 95,
          message: "Preview finished but result URL missing. Retrying…",
        });
      }

      const dl = await fetch(outUrl);
      if (!dl.ok) {
        return NextResponse.json(
          { status: "processing", stage: "clay_preview", progress: 95, message: "Downloading preview… retrying…" },
          { status: 502 }
        );
      }

      const buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length < MIN_PREVIEW_BYTES) {
        return NextResponse.json({
          status: "processing",
          stage: "clay_preview",
          progress: 95,
          message: "Preview looks broken. Retrying…",
        });
      }

      const clayPath = `${orderId}/clay_preview.png`;
      await uploadToOutputs(clayPath, buf, "image/png");

      // IMPORTANT: when preview is ready, set status preview_ready (NOT processing)
      await supabaseAdmin
        .from("orders")
        .update({
          clay_preview_path: clayPath,
          status: "preview_ready",
          meshy_model_last_error: null,
        })
        .eq("id", orderId);

      return NextResponse.json({
        status: "preview_ready",
        stage: "clay_preview",
        progress: 100,
        clayPreviewUrl: await signedUrlOrNull(clayPath),
        modelGlbUrl: null,
        modelObjUrl: null,
        message: "Preview ready. Pay to start 3D generation.",
      });
    }

    // ------------------------------------------------------------------
    // 2) If we are paid, THEN we are allowed to create/poll the 3D task.
    // ------------------------------------------------------------------
    if (!isPaid) {
      // safety fallback: we have preview path but not paid
      return NextResponse.json({
        status: "preview_ready",
        stage: "clay_preview",
        progress: 100,
        clayPreviewUrl: await signedUrlOrNull(order.clay_preview_path),
        modelGlbUrl: null,
        modelObjUrl: null,
        message: "Preview ready. Pay to start 3D generation.",
      });
    }

    // Refresh for 3D phase fields
    const { data: orderPaid } = await supabaseAdmin
      .from("orders")
      .select(
        [
          "status",
          "meshy_model_task_id",
          "clay_preview_path",
          "model_glb_path",
          "model_obj_path",
          "meshy_model_attempts",
          "meshy_model_last_error",
        ].join(",")
      )
      .eq("id", orderId)
      .single<OrdersRow>();

    if (!orderPaid?.clay_preview_path) {
      return NextResponse.json({
        status: "processing",
        stage: "model",
        progress: 0,
        message: "Waiting for preview image before starting 3D…",
      });
    }

    // If already have model files stored, return them
    if (orderPaid.model_glb_path || orderPaid.model_obj_path) {
      return NextResponse.json({
        status: String(orderPaid.status ?? "paid"),
        stage: "model",
        progress: 100,
        clayPreviewUrl: await signedUrlOrNull(orderPaid.clay_preview_path),
        modelGlbUrl: await signedUrlOrNull(orderPaid.model_glb_path),
        modelObjUrl: await signedUrlOrNull(orderPaid.model_obj_path),
        message: "3D model ready.",
      });
    }

    // Start image-to-3d once (if not started)
    if (!orderPaid.meshy_model_task_id) {
      const clayPreviewUrl = await signedUrlOrNull(orderPaid.clay_preview_path);
      if (!clayPreviewUrl) {
        return NextResponse.json({
          status: "processing",
          stage: "model",
          progress: 0,
          message: "Signing preview image for 3D…",
        });
      }

      const start3D = await fetch("https://api.meshy.ai/openapi/v1/image-to-3d", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: clayPreviewUrl,
          ai_model: "latest",
          should_texture: true,
          should_remesh: true,
        }),
      });

      const startJson: any = await start3D.json().catch(() => ({}));
      const resultId = String(startJson?.result ?? "");

      if (!start3D.ok || !resultId) {
        const msg = String(startJson?.error?.message ?? startJson?.message ?? "Failed to start 3D task");
        await supabaseAdmin
          .from("orders")
          .update({ meshy_model_last_error: msg, status: "paid", meshy_model_attempts: 1 })
          .eq("id", orderId);

        return NextResponse.json({
          status: "processing",
          stage: "model",
          progress: 5,
          message: "Meshy is busy starting the 3D job. Retrying…",
          details: startJson,
        });
      }

      await supabaseAdmin
        .from("orders")
        .update({ meshy_model_task_id: resultId, meshy_model_attempts: 0, meshy_model_last_error: null })
        .eq("id", orderId);

      return NextResponse.json({
        status: "processing",
        stage: "model",
        progress: 5,
        clayPreviewUrl: await signedUrlOrNull(orderPaid.clay_preview_path),
        message: "3D generation started…",
      });
    }

    // Poll image-to-3d
    const modelRes = await fetch(`https://api.meshy.ai/openapi/v1/image-to-3d/${orderPaid.meshy_model_task_id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const modelTask: any = await modelRes.json().catch(() => ({}));
    if (!modelRes.ok) {
      return NextResponse.json({
        status: "processing",
        stage: "model",
        progress: 10,
        message: "Could not fetch 3D status from Meshy yet…",
        details: modelTask,
      });
    }

    const taskStatus = String(modelTask?.status ?? "");
    const progress = Number(modelTask?.progress ?? 0);

    if (taskStatus === "FAILED") {
      const msg = String(modelTask?.task_error?.message ?? "3D model generation failed");

      // retryable busy conditions
      if (isRetryableMeshyError(msg)) {
        const nextAttempts = Number(orderPaid?.meshy_model_attempts ?? 0) + 1;

        await supabaseAdmin
          .from("orders")
          .update({ meshy_model_attempts: nextAttempts, meshy_model_last_error: msg })
          .eq("id", orderId);

        if (nextAttempts >= 8) {
          await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", orderId);
          return NextResponse.json({
            status: "failed",
            stage: "model",
            progress: 0,
            message: "Meshy stayed busy for too long. Please try again later.",
          });
        }

        return NextResponse.json({
          status: "processing",
          stage: "model",
          progress: Math.max(5, Math.min(95, progress || 27)),
          message: "Meshy is busy right now. Retrying automatically…",
          retryable: true,
          attempts: nextAttempts,
        });
      }

      await supabaseAdmin
        .from("orders")
        .update({ status: "failed", meshy_model_last_error: msg })
        .eq("id", orderId);

      return NextResponse.json({ status: "failed", stage: "model", progress: 0, message: msg });
    }

    if (taskStatus !== "SUCCEEDED" || (Number.isFinite(progress) && progress < 100)) {
      return NextResponse.json({
        status: "processing",
        stage: "model",
        progress: Number.isFinite(progress) ? progress : null,
        clayPreviewUrl: await signedUrlOrNull(orderPaid.clay_preview_path),
        message: modelTask?.message ? String(modelTask.message) : null,
      });
    }

    // Download model outputs and store in Outputs bucket
    const glbUrl = String(modelTask?.model_urls?.glb ?? "");
    const objUrl = String(modelTask?.model_urls?.obj ?? "");

    let modelGlbPath: string | null = null;
    let modelObjPath: string | null = null;

    if (glbUrl) {
      const glbDl = await fetch(glbUrl);
      if (glbDl.ok) {
        const glbBuf = Buffer.from(await glbDl.arrayBuffer());
        modelGlbPath = `${orderId}/model.glb`;
        await uploadToOutputs(modelGlbPath, glbBuf, "model/gltf-binary");
      }
    }

    if (objUrl) {
      const objDl = await fetch(objUrl);
      if (objDl.ok) {
        const objBuf = Buffer.from(await objDl.arrayBuffer());
        modelObjPath = `${orderId}/model.obj`;
        await uploadToOutputs(modelObjPath, objBuf, "text/plain");
      }
    }

    await supabaseAdmin
      .from("orders")
      .update({
        model_glb_path: modelGlbPath,
        model_obj_path: modelObjPath,
        meshy_model_last_error: null,
      })
      .eq("id", orderId);

    return NextResponse.json({
      status: "paid",
      stage: "model",
      progress: 100,
      clayPreviewUrl: await signedUrlOrNull(orderPaid.clay_preview_path),
      modelGlbUrl: await signedUrlOrNull(modelGlbPath),
      modelObjUrl: await signedUrlOrNull(modelObjPath),
      message: "3D model ready.",
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Internal error", details: msg }, { status: 500 });
  }
}
