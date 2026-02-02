"use client";

import * as React from "react";

export default function PhoneUploadPage({ params }: { params: { token: string } }) {
  const token = params.token;

  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function upload() {
    setError(null);
    setOk(false);

    if (!file) {
      setError("Please select or take a photo.");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("token", token);
      fd.append("photo", file);

      const res = await fetch("/api/phone-upload", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) throw new Error(json?.error || "Upload failed");
      setOk(true);
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-5 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Upload your portrait</h1>
      <p className="mt-2 text-sm text-slate-600">
        Take a selfie or choose a photo. After uploading, go back to your computer and submit the order.
      </p>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {ok ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Upload successful ✅ You can return to your computer now.
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <label className="block text-sm font-medium text-slate-900">Photo</label>
        <input
          className="mt-2 block w-full"
          type="file"
          accept="image/*"
          capture="user"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="mt-2 text-xs text-slate-600">
          Best results: clear face, even lighting, no filters.
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={upload}
          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>

      <p className="mt-6 text-xs text-slate-500 break-all">
        Token: <span className="font-mono">{token}</span>
      </p>
    </main>
  );
}
