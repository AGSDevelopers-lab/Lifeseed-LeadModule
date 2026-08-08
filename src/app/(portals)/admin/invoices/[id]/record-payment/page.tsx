import { notFound, redirect } from "next/navigation";
import { Decimal } from "@prisma/client/runtime/library";

import { RecordPaymentForm } from "./record-payment-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function RecordPaymentPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "invoice.record_payment",
    )
  ) {
    redirect("/admin/invoices");
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { payments: true, creditNotes: true },
  });
  if (!invoice) notFound();

  const paid = invoice.payments.reduce(
    (s, p) => s.add(p.amount),
    new Decimal(0),
  );
  const credited = invoice.creditNotes.reduce(
    (s, c) => s.add(c.amount),
    new Decimal(0),
  );
  const balance = Number(
    new Decimal(invoice.netPayable).sub(paid).sub(credited).toFixed(2),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">
        Payment · {invoice.invoiceNumber}
      </h1>
      <RecordPaymentForm invoiceId={invoice.id} balance={Math.max(0, balance)} />
    </div>
  );
}
