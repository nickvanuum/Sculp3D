// src/app/order/[id]/page.tsx
export const runtime = "nodejs";

import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { OrderLivePreview } from "@/components/OrderLivePreview";

type OrderRow = {
  id: string;
  status: string | null;
  preview_attempts: number | null;
  retry_credits: number | null;
  generation_started_at: string | null;
};

type PageProps = {
  // ✅ Next 15+ can provide params as a Promise
  params: Promise<{ id: string }>;
};

export default async function OrderPage({ params }: PageProps) {
  // ✅ Fix: unwrap params Promise
  const { id: orderId } = await params;

  if (!orderId) notFound();

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id,status,preview_attempts,retry_credits,generation_started_at")
    .eq("id", orderId)
    .single();

  if (error || !order) notFound();

  const o = order as OrderRow;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Your order</h1>
        <p className="mt-1 text-sm text-slate-600">
          Order ID: <span className="font-mono text-slate-900">{o.id}</span>
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <OrderLivePreview orderId={o.id} initialStatus={String(o.status ?? "created")} />
      </div>
    </div>
  );
}
