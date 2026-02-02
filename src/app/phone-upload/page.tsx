"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type UploadResp = { ok?: boolean; error?: string };

export default function PhoneUploadPage() {
  const sp = useSearchParams();
  const token = useMemo(() => sp.get("token") || "", [sp]);

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload() {
    setMsg(null);

    if (!token) return setMsg("Missing token. Please rescan the QR code from your computer.");
    if (!file) return setMsg("Choose a photo or take a selfie first.");

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("token", token);
      fd.append("photo", file);

      const res = await fetch("/api/phone-upload", {
        method: "POST",
        body: fd,
      });

      const json = (await res.json().catch(() => ({}))) as UploadResp;

      if (!res.ok) {
        setMsg(json?.error ?? "Upload failed.");
        setBusy(false);
        return;
      }

      setMsg("✅ Uploaded. You can go back to your computer now.");
      setBusy(false);
    } catch (e: any) {
      setMsg(e?.message ?? "Upload failed");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="card-surface rounded-3xl p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Upload from your phone</h1>
        <p className="mt-2 text-sm text-slate-600">
          Take a selfie or choose a photo. It will attach to your order.
        </p>

        {/* Custom file button (keeps UI English; avoids “Bestand kiezen”) */}
        <div className="mt-5">
          <label className="text-sm font-semibold text-slate-900">Photo</label>

          <div className="mt-2 flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50">
              Choose photo…
              <input
                type="file"
                accept="image/*"
                // IMPORTANT: no `capture` attribute => gallery is allowed
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <span className="text-xs text-slate-500">
              {file ? `Selected: ${file.name}` : "No file selected"}
            </span>
          </div>

          <button
            onClick={upload}
            disabled={busy}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {busy ? "Uploading…" : "Upload photo"}
          </button>

          <p className="mt-3 text-xs text-slate-500">
            Tip: front-lit, sharp, no filters. A 3/4 angle usually works best.
          </p>

          {msg ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {msg}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
