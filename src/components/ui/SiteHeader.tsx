import Link from "next/link";
import Image from "next/image";

const LOGO_SRC = "/brand/logo-primary.svg"; // change to .png if yours is png

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-3 focus-ring rounded-xl px-2 py-1">
          <Image
            src={LOGO_SRC}
            alt="Sculp3D"
            width={132}
            height={34}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link className="muted hover:text-slate-900 focus-ring rounded-lg px-2 py-1" href="/museum">
            Museum
          </Link>

          <Link
            href="/order"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus-ring"
          >
            Start order
          </Link>
        </nav>
      </div>
    </header>
  );
}
