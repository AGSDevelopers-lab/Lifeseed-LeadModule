# 06 · Lead Management — Build + Migration Plan (v2.1)

**Status:** ARCHITECTURE FREEZE · Founder-approved 2026-09-04
**Companion docs:** `01_LEAD_PRODUCT_MASTER.md` · `02_LEAD_ARCHITECTURE_MASTER.md` · `03_LEAD_DATA_MODEL.md` · `04_LEAD_STATE_WORKFLOW.md` · `05_LEAD_API_RBAC.md`

> **Golden rules (non-negotiable):**
> - Existing Lead data survives every migration
> - Existing Donor and Recipient conversion continues to work throughout
> - Additive-first migrations · deprecations only after two clean releases
> - Every behavioural change ships behind a feature flag with rollback path
> - No coding starts until documentation batch is signed off

---

## 1 · Priority Framework

| Tier | Definition |
|---|---|
| **P0** | Essential — must land before v2.1 is declared live |
| **P1** | Required for production maturity — lands within v2.1.x |
| **P2** | Important enhancement — v2.2+ |
| **P3** | Future / AI-enabled — v2.3 and beyond |

Every P0 batch is testable independently and reversible via feature flag.

---

## 2 · P0 Backlog (must land in v2.1)

Priorities enforced in this order (top = do first):

1. **Security** — IDOR fix + HMAC cron + WhatsApp signature verification
2. **State machine** — sole authorised path for status mutations
3. **Domain separation** — pure domain entities · ports · no Prisma in domain
4. **Conversion integrity** — ConversionPort + LeadConversion unique constraint
5. **DNC central enforcement** — NotificationPort gate
6. **Concurrency-safe Lead IDs** — Postgres sequence + advisory lock
7. **Outbox** — transactional domain events + dispatcher
8. **Audit consistency** — every material action logs
9. **Tests** — unit + integration + IDOR matrix + state machine coverage

---

## 3 · Build Batches

Each batch below = **one bounded Cursor Composer prompt**. Never combine batches.

### Batch B01 · Foundation (P0)

**Objective:** Additive schema · port scaffolding · domain module skeleton · Vitest setup. Zero behavioural change.

**Files/modules affected:**
- `prisma/schema.prisma` — add entities per `03_LEAD_DATA_MODEL.md` §2 items 2-20 · additive columns on `Lead`, `CallDisposition`, `CounsellingBooking`, `LeadDoNotCallList`, `CrmSyncQueue`
- `prisma/migrations/2026xxxx_lead_v2_1_foundation/` — additive migration
- `src/lib/leads/domain/entities/**` — plain-TS entities (Lead, LeadActivity, LeadFollowUp, LeadStatusHistory, LeadScore, LeadAssignment, LeadFollowUp, CallRecord, CounsellingBooking, CounsellingSession, CounsellingOutcome, Campaign, LeadAttribution, DuplicateCase, LeadMerge, LeadDoNotCall, LeadConversion, LeadConfig, LeadOutboxEvent, NotificationTemplate, NotificationDeliveryLog)
- `src/lib/leads/domain/value-objects/**` — LeadCode, TierScore, ContactInfo, Consent, AttributionTouch, ArchiveMeta
- `src/lib/leads/domain/enums/**`
- `src/lib/leads/domain/errors.ts` — typed errors per `04_LEAD_STATE_WORKFLOW.md` §12
- `src/lib/leads/domain/ports/**` — all 12 port interfaces
- `src/lib/leads/testing/fakes/**` — in-memory port implementations
- `vitest.config.ts` — Lead domain path aliases
- `eslint.config.js` — `no-restricted-imports` rule blocking Prisma/Next/React from domain

**Schema changes:** additive only per `03_LEAD_DATA_MODEL.md` §2

**APIs:** none (schema-only + scaffolding)

**UI changes:** none

**Tests:**
- Compile: `tsc --noEmit` clean
- ESLint layering rule enforces no Prisma/Next in domain
- Domain enum values match `03_LEAD_DATA_MODEL.md`
- In-memory port fakes wire up

**Migration:** `npx prisma migrate deploy` clean; no data change

**Feature flag:** none (schema + scaffolding only)

**Rollback:** `prisma migrate resolve --rolled-back` on the migration; no other side effects

**Acceptance criteria:**
- All new tables exist
- All additive columns present with correct defaults
- Domain layer compiles with zero Prisma/Next imports
- Port fakes usable in unit tests
- No behavioural change visible to users

---

### Batch B02 · Security P0 — IDOR + HMAC cron + WhatsApp signature (P0)

**Objective:** Close known security defects before shipping anything else behavioural.

**Files/modules affected:**
- `src/lib/leads/adapters/prisma-lead-repository.ts` — `byId(id, ctx)` refuses when scope fails
- `src/app/(portals)/telecaller/leads/[id]/**` — swap direct Prisma to application service
- `src/app/(portals)/admin/leads/**` — same
- `src/lib/leads/adapters/hmac-cron.ts` — signature verify + 5-min window
- `src/app/api/leads/v2/internal/**` — wrap with HMAC middleware
- `src/app/api/leads/v2/intake/whatsapp/route.ts` — real Meta signature verification (`X-Hub-Signature-256`)
- `src/app/api/leads/sla/run/route.ts` — accept HMAC OR legacy static secret (with deprecation warning)

**Schema changes:** none

**APIs:** internal cron endpoints migrate to HMAC; WhatsApp intake rejects unsigned bodies

**UI changes:** none

**Tests:**
- IDOR matrix: for each role, attempt access on lead outside scope → 403 · audit row present
- HMAC replay attack rejected (timestamp > 5 min)
- Meta WhatsApp signature valid + invalid + missing all covered

**Migration:** none (behavioural fix only)

**Feature flag:** `LEAD_HMAC_CRON_ENFORCED` (default off; flip on after HMAC rollout validated) · `LEAD_WHATSAPP_SIGNATURE_ENFORCED` (default on in staging + prod immediately)

**Rollback:** flip flag off (temporarily accepts static secret only); WhatsApp signature enforcement cannot be rolled back without security regression — treat as final

**Acceptance criteria:**
- Telecaller A cannot access telecaller B's leads even by URL manipulation — verified by test
- WhatsApp intake accepts only Meta-signed payloads
- Internal crons work with new HMAC; static secret path emits deprecation log

---

### Batch B03 · Concurrency-safe Lead Code (P0)

**Objective:** Replace race-prone generator with Postgres sequence + advisory lock.

**Files/modules affected:**
- New migration: `next_lead_code(city_code text, day date) returns text` PL/pgSQL function + `lead_code_sequences` table
- `src/lib/leads/adapters/prisma-lead-repository.ts` — call `SELECT next_lead_code(...)` instead of app-side retry loop
- `src/lib/leads/domain/value-objects/LeadCode.ts` — parse/validate

**Schema changes:** add `lead_code_sequences (city_code, day, last_used_number)` UNIQUE (city_code, day) + Postgres function

**APIs:** none (internal)

**UI changes:** none

**Tests:**
- 10 concurrent intakes on same city + day yield 10 distinct codes with sequential last-4 digits
- Fallback path handles unexpected duplicate error

**Migration:** additive; new function idempotent (`CREATE OR REPLACE`)

**Feature flag:** `LEAD_CODE_V2_ENABLED` (default off in prod first; flip after 2 weeks in staging)

**Rollback:** flip flag; legacy generator (retry-on-collision) remains

**Acceptance criteria:**
- Zero collisions under load test (1000 concurrent intakes)
- `Lead.code` UNIQUE constraint holds

---

### Batch B04 · State Machine + Activity Double-Write (P0)

**Objective:** Introduce state machine as the sole path for `Lead.status` changes. Existing code paths call state machine AND continue writing legacy fields for backward compat during migration.

**Files/modules affected:**
- `src/lib/leads/domain/state-machine/transitions.ts` — full T-01..T-31 matrix per `04_LEAD_STATE_WORKFLOW.md`
- `src/lib/leads/domain/state-machine/guards.ts` — all guards
- `src/lib/leads/domain/state-machine/invariants.ts`
- `src/lib/leads/application/**` — orchestrations call state machine
- `src/lib/leads/adapters/prisma-lead-repository.ts` — writes LeadStatusHistory + LeadActivity(STATUS_CHANGE) atomically with status update + outbox row
- All server actions that touched `Lead.status` — refactored to call application service, not Prisma
- CI grep guard: fail build if any file outside `state-machine/` writes `status:` on a Lead

**Schema changes:** none (uses tables from B01)

**APIs:** new — `POST /api/leads/v2/leads/{id}/transitions/{event}` · specialised — `POST /v2/leads/{id}/archive|unarchive|reactivate|assign|reassign|claim`

**UI changes:** none in this batch (UI still uses existing screens; server actions rewired)

**Tests:**
- Every T-01..T-31 tested: allowed happy path + at least one denied path + guard failure
- Invariants I-01..I-15 verified where deterministically checkable
- Terminal states reject further transitions except LOST → reactivate within 90 days
- Double-write parity: after transition, `Lead.status` matches latest `LeadStatusHistory.toStatus`
- Outbox row committed atomically (rollback test — throw mid-transaction; nothing persisted)

**Migration:** none (behavioural only)

**Feature flag:** `LEAD_STATE_MACHINE_ENABLED` (default ON in staging; flip in prod after 2 clean weeks; after prod flip, legacy status writes throw)

**Rollback:** flip flag; existing status mutations resume; state machine writes cease

**Acceptance criteria:**
- All existing Path C flows pass
- Every state change writes LeadStatusHistory + LeadActivity + outbox event
- Attempting an illegal transition returns `STATE_TRANSITION_NOT_ALLOWED`
- Reactivation beyond 90 days returns `REACTIVATION_WINDOW_EXPIRED`

---

### Batch B05 · Domain Separation (P0)

**Objective:** Ensure L3 domain has zero framework imports. Prisma types live only in adapters. Repositories map to domain entities.

**Files/modules affected:**
- Refactor all `src/lib/leads/domain/**` imports — remove any Prisma or Next references (should be zero after B01, but sweep to confirm)
- Add `src/lib/leads/adapters/mappers/**` — Prisma→Domain and Domain→Prisma mappers
- Update repositories to return domain entities exclusively

**Schema changes:** none

**APIs:** none

**UI changes:** none

**Tests:**
- Domain unit tests run without Prisma installed (guard via vitest project isolation)
- Mapper round-trip: Domain → Prisma → Domain preserves equality on all fields
- ESLint layering rule catches any Prisma import in domain

**Migration:** none

**Feature flag:** none (refactor)

**Rollback:** git revert

**Acceptance criteria:**
- Zero Prisma imports in `src/lib/leads/domain/**`
- All repository methods return domain entities

---

### Batch B06 · Outbox + Dispatcher (P0)

**Objective:** Transactional outbox live. Domain events published; consumers (CRM, notifications, analytics) subscribe.

**Files/modules affected:**
- `src/lib/leads/domain/events/**` — event class definitions per `03_LEAD_DATA_MODEL.md` §3.19 event catalogue
- `src/lib/leads/application/outbox-dispatcher.ts` — reads pending events, dispatches to subscribed consumers
- `src/lib/leads/adapters/prisma-outbox.ts` — persistence
- `src/app/api/leads/v2/internal/outbox/dispatch/route.ts` — cron endpoint
- Consumer stubs: `crm-consumer.ts`, `notification-consumer.ts`, `analytics-consumer.ts`
- `LeadOutboxDlq` handling + management UI stub in CRM Sync Monitor

**Schema changes:** none (tables from B01)

**APIs:** `POST /api/leads/v2/internal/outbox/dispatch` HMAC-signed

**UI changes:** minimal — CRM Sync Monitor gains outbox lag + DLQ view

**Tests:**
- Event committed atomically with domain change (rollback test)
- Dispatcher claims via `SELECT … FOR UPDATE SKIP LOCKED`; two workers don't double-process
- Per-aggregate ordering preserved
- Retry ladder: 30s, 2m, 10m, 1h, 6h
- After 5 attempts → DLQ

**Migration:** none

**Feature flag:** `LEAD_OUTBOX_ENABLED` (default off; flip after B04)

**Rollback:** flip flag; dispatcher stops; no outbox rows dispatched (they accumulate — safe)

**Acceptance criteria:**
- Every state-changing transaction commits with outbox row
- Dispatcher processes reliably; DLQ handles poison pills
- CRM Sync Monitor shows outbox status

---

### Batch B07 · ConversionPort + Double-Convert Guard (P0)

**Objective:** Route all lead-to-donor and lead-to-recipient conversions through typed ConversionPort. LeadConversion row enforces integrity.

**Files/modules affected:**
- `src/lib/leads/domain/ports/ConversionPort.ts` — signatures
- `src/lib/leads/adapters/his-conversion-adapter.ts` — implements port; wraps existing `createDonorIntake` + Recipient equivalent
- `src/lib/leads/application/convert.ts` — orchestrates state transition + `LeadConversion` insert + downstream creation in single transaction
- Existing `src/lib/leads/lead-conversion.ts` — deprecate; call adapter
- Server actions in telecaller / admin portals refactored

**Schema changes:** `LeadConversion` (already from B01) `UNIQUE (leadId)` enforced

**APIs:** `POST /v2/leads/{id}/convert/donor` · `POST /v2/leads/{id}/convert/recipient` · `GET /v2/leads/{id}/convert/eligibility`

**UI changes:** telecaller lead detail action button wired through new API (functionally same to user)

**Tests:**
- Successful donor conversion creates Donor + LeadConversion + state transition + outbox `LeadConverted` in one transaction
- Double convert attempt → `DUPLICATE_CONVERSION` 409
- Conversion partial failure (downstream throw) rolls back both LeadConversion and Donor create — no orphan rows
- Legacy `Donor.sourceLeadId` still populated

**Migration:** existing converted leads backfilled into `LeadConversion` via one-time script (idempotent)

**Feature flag:** `LEAD_CONVERSION_PORT_ENABLED` (default off; flip after backfill validated)

**Rollback:** flip flag; legacy path resumes

**Acceptance criteria:**
- Zero orphan Donor/Recipient records
- LeadConversion.leadId UNIQUE constraint enforced (attempted violation → 409)

---

### Batch B08 · DNC Central Enforcement + NotificationPort scaffolding (P0)

**Objective:** Every outbound send goes through NotificationPort. DNC gate enforced inside the port — impossible to bypass.

**Files/modules affected:**
- `src/lib/leads/domain/ports/NotificationPort.ts`
- `src/lib/leads/adapters/notification/notification-port.ts` — checks DNC before dispatch
- `src/lib/leads/adapters/notification/in-app-adapter.ts` — implement in-app first
- Existing `src/lib/leads/create-lead.ts` DNC check — moved to `DncService`
- Any Resend inline calls — refactored through port (email adapter shipped as stub — enabled in B12)

**Schema changes:** none (tables from B01)

**APIs:** `POST /v2/dnc/check` (bulk) · `POST /v2/dnc` · `DELETE /v2/dnc/{id}` · `GET /v2/dnc`

**UI changes:** DNC management improvements — bulk operations · authority note capture

**Tests:**
- Every send call: DNC checked FIRST; blocked recipients never reach adapter
- `NotificationDeliveryLog` records both allowed sends and BLOCKED_DNC entries
- Adding DNC entry blocks future sends immediately

**Migration:** `LeadDoNotCallList` rows exploded into `LeadDoNotCall` rows (one-time script)

**Feature flag:** `LEAD_NOTIFICATION_PORT_ENABLED` (default on for in-app; email/SMS/WA off until adapters ready)

**Rollback:** flip flag; legacy inline sends resume

**Acceptance criteria:**
- No code path can call an email/SMS/WhatsApp provider without going through NotificationPort
- DNC-listed contact receives zero outbound comms (verified end-to-end)

---

### Batch B09 · Configuration Store + Single-Approver Workflow (P0/P1 boundary)

**Objective:** All business rules (scoring, SLA, retention, assignment, counselling, follow-up, notification templates, campaign, duplicate) stored in versioned `LeadConfig` with single-approver approval.

**Files/modules affected:**
- `src/lib/leads/adapters/config-store-adapter.ts` — implements ConfigPort
- `src/lib/leads/config/keys.ts` + `defaults.ts` — seed values
- `src/lib/leads/domain/scoring/**` — reads config version at compute time
- Existing hard-coded constants — moved to ConfigPort reads
- New UI: Configuration surface with propose → approve flow · SoD enforced

**Schema changes:** `LeadConfig` seeded with 9 initial keys (SCORE_WEIGHTS_V1, SLA_MATRIX_V1, RETENTION_POLICY_V1, ASSIGNMENT_RULES_V1, FOLLOW_UP_POLICY_V1, COUNSELLING_POLICY_V1, NOTIFICATION_TEMPLATE_MAP_V1, CAMPAIGN_RULES_V1, DUPLICATE_MATCH_RULES_V1) · DB check constraint `approvedByUserId <> createdByUserId`

**APIs:** `GET/POST /v2/config/{key}` · `POST /v2/config/{key}/versions/{version}/approve` (rejects if actor=author with `CONFIG_SOD_VIOLATION`)

**UI changes:** Configuration surface with version diff, approval action, activation timeline

**Tests:**
- Author cannot approve own version — 409 CONFIG_SOD_VIOLATION
- Approval activates version at effectiveFrom (or immediately if unset)
- Prior versions retained + queryable
- Scoring reads change with new config; existing leads retain their `LeadScore.configVersion` reference

**Migration:** seed script populates initial config versions equal to current hard-coded values

**Feature flag:** `LEAD_CONFIG_ENABLED` (default off; flip per key once validated)

**Rollback:** flip flag per key; scoring/SLA/etc fall back to hard-coded constants

**Acceptance criteria:**
- All P0 config keys editable via UI
- Every propose + approve + activate audit-logged
- Single-approver SoD enforced at DB layer

---

### Batch B10 · Follow-up First-Class + Generic Activity API (P1)

**Objective:** LeadFollowUp entity live · generic LeadActivity API surface · follow-up queue UI · SLA integration.

**Files/modules affected:**
- `src/lib/leads/application/follow-up.ts` — CRUD + status transitions
- `src/app/api/leads/v2/leads/{id}/follow-ups/**` + `/v2/follow-ups/**`
- `src/app/api/leads/v2/leads/{id}/activities/**`
- Cron: `POST /v2/internal/follow-ups/tick` — OPEN → DUE → OVERDUE
- New UI: Follow-up Queue surface + Follow-up dock in Telecaller Workspace

**Schema changes:** none (tables from B01)

**APIs:** per `05_LEAD_API_RBAC.md` §2.5 and §2.3

**UI changes:** Follow-up Queue + Follow-up dock

**Tests:**
- Follow-up create → OPEN → DUE at threshold → OVERDUE at lapse → COMPLETED
- Reschedule preserves prior follow-up via `rescheduledFromId`
- SLA warn/breach on OVERDUE

**Migration:** none

**Feature flag:** `LEAD_FOLLOWUP_ENABLED`

**Rollback:** flip flag; UI hides Follow-up Queue

**Acceptance criteria:**
- Telecaller sees due/overdue follow-ups sorted by priority + due time
- Every follow-up creation/completion appends LeadActivity(FOLLOW_UP)

---

### Batch B11 · Counselling Booking + Session + Outcome (P1)

**Objective:** Historical counselling records preserved · Booking / Session / Outcome separated · Counsellor UI rebuilt.

**Files/modules affected:**
- `src/lib/leads/application/counselling.ts` — book, reschedule, cancel, record session, capture outcome, convert
- `src/app/api/leads/v2/counselling/**`
- Cron: `POST /v2/internal/counselling/tick` — reminders + no-show detection
- Counsellor Workspace UI rebuilt

**Schema changes:** none

**APIs:** per §2.6

**UI changes:** Counsellor Workspace + Calendar

**Tests:**
- Reschedule creates new booking with `rescheduledFromBookingId`; prior booking status → RESCHEDULED
- Session record appends; never overwrites
- Outcome record UNIQUE per session
- No-show detected after grace period; state → COUNSELLING_NO_SHOW

**Migration:** existing CounsellingBooking rows retained; add BookingStatus based on current state; no history lost

**Feature flag:** `LEAD_COUNSELLING_HISTORY_ENABLED`

**Rollback:** flip flag; legacy single-booking UI restored

**Acceptance criteria:**
- Counsellor sees full session history for a lead
- No session record can be overwritten (append-only)

---

### Batch B12 · Real Notification Adapters — SMS-Magic, Resend, Meta WhatsApp (P1)

**Objective:** Live outbound comms via NotificationPort adapters.

**Files/modules affected:**
- `src/lib/leads/adapters/notification/resend-email-adapter.ts` — implement
- `src/lib/leads/adapters/notification/sms-magic-adapter.ts` — implement per LADR-16
- `src/lib/leads/adapters/notification/meta-whatsapp-adapter.ts` — implement
- Webhook endpoints for delivery status per §2.16
- `NotificationTemplate` seed for lead intake · counselling reminder · follow-up reminder · SLA breach notice

**Schema changes:** none

**APIs:** notification management endpoints per §2.16

**UI changes:** template management surface + delivery log viewer

**Tests:**
- SMS-Magic send → delivery webhook → `NotificationDeliveryLog` updated with providerMessageId + status
- Email bounce logs `BOUNCED`; retry policy handles transient
- WhatsApp signature valid at webhook

**Migration:** none

**Feature flag:** per-adapter (`LEAD_SMS_ENABLED`, `LEAD_EMAIL_ENABLED`, `LEAD_WHATSAPP_ENABLED`)

**Rollback:** flip adapter flag; sends fail-closed (log entry, no adapter call)

**Acceptance criteria:**
- SMS-Magic sandbox credentials → staging sends verifiable
- All DNC-listed sends blocked upstream
- Every send has a NotificationDeliveryLog entry

---

### Batch B13 · Assignment Upgrade (P1)

**Objective:** Site + shift + skill + language + capacity assignment via AssignmentDirectory. Replaces naive round-robin.

**Files/modules affected:**
- `src/lib/leads/domain/ports/AssignmentDirectory.ts`
- `src/lib/leads/adapters/iam-assignment-directory.ts` — reads from IAM module 12 (or fallback stub if IAM not yet complete)
- `src/lib/leads/application/assign.ts` — new assignment algorithm
- Assignment Centre UI

**Schema changes:** none

**APIs:** `GET /v2/assignment/directory` · `GET /v2/assignment/workload`

**UI changes:** Assignment Centre surface

**Tests:**
- Assignment respects site + shift + language + skill criteria
- Fair rotation when multiple candidates match
- Capacity guard: won't assign beyond max open leads

**Migration:** none

**Feature flag:** `LEAD_ASSIGNMENT_V2_ENABLED`

**Rollback:** flip flag; legacy round-robin

**Acceptance criteria:**
- Load balanced within ±10% across candidates in same criteria bucket
- Cross-site assignment blocked unless supervisor override

---

### Batch B14 · Duplicate Detection + Merge (P1)

**Objective:** Match rules identify EXACT / PROBABLE / POSSIBLE duplicates. Human review via UI. Merge irreversible + audited.

**Files/modules affected:**
- `src/lib/leads/domain/duplicate/**` — match rule engine (reads `DUPLICATE_MATCH_RULES_V1`)
- `src/lib/leads/application/duplicate.ts` — DuplicateCase CRUD + merge
- Duplicate Review UI

**Schema changes:** none

**APIs:** per §2.9

**UI changes:** Duplicate Review surface with side-by-side compare + merge decision

**Tests:**
- Phone exact → EXACT match generated
- Name+phone fuzzy → PROBABLE
- Merge: loser status → LOST (outcome=MERGED, isArchived=true, mergedIntoLeadId set) · winner receives copied activities per strategy
- Loser cannot be merged again (unique constraint)

**Migration:** none

**Feature flag:** `LEAD_DUPLICATE_ENABLED`

**Rollback:** flip flag; DuplicateCase generation stops; existing cases retained for later resume

**Acceptance criteria:**
- All new intakes checked for duplicates
- Ops Manager can merge / keep separate / dismiss with reason
- Merged loser inaccessible from active queues

---

### Batch B15 · Campaign + Attribution (P2)

**Objective:** Campaign definition + first-touch (immutable) + last-touch (versioned) attribution. Analytics per-campaign CAC.

**Files/modules affected:**
- `src/lib/leads/domain/attribution/**`
- `src/lib/leads/application/campaign.ts`
- Campaign Manager UI + Attribution details in Lead 360

**Schema changes:** none (tables from B01)

**APIs:** per §2.11 · Analytics per §2.12

**UI changes:** Campaign Manager surface · Attribution card in Lead 360 · CAC dashboard in Analytics

**Tests:**
- First-touch immutable across subsequent touches
- Last-touch versioned via LeadAttributionHistory
- CAC roll-up matches raw data

**Migration:** historical leads assigned default attribution `{ firstTouch: fromLegacySource, lastTouch: sameAsFirst }` via one-time script (touchType=FIRST)

**Feature flag:** `LEAD_ATTRIBUTION_ENABLED`

**Rollback:** flip flag; attribution capture stops (leads still created; attribution rows optional)

**Acceptance criteria:**
- Every new lead has LeadAttribution row with first-touch set
- Campaign Manager shows active campaigns with lead counts

---

### Batch B16 · Real CRM Adapters — Zoho + Salesforce (P2)

**Objective:** Live CRM sync via outbox consumers.

**Files/modules affected:**
- `src/lib/leads/adapters/crm/zoho-adapter.ts` — real implementation
- `src/lib/leads/adapters/crm/salesforce-adapter.ts` — real implementation
- CRM Sync Monitor UI enhancements
- Retry + DLQ + external ID reconciliation

**Schema changes:** none

**APIs:** per §2.13

**UI changes:** CRM Sync Monitor operational actions

**Tests:**
- Happy sync end-to-end for both providers
- Retry ladder + DLQ
- External ID captured + reconciled

**Migration:** existing CrmSyncQueue rows retained

**Feature flag:** `CRM_SYNC_ENABLED` (existing) + per-provider flag

**Rollback:** flip flag; sync worker idles

**Acceptance criteria:**
- Every LeadConverted event synced to configured CRM within SLA
- DLQ has manual resolve workflow

---

### Batch B17 · Lead 360 + UI Polish (P2)

**Objective:** Kill raw JSON in admin lead detail. All 18 UI surfaces per `02_LEAD_ARCHITECTURE_MASTER.md` §7 (`01_LEAD_PRODUCT_MASTER.md` §5).

**Files/modules affected:**
- `src/app/(portals)/admin/leads/[id]/**` — rebuild as Lead 360
- Telecaller Workspace refresh
- Path C fixes: Aadhaar validation `mode: "onChange"` · tier column rename to "Tier at capture" · Outcome column added

**Schema changes:** none

**APIs:** existing v2 endpoints

**UI changes:** all 18 surfaces present

**Tests:**
- Snapshot tests for each surface (structural)
- Playwright E2E: intake → convert donor flow entirely UI-driven

**Migration:** none

**Feature flag:** `LEAD_360_ENABLED` (default off; flip after review)

**Rollback:** flip flag; old admin lead detail

**Acceptance criteria:**
- Zero raw JSON visible in any operational surface
- All Path C bugs closed

---

### Batch B18 · Deprecations (v2.1.x)

**Objective:** Remove legacy fields once new fields validated in prod for 2+ releases.

**Files/modules affected:**
- Drop `CallDisposition.qaScore`, `.recordingUrl`, `.recordingDurationSec`
- Drop unused SlaEntityType enum values (with usage-count audit script first)
- Drop `Lead.scoreBreakdown` (canonical now `LeadScore.breakdown`)
- Drop `Lead.notes` (canonical now LeadActivity NOTE)
- Migrate `LeadDoNotCallList` view → drop table

**Schema changes:** column drops · enum value removals · view drop

**APIs:** none

**UI changes:** none

**Tests:** grep guard verifies no code references dropped columns

**Migration:** each drop in separate migration for granular rollback

**Feature flag:** none (irreversible after drop; verified deprecation first)

**Rollback:** DB migration `down` restores column (data loss possible — mitigation: 2-release validation)

**Acceptance criteria:**
- Zero code references to deprecated columns
- Prod stable 2 releases post-flip on their replacements

---

### Batch B19..B22 · P3 · AI-enablement (Future)

- **B19** — AI classification (LLM prioritisation) with confidence + human override
- **B20** — AI call summarisation from telecaller notes
- **B21** — Predictive drop-off / churn score
- **B22** — Conversational WhatsApp intake with LLM

All P3 batches follow AI guardrails: data inputs · model + version · confidence · human review · audit · fallback. Never bypass RBAC.

---

## 4 · Testing Strategy Alignment

| Layer | Coverage target | Introduced in |
|---|---|---|
| Domain unit | 90% | B01, B04, B05 |
| Application services | 85% | Every batch that adds a service |
| Adapter integration | 80% | Every batch that adds an adapter |
| Port contract tests | 100% (fake + real prove same behaviour) | B05 onwards |
| API contract | 100% | Every batch that adds APIs |
| E2E (Playwright) | Critical journeys | B04 (state machine), B07 (convert), B11 (counselling), B14 (merge), B17 (Lead 360) |
| IDOR matrix | 100% roles × scopes | B02 |
| DPDP + purge | zero PII residue | B08, B18 |
| Load / perf | intake p95 < 500ms | B03, B06 |
| Outbox reliability | zero-loss on rollback | B06 |

---

## 5 · Cursor Implementation Sequence

Sequential batches — never combined:

```
B01 · Foundation (P0)
B02 · Security P0 (IDOR + HMAC + WA signature) (P0)
B03 · Concurrency-safe Lead Code (P0)
B04 · State Machine + double-write (P0)
B05 · Domain Separation refactor (P0)
B06 · Outbox + Dispatcher (P0)
B07 · ConversionPort + double-convert guard (P0)
B08 · DNC central + NotificationPort scaffold (P0)
B09 · Configuration store + single-approver (P0/P1 boundary)
B10 · Follow-up first-class + generic Activity API (P1)
B11 · Counselling Booking / Session / Outcome (P1)
B12 · Real notification adapters — SMS-Magic + Resend + Meta WA (P1)
B13 · Assignment upgrade (P1)
B14 · Duplicate detection + merge (P1)
B15 · Campaign + Attribution (P2)
B16 · Real CRM adapters — Zoho + Salesforce (P2)
B17 · Lead 360 + UI polish (P2)
B18 · Deprecations (v2.1.x)
B19..B22 · P3 AI enablements (future)
```

Every batch = **one bounded Cursor Composer prompt**. Each prompt will be authored in a subsequent doc (`07_LEAD_CURSOR_BATCH_PROMPTS.md`) once these six masters are frozen. No coding starts until then.

---

## 6 · Rollback + Data Preservation Guarantees

- **No column ever renamed in place** — always additive; deprecation via 2-release grace
- **No row ever hard-deleted from Lead / LeadActivity / LeadStatusHistory / LeadConversion / LeadMerge / LeadOutboxEvent / audit**
- **Feature flags per behavioural batch** — rollback via flag flip
- **Backfill scripts idempotent + resumable** — safe to re-run
- **Legacy denormalised fields (`Lead.status`, `Lead.assignedTelecallerId`, `Lead.convertedDonorId`, `Lead.scoreBreakdown`) kept populated during migration** — dropped only in B18 with validation
- **Compatibility endpoints (`/api/leads/*` v1)** — retained; wrapped by v2 semantics
- **Meta WhatsApp signature enforcement** — cannot be rolled back safely (treat as immediate + final)

---

## 7 · Definition of Done for v2.1

v2.1 is complete when all of the following are true:

- Batches B01–B14 shipped to production behind their flags flipped ON
- Zero P0 defects open
- IDOR matrix test 100% pass
- Outbox lag SLI < 60 seconds p95
- CRM DLQ empty for 2 consecutive weeks
- Config approval SoD verified by attempt-and-deny test
- Reactivation 90-day guard verified
- SMS-Magic sends live with delivery-log coverage
- DNC gate proven — zero DNC breaches in 2 weeks
- Lead 360 replaces raw JSON in admin detail
- OpenAPI spec published at `/api/leads/v2/openapi.json`

---

**Document owner:** Engineering
**Next review:** upon B01 acceptance
