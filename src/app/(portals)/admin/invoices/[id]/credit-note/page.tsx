import { notFound, redirect } from "next/navigation";
import { Decimal } from "@prisma/client/runtime/library";

import { CreditNoteForm } from "./credit-note-form";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";

type Params = Promise<{ id: string }>;

export default async function CreditNotePage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (
    !permissionGranted(
      permissionsForRoles(session.roles),
      "invoice.credit_note",
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
  const outstanding = new Decimal(invoice.netPayable).sub(paid).sub(credited);
  const maxCredit = Number(
    Decimal.max(paid.sub(credited), outstanding, new Decimal(0)).toFixed(2),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">
        Credit note · {invoice.invoiceNumber}
      </h1>
      <CreditNoteForm invoiceId={invoice.id} maxAmount={Math.max(0, maxCredit)} />
    </div>
  );
}
