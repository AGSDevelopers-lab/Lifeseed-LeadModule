"use client";

import { useEffect, useState } from "react";

type TemplateRow = {
  id: string;
  key: string;
  channel: string;
  version: number;
  isActive: boolean;
  approvedAt: string | null;
  body: string;
};

export function NotificationTemplatesClient() {
  const [items, setItems] = useState<TemplateRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/leads/v2/notifications/templates");
    const json = (await res.json()) as { items?: TemplateRow[]; error?: { message?: string } };
    if (!res.ok) {
      setError(json.error?.message ?? "Failed to load");
      return;
    }
    setItems(json.items ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function propose() {
    setError(null);
    const res = await fetch("/api/leads/v2/notifications/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: "lead.intake.welcome",
        channel: "EMAIL",
        provider: "RESEND",
        body: "{{body}}",
        variables: ["body"],
        language: "ENGLISH",
      }),
    });
    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) setError(json.error?.message ?? "Propose failed");
    await refresh();
  }

  async function approve(id: string) {
    setError(null);
    const res = await fetch(`/api/leads/v2/notifications/templates/${id}/approve`, {
      method: "POST",
    });
    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) setError(json.error?.message ?? "Approve failed");
    await refresh();
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="button"
        className="rounded border border-stone-300 px-3 py-1 text-sm"
        onClick={() => void propose()}
      >
        Propose structural version
      </button>
      <ul className="divide-y rounded-xl border border-stone-200 bg-white">
        {items.map((row) => (
          <li key={row.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <p className="font-medium">
                {row.key} · {row.channel} · v{row.version}
              </p>
              <p className="text-xs text-stone-500">
                {row.isActive ? "active" : "inactive"} · {row.body}
              </p>
            </div>
            {!row.isActive ? (
              <button
                type="button"
                className="text-emerald-900 hover:underline"
                onClick={() => void approve(row.id)}
              >
                Approve
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
