# CURSOR PHASE-0 BATCH 0 · BASELINE

**Date (UTC+5:30):** 2026-09-12  
**Prompt:** `FINAL_CURSOR_EXECUTION_PROMPT_v1.0` BATCH 0 only  
**Authorization:** Founder (Arindam) explicit dispatch — BATCH 0 only; do not proceed to BATCH 1  
**Governing note:** Historical audits (`0ebbe5d`, 2026-09-10 / 2026-09-11 reports) are evidence only. This file records the **live** repository.

This batch does **not** implement Phase-0 work. It does **not** claim production readiness, UAT approval, or deployment approval. Production-authoritative feature flags were **not** flipped.

---

## 1. Git identity

| Item | Value |
|---|---|
| Branch | `main` |
| Tracking | `origin/main` — **up to date** (reported by `git status`) |
| HEAD SHA | `6e1bc56e49053de1f6d2c890b818d813c70fde1e` |
| HEAD subject | `fix(lead-v2.1): P0-1 scoped LeadRepository.list and findMany guard for portal lists and lifecycle ticks` |
| HEAD author | Arindam Chakraborty · Sat Sep 12 14:07:07 2026 +0530 |
| Working tree | **No modified tracked files.** Untracked files listed in §2. |

### 1.1 Delta vs historical `0ebbe5d`

`git log --oneline 0ebbe5d..HEAD`:

```
6e1bc56 fix(lead-v2.1): P0-1 scoped LeadRepository.list and findMany guard for portal lists and lifecycle ticks
2d2b431 docs(lead-v2.1): record Phase-0 PARTIAL verification and governance STOPs
```

`6e1bc56` is **25 files, +860 / −232**. It is **partial, unverified P0-1** relative to BATCH 1 / CONFLICT-25..30 (see §8). It is **not** treated as P0-1 complete.

### 1.2 `git status --porcelain=v1 -uall` (captured before any BATCH 0 write)

```
?? LifeSeed_App_Specs/08_LEAD_MASTER_REENGINEERING.md
?? LifeSeed_App_Specs/Lead_v2_1/CURSOR_VERIFICATION_REPORT_2026-09-10.md
?? src/lib/leads/domain/layering-isolation.test.ts
?? src/lib/leads/testing/negative/forbidden-domain-imports.ts
```

Conversation-start git snapshot listed many `M` portal/API/adapter files that are **now committed inside `6e1bc56`**. They are **not** uncommitted. Uncommitted work is the four untracked paths above only. **No reset / discard / force-clean was performed.**

---

## 2. Existing uncommitted work (evaluated, not deleted)

| Path | Classification |
|---|---|
| `LifeSeed_App_Specs/08_LEAD_MASTER_REENGINEERING.md` | Spec/docs copy. Not Phase-0 implementation. Left in tree. |
| `LifeSeed_App_Specs/Lead_v2_1/CURSOR_VERIFICATION_REPORT_2026-09-10.md` | Historical verification report (2026-09-10). Not current HEAD evidence. Left in tree. |
| `src/lib/leads/domain/layering-isolation.test.ts` | Uncommitted LADR-19-style domain isolation test. **Not** in `6e1bc56`. |
| `src/lib/leads/testing/negative/forbidden-domain-imports.ts` | Uncommitted negative-import snippets for layering tests. **Not** in `6e1bc56`. |

These files were **not** staged with this baseline except as documented here.

---

## 3. Feature-flag state (code + `.env.example`)

None of the production-authoritative cutover flags are set to `on` in `.env.example`. Runtime defaults:

| Flag | Where defined | Production default | Non-prod default | Present in `.env.example` | BATCH 0 change |
|---|---|---|---|---|---|
| `LEAD_STATE_MACHINE_ENABLED` | `src/lib/leads/application/feature-flag.ts:5-14` | `off` when `VERCEL_ENV` or `NODE_ENV` is `production` | `shadow` | yes (empty) | **no change** |
| `LEAD_CONVERSION_PORT_ENABLED` | `feature-flag.ts:40-49` | `false` | `true` unless `"off"` | yes (empty) | **no change** |
| `LEAD_CODE_V2_ENABLED` | `src/lib/leads/adapters/prisma-lead-code-generator.ts:21-26` | only exact `"on"` enables v2; otherwise legacy `count+1` | same | **absent** | **no change** |
| `LEAD_CONVERSION_APPROVAL_ENABLED` | **not implemented** | n/a | n/a | **absent** | **no change** |
| `LEAD_HELD_INTAKE_ENABLED` | **not implemented** | n/a | n/a | **absent** | **no change** |
| `LEAD_OUTBOX_ENABLED` | `feature-flag.ts:27-32` | only `"on"` | only `"on"` | not in `.env.example` excerpt | **no change** |
| `LEAD_NOTIFICATION_PORT_ENABLED` | `feature-flag.ts:54-59` | default `in_app_only` | same | yes | **no change** |
| `LEAD_FOLLOWUP_ENABLED` | `feature-flag.ts:68-75` | `false` in production | `true` unless `"off"` | **absent** | **no change** |
| `LEAD_CONFIG_ENABLED` | `src/lib/leads/config/flag.ts:7-13` | `off` in production | `partial` | yes | **no change** |
| `LEAD_HMAC_CRON_ENFORCED` | `.env.example` + `hmac-cron` | documented off/permissive | documented | yes | **no change** |

**Q3 / HeldIntake flags do not exist in code.** Cutover flags were **not** flipped.

---

## 4. Authoritative writers (current)

### 4.1 `Lead.status`

| Writer | Path | Notes |
|---|---|---|
| `PrismaLeadTransitionStore.persistBundleWithClient` | `prisma-transition-store.ts:166-199` | v2 SM path: `tx.lead.update` with `status: input.nextStatus` |
| `applyAuthorizedLeadStatus` | `prisma-lead-repository.ts:282-291` | Comment: “Sole authorised Lead.status writer besides persistBundle.” Direct `prisma.lead.update` |
| Legacy callers of `applyAuthorizedLeadStatus` | `lead-conversion.ts:148,274` · `lead-assignment.ts:54,110` · `src/app/(portals)/leads/actions.ts:142,244,303,448,481` | **Still live.** BATCH 2 must classify; BATCH 5 must **not** retire these |

Auto-transition **intent** (partial): `auto-transitions.ts` uses `applyLeadEvent` (T-21) and `expireLeadV2` (T-30). That does **not** retire legacy writers.

### 4.2 `Lead.convertedDonorId` / `convertedRecipientId` / `convertedAt`

| Writer | Path |
|---|---|
| SM `lead_patch` in `persistBundle` | `prisma-transition-store.ts:183-186` |
| `convert.ts` (ConversionPort path when flag on) | `src/lib/leads/application/convert.ts:98-102` (patch) then persistBundle |
| Legacy `convertLeadToDonorLegacy` / recipient | `lead-conversion.ts` — `prisma.lead.update` compat fields + `applyAuthorizedLeadStatus` |
| Domain SM transitions | `domain/state-machine/transitions.ts` patches `convertedAt` on convert events |
| Backfill reader (not a live writer of Lead columns) | `backfill-lead-conversions.ts` reads the three columns to create `LeadConversion` |

**E-CONVERSION cutover is not in this sequence.** Columns **must not** be retired.

### 4.3 `LeadConversion`

| Writer | Path |
|---|---|
| `tx.leadConversion.create` in persistBundle `conversion_stub` | `prisma-transition-store.ts:486-496` |
| `backfillLeadConversions` | `application/backfill-lead-conversions.ts:64` |
| ConversionPort application | `application/convert.ts` via persistBundle |

`ConversionPort` interface today (`domain/ports/ConversionPort.ts:27-32`): `convertToDonor` · `convertToRecipient` · `isEligibleForDonor` · `isEligibleForRecipient`. **No** `initiate` / `approve` / `reject` / `cancel`. Q3 is **not** implemented.

### 4.4 `Lead.code` / `leadCode`

| Path | Behaviour |
|---|---|
| `allocateLeadCode` | `prisma-lead-code-generator.ts:69-81` — if flag ≠ `"on"`, `prisma.lead.count` + legacy `count+1` |
| `generateLeadCode` (v2) | `$queryRaw` `SELECT next_lead_code(...)` — only when flag `"on"` |
| Legacy helper | `src/lib/leads/lead-code-generator.ts` |

Production default: **legacy `count+1`**. E-LEADCODE not cut over.

---

## 5. HTTP routes (Lead)

### 5.1 Reads / list / detail

| Route | File |
|---|---|
| `GET /api/leads/v2/leads` | `src/app/api/leads/v2/leads/route.ts` — wraps `prismaLeadRepository.list` |
| `GET /api/leads/v2/leads/[id]` | `src/app/api/leads/v2/leads/[id]/route.ts` — wraps `byId` |
| Portal lists | `admin/leads/page.tsx`, `telecaller/leads/page.tsx`, `telecaller/queue/page.tsx` — repository / `loadTelecallerQueue` |
| CSV | `GET /api/leads/export` — `list(actor, { limit: 200 })` |

### 5.2 Transitions

| Route | File |
|---|---|
| `POST .../transitions/[event]` | `src/app/api/leads/v2/leads/[id]/transitions/[event]/route.ts` |
| assign / reassign / claim / archive / unarchive / reactivate | under `src/app/api/leads/v2/leads/[id]/` |
| Legacy server actions | `src/app/(portals)/leads/actions.ts` — still calls `applyAuthorizedLeadStatus` |

### 5.3 Conversion

| Route | File |
|---|---|
| convert donor | `.../convert/donor/route.ts` |
| convert recipient | `.../convert/recipient/route.ts` |
| eligibility | `.../convert/eligibility/route.ts` |

**No** Q3 initiate/approve/reject/cancel/queue routes.

### 5.4 Counselling

| Surface | Status |
|---|---|
| `POST /api/leads/v2/internal/counselling/tick` | Present (`tick/route.ts`) — HMAC/cron; calls `tickCounsellingNoShows` |
| Other counselling v2 HTTP (book/session/outcome) | **No** `src/app/api/**/counselling/**` besides the tick. Booking still in portal actions (`leads/actions.ts`) |

### 5.5 Duplicate / HeldIntake

**No** HTTP routes under `api/**/duplicate*`. Domain entity `DuplicateCase` + mapper exist; runtime review API / HeldIntake **absent**.

### 5.6 Config / DNC / follow-up / other

| Area | Routes |
|---|---|
| Config | `GET/PUT /api/leads/v2/config/[key]`, versions, approve |
| DNC | `/api/leads/v2/dnc`, `/dnc/check`, `/dnc/[id]` |
| Follow-ups | `/api/leads/v2/follow-ups*`, `.../leads/[id]/follow-ups`, internal tick |
| Outbox | `/api/leads/v2/internal/outbox/dispatch` |
| Retention | `/api/leads/v2/internal/retention/purge` **and** `/api/leads/purge-expired` (legacy path now delegates to `tickRetentionPurge`) |
| Intake | `/api/leads/intake/web`, `whatsapp`, `webhook/telecaller` |
| SLA / CRM | `/api/leads/sla/run`, `/api/leads/crm-sync/run` |

---

## 6. RBAC implementation shape

### 6.1 `ROLE_PERMISSIONS` — `src/lib/rbac-permissions.ts`

- Permission type is free-form `string`.
- **`lead.convert.approve` is absent** (repo-wide grep: zero hits under `src/`).
- `lead.convert` is granted to `BANK_SUPER_ADMIN`, `TELECALLER`, `OPS_MANAGER` (and not COUNSELLOR).
- `BANK_MEDICAL_DIRECTOR` (`rbac-permissions.ts:384-406`) has `lead.config.view` and **no** `lead.view` / `lead.list` / `lead.view.any`.
- `COUNSELLOR` has `lead.view` (case-level), not convert-approve.

P0-2 (BATCH 3) is therefore **outstanding** for `lead.convert.approve`. BMD config-only vs `isSiteScopedViewer` is **not** aligned (see §6.2).

### 6.2 `lead-access-scope.ts`

`isSiteScopedViewer` **includes** `BANK_MEDICAL_DIRECTOR` / `MED_DIR` (`lead-access-scope.ts:45-56`) with an in-code comment that 05 §4.4 vs Founder Q4 is deferred to P0-2. That predicate **grants site-scoped case-level list/byId** to BMD — **conflicts with LADR-25 / Q4** until BATCH 3.

Telecaller (incl. `SR_TELECALLER`): assigned-only. Counsellor: booked counselling ownership. Cross-site: `BANK_SUPER_ADMIN` / `SUPER_ADMIN`.

`LeadListFilters.status` is a **single string**, not multi-status OR (`LeadRepository.ts:7`).

### 6.3 Middleware / enforcement entry points

| Entry | Path | Layer |
|---|---|---|
| `requirePermission` | `src/lib/rbac.ts:96-113` | Route/page: session + `permissionGranted` |
| `getSession` | `rbac.ts:58` | Supabase Auth → `User` + roles |
| v2 GET list/detail | permission check **then** repository `list`/`byId` | Route + repository |
| `evaluateLeadAccess` / `leadListScopeWhere` | repository | Ownership/site |

RBAC is **not** exclusively at the route layer for scoped reads, but **Q3 approve permission does not exist** and BMD is still a site-scoped viewer.

---

## 7. `LeadRepository` / P0-1 code on HEAD

`LeadRepository.list(actor, filters)` and `byId(id, ctx?)` **exist** and enforce `evaluateLeadAccess` / `leadListScopeWhere` (`prisma-lead-repository.ts:74-143`). v2 GET wrappers exist.

`create` / `update` **throw** “not implemented in B02” (`:145-155`).

`list` hard-caps `limit` at **200** (`:111`). That cap is why CSV export cannot honour a 5000-row config without a dedicated path.

Guard test `p01-findmany-guard.test.ts` only forbids **application-layer** `prisma.lead.findMany` **outside** `src/lib/leads/adapters/`. It does **not** require actor scoping inside analytics helpers.

---

## 8. CONFLICT-25..30 vs commit `6e1bc56` (mandatory check)

### CONFLICT-25 (HIGH) — analytics scope — **OUTSTANDING**

`src/lib/leads/adapters/prisma-lead-analytics.ts` still issues **unscoped** `prisma.lead.findMany` / `groupBy` / `count`:

- `scanDonorFunnelLeads` `:6-20` — `findMany` by personType/date/status, **no actor**
- `groupLostReasons` `:23-34` — `groupBy`, **no actor**
- `countLeadsWhere` `:37-38` — unscoped `count`
- `groupLeadsBySource` `:41-46` — unscoped `groupBy`
- `listExpiredLeadIds` `:49-55` — `findMany` for jobs
- `listLeadIdsByStatus` `:64-70` — `findMany` for jobs

Consumers:

- `src/app/(portals)/admin/leads/analytics/page.tsx:13,34-54` — `groupLeadsBySource()`, `countLeadsWhere` without actor
- `src/lib/reports/dashboards.ts:11,125-130` — `countLeadsWhere` without actor
- `src/lib/reports/definitions/logistics-donor-funnel.ts:114` — `scanDonorFunnelLeads`

`6e1bc56` **moved** Prisma calls into an adapter file; it did **not** route aggregates through `LeadRepository.list(actor, filters)` or a scoped `aggregate()`.

### CONFLICT-26 (MEDIUM) — CSV cap 5000 / `EXPORT_ROW_CAP_V1` — **OUTSTANDING**

`src/app/api/leads/export/route.ts:24` — `list(actor, { limit: 200 })`.  
Grep for `EXPORT_ROW_CAP` / `EXPORT_ROW_CAP_V1` in `src/`: **no hits**.  
Repository max page size is 200. **Not** 5000, **not** LeadConfig-driven.

### CONFLICT-27 (MEDIUM) — admin funnel multi-status OR + regression test — **OUTSTANDING**

`src/app/(portals)/admin/leads/page.tsx:52-56` still uses **single-status** `countScopedLeads`:

- contacted → `CONTACTED_QUALIFIED` only  
- counselled → `COUNSELLING_BOOKED` only  

Logistics report `logistics-donor-funnel.ts` **does** filter multi-status in memory (`STAGES` arrays) but on an **unscoped** scan (CONFLICT-25). No regression test comparing funnel counts to an explicit rowset was found (`funnel` / `CONFLICT-27` grep in tests: none).

### CONFLICT-28 (MEDIUM) — telecaller KPI SLA-breach / converted-today — **OUTSTANDING**

`src/app/(portals)/telecaller/dashboard/page.tsx:33-37`:

- `breaching` = `countScopedLeads(actor)` with **no SLA-due filter** (label still “SLA due ≤2h”)
- `convertedToday` = `countScopedLeads(actor, { status: CONVERTED })` with **no `from: startOfDay`**

Actor scoping exists; **KPI semantics do not**.

### CONFLICT-29 (LOW) — `@vitest/coverage-v8` — **OUTSTANDING**

`package.json` has `"vitest": "^3.2.4"` and `"test": "vitest run"`. Grep for `coverage-v8` / coverage reporter: **no matches**. No coverage artefact committed.

### CONFLICT-30 (MEDIUM) — HTTP two-actor IDOR across eight roles — **OUTSTANDING**

Only `src/lib/leads/adapters/prisma-lead-repository.idor.test.ts` (unit/mock repository). **No** HTTP-layer suite covering TELECALLER · SR_TELECALLER · COUNSELLOR · OPS_MANAGER · MARKETING_MGR · CRM_ADMIN · BANK_SUPER_ADMIN · BANK_MEDICAL_DIRECTOR.

### P0-1 completeness verdict

`6e1bc56` delivered **scoped portal lists + v2 GET + findMany application-layer guard + lifecycle tick routes**.  
**CONFLICT-25, 26, 27, 28 remain outstanding.** P0-1 / BATCH 1 is **not complete**.

---

## 9. Remaining `prisma.lead.findMany` / `findUnique` / `$queryRaw` (classification)

### `findMany`

| File | Classification |
|---|---|
| `prisma-lead-repository.ts:166` | Adapter; `loadTelecallerQueue` — **scoped** via `leadListScopeWhere` |
| `prisma-lead-repository.ts:127` | Adapter; `list()` — **scoped** |
| `prisma-lead-analytics.ts:7,50,65` | Adapter but **unscoped** (CONFLICT-25 / job scans) |

Guard test: zero `prisma.lead.findMany` outside `adapters/`. **Satisfied for that grep; not equivalent to scoped analytics.**

### `findUnique` (production paths outside adapter, still live)

| File:lines | Classification |
|---|---|
| `prisma-lead-repository.ts:239,253` | Adapter; after `byId` scope check (`requireReadableThenLoad`) |
| `lead-conversion.ts:67,229` | Legacy conversion — **unscoped byId** (production path when conversion-port off) |
| `lead-assignment.ts:47` | Assignment — **unscoped** status read |
| `create-lead.ts:125` | Intake refresh after create |
| `application/intake.ts:70` | `findUniqueOrThrow` after persistBundle |
| `leads/actions.ts:151,436,475` | Portal actions — **unscoped** before status writes |

### `$queryRaw`

| File | Classification |
|---|---|
| `src/app/api/health/route.ts` | `SELECT 1` — not Lead |
| `prisma-outbox.ts` | Outbox poll — not Lead table listing |
| `prisma-lead-code-generator.ts:60` | `next_lead_code` allocator — adapter |

No `$queryRaw` Lead **list** bypass found outside adapters.

---

## 10. BATCH 2 / 3 / 4 preview (not implemented this batch)

| Item | HEAD state |
|---|---|
| T-21 / T-30 internal HMAC routes | **Present** (`internal/counselling/tick`, `internal/retention/purge`) calling SM helpers |
| Direct `Lead.status` writers | **Still present** (actions, assignment, conversion) — expected until E-SM |
| `lead.convert.approve` | **Missing** |
| BMD removed from `isSiteScopedViewer` | **Not done** |
| Q3 16-field `LeadConversionApproval` | **Missing** |
| HeldIntake / STOP-3 matching | **Missing** |
| Counselling v2 HTTP (P0-6) | **Incomplete** (tick only) |

---

## 11. Tests (BATCH 0)

| Item | Result |
|---|---|
| Command | **skip** |
| Reason | BATCH 0 is inspection + baseline report only. No implementation change. Founder instruction: do not proceed to BATCH 1. Suite run deferred until BATCH 1 authorization. |

Existing tests relevant to partial P0-1 (not re-run here): `p01-findmany-guard.test.ts`, `lead-access-scope.list.test.ts`, `prisma-lead-repository.idor.test.ts`, `auto-transitions.test.ts`. Untracked: `layering-isolation.test.ts`.

---

## 12. Traceability

BATCH 0 implements **v2.1 §3 / FINAL prompt Part D BATCH 0** (baseline capture). No STOP-3 / Q3 / LADR code changes.

---

## 13. STOP conditions encountered

**none** for BATCH 0 (read-only inspection). Locked conflicts that **BATCH 1+ must not silently resolve**:

- BMD still in `isSiteScopedViewer` vs LADR-25 (BATCH 3).
- Analytics unscoped vs CONFLICT-25 (BATCH 1).
- `ConversionPort` lacks Q3 methods vs Q3 v1.3 (BATCH 4 — implement behind flag; do not change convert semantics of E-CONVERSION).

---

## 14. Explicit statements required by the dispatch note

- HEAD is **`6e1bc56`**, not `0ebbe5d`.
- `6e1bc56` is **partial, unverified P0-1**.
- CONFLICT-25 **not resolved**.
- CONFLICT-26 **not resolved**.
- CONFLICT-27 **not resolved**.
- CONFLICT-28 **not resolved**.
- P0-1 **must not** be marked complete until those four are confirmed in BATCH 1.
- STOP-4 remains **DEFERRED — EVIDENCE REQUIRED**.
- E-CONVERSION remains **BLOCKED / not attempted**.
- Production readiness is **not** established.

---

*End of BATCH 0 baseline.*
