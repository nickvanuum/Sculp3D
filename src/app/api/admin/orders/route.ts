// src/app/api/admin/orders/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const OUTPUTS_BUCKET = "Outputs";
const SIGN_SECONDS = 60 * 30;

async function signedUrlOrNull(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage.from(OUTPUTS_BUCKET).createSignedUrl(path, SIGN_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function GET(req: Request) {
  // Basic cookie protection (middleware should already handle, but keep defense-in-depth)
  const cookie = req.headers.get("cookie") || "";
  if (!cookie.includes("admin_auth=1")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") || "").trim().toLowerCase();
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const ready = url.searchParams.get("ready") === "1";

  // Pull a reasonable number
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      [
        "id",
        "created_at",
        "status",
        "email",
        "bust_height_mm",
        "bust_style",
        "filament_color",
        "clay_preview_path",
        "model_glb_path",
        "model_obj_path",
        "ship_name",
        "ship_email",
        "ship_phone",
        "ship_line1",
        "ship_line2",
        "ship_city",
        "ship_region",
        "ship_postal_code",
        "ship_country",
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = (data || []) as any[];

  if (status) rows = rows.filter((r) => String(r.status || "").toLowerCase() === status);

  if (q) {
    rows = rows.filter((r) => {
      const hay = [
        r.id,
        r.email,
        r.ship_name,
        r.ship_email,
        r.ship_city,
        r.ship_postal_code,
        r.ship_country,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  if (ready) {
    rows = rows.filter((r) => {
      const st = String(r.status || "").toLowerCase();
      const paid = st === "paid" || st === "in_production" || st === "shipped";
      const hasFilament = !!r.filament_color;
      const hasModel = !!r.model_glb_path || !!r.model_obj_path;
      return paid && hasFilament && hasModel;
    });
  }

  // Attach signed urls
  const out = await Promise.all(
    rows.map(async (r) => {
      const previewUrl = await signedUrlOrNull(r.clay_preview_path ?? null);
      const glbUrl = await signedUrlOrNull(r.model_glb_path ?? null);
      const objUrl = await signedUrlOrNull(r.model_obj_path ?? null);
      return {
        ...r,
        previewUrl,
        glbUrl,
        objUrl,
      };
    })
  );

  return NextResponse.json({ orders: out });
}
