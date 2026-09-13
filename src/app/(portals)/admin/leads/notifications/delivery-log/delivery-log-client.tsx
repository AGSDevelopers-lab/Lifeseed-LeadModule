"use client";

import { useEffect, useState } from "react";

type LogRow = {
  id: string;
  channel: string;
  deliveryStatus: string;
  recipient: string;
  providerMessageId: string | null;
  sentAt: string;
  dncPassed: boolean;
};

export function DeliveryLogClient() {
  const [items, setItems] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/leads/v2/notifications/delivery-log");
      const json = (await res.json()) as { items?: LogRow[]; error?: { message?: string } };
      if (!res.ok) {
        setError(json.error?.message ?? "Failed to load");
        return;
      }
      setItems(json.items ?? []);
    })();
  }, []);

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ul className="divide-y rounded-xl border border-stone-200 bg-white">
        {items.map((row) => (
          <li key={row.id} className="px-4 py-3 text-sm">
            <p className="font-medium">
              {row.channel} · {row.deliveryStatus}
            </p>
            <p className="text-xs text-stone-500">
              {row.recipient} · dncPassed={String(row.dncPassed)} · {row.providerMessageId ?? "no provider id"}
            </p>
          </li>
        ))}
        {items.length === 0 && !error ? (
          <li className="px-4 py-3 text-sm text-stone-500">No delivery log rows.</li>
        ) : null}
      </ul>
    </div>
  );
}
