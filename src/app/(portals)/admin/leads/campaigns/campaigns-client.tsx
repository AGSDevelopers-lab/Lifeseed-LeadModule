"use client";

import { useEffect, useState } from "react";

type CampaignRow = {
  id: string;
  name: string;
  code: string;
  source: string;
  status: string;
  startAt: string;
  actualSpendInr: string | null;
};

export function CampaignsManagerClient() {
  const [items, setItems] = useState<CampaignRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("WB Oct Instagram");
  const [code, setCode] = useState("WB_OCT26_INSTA");
  const [source, setSource] = useState("SOCIAL_INSTAGRAM");
  const [spend, setSpend] = useState("0");

  async function refresh() {
    const res = await fetch("/api/leads/v2/campaigns");
    const json = (await res.json()) as { items?: CampaignRow[]; error?: { message?: string } };
    if (!res.ok) {
      setError(json.error?.message ?? "Failed to load campaigns");
      return;
    }
    setItems(json.items ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function create() {
    setError(null);
    const res = await fetch("/api/leads/v2/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        code,
        source,
        startAt: new Date().toISOString(),
        actualSpendInr: spend,
      }),
    });
    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) setError(json.error?.message ?? "Create failed");
    await refresh();
  }

  async function act(id: string, path: string, method = "POST", body?: unknown) {
    setError(null);
    const res = await fetch(`/api/leads/v2/campaigns/${id}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) setError(json.error?.message ?? "Action failed");
    await refresh();
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <form
        className="grid gap-2 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <input
          className="h-10 rounded-md border border-stone-300 px-3 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          aria-label="Campaign name"
        />
        <input
          className="h-10 rounded-md border border-stone-300 px-3 text-sm"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code"
          aria-label="Campaign code"
        />
        <input
          className="h-10 rounded-md border border-stone-300 px-3 text-sm"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Source"
          aria-label="Campaign source"
        />
        <input
          className="h-10 rounded-md border border-stone-300 px-3 text-sm"
          value={spend}
          onChange={(e) => setSpend(e.target.value)}
          placeholder="Actual spend INR"
          aria-label="Actual spend INR"
        />
        <button type="submit" className="h-10 rounded-md bg-emerald-800 px-3 text-sm text-white">
          Create campaign
        </button>
      </form>
      <ul className="divide-y rounded-xl border border-stone-200 bg-white">
        {items.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">
                {row.name} · {row.code}
              </p>
              <p className="text-xs text-stone-500">
                {row.status} · {row.source} · spend {row.actualSpendInr ?? "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {row.status === "DRAFT" || row.status === "PAUSED" ? (
                <button
                  type="button"
                  className="rounded border border-stone-300 px-2 py-1"
                  onClick={() => void act(row.id, "/activate")}
                >
                  Activate
                </button>
              ) : null}
              {row.status === "ACTIVE" ? (
                <button
                  type="button"
                  className="rounded border border-stone-300 px-2 py-1"
                  onClick={() => void act(row.id, "", "PATCH", { status: "PAUSED" })}
                >
                  Pause
                </button>
              ) : null}
              {row.status === "ACTIVE" ? (
                <button
                  type="button"
                  className="rounded border border-stone-300 px-2 py-1"
                  onClick={() => void act(row.id, "/end")}
                >
                  End
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
