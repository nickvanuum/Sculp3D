// src/app/api/admin/login/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password, next } = await req.json().catch(() => ({ password: "", next: "/admin/orders" }));

  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not set" }, { status: 500 });
  }

  if (typeof password !== "string" || password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, redirect: typeof next === "string" ? next : "/admin/orders" });

  // Cookie valid for 7 days
  res.cookies.set("admin_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: true, // if you’re local http, this cookie may not set in some browsers; if so, switch to false in dev
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
