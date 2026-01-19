"use client";

import React, { useEffect, useState } from "react";

type PollResult = {
  status?: string;
  progress?: number;
  previewModelUrl?: string | null;
  previewImageUrl?: string | null;
  bustPreviewUrl?: string | null;
  message?: string;
  error?: string;
};

export function OrderLivePreview({
  orderId,
  initialStatus,
}: {
  orderId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [progress, setProgress] = useState<number | null>(null);

  const [previewModelUrl, setPreviewModelUrl] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [bustPreviewUrl, setBustPreviewUrl] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [show3D, setShow3D] = useState(false);

  // Load <model-viewer> only if needed
  useEffect(() => {
    if (!show3D) return;

    const existing = document.querySelector('script[data-model-viewer="1"]');
    if (existing) return;

    const s = document.createElement("script");
    s.type = "module";
    s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
    s.setAttribute("data-model-viewer", "1");
    document.head.appendChild(s);
  }, [show3D]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(`/api/meshy/poll?orderId=${encodeURIComponent(orderId)}`);
        const data: PollResult = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok) {
          setError((data as any)?.error ?? "Failed to fetch preview status");
          return;
        }

        if (data.status) setStatus(data.status);
        if (typeof data.progress === "number") setProgress(data.progress);

        if (typeof data.previewModelUrl !== "undefined") setPreviewModelUrl(data.previewModelUrl ?? null);
        if (typeof data.previewImageUrl !== "undefined") setPreviewImageUrl(data.previewImageUrl ?? null);
        if (typeof data.bustPreviewUrl !== "undefined") setBustPreviewUrl(data.bustPreviewUrl ?? null);
      } catch {
        if (!cancelled) setError("Network error while checking preview status");
      }
    }

    const interval = setInterval(tick, 5000);
    tick();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId]);

  if (error) {
    return (
      <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error}
      </div>
    );
  }

  const bestImage = bustPreviewUrl || previewImageUrl;

  // READY STATE: show image first (customer-friendly)
  if (status === "preview_ready" && bestImage) {
    return (
      <div className="mt-6">
        <p className="text-sm font-semibold">Your preview</p>
        <p className="mt-1 text-sm text-slate-600">
          This is a preview to confirm the likeness and overall style. We do final cleanup before printing.
        </p>

        <div className="relative mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <img src={bestImage} alt="Bust preview" className="w-full" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rotate-[-20deg] rounded-xl bg-white/70 px-4 py-2 text-sm font-semibold text-slate-900 shadow">
              Sculp3D Preview
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold">What to check</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>• Face shape and features look like you</li>
            <li>• Hair and overall silhouette look right</li>
            <li>• Ignore small surface artifacts — we smooth those before print</li>
          </ul>
        </div>

        {previewModelUrl ? (
          <div className="mt-4">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
              onClick={() => setShow3D((v) => !v)}
            >
              {show3D ? "Hide interactive 3D" : "View interactive 3D (optional)"}
            </button>

            {show3D ? (
              <div className="relative mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-black">
                {React.createElement("model-viewer", {
                  src: previewModelUrl,
                  "camera-controls": true,
                  "auto-rotate": true,
                  "rotation-per-second": "20deg",
                  "shadow-intensity": "1",
                  exposure: "1",
                  "environment-image": "neutral",
                  style: { width: "100%", height: "420px" },
                })}

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rotate-[-20deg] rounded-xl bg-white/70 px-4 py-2 text-sm font-semibold text-slate-900 shadow">
                    Sculp3D Preview
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          onClick={() => alert("Next step: wire this button to Stripe Checkout.")}
        >
          Approve &amp; Pay
        </button>

        <p className="mt-2 text-xs text-slate-500">
          You approve the likeness and direction. Final cleanup happens before printing.
        </p>
      </div>
    );
  }

  // READY but no image yet: still allow 3D, but keep it optional
  if (status === "preview_ready" && previewModelUrl) {
    return (
      <div className="mt-6">
        <p className="text-sm font-semibold">Preview ready</p>
        <p className="mt-1 text-sm text-slate-600">
          We’re preparing a clean preview image. You can still view the 3D model if you’d like.
        </p>

        <button
          type="button"
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
          onClick={() => setShow3D(true)}
        >
          View interactive 3D
        </button>

        {show3D ? (
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-black">
            {React.createElement("model-viewer", {
              src: previewModelUrl,
              "camera-controls": true,
              "auto-rotate": true,
              "rotation-per-second": "20deg",
              "shadow-intensity": "1",
              exposure: "1",
              "environment-image": "neutral",
              style: { width: "100%", height: "420px" },
            })}
          </div>
        ) : null}

        <button
          type="button"
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          onClick={() => alert("Next step: wire this button to Stripe Checkout.")}
        >
          Approve &amp; Pay
        </button>
      </div>
    );
  }

  // PROCESSING STATE
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold">Preparing your preview...</p>
      <p className="mt-1 text-sm text-slate-600">
        We’re generating a model and a simple preview image. You’ll be able to approve it before payment.
      </p>

      <div className="mt-3 rounded-xl bg-white p-3">
        <p className="text-sm text-slate-700">
          Status: <span className="font-mono">{status}</span>
          {progress !== null ? <> — {progress}%</> : null}
        </p>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-slate-900"
            style={{ width: `${Math.max(5, Math.min(100, progress ?? 10))}%` }}
          />
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Tip: for best likeness, upload photos from multiple angles with even lighting.
        </p>
      </div>
    </div>
  );
}
