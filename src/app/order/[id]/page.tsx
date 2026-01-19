// src/app/order/[id]/page.tsx
import { OrderLivePreview } from "./OrderLivePreview";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-server";

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !order) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            ← Back home
          </Link>
          <h1 className="mt-6 text-2xl font-semibold">Order not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            We couldn’t find that order ID. If you just created it, try refreshing in a moment.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="pointer-events-none fixed inset-x-0 top-[-240px] -z-10 mx-auto h-[520px] w-[520px] rounded-full bg-gradient-to-b from-indigo-200/70 via-sky-200/40 to-transparent blur-3xl" />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <span className="text-lg">◼︎</span>
          </span>
          <span className="text-sm font-semibold tracking-wide">
            Sculp<span className="text-indigo-600">3D</span>
          </span>
        </Link>
        <div className="text-sm text-slate-600">Order status</div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-14 pt-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Order received</h1>
          <p className="mt-2 text-sm text-slate-600">
            Order ID: <span className="font-mono text-slate-900">{order.id}</span>
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Info label="Status" value={String(order.status ?? "unknown")} />
            <Info label="Email" value={String(order.email ?? "")} />
            <Info label="Bust height (mm)" value={String(order.bust_height_mm ?? "")} />
            <Info label="Style" value={String(order.bust_style ?? "")} />
          </div>

          {order.notes ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium text-slate-500">Notes</p>
              <p className="mt-1 text-sm text-slate-700">{String(order.notes)}</p>
            </div>
          ) : null}
          <OrderLivePreview
  orderId={order.id}
  initialStatus={String(order.status ?? "created")}
/>


          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold">What happens next?</p>
            <ol className="mt-2 list-decimal pl-5 text-sm text-slate-600 space-y-1">
              <li>Next we’ll add Stripe payment.</li>
              <li>After payment, we generate a preview for your approval.</li>
              <li>Then we print and ship your bust.</li>
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
