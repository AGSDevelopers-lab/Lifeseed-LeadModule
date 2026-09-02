"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { undeferDonor } from "@/app/(portals)/admin/donors/actions";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from "@/components/ui/primitives";

export function UndeferForm({
  donorId,
  donorCode,
}: {
  donorId: string;
  donorCode: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await undeferDonor({ donorId, reason: reason.trim() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Donor un-deferred — status set to ELIGIBLE");
      router.push(`/admin/donors/${donorId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Un-defer failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Un-defer · {donorCode}</CardTitle>
        <CardDescription>
          Clears the deferral hold and returns the donor to ELIGIBLE. A reason
          is required for the audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <textarea
              id="reason"
              required
              minLength={3}
              className="min-h-24 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this donor being returned to eligibility?"
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
            <Button type="submit" disabled={loading || reason.trim().length < 3}>
              {loading ? "Saving…" : "Confirm un-defer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
