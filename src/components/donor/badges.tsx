import type { DonorPhase, DonorStatus } from "@prisma/client";

import { PHASE_LABEL } from "@/lib/donor-phase-labels";
import { cn } from "@/lib/utils";

export function PhaseBadge({ phase }: { phase: DonorPhase }) {
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200">
      {PHASE_LABEL[phase]}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  ELIGIBLE: "bg-sky-50 text-sky-900 ring-sky-200",
  ACTIVE: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  PROSPECT: "bg-stone-100 text-stone-800 ring-stone-200",
  DEFERRED: "bg-amber-50 text-amber-900 ring-amber-200",
  REJECTED: "bg-red-50 text-red-900 ring-red-200",
  WITHDRAWN: "bg-stone-100 text-stone-600 ring-stone-200",
  RETIRED: "bg-violet-50 text-violet-900 ring-violet-200",
  SUSPENDED: "bg-orange-50 text-orange-900 ring-orange-200",
};

export function StatusPill({ status }: { status: DonorStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        STATUS_STYLES[status] ?? "bg-stone-100 text-stone-800 ring-stone-200",
      )}
    >
      {status}
    </span>
  );
}

export function NextActionBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-[14rem] truncate rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
      {label}
    </span>
  );
}
