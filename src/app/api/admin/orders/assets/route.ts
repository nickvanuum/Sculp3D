// src/app/api/admin/orders/assets/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import archiver from "archiver";
import { Writable } from "stream";

const OUTPUTS_BUCKET = "Outputs";

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

function safeName(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  if (!cookie.includes("admin_auth=1")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? "Order not found" }, { status: 404 });
  }

  // Create a streaming zip response
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const nodeWritable = new Writable({
    write(chunk, _enc, cb) {
      writer.write(chunk as any).then(() => cb(), cb);
    },
    final(cb) {
      writer.close().then(() => cb(), cb);
    },
  });

  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("error", async (err) => {
    try {
      await writer.abort(err);
    } catch {}
  });

  archive.pipe(nodeWritable);

  // Manifest JSON
  const manifest = {
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
      clay_preview_path: order.clay_preview_path,
      model_glb_path: order.model_glb_path,
      model_obj_path: order.model_obj_path,
    },
    exported_at: new Date().toISOString(),
  };

  archive.append(JSON.stringify(manifest, null, 2), { name: "order.json" });

  async function addFile(path: string | null, name: string) {
    if (!path) return;

    const dl = await supabaseAdmin.storage.from(OUTPUTS_BUCKET).download(path);
    if (dl.error || !dl.data) return;

    const buf = Buffer.from(await dl.data.arrayBuffer());
    archive.append(buf, { name });
  }

  await addFile(order.clay_preview_path, "preview.png");
  await addFile(order.model_glb_path, "model.glb");
  await addFile(order.model_obj_path, "model.obj");

  await archive.finalize();

  const filename = safeName(`sculp3d_${order.id.slice(0, 8)}.zip`);

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
