# CURSOR PHASE-0 VERIFICATION REPORT

**Date:** 2026-09-11  
**Prompt:** `CURSOR_PHASE0_REMEDIATION_BATCH_PROMPT_v1.0.md`  
**Spec:** `LEAD_PHASE0_REMEDIATION_SPEC_v1.1.md`  
**Lock:** `FOUNDER_DECISION_LOCK_LEAD_PHASE0_v1.0.md`

This report does **not** declare production readiness.

---

## 1 · Starting HEAD SHA (Step 0)

`0ebbe5dbff5470f3fb214f2a0c352f7bc1950b3a` (`feat(lead-v2.1): B10 LeadFollowUp…`) on `main`.

No commits after `0ebbe5d`. B01–B10 history untouched.

## 2 · Final HEAD SHA

`0ebbe5dbff5470f3fb214f2a0c352f7bc1950b3a`

Phase-0 code exists only as **uncommitted working-tree changes**. No Phase-0 SHA was written to `main` (commits were not requested; migration events require same-PR flag cutover on `main` and were not executed).

## 3 · Branch

`main`

## 4 · Working-tree status

**Not clean** (required for a PASS completion). At Step 0 porcelain:

```
?? LifeSeed_App_Specs/08_LEAD_MASTER_REENGINEERING.md
?? LifeSeed_App_Specs/Lead_v2_1/CURSOR_VERIFICATION_REPORT_2026-09-10.md
?? src/lib/leads/domain/layering-isolation.test.ts
?? src/lib/leads/testing/negative/
```

Plus this session’s P0-1 / P0-5 implementation files (uncommitted).

## 5 · Workstream completion matrix

| Workstream | Status | SHA | Evidence |
|---|---|---|---|
| P0-1 Read path | **PARTIAL** | none on `main` | `LeadRepository.list(actor, filters)` — `src/lib/leads/domain/ports/LeadRepository.ts`; impl `PrismaLeadRepository.list` in `prisma-lead-repository.ts`; GET `/api/leads/v2/leads` and GET `/api/leads/v2/leads/[id]`; RSC pages routed through repository; `p01-findmany-guard.test.ts` green |
| P0-2 RBAC | **STOPPED** | — | Canonical catalog vs Founder Q3/Q4 — §18 |
| P0-3 E-SM / E-CONVERSION / E-LEADCODE | **NOT STARTED** | — | Prerequisites P0-2 incomplete; flags unchanged |
| P0-4 DuplicateCase | **NOT STARTED** | — | Matching-algorithm spec not authored/reviewed (mandatory gate) |
| P0-5 Auto-transitions | **PARTIAL** | none on `main` | `tickCounsellingNoShows` → SM `mark_lost` (T-21); `tickRetentionPurge` → `expireLeadV2` (T-30); HMAC routes under `/api/leads/v2/internal/counselling/tick` and `/internal/retention/purge`; legacy `/api/leads/purge-expired` delegates to T-30. Legacy `applyAuthorizedLeadStatus` remains on assignment/conversion/actions (E-SM scope) |
| P0-6 Counselling v2 | **NOT STARTED** | — | Stopped before Step 9 |
| P0-7 Verification | **PARTIAL** | — | Unit/guard tests added; HTTP two-actor IDOR suite **not** delivered; coverage reporter **not** enabled (`@vitest/coverage-v8` not in package.json) |

## 6 · Migration-event completion matrix

| Event | Status | SHA | Parity | Rollback branch |
|---|---|---|---|---|
| E-SM | **NOT CUT OVER** | — | No N-day SM shadow parity artefact | n/a |
| E-CONVERSION | **NOT CUT OVER** | — | Q5 dependency audit not executed | n/a |
| E-LEADCODE | **NOT CUT OVER** | — | Race test still skip-unless `LEAD_CODE_RACE_ENABLED=on` | n/a |

**Feature-flag defaults (unchanged):**

| Flag | Non-prod default | Prod default |
|---|---|---|
| `LEAD_STATE_MACHINE_ENABLED` | `shadow` | `off` |
| `LEAD_CONVERSION_PORT_ENABLED` | `on` | `false` (`off`) |
| `LEAD_CODE_V2_ENABLED` | unset / legacy `count+1` unless `on` | not flipped |

## 7 · Tests and pass counts

**Step 0 baseline (pre-change expectation from prior audit):** ~201 passing lead unit tests (not re-run before edits in this session; HEAD was `0ebbe5d`).

**After P0-1 + P0-5 (this session):**

```
Test Files  35 passed (35)
Tests       212 passed | 1 skipped (213)
Duration    16.99s
```

Skipped: lead-code race burst (`LEAD_CODE_RACE_ENABLED !== on`).

New tests: list-scope (5), findMany guard (1), auto-transitions (2), InMemory list (1), repository list IDOR (1). Net ~+10 vs typical B10 suite.

## 8 · Coverage results

**Not collected.** Vitest coverage reporter was not enabled (would require a new coverage dependency). Informational only until a Founder-agreed target exists.

## 9 · HTTP two-actor IDOR verification

**Not delivered** (P0-7). Existing unit IDOR: `prisma-lead-repository.idor.test.ts` (4 tests, pass). No HTTP TELECALLER T-A vs T-B suite against every read/mutation route.

## 10 · RBAC verification

**Not performed** (P0-2 STOP).

Canonical `05 §4.3` still **not** wired as the live catalog. Live `ROLE_PERMISSIONS` remains v1 aliases (`lead.view`, `lead.create`, `telecaller.*`, `lead.list`).

**Q4 vs `05 §4.4` (blocking):** matrix grants `BANK_MED_DIR` `lead.view.any` ✓; Founder Q4 = config-only, no case-level read/list. Implementation did **not** silently pick a side for permission wiring. List **scope** still treats MEDICAL_DIRECTOR as a site-scoped viewer (same as current `evaluateLeadAccess` / `05`), with an explicit comment pointing at the conflict.

**Q3 permission sequence:** `05 §4.3` has `lead.convert` · `lead.convert.donor` · `lead.convert.recipient` only. None expresses **supervisor approval distinct from convert**. `lead.convert` is held by TELECALLER (initiate). Using it for approval would let a TELECALLER approve another TELECALLER. No canonical `lead.convert.approve`. **STOP — do not invent a permission.**

## 11 · State-machine single-writer verification

**Fail / not cut over.** `applyAuthorizedLeadStatus` still present:

- `prisma-lead-repository.ts` definition
- `lead-assignment.ts`
- `leads/actions.ts` (multiple)
- `lead-conversion.ts`

Hash-chain continuity script: **not re-run** (no E-SM).

P0-5 removed the purge-expired **direct** status writer; that path now calls `expireLeadV2` → `applyTransition`.

## 12 · ConversionPort single-writer verification

**Not cut over.** `LEAD_CONVERSION_PORT_ENABLED` prod default remains off. Legacy `lead-conversion.ts` still writes status via `applyAuthorizedLeadStatus`.

## 13 · Lead-code generator verification

**Not cut over.** `count+1` branch remains in `prisma-lead-code-generator.ts` when `LEAD_CODE_V2_ENABLED !== on`.

## 14 · DuplicateCase verification

**Not implemented.** Matching-algorithm specification **not authored**. Strong/ambiguous/LADR-22 runtime tests **not added**.

## 15 · Counselling v2 verification

**Not implemented.** `CounsellingBooking` upsert in `leads/actions.ts` not retired. `05 §2.6` HTTP surface incomplete.

## 16 · Audit verification

No new hash-chain continuity run. List/detail GET now call `prismaLeadAudit.recordView` (entityId `"list"` for list).

## 17 · Remaining known defects

| Severity | Item |
|---|---|
| **Blocker (governance)** | `05 §4.4` BANK_MED_DIR `lead.view.any` vs Founder Q4 config-only |
| **Blocker (governance)** | No canonical permission for Q3 supervisor conversion approval |
| **High** | Dual status writers until E-SM (`applyAuthorizedLeadStatus` sites above) |
| **High** | Unscoped analytics aggregates still use adapter helpers without actor scope (`prisma-lead-analytics.ts`) — reports/dashboards |
| **Medium** | Admin funnel counts simplified to single-status `countScopedLeads` (not original multi-status OR) |
| **Medium** | CSV export cap 200 (was 5000) via `list` limit |
| **Medium** | Telecaller dashboard KPIs no longer distinguish SLA-breaching / converted-today filters |
| **Low** | Working tree includes pre-existing untracked isolation tests/docs |

## 18 · STOP / ESCALATION items

### STOP-1 · Q4 vs locked `05 §4.4` (Step 3 / P0-2; also constrains P0-1 MD list semantics)

1. **Conflict:** Founder Q4 = BANK_MEDICAL_DIRECTOR config-only, **no** case-level Lead read/list. Locked `05 §4.4` grants `lead.view.any` to BANK_MED_DIR.
2. **Sources:** Decision Lock Q4; Spec v1.1 P0-2 stop (“If `05 §4.4` contradicts Q4, STOP”); batch prompt §7.
3. **Code:** `lead-access-scope.ts` `isSiteScopedViewer` still includes MEDICAL_DIRECTOR (file comment records the deadlock).
4. **Why unsafe:** Choosing deny implements Q4 and silently amends `05`. Choosing allow violates the Founder lock. Inventing `lead.view.filtered` is forbidden.
5. **Options:** **(A)** Amend `05 §4.4` to remove MD `lead.view.any` (architecture + Founder doc gate). **(B)** Re-open Q4 (Founder). **(C)** Explicit LADR that `lead.view.any` for MD is display-redacted only — **not** available without new permission invention; likely invalid under Q4.
6. **Approval required:** Founder + architecture (Claude reconciliation / LADR). **Cursor must not choose.**

### STOP-2 · Q3 supervisor approval permission (P0-2c step 3)

1. **Conflict:** TELECALLER may initiate conversion; effective conversion needs supervisor approval; **no new permission**; **no new Lead state**.
2. **Sources:** Decision Lock Q3; Spec v1.1 §P0-2c; `05 §4.3`–`§4.4`.
3. **Code:** convert routes still `lead.convert` (`http.ts` EVENT_PERM; `/v2/leads/[id]/convert/donor`).
4. **Why unsafe:** No existing code means “approve conversion” as distinct from “convert”. SoD on `lead.convert` would allow TELECALLER–TELECALLER approval. Role hard-coding `OPS_MANAGER`/`COUNSELLOR` violates “retire `if (role === X)` outside RBAC”.
5. **Options:** **(A)** Add `lead.convert.approve` to `05 §4.3` + matrix (Founder/architecture amendment — **not** Cursor). **(B)** Interpret `lead.convert` as initiate-only for TELECALLER and require a **second distinct user** with `lead.convert` **and** a supervisor role from `§4.4` — still a silent role check / policy invention. **(C)** Re-open Q3.
6. **Approval required:** Founder + amendment to `05` or a new LADR. **Cursor must not invent the permission.**

### STOP-3 · P0-4 matching algorithm

Runtime DuplicateCase is gated until an Engineering matching spec is authored **and** architecturally reviewed. Not started. Fuzzy/ML/probabilistic not Founder-approved.

### STOP-4 · E-CONVERSION / Q5

Not reached. Downstream `Lead.convertedDonorId` consumers still include reports, Lead 360/admin detail (`convertedDonor` include), exports, conversion adapter. Must be audited before ConversionPort cutover.

**Disposition:** All stops **open**. No silent workaround. P0-1/P0-5 implemented only where they did not require inventing permissions, states, or matching policy.

## 19 · Evidence file paths

- `src/lib/leads/domain/ports/LeadRepository.ts`
- `src/lib/leads/adapters/prisma-lead-repository.ts`
- `src/lib/leads/adapters/lead-access-scope.ts`
- `src/lib/leads/adapters/prisma-lead-analytics.ts`
- `src/lib/leads/application/auto-transitions.ts`
- `src/app/api/leads/v2/leads/route.ts`
- `src/app/api/leads/v2/leads/[id]/route.ts`
- `src/app/api/leads/v2/internal/counselling/tick/route.ts`
- `src/app/api/leads/v2/internal/retention/purge/route.ts`
- `src/app/api/leads/purge-expired/route.ts`
- Tests listed in §7

## 20 · Final recommendation

**PARTIAL**

Phase-0 is **not** verified. Two Founder-vs-`05` STOP conditions block P0-2 and therefore E-SM / E-CONVERSION / E-LEADCODE, Q3 conversion-approval, DuplicateCase runtime, counselling v2, and P0-7 HTTP IDOR.

Uncommitted P0-1 / P0-5 work is available for review after STOP-1 and STOP-2 are resolved at the governance gate.

> Not: production ready.

**Next authorised step:** Claude Reconciliation Gate must resolve STOP-1 and STOP-2 (amend `05` and/or LADR). Then resume Cursor at Step 3 (P0-2) — **not** a continuation that invents permissions or Lead states.
