// src/app/admin/login/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

// Prevent Next from trying to prerender this page at build time
export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // This assumes you have an API route that sets a cookie/session.
      // If your middleware uses Basic Auth only, you can remove this fetch and just route to /admin.
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json?.error ?? "Login failed");
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Network error");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Admin login</h1>
      <p className="mt-2 text-sm text-slate-600">
        Sign in to manage orders and fulfillment.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-900">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus-ring"
            placeholder="admin@sculp3d.store"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-900">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus-ring"
            placeholder="••••••••"
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60 focus-ring"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-xs text-slate-500">
          If you’re using middleware Basic Auth instead of a login API route, just go to{" "}
          <span className="font-mono">/admin</span> and enter credentials in the browser prompt.
        </p>
      </form>
    </div>
  );
}
