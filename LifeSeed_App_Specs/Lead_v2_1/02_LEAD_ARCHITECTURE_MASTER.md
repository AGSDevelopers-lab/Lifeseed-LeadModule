# 02 · Lead Management — Architecture Master (v2.1)

**Status:** ARCHITECTURE FREEZE · Founder-approved 2026-09-04
**Companion docs:** `01_LEAD_PRODUCT_MASTER.md` · `03_LEAD_DATA_MODEL.md` · `04_LEAD_STATE_WORKFLOW.md` · `05_LEAD_API_RBAC.md` · `06_LEAD_BUILD_MIGRATION.md`

> **Positioning statement (must appear verbatim in every subsequent build artefact):**
> *Lead Management is a bounded domain within ART Bank HIS today. It is architected for eventual reuse as an independent Lead Management / CRM acquisition product.*

---

## 1 · Domain Boundary

The Lead domain **owns**:
- The lifecycle of an enquiry — from intake through terminal state
- Score, tier, assignment, activity, follow-up, counselling (booking + session + outcome), duplicates
- DNC list + centrally-enforced outbound gate
- Attribution + campaign
- Domain events published to an Outbox

The Lead domain **does not own**:
- Donor or Recipient records — creation happens only via `ConversionPort`
- Clinical workflows
- Documents (stored in MRD module 11)
- User identity / RBAC catalogue (owned by IAM module 12)
- Notification providers (contained behind NotificationPort adapters)
- CRM systems (behind CrmPort event consumers)

## 2 · Layered Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│  L1 · Interface Layer                                             │
│      Next.js App Router pages · Server Actions · REST endpoints   │
│      Command Palette · Telecaller Workspace · Lead 360 · etc.     │
└──────────────────────────────┬────────────────────────────────────┘
                               │ delegate to
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│  L2 · Application Services (thin orchestrators)                   │
│      IntakeService · QualificationService · AssignmentService     │
│      TelecallingService · ActivityService · FollowUpService       │
│      CounsellingService · DncService · ScoringService · …         │
└──────────────────────────────┬────────────────────────────────────┘
                               │ compose
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│  L3 · Domain Layer  (PURE TypeScript · zero framework)            │
│      Domain Entities (Lead, LeadActivity, LeadFollowUp, …)        │
│      Value Objects (LeadCode, TierScore, AttributionTouch, …)     │
│      Domain Events (LeadCreated, LeadContacted, …)                │
│      State Machine (transitions.ts, guards.ts, invariants.ts)     │
│      Domain Errors                                                │
│      Ports (interfaces) — see §4                                  │
└──────────────────────────────┬────────────────────────────────────┘
                               │ implemented by
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│  L4 · Adapter Layer                                               │
│      Prisma Lead Repository · Prisma Audit · HIS Conversion       │
│      Adapter · Zoho Adapter · Salesforce Adapter · Resend Adapter │
│      SMS-Magic Adapter · Meta WhatsApp Adapter · Config Store     │
│      Adapter · Clock · IdGenerator · Outbox Dispatcher            │
└──────────────────────────────┬────────────────────────────────────┘
                               │ persists / calls
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│  L5 · Infrastructure                                              │
│      PostgreSQL (Supabase) · Outbox table · Notification          │
│      providers · CRM APIs · Job runner (cron / SLA / follow-up    │
│      tick) · Supabase Storage (delegated to MRD)                  │
└───────────────────────────────────────────────────────────────────┘
```

### 2.1 Absolute layering rules (enforced by lint + code review)

| Rule | Enforcement |
|---|---|
| Domain layer (`src/lib/leads/domain/**`) must NOT import Prisma, Next.js, React, or any framework | ESLint `no-restricted-imports` rule |
| Domain layer must NOT import from Adapter layer | Same rule |
| Application layer (`src/lib/leads/application/**`) must NOT import UI | Same rule |
| Adapter layer implements domain-defined interfaces only | Type check at compile |
| UI (Server Actions / pages) must NOT touch Prisma directly for Lead data — must call an application service | Grep guard in CI |
| Domain entities are **plain TypeScript**, not Prisma types | Reviewed in PR |

### 2.2 Directory layout (target)

```
src/lib/leads/
├── domain/
│   ├── entities/          Lead.ts, LeadActivity.ts, LeadFollowUp.ts, …
│   ├── value-objects/     LeadCode.ts, TierScore.ts, AttributionTouch.ts, …
│   ├── enums/             LeadStatus, LeadOutcome, ActivityType, …
│   ├── events/            LeadCreated.ts, LeadContacted.ts, …
│   ├── state-machine/     transitions.ts, guards.ts, invariants.ts
│   ├── scoring/           v1-rules.ts, config-schema.ts
│   ├── ports/             LeadRepository.ts, ConversionPort.ts, …
│   ├── errors.ts
│   └── index.ts           Re-exports the public domain API
├── application/
│   ├── intake.ts
│   ├── qualify.ts
│   ├── assign.ts
│   ├── follow-up.ts
│   ├── counselling.ts
│   ├── convert.ts
│   ├── merge.ts
│   └── outbox-dispatcher.ts
├── adapters/
│   ├── prisma-lead-repository.ts
│   ├── prisma-outbox.ts
│   ├── prisma-audit.ts
│   ├── his-conversion-adapter.ts
│   ├── notification/
│   │   ├── notification-port.ts   (re-exports port)
│   │   ├── resend-email-adapter.ts
│   │   ├── sms-magic-adapter.ts
│   │   ├── meta-whatsapp-adapter.ts
│   │   └── in-app-adapter.ts
│   ├── crm/
│   │   ├── zoho-adapter.ts
│   │   └── salesforce-adapter.ts
│   ├── clock-system.ts
│   ├── id-generator.ts
│   └── config-store-adapter.ts
├── config/
│   ├── keys.ts            SCORE_WEIGHTS_V1, SLA_MATRIX_V1, …
│   └── defaults.ts        Frozen v1 defaults for seed
└── testing/
    ├── fakes/             In-memory ports for domain tests
    └── fixtures/
```

## 3 · Domain Entities (pure types)

Domain entities are **plain TypeScript** — they carry business behaviour, not persistence concerns. Prisma models exist only in adapters; adapters map between the two.

Example (illustrative — full field definitions in `03_LEAD_DATA_MODEL.md`):

```ts
// src/lib/leads/domain/entities/Lead.ts
export interface Lead {
  readonly id: LeadId
  readonly code: LeadCode              // value object
  personType: LeadPersonType
  donorSubtype?: LeadDonorSubType
  contact: ContactInfo                  // value object
  attribution: {                        // never overwritten silently
    firstTouch: AttributionTouch        // value object · immutable after creation
    lastTouch: AttributionTouch         // versioned via LeadAttributionHistory
  }
  consent: Consent                      // value object · immutable
  status: LeadStatus                    // lifecycle stage
  outcome: LeadOutcome | null           // WON | LOST | EXPIRED | MERGED | null
  isArchived: boolean                   // filing state · orthogonal to status
  archive: ArchiveMeta | null           // { archivedAt, archivedBy, reason } | null
  latestScore: TierScore                // { score, tier, versionRef, at }
  ownership: {
    siteId: string
    assignedTelecallerId: string | null
    activeAssignmentId: string | null   // FK into LeadAssignment
  }
  retention: {
    capturedAt: Date
    retentionExpiresAt: Date
  }
  merge: {                              // if merged
    mergedIntoLeadId: string | null
  }
  conversion: {                         // denormalised convenience refs
    convertedDonorId: string | null
    convertedRecipientId: string | null
    convertedAt: Date | null
  }
  duplicate: {
    duplicateOfLeadId: string | null    // weak marker for review queue
  }
}
```

The `Lead` entity **exposes methods** for domain behaviour (`canConvertToDonor()`, `isEligibleForReactivation(now, window)`, `applyStatusTransition(intent)`) — those methods are pure and framework-free.

## 4 · Ports (interfaces the host implements)

All 12 ports from v2.0 are retained. Signatures live in `src/lib/leads/domain/ports/`. Adapters live in `src/lib/leads/adapters/`.

| Port | Purpose | Adapter (v2.1) |
|---|---|---|
| `LeadRepository` | CRUD + activity/status/score/assignment/follow-up/duplicate/merge/conversion writes | `PrismaLeadRepository` |
| `AssignmentDirectory` | Query telecaller availability + skills + capacity | `IamAssignmentDirectory` (calls IAM module 12) |
| `ConversionPort` | Create Donor / Recipient with `sourceLeadId` linkage | `HisConversionAdapter` (calls Donor Pathway 01 + Recipient) |
| `SlaPort` | Schedule / warn / breach / complete SLA | Existing `src/lib/sla/engine.ts` |
| `AuditPort` | Append entries to hash-chained audit log | `PrismaAuditAdapter` (extends module 02 chain) |
| `CrmPort` | Enqueue outbound sync · consume via workers | `ZohoCrmAdapter` + `SalesforceCrmAdapter` |
| `NotificationPort` | Send email/SMS/WhatsApp/in-app with DNC gate | 4 adapters — Resend, **SMS-Magic**, Meta WhatsApp, in-app |
| `ConfigPort` | Read versioned business config | `ConfigStoreAdapter` → `LeadConfig` table |
| `IdentityPort` | Resolve session user + permission + ownership | Wraps existing auth + RBAC |
| `CampaignPort` | Resolve campaign + first/last-touch attribution | `PrismaCampaignAdapter` |
| `Clock` | `now()` — injectable for tests | `SystemClock` |
| `IdGenerator` | Typed ID minting | `SystemIdGenerator` |

## 5 · Application Services (thin orchestrators)

Each service composes ports + domain rules into a use-case. No business logic in Server Actions — actions call services.

Example — `IntakeService.intake(input, ctx)`:

1. Resolve campaign + first-touch attribution via `CampaignPort`
2. Load `SCORE_WEIGHTS_V1` from `ConfigPort`
3. Domain: `scoreLead(input, weights)` → `TierScore`
4. Domain: `applyIntakeInvariants(input, tierScore)` — validates or throws typed domain errors
5. `LeadRepository.create(input, tierScore, attribution, ctx)` — **single transaction** persists: Lead + LeadActivity(SYSTEM: created) + LeadStatusHistory(→ NEW) + LeadScore + LeadAttribution + LeadOutboxEvent(LeadCreated)
6. `AssignmentService.autoAssign(leadId, ctx)` — separate transaction: assigns telecaller, appends LeadActivity(ASSIGNMENT), LeadStatusHistory(NEW → ASSIGNED), LeadOutboxEvent(LeadAssigned)
7. `SlaPort.schedule({ entityType: LEAD_RESPONSE, entityId, tier, dueAt })`
8. `AuditPort.append({ actor, action: 'lead.intake', leadId, hashPrev, hashCurr })`
9. Return `{ leadId, leadCode, tier, message }`

External systems (CRM, notification) consume the outbox — they are **not** part of the intake transaction.

## 6 · Domain Events + Outbox (v2.1 core)

Business transactions commit atomically with an **Outbox event row**. A background dispatcher reads unpublished outbox rows and delivers to consumers (CRM, notifications, analytics). This decouples the core Lead transaction from the availability of downstream systems.

### 6.1 Event catalogue (v2.1)

| Event | When published | Consumers |
|---|---|---|
| `LeadCreated` | Intake commit | CRM · Notification (welcome touch if opted-in) · Analytics |
| `LeadAssigned` | Assignment commit | Notification (assignee alert) · Analytics |
| `LeadContacted` | Disposition = CONTACTED_* (any) | Analytics · CRM |
| `LeadQualified` | Disposition = CONTACTED_QUALIFIED | CRM · Analytics · SLA (qualification SLA start) |
| `LeadFollowUpCreated` | Follow-up create | Notification (owner reminder scheduling) · Analytics |
| `LeadFollowUpCompleted` | Follow-up complete | Analytics |
| `CounsellingBooked` | Booking create | Notification (lead + counsellor confirmation + reminders schedule) |
| `CounsellingAttended` | Session marked ATTENDED_* | Analytics · CRM |
| `CounsellingNoShow` | Session marked NO_SHOW | Analytics · Notification (rebook prompt to telecaller) |
| `LeadLost` | State → LOST | CRM · Analytics |
| `LeadConverted` | State → CONVERTED (donor OR recipient) | CRM · Analytics · Downstream domain notified |
| `LeadMerged` | Merge commit | CRM · Analytics |
| `LeadDncAdded` | DNC list append | Notification (block subsequent sends) · CRM |
| `LeadScoreChanged` | Score recomputed | Analytics · CRM (updated priority signal) |
| `LeadArchived` | isArchived → true | Analytics |
| `LeadReactivated` | LOST → ASSIGNED via reactivate (within 90 days) | CRM · Notification (assignee alert) · Analytics |

### 6.2 Outbox mechanics

- `LeadOutboxEvent` table columns: `id`, `aggregateType='Lead'`, `aggregateId`, `eventType`, `payload (JSON)`, `occurredAt`, `publishedAt (nullable)`, `attemptCount`, `lastAttemptError`, `lockedUntil (for worker lease)`
- Dispatcher: cron every 30 seconds (configurable) via `POST /api/leads/v2/internal/outbox/dispatch` (HMAC-signed). Claims rows via `SELECT … FOR UPDATE SKIP LOCKED`, batches by consumer, publishes, sets `publishedAt` or increments `attemptCount`
- Retry ladder: 30s, 2m, 10m, 1h, 6h — after 5 attempts routed to DLQ (`LeadOutboxDlq`) with human review UI
- Ordering guarantee: **per-aggregate ordering** (events for the same leadId dispatched sequentially)

### 6.3 Consumer isolation

CRM, Notification, Analytics each subscribe independently. A CRM outage does **not** block Notification delivery. A single consumer's DLQ does not affect others.

## 7 · Integrations

| System | Direction | Coupling | Notes |
|---|---|---|---|
| **ART Bank HIS core (Donor 01, Recipient, IAM 12, MRD 11, Reports 10, SLA engine)** | In-process | Direct method calls via ports — always | Enforced via adapter layer |
| **SMS-Magic** | Out | Adapter behind NotificationPort — never direct | LADR-16 |
| **Resend (email)** | Out | Adapter behind NotificationPort | |
| **Meta WhatsApp Cloud API** | Bidirectional | Adapter behind NotificationPort (out) + signed webhook adapter (in, for intake) | Real signature verification (P0 fix) |
| **Zoho CRM** | Out (v2.2 bidirectional) | Adapter behind CrmPort · consumed via outbox worker | |
| **Salesforce** | Out (v2.2 bidirectional) | Adapter behind CrmPort · consumed via outbox worker | |
| **Twilio / other future CRMs** | Same pattern | Add adapter; domain unchanged | |
| **Reports module 10** | Out | Publishes aggregate materialised views for scheduled reports | |
| **MRD module 11** | Out | If lead attaches a document, delegate storage to MRD via internal call | |
| **Payments (billing 06)** | None (lead → recipient handoff → billing owns from there) | |
| **Aadhaar / DigiLocker** | [FUTURE] identity proofing at intake | Via adapter | |

## 8 · SMS-Magic Integration Notes (LADR-16)

- **Adapter path:** `src/lib/leads/adapters/notification/sms-magic-adapter.ts`
- **API surface used:** SMS-Magic REST send + delivery-webhook (details in `06_LEAD_BUILD_MIGRATION.md` §Batch C9)
- **Env vars:** `SMS_MAGIC_API_KEY`, `SMS_MAGIC_SENDER_ID`, `SMS_MAGIC_WEBHOOK_SECRET`
- **Feature flag:** `LEAD_SMS_ENABLED` (default off; enable per environment after credentials wired)
- **DNC gate:** Enforced inside NotificationPort BEFORE adapter invocation — SMS-Magic adapter never receives a DNC'd number
- **Delivery status:** Webhook writes into `NotificationDeliveryLog`; failures counted; template-level failure rate surfaced in ops dashboard
- **Templates:** Registered under `NotificationTemplate` table with ID, channel, subject/body, variables. Every send uses a template ID — never free-text via API (audit + compliance)
- **Provider replacement:** If SMS-Magic is ever swapped, only this adapter file changes. Domain untouched.

## 9 · Security Architecture

- Every Lead read/write action gates on: **authenticated user → permission → site scope → ownership scope where applicable**
- Failed access attempts logged to audit with actor, targetLeadId, requiredPermission, denialReason
- IDOR fix (previously P0 open): `LeadRepository.byId(id, ctx)` refuses to return the entity when scope fails; server actions/pages never call Prisma directly for Lead reads
- Row-level scoping enforced in repository (query-time predicate on siteId + assignedTelecallerId as applicable to actor role)
- Cron endpoints: HMAC-signed with rotating secret + timestamp + 5-minute replay window
- WhatsApp intake: real Meta signature verification (X-Hub-Signature-256) — no more `stub_ok_*`
- All PII redaction paths audit-logged; consented purpose captured at every download/export
- See `05_LEAD_API_RBAC.md` for the full authorisation matrix

## 10 · Concurrency-safe Lead Code

- Format retained: `LED-{CITY}-{YYYYMMDD}-{XXXX}` (human-visible everywhere)
- Generator moves to Postgres via `next_lead_code(city_code, day)` helper using **advisory lock + sequence row per city-day**
- `Lead.code` gains `UNIQUE` constraint (was previously advisory)
- Collision on insert falls back to retry with fresh seq value (idempotent)
- Ships behind `LEAD_CODE_V2_ENABLED` flag; legacy generator stays in place until validation window passes
- Details in `06_LEAD_BUILD_MIGRATION.md` Batch C3

## 11 · Configuration Architecture (single-approver, LADR-18)

- All business rules stored in `LeadConfig` (key, version, payload JSON, effectiveFrom, effectiveUntil, ownerRoleId, createdByUserId, approvedByUserId, approvedAt, isActive)
- Config keys (v2.1 initial set): `SCORE_WEIGHTS_V1`, `SLA_MATRIX_V1`, `RETENTION_POLICY_V1`, `ASSIGNMENT_RULES_V1`, `FOLLOW_UP_POLICY_V1`, `COUNSELLING_POLICY_V1`, `NOTIFICATION_TEMPLATE_MAP_V1`, `CAMPAIGN_RULES_V1`, `DUPLICATE_MATCH_RULES_V1`
- Change flow: propose → author cannot approve → single authorised approver (role-scoped per key ownership) approves → new version becomes active on `effectiveFrom` (immediate if unset)
- Prior versions retained forever (immutable). Reads at time T resolve to the version active at T
- Audit trail: every propose + every approve + every activation logged
- Rollback: create a new version copying prior payload; approver approves; audit shows revert reason

## 12 · Scalability

Current LifeSeed volume is modest (thousands of leads / month). Architecture is designed to scale to hundreds of thousands / month without redesign:

- **Read scale:** cursor pagination on all list endpoints · indexed queries · materialised views for analytics
- **Write scale:** intake decoupled from CRM + notifications via outbox · transaction size kept small
- **Job scale:** cron ticks (SLA, follow-up, outbox dispatch, retention purge) idempotent + resumable · lease semantics on outbox workers
- **Storage scale:** PII redaction preserves aggregate metrics without unbounded PII growth · retention purge keeps table sizes bounded
- **Multi-tenant readiness:** every row already carries siteId; tenant column can be added later without model churn — see `06_LEAD_BUILD_MIGRATION.md` FUTURE §

## 13 · Future Standalone Extraction (LifeSeed Lead / CRM)

The architecture is deliberately shaped so extraction is a packaging exercise, not a rewrite:

- Domain layer is framework-free — publish as an npm package (`@lifeseed/lead-core`)
- Ports are stable interfaces — a tenant's HIS/CRM implements them
- REST surface `/api/leads/v2/*` becomes the SaaS product API — OpenAPI 3.1 spec published + versioned
- Multi-tenant: add `tenantId` column; all queries scope on tenant; per-tenant `LeadConfig`
- Auth: tenant-issued JWT + API key
- Storage: same schema, single database with row-level tenant isolation (RLS) OR schema-per-tenant depending on customer profile
- Adapter marketplace: tenants pick email/SMS/WhatsApp/CRM providers — Lead domain unchanged

## 14 · Cross-cutting Concerns

- **Logging** — structured JSON, correlation ID per request, propagated through outbox events
- **Tracing** — OpenTelemetry spans across intake → repository → outbox dispatch → adapter
- **Metrics** — Prometheus-format counters: leads_created_total, sla_breach_total, outbox_lag_seconds, dnc_blocked_total, conversion_total (per targetType)
- **Health** — `/api/leads/v2/health` returns config version, outbox lag, DLQ size

## 15 · Assumption Register (Architecture)

| # | Assumption | Marker |
|---|---|---|
| A-01 | Existing shared SLA engine remains the SLA implementation — Lead uses SlaPort as thin wrapper | [ASSUMPTION] |
| A-02 | Existing audit hash-chain (module 02) remains authoritative — Lead extends it, does not fork | [ASSUMPTION] |
| A-03 | Supabase Postgres continues as data store through v2.x | [ASSUMPTION] |
| A-04 | IAM module 12 will land before Assignment upgrade (P1) so directory queries are backed by real user data | [ASSUMPTION] |
| A-05 | MRD module 11 will land before lead-attached documents feature (P2) | [ASSUMPTION] |
| A-06 | SMS-Magic sandbox credentials available for staging tests before P1 ships | [ASSUMPTION] |

## 16 · ADRs referenced

- LADR-01…15 from `08_LEAD_MASTER_REENGINEERING.md` — retained
- LADR-16 SMS-Magic sole SMS vendor · [APPROVED]
- LADR-17 90-day reactivation window · [APPROVED]
- LADR-18 Single-approver config with SoD · [APPROVED]
- **LADR-19 · Pure domain entities (not Prisma)** — [APPROVED 2026-09-04]
- **LADR-20 · Transactional outbox for domain events** — [APPROVED 2026-09-04]
- **LADR-21 · Status / Outcome / Archive are three orthogonal concepts** — [APPROVED 2026-09-04]
- **LADR-22 · Duplicates go through review — never auto-merge** — [APPROVED 2026-09-04]
- **LADR-23 · First-touch attribution is immutable; last-touch is versioned** — [APPROVED 2026-09-04]

---

**Document owner:** Engineering
**Next review:** upon completion of P0 build (batches from `06_LEAD_BUILD_MIGRATION.md`)
