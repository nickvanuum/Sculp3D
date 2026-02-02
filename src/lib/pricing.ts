export type BustTier = {
  label: string;
  heightMm: number;
  priceEur: number;
  subtitle?: string;
};

export const BUST_TIERS: BustTier[] = [
  { label: "10 cm", heightMm: 100, priceEur: 59, subtitle: "Small" },
  { label: "15 cm", heightMm: 150, priceEur: 79, subtitle: "Classic" },
  { label: "20 cm", heightMm: 200, priceEur: 99, subtitle: "Statement" },
];

// fallback if user types a custom height
export function priceForHeightMm(heightMm: number): number {
  const tiers = [...BUST_TIERS].sort((a, b) => a.heightMm - b.heightMm);

  // snap to nearest tier within 10mm, otherwise linearly scale from 150mm baseline
  const nearest = tiers.reduce((best, t) => {
    const d = Math.abs(t.heightMm - heightMm);
    return d < best.d ? { t, d } : best;
  }, { t: tiers[0], d: Number.POSITIVE_INFINITY }).t;

  if (Math.abs(nearest.heightMm - heightMm) <= 10) return nearest.priceEur;

  // simple scaling rule: +€1 per extra 5mm over 150mm, min 59
  const baseline = 150;
  const baselinePrice = 79;
  const delta = heightMm - baseline;
  const add = Math.round(delta / 5); // 5mm steps
  return Math.max(59, baselinePrice + add);
}
