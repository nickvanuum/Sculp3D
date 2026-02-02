// src/app/api/phone-upload/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UPLOADS_BUCKET = "Uploads"; // case-sensitive
const MAX_BYTES = 12 * 1024 * 1024; // 12MB
const SIGN_SECONDS = 60 * 30;

function extFromMime(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("heic")) return "heic";
  if (m.includes("heif")) return "heif";
  return "jpg";
}

function extFromName(name: string): string | null {
  const n = (name || "").toLowerCase().trim();
  const m = n.match(/\.([a-z0-9]+)$/);
  if (!m) return null;
  const ext = m[1];
  if (["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // 1) Non-multipart => create token
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      const token = crypto.randomUUID();
      return NextResponse.json({ token }, { status: 201 });
    }

    // 2) Multipart => upload
    const urlToken = (req.nextUrl.searchParams.get("token") || "").trim();
    const form = await req.formData();
    const formToken = String(form.get("token") ?? "").trim();
    const token = urlToken || formToken;

    if (!token) {
      return NextResponse.json(
        { error: "Missing token. Please rescan the QR from your computer." },
        { status: 400 }
      );
    }

    const photo = (form.get("photo") as File | null) || (form.get("file") as File | null) || null;
    if (!photo) return NextResponse.json({ error: "Please choose a photo or take one." }, { status: 400 });
    if (photo.size > MAX_BYTES) return NextResponse.json({ error: "Photo is too large (max 12MB)." }, { status: 400 });

    const mime = (photo.type || "image/jpeg").toLowerCase();
    const name = (photo as any).name || "photo.jpg";
    const ext = extFromName(name) ?? extFromMime(mime);

    const storagePath = `phone/${token}/photo.${ext}`;
    const buf = Buffer.from(await photo.arrayBuffer());

    const upload = await supabaseAdmin.storage.from(UPLOADS_BUCKET).upload(storagePath, buf, {
      upsert: true,
      contentType: mime,
    });

    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    const { data: signed } = await supabaseAdmin.storage
      .from(UPLOADS_BUCKET)
      .createSignedUrl(storagePath, SIGN_SECONDS);

    return NextResponse.json(
      {
        ok: true,
        token,
        bucket: UPLOADS_BUCKET,
        path: storagePath,
        previewUrl: signed?.signedUrl ?? null,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Phone upload failed" }, { status: 500 });
  }
}
