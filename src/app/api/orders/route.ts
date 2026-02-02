// src/app/api/orders/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UPLOADS_BUCKET = "Uploads";

// Fixed 3-size pricing (server truth)
const PRICE_BY_SIZE_CENTS: Record<number, number> = {
  100: 3900,
  200: 6900,
  300: 9900,
};

/**
 * Prompt goal:
 * - Keep style variance (classical vs modern vs custom) in GEOMETRY
 * - Ensure printability (single mesh, flat bottom)
 * - Forbid *separate* pedestals/stands/plinths, but allow an integrated base shape
 *   as part of the same sculpt (so styles can still feel different).
 * - Make the preview look like a REAL 3D PRINT PREVIEW (matte single material),
 *   not marble/bronze/two-tone "beauty render".
 */
function buildPreviewPrompt(style: string, styleHint: string) {
  const baseRules = `
SUBJECT:
- Create a realistic sculpted bust of the person in the reference photo.

GEOMETRY REQUIREMENTS (VERY IMPORTANT):
- The output must be a SINGLE continuous sculpture (one connected mesh / one object).
- The sculpture ends around mid-chest (bust), with a clean, intentional termination.
- The bottom of the sculpture must be a FLAT plane so it can stand and be 3D printed.
- No floating parts. No thin fragile spikes. No text. No watermark. No props.

PEDESTAL / BASE RULES (VERY IMPORTANT):
- You MAY include an integrated sculpt base / mass under the bust AS PART OF THE SAME MESH
  (e.g., a subtle blocky mass, beveled slab, or minimal integrated base).
- You MUST NOT create a separate pedestal/plinth/stand/platform/column underneath the bust.
- The sculpture must NOT be placed on top of any separate object.
- There should be no visible seam suggesting "bust + separate base" parts.

PRINT-FAITHFUL PREVIEW LOOK (CRITICAL):
- Render the sculpture as a SINGLE uniform material like matte gray PLA / matte clay.
- NO marble, NO bronze, NO metal, NO stone veining, NO glossy specular highlights.
- NO two-tone materials. NO painted gradients. NO color variation across head vs base.
- Keep lighting neutral and realistic for a product photo, but avoid "museum dramatic" shading.
- Neutral studio background, centered composition.
`.trim();

  const styleBlock =
    style === "modern"
      ? `
STYLE (GEOMETRY): CONTEMPORARY / MODERN SCULPT
- Cleaner modern silhouette and design language.
- Slightly simplified surfaces, tasteful contemporary feel.
- Integrated base (if present) should be minimal and geometric (smooth slab/block).
- Style affects shape language and cut lines, NOT materials.
`.trim()
      : style === "custom"
      ? `
STYLE (GEOMETRY): CUSTOM (FOLLOW USER NOTES FIRST)
- Strongly prioritize the user's custom style notes below.
- Keep it printable and single-piece with a flat bottom.
- Style affects geometry and design language, NOT materials.
`.trim()
      : `
STYLE (GEOMETRY): CLASSICAL / MUSEUM SCULPT
- Classical proportions and refined traditional sculpt feel.
- Slightly idealized realism is OK; clean anatomy and refined facial planes.
- Integrated base (if present) can be more traditional in silhouette (gentle bevels),
  but still ONE piece with a flat bottom.
- Style affects geometry and sculpt language, NOT materials.
`.trim();

  const userNotes = styleHint?.trim()
    ? `
USER STYLE NOTES (IMPORTANT):
${styleHint.trim()}
`.trim()
    : "";

  const variationBoost = `
VARIATION ENCOURAGEMENT:
- Keep likeness accurate, but allow the STYLE to influence:
  - neckline/cut shape,
  - integrated base silhouette (still same mesh),
  - surface treatment in geometry (not material),
  - overall design language (classical vs modern).
- Ensure the result does not look identical across styles; style must visibly affect the sculpt.
`.trim();

  return [baseRules, styleBlock, userNotes, variationBoost].filter(Boolean).join("\n\n");
}

async function downloadPhonePhoto(token: string): Promise<{
  buf: Buffer;
  contentType: string;
  originalName: string;
}> {
  const candidates = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
  for (const ext of candidates) {
    const path = `phone/${token}/photo.${ext}`;
    const { data, error } = await supabaseAdmin.storage.from(UPLOADS_BUCKET).download(path);
    if (!error && data) {
      const arrayBuf = await data.arrayBuffer();
      const contentType =
        ext === "png"
          ? "image/png"
          : ext === "webp"
          ? "image/webp"
          : ext === "heic" || ext === "heif"
          ? "image/heic"
          : "image/jpeg";
      return { buf: Buffer.from(arrayBuf), contentType, originalName: `phone-photo.${ext}` };
    }
  }
  throw new Error("No phone photo found yet. Upload from your phone first.");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const email = String(formData.get("email") ?? "").trim();
    const bustSizeRaw = String(formData.get("bustSize") ?? "").trim(); // must be 100|200|300
    const style = String(formData.get("style") ?? "").trim(); // classical | modern | custom
    const styleHint = String(formData.get("styleHint") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    const phoneUploadToken = String(formData.get("phoneUploadToken") ?? "").trim();
    const images = formData.getAll("images") as File[];

    if (!email || !bustSizeRaw || !style) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sizeMm = Number(bustSizeRaw);
    if (![100, 200, 300].includes(sizeMm)) {
      return NextResponse.json(
        { error: "Invalid bustSize. Must be 100, 200, or 300." },
        { status: 400 }
      );
    }

    const priceCents = PRICE_BY_SIZE_CENTS[sizeMm];
    if (!priceCents) {
      return NextResponse.json({ error: "Pricing not configured for this size." }, { status: 500 });
    }

    const usingDirectUpload = images.length === 1;
    const usingPhoneUpload = images.length === 0 && !!phoneUploadToken;

    if (!usingDirectUpload && !usingPhoneUpload) {
      return NextResponse.json(
        { error: "Upload 1 image OR upload from phone and then submit." },
        { status: 400 }
      );
    }

    const apiKey = process.env.MESHY_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "MESHY_API_KEY is missing" }, { status: 500 });

    const nowIso = new Date().toISOString();

    // Create order row FIRST (so client can always redirect)
    const insertPayload: any = {
      email,
      bust_height_mm: sizeMm, // using this as chosen size
      bust_style: style,
      notes,
      status: "created",
      preview_attempts: 1,
      generation_started_at: nowIso,
      price_cents: priceCents,
    };

    // optional if your DB has it (you added it earlier)
    if (usingPhoneUpload) insertPayload.phone_upload_token = phoneUploadToken;

    const { data: orderData, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert(insertPayload)
      .select("id")
      .single();

    if (orderError || !orderData?.id) {
      return NextResponse.json(
        { error: orderError?.message ?? "Failed to create order", details: orderError?.details ?? null },
        { status: 500 }
      );
    }

    const orderId = String(orderData.id);

    // Load file bytes
    let fileBuffer: Buffer;
    let fileNameOriginal: string;
    let contentType: string;

    if (usingDirectUpload) {
      const img = images[0];
      const maxSize = 10 * 1024 * 1024;
      if (img.size > maxSize) {
        return NextResponse.json({ error: "Image must be less than 10MB", orderId }, { status: 201 });
      }
      fileBuffer = Buffer.from(await img.arrayBuffer());
      fileNameOriginal = img.name || "upload.jpg";
      contentType = img.type || "image/jpeg";
    } else {
      try {
        const phone = await downloadPhonePhoto(phoneUploadToken);
        fileBuffer = phone.buf;
        fileNameOriginal = phone.originalName;
        contentType = phone.contentType;
      } catch (e: any) {
        await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", orderId);
        return NextResponse.json(
          { orderId, warning: e?.message ?? "Phone photo not found yet." },
          { status: 201 }
        );
      }
    }

    // Upload original
    const fileName = `${orderId}/${Date.now()}-${fileNameOriginal}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(UPLOADS_BUCKET)
      .upload(fileName, fileBuffer, { contentType, upsert: false });

    if (uploadError || !uploadData?.path) {
      await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", orderId);
      return NextResponse.json(
        { orderId, warning: uploadError?.message ?? "Upload failed" },
        { status: 201 }
      );
    }

    // Store uploads row (you use uploads table)
    await supabaseAdmin.from("uploads").insert({ order_id: orderId, storage_path: uploadData.path } as any);

    // Signed URL for Meshy
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(UPLOADS_BUCKET)
      .createSignedUrl(uploadData.path, 60 * 30);

    if (signErr || !signed?.signedUrl) {
      await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", orderId);
      return NextResponse.json(
        { orderId, warning: signErr?.message ?? "Failed to sign image URL" },
        { status: 201 }
      );
    }

    const prompt = buildPreviewPrompt(style, styleHint);

    // Create Meshy image-to-image task (PREVIEW ONLY)
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
      await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", orderId);
      return NextResponse.json(
        {
          orderId,
          warning: "Failed to create Meshy image-to-image task",
          meshyStatus: img2imgRes.status,
          meshyResponse: img2imgJson,
        },
        { status: 201 }
      );
    }

    await supabaseAdmin
      .from("orders")
      .update({
        status: "processing",
        meshy_image_task_id: taskId,
        generation_started_at: nowIso,
      } as any)
      .eq("id", orderId);

    // Always return orderId so UI can redirect
    return NextResponse.json({ orderId, meshyImageTaskId: taskId }, { status: 201 });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
