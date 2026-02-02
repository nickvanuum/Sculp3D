"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export default function Button({ className, variant = "primary", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold " +
    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(99,102,241,0.35)] " +
    "disabled:opacity-60 disabled:cursor-not-allowed";

  const variants: Record<Variant, string> = {
    primary:
      "bg-slate-900 text-white shadow-sm hover:bg-slate-800 active:bg-slate-900",
    secondary:
      "bg-white text-slate-900 border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-white",
    ghost:
      "bg-transparent text-slate-900 hover:bg-slate-100 active:bg-slate-100",
  };

  return <button className={cn(base, variants[variant], className)} {...props} />;
}
