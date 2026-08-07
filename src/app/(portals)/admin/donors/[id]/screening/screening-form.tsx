"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { submitSerologyScreening } from "@/app/(portals)/admin/donors/actions";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from "@/components/ui/primitives";
import { ICMR_SEROLOGY_TESTS } from "@/lib/donor-phase";

type Result = "NEG" | "POS";

export function ScreeningForm({ donorId }: { donorId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, Result>>(() =>
    Object.fromEntries(ICMR_SEROLOGY_TESTS.map((t) => [t.code, "NEG" as Result])),
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await submitSerologyScreening({ donorId, results });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Serology panel recorded");
      router.push(`/admin/donors/${donorId}?tab=p1`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Screening failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>ICMR mandatory serology</CardTitle>
        <CardDescription>
          All six assays are statutory and required. Any positive result
          permanently rejects the donor with code SEROLOGY_POSITIVE. All
          negative results advance the donor to P2 and issue the Donor Passport.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          {ICMR_SEROLOGY_TESTS.map((test) => (
            <div
              key={test.code}
              className="flex items-center justify-between gap-4 rounded-md border border-stone-200 px-3 py-2"
            >
              <Label className="font-medium">
                {test.label}
                <span className="ml-2 text-xs font-normal text-stone-500">
                  ({test.code}) · required
                </span>
              </Label>
              <select
                className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm"
                value={results[test.code]}
                onChange={(e) =>
                  setResults((prev) => ({
                    ...prev,
                    [test.code]: e.target.value as Result,
                  }))
                }
              >
                <option value="NEG">Negative</option>
                <option value="POS">Positive</option>
              </select>
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/donors/${donorId}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Submit panel"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
