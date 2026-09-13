"use client";

import { useCallback, useEffect, useState } from "react";

type CaseRow = {
  id: string;
  leftLeadId: string;
  rightLeadId: string;
  matchLevel: string;
  matchScore: number;
  reviewStatus: string;
  matchSignals: Record<string, unknown>;
};

type LeadSide = {
  id: string;
  leadCode: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  personType: string;
  source: string;
  city: string | null;
  convertedDonorId: string | null;
  convertedRecipientId: string | null;
};

type Detail = {
  case: CaseRow;
  left: LeadSide | null;
  right: LeadSide | null;
};

function SideCard({ title, lead }: { title: string; lead: LeadSide | null }) {
  if (!lead) return <div className="rounded-xl border border-stone-200 bg-white p-4">Missing lead</div>;
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-1 text-sm">
      <h2 className="font-semibold">{title}</h2>
      <p className="font-mono text-xs">{lead.leadCode}</p>
      <p>{lead.fullName}</p>
      <p>{lead.phone}</p>
      <p>{lead.email}</p>
      <p>
        {lead.personType} · {lead.status} · {lead.source}
      </p>
      <p>{lead.city}</p>
      {lead.convertedDonorId || lead.convertedRecipientId ? (
        <p className="text-amber-800">Converted — cannot be merge loser</p>
      ) : null}
    </div>
  );
}

export function DuplicateReviewClient() {
  const [items, setItems] = useState<CaseRow[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("duplicate confirmed");
  const [strategy, setStrategy] = useState("COPY_MEANINGFUL");
  const [winnerLeadId, setWinnerLeadId] = useState("");

  const loadList = useCallback(async () => {
    const res = await fetch("/api/leads/v2/duplicates?reviewStatus=OPEN");
    const json = (await res.json()) as { items?: CaseRow[]; error?: { message?: string } };
    if (!res.ok) {
      setError(json.error?.message ?? "Failed to load duplicates");
      return;
    }
    setItems(json.items ?? []);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function openCase(id: string) {
    const res = await fetch(`/api/leads/v2/duplicates/${id}`);
    const json = (await res.json()) as Detail & { error?: { message?: string } };
    if (!res.ok) {
      setError(json.error?.message ?? "Failed to load pair");
      return;
    }
    setDetail(json);
    setWinnerLeadId(json.left?.id ?? "");
  }

  async function postAction(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) {
      setError(json.error?.message ?? "Action failed");
      return;
    }
    setDetail(null);
    await loadList();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="rounded-xl border border-stone-200 bg-white">
        {error ? <p className="p-3 text-sm text-red-700">{error}</p> : null}
        <ul className="divide-y text-sm">
          {items.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-stone-50"
                onClick={() => void openCase(row.id)}
              >
                <span className="font-medium">{row.matchLevel}</span>
                <span className="ml-2 text-stone-500">score {row.matchScore}</span>
                <div className="font-mono text-xs text-stone-500">{row.id}</div>
              </button>
            </li>
          ))}
          {items.length === 0 ? (
            <li className="px-3 py-4 text-stone-500">No open duplicate cases</li>
          ) : null}
        </ul>
      </div>
      <div className="space-y-4">
        {detail ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <SideCard title="Left" lead={detail.left} />
              <SideCard title="Right" lead={detail.right} />
            </div>
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4">
              <label className="text-sm">
                Winner
                <select
                  className="ml-2 rounded border px-2 py-1"
                  value={winnerLeadId}
                  onChange={(e) => setWinnerLeadId(e.target.value)}
                >
                  {detail.left ? <option value={detail.left.id}>{detail.left.leadCode}</option> : null}
                  {detail.right ? <option value={detail.right.id}>{detail.right.leadCode}</option> : null}
                </select>
              </label>
              <label className="text-sm">
                Strategy
                <select
                  className="ml-2 rounded border px-2 py-1"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                >
                  <option value="COPY_ALL">COPY_ALL</option>
                  <option value="COPY_MEANINGFUL">COPY_MEANINGFUL</option>
                  <option value="REFERENCE_ONLY">REFERENCE_ONLY</option>
                </select>
              </label>
              <label className="text-sm grow">
                Reason
                <input
                  className="ml-2 w-56 rounded border px-2 py-1"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="rounded bg-emerald-800 px-3 py-1.5 text-sm text-white"
                onClick={() =>
                  void postAction(`/api/leads/v2/duplicates/${detail.case.id}/merge`, {
                    winnerLeadId,
                    reason,
                    strategy,
                  })
                }
              >
                Merge
              </button>
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-sm"
                onClick={() =>
                  void postAction(`/api/leads/v2/duplicates/${detail.case.id}/keep-separate`, {
                    notes: reason,
                  })
                }
              >
                Keep separate
              </button>
              <button
                type="button"
                className="rounded border px-3 py-1.5 text-sm"
                onClick={() =>
                  void postAction(`/api/leads/v2/duplicates/${detail.case.id}/dismiss`, {
                    notes: reason,
                  })
                }
              >
                Dismiss
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-stone-500">Select a case to compare side by side.</p>
        )}
      </div>
    </div>
  );
}
