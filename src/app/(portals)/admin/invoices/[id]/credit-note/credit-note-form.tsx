"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { issueCreditNote } from "@/app/(portals)/admin/invoices/actions";
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

const REASONS = [
  { value: "RETURN", label: "Return" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "REFUND", label: "Refund" },
  { value: "WRITE_OFF", label: "Write-off" },
] as const;

export function CreditNoteForm({
  invoiceId,
  maxAmount,
}: {
  invoiceId: string;
  maxAmount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reasonCode, setReasonCode] =
    useState<(typeof REASONS)[number]["value"]>("ADJUSTMENT");
  const [amount, setAmount] = useState(String(maxAmount));
  const [note, setNote] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await issueCreditNote({
        invoiceId,
        reasonCode,
        amount: Number(amount),
        reasonNote: note || undefined,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Credit note issued");
      router.push(`/admin/invoices/${invoiceId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Issue credit note</CardTitle>
        <CardDescription>
          Amount must be ≤ ₹{maxAmount.toFixed(2)} (paid / outstanding cap).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 px-2 text-sm"
              value={reasonCode}
              onChange={(e) =>
                setReasonCode(
                  e.target.value as (typeof REASONS)[number]["value"],
                )
              }
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              className="min-h-[72px] w-full rounded-md border border-stone-300 p-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/invoices/${invoiceId}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Issuing…" : "Issue credit note"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
