"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FilamentSelector, type FilamentId } from "@/components/FilamentSelector";

type Props = {
  orderId: string;
  initialStatus: string;
};

type OrderStatus =
  | "created"
  | "processing"
  | "preview_ready"
  | "failed"
  | "paid"
  | "in_production"
  | "shipped"
  | "unknown";

type StatusResponse = {
  order?: {
    id: string;
    status: string;
    preview_attempts: number;
    retry_credits: number;
    generation_started_at?: string | null;

    clayPreviewUrl?: string | null;
    modelGlbUrl?: string | null;
    modelObjUrl?: string | null;

    filament_color?: string | null;
  };
  stage?: "clay_preview" | "model" | null;
  message?: string | null;
  error?: string;
};

const FREE_ATTEMPTS = 2;

function asOrderStatus(s: any): OrderStatus {
  const v = String(s ?? "").trim();
  const allowed: OrderStatus[] = [
    "created",
    "processing",
    "preview_ready",
    "failed",
    "paid",
    "in_production",
    "shipped",
    "unknown",
  ];
  return allowed.includes(v as OrderStatus) ? (v as OrderStatus) : "unknown";
}

export function OrderLivePreview({ orderId, initialStatus }: Props) {
  const [status, setStatus] = useState<OrderStatus>(() => asOrderStatus(initialStatus));
  const [attempts, setAttempts] = useState<number>(0);
  const [credits, setCredits] = useState<number>(0);

  const [stage, setStage] = useState<"clay_preview" | "model" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [clayPreviewUrl, setClayPreviewUrl] = useState<string | null>(null);
  const [modelGlbUrl, setModelGlbUrl] = useState<string | null>(null);
  const [modelObjUrl, setModelObjUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [uiMsg, setUiMsg] = useState<string | null>(null);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const startedAtRef = useRef<number | null>(null);

  const [show3D, setShow3D] = useState(false);
  const viewerTopRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [filament, setFilament] = useState<FilamentId | null>(null);

  // ✅ boolean flags to avoid TS2367 narrowing issues
  const isPaid = status === "paid";
  const isPreviewReady = status === "preview_ready";

  useEffect(() => {
    if (status !== "processing") return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  const freeRemaining = useMemo(() => Math.max(0, FREE_ATTEMPTS - attempts), [attempts]);

  const stageLabel = useMemo(() => {
    if (stage === "clay_preview") return "Preview image";
    if (stage === "model") return "3D model";
    return null;
  }, [stage]);

  const elapsedSec = useMemo(() => {
    const t0 = startedAtRef.current;
    if (!t0) return 0;
    return Math.max(0, Math.floor((nowMs - t0) / 1000));
  }, [nowMs]);

  const statusText = useMemo(() => {
    switch (status) {
      case "paid":
        return "Paid ✅";
      case "preview_ready":
        return "Preview ready";
      case "processing":
        return "Generating…";
      case "failed":
        return "Failed";
      case "created":
        return "Created";
      case "in_production":
        return "In production";
      case "shipped":
        return "Shipped";
      default:
        return "Unknown";
    }
  }, [status]);

  const canRetry = isPreviewReady;
  const canPay = (isPreviewReady || isPaid) && (isPaid || !!filament);
  const canShow3D = isPaid && !!modelGlbUrl;

  async function refresh() {
    const res = await fetch(`/api/orders/status?orderId=${encodeURIComponent(orderId)}`, {
      cache: "no-store",
    });

    const json: StatusResponse = await res.json().catch(() => ({}));

    if (!res.ok || json.error) {
      setUiMsg((prev) => prev ?? json?.error ?? "Could not load order status.");
      return;
    }

    const o = json.order;
    if (!o) {
      setUiMsg((prev) => prev ?? "Order not found.");
      return;
    }

    setUiMsg(null);

    const nextStatus = asOrderStatus(o.status);
    setStatus(nextStatus);

    setAttempts(Number(o.preview_attempts ?? 0));
    setCredits(Number(o.retry_credits ?? 0));

    setStage(json.stage ?? null);
    setMessage(json.message ?? null);

    setClayPreviewUrl(o.clayPreviewUrl ?? null);
    setModelGlbUrl(o.modelGlbUrl ?? null);
    setModelObjUrl(o.modelObjUrl ?? null);

    const dbFilament = (o.filament_color ?? null) as FilamentId | null;
    if (dbFilament && !filament) setFilament(dbFilament);

    if (o.generation_started_at) {
      const t = Date.parse(o.generation_started_at);
      if (Number.isFinite(t)) startedAtRef.current = t;
    }

    if (nextStatus === "processing" && !startedAtRef.current) {
      startedAtRef.current = Date.now();
    }

    if (nextStatus !== "paid") setShow3D(false);
  }

  useEffect(() => {
    let intervalMs = 15000;
    if (status === "processing") intervalMs = 2500;
    else if (status === "preview_ready") intervalMs = 10000;
    else if (status === "paid" && !modelGlbUrl) intervalMs = 5000;

    const t = setInterval(refresh, intervalMs);
    refresh();

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, orderId, modelGlbUrl]);

  async function retry() {
    setUiMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/orders/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUiMsg(json?.error ?? "Retry failed.");
        setLoading(false);
        return;
      }

      startedAtRef.current = Date.now();
      setStatus("processing");
      setShow3D(false);
      setLoading(false);
    } catch (e: any) {
      setUiMsg(e?.message ?? "Retry failed.");
      setLoading(false);
    }
  }

  async function goCheckout(mode: "order" | "retry") {
    setUiMsg(null);

    if (mode === "order" && !isPaid && !filament) {
      setUiMsg("Please choose a filament color before paying.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          mode,
          filament_color: filament,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.url) {
        setUiMsg(json?.error ?? "Could not start checkout.");
        setLoading(false);
        return;
      }

      window.location.href = String(json.url);
    } catch (e: any) {
      setUiMsg(e?.message ?? "Checkout failed.");
      setLoading(false);
    }
  }

  function toggle3D() {
    const next = !show3D;
    setShow3D(next);
    if (next) {
      requestAnimationFrame(() => {
        viewerTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  const showFilamentChooser = (isPreviewReady || isPaid) && !!clayPreviewUrl;

  const payHint = !isPaid
    ? !isPreviewReady
      ? "Pay unlocks after the preview is ready."
      : "Choose a filament color to pay."
    : null;

  return (
    <div className="mt-5 space-y-4">
      {/* TOP actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Status: {statusText}</p>
          {stageLabel ? <p className="text-xs text-slate-600">Stage: {stageLabel}</p> : null}
        </div>

        <div className="mt-2 text-sm text-slate-600">
          Attempts used: <span className="font-semibold text-slate-900">{attempts}</span>
          {freeRemaining > 0 ? (
            <>
              {" "}
              • Free remaining: <span className="font-semibold text-slate-900">{freeRemaining}</span>
            </>
          ) : (
            <>
              {" "}
              • Retry credits: <span className="font-semibold text-slate-900">{credits}</span>
            </>
          )}
        </div>

        {status === "processing" ? (
          <div className="mt-2 text-xs text-slate-500">
            Working… {elapsedSec}s elapsed
            {message ? <span className="ml-2">• {message}</span> : null}
          </div>
        ) : null}

        {uiMsg ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {uiMsg}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => goCheckout("order")}
            disabled={!canPay || loading}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {isPaid ? "Paid ✅" : loading ? "Redirecting…" : "Approve & pay"}
          </button>

          <button
            type="button"
            onClick={retry}
            disabled={!canRetry || loading}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Working…" : "Retry preview"}
          </button>

          <button
            type="button"
            onClick={() => goCheckout("retry")}
            disabled={loading || credits > 0 || freeRemaining > 0}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            title={
              freeRemaining > 0 ? "You still have free attempts." : credits > 0 ? "You already have a credit." : ""
            }
          >
            Buy extra attempt (€2.99)
          </button>

          <button
            type="button"
            onClick={toggle3D}
            disabled={!canShow3D}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {show3D ? "Hide 3D" : "View 3D"}
          </button>
        </div>

        {!canPay && !isPaid && payHint ? (
          <p className="mt-3 text-xs text-slate-500">{payHint}</p>
        ) : null}
      </div>

      {/* Preview */}
      {clayPreviewUrl ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Preview</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <img src={clayPreviewUrl} alt="Preview" className="w-full" />
          </div>
        </div>
      ) : null}

      {/* Filament selection + bottom pay */}
      {showFilamentChooser ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Choose filament color</p>
          <p className="mt-1 text-xs text-slate-500">
            Required before paying. This is the print color (single-material).
          </p>

          <div className="mt-3">
            <FilamentSelector value={filament} onChange={setFilament} disabled={isPaid} />
          </div>

          <button
            type="button"
            onClick={() => goCheckout("order")}
            disabled={!canPay || loading}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {isPaid ? "Paid ✅" : loading ? "Redirecting…" : "Approve & pay"}
          </button>

          {!canPay && !isPaid && payHint ? (
            <p className="mt-2 text-xs text-slate-500">{payHint}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
