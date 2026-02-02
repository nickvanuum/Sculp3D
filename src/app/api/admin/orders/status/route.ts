export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOWED = new Set(["paid", "in_production", "shipped"]);

export async function POST(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  if (!cookie.includes("admin_auth=1")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = String(body?.orderId || "").trim();
  const status = String(body?.status || "").trim().toLowerCase();

  if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  if (!ALLOWED.has(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const { error } = await supabaseAdmin.from("orders").update({ status } as any).eq("id", orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
