// src/app/api/orders/status/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const OUTPUTS_BUCKET = "Outputs";
const SIGN_SECONDS = 60 * 30;

const MIN_PREVIEW_BYTES = 50_000;

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
  const { data, error } = await supabaseAdmin.storage.from(OUTPUTS_BUCKET).createSignedUrl(path, SIGN_SECONDS);
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

  preview_attempts: number | null;
  retry_credits: number | null;
  generation_started_at: string | null;

  meshy_image_task_id: string | null;
  clay_preview_path: string | null;

  meshy_model_task_id: string | null;
  model_glb_path: string | null;
  model_obj_path: string | null;

  meshy_model_attempts: number | null;
  meshy_model_last_error: string | null;
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
          "preview_attempts",
          "retry_credits",
          "generation_started_at",
          "meshy_image_task_id",
          "clay_preview_path",
          "meshy_model_task_id",
          "model_glb_path",
          "model_obj_path",
          "meshy_model_attempts",
          "meshy_model_last_error",
        ].join(",")
      )
      .eq("id", orderId)
      .single<OrdersRow>();

    if (orderErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const status = String(order.status ?? "");
    const paid = isPaidStatus(status);

    // Helper to build the UI response shape your frontend expects
    const baseOrderResponse = async (override: Partial<any> = {}) => ({
      order: {
        id: String(order.id ?? orderId),
        status: override.status ?? status,
        preview_attempts: Number(order.preview_attempts ?? 0),
        retry_credits: Number(order.retry_credits ?? 0),
        generation_started_at: order.generation_started_at ?? null,
        clayPreviewUrl: await signedUrlOrNull(order.clay_preview_path ?? null),
        modelGlbUrl: await signedUrlOrNull(order.model_glb_path ?? null),
        modelObjUrl: await signedUrlOrNull(order.model_obj_path ?? null),
      },
      ...override,
    });

    // ------------------------------------------------------------------
    // A) If not paid: keep your existing preview logic behavior
    // ------------------------------------------------------------------
    if (!paid) {
      // If preview already ready
      if (status === "preview_ready") {
        return NextResponse.json(
          await baseOrderResponse({
            stage: "clay_preview",
            progress: 100,
            message: null,
            paymentLocked: false,
          })
        );
      }

      const meshyImageTaskId = String(order.meshy_image_task_id ?? "");
      if (!meshyImageTaskId) {
        return NextResponse.json(
          await baseOrderResponse({
            stage: "clay_preview",
            progress: 0,
            message: "Waiting for Meshy preview task…",
            paymentLocked: false,
          })
        );
      }

      // If clay preview already stored but status not updated
      const existingClayPath = String(order.clay_preview_path ?? "");
      if (existingClayPath) {
        await supabaseAdmin.from("orders").update({ status: "preview_ready" } as any).eq("id", orderId);
        return NextResponse.json(
          await baseOrderResponse({
            status: "preview_ready",
            stage: "clay_preview",
            progress: 100,
            message: null,
            paymentLocked: false,
          })
        );
      }

      // Poll Meshy image-to-image
      const imgRes = await fetch(`https://api.meshy.ai/openapi/v1/image-to-image/${meshyImageTaskId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      const imgTask: any = await imgRes.json().catch(() => ({}));
      if (!imgRes.ok) {
        return NextResponse.json({ error: "Failed to fetch Meshy image-to-image task", details: imgTask }, { status: 502 });
      }

      const imgStatus = String(imgTask?.status ?? "");
      const imgProgress = Number(imgTask?.progress ?? 0);

      if (imgStatus === "FAILED") {
        const msg = String(imgTask?.task_error?.message ?? "Preview generation failed");
        await supabaseAdmin.from("orders").update({ status: "failed" } as any).eq("id", orderId);
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      if (imgStatus !== "SUCCEEDED" || imgProgress < 100) {
        await supabaseAdmin.from("orders").update({ status: "processing" } as any).eq("id", orderId);
        return NextResponse.json(
          await baseOrderResponse({
            status: "processing",
            stage: "clay_preview",
            progress: imgProgress || null,
            message: null,
            paymentLocked: false,
          })
        );
      }

      // Download & store preview
      const outUrl = String(imgTask?.image_urls?.[0] ?? "");
      if (!outUrl) {
        return NextResponse.json(
          await baseOrderResponse({
            status: "processing",
            stage: "clay_preview",
            progress: 95,
            message: "Preview ready but image URL missing. Retrying…",
            paymentLocked: false,
          })
        );
      }

      const dl = await fetch(outUrl);
      if (!dl.ok) return NextResponse.json({ error: "Failed to download preview image" }, { status: 502 });

      const buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length < MIN_PREVIEW_BYTES) {
        return NextResponse.json(
          await baseOrderResponse({
            status: "processing",
            stage: "clay_preview",
            progress: 95,
            message: "Preview image looks broken. Retrying…",
            paymentLocked: false,
          })
        );
      }

      const clayPath = `${orderId}/clay_preview.png`;
      await uploadToOutputs(clayPath, buf, "image/png");

      await supabaseAdmin.from("orders").update({ clay_preview_path: clayPath, status: "preview_ready" } as any).eq("id", orderId);

      return NextResponse.json(
        await baseOrderResponse({
          status: "preview_ready",
          stage: "clay_preview",
          progress: 100,
          message: null,
          paymentLocked: false,
        })
      );
    }

    // ------------------------------------------------------------------
    // B) PAID: Start/poll 3D generation and store GLB/OBJ
    // ------------------------------------------------------------------

    // If already have model files stored, return them
    if (order.model_glb_path || order.model_obj_path) {
      return NextResponse.json(
        await baseOrderResponse({
          stage: "model",
          progress: 100,
          message: "3D model ready.",
          paymentLocked: true,
        })
      );
    }

    // Need a preview image to start 3D
    if (!order.clay_preview_path) {
      return NextResponse.json(
        await baseOrderResponse({
          stage: "model",
          progress: 0,
          message: "Payment received. Waiting for preview image before starting 3D…",
          paymentLocked: true,
        })
      );
    }

    // Start image-to-3d once
    if (!order.meshy_model_task_id) {
      const clayPreviewSigned = await signedUrlOrNull(order.clay_preview_path);
      if (!clayPreviewSigned) {
        return NextResponse.json(
          await baseOrderResponse({
            stage: "model",
            progress: 0,
            message: "Signing preview image for 3D…",
            paymentLocked: true,
          })
        );
      }

      const start3D = await fetch("https://api.meshy.ai/openapi/v1/image-to-3d", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_url: clayPreviewSigned,
          ai_model: "latest",
          should_texture: true,
          should_remesh: true,
        }),
      });

      const startJson: any = await start3D.json().catch(() => ({}));
      const taskId = String(startJson?.result ?? "");

      if (!start3D.ok || !taskId) {
        const msg = String(startJson?.error?.message ?? startJson?.message ?? "Failed to start 3D task");
        await supabaseAdmin
          .from("orders")
          .update({ meshy_model_last_error: msg, meshy_model_attempts: (order.meshy_model_attempts ?? 0) + 1 } as any)
          .eq("id", orderId);

        return NextResponse.json(
          await baseOrderResponse({
            stage: "model",
            progress: 5,
            message: "Meshy is busy starting the 3D job. Retrying…",
            paymentLocked: true,
          })
        );
      }

      await supabaseAdmin
        .from("orders")
        .update({ meshy_model_task_id: taskId, meshy_model_attempts: 0, meshy_model_last_error: null } as any)
        .eq("id", orderId);

      // reflect new task id in response
      return NextResponse.json(
        await baseOrderResponse({
          stage: "model",
          progress: 5,
          message: "3D generation started…",
          paymentLocked: true,
        })
      );
    }

    // Poll image-to-3d
    const modelRes = await fetch(`https://api.meshy.ai/openapi/v1/image-to-3d/${order.meshy_model_task_id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const modelTask: any = await modelRes.json().catch(() => ({}));
    if (!modelRes.ok) {
      return NextResponse.json(
        await baseOrderResponse({
          stage: "model",
          progress: 10,
          message: "Could not fetch 3D status from Meshy yet…",
          paymentLocked: true,
        })
      );
    }

    const taskStatus = String(modelTask?.status ?? "");
    const progress = Number(modelTask?.progress ?? 0);

    if (taskStatus === "FAILED") {
      const msg = String(modelTask?.task_error?.message ?? "3D model generation failed");

      if (isRetryableMeshyError(msg)) {
        const nextAttempts = Number(order.meshy_model_attempts ?? 0) + 1;

        await supabaseAdmin
          .from("orders")
          .update({ meshy_model_attempts: nextAttempts, meshy_model_last_error: msg } as any)
          .eq("id", orderId);

        return NextResponse.json(
          await baseOrderResponse({
            stage: "model",
            progress: Math.max(5, Math.min(95, progress || 27)),
            message: "Meshy is busy right now. Retrying automatically…",
            paymentLocked: true,
          })
        );
      }

      await supabaseAdmin.from("orders").update({ status: "failed", meshy_model_last_error: msg } as any).eq("id", orderId);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    if (taskStatus !== "SUCCEEDED" || (Number.isFinite(progress) && progress < 100)) {
      return NextResponse.json(
        await baseOrderResponse({
          stage: "model",
          progress: Number.isFinite(progress) ? progress : null,
          message: modelTask?.message ? String(modelTask.message) : null,
          paymentLocked: true,
        })
      );
    }

    // Download & store GLB/OBJ
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
      .update({ model_glb_path: modelGlbPath, model_obj_path: modelObjPath, meshy_model_last_error: null } as any)
      .eq("id", orderId);

    return NextResponse.json(
      await baseOrderResponse({
        stage: "model",
        progress: 100,
        message: "3D model ready.",
        paymentLocked: true,
      })
    );
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Internal error", details: msg }, { status: 500 });
  }
}
