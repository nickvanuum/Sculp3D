import React from "react";
import { Card } from "./Card";

export function PhotoGuideCard() {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-white/90">Photo guidelines</p>
      <ul className="mt-3 space-y-2 text-sm text-white/70">
        <li><span className="text-[rgb(var(--accent))]">✓</span> 3/4 view works best</li>
        <li><span className="text-[rgb(var(--accent))]">✓</span> Even lighting, no harsh shadows</li>
        <li><span className="text-[rgb(var(--accent))]">✓</span> No filters, sharp face</li>
      </ul>
    </Card>
  );
}

export function ProcessCard() {
  return (
    <Card className="p-5">
      <p className="text-sm font-semibold text-white/90">Process</p>
      <p className="mt-2 text-sm text-white/70">
        Upload → bust preview image → (optional) 3D → approval → payment → print.
      </p>
    </Card>
  );
}
