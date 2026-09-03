"use client";

import { HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
          {label}
        </div>
        <span
          title={hint}
          className="text-stone-400 hover:text-stone-700"
          aria-label={hint}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          value === "—" ? "text-stone-400" : "text-emerald-900",
        )}
      >
        {value}
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded-lg">
        {inner}
      </a>
    );
  }
  return inner;
}

export function TooltipLabel({
  label,
  hint,
}: {
  label: string;
  hint?: string;
}) {
  if (!hint) return <>{label}</>;
  return (
    <span className="inline-flex items-center gap-1" title={hint}>
      {label}
      <HelpCircle className="h-3 w-3 text-stone-400" aria-hidden />
      <span className="sr-only">{hint}</span>
    </span>
  );
}
