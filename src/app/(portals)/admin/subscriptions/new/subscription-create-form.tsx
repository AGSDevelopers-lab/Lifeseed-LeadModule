"use client";

import {
  BillingFrequency,
  SubscriptionType,
} from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { createSubscription } from "@/app/(portals)/admin/invoices/actions";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui/primitives";

type Clinic = { id: string; clinicCode: string; name: string; siteId: string };
type Recipient = {
  id: string;
  recipientCode: string;
  fullName: string;
  clinicId: string;
};
type Site = { id: string; code: string };

export function SubscriptionCreateForm({
  clinics,
  recipients,
  sites,
}: {
  clinics: Clinic[];
  recipients: Recipient[];
  sites: Site[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [subscriberType, setSubscriberType] = useState<"CLINIC" | "RECIPIENT">(
    "CLINIC",
  );
  const [subscriberId, setSubscriberId] = useState(clinics[0]?.id ?? "");
  const [siteId, setSiteId] = useState(
    clinics[0]?.siteId ?? sites[0]?.id ?? "",
  );
  const [type, setType] = useState<SubscriptionType>(
    SubscriptionType.STORAGE_MONTHLY,
  );
  const [frequency, setFrequency] = useState<BillingFrequency>(
    BillingFrequency.MONTHLY,
  );
  const [startedAt, setStartedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [unitAmount, setUnitAmount] = useState("200");
  const [qty, setQty] = useState("1");

  const gstPreview = useMemo(() => {
    const base = Number(unitAmount || 0) * Number(qty || 1);
    const gst = (base * 18) / 100;
    return { base, gst, total: base + gst };
  }, [unitAmount, qty]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await createSubscription({
        subscriberType,
        subscriberId,
        siteId,
        type,
        frequency,
        startedAt,
        unitAmount: Number(unitAmount),
        quantity: Number(qty) || 1,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Subscription created");
      router.push(`/admin/subscriptions/${r.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>New subscription</CardTitle>
        <CardDescription>
          GST auto-estimated at 18% (IGST/CGST+SGST resolved at invoice time).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Customer type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
                value={subscriberType}
                onChange={(e) => {
                  const t = e.target.value as "CLINIC" | "RECIPIENT";
                  setSubscriberType(t);
                  if (t === "CLINIC") {
                    setSubscriberId(clinics[0]?.id ?? "");
                    setSiteId(clinics[0]?.siteId ?? siteId);
                  } else {
                    setSubscriberId(recipients[0]?.id ?? "");
                  }
                }}
              >
                <option value="CLINIC">Clinic</option>
                <option value="RECIPIENT">Recipient</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <select
                className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
                value={subscriberId}
                onChange={(e) => {
                  setSubscriberId(e.target.value);
                  if (subscriberType === "CLINIC") {
                    const c = clinics.find((x) => x.id === e.target.value);
                    if (c) setSiteId(c.siteId);
                  }
                }}
              >
                {subscriberType === "CLINIC"
                  ? clinics.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.clinicCode} — {c.name}
                      </option>
                    ))
                  : recipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.recipientCode} — {r.fullName}
                      </option>
                    ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Billing site (GSTIN)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as SubscriptionType)}
              >
                {Object.values(SubscriptionType).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Billing cycle</Label>
              <select
                className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as BillingFrequency)
                }
              >
                {Object.values(BillingFrequency).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input
                type="date"
                value={startedAt}
                onChange={(e) => setStartedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit amount</Label>
              <Input
                type="number"
                value={unitAmount}
                onChange={(e) => setUnitAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Qty</Label>
              <Input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-md bg-stone-50 px-3 py-2 text-sm">
            Taxable ₹{gstPreview.base.toFixed(2)} + GST ₹
            {gstPreview.gst.toFixed(2)} ={" "}
            <strong>₹{gstPreview.total.toFixed(2)}</strong>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/admin/subscriptions")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !subscriberId}>
              {loading ? "Creating…" : "Create subscription"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
