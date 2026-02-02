"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * CreateOrderForm supports:
 * - Desktop upload (exactly 1 image)
 * - Phone upload via QR (token -> phone upload page -> status polling)
 * - 9 style presets (mapped to backend style: classical|modern|custom)
 * - FIXED pricing based on 3 sizes (100/200/300mm)
 *
 * Backend expectations:
 * POST /api/orders expects form fields:
 *  - email (string)
 *  - bustSize (string/number mm) => 100 | 200 | 300
 *  - style (classical|modern|custom)
 *  - styleHint (string)
 *  - notes (string)
 *  - images (File) optional if phoneUploadToken is used
 *  - phoneUploadToken (string) optional if using phone upload
 *
 * Phone endpoints:
 *  - POST /api/phone-upload                 -> { token }  (when not multipart)
 *  - GET  /api/phone-upload/status?token=... -> { status: "waiting"|"uploaded", previewUrl? }
 */

type SizeMm = 100 | 200 | 300;

const SIZES: Array<{
  sizeMm: SizeMm;
  label: string;
  subtitle: string;
  priceEur: number;
}> = [
  { sizeMm: 100, label: "Small", subtitle: "100 mm tall bust", priceEur: 39 },
  { sizeMm: 200, label: "Medium", subtitle: "200 mm tall bust", priceEur: 69 },
  { sizeMm: 300, label: "Large", subtitle: "300 mm tall bust", priceEur: 99 },
];

function formatEur(n: number) {
  return n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
}

type StylePreset =
  | "Classical Marble"
  | "Contemporary"
  | "Baroque"
  | "Art Deco"
  | "Neoclassical"
  | "Eclectic"
  | "Minimal"
  | "Heroic"
  | "Custom";

type BackendStyle = "classical" | "modern" | "custom";

const STYLE_PRESETS: {
  preset: StylePreset;
  backendStyle: BackendStyle;
  subtitle: string;
  hint: string; // default hint for non-custom
}[] = [
  {
    preset: "Classical Marble",
    backendStyle: "classical",
    subtitle: "Museum marble look",
    hint: "classical marble museum bust, refined, timeless, neutral studio background",
  },
  {
    preset: "Contemporary",
    backendStyle: "modern",
    subtitle: "Clean contemporary sculpture",
    hint: "contemporary sculpted bust, clean modern forms, subtle realism, premium studio lighting, neutral background",
  },
  {
    preset: "Baroque",
    backendStyle: "classical",
    subtitle: "Ornate & dramatic",
    hint: "baroque sculptural styling, ornate but tasteful, dramatic forms, premium finish, museum lighting",
  },
  {
    preset: "Art Deco",
    backendStyle: "modern",
    subtitle: "Geometric elegance",
    hint: "art deco style, geometric elegance, stylized forms, premium finish, clean backdrop",
  },
  {
    preset: "Neoclassical",
    backendStyle: "classical",
    subtitle: "Refined proportions",
    hint: "neoclassical bust, refined proportions, subtle realism, museum finish, neutral background",
  },
  {
    preset: "Eclectic",
    backendStyle: "custom",
    subtitle: "Modern × classical fusion",
    hint: "eclectic style mix, modern-classical fusion, premium look, tasteful stylization",
  },
  {
    preset: "Minimal",
    backendStyle: "modern",
    subtitle: "Simplified surfaces",
    hint: "minimal contemporary bust, simplified surfaces, smooth forms, premium studio aesthetic, neutral background",
  },
  {
    preset: "Heroic",
    backendStyle: "classical",
    subtitle: "Slightly heroic vibe",
    hint: "slightly heroic proportions, confident silhouette, premium museum lighting, tasteful realism",
  },
  {
    preset: "Custom",
    backendStyle: "custom",
    subtitle: "Your own vibe",
    hint: "",
  },
];

type PhoneStatusResponse = {
  status?: "waiting" | "uploaded";
  token?: string;
  path?: string;
  previewUrl?: string;
  error?: string;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function CreateOrderForm() {
  const router = useRouter();

  // core fields
  const [email, setEmail] = useState("");
  const [sizeMm, setSizeMm] = useState<SizeMm>(200);
  const [preset, setPreset] = useState<StylePreset>("Classical Marble");

  // Optional user hint (NOT the preset itself)
  const [extraStyleHint, setExtraStyleHint] = useState("");

  // For Custom preset: required freeform description
  const [customStyleHint, setCustomStyleHint] = useState("");

  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);

  // desktop upload
  const [image, setImage] = useState<File | null>(null);

  // phone upload
  const [phoneUploadToken, setPhoneUploadToken] = useState<string | null>(null);
  const [phoneState, setPhoneState] = useState<"idle" | "waiting" | "uploaded" | "error">("idle");
  const [phonePreviewUrl, setPhonePreviewUrl] = useState<string | null>(null);

  // ui
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStyle = useMemo(() => {
    return STYLE_PRESETS.find((x) => x.preset === preset) ?? STYLE_PRESETS[0];
  }, [preset]);

  const isCustom = preset === "Custom";

  const price = useMemo(() => {
    return SIZES.find((s) => s.sizeMm === sizeMm)?.priceEur ?? 69;
  }, [sizeMm]);

  // ✅ THE FIX:
  // Prevent stale hint text from a previous style.
  // When user clicks a different style card, clear both hint fields.
  useEffect(() => {
    setExtraStyleHint("");
    setCustomStyleHint("");
  }, [preset]);

  // Build phone upload URL (where your /phone-upload page exists)
  const phoneUploadUrl = useMemo(() => {
    if (!phoneUploadToken) return null;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/phone-upload?token=${encodeURIComponent(phoneUploadToken)}`;
  }, [phoneUploadToken]);

  // QR image (no deps)
  const qrImgSrc = useMemo(() => {
    if (!phoneUploadUrl) return null;
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      phoneUploadUrl
    )}`;
  }, [phoneUploadUrl]);

  async function generatePhoneToken() {
    setError(null);
    setPhonePreviewUrl(null);
    setPhoneState("idle");

    try {
      const res = await fetch("/api/phone-upload", { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.token) {
        setError(json?.error ?? "Failed to create phone upload token");
        setPhoneState("error");
        return;
      }

      const token = String(json.token);
      setPhoneUploadToken(token);
      setPhoneState("waiting");
    } catch (e: any) {
      setError(e?.message ?? "Failed to create phone token");
      setPhoneState("error");
    }
  }

  // Poll phone upload status
  useEffect(() => {
    if (!phoneUploadToken) return;
    if (phoneState !== "waiting") return;

    const token = phoneUploadToken;
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(`/api/phone-upload/status?token=${encodeURIComponent(token)}`);
        const data: PhoneStatusResponse = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) return;

        if (data.status === "uploaded" && data.previewUrl) {
          setPhonePreviewUrl(data.previewUrl);
          setPhoneState("uploaded");
        }
      } catch {
        // ignore transient errors
      }
    }

    const interval = setInterval(tick, 2000);
    tick();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [phoneUploadToken, phoneState]);

  function appendToStyleHint(fragment: string) {
    const setter = isCustom ? setCustomStyleHint : setExtraStyleHint;

    setter((prev) => {
      const p = prev.trim();
      if (!p) return fragment;
      if (p.toLowerCase().includes(fragment.toLowerCase())) return p;
      return `${p}${p.endsWith(".") ? " " : ". "}${fragment}`;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const emailClean = email.trim();
    if (!emailClean) return setError("Please enter your email.");
    if (!consent) return setError("Please confirm you have permission to use this photo.");
    if (![100, 200, 300].includes(sizeMm)) return setError("Please choose a valid size.");

    // Must have either desktop file OR phone upload completed
    const usingDirect = !!image;
    const usingPhone = !!phoneUploadToken && phoneState === "uploaded";

    if (!usingDirect && !usingPhone) {
      return setError("Upload 1 photo OR upload from your phone via QR, then submit.");
    }

    if (isCustom && !customStyleHint.trim()) {
      return setError("Please describe your custom style.");
    }

    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("email", emailClean);
      fd.append("bustSize", String(sizeMm));
      fd.append("style", selectedStyle.backendStyle);

      const finalStyleHint = (() => {
        if (isCustom) {
          return [
            `CUSTOM STYLE REQUEST: ${customStyleHint.trim()}`,
            `Requirements: neutral background, no text, no extra people. The bust may have an integrated sculpted base / shoulders / cut plane, but DO NOT generate a separate pedestal, plinth, stand, column, or any object underneath the bust.`,
          ]
            .filter(Boolean)
            .join(" ");
        }

        const presetHint = `Preset: ${preset}. ${selectedStyle.hint}`;
        return [presetHint, extraStyleHint.trim()].filter(Boolean).join(" ");
      })();

      fd.append("styleHint", finalStyleHint);
      fd.append("notes", notes.trim());

      if (image) fd.append("images", image);
      if (usingPhone && phoneUploadToken) fd.append("phoneUploadToken", phoneUploadToken);

      const res = await fetch("/api/orders", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error ?? "Failed to create order.");
        setLoading(false);
        return;
      }

      const orderId = String(json?.orderId || "");
      if (!orderId) {
        setError("Order created but no orderId returned.");
        setLoading(false);
        return;
      }

      router.push(`/order/${orderId}`);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Email */}
      <div>
        <label className="text-sm font-semibold text-slate-900">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus-ring"
          autoComplete="email"
        />
      </div>

      {/* Size + price */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-semibold text-slate-900">Bust size</label>
          <div className="text-sm font-semibold text-slate-900">{formatEur(price)}</div>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Choose once here. You’ll confirm filament color and pay later.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {SIZES.map((s) => {
            const active = s.sizeMm === sizeMm;
            return (
              <button
                key={s.sizeMm}
                type="button"
                onClick={() => setSizeMm(s.sizeMm)}
                className={classNames(
                  "rounded-2xl border px-4 py-3 text-left shadow-sm transition",
                  active
                    ? "border-slate-900 bg-white ring-2 ring-slate-900/10"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {s.label} — {s.sizeMm}mm
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{s.subtitle}</p>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{formatEur(s.priceEur)}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Style presets */}
      <div>
        <label className="text-sm font-semibold text-slate-900">Style</label>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {STYLE_PRESETS.map((s) => {
            const selected = preset === s.preset;
            return (
              <button
                key={s.preset}
                type="button"
                onClick={() => setPreset(s.preset)}
                className={classNames(
                  "rounded-2xl border px-4 py-3 text-left shadow-sm transition",
                  selected
                    ? "border-slate-900 bg-white ring-2 ring-slate-900/10"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                )}
              >
                <p className="text-sm font-semibold text-slate-900">{s.preset}</p>
                <p className="mt-1 text-xs text-slate-500">{s.subtitle}</p>
              </button>
            );
          })}
        </div>

        {/* Style hint */}
        <div className="mt-3">
          <label className="text-sm font-semibold text-slate-900">
            {isCustom ? "Describe your style (required)" : "Extra style hint (optional)"}
          </label>

          {!isCustom ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">Base preset prompt</p>
              <p className="mt-1">{selectedStyle.hint}</p>
            </div>
          ) : null}

          <input
            value={isCustom ? customStyleHint : extraStyleHint}
            onChange={(e) =>
              isCustom ? setCustomStyleHint(e.target.value) : setExtraStyleHint(e.target.value)
            }
            placeholder={
              isCustom
                ? `e.g. "Roman marble, heroic proportions, clean neckline (no hoodie), subtle smile, smooth base"`
                : `Optional: e.g. "more dramatic", "cleaner hair", "stronger jawline"`
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus-ring"
          />

          {isCustom ? (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-500">
                Custom works best when you include: material, era/style, what to remove/add (e.g. hoodie),
                and do/don’t instructions.
              </p>

              <div className="flex flex-wrap gap-2">
                {["Roman marble", "Art Deco", "Minimal", "Heroic", "Bronze", "No hoodie", "No glasses", "No text"].map(
                  (chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => appendToStyleHint(chip)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-ring"
                    >
                      + {chip}
                    </button>
                  )
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-sm font-semibold text-slate-900">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything you want us to know"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus-ring"
        />
      </div>

      {/* Upload options */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Desktop upload */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Upload on this device</p>
          <p className="mt-1 text-xs text-slate-500">Choose exactly 1 sharp photo (front-lit, no filters).</p>

          <input
            type="file"
            accept="image/*"
            className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus-ring"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />

          {image ? <p className="mt-2 text-xs text-emerald-700">✅ Selected: {image.name}</p> : null}
        </div>

        {/* Phone upload */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Upload from your phone</p>
              <p className="mt-1 text-xs text-slate-500">
                Scan the QR to take a selfie or choose a photo. This page updates automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={generatePhoneToken}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus-ring"
            >
              {phoneUploadToken ? "New QR" : "Generate QR"}
            </button>
          </div>

          {qrImgSrc ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-[220px,1fr]">
              <img
                src={qrImgSrc}
                alt="Phone upload QR"
                className="h-[220px] w-[220px] rounded-xl border border-slate-200 bg-white p-2"
              />

              <div className="space-y-2">
                <p className="text-xs text-slate-500 break-all">Link: {phoneUploadUrl}</p>

                <p className="text-sm text-slate-700">
                  Status: <span className="font-mono">{phoneState}</span>
                </p>

                {phonePreviewUrl ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <img src={phonePreviewUrl} alt="Phone preview" className="w-full" />
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Upload on your phone, then come back here. (Refreshes every 2 seconds.)
                  </p>
                )}

                {phoneState === "uploaded" ? (
                  <p className="text-xs text-emerald-700">✅ Phone photo received.</p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Click <span className="font-semibold">Generate QR</span> to start.
            </p>
          )}
        </div>
      </div>

      {/* Consent */}
      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span className="text-slate-700">
          I confirm I have permission to use this photo to generate a 3D preview and produce a bust print.
        </span>
      </label>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 focus-ring"
      >
        {loading ? "Creating order..." : "Create bust preview"}
      </button>
    </form>
  );
}
