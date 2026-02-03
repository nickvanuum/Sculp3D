// src/app/api/admin/orders/assets/route.ts
// BUILD_SIGNATURE: assets-route-no-archiver-2026-02-03
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const OUTPUTS_BUCKET = "Outputs";
const SIGN_SECONDS = 60 * 30;

type OrderRow = {
  id: string;
  status: string | null;
  email: string | null;
  bust_height_mm: number | null;
  bust_style: string | null;
  filament_color: string | null;

  ship_name: string | null;
  ship_email: string | null;
  ship_phone: string | null;
  ship_line1: string | null;
  ship_line2: string | null;
  ship_city: string | null;
  ship_region: string | null;
  ship_postal_code: string | null;
  ship_country: string | null;

  clay_preview_path: string | null;
  model_glb_path: string | null;
  model_obj_path: string | null;
};

async function signedUrlOrNull(path: string | null) {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(OUTPUTS_BUCKET)
    .createSignedUrl(path, SIGN_SECONDS);

  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orderId = String(url.searchParams.get("orderId") || "").trim();
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(
        [
          "id",
          "status",
          "email",
          "bust_height_mm",
          "bust_style",
          "filament_color",
          "ship_name",
          "ship_email",
          "ship_phone",
          "ship_line1",
          "ship_line2",
          "ship_city",
          "ship_region",
          "ship_postal_code",
          "ship_country",
          "clay_preview_path",
          "model_glb_path",
          "model_obj_path",
        ].join(",")
      )
      .eq("id", orderId)
      .single<OrderRow>();

    if (error || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    return NextResponse.json(
      {
        orderId: order.id,
        status: order.status,
        email: order.email,
        bust_height_mm: order.bust_height_mm,
        bust_style: order.bust_style,
        filament_color: order.filament_color,
        shipping: {
          name: order.ship_name,
          email: order.ship_email,
          phone: order.ship_phone,
          line1: order.ship_line1,
          line2: order.ship_line2,
          city: order.ship_city,
          region: order.ship_region,
          postal_code: order.ship_postal_code,
          country: order.ship_country,
        },
        assets: {
          preview_url: await signedUrlOrNull(order.clay_preview_path),
          glb_url: await signedUrlOrNull(order.model_glb_path),
          obj_url: await signedUrlOrNull(order.model_obj_path),
        },
        exported_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Internal error", details: msg }, { status: 500 });
  }
}
