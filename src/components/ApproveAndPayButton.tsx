"use client";

import { useState } from "react";

type Props = {
  orderId: string;
  disabled?: boolean;
  // Optional: allow this button to be reused elsewhere
  mode?: "order" | "retry";
  filament_color?: string | null;
};

export default function ApproveAndPayButton({
  orderId,
  disabled,
  mode = "order",
  filament_color = null,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    try {
      setError(null);
      setLoading(true);

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          mode,
          filament_color,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Failed to start checkout");
      }

      if (!data?.url) {
        throw new Error("Missing checkout URL");
      }

      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={disabled || loading}
        className="w-full rounded-xl px-4 py-3 font-medium shadow-sm disabled:opacity-60"
      >
        {loading ? "Redirecting to payment..." : "Approve & Pay"}
      </button>

      {error ? (
        <p className="mt-2 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
