"use client";

import React from "react";

export type FilamentId = "marble_white" | "stone_gray" | "wood_tone";

export type FilamentOption = {
  id: FilamentId;
  label: string;
  subtitle: string;
  imageSrc: string; // /filaments/xxx.png
};

const FILAMENTS: FilamentOption[] = [
  {
    id: "marble_white",
    label: "Marble White",
    subtitle: "Classic museum look",
    imageSrc: "/filaments/marble_white.png",
  },
  {
    id: "stone_gray",
    label: "Stone Gray",
    subtitle: "Modern stone / concrete",
    imageSrc: "/filaments/stone_gray.png",
  },
  {
    id: "wood_tone",
    label: "Wood-tone",
    subtitle: "Warm terracotta feel",
    imageSrc: "/filaments/wood_tone.png",
  },
];

export function FilamentSelector({
  value,
  onChange,
  disabled,
}: {
  value: FilamentId | null;
  onChange: (v: FilamentId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Choose filament color</p>
          <p className="mt-1 text-xs text-slate-600">
            This changes the final printed bust. You must choose before payment.
          </p>
        </div>

        <div className="text-xs text-slate-600">
          Selected:{" "}
          <span className="font-semibold text-slate-900">
            {value ? FILAMENTS.find((f) => f.id === value)?.label : "none"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FILAMENTS.map((f) => {
          const active = value === f.id;
          return (
            <button
              key={f.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(f.id)}
              className={[
                "rounded-2xl border p-3 text-left shadow-sm transition",
                disabled ? "opacity-60" : "",
                active ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-200 hover:border-slate-400",
              ].join(" ")}
            >
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img
                  src={f.imageSrc}
                  alt={f.label}
                  className="h-48 w-full object-cover"
                  draggable={false}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{f.label}</p>
                  <p className="text-xs text-slate-600">{f.subtitle}</p>
                </div>

                {active ? (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
                    ✓
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
