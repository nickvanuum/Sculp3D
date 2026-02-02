import CreateOrderForm from "@/components/CreateOrderForm";
import Image from "next/image";

export default function OrderPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
      {/* LEFT */}
      <section className="card-surface rounded-3xl p-6 lg:p-7">
      

        <div className="mt-6">
          <CreateOrderForm />
        </div>
      </section>

      {/* RIGHT */}
      <aside className="space-y-4">
        <div className="card-surface rounded-3xl p-5">
          <div className="flex items-center gap-2">
            <Image src="/icons/camera.svg" alt="" width={18} height={18} />
            <p className="text-sm font-semibold">Photo guide</p>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>✓ 3/4 angle works best</li>
            <li>✓ Even lighting, no harsh shadows</li>
            <li>✓ No filters, sharp face</li>
          </ul>
        </div>

        <div className="card-surface rounded-3xl p-5">
          <div className="flex items-center gap-2">
            <Image src="/icons/mesh.svg" alt="" width={18} height={18} />
            <p className="text-sm font-semibold">Process</p>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Upload → preview image → (optional) 3D → approve → payment → print.
          </p>
        </div>
      </aside>
    </div>
  );
}
