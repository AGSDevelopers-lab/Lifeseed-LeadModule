"use client";

import { useEffect, useState } from "react";

type DirectoryRow = {
  userId: string;
  siteId: string | null;
  openLeadCount: number;
  languages: readonly string[];
  skills: readonly string[];
};

export function AssignmentCentreClient() {
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [cap, setCap] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [dirRes, workRes] = await Promise.all([
        fetch("/api/leads/v2/assignment/directory"),
        fetch("/api/leads/v2/assignment/workload"),
      ]);
      const dirJson = (await dirRes.json()) as {
        items?: DirectoryRow[];
        error?: { message?: string };
      };
      const workJson = (await workRes.json()) as {
        maxQueuePerTelecaller?: number;
        error?: { message?: string };
      };
      if (cancelled) return;
      if (!dirRes.ok) {
        setError(dirJson.error?.message ?? "Failed to load directory");
        return;
      }
      if (!workRes.ok) {
        setError(workJson.error?.message ?? "Failed to load workload");
        return;
      }
      setRows(dirJson.items ?? []);
      setCap(workJson.maxQueuePerTelecaller ?? null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <p className="text-sm text-stone-600">
        Capacity ceiling: {cap ?? "—"} open leads. Matching uses site, active
        eligibility, and capacity only. Shift, skill, and language matching are
        deferred to IAM Module 12.
      </p>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-stone-500">
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Site</th>
              <th className="px-4 py-2 font-medium">Active eligibility</th>
              <th className="px-4 py-2 font-medium">Open leads</th>
              <th className="px-4 py-2 font-medium">Capacity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const atCap = cap != null && row.openLeadCount >= cap;
              return (
                <tr key={row.userId} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{row.userId}</td>
                  <td className="px-4 py-2">{row.siteId ?? "unscoped"}</td>
                  <td className="px-4 py-2">Active telecaller</td>
                  <td className="px-4 py-2">{row.openLeadCount}</td>
                  <td className="px-4 py-2">{atCap ? "At cap" : "Under cap"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && !error ? (
              <tr>
                <td className="px-4 py-6 text-stone-500" colSpan={5}>
                  No eligible telecallers.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
