"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/primitives";
import type { TimelineEntry, TimelinePage } from "@/lib/leads/application/lead-timeline-cursor";

export function Lead360AsyncPanels({ leadId }: { leadId: string }) {
  const [timeline, setTimeline] = useState<TimelinePage | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<unknown>(null);
  const [attrError, setAttrError] = useState<string | null>(null);
  const [crm, setCrm] = useState<unknown>(null);
  const [crmError, setCrmError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [t, a, c] = await Promise.allSettled([
        fetch(`/api/leads/v2/leads/${leadId}/timeline`).then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error?.message ?? r.statusText);
          return j as TimelinePage;
        }),
        fetch(`/api/leads/v2/leads/${leadId}/attribution`).then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error?.message ?? r.statusText);
          return j;
        }),
        fetch(`/api/leads/v2/leads/${leadId}/crm-status`).then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error?.message ?? r.statusText);
          return j;
        }),
      ]);
      if (cancelled) return;
      if (t.status === "fulfilled") setTimeline(t.value);
      else setTimelineError(t.reason instanceof Error ? t.reason.message : "Failed");
      if (a.status === "fulfilled") setAttribution(a.value);
      else setAttrError(a.reason instanceof Error ? a.reason.message : "Failed");
      if (c.status === "fulfilled") setCrm(c.value);
      else setCrmError(c.reason instanceof Error ? c.reason.message : "Failed");
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  async function more() {
    if (!timeline?.nextCursor) return;
    const r = await fetch(
      `/api/leads/v2/leads/${leadId}/timeline?cursor=${encodeURIComponent(timeline.nextCursor)}`,
    );
    const j = (await r.json()) as TimelinePage & { error?: { message?: string } };
    if (!r.ok) {
      setTimelineError(j.error?.message ?? "Failed");
      return;
    }
    setTimeline({
      items: [...(timeline.items as TimelineEntry[]), ...j.items],
      nextCursor: j.nextCursor,
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-base font-semibold">Timeline</h2>
        {loading && !timeline && <p data-testid="lead360-timeline-loading">Loading…</p>}
        {timelineError && (
          <p data-testid="lead360-timeline-error" className="text-sm text-red-700">
            {timelineError}
          </p>
        )}
        {timeline && timeline.items.length === 0 && (
          <p data-testid="lead360-timeline-empty" className="text-sm text-stone-500">
            No timeline entries
          </p>
        )}
        {timeline && timeline.items.length > 0 && (
          <ol className="mt-2 space-y-2 text-sm">
            {timeline.items.map((e) => (
              <li key={`${e.sourceType}:${e.id}`}>
                <p className="font-medium">{e.summary}</p>
                <p className="text-xs text-stone-500">
                  {e.occurredAt} · {e.sourceType} · {e.actorName ?? "system"}
                </p>
              </li>
            ))}
          </ol>
        )}
        {timeline?.nextCursor && (
          <Button className="mt-2" variant="outline" onClick={() => void more()}>
            Load more
          </Button>
        )}
      </section>
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-base font-semibold">Attribution</h2>
        {loading && !attribution && <p>Loading…</p>}
        {attrError && (
          <p data-testid="lead360-attr-error" className="text-sm text-red-700">
            {attrError}
          </p>
        )}
        {attribution ? <AttributionView data={attribution} /> : null}
      </section>
      <section className="rounded-lg border border-stone-200 bg-white p-4 md:col-span-2">
        <h2 className="text-base font-semibold">CRM status</h2>
        {loading && !crm && <p>Loading…</p>}
        {crmError && (
          <p data-testid="lead360-crm-error" className="text-sm text-red-700">
            {crmError}
          </p>
        )}
        {crm ? <CrmView data={crm} /> : null}
      </section>
    </div>
  );
}

function AttributionView({ data }: { data: unknown }) {
  const rec = data as {
    firstTouch: Record<string, string | null> | null;
    lastTouch: Record<string, string | null> | null;
  };
  if (!rec.firstTouch && !rec.lastTouch) {
    return (
      <p data-testid="lead360-attr-empty" className="text-sm text-stone-500">
        No attribution captured
      </p>
    );
  }
  return (
    <div className="grid gap-3 text-sm md:grid-cols-2">
      <Touch label="First touch" rec={rec.firstTouch} />
      <Touch label="Last touch" rec={rec.lastTouch} />
    </div>
  );
}

function Touch({
  label,
  rec,
}: {
  label: string;
  rec: Record<string, string | null> | null;
}) {
  if (!rec) return <p className="text-stone-500">{label}: none</p>;
  return (
    <div>
      <p className="font-medium">{label}</p>
      <p>Source: {rec.source}</p>
      <p>Medium: {rec.medium ?? "—"}</p>
      <p>Campaign: {rec.campaignCode ?? "—"}</p>
      <p>Landing: {rec.landingPage ?? "—"}</p>
      <p>Captured: {rec.capturedAt}</p>
    </div>
  );
}

function CrmView({ data }: { data: unknown }) {
  const rec = data as { syncs: Array<{ target: string; status: string; lastError: string | null; attempts: number }> };
  if (!rec.syncs?.length) {
    return (
      <p data-testid="lead360-crm-empty" className="text-sm text-stone-500">
        No CRM syncs
      </p>
    );
  }
  return (
    <ul className="text-sm">
      {rec.syncs.map((s) => (
        <li key={s.target}>
          {s.target}: {s.status} · attempts {s.attempts}
          {s.lastError ? ` · ${s.lastError}` : ""}
        </li>
      ))}
    </ul>
  );
}
