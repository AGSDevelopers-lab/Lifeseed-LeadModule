"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";

import { toast } from "sonner";

import { TooltipLabel } from "@/components/reports/kpi-card";
import { Button, Input, Label } from "@/components/ui/primitives";
import type { ColumnDefinition, FilterDefinition } from "@/lib/reports/types";

type Props = {
  reportId: string;
  category: string;
  name: string;
  description: string;
  emptyStateHint: string;
  filters: FilterDefinition[];
  columns: ColumnDefinition[];
  exportFormats: string[];
  initialFilters?: Record<string, string>;
};

type RunResponse = {
  rows: Record<string, unknown>[];
  rowCount: number;
  generatedAtIst: string;
  columns: ColumnDefinition[];
};

function shiftPeriod(
  filters: Record<string, string>,
): Record<string, string> {
  const from = filters.fromDate ? new Date(filters.fromDate) : null;
  const to = filters.toDate ? new Date(filters.toDate) : null;
  if (!from || !to) return filters;
  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  return {
    ...filters,
    fromDate: prevFrom.toISOString().slice(0, 10),
    toDate: prevTo.toISOString().slice(0, 10),
  };
}

export function ReportDetailClient(props: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { ...(props.initialFilters ?? {}) };
    for (const f of props.filters) {
      if (init[f.key] === undefined && f.defaultValue !== undefined) {
        init[f.key] = String(f.defaultValue);
      }
    }
    return init;
  });
  const [data, setData] = useState<RunResponse | null>(null);
  const [prior, setPrior] = useState<RunResponse | null>(null);
  const [compare, setCompare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [favoritePending, setFavoritePending] = useState(false);
  const pageSize = 25;

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: props.reportId, filters }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Run failed (${res.status})`);
      }
      const json = (await res.json()) as RunResponse;
      setData(json);

      if (compare) {
        const priorRes = await fetch("/api/reports/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId: props.reportId,
            filters: shiftPeriod(filters),
          }),
        });
        if (priorRes.ok) {
          setPrior((await priorRes.json()) as RunResponse);
        }
      } else {
        setPrior(null);
      }

      const params = new URLSearchParams(filters);
      router.replace(
        `/admin/reports/${props.category}/${props.reportId}?${params.toString()}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run report");
    } finally {
      setLoading(false);
    }
  }, [compare, filters, props.category, props.reportId, router]);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/reports/favorites?reportId=${encodeURIComponent(props.reportId)}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { favorites?: Array<{ id: string }> };
        if (!cancelled) {
          setFavoriteId(json.favorites?.[0]?.id ?? null);
        }
      } catch (e) {
        console.error("[reports] favorite GET failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.reportId]);

  async function exportFmt(format: string) {
    const res = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: props.reportId, filters, format }),
    });
    if (!res.ok) {
      setError("Export failed");
      return;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = (await res.json()) as { signedUrl?: string };
      if (j.signedUrl) {
        window.open(j.signedUrl, "_blank");
        return;
      }
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.reportId}.${format.toLowerCase()}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggleFavorite() {
    if (favoritePending) return;
    const previousId = favoriteId;
    const nextFavorited = previousId === null;
    setFavoritePending(true);
    setFavoriteId(nextFavorited ? "optimistic" : null);
    console.log("[reports] favorite toggle", {
      reportId: props.reportId,
      action: nextFavorited ? "POST" : "DELETE",
      favoriteId: previousId,
    });
    try {
      if (nextFavorited) {
        const res = await fetch("/api/reports/favorites", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId: props.reportId,
            displayName: props.name,
            savedFilters: filters,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          favorite?: { id: string };
          error?: unknown;
        };
        console.log("[reports] favorite POST", res.status, json);
        if (!res.ok || !json.favorite?.id) {
          throw new Error("save failed");
        }
        setFavoriteId(json.favorite.id);
        toast.success("Saved to favorites");
      } else if (previousId && previousId !== "optimistic") {
        const res = await fetch(`/api/reports/favorites/${previousId}`, {
          method: "DELETE",
          credentials: "include",
        });
        console.log("[reports] favorite DELETE", res.status, previousId);
        if (!res.ok) throw new Error("delete failed");
        setFavoriteId(null);
        toast.success("Removed from favorites");
      }
    } catch (e) {
      console.error("[reports] favorite toggle failed", e);
      setFavoriteId(previousId);
      toast.error("Could not save — please retry");
    } finally {
      setFavoritePending(false);
    }
  }

  const sortedRows = useMemo(() => {
    const rows = [...(data?.rows ?? [])];
    if (!sortKey) return rows;
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [data, sortDir, sortKey]);

  const pageRows = sortedRows.slice(page * pageSize, (page + 1) * pageSize);
  const visibleCols = props.columns.filter((c) => c.key !== "donorId" && c.key !== "invoiceId");

  function onKeyNav(e: React.KeyboardEvent<HTMLTableElement>) {
    const rows = e.currentTarget.querySelectorAll<HTMLElement>("tbody tr[data-href]");
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? Array.from(rows).indexOf(active) : -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      rows[Math.min(rows.length - 1, idx + 1)]?.focus();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      rows[Math.max(0, idx - 1)]?.focus();
    }
    if (e.key === "Enter" && active?.dataset.href) {
      router.push(active.dataset.href);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-stone-500">
            <Link href={`/admin/reports/${props.category}`} className="hover:underline">
              {props.category}
            </Link>{" "}
            / {props.name}
          </div>
          <h1 className="text-2xl font-semibold text-stone-900">{props.name}</h1>
          <p className="mt-1 max-w-3xl text-sm text-stone-600">{props.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void toggleFavorite()}
            disabled={favoritePending}
            aria-label={favoriteId ? "Remove from favorites" : "Save favorite"}
            aria-pressed={Boolean(favoriteId)}
          >
            <Star
              className={
                favoriteId
                  ? "h-4 w-4 fill-amber-400 text-amber-500"
                  : "h-4 w-4"
              }
            />
            Favorite
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              window.open(
                `/admin/reports/${props.category}/${props.reportId}/print?${new URLSearchParams(filters)}`,
                "_blank",
              )
            }
          >
            Print
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = `/admin/reports/schedules?reportId=${encodeURIComponent(props.reportId)}`;
            }}
          >
            Schedule
          </Button>
        </div>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-800">Filters</h2>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
            />
            Compare with previous period
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {props.filters.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={f.key}>
                <TooltipLabel label={f.label} hint={f.description} />
              </Label>
              {f.widget === "single-select" && f.options ? (
                <select
                  id={f.key}
                  aria-label={f.label}
                  className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
                  value={filters[f.key] ?? ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                >
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={f.key}
                  aria-label={f.label}
                  type={f.key.toLowerCase().includes("date") ? "date" : "text"}
                  value={filters[f.key] ?? ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => void run()} disabled={loading}>
            {loading ? "Running…" : "Apply"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFilters({});
              setPage(0);
            }}
          >
            Reset
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-stone-600">Export:</span>
        {props.exportFormats.map((fmt) => (
          <Button key={fmt} variant="outline" onClick={() => void exportFmt(fmt)}>
            {fmt}
          </Button>
        ))}
        {data ? (
          <span className="ml-auto text-sm text-stone-500">
            Rows: {data.rowCount} · Generated: {data.generatedAtIst}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="rounded-md border border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-500">
          Loading report…
        </div>
      ) : null}

      {!loading && data && data.rowCount === 0 ? (
        <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-10 text-center text-sm text-stone-600">
          {props.emptyStateHint}
        </div>
      ) : null}

      {data && data.rowCount > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table
            className="min-w-full text-left text-sm"
            onKeyDown={onKeyNav}
            aria-label={props.name}
          >
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                {visibleCols.map((c) => (
                  <th key={c.key} className="px-3 py-2 font-medium">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                      onClick={() => {
                        if (!c.sortable) return;
                        if (sortKey === c.key) {
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        } else {
                          setSortKey(c.key);
                          setSortDir("asc");
                        }
                      }}
                    >
                      <TooltipLabel label={c.label} hint={c.description} />
                      {sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : null}
                    </button>
                    {compare && c.numeric ? (
                      <span className="ml-2 text-[10px] normal-case text-stone-400">
                        vs prior
                      </span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => {
                const href =
                  typeof row.donorId === "string"
                    ? `/admin/donors/${row.donorId}`
                    : typeof row.invoiceId === "string"
                      ? `/admin/invoices/${row.invoiceId}`
                      : undefined;
                return (
                  <tr
                    key={i}
                    tabIndex={0}
                    data-href={href}
                    className="border-t border-stone-100 hover:bg-emerald-50/40 focus:bg-emerald-50 outline-none"
                    onClick={() => href && router.push(href)}
                  >
                    {visibleCols.map((c) => {
                      const v = row[c.key];
                      let display =
                        v === null || v === undefined || v === ""
                          ? "—"
                          : String(v);
                      let delta: string | null = null;
                      if (compare && prior && c.numeric) {
                        const priorRow = prior.rows[i];
                        const pv = priorRow?.[c.key];
                        if (typeof v === "number" && typeof pv === "number" && pv !== 0) {
                          const pct = Math.round(((v - pv) / Math.abs(pv)) * 1000) / 10;
                          const good =
                            c.higherIsBetter === false ? pct <= 0 : pct >= 0;
                          delta = `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}%`;
                          display = `${display} `;
                          return (
                            <td key={c.key} className="px-3 py-2 tabular-nums">
                              {display}
                              <span
                                className={
                                  good ? "text-emerald-700" : "text-red-600"
                                }
                              >
                                {delta}
                              </span>
                            </td>
                          );
                        }
                      }
                      return (
                        <td key={c.key} className="px-3 py-2">
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-stone-100 px-3 py-2 text-sm">
            <Button
              variant="ghost"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span className="text-stone-500">
              Page {page + 1} of {Math.max(1, Math.ceil(sortedRows.length / pageSize))}
            </span>
            <Button
              variant="ghost"
              disabled={(page + 1) * pageSize >= sortedRows.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
