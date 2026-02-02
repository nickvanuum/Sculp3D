// src/app/api/stripe/webhook/route.ts
export const runtime = "nodejs";

import Stripe from "stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-01-27.acacia" as any,
});

function pickMeta(session: Stripe.Checkout.Session) {
  const meta = (session.metadata || {}) as Record<string, string>;
  return {
    orderId: String(meta.orderId || meta.order_id || "").trim(),
    mode: String(meta.mode || meta.checkoutMode || "order").trim(), // "order"|"retry"
    filament: String(meta.filament_color || meta.filament || "").trim(),
  };
}

function extractShipping(session: Stripe.Checkout.Session) {
  // Stripe sometimes puts shipping in shipping_details, sometimes in customer_details
  const shipping = (session as any).shipping_details || null;
  const customer = (session as any).customer_details || null;

  const shipName = shipping?.name ?? customer?.name ?? null;
  const shipEmail = customer?.email ?? null;
  const shipPhone = customer?.phone ?? null;

  const addr = shipping?.address ?? customer?.address ?? null;

  const shipLine1 = addr?.line1 ?? null;
  const shipLine2 = addr?.line2 ?? null;
  const shipCity = addr?.city ?? null;
  const shipRegion = addr?.state ?? null;
  const shipPostal = addr?.postal_code ?? null;
  const shipCountry = addr?.country ?? null;

  return {
    ship_name: shipName,
    ship_email: shipEmail,
    ship_phone: shipPhone,
    ship_line1: shipLine1,
    ship_line2: shipLine2,
    ship_city: shipCity,
    ship_region: shipRegion,
    ship_postal_code: shipPostal,
    ship_country: shipCountry,
  };
}

export async function POST(req: Request) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET missing" }, { status: 500 });

    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

    const rawBody = Buffer.from(await req.arrayBuffer());

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    } catch (err: any) {
      return NextResponse.json({ error: "Invalid signature", details: err?.message }, { status: 400 });
    }

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const { orderId, mode } = pickMeta(session);

    if (!orderId) return NextResponse.json({ received: true });

    const shippingPatch = extractShipping(session);

    // Always mark paid for main order purchases
    if (mode === "order") {
      const patch: Record<string, any> = {
        status: "paid",
        ...shippingPatch,
      };

      const { error } = await supabaseAdmin.from("orders").update(patch as any).eq("id", orderId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ received: true });
    }

    // Retry mode: add credits (example: +1)
    if (mode === "retry") {
      // Keep your existing retry_credits logic if you already have it
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("retry_credits")
        .eq("id", orderId)
        .single();

      const nextCredits = Number(order?.retry_credits ?? 0) + 1;

      const { error } = await supabaseAdmin
        .from("orders")
        .update({ retry_credits: nextCredits, ...shippingPatch } as any)
        .eq("id", orderId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Webhook error", details: msg }, { status: 500 });
  }
}
