export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const OUTPUTS_BUCKET = "Outputs"; // case-sensitive
const MIN_PREVIEW_BYTES = 50_000; // prevent tiny broken thumbnails

async function signedUrlOrNull(path: string | null, seconds = 60 * 30) {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage.from(OUTPUTS_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const apiKey = process.env.MESHY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "MESHY_API_KEY is missing" }, { status: 500 });

    // Load order
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select(
        "id,status,meshy_task_id,preview_storage_path,bust_preview_path,bust_model_path"
      )
      .eq("id", orderId)
      .single();

    if (orderErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // ✅ If the worker finished, return customer-friendly preview (clay PNG) + status
    // bust_preview_path is what your Blender worker uploads (bust_preview.png)
    if (order.status === "preview_ready" && (order.bust_preview_path || order.preview_storage_path)) {
      const bustPreviewUrl = await signedUrlOrNull(order.bust_preview_path ?? null);
      const previewImageUrl = await signedUrlOrNull(order.preview_storage_path ?? null);

      return NextResponse.json({
        status: "preview_ready",
        bustPreviewUrl,
        previewImageUrl,
        previewModelUrl: null, // we are no longer storing GLB in Supabase
      });
    }

    // No task yet
    if (!order.meshy_task_id) {
      return NextResponse.json({
        status: String(order.status ?? "created"),
        message: "No Meshy task yet",
      });
    }

    // Ask Meshy for task status
    const meshyRes = await fetch(
      `https://api.meshy.ai/openapi/v1/multi-image-to-3d/${order.meshy_task_id}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    const task = await meshyRes.json().catch(() => ({}));
    if (!meshyRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch Meshy task", details: task },
        { status: 502 }
      );
    }

    const taskStatus = String(task.status ?? "");
    const progress = Number(task.progress ?? 0);

    // Still running
    if (taskStatus !== "SUCCEEDED" && taskStatus !== "FAILED") {
      return NextResponse.json({ status: "processing", meshyStatus: taskStatus, progress });
    }

    // Guard: SUCCEEDED but progress not 100 yet
    if (taskStatus === "SUCCEEDED" && progress < 100) {
      return NextResponse.json({ status: "processing", meshyStatus: taskStatus, progress });
    }

    // Failed
    if (taskStatus === "FAILED") {
      // Only do this if your enum supports "failed"
      await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", orderId);
      return NextResponse.json({ status: "failed", meshyStatus: "FAILED" });
    }

    // SUCCEEDED: store only a small thumbnail (optional) — NO GLB STORAGE
    const thumbUrl = String(task?.thumbnail_url ?? "");
    let previewImagePath: string | null = order.preview_storage_path ?? null;

    if (thumbUrl) {
      const imgRes = await fetch(thumbUrl);
      if (imgRes.ok) {
        const imgBuf = Buffer.from(await imgRes.arrayBuffer());
        if (imgBuf.length >= MIN_PREVIEW_BYTES) {
          previewImagePath = `${orderId}/preview.png`;

          await supabaseAdmin.storage.from(OUTPUTS_BUCKET).upload(previewImagePath, imgBuf, {
            contentType: "image/png",
            upsert: true,
          });

          // Best-effort: keep a record in outputs table if you use it
          await supabaseAdmin.from("outputs").insert({
            order_id: orderId,
            kind: "preview_thumb",
            storage_path: previewImagePath,
          });

          // Save path on the order (do NOT mark preview_ready here)
          await supabaseAdmin.from("orders").update({
            preview_storage_path: previewImagePath,
          }).eq("id", orderId);
        }
      }
    }

    // ✅ IMPORTANT:
    // We do NOT set preview_ready here anymore.
    // The VPS worker will download the GLB from Meshy, make the clay render + STL,
    // upload bust_preview.png + bust.stl, then set status=preview_ready.

    const previewImageUrl = await signedUrlOrNull(previewImagePath);

    return NextResponse.json({
      status: "processing",
      meshyStatus: "SUCCEEDED",
      progress: 100,
      message: "Meshy model ready. Preparing a clean bust preview…",
      previewImageUrl, // optional thumbnail while waiting
      bustPreviewUrl: null, // worker will fill this
      previewModelUrl: null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Internal error", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
