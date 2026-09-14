import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  NEW: "bg-sky-50 text-sky-900 ring-sky-200",
  ASSIGNED: "bg-indigo-50 text-indigo-900 ring-indigo-200",
  CONTACTED_QUALIFIED: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  CONTACTED_NOT_INTERESTED: "bg-stone-100 text-stone-700 ring-stone-200",
  CONTACTED_CALLBACK_REQUESTED: "bg-amber-50 text-amber-900 ring-amber-200",
  NOT_REACHABLE: "bg-orange-50 text-orange-900 ring-orange-200",
  WRONG_NUMBER: "bg-stone-100 text-stone-700 ring-stone-200",
  DO_NOT_CALL: "bg-red-50 text-red-900 ring-red-200",
  COUNSELLING_BOOKED: "bg-violet-50 text-violet-900 ring-violet-200",
  COUNSELLING_ATTENDED: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  COUNSELLING_NO_SHOW: "bg-amber-50 text-amber-900 ring-amber-200",
  CONVERTED: "bg-emerald-100 text-emerald-950 ring-emerald-300",
  LOST: "bg-stone-200 text-stone-800 ring-stone-300",
  EXPIRED_AUTO_PURGED: "bg-stone-200 text-stone-700 ring-stone-300",
};

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <span
      data-testid="lead-status-badge"
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        STATUS_CLASS[status] ?? "bg-stone-100 text-stone-800 ring-stone-200",
      )}
    >
      Status · {status}
    </span>
  );
}

const OUTCOME_CLASS: Record<string, string> = {
  WON: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  LOST: "bg-stone-100 text-stone-700 ring-stone-200",
  EXPIRED: "bg-stone-100 text-stone-600 ring-stone-200",
  MERGED: "bg-slate-100 text-slate-800 ring-slate-200",
};

export function LeadOutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) {
    return (
      <span data-testid="lead-outcome-badge" className="text-sm text-stone-500">
        Outcome · none
      </span>
    );
  }
  return (
    <span
      data-testid="lead-outcome-badge"
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        OUTCOME_CLASS[outcome] ?? "bg-stone-100 text-stone-800 ring-stone-200",
      )}
    >
      Outcome · {outcome}
    </span>
  );
}

export function LeadArchiveBadge({
  isArchived,
  archiveBlocked,
}: {
  isArchived: boolean;
  archiveBlocked: boolean;
}) {
  return (
    <span
      data-testid="lead-archive-badge"
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        isArchived
          ? "bg-stone-200 text-stone-800 ring-stone-300"
          : "bg-white text-stone-600 ring-stone-200",
      )}
    >
      Archive · {isArchived ? "archived" : archiveBlocked ? "unavailable (terminal)" : "active"}
    </span>
  );
}

const TIER_CLASS: Record<string, string> = {
  HOT: "bg-red-50 text-red-900 ring-red-200",
  WARM: "bg-amber-50 text-amber-900 ring-amber-200",
  COLD: "bg-sky-50 text-sky-900 ring-sky-200",
  ARCHIVED: "bg-stone-100 text-stone-600 ring-stone-200",
};

export function LeadTierBadge({ tier }: { tier: string }) {
  return (
    <span
      data-testid="lead-tier-badge"
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
        TIER_CLASS[tier] ?? TIER_CLASS.COLD,
      )}
    >
      Current Tier · {tier}
    </span>
  );
}
