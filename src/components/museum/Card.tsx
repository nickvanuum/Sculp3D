import React from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-[rgb(var(--panel))] p-6 shadow-[0_0_0_1px_rgba(168,85,247,0.10),0_18px_60px_rgba(0,0,0,0.55)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-2xl font-semibold tracking-tight text-white/95 sm:text-3xl">
      {children}
    </h1>
  );
}

export function CardSubtitle({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-sm text-white/65">{children}</p>;
}
