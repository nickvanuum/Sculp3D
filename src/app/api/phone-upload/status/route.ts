// src/app/api/phone-upload/status/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UPLOADS_BUCKET = "Uploads";
const SIGN_SECONDS = 60 * 30;

export async function GET(req: NextRequest) {
  try {
    const token = String(req.nextUrl.searchParams.get("token") ?? "").trim();
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    // List everything under phone/<token> and pick the first photo.* file
    const folder = `phone/${token}`;
    const { data: files, error: listErr } = await supabaseAdmin.storage
      .from(UPLOADS_BUCKET)
      .list(folder, { limit: 20 });

    if (listErr) {
      return NextResponse.json({ status: "waiting", token }, { status: 200 });
    }

    const file = (files ?? []).find((f) => /^photo\.(jpg|jpeg|png|webp|heic|heif)$/i.test(f.name));
    if (!file) {
      return NextResponse.json({ status: "waiting", token }, { status: 200 });
    }

    const path = `${folder}/${file.name}`;

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(UPLOADS_BUCKET)
      .createSignedUrl(path, SIGN_SECONDS);

    if (signErr || !signed?.signedUrl) {
      // File exists, but signing failed (rare). Still tell UI it uploaded.
      return NextResponse.json({ status: "uploaded", token, path, previewUrl: null }, { status: 200 });
    }

    return NextResponse.json(
      { status: "uploaded", token, path, previewUrl: signed.signedUrl },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Status check failed" }, { status: 500 });
  }
}
