"use client";

import React from "react";
import { useSearchParams } from "next/navigation";

export default function PhoneUploadPage() {
  const sp = useSearchParams();

  const token =
    sp.get("token")?.trim() ||
    sp.get("t")?.trim() ||
    sp.get("uploadToken")?.trim() ||
    "";

  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const libraryInputRef = React.useRef<HTMLInputElement | null>(null);

  function pickCamera() {
    setErr(null);
    setMsg(null);
    cameraInputRef.current?.click();
  }

  function pickLibrary() {
    setErr(null);
    setMsg(null);
    libraryInputRef.current?.click();
  }

  async function submit() {
    setErr(null);
    setMsg(null);

    if (!token) {
      setErr("Missing token. Please rescan the QR from your computer.");
      return;
    }
    if (!file) {
      setErr("Please choose a photo or take a selfie first.");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("token", token);
      fd.append("photo", file);

      confirmedLog("Uploading", { name: file.name, type: file.type, size: file.size });

      const res = await fetch("/api/phone-upload", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) throw new Error(json?.error || "Upload failed");

      setMsg("Uploaded ✔ Return to your computer to continue.");
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  // small helper: avoids lint complaining about console logs if you want them
  function confirmedLog(label: string, obj: any) {
    // comment this out if you don't want logs
    console.log(`[phone-upload] ${label}`, obj);
  }

  const cardStyle: React.CSSProperties = {
    marginTop: 14,
    border: "1px solid #e2e8f0",
    background: "white",
    padding: 14,
    borderRadius: 14,
  };

  const btnStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #0f172a",
    background: "#0f172a",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  };

  const btnAltStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "white",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
  };

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 18, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Upload from your phone</h1>
      <p style={{ marginTop: 8, color: "#475569", fontSize: 14 }}>
        Take a selfie or choose a photo. After uploading, return to your computer and submit the order.
      </p>

      {!token ? (
        <div
          style={{
            marginTop: 14,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            padding: 12,
            borderRadius: 12,
            color: "#9f1239",
            fontSize: 14,
          }}
        >
          <div style={{ fontWeight: 700 }}>Missing token.</div>
          <div style={{ marginTop: 6 }}>
            Please open this page by scanning the QR code on your computer (don’t type the URL manually).
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#7f1d1d" }}>
            Debug query:{" "}
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {sp.toString() || "(empty)"}
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* Hidden inputs (more reliable on iOS/Android) */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
            }}
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
            }}
          />

          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>1) Choose photo source</div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <button type="button" onClick={pickCamera} style={btnStyle} disabled={busy}>
                Take a selfie
              </button>

              <button type="button" onClick={pickLibrary} style={btnAltStyle} disabled={busy}>
                Choose from photo library
              </button>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
              Token:{" "}
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {token.slice(0, 8)}…{token.slice(-6)}
              </span>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>2) Upload</div>

            <div style={{ marginTop: 10, fontSize: 13, color: "#334155" }}>
              Selected:{" "}
              {file ? (
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {file.name} ({Math.round(file.size / 1024)} KB)
                </span>
              ) : (
                <span style={{ color: "#64748b" }}>None</span>
              )}
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={busy}
              style={{
                ...btnStyle,
                marginTop: 12,
                opacity: busy ? 0.7 : 1,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Uploading…" : "Upload photo"}
            </button>

            <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
              If nothing happens when tapping “Take a selfie”, open this page in Safari/Chrome (not inside an app
              browser).
            </div>
          </div>

          {msg ? (
            <div
              style={{
                marginTop: 14,
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                padding: 12,
                borderRadius: 12,
                color: "#166534",
                fontSize: 14,
              }}
            >
              {msg}
            </div>
          ) : null}

          {err ? (
            <div
              style={{
                marginTop: 14,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                padding: 12,
                borderRadius: 12,
                color: "#9f1239",
                fontSize: 14,
              }}
            >
              {err}
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
