// src/app/api/stripe/checkout/route.ts
export const runtime = "nodejs";

import Stripe from "stripe";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-01-27.acacia" as any,
});

function shippingCentsForBustHeight(mm: number) {
  // Simple flat tiers (edit later)
  if (mm <= 100) return 990;   // €9.90
  if (mm <= 200) return 1290;  // €12.90
  return 1590;                 // €15.90
}

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "STRIPE_SECRET_KEY missing" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || "").trim();
    const mode = String(body?.mode || "order").trim(); // "order" | "retry"

    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id,status,price_cents,bust_height_mm,filament_color,email")
      .eq("id", orderId)
      .single();

    if (error || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const bustHeightMm = Number(order.bust_height_mm ?? 0);
    const email = String(order.email ?? "");
    const filament = String(order.filament_color ?? "");

    if (mode === "order") {
      if (!Number.isFinite(order.price_cents) || Number(order.price_cents) <= 0) {
        return NextResponse.json({ error: "Invalid price_cents on order" }, { status: 400 });
      }
      if (!bustHeightMm) return NextResponse.json({ error: "Missing bust height on order" }, { status: 400 });
      if (!filament) return NextResponse.json({ error: "Choose filament before paying" }, { status: 400 });
    }

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      mode === "retry"
        ? [
            {
              price_data: {
                currency: "eur",
                product_data: { name: "Extra preview generation" },
                unit_amount: 299,
              },
              quantity: 1,
            },
          ]
        : [
            {
              price_data: {
                currency: "eur",
                product_data: {
                  name: `Custom bust (${bustHeightMm}mm)`,
                },
                unit_amount: Number(order.price_cents),
              },
              quantity: 1,
            },
          ];

    const shippingRateCents = mode === "order" ? shippingCentsForBustHeight(bustHeightMm) : 0;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,

      // ✅ Collect shipping address & phone
      shipping_address_collection: { allowed_countries: ["NL", "BE", "DE", "FR", "LU"] },
      phone_number_collection: { enabled: true },

      // ✅ Add shipping costs in a supported way
      ...(shippingRateCents
        ? {
            shipping_options: [
              {
                shipping_rate_data: {
                  display_name: "Standard shipping",
                  type: "fixed_amount",
                  fixed_amount: { amount: shippingRateCents, currency: "eur" },
                  delivery_estimate: {
                    minimum: { unit: "business_day", value: 3 },
                    maximum: { unit: "business_day", value: 7 },
                  },
                },
              },
            ],
          }
        : {}),

      // Useful defaults
      customer_email: email || undefined,

      // Where to go after payment
      success_url: `${origin}/order/${orderId}?paid=1`,
      cancel_url: `${origin}/order/${orderId}?canceled=1`,

      metadata: {
        orderId,
        mode,
        bust_height_mm: String(bustHeightMm || ""),
        filament_color: filament || "",
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Checkout error", details: msg }, { status: 500 });
  }
}
