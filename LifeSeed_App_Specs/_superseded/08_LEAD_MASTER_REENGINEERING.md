# 08 · Lead Management Re-engineering v2.0

**Document type:** Master re-engineering source of truth · brownfield refactor of existing Lead Management module
**Supersedes:** decisions in `08_lead_management_telecaller_counselling.md` (which becomes the v1 implementation reference)
**Scope:** Re-architect the built Lead module into a bounded, port-driven domain that (a) preserves current LifeSeed HIS behaviour, (b) enables reuse as a standalone Lead/CRM platform
**Status:** ARCHITECTURE DRAFT · awaiting Founder + Engineering Lead review
**Version:** 2.0 · **Date:** 2026-09-04

**Core re-engineering tenet (non-negotiable):** This is a **refactor**, not a rewrite. Every change must (a) preserve existing donor/recipient conversion, (b) preserve existing lead data, (c) use additive-only migrations first, (d) ship behind feature flags where behavioural change is introduced.

---

## PHASE 1 · CURRENT STATE AUDIT

### 1.1 Source inventory (what actually exists in the repo)

**Domain library — `src/lib/leads/`:**
| File | Purpose | Status |
|---|---|---|
| `create-lead.ts` | Central intake entry point (DNC check → score → assign → SLA → CRM enqueue) | [IMPLEMENTED] |
| `lead-code-generator.ts` | Human-readable code `LED-{CITY}-{YYYYMMDD}-{XXXX}` | [IMPLEMENTED] but [REQUIRES CHANGE] — race-prone |
| `lead-scoring.ts` | v1 rules-based score + tier | [IMPLEMENTED] but [REQUIRES CHANGE] — hard-coded weights |
| `lead-assignment.ts` | Round-robin among on-shift TELECALLER users | [IMPLEMENTED] but [REQUIRES CHANGE] — no site/shift/skill/language logic |
| `lead-conversion.ts` | `convertLeadToDonor()` calls `createDonorIntake` | [IMPLEMENTED] but [REQUIRES CHANGE] — dual conversion IDs, direct HIS coupling |
| `rate-limit.ts` | 10/IP/hour on web intake | [IMPLEMENTED] |

**API surface — `src/app/api/leads/`:**
| Route | Purpose | Status |
|---|---|---|
| `POST /intake/web` | Rate-limited web form | [IMPLEMENTED] |
| `POST /intake/whatsapp` | Signature-verified stub (`stub_ok_*`) | [PARTIALLY IMPLEMENTED] — [REQUIRES CHANGE]: real webhook signature |
| `POST /intake/webhook/telecaller` | Manual phone-inbound | [IMPLEMENTED] |
| `POST /sla/run` | SLA cron (X-Cron-Secret) | [IMPLEMENTED] |
| `POST /crm-sync/run` | CRM sync cron | [PARTIALLY IMPLEMENTED] — stub adapters |
| `POST /purge-expired` | Retention purge cron | [IMPLEMENTED] |
| `GET /export?from=&to=&status=` | CSV export | [IMPLEMENTED] but [REQUIRES CHANGE] — no pagination/streaming |

**UI surfaces:**
| Portal | Pages | Status |
|---|---|---|
| Admin `/admin/leads/*` | list · analytics · DNC (bulk actions) | [PARTIALLY IMPLEMENTED] — detail page renders raw JSON |
| Telecaller `/telecaller/*` | dashboard · queue · leads list · lead detail (`lead-call-panel.tsx`) · new lead · book counselling · DNC | [IMPLEMENTED] but [REQUIRES CHANGE] — IDOR + coupling |
| Counsellor `/counsellor/*` | dashboard · session detail | [IMPLEMENTED] but [REQUIRES CHANGE] — mutable single-booking model |

**Prisma models (per spec §9):**
- `Lead` (14 status enum values, tier, score, scoreBreakdown JSON, consent, retention)
- `CallDisposition` (per-call log; QA score, recording fields exist but [UNUSED])
- `CounsellingBooking` (single active per lead; overwrites history)
- `SlaSchedule` (polymorphic entityId; supports LEAD_RESPONSE, LEAD_QUALIFICATION, COUNSELLING_BOOKING, COUNSELLING_REMINDER, DONOR_SCREENING, DONOR_CONSENT, EMBRYOLOGY_OUTCOME)
- `CrmSyncQueue` (Zoho/Salesforce push queue; adapters are stubs)
- `LeadDoNotCallList` (phone/email registry)
- Additive FKs: `Donor.sourceLeadId`, `Recipient.sourceLeadId`

**Shared infrastructure reused:**
- `src/lib/sla/engine.ts` — generalized from embryology outcome-nudge (backward-compat shim in place)
- `src/lib/crm/adapters/{zoho,salesforce}-adapter.ts` — stubs with 500 ms delay + retry ladder scaffolding
- Existing audit hash-chain (module 02) — but Lead module [REQUIRES CHANGE] to consistently write audit entries

### 1.2 Status legend applied end-to-end

| Capability | Status |
|---|---|
| Lead intake (5 channels) | [IMPLEMENTED] |
| Lead master + scoring | [IMPLEMENTED] |
| Tier + SLA | [IMPLEMENTED] |
| Round-robin assignment | [IMPLEMENTED] · [REQUIRES CHANGE] |
| Formal state machine | [MISSING] |
| Generic activity log | [MISSING] — only `CallDisposition` exists |
| Follow-up entity | [MISSING] — approximated via SLA schedules |
| Counselling history (multiple sessions) | [MISSING] — single mutable booking |
| Duplicate detection | [MISSING] |
| DNC service | [IMPLEMENTED] — but no bulk check API for outbound; not consistently invoked pre-communication |
| Campaign attribution (UTM/source metadata) | [MISSING] beyond enum `source` |
| Conversion Port (typed boundary) | [MISSING] — direct `createDonorIntake` call |
| CRM sync (real adapters) | [PLANNED] |
| Notification port | [MISSING] — email adapter Resend used inline |
| RBAC + ownership | [PARTIALLY IMPLEMENTED] — role gates present, ownership checks missing on lead detail (IDOR) |
| Audit consistency | [PARTIALLY IMPLEMENTED] |
| Config store (score weights, SLA thresholds, retention) | [MISSING] — all in code |
| Automated tests | [MISSING] |
| Pagination / streaming | [PARTIALLY IMPLEMENTED] — list ok, export not streamed |

### 1.3 Known defects surfaced during Path C testing (from spec §14) + audit additions

| # | Defect | Category |
|---|---|---|
| D-01 | `consentVersion` required but silent 400 on omission | [REQUIRES CHANGE] validation |
| D-02 | Admin lead detail = raw JSON | [REQUIRES CHANGE] UI |
| D-03 | Aadhaar validation persists error (`mode: "onSubmit"`) | [REQUIRES CHANGE] UI |
| D-04 | Client component imported Prisma lib | fixed but pattern risk | [REQUIRES CHANGE] |
| D-05 | Tier stays COLD after CONVERTED — misleading UX | [REQUIRES CHANGE] — column rename to "Tier at capture" + Outcome column |
| D-06 | Telecaller can deep-link into any lead ID (IDOR) | [DEFECTIVE] security |
| D-07 | `LED-{CITY}-{DATE}-{XXXX}` race on concurrent inserts | [DEFECTIVE] concurrency |
| D-08 | Duplicate phone can create parallel leads | [DEFECTIVE] |
| D-09 | Counselling booking overwrites prior history | [DEFECTIVE] audit |
| D-10 | Dual conversion IDs (`Lead.convertedDonorId` and `Donor.sourceLeadId`) can diverge | [DEFECTIVE] integrity |
| D-11 | Cron endpoints trust X-Cron-Secret only (no timestamp / replay protection) | [DEFECTIVE] |
| D-12 | WhatsApp intake stub accepts unverified payloads | [DEFECTIVE] |
| D-13 | Spec drift — 08_...md diverges from code | [REQUIRES CHANGE] |
| D-14 | Unused `SlaEntityType` enum values in DB | [REQUIRES CHANGE] |
| D-15 | Unused QA/recording fields on `CallDisposition` | [REQUIRES CHANGE] |
| D-16 | Archived leads represented as status=LOST — conflates outcome with archive | [REQUIRES CHANGE] |
| D-17 | Counselling UI/schema mismatch (spec says history, DB is single record) | [REQUIRES CHANGE] |
| D-18 | Direct Prisma calls from server actions coupling UI to schema | [REQUIRES CHANGE] |

### 1.4 What must be RETAINED (do not touch)

- `Lead` code format `LED-...` (human-visible everywhere)
- 14 status enum values (as label set — semantics migrate to state machine)
- Tier concept HOT/WARM/COLD/ARCHIVED at capture-time
- Score weight ranges (v1 baseline → move to config)
- SLA engine core (already generalized, backward-compat shim works)
- DNC list + retention purge cron behaviour
- Backward-compatible additive FKs (`Donor.sourceLeadId`, `Recipient.sourceLeadId`)
- Existing donor and recipient conversion outcomes
- Rate limiting on web intake
- CRM sync queue table + retry ladder scaffolding
- 5 new roles (TELECALLER, COUNSELLOR, OPS_MANAGER, MARKETING_MANAGER, CRM_ADMIN)

---

## PHASE 2 · TARGET ARCHITECTURE

### 2.1 Bounded domain view

```
┌────────────────────────────────────────────────────────────────────┐
│                    ART Bank HIS (host application)                 │
│                                                                    │
│   ┌───────────────────────────────────────────────────────────┐   │
│   │       LEAD MANAGEMENT DOMAIN (this module)                │   │
│   │                                                            │   │
│   │   Application services (pure TS, framework-agnostic):      │   │
│   │   · IntakeService · QualificationService                   │   │
│   │   · AssignmentService · TelecallingService                 │   │
│   │   · ActivityService · FollowUpService                      │   │
│   │   · CounsellingService · DncService                        │   │
│   │   · ScoringService · SlaService (wraps SlaPort)            │   │
│   │   · ConversionService (wraps ConversionPort)               │   │
│   │   · DuplicateService · MergeService                        │   │
│   │   · CampaignService · AttributionService                   │   │
│   │   · AnalyticsService · CrmSyncService                      │   │
│   │                                                            │   │
│   │   Domain entities (Prisma models):                         │   │
│   │   Lead · LeadActivity · LeadStatusHistory · LeadScore ·    │   │
│   │   LeadAssignment · LeadFollowUp · CallRecord ·             │   │
│   │   CounsellingBooking · CounsellingSession · Campaign ·     │   │
│   │   LeadAttribution · LeadDoNotCall · LeadMerge ·            │   │
│   │   LeadConversion · SlaSchedule · CrmSyncQueue              │   │
│   │                                                            │   │
│   │   Ports (interfaces the host implements):                  │   │
│   │   LeadRepository · AssignmentDirectory · ConversionPort    │   │
│   │   SlaPort · AuditPort · CrmPort · NotificationPort         │   │
│   │   ConfigPort · IdentityPort · CampaignPort · Clock ·       │   │
│   │   IdGenerator                                              │   │
│   └───────────────────────────────────────────────────────────┘   │
│           │                    │                    │              │
│           ▼                    ▼                    ▼              │
│   ┌──────────────┐  ┌───────────────┐  ┌────────────────┐        │
│   │ Donor        │  │ Recipient     │  │ MRD (11) ·     │        │
│   │ Pathway (01) │  │ Pathway       │  │ IAM (12) ·     │        │
│   │              │  │               │  │ Reports (10)   │        │
│   │ implements   │  │ implements    │  │                │        │
│   │ Conversion   │  │ Conversion    │  │                │        │
│   │ Port         │  │ Port          │  │                │        │
│   └──────────────┘  └───────────────┘  └────────────────┘        │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Port contracts (summary — full signatures in §PHASE 6)

| Port | Owner (host implements) | Purpose |
|---|---|---|
| `LeadRepository` | HIS via Prisma | CRUD on Lead + related entities |
| `AssignmentDirectory` | HIS (IAM module 12) | List telecallers with site/shift/skill/lang/availability |
| `ConversionPort` | HIS (Donor + Recipient modules) | `convertToDonor(leadId, actor)`, `convertToRecipient(leadId, actor)` |
| `SlaPort` | HIS shared SLA engine | Schedule, warn, breach, complete |
| `AuditPort` | HIS audit chain (module 02) | Append audit entries |
| `CrmPort` | Adapter registry | `enqueue`, `sync`, `status` |
| `NotificationPort` | HIS notifications | send(channel, template, recipient, data) |
| `ConfigPort` | HIS config store | Read scored config with versioning |
| `IdentityPort` | HIS Auth | Resolve session user + permissions |
| `CampaignPort` | HIS campaigns table | Resolve campaign + attribution |
| `Clock` | Injected | Testable now() |
| `IdGenerator` | Injected | Testable IDs |

### 2.3 Directory structure (target)

```
src/lib/leads/
├── domain/
│   ├── entities/          Lead.ts, LeadActivity.ts, LeadFollowUp.ts, …
│   ├── enums/             LeadStatus, LeadTier, ActivityType, …
│   ├── ports/             LeadRepository.ts, ConversionPort.ts, …
│   ├── state-machine/     transitions.ts, guards.ts, invariants.ts
│   ├── scoring/           v1-rules.ts, config-schema.ts
│   ├── services/          IntakeService.ts, AssignmentService.ts, …
│   └── errors.ts          Typed domain errors
├── adapters/
│   ├── prisma-lead-repository.ts
│   ├── prisma-audit.ts
│   ├── his-conversion-adapter.ts
│   ├── zoho-adapter.ts
│   ├── salesforce-adapter.ts
│   ├── resend-notification-adapter.ts
│   └── clock-system.ts
├── application/           High-level orchestrations used by API/UI
│   ├── intake.ts
│   ├── qualify.ts
│   ├── assign.ts
│   ├── follow-up.ts
│   ├── convert.ts
│   └── merge.ts
├── config/                Config keys + defaults
└── testing/
    ├── fakes/             In-memory repository, fake clock, fake ports
    └── fixtures/
```

**Rule:** Nothing under `domain/` may import Prisma, Next.js, or React. Nothing under `application/` may import UI. Adapters live at the edge.

---

## PHASE 3 · GAP ANALYSIS

| # | Capability | Current | Target | Gap severity | Fix effort |
|---|---|---|---|---|---|
| G-01 | Formal state machine | Scattered mutations | Typed transitions with guards + audit | Critical | M |
| G-02 | Generic activity log | Only `CallDisposition` | `LeadActivity` + 13 types | Critical | S |
| G-03 | Follow-up entity | Approximated by SLA | First-class `LeadFollowUp` | High | M |
| G-04 | Counselling history | Single mutable record | `CounsellingBooking` + `CounsellingSession` history | High | M |
| G-05 | Duplicate detection | None | Match rules + review queue + merge audit | High | M |
| G-06 | Campaign attribution | Enum only | `Campaign` + `LeadAttribution` (UTM + creative + landing) | High | M |
| G-07 | Config store | Hard-coded weights + SLA + retention | Versioned `LeadConfig` + audit | High | M |
| G-08 | Conversion Port | Direct Prisma call | Typed port + transaction + double-convert guard | Critical | M |
| G-09 | Race-safe lead code | Retry loop with unique index collision | Postgres sequence per city-day + uniqueness constraint | Critical | S |
| G-10 | IDOR on lead detail | Missing ownership check | Row-level authz via repository + audit on view | Critical | S |
| G-11 | Assignment logic | Round-robin only | Site + shift + skill + language + workload directory | Medium | M |
| G-12 | Notification port | Inline Resend | `NotificationPort` + provider adapters | Medium | M |
| G-13 | DNC pre-check | Only at intake | Enforced across all outbound channels via port | Critical | S |
| G-14 | Cron endpoint auth | Static shared secret | HMAC + timestamp + replay window + rotated keys | High | S |
| G-15 | WhatsApp signature | Stubbed | Real Meta signature verification | High | S |
| G-16 | Audit consistency | Partial | Every material action via `AuditPort` | High | M |
| G-17 | Automated tests | None | Unit (domain) 90%, integration 80%, contract tests for ports | Critical | L |
| G-18 | Pagination | List ok, export not | Cursor pagination + streaming CSV | Medium | S |
| G-19 | Unused fields | Retained clutter | Audit + retire QA/recording fields | Low | S |
| G-20 | Archive vs LOST | Overloaded | Introduce `LeadArchiveReason` + separate archive-scoped `LeadStatus` | Medium | S |
| G-21 | UI/schema mismatch | Counselling drift | Rebuild counsellor UI on new booking+session models | Medium | M |
| G-22 | Direct Prisma in server actions | Coupled | Actions delegate to `application/` services | Critical | M |
| G-23 | Tier semantics | "Tier stays COLD after CONVERTED" confusing | Retain capture-time tier + add current outcome/status columns | Low | S |

---

## PHASE 4 · DATA MODEL CHANGES

Migration principle: **additive-first, then deprecate**. No columns renamed/dropped in phase-1 migrations. Deprecations happen only after two production releases with the new column populated in parallel.

### 4.1 New entities (net-new, no legacy impact)

| Entity | Purpose |
|---|---|
| `LeadActivity` | Generic activity log (CALL, WHATSAPP, SMS, EMAIL, NOTE, FOLLOW_UP, COUNSELLING, APPOINTMENT, STATUS_CHANGE, ASSIGNMENT, ESCALATION, CONVERSION, SYSTEM) |
| `LeadStatusHistory` | Immutable state transition log — every status change appends a row |
| `LeadScore` | Immutable score snapshot per event that triggers rescoring (`intake`, `manual_rescore`, `config_version_change`) |
| `LeadAssignment` | Immutable assignment history (who assigned lead to whom, when, why) — supersedes single mutable `Lead.assignedTelecallerId` (kept for read compat) |
| `LeadFollowUp` | First-class follow-up task (lead, owner, type, dueAt, priority, reason, status, outcome, nextFollowUpId) |
| `CallRecord` | Renamed conceptual model for what `CallDisposition` becomes; retained field-level for compat but re-exposed via activity API |
| `CounsellingSession` | New — every session appended (in addition to `CounsellingBooking`) |
| `Campaign` | Marketing campaign metadata (source, medium, budget, dates, owner) |
| `LeadAttribution` | Per-lead UTM + creative + landing page + referral partner (1:1 with Lead but nullable) |
| `LeadMerge` | Merge decision + audit (winnerLeadId, mergedLeadId, decidedByUserId, reason) |
| `LeadConversion` | First-class conversion record (leadId, targetType, targetId, decidedByUserId, occurredAt) — replaces dual FK pattern (Lead.convertedDonorId + Donor.sourceLeadId remain as denormalised read-side FKs) |
| `LeadDoNotCall` | Rename of `LeadDoNotCallList` (kept as view during migration); add source/expiry/removal fields |
| `LeadConfig` | Versioned key-value config (SCORE_WEIGHTS_V1, SLA_MATRIX_V1, RETENTION_POLICY_V1, ASSIGNMENT_RULES_V1) |

### 4.2 Additive columns on existing `Lead`

| Column | Purpose |
|---|---|
| `archiveReason` (enum, nullable) | Separates "archived" from "LOST outcome" |
| `activeAssignmentId` (FK, nullable) | Convenience pointer to latest LeadAssignment |
| `latestScoreId` (FK, nullable) | Convenience pointer to latest LeadScore |
| `campaignId` (FK, nullable) | Attribution to Campaign |
| `mergedIntoLeadId` (FK, nullable) | Points to winner if merged |
| `duplicateOfLeadId` (FK, nullable) | Weak marker for review queue |

**Not renamed** in this migration: `Lead.convertedDonorId`, `Lead.convertedRecipientId`, `Lead.status`, `Lead.tier`, `Lead.scoreBreakdown`. These stay as denormalised convenience columns; canonical data lives in `LeadConversion`, `LeadStatusHistory`, `LeadScore`.

### 4.3 Field-level changes on existing tables

| Table | Change | Type |
|---|---|---|
| `CallDisposition` | Deprecate `qaScore`, `recordingUrl`, `recordingDurationSec` (retain columns, stop writing new values) — retire in v2.1 | Deprecate |
| `CounsellingBooking` | Add `rescheduledFromBookingId` (FK, nullable) + `cancelledReason` (text, nullable) | Additive |
| `SlaSchedule` | Remove unused `SlaEntityType` enum entries in v2.1 (audit first) | Deprecate |
| `LeadDoNotCallList` | Add `source`, `effectiveFrom`, `effectiveUntil`, `removalAuthorityUserId` | Additive |
| `CrmSyncQueue` | Add `payloadVersion`, `lastAttemptError`, `externalId` | Additive |

### 4.4 Indexes + constraints

- `LeadActivity` → composite index `(leadId, occurredAt DESC)` for timeline
- `LeadStatusHistory` → `(leadId, occurredAt)` unique-guard via constraint
- `LeadFollowUp` → partial index on `(status IN ('OPEN','DUE','OVERDUE'), dueAt)` for queue
- `LeadDoNotCall` → unique index on `(channel, normalisedValue)` for reliable lookup
- `Lead` → **replace** race-prone code generation with Postgres sequence:
  `CREATE SEQUENCE lead_code_seq_{cityCode}_{yyyymmdd}` (created lazily via advisory lock) — full details in §PHASE 9 Migration Plan
- `LeadConversion` → unique constraint `(leadId)` — prevents double conversion
- `LeadMerge` → unique constraint `(mergedLeadId)` — a merged lead can only be merged once

### 4.5 Retention alignment

- `LeadConfig.RETENTION_POLICY_V1` becomes the source of truth
- Purge cron reads config; existing 1-year default preserved
- Retention record extended: for PII-redacted leads, retain `redactedAt`, `redactedReason`, `residualMetadata` (JSON) for analytics — no PII

---

## PHASE 5 · STATE MACHINE

### 5.1 State set (retained + reclassified)

| State | Kind | Terminal? |
|---|---|---|
| NEW | Initial | No |
| ASSIGNED | Working | No |
| CONTACTED_QUALIFIED | Working | No |
| CONTACTED_NOT_INTERESTED | Interim (auto → LOST) | No |
| CONTACTED_CALLBACK_REQUESTED | Working (with followupAt) | No |
| NOT_REACHABLE | Working | No |
| WRONG_NUMBER | Interim (auto → LOST) | No |
| DO_NOT_CALL | Interim (auto → LOST + DNC append) | No |
| COUNSELLING_BOOKED | Working | No |
| COUNSELLING_ATTENDED | Working | No |
| COUNSELLING_NO_SHOW | Working (auto-recycle up to 3, then LOST) | No |
| CONVERTED | Terminal (positive) | Yes |
| LOST | Terminal (negative) | Yes |
| EXPIRED_AUTO_PURGED | Terminal (data-retention) | Yes |
| **ARCHIVED** (new) | Non-terminal but out of active queue | Toggleable |

### 5.2 Transition table (illustrative — full matrix in doc `05_LEAD_STATE_MACHINE`)

| From | Event | Guard | To | Actor | Side effects |
|---|---|---|---|---|---|
| NEW | `assign` | on-shift telecaller exists | ASSIGNED | System | Append LeadAssignment · schedule LEAD_RESPONSE SLA |
| ASSIGNED | `disposition:qualified` | actor is owner or supervisor | CONTACTED_QUALIFIED | Telecaller | Append LeadActivity CALL · complete LEAD_RESPONSE SLA |
| ASSIGNED | `disposition:not_interested` | owner | CONTACTED_NOT_INTERESTED → LOST | Telecaller | Auto-progress to LOST after 24h if no re-engagement |
| ASSIGNED | `disposition:callback` | owner | CONTACTED_CALLBACK_REQUESTED | Telecaller | Create LeadFollowUp of type CALLBACK |
| ASSIGNED | `disposition:not_reachable` | owner | NOT_REACHABLE | Telecaller | Increment attemptCount · re-queue per SLA |
| ASSIGNED | `disposition:wrong_number` | owner | WRONG_NUMBER → LOST | Telecaller | Auto-LOST + DNC prompt |
| ASSIGNED | `disposition:do_not_call` | owner | DO_NOT_CALL → LOST | Telecaller | Append LeadDoNotCall entry |
| CONTACTED_QUALIFIED | `book_counselling` | recipient lead, counsellor available | COUNSELLING_BOOKED | Telecaller/Counsellor | Create CounsellingBooking · schedule reminders |
| CONTACTED_QUALIFIED | `convert_donor` | donor lead, all fields present, DNC clean | CONVERTED | Telecaller/Supervisor | Call ConversionPort.convertToDonor |
| COUNSELLING_BOOKED | `session_attended` | booking exists | COUNSELLING_ATTENDED | Counsellor | Append CounsellingSession(attended) |
| COUNSELLING_BOOKED | `session_no_show` | booking past | COUNSELLING_NO_SHOW | System | Append CounsellingSession(no_show) · attemptCount++; if ≥3 → LOST |
| COUNSELLING_ATTENDED | `convert_recipient` | recommendation captured | CONVERTED | Counsellor/Supervisor | Call ConversionPort.convertToRecipient |
| Any non-terminal | `expire_by_retention` | retentionExpiresAt < now | EXPIRED_AUTO_PURGED | Cron | Redact PII |
| Any non-terminal (working) | `archive` | supervisor | ARCHIVED | Supervisor | Reversible via `unarchive` |
| ARCHIVED | `unarchive` | supervisor | previous non-terminal state | Supervisor | Restore |
| CONVERTED | (none) | — | — | — | Terminal |
| LOST | `reactivate` | supervisor + within 90 days + new context | ASSIGNED | Supervisor | Fresh SLA · audit note |

### 5.3 Guards & invariants

- No transition may write `Lead.status` outside the state machine module
- Every transition writes exactly one `LeadStatusHistory` row + one `LeadActivity(STATUS_CHANGE)` row
- Terminal states reject all further transitions except `reactivate` (LOST only)
- Conversion transitions must be atomic with the `LeadConversion` row (single DB transaction)

---

## PHASE 6 · DOMAIN / PORT ARCHITECTURE

### 6.1 Port signatures (concise)

```
interface LeadRepository {
  create(input: CreateLeadInput, ctx: Ctx): Promise<Lead>
  byId(id: string, ctx: Ctx): Promise<Lead | null>
  byCode(code: string, ctx: Ctx): Promise<Lead | null>
  search(query: LeadQuery, ctx: Ctx): Promise<Paginated<Lead>>
  update(id: string, patch: LeadPatch, ctx: Ctx): Promise<Lead>
  appendActivity(input: NewActivity, ctx: Ctx): Promise<LeadActivity>
  appendStatusHistory(input: NewStatusHistory, ctx: Ctx): Promise<LeadStatusHistory>
  appendScore(input: NewScore, ctx: Ctx): Promise<LeadScore>
  appendAssignment(input: NewAssignment, ctx: Ctx): Promise<LeadAssignment>
  createFollowUp(input: NewFollowUp, ctx: Ctx): Promise<LeadFollowUp>
  updateFollowUp(id: string, patch: FollowUpPatch, ctx: Ctx): Promise<LeadFollowUp>
  findDuplicates(candidate: DuplicateCandidate, ctx: Ctx): Promise<Lead[]>
  applyMerge(input: MergeInput, ctx: Ctx): Promise<LeadMerge>
  recordConversion(input: NewConversion, ctx: Ctx): Promise<LeadConversion>
}

interface AssignmentDirectory {
  listCandidates(criteria: {
    siteId?: string; shiftAt?: Date; skills?: string[]; languages?: string[];
    maxOpenLeads?: number;
  }): Promise<TelecallerAvailability[]>
}

interface ConversionPort {
  convertToDonor(input: DonorConversionInput, ctx: Ctx): Promise<{ donorId: string; donorCode: string }>
  convertToRecipient(input: RecipientConversionInput, ctx: Ctx): Promise<{ recipientId: string; recipientCode: string }>
  isEligibleForDonor(leadId: string, ctx: Ctx): Promise<EligibilityResult>
  isEligibleForRecipient(leadId: string, ctx: Ctx): Promise<EligibilityResult>
}

interface SlaPort {
  schedule(input: SlaScheduleInput): Promise<SlaSchedule>
  warn(id: string, atPct: number): Promise<void>
  breach(id: string): Promise<void>
  complete(id: string, reason: string): Promise<void>
  cancel(id: string, reason: string): Promise<void>
}

interface AuditPort {
  append(entry: AuditEntry): Promise<void>
  chainHead(): Promise<string>
}

interface CrmPort {
  enqueue(input: CrmSyncInput): Promise<CrmSyncQueue>
  syncNext(batchSize?: number): Promise<CrmSyncResult[]>
  status(externalId: string): Promise<CrmSyncStatus>
}

interface NotificationPort {
  send(input: {
    channel: 'in_app' | 'email' | 'sms' | 'whatsapp';
    templateId: string;
    recipient: RecipientRef;
    data: Record<string, unknown>;
    respectDnc?: boolean;
  }): Promise<{ providerId: string }>
}

interface ConfigPort {
  read<T>(key: ConfigKey, version?: string): Promise<T>
  currentVersion(key: ConfigKey): Promise<string>
  history(key: ConfigKey): Promise<ConfigVersion[]>
}

interface IdentityPort {
  currentUser(): Promise<User>
  hasPermission(perm: Permission, scope?: ScopeRef): Promise<boolean>
  ownershipCheck(leadId: string): Promise<boolean>
}

interface CampaignPort {
  resolve(source: string, campaignRef?: string, utm?: Utm): Promise<CampaignResolution>
}

interface Clock { now(): Date }
interface IdGenerator { newId(kind: 'lead'|'activity'|'followup'|...): string }
```

### 6.2 Application services (thin orchestrators)

Each service composes ports + domain rules. Examples:

```
IntakeService.intake(input, ctx):
  1. resolve campaign via CampaignPort
  2. check DNC via LeadRepository.findDuplicates + DNC lookup
  3. score via ScoringService (reads ConfigPort SCORE_WEIGHTS_V1)
  4. persist via LeadRepository.create (in a transaction with LeadScore + LeadActivity + LeadAttribution)
  5. assign via AssignmentService (uses AssignmentDirectory)
  6. schedule SLA via SlaPort
  7. enqueue CRM via CrmPort
  8. audit via AuditPort
  9. return { leadId, leadCode, tier, message }

QualificationService.disposition(input, ctx):
  1. ownership check via IdentityPort
  2. load lead + transition via state machine
  3. append LeadActivity(CALL)
  4. append LeadStatusHistory
  5. complete/schedule follow-up SLA
  6. audit
  7. return next-view
```

### 6.3 State machine module (pure)

```
domain/state-machine/transitions.ts exports:
  transition(current: Lead, event: LeadEvent, ctx: TransitionCtx): 
    TransitionResult

Where TransitionResult = { 
  nextStatus, 
  writes: DomainWrite[], // typed side-effects to apply in caller's transaction
  notifications: NotificationSpec[],
  auditEntries: AuditEntry[]
}
```

State machine returns intents; adapters apply them. Testable without any DB.

---

## PHASE 7 · UI/UX ARCHITECTURE

### 7.1 18 surfaces (as specified)

| # | Surface | Users | Key components |
|---|---|---|---|
| 1 | Lead Command Centre | OPS + MARKETING + SUPER | KPI grid, live SLA breach ticker, source funnel, telecaller heatmap |
| 2 | Lead Queue | Telecaller, Ops | Priority sort, filters (tier/status/site/lang), quick disposition inline |
| 3 | Lead 360 | Owner + Supervisor | Timeline of activities, contact info, score panel, attribution card, follow-up list, counselling history, conversion action |
| 4 | New Lead | Anyone with intake permission | Multi-channel form (web/phone/walk-in), consent capture, DNC check on save |
| 5 | Telecaller Workspace | Telecaller | Combined my-queue + call panel + follow-up dock + KPIs |
| 6 | Follow-up Queue | Owner + Supervisor | Due today / overdue / next 7 days · complete inline |
| 7 | Counsellor Workspace | Counsellor | Today's sessions + calendar + notes editor |
| 8 | Counselling Calendar | Counsellor + Ops | Week/month view, slot availability, rebooking |
| 9 | Assignment Centre | Ops | Round-robin + skill-based + manual override + workload balancer |
| 10 | DNC | Ops | Search, add, export, bulk remove (with authority note) |
| 11 | Duplicate Review | Ops | Match queue, side-by-side compare, merge action |
| 12 | Conversion Centre | Supervisor + Telecaller | List of qualified leads with convert action + eligibility gate |
| 13 | Campaign Manager | Marketing | Campaign CRUD, active spend, attribution reports |
| 14 | Analytics | Marketing + Founder | Funnel (per source/tier/site), CAC, cohort |
| 15 | SLA Monitor | Ops + Super | Live breaches, at-risk, historical breach rate |
| 16 | CRM Sync Monitor | CRM Admin | Pending queue, failures, retry, external IDs |
| 17 | Configuration | Super + Marketing (scored) | Score weights editor, SLA matrix, retention policy, assignment rules — with version + approval |
| 18 | Audit | Super + Compliance | Filterable log per lead + per user + per action type |

### 7.2 UX rules

- No screen renders raw JSON — every entity has a purpose-built view
- Every action confirms if destructive or irreversible (merge, convert, DNC add)
- Every list supports keyboard-first navigation (j/k, o open, e edit, / search)
- Every action requires and records a purpose (DPDP) when it touches PII beyond scope
- Every write action shows a toast + optimistic UI + revalidation
- Colour palette matches Reports module (Wong colour-blind-safe)

---

## PHASE 8 · API CONTRACTS

Namespace: `/api/leads/v2/*` (v1 endpoints kept and eventually redirect)

Every endpoint: JWT/session auth · permission check · zod validation · audit · idempotency key on writes · cursor pagination on list · versioned response envelope.

### 8.1 Endpoint map (concise; full OpenAPI in `08_LEAD_API_SPEC.md`)

**Intake**
- `POST /v2/intake/web` — consumer intake (backward-compat with v1)
- `POST /v2/intake/whatsapp` — real Meta signature check
- `POST /v2/intake/phone` — telecaller-authenticated manual entry
- `POST /v2/intake/walkin`
- `POST /v2/intake/referral`
- `POST /v2/intake/api` — partner API key auth

**Leads**
- `GET /v2/leads` — cursor-paginated search
- `GET /v2/leads/{id}` — Lead 360 payload
- `PATCH /v2/leads/{id}` — restricted fields only
- `GET /v2/leads/{id}/timeline` — LeadActivity list

**Activities**
- `POST /v2/leads/{id}/activities` — append activity (any type)
- `POST /v2/leads/{id}/calls` — specialised CallRecord create

**State transitions**
- `POST /v2/leads/{id}/transitions/{event}` — event-driven state machine
- `POST /v2/leads/{id}/archive`
- `POST /v2/leads/{id}/unarchive`
- `POST /v2/leads/{id}/reactivate` (LOST → ASSIGNED)

**Follow-up**
- `POST /v2/leads/{id}/follow-ups`
- `PATCH /v2/follow-ups/{id}`
- `GET /v2/follow-ups?owner=me&status=due`

**Counselling**
- `POST /v2/leads/{id}/counselling/bookings`
- `PATCH /v2/counselling/bookings/{id}/reschedule`
- `PATCH /v2/counselling/bookings/{id}/cancel`
- `POST /v2/counselling/bookings/{id}/sessions` — attended/no-show + notes
- `GET /v2/counselling/calendar?counsellor=&from=&to=`

**Assignment**
- `POST /v2/leads/{id}/assign` — manual assign
- `POST /v2/leads/{id}/reassign` — with reason
- `POST /v2/leads/{id}/claim` — self-claim

**DNC**
- `GET /v2/dnc?channel=&value=`
- `POST /v2/dnc` — add
- `DELETE /v2/dnc/{id}` — remove (requires authority)

**Duplicates**
- `GET /v2/duplicates?status=open`
- `POST /v2/leads/{id}/merge` — { winnerLeadId, reason }

**Conversion**
- `POST /v2/leads/{id}/convert/donor`
- `POST /v2/leads/{id}/convert/recipient`
- `GET /v2/leads/{id}/conversion` — read side

**Campaigns + attribution**
- `GET /v2/campaigns`
- `POST /v2/campaigns`
- `GET /v2/leads/{id}/attribution`

**Analytics**
- `GET /v2/analytics/funnel?groupBy=source&from=&to=`
- `GET /v2/analytics/cac?scope=donor&from=&to=`
- `GET /v2/analytics/sla?tier=hot&from=&to=`
- `GET /v2/analytics/telecaller?user=&from=&to=`

**CRM**
- `GET /v2/crm/queue`
- `POST /v2/crm/queue/{id}/retry`
- `GET /v2/crm/status/{externalId}`

**Cron (internal, HMAC + timestamp)**
- `POST /v2/internal/sla/run`
- `POST /v2/internal/crm/sync/run`
- `POST /v2/internal/retention/purge`
- `POST /v2/internal/follow-ups/tick`

**Configuration**
- `GET /v2/config/{key}` — current version
- `POST /v2/config/{key}` — propose new version (requires approval)
- `POST /v2/config/{key}/approve`
- `GET /v2/config/{key}/history`

**Audit**
- `GET /v2/audit?leadId=&actor=&action=&from=&to=`

### 8.2 Error envelope + idempotency

Same standard as MRD spec §PART O — `{ error: { code, message, details[], requestId } }`. Idempotency-Key header required on POST/PATCH.

---

## PHASE 9 · MIGRATION PLAN

### 9.1 Principles

- Additive-only in phase 1; deprecations after two prod releases
- Feature flags: every behavioural change guarded (`LEAD_STATE_MACHINE_ENABLED`, `LEAD_FOLLOWUP_ENABLED`, etc.)
- Backward-compatible reads: legacy denormalised fields on `Lead` continue populated in parallel with new tables during migration window
- Backfill scripts one-time + idempotent
- Rollback plan for every migration

### 9.2 Migration batches

**Batch M1 · Additive schema (safe, non-behavioural)**
- Add `LeadActivity`, `LeadStatusHistory`, `LeadScore`, `LeadAssignment`, `LeadFollowUp`, `CounsellingSession`, `Campaign`, `LeadAttribution`, `LeadMerge`, `LeadConversion`, `LeadConfig` tables
- Add columns on `Lead`: `archiveReason`, `activeAssignmentId`, `latestScoreId`, `campaignId`, `mergedIntoLeadId`, `duplicateOfLeadId`
- Add columns on `LeadDoNotCallList`: `source`, `effectiveFrom`, `effectiveUntil`, `removalAuthorityUserId`
- Add columns on `CrmSyncQueue`: `payloadVersion`, `lastAttemptError`, `externalId`
- Indexes per §4.4
- Feature flag: none (schema-only)

**Batch M2 · Race-safe lead code generator**
- Create Postgres helper `next_lead_code(city_code text, day date) returns text` using advisory lock + `sequences` table (row per city-day-key with atomic increment)
- Ship in parallel with legacy generator behind `LEAD_CODE_V2_ENABLED`
- Backfill: N/A (only affects new inserts)

**Batch M3 · State machine + activity double-write**
- Ship state machine module
- Every existing status mutation calls state machine AND writes `LeadStatusHistory` + `LeadActivity` alongside legacy `Lead.status` update
- Flag: `LEAD_STATE_MACHINE_ENABLED` (defaults ON in staging, OFF in prod)
- After two clean weeks in staging + one in prod: flip flag; legacy mutations refuse to run outside state machine

**Batch M4 · Config store**
- Populate `LeadConfig` with SCORE_WEIGHTS_V1, SLA_MATRIX_V1, RETENTION_POLICY_V1, ASSIGNMENT_RULES_V1 (exact values equal to current hard-coded)
- `ScoringService`, `SlaService`, `AssignmentService` read from `LeadConfig` behind flag `LEAD_CONFIG_ENABLED`
- After validation: retire hard-coded constants

**Batch M5 · ConversionPort + double-convert guard**
- Add `LeadConversion` unique constraint on `leadId`
- Route both `convertLeadToDonor` and `convertLeadToRecipient` through `ConversionPort`
- Retain existing `Donor.sourceLeadId` / `Recipient.sourceLeadId` writes for backward compat
- Flag: `LEAD_CONVERSION_PORT_ENABLED`

**Batch M6 · Duplicate detection + merge workflow**
- Introduce match rules: phone exact, email exact, name+phone fuzzy, name+email fuzzy
- Ship review UI (Duplicate Review surface)
- Merge action creates `LeadMerge`, sets `mergedIntoLeadId` on loser, appends activities of loser as `LeadActivity(source=merge)` on winner

**Batch M7 · Counselling history model**
- Ship `CounsellingSession` table
- New sessions written to `CounsellingSession`; legacy `CounsellingBooking` remains as anchor with `rescheduledFromBookingId` + `cancelledReason`
- Counsellor UI rebuilt against new model
- Flag: `LEAD_COUNSELLING_HISTORY_ENABLED`

**Batch M8 · NotificationPort + real adapters**
- Ship `NotificationPort` interface with adapters for email (Resend), SMS (Twilio/MSG91 stub), WhatsApp (Meta), in-app
- Every outbound call goes through port
- DNC enforced on every send

**Batch M9 · IDOR fix + ownership**
- Lead detail server actions load lead via `LeadRepository.byId(id, ctx)` — repository refuses if actor lacks ownership/permission
- Audit any denied access

**Batch M10 · Cron hardening**
- HMAC signed cron request + timestamp + replay window (5 min) + rotated secrets
- Remove static X-Cron-Secret after two releases

**Batch M11 · Analytics tables + Reports integration**
- Add cached aggregate tables for funnel/CAC/SLA
- Materialised views refreshed by cron
- Feed into Reports module (10) via existing hooks

**Batch M12 · UI polish + rebrand of surfaces**
- Rebuild admin lead detail (kill raw JSON)
- Rebuild telecaller workspace
- Add all 18 UI surfaces per §PHASE 7

**Batch M13 · Deprecations (v2.1)**
- Drop unused `SlaEntityType` enum values (after two releases with zero usage)
- Drop `CallDisposition.qaScore`, `.recordingUrl`, `.recordingDurationSec`
- Merge `LeadDoNotCallList` → `LeadDoNotCall` (view first, then table rename)

### 9.3 Rollback strategy

- Feature flags in `LeadConfig` allow instant rollback of behavioural batches (M3-M12)
- Schema-only batches (M1) rely on Prisma migration `down` scripts + never-drop policy
- Data migrations are idempotent + resumable
- Every batch shipped in isolation — no compound rollback risk

### 9.4 Data integrity guarantees during migration

- `Lead.status` field kept in sync via state-machine adapter until flag flip
- `Lead.convertedDonorId` continues writing until `ConversionPort` fully adopted
- `LeadDoNotCallList` view alias preserves existing queries
- No PII loss — retention purge cron continues untouched

---

## PHASE 10 · TEST STRATEGY

### 10.1 Test layers

| Layer | Framework | Target coverage |
|---|---|---|
| **Unit — domain** | Vitest | 90% of `src/lib/leads/domain/**` — state machine, scoring, guards, merge rules |
| **Unit — services** | Vitest + fakes | 85% of `application/**` — orchestrations |
| **Integration — repositories** | Vitest + Prisma test DB | 80% of adapters |
| **Contract — ports** | Vitest | Every port has a fake + a real adapter, both tested against the same contract suite |
| **API** | Vitest + supertest | 100% of endpoints (happy + failure) |
| **E2E** | Playwright | Critical journeys: intake → convert donor · intake → counselling → convert recipient · duplicate → merge · lost → reactivate · IDOR blocked |
| **Security** | Custom + OWASP ZAP | IDOR matrix (every role × every lead scope), rate limit, HMAC replay |
| **Performance** | k6 | Intake p95 < 500 ms, queue list p95 < 300 ms |
| **DPDP** | Custom | Purge job leaves zero PII in redacted rows |

### 10.2 Must-have test cases (backlog seed)

- Intake happy paths per channel
- Intake refuses when DNC present (phone AND email)
- Intake creates all downstream rows in a single transaction
- Duplicate phone flagged for review (not silently merged)
- Score matches golden fixture per input matrix
- Tier assignment matches score thresholds
- SLA schedules created per tier
- Every state transition tested (allowed + denied + terminal-guard)
- Follow-up marked OVERDUE at correct threshold
- Counselling reschedule preserves history; cancellation preserves reason
- Assignment respects site/shift/language/skill/capacity
- Round-robin fairness under load (statistical)
- Conversion creates Donor with `sourceLeadId` + `LeadConversion` in same transaction
- Double conversion attempt refused
- Merge preserves loser activities on winner
- Reactivate LOST within 90 days works; after 90 days refused
- IDOR: telecaller cannot access another telecaller's lead ID
- Cron HMAC: replayed request rejected
- CRM sync retries with exponential backoff; DLQ on max attempts
- Retention purge redacts PII, retains score for analytics
- Config version change re-scores tagged leads (feature-flagged)
- Audit entries appended for every material action (matrix test)

### 10.3 Test data

- Fixture builders: `aLead()`, `aQualifiedLead()`, `aCounsellingBooking()`
- Golden score fixtures with expected outputs
- Anonymised production-like intake payloads (no real PII)

---

## PHASE 11 · CURSOR IMPLEMENTATION PLAN

**Rule:** never one giant Cursor prompt. Each batch below is an independently testable Composer prompt.

### Batch C1 · Foundation (1 sprint)
1. `LeadActivity`, `LeadStatusHistory`, `LeadScore`, `LeadAssignment`, `LeadFollowUp`, `Campaign`, `LeadAttribution`, `LeadMerge`, `LeadConversion`, `LeadConfig` Prisma models
2. Additive columns on `Lead` and related tables
3. Migration + seed for LeadConfig defaults
4. Domain module scaffolding (`domain/`, `adapters/`, `application/`, `testing/`)
5. Port interfaces (typed) — no implementations yet
6. Vitest setup + fake ports

**DoD:** `prisma migrate deploy` clean · `tsc --noEmit` clean · port fakes exist · zero behavioural change

### Batch C2 · State machine + activity double-write (1 sprint)
1. State machine module (pure)
2. Adapter that wires existing server actions to call state machine
3. `LeadStatusHistory` + `LeadActivity(STATUS_CHANGE)` written on every transition
4. Legacy `Lead.status` still updated in parallel
5. Flag `LEAD_STATE_MACHINE_ENABLED` (default ON staging)
6. Tests: every allowed transition + every guard

**DoD:** all existing E2E paths still pass · staging flip successful for 2 weeks

### Batch C3 · Race-safe lead code + IDOR fix (1 sprint)
1. Postgres `next_lead_code()` helper via advisory lock
2. Repository swaps in v2 generator behind `LEAD_CODE_V2_ENABLED`
3. `LeadRepository.byId(id, ctx)` refuses when ownership fails
4. All telecaller server actions load via repository
5. Tests: concurrent insert (10 parallel) yields no collision · telecaller-B blocked from telecaller-A lead

**DoD:** concurrency test passes · IDOR test passes · zero regression in queue

### Batch C4 · Follow-up + activity generic API (1 sprint)
1. `LeadFollowUp` service + repository
2. `POST /v2/leads/{id}/follow-ups`, `PATCH /v2/follow-ups/{id}`, `GET /v2/follow-ups?owner=me&status=due`
3. Follow-up cron tick: OPEN → DUE → OVERDUE
4. `POST /v2/leads/{id}/activities` generic endpoint
5. Follow-up queue UI

**DoD:** telecaller sees due/overdue follow-ups · SLA integration works

### Batch C5 · Counselling history model (1 sprint)
1. `CounsellingSession` table
2. Reschedule/cancel with history preserved
3. Counsellor UI rebuilt
4. Tests: session appended on attended/no-show · reschedule preserves prior booking

**DoD:** counsellor sees session history for a lead

### Batch C6 · ConversionPort + double-convert guard (1 sprint)
1. `ConversionPort` interface + HIS-native adapter
2. `LeadConversion` unique constraint
3. Server actions route through port
4. Tests: double conversion refused · Donor.sourceLeadId still populated

**DoD:** convert flow unchanged from UI · integrity constraint enforced

### Batch C7 · Config store + versioning (1 sprint)
1. `LeadConfig` seeded with current constants
2. Scoring/SLA/Assignment services read from config behind flag
3. Config editor UI (Configuration surface)
4. Approval workflow (2-approver)
5. Tests: config change triggers re-score of tagged leads

**DoD:** score weights editable via UI · audit trail present

### Batch C8 · Duplicate detection + merge (1 sprint)
1. Match rules service
2. Duplicate Review UI
3. Merge action + audit
4. Tests: match cases · merge preserves activities

**DoD:** duplicates surfaced for review · merge irreversible + audited

### Batch C9 · NotificationPort + adapters (1 sprint)
1. `NotificationPort` interface
2. Resend email adapter + Twilio SMS adapter + Meta WhatsApp adapter + in-app adapter
3. DNC enforced at port
4. Tests: DNC blocks send · retry on transient failure

**DoD:** all outbound goes via port · DNC honoured

### Batch C10 · Cron hardening (0.5 sprint)
1. HMAC-signed cron requests
2. Timestamp + replay window
3. Rotated secrets
4. Tests: replay rejected · unsigned rejected

**DoD:** static secret path removed after 2 releases

### Batch C11 · Assignment upgrade (1 sprint)
1. `AssignmentDirectory` port + IAM adapter
2. Site/shift/language/skill/capacity aware assignment
3. Assignment Centre UI
4. Tests: assignment respects criteria · fallback when no match

**DoD:** telecaller queue balanced per config

### Batch C12 · Campaign + attribution (1 sprint)
1. `Campaign` CRUD
2. `LeadAttribution` capture at intake (UTM + creative + landing + referral)
3. Campaign Manager UI
4. Analytics: source × campaign funnel
5. Tests: attribution captured · campaign roll-ups match raw

**DoD:** CAC per campaign visible in Analytics surface

### Batch C13 · CRM real adapters + monitoring (1 sprint)
1. Zoho + Salesforce real adapters
2. CRM Sync Monitor UI
3. Retry/DLQ + external ID reconciliation
4. Tests: sync happy + failure + retry + DLQ

**DoD:** live sync running behind `CRM_SYNC_ENABLED`

### Batch C14 · UI polish (1 sprint)
1. Kill raw JSON in admin lead detail — rebuild with Lead 360
2. Rebuild telecaller workspace
3. Add SLA Monitor, Audit surfaces
4. Fix Aadhaar validation (mode: onChange)
5. Rename tier column to "Tier at capture" + add Outcome column

**DoD:** all 18 UI surfaces present · Path C bugs fixed

### Batch C15 · Deprecations (v2.1) (0.5 sprint)
1. Drop unused SlaEntityType values (after usage audit)
2. Drop unused CallDisposition columns
3. Rename LeadDoNotCallList → LeadDoNotCall (view first)

**DoD:** schema clean · no code references

---

## A · MASTER LEAD ARCHITECTURE (recap)

Bounded domain with 12 ports · pure state machine · deterministic scoring via config · additive-first data model · double-write during migration · feature-flagged behavioural changes · SaaS-extractable via `/api/leads/v2/*` REST surface.

## B · MASTER LEAD DATA MODEL (recap)

**Entities (17):** Lead, LeadActivity, LeadStatusHistory, LeadScore, LeadAssignment, LeadFollowUp, CallRecord (legacy CallDisposition), CounsellingBooking, CounsellingSession, Campaign, LeadAttribution, LeadDoNotCall, LeadMerge, LeadConversion, SlaSchedule, CrmSyncQueue, LeadConfig.
**Rules:** additive columns first · legacy denormalised fields retained during migration · Postgres sequence for lead codes · unique constraint on `LeadConversion(leadId)` · retention purge redacts PII only.

## C · MASTER LEAD WORKFLOW MAP

```
INTAKE ──▶ SCORE ──▶ ASSIGN ──▶ TELECALL ──┬──▶ QUALIFY ──┬──▶ CONVERT DONOR ──▶ Donor Pathway (01)
                                            │              │
                                            │              ├──▶ BOOK COUNSELLING ──▶ SESSION ──▶ CONVERT RECIPIENT ──▶ Recipient Pathway
                                            │              │
                                            │              └──▶ FOLLOW-UP ──▶ (loop)
                                            │
                                            ├──▶ CALLBACK ──▶ FOLLOW-UP ──▶ TELECALL
                                            │
                                            ├──▶ NOT REACHABLE ──▶ RETRY (per SLA)
                                            │
                                            ├──▶ WRONG NUMBER / DO NOT CALL / NOT INTERESTED ──▶ LOST
                                            │
                                            └──▶ ARCHIVE (reversible)

Cross-cutting:
  · DNC check before every outbound
  · SLA schedule + warn + breach + escalate on every stage
  · Duplicate detection at intake + on manual entry
  · Merge from Duplicate Review
  · Retention purge cron (daily) for LOST/expired without conversion
  · Audit on every material action
  · CRM sync queue on every state change
```

## D · MASTER LEAD STATE MACHINE (recap)

15 states (NEW, ASSIGNED, CONTACTED_QUALIFIED, CONTACTED_NOT_INTERESTED, CONTACTED_CALLBACK_REQUESTED, NOT_REACHABLE, WRONG_NUMBER, DO_NOT_CALL, COUNSELLING_BOOKED, COUNSELLING_ATTENDED, COUNSELLING_NO_SHOW, CONVERTED, LOST, EXPIRED_AUTO_PURGED, ARCHIVED). ~30 explicit transitions with guards + actor permissions + side-effect intents. Terminal states: CONVERTED, LOST (with 90-day reactivation), EXPIRED_AUTO_PURGED (irreversible).

## E · MASTER LEAD BACKLOG

**P0 (essential for v2.0 shipping)**
- Batches C1–C7 above
- IDOR fix
- Race-safe lead code
- State machine
- Follow-up entity
- Config store
- Conversion Port

**P1 (production hardening)**
- Batches C8–C11
- Duplicate detection
- Notification port
- Cron hardening
- Assignment upgrade

**P2 (SaaS-ready + growth)**
- Batches C12–C14
- Campaign + attribution
- Real CRM adapters
- All 18 UI surfaces

**P3 (future / AI-ready)**
- AI lead classification, summarisation, next-best-action, prioritisation, churn/drop-off prediction, conversational intake, campaign optimisation, duplicate detection ML, CRM assistant
- Every AI feature must ship with: data inputs · model · confidence · human review · audit · model version · fallback

## F · CURSOR IMPLEMENTATION SEQUENCE

Sequential — 15 batches over ~12 sprints:
```
C1 Foundation
C2 State machine + activity double-write
C3 Race-safe lead code + IDOR fix
C4 Follow-up + generic activity API
C5 Counselling history
C6 ConversionPort + double-convert guard
C7 Config store + versioning
C8 Duplicate detection + merge
C9 NotificationPort + adapters
C10 Cron hardening
C11 Assignment upgrade
C12 Campaign + attribution
C13 CRM real adapters
C14 UI polish (18 surfaces + Path C bug fixes)
C15 Deprecations (v2.1)
```

Each batch = 1 self-contained Cursor Composer prompt · ships behind flag when behavioural · rollback via flag flip.

---

## Design Decision Register (ADRs — Lead re-engineering)

| ID | Decision | Reason | Status |
|---|---|---|---|
| LADR-01 | Re-engineer, not rewrite | Preserve customer data + working flows + minimise risk | Approved |
| LADR-02 | Bounded domain with 12 ports | Enables future extraction as CRM SaaS · testable via fakes | Approved |
| LADR-03 | Additive-only migrations first | Zero-downtime · reversible · low risk | Approved |
| LADR-04 | Feature flags for every behavioural change | Instant rollback · staged rollout | Approved |
| LADR-05 | Retain legacy denormalised fields during migration | Backward compatibility for existing queries | Approved |
| LADR-06 | Postgres sequence + advisory lock for lead code | Race-safe by construction | Approved |
| LADR-07 | ConversionPort with typed contract; host implements | Decouples domain from HIS · SaaS-ready | Approved |
| LADR-08 | Config in DB with versioning + approval | Business changes without code · auditable | Approved |
| LADR-09 | State machine returns intents; adapter applies | Testable without DB · single write path | Approved |
| LADR-10 | Never merge duplicates automatically | Human decision preserved · audit-defensible | Approved |
| LADR-11 | Real cron auth via HMAC + timestamp | Replay-resistant · rotatable | Approved |
| LADR-12 | DNC enforced at NotificationPort, not at caller | Impossible to bypass by accident | Approved |
| LADR-13 | Reactivate LOST within 90 days only | Data quality vs re-engagement balance | Approved |
| LADR-14 | v1 endpoints kept under `/api/leads/*`, v2 under `/v2/*` | Backward compat + clean cut | Approved |
| LADR-15 | AI features gated with confidence + human review + audit | Regulatory safety + user trust | Approved |

---

## Next steps

1. **Founder + Engineering Lead sign-off** on this master + 15 ADRs
2. Author the 22 sub-specs listed in the brief (§AB), starting with:
   - `05_LEAD_STATE_MACHINE.md` (full transition matrix)
   - `06_LEAD_DATA_MODEL.md` (per-entity fields)
   - `08_LEAD_API_SPEC.md` (OpenAPI)
   - `20_LEAD_CURSOR_BUILD_PLAN.md` (per-batch Composer prompts)
3. Ship Batch C1 (Foundation) — non-behavioural, additive schema + port scaffolding
4. Confirm 3 open [DECISION REQUIRED] items:
   - [DECISION REQUIRED] SMS provider — Twilio vs MSG91 (India-preferred pricing)
   - [DECISION REQUIRED] Reactivation window — 90 days confirmed or shorter?
   - [DECISION REQUIRED] Config approval — 2-approver mandatory or single-approver for non-critical keys?

**This document is the master source of truth for Lead Management v2. Any subsequent doc must reference it. Any deviation must be flagged, explained, and approved.**
