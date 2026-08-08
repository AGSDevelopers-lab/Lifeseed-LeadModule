"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  cancelSubscription,
  pauseSubscription,
} from "@/app/(portals)/admin/invoices/actions";
import { Button } from "@/components/ui/primitives";

export function SubscriptionActions({
  id,
  status,
  canModify,
  canCancel,
}: {
  id: string;
  status: string;
  canModify: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {canModify && status === "ACTIVE" && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await pauseSubscription(id);
              if (!r.ok) toast.error(r.error);
              else {
                toast.success("Paused");
                router.refresh();
              }
            })
          }
        >
          Pause
        </Button>
      )}
      {canCancel && status !== "CANCELLED" && (
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await cancelSubscription(id);
              if (!r.ok) toast.error(r.error);
              else {
                toast.success("Cancelled");
                router.refresh();
              }
            })
          }
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
