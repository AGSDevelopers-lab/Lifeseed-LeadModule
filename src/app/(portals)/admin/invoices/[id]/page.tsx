import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Decimal } from "@prisma/client/runtime/library";

import { InvoiceActions } from "./invoice-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import {
  getSession,
  permissionGranted,
  permissionsForRoles,
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

type Params = Promise<{ id: string }>;

function money(v: { toString(): string }) {
  return Number(v.toString()).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Params;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const perms = permissionsForRoles(session.roles);
  if (!permissionGranted(perms, "invoice.view")) redirect("/admin/invoices");

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      site: true,
      lineItems: true,
      payments: { orderBy: { paidAt: "desc" } },
      creditNotes: { orderBy: { issuedAt: "desc" } },
      parentChallan: true,
      drf: true,
    },
  });
  if (!invoice) notFound();

  const clinic =
    invoice.buyerType === "CLINIC"
      ? await prisma.clinic.findUnique({ where: { id: invoice.buyerId } })
      : null;

  const igst = invoice.lineItems.reduce(
    (s, li) => s.add(li.igst),
    new Decimal(0),
  );
  const cgst = invoice.lineItems.reduce(
    (s, li) => s.add(li.cgst),
    new Decimal(0),
  );
  const sgst = invoice.lineItems.reduce(
    (s, li) => s.add(li.sgst),
    new Decimal(0),
  );
  const interState = igst.gt(0);

  const paid = invoice.payments.reduce(
    (s, p) => s.add(p.amount),
    new Decimal(0),
  );
  const credited = invoice.creditNotes.reduce(
    (s, c) => s.add(c.amount),
    new Decimal(0),
  );
  const balance = new Decimal(invoice.netPayable).sub(paid).sub(credited);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-stone-500">{invoice.invoiceNumber}</div>
          <h1 className="text-2xl font-semibold text-stone-900">
            {clinic?.name ?? invoice.buyerType}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Pill>{invoice.status}</Pill>
            <Pill tone="warn">{invoice.dunningStage}</Pill>
            <span className="text-stone-600">
              Due {invoice.dueDate.toISOString().slice(0, 10)}
            </span>
            <span className="text-stone-600">
              Site {invoice.site.code} · GSTIN {invoice.gstin}
            </span>
          </div>
          {clinic && (
            <p className="mt-1 text-sm">
              Clinic{" "}
              <span className="font-medium">{clinic.clinicCode}</span> · PoS{" "}
              {invoice.placeOfSupplyStateCode}
            </p>
          )}
        </div>
        <InvoiceActions
          invoiceId={invoice.id}
          status={invoice.status}
          canPay={permissionGranted(perms, "invoice.record_payment")}
          canCredit={permissionGranted(perms, "invoice.credit_note")}
          canDunning={permissionGranted(perms, "invoice.dunning")}
          canVoid={permissionGranted(perms, "invoice.void")}
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Net payable" value={`₹${money(invoice.netPayable)}`} />
        <Stat label="Paid" value={`₹${money(paid)}`} />
        <Stat label="Balance" value={`₹${money(balance)}`} />
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">GST breakdown</h2>
        <p className="text-xs text-stone-500">
          {interState
            ? "Inter-state · IGST applied"
            : "Intra-state · CGST + SGST applied"}
        </p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-stone-500">Taxable</dt>
            <dd>₹{money(invoice.taxableValue)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">IGST</dt>
            <dd>₹{money(igst)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">CGST</dt>
            <dd>₹{money(cgst)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">SGST</dt>
            <dd>₹{money(sgst)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">
          Line items
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Taxable</TableHead>
              <TableHead>Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.lineItems.map((li) => (
              <TableRow key={li.id}>
                <TableCell className="font-mono text-xs">{li.skuCode}</TableCell>
                <TableCell>{li.description}</TableCell>
                <TableCell>{li.quantity.toString()}</TableCell>
                <TableCell>₹{money(li.unitPrice)}</TableCell>
                <TableCell>₹{money(li.taxableValue)}</TableCell>
                <TableCell>₹{money(li.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">Payments</h2>
        {invoice.payments.length === 0 ? (
          <p className="text-stone-500">No payments recorded.</p>
        ) : (
          <ul className="space-y-1">
            {invoice.payments.map((p) => (
              <li key={p.id}>
                {p.paidAt.toISOString().slice(0, 10)} · {p.method} · ₹
                {money(p.amount)} · {p.paymentNumber}
                {p.referenceNumber ? ` · ref ${p.referenceNumber}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {invoice.creditNotes.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <h2 className="mb-2 font-semibold">Credit notes</h2>
          <ul className="space-y-1">
            {invoice.creditNotes.map((c) => (
              <li key={c.id}>
                {c.creditNoteNumber} · {c.reasonCode} · ₹{money(c.amount)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link
        href="/admin/invoices"
        className="text-sm text-emerald-900 hover:underline"
      >
        ← Back to invoices
      </Link>
    </div>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warn";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 ring-1",
        tone === "warn"
          ? "bg-amber-50 text-amber-900 ring-amber-200"
          : "bg-stone-100 text-stone-800 ring-stone-200",
      )}
    >
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-stone-900">{value}</div>
    </div>
  );
}
