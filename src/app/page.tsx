import Link from "next/link";
import Image from "next/image";

const HERO_SRC = "/hero/bust-hero.png"; // change to .jpg/.webp if needed

export default function HomePage() {
  return (
    <div className="space-y-0">
      {/* HERO */}
      <section className="card-surface relative overflow-hidden rounded-3xl">
        {/* soft hero wash */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-blue-100/60 via-sky-100/30 to-transparent blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(47,107,255,0.045),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(59,201,255,0.06),transparent_50%)]" />
        </div>

        <div className="relative grid gap-7 p-6 lg:grid-cols-2 lg:items-center lg:p-8">
          {/* Left copy */}
          <div>
            

            <h1 className="mt-3 text-[2.25rem] leading-tight font-semibold tracking-tight text-slate-900 lg:text-5xl">
              Turn your portrait into a{" "}
              <span className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-600 bg-clip-text text-transparent">
                custom 3D printed bust
              </span>
            </h1>

            <p className="mt-3 text-sm text-slate-600 max-w-prose">
              Upload one great photo. We generate a clear preview you can approve before payment.
              After approval, we produce a print-ready model for manufacturing.
            </p>

            {/* CTA */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/order"
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-ring"
              >
                Start your order
              </Link>
              <Link
                href="/museum"
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus-ring"
              >
                See examples
              </Link>
            </div>

            {/* ✅ Cards moved under buttons (single set only) */}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { title: "Upload", desc: "One sharp portrait", icon: "/icons/camera.svg" },
                { title: "Preview", desc: "Check likeness + style", icon: "/icons/mesh.svg" },
                { title: "Produce", desc: "After approval", icon: "/icons/box.svg" },
              ].map((x) => (
                <div key={x.title} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Image src={x.icon} alt="" width={18} height={18} className="h-[18px] w-[18px]" />
                    <p className="text-xs font-semibold text-slate-900">{x.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{x.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right visual */}
          <div className="relative">
            <div className="card-surface relative overflow-hidden rounded-3xl p-3">
              {/* subtle wireframe overlay (no file needed) */}
              <div className="wireframe-overlay" />

              <div className="relative overflow-hidden rounded-2xl bg-white">
               

                {/* slightly tighter portrait ratio to save vertical space */}
                <div className="relative aspect-[5/6] w-full">
                  <Image
                    src={HERO_SRC}
                    alt="3D bust preview example"
                    fill
                    priority
                    className="object-cover"
                  />
                </div>
              </div>

              {/* small caption, optional; remove if you want even tighter */}
              <p className="mt-2 text-xs text-slate-500">
                Preview image generated from one uploaded photo.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
