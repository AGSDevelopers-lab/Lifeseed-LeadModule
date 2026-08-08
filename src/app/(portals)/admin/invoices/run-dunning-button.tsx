"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { runBulkDunning } from "@/app/(portals)/admin/invoices/actions";
import { Button } from "@/components/ui/primitives";

export function RunDunningButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await runBulkDunning();
          if (!r.ok) toast.error(r.error);
          else {
            toast.success(r.message ?? "Dunning complete");
            router.refresh();
          }
        })
      }
    >
      {pending ? "Running…" : "Run dunning"}
    </Button>
  );
}
