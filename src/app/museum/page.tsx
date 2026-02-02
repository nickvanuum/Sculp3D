import Link from "next/link";

export default function MuseumPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold text-slate-900">
            Sculp3D
          </Link>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <Link className="hover:text-slate-900" href="/">
              Home
            </Link>
            <Link
              className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:brightness-95"
              href="/order"
            >
              Start order
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Museum</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Placeholder gallery page. Later you can show finished busts, customer examples, or different style options.
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-lg border border-slate-200 bg-slate-50"
                aria-label={`Placeholder item ${i + 1}`}
              />
            ))}
          </div>

          <div className="mt-6">
            <Link href="/order" className="text-sm font-semibold text-indigo-600 hover:underline">
              Start an order →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
