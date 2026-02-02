import Link from "next/link";

export function TopNav({
  rightLabel,
  links,
  cta,
}: {
  rightLabel?: string;
  links?: Array<{ href: string; label: string }>;
  cta?: { href: string; label: string };
}) {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="inline-flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(168,85,247,0.14),0_10px_30px_rgba(0,0,0,0.45)]">
          <span className="text-lg text-white/90">◼︎</span>
        </span>
        <span className="text-sm font-semibold tracking-wide text-white/90">
          Sculp<span className="text-[rgb(var(--accent))]">3D</span>
        </span>
      </Link>

      <div className="flex items-center gap-4">
        {links?.length ? (
          <nav className="hidden items-center gap-4 text-sm text-white/70 sm:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
        ) : null}

        {rightLabel ? <div className="text-sm text-white/60">{rightLabel}</div> : null}

        {cta ? (
          <Link
            href={cta.href}
            className="inline-flex items-center justify-center rounded-2xl bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-black shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(168,85,247,0.35)] hover:brightness-110"
          >
            {cta.label}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
