# User Roles + RBAC

15+ roles across 4 portals. Every user can hold **multiple roles** (per your Andrology Lab v2 spec — e.g., Sr Andrologist + Lab Head at smaller sites). 2-witness checks always require 2 distinct user IDs.

## Role catalog

### External-facing (Portal roles)

| Role | Portal | Scope | Purpose |
|---|---|---|---|
| `DONOR` | Donor Portal | Own record | Donor self-service · profile · consent · honorarium |
| `RECIPIENT` | Recipient Portal | Own case | Package selection · profile browsing · consent · cycle status · payments |
| `CLINIC_DOCTOR` | Clinic Portal | Own clinic | Raise + sign DRF · outcome logging |
| `CLINIC_COORDINATOR` | Clinic Portal | Own clinic | Register recipients · track DRFs · non-clinical operations |
| `CLINIC_NURSE` | Clinic Portal | Own clinic | Log cycle events · receive dispatch · chain-of-custody |
| `CLINIC_ADMIN` | Clinic Portal | Own clinic | Contracts · financial · user management · compliance |
| `L2_IVF_CLINICIAN` | Clinic Portal (L2) | Own clinic | Stimulation · OPU · Transfer |
| `L2_EMBRYOLOGIST` | Clinic Portal (L2) | Own clinic | Denudation · fertilization · culture · grading |
| `L2_SR_EMBRYOLOGIST` | Clinic Portal (L2) | Own clinic | Gate reviews · Gardner grading · vitrification approval |
| `L2_LAB_HEAD` | Clinic Portal (L2) | Own clinic | Any gate · batch release |

### Bank Admin (SetuAI operator)

| Role | Purpose | Scope |
|---|---|---|
| `BANK_DONOR_COORD` | Donor onboarding · appointments · gate reviews | Site-level |
| `BANK_ANDROLOGY_TECH` | Semen analysis · preparation | Site-level |
| `BANK_SR_ANDROLOGIST` | Approve QC gates A2/A3/A4/A5 · sign-off per gate | Site-level |
| `BANK_LAB_HEAD` | Any gate approval · batch release | Site-level |
| `BANK_WITNESS` | Co-attest at critical handoffs (identity, labeling, cryo, retrieval, dispatch) | Any qualified staff |
| `BANK_CRYOBANK_TECH` | LN2 handling · vial retrieval · dispatch prep | Site-level |
| `BANK_MATCHING_OPS` | Match execution · manual overrides · engine config | Global |
| `BANK_CLINICAL_REVIEWER` | Gate reviews · Eligibility Board · genetic counselling triage | Global |
| `BANK_FINANCE` | Ledger · invoicing · reconciliation · honorarium · refunds | Site-level |
| `BANK_COMPLIANCE` | Registry sync · DPIA · audit trails · ART Act reporting · AE monitoring | Global · read all with audit stamp |
| `BANK_DISPATCH_COORD` | Cold-chain booking · courier management · dispatch queue · donor travel logistics | Site-level |
| `BANK_SITE_ADMIN` | Site-level config: package tiers, photo config, engine subs, contracts | Site-level |
| `BANK_SUPER_ADMIN` | System-wide config · role management · integration keys | Global · two-person approval for destructive |

## Permission matrix (module × role)

Cursor should generate the `src/lib/rbac.ts` middleware from this matrix. Format: `role.action.resource`.

### Donor Pathway
```
BANK_DONOR_COORD: donor.create, donor.read, donor.update, donor.appointment.manage
BANK_ANDROLOGY_TECH: donor.read
BANK_CLINICAL_REVIEWER: donor.read.all, donor.gate.approve
BANK_LAB_HEAD: donor.gate.approve.any, donor.state.transition
BANK_COMPLIANCE: donor.read.all.audit
BANK_SUPER_ADMIN: donor.*
```

### Andrology Lab
```
BANK_ANDROLOGY_TECH: sample.create, sample.analyze, sample.read
BANK_SR_ANDROLOGIST: sample.*, gate.qc_a2.approve, gate.qc_a3.approve, gate.qc_a4.approve, gate.qc_a5.approve
BANK_LAB_HEAD: gate.*.approve, batch.release
BANK_CRYOBANK_TECH: vial.create, vial.move, vial.retrieve, tank.manage
BANK_WITNESS: witness.attest.any
BANK_COMPLIANCE: sample.read.all.audit, gate.*.audit
```

### Dispatch
```
BANK_DISPATCH_COORD: dispatch.create, dispatch.state.transition, courier.book, vendor.select
BANK_CRYOBANK_TECH: vial.retrieve, dispatch.pack
BANK_WITNESS: witness.attest.dispatch
BANK_FINANCE: dispatch.read.finance
CLINIC_NURSE: dispatch.receive, chain_of_custody.sign
BANK_LAB_HEAD: dispatch.exception.approve
```

### Billing
```
BANK_FINANCE: challan.*, invoice.*, payment.*, credit_note.create (up to tier), refund.initiate
BANK_SITE_ADMIN: financial_model.assign, payment_terms.override
CFO or SITE_HEAD: credit_note.approve.tier2, refund.approve.5L_25L
BANK_SUPER_ADMIN: credit_note.approve.tier3, refund.approve.above_25L, gstin.manage
BANK_COMPLIANCE: gst_return.file, tds_form.file, e_invoice.enable
```

### Clinic-facing (external)
```
CLINIC_DOCTOR: drf.create, drf.sign, cycle_outcome.log
CLINIC_COORDINATOR: recipient.create, drf.track, drf.communicate
CLINIC_NURSE: dispatch.receive, cycle_event.log
CLINIC_ADMIN: contract.read, contract.request_change, finance.read.own_clinic, user.manage.own_clinic
```

### Recipient
```
RECIPIENT: own_case.read, package.select, consent.sign, profile.browse (if Profile-select),
           payment.pay, invoice.read.own, cycle_status.read.own
```

### Donor
```
DONOR: own_profile.read.update, appointment.schedule, consent.sign, honorarium.read.own,
       document.upload.own, withdrawal.initiate, ae.report
```

## Multi-role assignment rules

1. **Role permissions are additive.** If a user holds `BANK_SR_ANDROLOGIST` + `BANK_LAB_HEAD`, they get the union of permissions.
2. **2-witness requirements always need 2 distinct user IDs**, even if both hold same role. UI must prevent same-user self-attestation.
3. **Scope is enforced separately.** A `CLINIC_COORDINATOR` at Clinic X cannot see Clinic Y data even if they log into the Clinic Portal.
4. **Global roles (BANK_SUPER_ADMIN, BANK_COMPLIANCE)** bypass scope filters but are audit-logged for every read of sensitive data.
5. **Role changes require approval.** `BANK_SUPER_ADMIN` grants roles; two-person approval required for granting SUPER_ADMIN itself.

## Auth requirements per portal

| Portal | Primary Auth | MFA | Session |
|---|---|---|---|
| Donor | Mobile OTP | Optional | 30d sliding |
| Recipient | Email/mobile + password OR OTP | Recommended (TOTP or SMS) | 7d sliding |
| Clinic | Email + password | **Mandatory** (TOTP) | 8h idle timeout |
| Bank Admin | SSO OR email+password | **Mandatory** dual-factor (hardware key OR TOTP) + IP allow-list | 4h idle timeout |

## Middleware pattern (Cursor should generate)

```typescript
// src/lib/rbac.ts
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export type Permission =
  | 'donor.create' | 'donor.read' | 'donor.update' | 'donor.gate.approve'
  | 'sample.create' | 'sample.analyze' | 'sample.read' | 'gate.qc_a2.approve'
  | 'dispatch.create' | 'dispatch.pack' | 'dispatch.receive'
  | 'challan.create' | 'invoice.create' | 'payment.record' | 'refund.initiate'
  | 'witness.attest.any'
  | /* ... */;

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  BANK_ANDROLOGY_TECH: ['sample.create', 'sample.analyze', 'sample.read', 'donor.read'],
  BANK_SR_ANDROLOGIST: ['sample.create', 'sample.analyze', 'sample.read', 'gate.qc_a2.approve', /* ... */],
  // ... etc.
};

export async function requirePermission(perm: Permission) {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();

  // Union of permissions from all held roles
  const perms = new Set(session.roles.flatMap(r => ROLE_PERMISSIONS[r]));
  if (!perms.has(perm)) throw new ForbiddenError(perm);

  return session;
}

// Usage in API route:
// export async function POST(req: NextRequest) {
//   const session = await requirePermission('sample.create');
//   ...
// }
```

## Witness attestation pattern

```typescript
// Two-witness step wraps any critical operation
export async function attestWithWitnesses<T>(
  operation: () => Promise<T>,
  witnessUserIds: string[],
  operationName: string
): Promise<T> {
  if (witnessUserIds.length < 2) throw new Error('2-witness required');
  if (new Set(witnessUserIds).size < 2) throw new Error('Distinct witnesses required');

  // Verify both witnesses are valid + active + have witness scope
  await verifyWitnesses(witnessUserIds);

  const result = await operation();

  // Emit audit event
  await auditLog.record({
    action: 'WITNESS_ATTEST',
    operationName,
    witnesses: witnessUserIds,
    timestamp: new Date(),
  });

  return result;
}
```

## Cursor prompt to generate RBAC scaffold

```
Using @data_model.md + @user_roles_rbac.md, generate:
1. src/lib/rbac.ts with UserRole enum + ROLE_PERMISSIONS map + requirePermission() middleware
2. src/lib/audit.ts with auditLog.record() + Prisma middleware to auto-log all writes
3. src/lib/witness.ts with attestWithWitnesses() helper
4. src/hooks/useSession.ts + useHasPermission() React hook
5. src/components/auth/RoleGuard.tsx wrapper component

Follow patterns in @cursor_workflow.md.
```
