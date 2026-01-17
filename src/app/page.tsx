// src/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Top glow */}
      <div className="pointer-events-none fixed inset-x-0 top-[-240px] -z-10 mx-auto h-[520px] w-[520px] rounded-full bg-gradient-to-b from-indigo-200/70 via-sky-200/40 to-transparent blur-3xl" />

      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="group inline-flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <span className="text-lg">◼︎</span>
          </span>
          <span className="text-sm font-semibold tracking-wide">
            Sculp<span className="text-indigo-600">3D</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <a href="#how" className="text-sm text-slate-600 hover:text-slate-900">
            How it works
          </a>
          <a href="#pricing" className="text-sm text-slate-600 hover:text-slate-900">
            Pricing
          </a>
          <a href="#faq" className="text-sm text-slate-600 hover:text-slate-900">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/order"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Start an order
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-10">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Classical bust, modern pipeline
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Turn photos into a{" "}
              <span className="bg-gradient-to-r from-slate-900 via-indigo-700 to-sky-600 bg-clip-text text-transparent">
                lifelike 3D-printed bust
              </span>
              .
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
              Upload 3–5 photos for a quick draft, or add more for better likeness. We generate a 3D
              face model, shape it into a classical bust, then print it to your chosen size.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/order"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
              >
                Start an order
              </Link>
              <a
                href="#how"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
              >
                See how it works
              </a>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 max-w-xl">
              <Stat label="Photos" value="3–12" hint="More angles = better likeness" />
              <Stat label="Sizes" value="10–25cm" hint="Choose height at checkout" />
              <Stat label="Finish" value="FDM/Resin" hint="Depends on options" />
            </div>
          </div>

          {/* Hero card */}
          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-indigo-100 via-white to-sky-100" />
            <div className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">Preview</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Classical bust • Clean light</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                  Draft render
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Card title="Upload photos" desc="3–5 for quick draft, 6–12 best" icon="⬆︎" />
                <Card title="AI reconstruction" desc="Face model created from angles" icon="◈" />
                <Card title="Bust styling" desc="Classical base, refined silhouette" icon="⌁" />
                <Card title="Print & finish" desc="Printed in your chosen size" icon="⎔" />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500">Likeness note</p>
                <p className="mt-1 text-sm text-slate-700">
                  Results depend on photo quality and angles. You’ll approve a preview before printing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <p className="mt-2 text-sm text-slate-600">
              A classical artifact made with a modern workflow.
            </p>
          </div>
          <Link
            href="/order"
            className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 md:inline-flex"
          >
            Start an order
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Step n="01" title="Upload" desc="Choose size + style, upload photos, pay securely." />
          <Step n="02" title="Preview" desc="We generate a preview for you to approve (or redo)." />
          <Step n="03" title="Print" desc="We print your bust, finish it, and ship it to you." />
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">Simple pricing</h2>
        <p className="mt-2 text-sm text-slate-600">
          Start small, upgrade photo count for better likeness.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <PriceCard
            name="Standard"
            badge="Most popular"
            desc="3–5 photos • great for fast drafts"
            features={[
              "3–5 photos upload",
              "Preview approval included",
              "One revision request (photo redo)",
              "Classical bust base",
            ]}
          />
          <PriceCard
            name="High Likeness"
            badge="Best detail"
            desc="6–12 photos • best recognition & angles"
            features={[
              "6–12 photos upload",
              "Better likeness consistency",
              "Preview approval included",
              "Priority processing (optional later)",
            ]}
          />
        </div>

        <p className="mt-4 text-xs text-slate-500">
          You can start with 3–5 photos and add more later if we need better angles.
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Faq q="What photos work best?" a="Neutral lighting, clear face, multiple angles. Avoid heavy shadows and filters." />
          <Faq q="Will it be an exact copy?" a="It will be recognizable, but not a perfect replica. Photo quality matters a lot." />
          <Faq q="Can I request custom details?" a="Yes. Add notes at checkout. Some requests may need manual work (we’ll confirm)." />
          <Faq q="Do I approve before printing?" a="Yes. You approve the preview before we print." />
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-10">
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} Sculp3D</p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <Link className="hover:text-slate-700" href="/order">Order</Link>
            <a className="hover:text-slate-700" href="#faq">FAQ</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function Card({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <span className="text-lg">{icon}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-xs text-slate-600">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold text-indigo-700">{n}</p>
      <p className="mt-2 text-lg font-semibold">{title}</p>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
    </div>
  );
}

function PriceCard({
  name,
  badge,
  desc,
  features,
}: {
  name: string;
  badge: string;
  desc: string;
  features: string[];
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold">{name}</p>
          <p className="mt-1 text-sm text-slate-600">{desc}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
          {badge}
        </span>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-slate-700">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="mt-1 text-emerald-600">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Link
          href="/order"
          className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
        >
          Start with {name}
        </Link>
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{q}</p>
      <p className="mt-2 text-sm text-slate-600">{a}</p>
    </div>
  );
}
