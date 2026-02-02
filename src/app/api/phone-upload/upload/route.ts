// src/app/api/phone-upload/upload/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UPLOADS_BUCKET = "Uploads"; // case-sensitive

function extFromContentType(ct: string) {
  const v = (ct || "").toLowerCase();
  if (v.includes("png")) return "png";
  if (v.includes("webp")) return "webp";
  if (v.includes("heic")) return "heic";
  if (v.includes("heif")) return "heif";
  return "jpg";
}

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: 'Content-Type must be "multipart/form-data".' },
        { status: 400 }
      );
    }

    const form = await req.formData();
    const token = String(form.get("token") ?? "").trim();
    const file = form.get("photo");

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing photo file" }, { status: 400 });
    }

    const maxSize = 12 * 1024 * 1024; // 12MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "Photo must be less than 12MB" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "image/jpeg";
    const ext = extFromContentType(contentType);

    const storagePath = `phone/${token}/photo.${ext}`;

    const { error } = await supabaseAdmin.storage.from(UPLOADS_BUCKET).upload(storagePath, buf, {
      upsert: true,
      contentType,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path: storagePath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upload failed" }, { status: 500 });
  }
}
