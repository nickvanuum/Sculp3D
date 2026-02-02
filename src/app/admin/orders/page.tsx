"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type OrderRow = {
  id: string;
  created_at: string | null;
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

  previewUrl: string | null;
  glbUrl: string | null;
  objUrl: string | null;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString();
}

function shippingBlock(o: OrderRow) {
  const lines = [
    o.ship_name,
    o.ship_line1,
    o.ship_line2,
    [o.ship_postal_code, o.ship_city].filter(Boolean).join(" "),
    o.ship_region,
    o.ship_country,
    o.ship_phone ? `Phone: ${o.ship_phone}` : null,
    o.ship_email ? `Email: ${o.ship_email}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function isPaidLike(status: string | null) {
  const s = String(status || "").toLowerCase();
  return s === "paid" || s === "in_production" || s === "shipped";
}

function readyToPrint(o: OrderRow) {
  return isPaidLike(o.status) && !!o.filament_color && (!!o.glbUrl || !!o.objUrl);
}

type ViewMode = "list" | "board";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewMode>("list");

  async function load() {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status.trim()) params.set("status", status.trim());
    if (ready) params.set("ready", "1");

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`/api/admin/orders?${params.toString()}`, { signal: controller.signal });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error ?? `Failed to load orders (${res.status})`);
        setLoading(false);
        return;
      }

      setOrders(Array.isArray(json?.orders) ? json.orders : []);
      setLoading(false);
    } catch (e: any) {
      setError(e?.name === "AbortError" ? "Loading orders timed out" : (e?.message ?? "Network error"));
      setLoading(false);
    } finally {
      clearTimeout(t);
    }
  }

  async function setOrderStatus(orderId: string, nextStatus: "paid" | "in_production" | "shipped") {
    setBusyId(orderId);
    setError(null);

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch("/api/admin/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: nextStatus }),
        signal: controller.signal,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error ?? `Failed to update status (${res.status})`);
        setBusyId(null);
        return;
      }

      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
      setBusyId(null);
    } catch (e: any) {
      setError(e?.name === "AbortError" ? "Status update timed out" : (e?.message ?? "Network error"));
      setBusyId(null);
    } finally {
      clearTimeout(t);
    }
  }

  function openAllAssets(o: OrderRow) {
    // Open assets in new tabs (reliable, uses existing signed URLs)
    // Note: browsers may block multiple popups unless triggered by a direct click (this is).
    const urls = [o.previewUrl, o.glbUrl, o.objUrl].filter(Boolean) as string[];
    if (urls.length === 0) {
      setError("No assets available yet for this order.");
      return;
    }
    for (const u of urls) window.open(u, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusOptions = useMemo(() => {
    const s = new Set<string>();
    for (const o of orders) if (o.status) s.add(String(o.status));
    return Array.from(s).sort();
  }, [orders]);

  const board = useMemo(() => {
    const readyList: OrderRow[] = [];
    const prodList: OrderRow[] = [];
    const shippedList: OrderRow[] = [];

    for (const o of orders) {
      const st = String(o.status || "").toLowerCase();
      if (st === "shipped") shippedList.push(o);
      else if (st === "in_production") prodList.push(o);
      else if (readyToPrint(o)) readyList.push(o);
    }

    return { readyList, prodList, shippedList };
  }, [orders]);

  const OrderCard = ({ o }: { o: OrderRow }) => {
    const st = String(o.status || "").toLowerCase();
    const canShip = st === "in_production" || st === "paid";

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{o.email || "—"}</div>
            <div className="mt-1 text-xs text-slate-600">
              #{o.id.slice(0, 8)} • {o.bust_height_mm ?? "—"}mm • {o.bust_style ?? "—"} •{" "}
              {o.filament_color ?? "no filament"}
            </div>
          </div>
          <span
            className={classNames(
              "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold",
              isPaidLike(o.status) ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-800"
            )}
          >
            {o.status || "—"}
          </span>
        </div>

        <div className="mt-3 text-xs text-slate-600 whitespace-pre-wrap">{shippingBlock(o) || "No shipping info"}</div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/order/${o.id}`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus-ring"
          >
            Open order
          </Link>

          <button
            onClick={async () => {
              const text = shippingBlock(o);
              if (!text) return;
              await navigator.clipboard.writeText(text);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus-ring"
          >
            Copy address
          </button>

          <button
            onClick={() => openAllAssets(o)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus-ring"
          >
            Download all
          </button>

          <div className="ml-auto flex gap-2">
            <button
              disabled={busyId === o.id || st === "in_production" || st === "shipped"}
              onClick={() => setOrderStatus(o.id, "in_production")}
              className={classNames(
                "rounded-xl px-3 py-2 text-xs font-semibold shadow-sm focus-ring",
                st === "in_production" || st === "shipped"
                  ? "border border-slate-200 bg-slate-50 text-slate-400"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              Mark in production
            </button>

            <button
              disabled={busyId === o.id || st === "shipped" || !canShip}
              onClick={() => setOrderStatus(o.id, "shipped")}
              className={classNames(
                "rounded-xl px-3 py-2 text-xs font-semibold shadow-sm focus-ring",
                st === "shipped" || !canShip
                  ? "border border-slate-200 bg-slate-50 text-slate-400"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >
              Mark shipped
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {o.glbUrl ? (
            <a href={o.glbUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-900 underline">
              GLB
            </a>
          ) : (
            <span className="text-xs text-slate-400">GLB</span>
          )}
          {o.objUrl ? (
            <a href={o.objUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-900 underline">
              OBJ
            </a>
          ) : (
            <span className="text-xs text-slate-400">OBJ</span>
          )}
          {o.previewUrl ? (
            <a href={o.previewUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-900 underline">
              Preview
            </a>
          ) : (
            <span className="text-xs text-slate-400">Preview</span>
          )}
        </div>

        <div className="mt-2 text-[11px] text-slate-500">{formatDate(o.created_at)}</div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-600">Mark production/shipping and download assets quickly.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setView("list")}
            className={classNames(
              "rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm focus-ring",
              view === "list" ? "border-slate-900 bg-white text-slate-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            List
          </button>
          <button
            onClick={() => setView("board")}
            className={classNames(
              "rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm focus-ring",
              view === "board" ? "border-slate-900 bg-white text-slate-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            Board
          </button>
          <button
            onClick={load}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus-ring"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr,220px,180px,160px]">
        <div>
          <label className="text-xs font-semibold text-slate-700">Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="email, order id, name, city…"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus-ring"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm focus-ring"
          >
            <option value="">All</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800">
          <input type="checkbox" checked={ready} onChange={(e) => setReady(e.target.checked)} />
          Ready to print
        </label>

        <button
          onClick={load}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-ring"
        >
          Apply
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          Loading…
        </div>
      ) : view === "board" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Ready to print</div>
            {board.readyList.length ? board.readyList.map((o) => <OrderCard key={o.id} o={o} />) : <div className="text-sm text-slate-500">None</div>}
          </div>
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">In production</div>
            {board.prodList.length ? board.prodList.map((o) => <OrderCard key={o.id} o={o} />) : <div className="text-sm text-slate-500">None</div>}
          </div>
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Shipped</div>
            {board.shippedList.length ? board.shippedList.map((o) => <OrderCard key={o.id} o={o} />) : <div className="text-sm text-slate-500">None</div>}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
              No orders found.
            </div>
          ) : (
            orders.map((o) => <OrderCard key={o.id} o={o} />)
          )}
        </div>
      )}
    </div>
  );
}
