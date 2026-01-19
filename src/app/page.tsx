"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type BustStyle = "classical" | "modern" | "custom";
type Height = 100 | 150 | 200;

export default function OrderPage() {
  const [email, setEmail] = useState("");
  const [height, setHeight] = useState<Height>(150);
  const [style, setStyle] = useState<BustStyle>("classical");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const photoCount = files.length;
  const qualityTier = useMemo(() => {
    if (photoCount >= 6) return { label: "High likeness", hint: "Best recognition & angles" };
    if (photoCount >= 3) return { label: "Standard", hint: "Good for a first draft" };
    return { label: "Not enough photos", hint: "Upload at least 3" };
  }, [photoCount]);

  function onPickFiles(list: FileList | null) {
    setError(null);
    if (!list) return;

    const picked = Array.from(list);
    const images = picked.filter((f) => f.type.startsWith("image/"));

    if (images.length !== picked.length) {
      setError("Please upload image files only (JPG/PNG/HEIC).");
    }

    const merged = [...files, ...images].slice(0, 12);
    setFiles(merged);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!consent) {
      setError("Please accept consent to continue.");
      return;
    }

    if (files.length < 3 || files.length > 12) {
      setError("Upload between 3 and 12 photos.");
      return;
    }

    setLoading(true);
    try {
      // IMPORTANT: /api/orders expects multipart/form-data
      const fd = new FormData();
      fd.append("email", email.trim());
      fd.append("bustSize", String(height)); // API expects bustSize
      fd.append("style", style);
      fd.append("notes", notes ?? "");

      // IMPORTANT: API uses formData.getAll("images")
      for (const f of files) {
        fd.append("images", f);
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        body: fd,
        // DO NOT set Content-Type manually for FormData
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Failed to create order.");
        return;
      }

      if (!data?.orderId) {
        setError("Order created but no orderId returned.");
        return;
      }

      window.location.href = `/order/${data.orderId}`;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
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
        <div className="text-sm text-slate-600">Order</div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-14 pt-6">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Form */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">Start your order</h1>
            <p className="mt-2 text-sm text-slate-600">
              This step creates your order and uploads your photos. Next we’ll add payment.
            </p>

            <form className="mt-6 space-y-6" onSubmit={onSubmit}>
              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-indigo-200 focus:ring-4"
                />
              </div>

              {/* Size */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <label className="text-sm font-medium">Bust height</label>
                  <span className="text-xs text-slate-500">Measured base → top</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ChoiceCard title="10 cm" subtitle="Small" selected={height === 100} onClick={() => setHeight(100)} />
                  <ChoiceCard title="15 cm" subtitle="Classic" selected={height === 150} onClick={() => setHeight(150)} />
                  <ChoiceCard title="20 cm" subtitle="Statement" selected={height === 200} onClick={() => setHeight(200)} />
                </div>
              </div>

              {/* Style */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Style</label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ChoiceCard title="Classical" subtitle="Museum bust" selected={style === "classical"} onClick={() => setStyle("classical")} />
                  <ChoiceCard title="Modern" subtitle="Clean base" selected={style === "modern"} onClick={() => setStyle("modern")} />
                  <ChoiceCard title="Custom" subtitle="By request" selected={style === "custom"} onClick={() => setStyle("custom")} />
                </div>
              </div>

              {/* Photos */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <label className="text-sm font-medium">Photos</label>
                  <span className="text-xs text-slate-500">{photoCount}/12</span>
                </div>

                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => onPickFiles(e.target.files)}
                    className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                      {qualityTier.label}
                    </span>
                    <span className="text-xs text-slate-600">{qualityTier.hint}</span>
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {files.map((f, i) => (
                      <div
                        key={f.name + i}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{f.name}</p>
                          <p className="text-xs text-slate-500">
                            {(f.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any requests? Example: glasses on, softer expression, custom base text…"
                  className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-indigo-200 focus:ring-4"
                />
              </div>

              {/* Consent */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">
                    I confirm I have permission to use these photos to create a 3D model and print a bust.
                    I understand likeness depends on photo quality and angles.
                  </span>
                </label>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {loading ? "Creating order…" : "Create order"}
              </button>

              <p className="text-xs text-slate-500">
                Next steps: Stripe payment → generation preview → print.
              </p>
            </form>
          </div>

          {/* Side guide */}
          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold">Photo guide</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="flex gap-2"><span className="text-emerald-600">✓</span>Front, 2× three-quarter, left, right (5 photos)</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span>Even lighting, no harsh shadows</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span>Neutral expression, no filters</li>
                <li className="flex gap-2"><span className="text-emerald-600">✓</span>Hair pulled back if possible</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6 shadow-sm">
              <p className="text-sm font-semibold">Process</p>
              <p className="mt-2 text-sm text-slate-600">
                Upload → AI reconstruction → bust styling → preview approval → print.
              </p>
              <p className="mt-3 text-xs text-slate-500">Want maximum likeness? Upload 6–12 photos.</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function ChoiceCard({
  title,
  subtitle,
  selected,
  onClick,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-4 text-left shadow-sm transition",
        selected
          ? "border-indigo-300 bg-indigo-50 ring-4 ring-indigo-100"
          : "border-slate-200 bg-white hover:bg-slate-50",
      ].join(" ")}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
    </button>
  );
}
