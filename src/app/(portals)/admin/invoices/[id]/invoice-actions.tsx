"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  sendInvoiceReminder,
  voidInvoice,
} from "@/app/(portals)/admin/invoices/actions";
import { Button } from "@/components/ui/primitives";

export function InvoiceActions({
  invoiceId,
  status,
  canPay,
  canCredit,
  canDunning,
  canVoid,
}: {
  invoiceId: string;
  status: string;
  canPay: boolean;
  canCredit: boolean;
  canDunning: boolean;
  canVoid: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {canPay && status !== "VOID" && status !== "PAID_FULL" && (
        <Link href={`/admin/invoices/${invoiceId}/record-payment`}>
          <Button>Record payment</Button>
        </Link>
      )}
      {canCredit && status !== "VOID" && (
        <Link href={`/admin/invoices/${invoiceId}/credit-note`}>
          <Button variant="outline">Issue credit note</Button>
        </Link>
      )}
      {canDunning && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await sendInvoiceReminder(invoiceId);
              if (!r.ok) toast.error(r.error);
              else {
                toast.success(r.message ?? "Reminder sent");
                router.refresh();
              }
            })
          }
        >
          Send reminder
        </Button>
      )}
      {canVoid && status !== "VOID" && status !== "PAID_FULL" && (
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await voidInvoice(invoiceId);
              if (!r.ok) toast.error(r.error);
              else {
                toast.success("Invoice voided");
                router.refresh();
              }
            })
          }
        >
          Mark void
        </Button>
      )}
    </div>
  );
}
