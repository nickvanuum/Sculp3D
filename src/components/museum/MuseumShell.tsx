import React from "react";
import { cn } from "@/lib/cn";

export function MuseumShell({
  children,
  className,
  withContainer = true,
}: {
  children: React.ReactNode;
  className?: string;
  withContainer?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--ink))]",
        className
      )}
    >
      {/* subtle grain */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.12]"
        style={{
          backgroundImage:
            "url('data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"320\"%3E%3Cfilter id=\"n\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.9\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"320\" height=\"320\" filter=\"url(%23n)\" opacity=\"0.55\"/%3E%3C/svg%3E')",
        }}
      />

      {/* ambient glows */}
      <div className="pointer-events-none fixed inset-x-0 top-[-240px] -z-10 mx-auto h-[560px] w-[560px] rounded-full bg-gradient-to-b from-fuchsia-500/30 via-purple-500/18 to-transparent blur-3xl" />
      <div className="pointer-events-none fixed right-[-260px] top-[120px] -z-10 h-[720px] w-[720px] rounded-full bg-gradient-to-l from-purple-500/26 via-fuchsia-500/10 to-transparent blur-3xl" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />

      {withContainer ? (
        <div className="mx-auto w-full max-w-6xl px-6">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
