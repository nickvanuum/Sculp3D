// src/app/api/orders/retry/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UPLOADS_BUCKET = "Uploads";

type Body = { orderId: string };

function buildPreviewPrompt(style: string, styleHint: string) {
  const styleLine =
    style === "modern"
      ? "Contemporary / modern sculpt geometry."
      : style === "custom"
      ? "Custom sculpt geometry (follow user notes)."
      : "Classical sculpt geometry (traditional proportions).";

  return `
Create a realistic sculpted bust of the person in the reference photo.
${styleLine}

GEOMETRY REQUIREMENTS:
- The output must be a SINGLE piece bust sculpture (one continuous object).
- The bust ends at mid-chest with a clean planar cut.
- The bottom surface of the bust is a flat cut plane (so it can stand/print).
- The lowest point of the entire object is the bust’s own flat cut plane.

STRICTLY FORBIDDEN (IMPORTANT):
- Do NOT generate a separate pedestal, plinth, base, stand, platform, column, or trophy base.
- Do NOT place the bust on top of any object.
- Do NOT add any geometry underneath the bust besides the bust’s own flat cut surface.
- No extra object boundaries, seams, or “two-part” look.

PRINT-FAITHFUL PREVIEW LOOK (CRITICAL):
- Render as a single uniform matte material like light gray PLA / matte clay.
- NO marble, NO bronze, NO metal, NO stone veining, NO glossy highlights.
- NO two-tone materials. NO color variation between head and base.
- Neutral studio lighting and background. Centered composition.
- No text, no watermark, no props, no frame.

${styleHint?.trim() ? `USER STYLE NOTES: ${styleHint.trim()}` : ""}
`.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const apiKey = process.env.MESHY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "MESHY_API_KEY is missing" }, { status: 500 });

    // Load order
    const { data: order, error: loadErr } = await supabaseAdmin
      .from("orders")
      .select("id,status,preview_attempts,bust_style,notes,clay_preview_path")
      .eq("id", body.orderId)
      .single();

    if (loadErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const allowed = ["preview_ready", "failed", "created"];
    if (!allowed.includes(String((order as any).status))) {
      return NextResponse.json(
        { error: `Cannot retry while status is '${String((order as any).status)}'` },
        { status: 400 }
      );
    }

    // Find latest uploaded image for this order
    const { data: up, error: upErr } = await supabaseAdmin
      .from("uploads")
      .select("storage_path,created_at")
      .eq("order_id", body.orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (upErr || !up?.storage_path) {
      return NextResponse.json(
        { error: "No uploaded photo found for this order. Please recreate the order." },
        { status: 400 }
      );
    }

    // Sign image URL for Meshy
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(UPLOADS_BUCKET)
      .createSignedUrl(up.storage_path, 60 * 30);

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json({ error: "Failed to sign image URL" }, { status: 500 });
    }

    // Create NEW Meshy task
    const style = String((order as any).bust_style ?? "classical");

    // You don't store styleHint in DB; use notes as the only available "hint" on retry.
    const styleHint = String((order as any).notes ?? "").trim();

    const prompt = buildPreviewPrompt(style, styleHint);

    const img2imgRes = await fetch("https://api.meshy.ai/openapi/v1/image-to-image", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ai_model: "nano-banana-pro",
        prompt,
        reference_image_urls: [signed.signedUrl],
        generate_multi_view: false,
      }),
    });

    const img2imgJson = await img2imgRes.json().catch(() => ({}));
    const taskId = String((img2imgJson as any)?.result ?? "");

    if (!img2imgRes.ok || !taskId) {
      return NextResponse.json(
        {
          error: "Failed to create Meshy image-to-image task",
          meshyStatus: img2imgRes.status,
          meshyResponse: img2imgJson,
        },
        { status: 502 }
      );
    }

    const nextAttempts = Number((order as any).preview_attempts ?? 0) + 1;

    // Reset preview fields
    const nowIso = new Date().toISOString();
    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({
        status: "processing",
        preview_attempts: nextAttempts,
        generation_started_at: nowIso,
        meshy_image_task_id: taskId,
        clay_preview_path: null,
      } as any)
      .eq("id", body.orderId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message, details: updErr.details ?? null }, { status: 500 });
    }

    return NextResponse.json({ ok: true, meshyImageTaskId: taskId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Retry failed" }, { status: 500 });
  }
}
