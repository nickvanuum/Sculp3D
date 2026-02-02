export default function SiteFooter() {
  return (
    <footer className="mt-10 border-t bg-white/60">
      <div className="container-page py-8 text-xs text-slate-500 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Sculp3D</p>
        <p className="muted">Portrait → Preview → Approval → Print</p>
      </div>
    </footer>
  );
}
