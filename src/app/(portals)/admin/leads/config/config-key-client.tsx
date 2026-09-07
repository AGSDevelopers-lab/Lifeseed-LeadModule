"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  approveLeadConfig,
  proposeLeadConfig,
} from "@/app/(portals)/admin/leads/config/actions";
import { Button } from "@/components/ui/primitives";

type HistoryRow = {
  id: string;
  version: number;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  notes: string | null;
  payload: Record<string, unknown>;
};

function PayloadView({ value, path = "" }: { value: unknown; path?: string }) {
  if (value === null || value === undefined) {
    return <span className="text-stone-400">—</span>;
  }
  if (typeof value !== "object") {
    return <span>{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc pl-5 text-sm">
        {value.map((item, i) => (
          <li key={`${path}.${i}`}>
            <PayloadView value={item} path={`${path}.${i}`} />
          </li>
        ))}
      </ul>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    <dl className="grid grid-cols-[minmax(8rem,14rem)_1fr] gap-x-3 gap-y-1 text-sm">
      {entries.map(([k, v]) => (
        <div key={`${path}.${k}`} className="contents">
          <dt className="text-stone-500">{k}</dt>
          <dd>
            <PayloadView value={v} path={`${path}.${k}`} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function LeadConfigKeyClient(props: {
  configKey: string;
  actorUserId: string;
  canPropose: boolean;
  canApprove: boolean;
  current: {
    version: number;
    payload: Record<string, unknown>;
    effectiveFrom: string | null;
    effectiveUntil: string | null;
    approvedByUserId: string | null;
    approvedAt: string | null;
    createdByUserId: string;
    notes: string | null;
  } | null;
  history: HistoryRow[];
  pendingCount: number;
}) {
  const router = useRouter();
  const [payloadJson, setPayloadJson] = useState(
    () => JSON.stringify(props.current?.payload ?? {}, null, 2),
  );
  const [notes, setNotes] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [pending, setPending] = useState(false);

  async function onPropose() {
    setPending(true);
    const res = await proposeLeadConfig({
      key: props.configKey,
      payloadJson,
      notes,
      effectiveFrom: effectiveFrom || undefined,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Proposed version ${res.version}`);
    router.refresh();
  }

  async function onApprove(version: number) {
    setPending(true);
    const res = await approveLeadConfig({ key: props.configKey, version });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Approved version ${res.version}`);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Current version</h2>
        {props.current ? (
          <>
            <p className="mb-3 text-sm text-stone-600">
              v{props.current.version}
              {props.current.effectiveFrom
                ? ` · effective from ${props.current.effectiveFrom}`
                : " · effective immediately"}
              {props.current.approvedAt ? ` · approved ${props.current.approvedAt}` : ""}
            </p>
            <PayloadView value={props.current.payload} />
          </>
        ) : (
          <p className="text-sm text-stone-500">No active version. Run the seed script.</p>
        )}
      </section>

      {props.canPropose && (
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="mb-3 font-medium">Propose new version</h2>
          <textarea
            className="mb-3 h-56 w-full rounded-md border border-stone-300 p-2 font-mono text-xs"
            value={payloadJson}
            onChange={(e) => setPayloadJson(e.target.value)}
          />
          <input
            className="mb-3 w-full rounded-md border border-stone-300 p-2 text-sm"
            placeholder="Change notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <label className="mb-3 block text-sm text-stone-600">
            Effective from (optional)
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-stone-300 p-2"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </label>
          <Button disabled={pending} onClick={() => void onPropose()}>
            Propose
          </Button>
        </section>
      )}

      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Version history</h2>
        <ol className="space-y-3">
          {props.history.map((row) => {
            const isProposer = row.createdByUserId === props.actorUserId;
            const canApproveThis =
              props.canApprove && !row.approvedAt && !isProposer;
            return (
              <li key={row.id} className="border-b border-stone-100 pb-3 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium">v{row.version}</span>
                    {row.isActive ? " · active" : ""}
                    {!row.approvedAt ? " · pending approval" : " · approved"}
                    <p className="text-xs text-stone-500">
                      Author {row.createdByUserId} at {row.createdAt}
                      {row.approvedByUserId
                        ? ` · approver ${row.approvedByUserId} at ${row.approvedAt}`
                        : ""}
                    </p>
                    {row.effectiveFrom && (
                      <p className="text-xs text-stone-500">Effective {row.effectiveFrom}</p>
                    )}
                    {row.notes && <p className="text-xs">{row.notes}</p>}
                  </div>
                  <Button
                    disabled={pending || !canApproveThis}
                    onClick={() => void onApprove(row.version)}
                    title={isProposer ? "You cannot approve your own version" : undefined}
                  >
                    Approve
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
