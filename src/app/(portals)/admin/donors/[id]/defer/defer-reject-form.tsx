"use client";

import { RejectionCode } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deferDonor, rejectDonor } from "@/app/(portals)/admin/donors/actions";
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
import {
  DEFERRABLE_CODES,
  REJECTION_CODE_LABEL,
} from "@/lib/donor-phase";

export function DeferRejectForm({
  mode,
  donorId,
}: {
  mode: "defer" | "reject";
  donorId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const codes =
    mode === "defer"
      ? DEFERRABLE_CODES
      : (Object.keys(REJECTION_CODE_LABEL) as RejectionCode[]);

  const [rejectionCode, setRejectionCode] = useState<RejectionCode>(codes[0]);
  const [notes, setNotes] = useState("");
  const [daysToReview, setDaysToReview] = useState(30);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result =
        mode === "defer"
          ? await deferDonor({
              donorId,
              rejectionCode,
              notes,
              daysToReview,
            })
          : await rejectDonor({ donorId, rejectionCode, notes });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "defer" ? "Donor deferred" : "Donor rejected");
      router.push(`/admin/donors/${donorId}?tab=p4`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>
          {mode === "defer" ? "Defer donor" : "Reject donor"}
        </CardTitle>
        <CardDescription>
          {mode === "defer"
            ? "Temporary hold with a review date. Deferrable reason codes only."
            : "Permanent rejection. Status becomes REJECTED and phase moves to P4."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label>Reason code</Label>
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              value={rejectionCode}
              onChange={(e) =>
                setRejectionCode(e.target.value as RejectionCode)
              }
            >
              {codes.map((code) => (
                <option key={code} value={code}>
                  {code} — {REJECTION_CODE_LABEL[code]}
                </option>
              ))}
            </select>
          </div>
          {mode === "defer" && (
            <div className="space-y-1.5">
              <Label htmlFor="days">Days to review</Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={365}
                value={daysToReview}
                onChange={(e) => setDaysToReview(Number(e.target.value))}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              className="min-h-24 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/donors/${donorId}`)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={mode === "reject" ? "destructive" : "default"}
              disabled={loading}
            >
              {loading
                ? "Saving…"
                : mode === "defer"
                  ? "Confirm deferral"
                  : "Confirm rejection"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
