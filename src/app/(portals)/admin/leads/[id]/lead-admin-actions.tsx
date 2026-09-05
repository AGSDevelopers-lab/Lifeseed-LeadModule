"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { addToDnc, archiveLead, forcePurgeLead, reassignLead } from "@/app/(portals)/leads/actions";
import {
  Dialog, DialogCloseButton, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";

type ActionKey = "reassign" | "dnc" | "archive" | "purge" | null;

export function LeadAdminActions({
  leadId, phone, email, telecallers, canAssign, canDnc, canArchive, canPurge,
}: {
  leadId: string;
  phone: string | null;
  email: string | null;
  telecallers: Array<{ id: string; email: string }>;
  canAssign: boolean;
  canDnc: boolean;
  canArchive: boolean;
  canPurge: boolean;
}) {
  const router = useRouter();
  const [action, setAction] = useState<ActionKey>(null);
  const [telecallerId, setTelecallerId] = useState(telecallers[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  if (!canAssign && !canDnc && !canArchive && !canPurge) return null;

  async function confirm() {
    setPending(true);
    try {
      let result: { ok: true } | { ok: false; error: string };
      if (action === "reassign") {
        if (!telecallerId) { toast.error("Select a telecaller"); return; }
        result = await reassignLead(leadId, telecallerId);
      } else if (action === "dnc") {
        if (!phone) { toast.error("Lead has no phone"); return; }
        result = await addToDnc({ phone, email: email ?? undefined, reason: "Marked Do Not Call by admin" });
      } else if (action === "archive") {
        result = await archiveLead(leadId);
      } else if (action === "purge") {
        result = await forcePurgeLead(leadId);
      } else return;
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Done");
      setAction(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const title =
    action === "reassign" ? "Reassign to another telecaller"
    : action === "dnc" ? "Mark as Do Not Call"
    : action === "archive" ? "Archive lead"
    : action === "purge" ? "Force purge (PII redact)"
    : "";

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Admin management</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canAssign && <Button variant="outline" onClick={() => setAction("reassign")}>Reassign to another telecaller</Button>}
          {canDnc && <Button variant="outline" onClick={() => setAction("dnc")}>Mark as Do Not Call</Button>}
          {canArchive && <Button variant="outline" onClick={() => setAction("archive")}>Archive lead</Button>}
          {canPurge && <Button variant="destructive" onClick={() => setAction("purge")}>Force purge (PII redact)</Button>}
        </CardContent>
      </Card>
      <Dialog open={action != null} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          {action === "reassign" && (
            <select className="flex h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm" value={telecallerId} onChange={(e) => setTelecallerId(e.target.value)}>
              {telecallers.map((t) => <option key={t.id} value={t.id}>{t.email}</option>)}
            </select>
          )}
          {action === "dnc" && <p className="text-sm text-stone-600">Adds {phone ?? "—"} / {email ?? "—"} to DNC.</p>}
          { action === "archive" && <p className="text-sm text-stone-600">Archives the lead (isArchived) without changing conversion status. Confirm to continue.</p>}
          {action === "purge" && <p className="text-sm text-red-700">Permanently redacts PII. Cannot be undone.</p>}
          <DialogFooter>
            <DialogCloseButton onClick={() => setAction(null)} />
            <Button variant={action === "purge" ? "destructive" : "default"} disabled={pending} onClick={confirm}>
              {pending ? "Working…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
