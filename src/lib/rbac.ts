import { UserRole } from "@prisma/client";

/**
 * Permission strings follow role.action.resource convention from user_roles_rbac.md.
 * Expand as modules are implemented — skeleton covers the matrix surface area.
 */
export type Permission =
  | "donor.create"
  | "donor.read"
  | "donor.read.all"
  | "donor.read.all.audit"
  | "donor.update"
  | "donor.appointment.manage"
  | "donor.gate.approve"
  | "donor.gate.approve.any"
  | "donor.state.transition"
  | "donor.*"
  | "sample.create"
  | "sample.analyze"
  | "sample.read"
  | "sample.read.all.audit"
  | "sample.*"
  | "gate.qc_a2.approve"
  | "gate.qc_a3.approve"
  | "gate.qc_a4.approve"
  | "gate.qc_a5.approve"
  | "gate.*.approve"
  | "gate.*.audit"
  | "batch.release"
  | "vial.create"
  | "vial.move"
  | "vial.retrieve"
  | "tank.manage"
  | "witness.attest.any"
  | "witness.attest.dispatch"
  | "dispatch.create"
  | "dispatch.state.transition"
  | "dispatch.pack"
  | "dispatch.receive"
  | "dispatch.read.finance"
  | "dispatch.exception.approve"
  | "courier.book"
  | "vendor.select"
  | "chain_of_custody.sign"
  | "challan.*"
  | "invoice.*"
  | "payment.*"
  | "credit_note.create"
  | "credit_note.approve.tier2"
  | "credit_note.approve.tier3"
  | "refund.initiate"
  | "refund.approve.5L_25L"
  | "refund.approve.above_25L"
  | "financial_model.assign"
  | "payment_terms.override"
  | "gstin.manage"
  | "gst_return.file"
  | "tds_form.file"
  | "e_invoice.enable"
  | "drf.create"
  | "drf.sign"
  | "drf.track"
  | "drf.communicate"
  | "recipient.create"
  | "cycle_outcome.log"
  | "cycle_event.log"
  | "contract.read"
  | "contract.request_change"
  | "finance.read.own_clinic"
  | "user.manage.own_clinic"
  | "own_case.read"
  | "package.select"
  | "consent.sign"
  | "profile.browse"
  | "payment.pay"
  | "invoice.read.own"
  | "cycle_status.read.own"
  | "own_profile.read.update"
  | "appointment.schedule"
  | "honorarium.read.own"
  | "document.upload.own"
  | "withdrawal.initiate"
  | "ae.report";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Forbidden: missing permission ${permission}`);
    this.name = "ForbiddenError";
  }
}

/** Session shape — wired to Supabase Auth in a later pass. */
export type SessionUser = {
  userId: string;
  email: string;
  roles: UserRole[];
  siteId: string | null;
  clinicId: string | null;
};

/**
 * Stub until auth is scaffolded. Replace with getSession() from src/lib/auth.ts.
 */
export async function getSession(): Promise<SessionUser | null> {
  return null;
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  DONOR: [
    "own_profile.read.update",
    "appointment.schedule",
    "consent.sign",
    "honorarium.read.own",
    "document.upload.own",
    "withdrawal.initiate",
    "ae.report",
  ],
  RECIPIENT: [
    "own_case.read",
    "package.select",
    "consent.sign",
    "profile.browse",
    "payment.pay",
    "invoice.read.own",
    "cycle_status.read.own",
  ],
  CLINIC_DOCTOR: ["drf.create", "drf.sign", "cycle_outcome.log"],
  CLINIC_COORDINATOR: [
    "recipient.create",
    "drf.track",
    "drf.communicate",
  ],
  CLINIC_NURSE: [
    "dispatch.receive",
    "chain_of_custody.sign",
    "cycle_event.log",
  ],
  CLINIC_ADMIN: [
    "contract.read",
    "contract.request_change",
    "finance.read.own_clinic",
    "user.manage.own_clinic",
  ],
  BANK_DONOR_COORD: [
    "donor.create",
    "donor.read",
    "donor.update",
    "donor.appointment.manage",
  ],
  BANK_ANDROLOGY_TECH: [
    "sample.create",
    "sample.analyze",
    "sample.read",
    "donor.read",
  ],
  BANK_SR_ANDROLOGIST: [
    "sample.create",
    "sample.analyze",
    "sample.read",
    "sample.*",
    "gate.qc_a2.approve",
    "gate.qc_a3.approve",
    "gate.qc_a4.approve",
    "gate.qc_a5.approve",
  ],
  BANK_LAB_HEAD: [
    "donor.gate.approve.any",
    "donor.state.transition",
    "gate.*.approve",
    "batch.release",
    "dispatch.exception.approve",
  ],
  BANK_WITNESS: ["witness.attest.any", "witness.attest.dispatch"],
  BANK_CRYOBANK_TECH: [
    "vial.create",
    "vial.move",
    "vial.retrieve",
    "tank.manage",
    "dispatch.pack",
  ],
  BANK_MATCHING_OPS: ["donor.read"],
  BANK_CLINICAL_REVIEWER: ["donor.read.all", "donor.gate.approve"],
  BANK_FINANCE: [
    "challan.*",
    "invoice.*",
    "payment.*",
    "credit_note.create",
    "refund.initiate",
    "dispatch.read.finance",
  ],
  BANK_CFO: ["credit_note.approve.tier2", "refund.approve.5L_25L"],
  BANK_SITE_HEAD: ["credit_note.approve.tier2", "refund.approve.5L_25L"],
  BANK_COMPLIANCE: [
    "donor.read.all.audit",
    "sample.read.all.audit",
    "gate.*.audit",
    "gst_return.file",
    "tds_form.file",
    "e_invoice.enable",
  ],
  BANK_DISPATCH_COORD: [
    "dispatch.create",
    "dispatch.state.transition",
    "courier.book",
    "vendor.select",
  ],
  BANK_SITE_ADMIN: ["financial_model.assign", "payment_terms.override"],
  BANK_SUPER_ADMIN: [
    "donor.*",
    "credit_note.approve.tier3",
    "refund.approve.above_25L",
    "gstin.manage",
  ],
  L2_IVF_CLINICIAN: ["cycle_event.log", "cycle_outcome.log"],
  L2_EMBRYOLOGIST: ["cycle_event.log"],
  L2_SR_EMBRYOLOGIST: ["cycle_event.log", "gate.*.approve"],
  L2_LAB_HEAD: ["gate.*.approve", "batch.release"],
};

function permissionGranted(
  held: Set<Permission>,
  required: Permission,
): boolean {
  if (held.has(required)) return true;

  // Wildcard expansion: donor.* covers donor.create, etc.
  for (const perm of held) {
    if (!perm.endsWith(".*")) continue;
    const prefix = perm.slice(0, -1); // "donor."
    if (required.startsWith(prefix) || required === perm) return true;
  }

  return false;
}

/**
 * Call at the top of every API route. Throws UnauthorizedError / ForbiddenError.
 * Auth session wiring lands with the portal auth scaffold.
 */
export async function requirePermission(
  perm: Permission,
): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();

  const held = new Set(
    session.roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []),
  );

  if (!permissionGranted(held, perm)) {
    throw new ForbiddenError(perm);
  }

  return session;
}
