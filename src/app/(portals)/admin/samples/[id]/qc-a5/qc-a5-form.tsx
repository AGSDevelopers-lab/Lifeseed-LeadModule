"use client";

import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { submitQcA5 } from "@/app/(portals)/admin/samples/actions";
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

type WitnessUser = { id: string; email: string };

export function QcA5Form({
  sampleId,
  sampleCode,
  preFreezePR,
  witnesses,
}: {
  sampleId: string;
  sampleCode: string;
  preFreezePR: number | null;
  witnesses: WitnessUser[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [postThawPR, setPostThawPR] = useState("");
  const [totalMotile, setTotalMotile] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [witnessUserId, setWitnessUserId] = useState(witnesses[0]?.id ?? "");

  const qrValue = useMemo(
    () => `lifeseed:sample:${sampleCode}:qc-a5`,
    [sampleCode],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await submitQcA5({
        sampleId,
        postThawPR: Number(postThawPR),
        totalMotilePerVial: Number(totalMotile),
        postThawVideoUrl: videoUrl || undefined,
        qrPackUrl: qrValue,
        witnessUserId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.passed ? "QC-A5 passed" : "QC-A5 failed — sample closed",
      );
      router.push(`/admin/samples/${sampleId}?tab=a7`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "QC-A5 failed");
    } finally {
      setLoading(false);
    }
  }

  const recovery =
    preFreezePR && Number(postThawPR)
      ? ((Number(postThawPR) / preFreezePR) * 100).toFixed(1)
      : "—";

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>A7 · QC-A5 · 24-hour post-freeze</CardTitle>
        <CardDescription>
          Post-thaw PR must be ≥40% of pre-freeze ({preFreezePR ?? "—"}%) and
          total motile/vial ≥20M. Two-witness attestation is mandatory.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label>Post-thaw PR motility (%)</Label>
            <Input
              value={postThawPR}
              onChange={(e) => setPostThawPR(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Total motile sperm / vial (M)</Label>
            <Input
              value={totalMotile}
              onChange={(e) => setTotalMotile(e.target.value)}
              required
            />
          </div>
          <div className="rounded-md bg-stone-50 px-3 py-2 text-sm">
            Recovery vs pre-freeze: <strong>{recovery}%</strong>
          </div>
          <div className="space-y-1.5">
            <Label>Test vial thaw video URL</Label>
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="flex flex-col items-start gap-2">
            <Label>Batch QR (auto)</Label>
            <div className="rounded-md border border-stone-200 bg-white p-3">
              <QRCodeSVG value={qrValue} size={128} />
            </div>
            <code className="text-xs text-stone-500">{qrValue}</code>
          </div>
          <div className="space-y-1.5">
            <Label>Witness (distinct from signed-in operator)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm"
              value={witnessUserId}
              onChange={(e) => setWitnessUserId(e.target.value)}
              required
            >
              {witnesses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.email}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/samples/${sampleId}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !witnessUserId}>
              {loading ? "Saving…" : "Submit QC-A5"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
