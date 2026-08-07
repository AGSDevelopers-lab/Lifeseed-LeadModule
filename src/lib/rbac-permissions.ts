import { UserRole } from "@prisma/client";

/**
 * Permission strings follow role.action.resource from user_roles_rbac.md.
 * Safe for client + server (no Next/Prisma imports).
 */
export type Permission = string;

export type Role = UserRole;

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
    "clinic.contract.edit",
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
    "sample.accession",
    "donor.read",
  ],
  BANK_SR_ANDROLOGIST: [
    "sample.create",
    "sample.analyze",
    "sample.read",
    "sample.accession",
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
    "sample.read",
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
    "sample.*",
    "user.list",
    "user.role.assign",
    "credit_note.approve.tier3",
    "refund.approve.above_25L",
    "gstin.manage",
  ],
  L2_IVF_CLINICIAN: ["cycle_event.log", "cycle_outcome.log"],
  L2_EMBRYOLOGIST: ["cycle_event.log"],
  L2_SR_EMBRYOLOGIST: ["cycle_event.log", "gate.*.approve"],
  L2_LAB_HEAD: ["gate.*.approve", "batch.release"],
};

export function permissionGranted(
  held: Set<Permission> | Permission[],
  required: Permission,
): boolean {
  const set = held instanceof Set ? held : new Set(held);
  if (set.has(required)) return true;
  if (set.has("*")) return true;

  for (const perm of set) {
    if (!perm.endsWith(".*")) continue;
    const prefix = perm.slice(0, -1);
    if (required.startsWith(prefix) || required === perm) return true;
  }
  return false;
}

export function permissionsForRoles(roles: UserRole[]): Permission[] {
  return [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []))];
}

export type PortalKind = "admin" | "clinic" | "donor" | "recipient";

export function portalForRole(role: UserRole): PortalKind {
  if (role === "DONOR") return "donor";
  if (role === "RECIPIENT") return "recipient";
  if (role.startsWith("CLINIC_") || role.startsWith("L2_")) return "clinic";
  return "admin";
}

export function portalHome(portal: PortalKind): string {
  switch (portal) {
    case "admin":
      return "/admin";
    case "clinic":
      return "/clinic";
    case "donor":
      return "/donor";
    case "recipient":
      return "/recipient";
  }
}

export function portalsForRoles(roles: UserRole[]): PortalKind[] {
  return [...new Set(roles.map(portalForRole))];
}
