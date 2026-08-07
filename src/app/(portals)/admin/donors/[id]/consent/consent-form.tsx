"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { captureStage2Consent } from "@/app/(portals)/admin/donors/actions";
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

export const STAGE_2_CONSENT_TEXT = `# STAGE_2 · Procedure Consent (v1.0)

I confirm that I have been counselled regarding donation under the Assisted Reproductive Technology (Regulation) Act, 2021, including:

1. Purpose of donation and intended use of reproductive material.
2. Medical procedures, risks, and follow-up obligations.
3. Anonymity / profile-select rules applicable to my case.
4. Statutory caps on pregnancies / live births attributable to my donations.
5. My right to withdraw consent before material is allocated, subject to applicable law.
6. Processing of my personal data under the Digital Personal Data Protection Act, 2023, for ART Bank operations and statutory reporting.

I declare that the information I have provided is true and complete to the best of my knowledge, and I consent to proceed with the next clinical steps.
`;

export function ConsentForm({
  donorId,
  donorName,
}: {
  donorId: string;
  donorName: string;
}) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await captureStage2Consent({
        donorId,
        consentText: STAGE_2_CONSENT_TEXT,
        typedName,
        agreed,
        signedIp: null, // server may enrich later; client IP not trusted alone
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("STAGE_2 consent recorded");
      router.push(`/admin/donors/${donorId}?tab=p1`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Consent failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>STAGE_2 consent</CardTitle>
        <CardDescription>
          Procedure consent for {donorName}. Content is hashed (SHA-256) at
          capture time for integrity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-stone-200 bg-stone-50 p-4 text-sm text-stone-800">
            {STAGE_2_CONSENT_TEXT}
          </pre>
          <label className="flex items-start gap-2 text-sm text-stone-800">
            <input
              type="checkbox"
              className="mt-1"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            I agree to the STAGE_2 consent terms stated above.
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="typedName">Type full legal name</Label>
            <Input
              id="typedName"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={donorName}
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
            <Button type="submit" disabled={loading || !agreed}>
              {loading ? "Saving…" : "Sign consent"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
