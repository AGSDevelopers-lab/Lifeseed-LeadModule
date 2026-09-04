# 07 · Lead Management — Cursor Composer Batch Prompts (v2.1)

**Status:** ready to use — one prompt per batch, paste into Cursor Composer
**Companion docs:** `01_LEAD_PRODUCT_MASTER.md` · `02_LEAD_ARCHITECTURE_MASTER.md` · `03_LEAD_DATA_MODEL.md` · `04_LEAD_STATE_WORKFLOW.md` · `05_LEAD_API_RBAC.md` · `06_LEAD_BUILD_MIGRATION.md` · `00_CONSISTENCY_AUDIT.md`

> **Rule:** Do NOT concatenate batches. Each prompt = one Cursor Composer conversation. Ship the batch, verify DoD, merge to main, THEN start the next batch.

---

## Standing Preamble (paste at the START of every batch prompt)

```
CONTEXT
You are working on LifeSeed ART Bank HIS, a Next.js 16.3 App Router + TypeScript + 
Prisma 6.19 + Supabase (Postgres, ap-south-1) application. The Lead Management 
module (module 08) is being re-engineered per Founder-approved v2.1 architecture 
freeze dated 2026-09-04.

AUTHORITATIVE SOURCES (read these before writing any code):
  · LifeSeed_App_Specs/Lead_v2_1/01_LEAD_PRODUCT_MASTER.md
  · LifeSeed_App_Specs/Lead_v2_1/02_LEAD_ARCHITECTURE_MASTER.md
  · LifeSeed_App_Specs/Lead_v2_1/03_LEAD_DATA_MODEL.md
  · LifeSeed_App_Specs/Lead_v2_1/04_LEAD_STATE_WORKFLOW.md
  · LifeSeed_App_Specs/Lead_v2_1/05_LEAD_API_RBAC.md
  · LifeSeed_App_Specs/Lead_v2_1/06_LEAD_BUILD_MIGRATION.md

NON-NEGOTIABLE RULES
1. Additive-only DB migrations. Never rename/drop existing columns.
2. Backward compatibility preserved: existing Donor and Recipient conversion flows must continue to work.
3. Every behavioural change ships behind a feature flag (env var checked at runtime).
4. Zero Prisma / Next / React imports inside src/lib/leads/domain/**.
5. Every state mutation on Lead.status goes through the state machine (once B04 lands).
6. Every material action writes to the audit hash-chain (module 02 extension).
7. Write tests as you go. tsc --noEmit + vitest + eslint must pass before you claim done.
8. Do not touch files outside the scope of this batch.
9. Commit at the end. Do NOT create a feature branch — commit to main after all tests pass.
10. If any spec is ambiguous, STOP and ask a specific question rather than guess.

DELIVERY EXPECTATIONS
When done, produce:
  · Summary of files created/modified
  · Summary of DB migration
  · Test run output (tsc + vitest + eslint)
  · Feature flag values needed (with defaults)
  · Any deviation from the spec (must be explicit)
```

---

## Batch B01 · Foundation (P0)

**Prompt title:** `[Lead v2.1] B01 Foundation — additive schema + domain scaffolding`

**Paste this after the standing preamble:**

```
GOAL
Land the Lead v2.1 foundation: additive Prisma schema, pure-TypeScript domain 
layer, 12 port interfaces, in-memory port fakes, Vitest setup, and ESLint 
layering guard. ZERO behavioural change.

SCHEMA — add the following Prisma models (see 03_LEAD_DATA_MODEL.md for exact 
field lists, indexes, constraints):

New models:
  LeadActivity, LeadStatusHistory, LeadScore, LeadAssignment, LeadFollowUp,
  CounsellingSession, CounsellingOutcome, Campaign, LeadAttribution,
  LeadAttributionHistory, DuplicateCase, LeadMerge, LeadConversion,
  LeadConfig, LeadOutboxEvent, LeadOutboxDlq, NotificationTemplate,
  NotificationDeliveryLog

Additive columns on existing Lead model:
  outcome (LeadOutcome enum, nullable)
  isArchived (Boolean, default false)
  archivedAt (DateTime?, tz)
  archivedByUserId (String?)
  archiveReason (String?)
  campaignId (String?)
  latestScoreId (String?)
  latestScoreValue (Int?)
  activeAssignmentId (String?)
  mergedIntoLeadId (String?)
  duplicateOfLeadId (String?)
  redactedAt (DateTime?)
  redactionReason (String?)
  version (Int, default 1)  -- optimistic concurrency

Additive columns on existing CallDisposition:
  activityId (String?)
  followUpId (String?)

Additive columns on existing CounsellingBooking:
  bookingStatus (BookingStatus enum, default 'SCHEDULED')
  rescheduledFromBookingId (String?)
  cancelledReason (String?)
  cancelledByUserId (String?)
  cancelledAt (DateTime?)

Additive columns on existing LeadDoNotCallList (rename happens in B08, not here):
  none for B01

Additive columns on existing CrmSyncQueue:
  outboxEventId (String?)
  operation (CrmOperation enum, nullable in B01, non-null after B06)
  payloadVersion (Int, default 1)
  externalId (String?)
  lastAttemptError (String?)

Add all enums per 03_LEAD_DATA_MODEL.md §4:
  LeadOutcome, LeadActivityType, LeadChannel, LeadEvent, AssignmentType,
  FollowUpType, FollowUpPriority, FollowUpStatus, BookingStatus,
  SessionAttendance, CounsellingRecommendation, CampaignStatus, TouchType,
  MatchLevel, DupReviewStatus, MergeCopyStrategy, DncChannel, DncSource,
  ConversionTarget, LeadEventType, DispatchStatus, DlqResolution,
  NotificationChannel, NotificationProvider, DeliveryStatus, CrmOperation,
  ScoreTrigger

Extend existing enums (add missing values):
  LeadSource: add HOSPITAL_REFERRAL, PARTNER, CAMPAIGN, API, MANUAL
  CrmSyncStatus: add DEAD

Add DB check constraint on LeadConfig:
  approvedByUserId IS NULL OR approvedByUserId <> createdByUserId

Add partial unique indexes:
  LeadAssignment: (leadId) WHERE endedAt IS NULL
  LeadConfig: (key) WHERE isActive = true
  LeadDoNotCallList: keep existing until B08
  LeadConversion: (leadId) UNIQUE
  LeadMerge: (loserLeadId) UNIQUE
  DuplicateCase: composite (LEAST(leftLeadId,rightLeadId), GREATEST(leftLeadId,rightLeadId), matchLevel) UNIQUE

Migration file name: prisma/migrations/2026<date>_lead_v2_1_foundation/

DOMAIN LAYER (src/lib/leads/domain/) — pure TypeScript, NO framework imports:
  entities/  — plain interfaces per 03_LEAD_DATA_MODEL.md §6 mapping rules
    Lead.ts, LeadActivity.ts, LeadFollowUp.ts, LeadStatusHistory.ts,
    LeadScore.ts, LeadAssignment.ts, CallRecord.ts, CounsellingBooking.ts,
    CounsellingSession.ts, CounsellingOutcome.ts, Campaign.ts,
    LeadAttribution.ts, DuplicateCase.ts, LeadMerge.ts, LeadDoNotCall.ts,
    LeadConversion.ts, LeadConfig.ts, LeadOutboxEvent.ts,
    NotificationTemplate.ts, NotificationDeliveryLog.ts
  value-objects/
    LeadCode.ts (parse + validate `LED-{CITY}-{YYYYMMDD}-{XXXX}`),
    TierScore.ts, ContactInfo.ts, Consent.ts, AttributionTouch.ts,
    ArchiveMeta.ts
  enums/
    (mirror Prisma enums as TS union types + const objects)
  events/
    (event class definitions for all 16 event types per 03 §3.19)
  ports/
    LeadRepository.ts, AssignmentDirectory.ts, ConversionPort.ts,
    SlaPort.ts, AuditPort.ts, CrmPort.ts, NotificationPort.ts,
    ConfigPort.ts, IdentityPort.ts, CampaignPort.ts, Clock.ts,
    IdGenerator.ts
  errors.ts (LeadStateTransitionNotAllowedError, LeadGuardFailedError,
    LeadDuplicateConversionError, LeadMergeAlreadyExistsError,
    LeadReactivationWindowExpiredError, LeadDncBlockedError,
    LeadOwnershipDeniedError, LeadConfigVersionMismatchError,
    LeadInvariantViolationError — all extend a LeadDomainError base with
    { code, message, context })
  index.ts (re-exports public domain API)

TESTING SCAFFOLDING (src/lib/leads/testing/):
  fakes/
    InMemoryLeadRepository.ts, FakeConversionPort.ts, FakeSlaPort.ts,
    FakeAuditPort.ts, FakeCrmPort.ts, FakeNotificationPort.ts,
    FakeConfigPort.ts, FakeIdentityPort.ts, FakeCampaignPort.ts,
    FakeAssignmentDirectory.ts, FakeClock.ts, FakeIdGenerator.ts
  fixtures/
    aLead.ts (builder), aQualifiedLead.ts, aCallRecord.ts,
    aCounsellingBooking.ts, aCampaign.ts

VITEST SETUP:
  vitest.config.ts — add project alias @/leads/domain, @/leads/testing
  Ensure domain unit tests run WITHOUT Prisma client available (project isolation)

ESLINT LAYERING GUARD (eslint.config.js or .eslintrc):
  no-restricted-imports rule for src/lib/leads/domain/**:
    forbid: '@prisma/client', 'prisma', 'next', 'next/*', 'react', 'react/*',
      '../adapters/*', '../../adapters/*'
  Same rule for src/lib/leads/application/**:
    forbid react, next UI imports (server actions OK)

TESTS TO WRITE (Vitest):
  · domain/value-objects/LeadCode.test.ts — parse + validate + toString
  · domain/errors.test.ts — every error type constructs + carries context
  · testing/fakes/InMemoryLeadRepository.test.ts — basic CRUD roundtrip
  · Layering: an ESLint test file with an intentional bad import verifies rule fires

ACCEPTANCE CRITERIA
  · npx prisma migrate deploy runs clean on a fresh DB (dev + staging)
  · npx prisma generate produces types with all new models
  · npx tsc --noEmit passes with zero errors
  · npx vitest run passes
  · npx eslint . passes (layering rule enforced)
  · Zero behavioural change: existing intake, telecaller queue, admin lead 
    list, counselling booking all still work exactly as before
  · Commit message: "feat(lead-v2.1): B01 foundation — additive schema + 
    domain scaffolding + port interfaces + fakes + layering guard"

DO NOT DO IN THIS BATCH
  · Wire application services (that's B04+)
  · Add feature flags (nothing to flag yet)
  · Modify existing server actions or UI
  · Rename any table or column
  · Drop any column or enum value
  · Backfill data
```

---

## Batch B02 · Security P0 — IDOR + HMAC cron + WhatsApp signature

**Prompt title:** `[Lead v2.1] B02 Security P0 — IDOR fix + HMAC crons + WhatsApp signature`

```
GOAL
Close three known security defects before shipping any further behavioural 
change:
  1. Telecaller IDOR — a telecaller can deep-link into another telecaller's 
     lead detail. Fix by enforcing ownership at repository layer.
  2. Cron endpoints trust a static X-Cron-Secret. Replace with HMAC + 5-min 
     timestamp replay window.
  3. WhatsApp intake accepts unverified payloads (stub_ok_*). Replace with real 
     Meta X-Hub-Signature-256 verification.

SCOPE
Do not add new features. Only tighten security on existing paths.

FILES TO CREATE
  src/lib/leads/adapters/prisma-lead-repository.ts (initial version — B01 only 
    scaffolded ports; B02 implements the read side with ownership enforcement)
  src/lib/leads/adapters/prisma-audit.ts (write helper for denial rows)
  src/lib/security/hmac-cron.ts
    · function verifyHmacRequest(req, secret): boolean throws HmacInvalidError 
      or HmacReplayError (5-min window enforced against t=<epoch> in header 
      X-LifeSeed-Cron-Signature: t=<epoch>, v1=<HMAC-SHA256(t+"."+body,secret)>)
    · function signHmacBody(body, secret): { header, timestamp }
  src/lib/security/meta-whatsapp-signature.ts
    · function verifyMetaSignature(req, appSecret): boolean
      (X-Hub-Signature-256 header, sha256 HMAC over raw body)
  src/lib/leads/adapters/identity-adapter.ts
    · resolves current session user + role + siteId + assignment scope

FILES TO MODIFY
  src/app/(portals)/telecaller/leads/[id]/page.tsx
    · Load lead via LeadRepository.byId(id, ctx) — repository throws 
      LeadOwnershipDeniedError when scope fails
    · Wrap in try/catch returning notFound() to prevent existence disclosure
    · Audit both success (view) and denied access
  src/app/(portals)/telecaller/leads/[id]/lead-call-panel.tsx
    · Same ownership refactor for any server actions inside
  src/app/(portals)/telecaller/leads/[id]/book-counselling/page.tsx
    · Same
  src/app/(portals)/admin/leads/[id]/page.tsx
    · Site-scoped read; SUPER_ADMIN allowed cross-site, MED_DIR read-only
  src/app/api/leads/intake/whatsapp/route.ts
    · Remove stub_ok_* code path
    · Enforce Meta signature via verifyMetaSignature; reject 401 HMAC_INVALID 
      on failure
    · Read META_APP_SECRET from env
  src/app/api/leads/sla/run/route.ts
    · Accept EITHER static X-Cron-Secret (deprecated — log warning) OR HMAC 
      header per LEAD_HMAC_CRON_ENFORCED flag semantics
    · When flag = 'strict', reject static secret path
  src/app/api/leads/crm-sync/run/route.ts — same treatment
  src/app/api/leads/purge-expired/route.ts — same treatment

FEATURE FLAGS (env vars, defaults in code + .env.example)
  LEAD_HMAC_CRON_ENFORCED = 'off' | 'permissive' | 'strict'
    default 'permissive' in staging (both work; log warning on static)
    default 'off' in prod initially; flip to 'permissive' after HMAC deployed; 
      then 'strict' after 2 clean weeks
  LEAD_WHATSAPP_SIGNATURE_ENFORCED = 'on' | 'off'
    default 'on' in staging + prod immediately (no rollback path)

ENV VARS REQUIRED (add to .env.example)
  META_APP_SECRET=            # WhatsApp Cloud API app secret
  LEADS_CRON_HMAC_SECRET=     # rotating HMAC secret for internal crons
  LEADS_CRON_SECRET=          # legacy (already exists; keep during migration)

TESTS TO WRITE (Vitest + supertest for API)
  · IDOR matrix (integration): for each role in {TELECALLER, SR_TELECALLER, 
    COUNSELLOR, OPS_MANAGER, MARKETING_MGR, MED_DIR, SUPER_ADMIN}, attempt to
    fetch a lead outside scope → expect 404 or 403 (per role) + audit row 
    with denialReason
  · verifyHmacRequest: valid header + body → true; wrong timestamp (> 5 min) 
    → HmacReplayError; wrong signature → HmacInvalidError
  · verifyMetaSignature: valid Meta payload passes; tampered body fails; 
    missing header fails
  · API integration: /api/leads/intake/whatsapp with unsigned body → 401
  · API integration: /api/leads/sla/run under 'strict' with static secret → 401

ACCEPTANCE CRITERIA
  · IDOR test: telecaller-A cannot access telecaller-B's lead (all attempts 
    return notFound; audit row present)
  · WhatsApp intake with valid Meta signature succeeds; without → 401 
    HMAC_INVALID
  · Internal crons succeed with valid HMAC; replay attempts (timestamp too 
    old) return 401 HMAC_REPLAY
  · Static-secret path emits deprecation log line
  · tsc + vitest + eslint clean
  · No functional regression in telecaller queue, admin lead list, cron 
    behaviour
  · Commit message: "fix(lead-v2.1): B02 security — close IDOR + HMAC cron 
    + Meta WhatsApp signature verification"

DO NOT DO
  · Add state machine (B04)
  · Wire outbox (B06)
  · Change WhatsApp intake business behaviour beyond signature enforcement
  · Alter existing SLA cron behaviour beyond auth
```

---

## Batch B03 · Concurrency-safe Lead Code

**Prompt title:** `[Lead v2.1] B03 Concurrency-safe Lead Code generator`

```
GOAL
Replace the race-prone retry-on-collision lead code generator with a Postgres 
sequence + advisory lock helper. Format retained: LED-{CITY}-{YYYYMMDD}-{XXXX}.

SCHEMA CHANGES
  Migration: 2026<date>_lead_code_sequences/
  1. Create table lead_code_sequences (
       city_code TEXT NOT NULL,
       day DATE NOT NULL,
       last_used_number INTEGER NOT NULL DEFAULT 0,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       PRIMARY KEY (city_code, day)
     );
  2. CREATE OR REPLACE FUNCTION next_lead_code(p_city_code TEXT, p_day DATE)
     RETURNS TEXT LANGUAGE plpgsql AS $$
     DECLARE
       v_lock_key BIGINT;
       v_next INT;
     BEGIN
       v_lock_key := hashtext(p_city_code || ':' || p_day::text)::BIGINT;
       PERFORM pg_advisory_xact_lock(v_lock_key);
       INSERT INTO lead_code_sequences (city_code, day, last_used_number)
         VALUES (p_city_code, p_day, 1)
       ON CONFLICT (city_code, day)
         DO UPDATE SET last_used_number = lead_code_sequences.last_used_number + 1,
                       updated_at = now()
       RETURNING last_used_number INTO v_next;
       RETURN format('LED-%s-%s-%s',
                     upper(p_city_code),
                     to_char(p_day,'YYYYMMDD'),
                     lpad(v_next::text, 4, '0'));
     END $$;
  3. Add UNIQUE constraint on Lead.code if not already present.

FILES TO CREATE
  src/lib/leads/adapters/prisma-lead-code-generator.ts
    · export async function generateLeadCode(prisma, cityCode, day = now()): 
        Promise<string> that calls SELECT next_lead_code($1,$2)::text
    · handles the LEAD_CODE_V2_ENABLED feature flag and falls back to legacy
      retry-on-collision generator when off
  src/lib/leads/domain/value-objects/LeadCode.test.ts (extend from B01)
    · parse fixture codes, validate format

FILES TO MODIFY
  src/lib/leads/lead-code-generator.ts (existing)
    · KEEP as-is; expose as legacy fallback
  src/lib/leads/create-lead.ts (existing)
    · When LEAD_CODE_V2_ENABLED === 'on', call new generator; else legacy

FEATURE FLAG
  LEAD_CODE_V2_ENABLED = 'on' | 'off' (default 'off' in prod; flip after 
    staging validation)

TESTS TO WRITE
  · Load test (vitest w/ Prisma test DB or a small script under 
    scripts/lead-code-race-test.ts): kick off 100 concurrent 
    generateLeadCode('KOL', today) invocations → expect 100 distinct codes, 
    sequence values 0001..0100 (no gaps, no collisions)
  · Verify that day rollover produces a fresh sequence (0001 next day)
  · Legacy fallback path (flag off) still works via retry loop

ACCEPTANCE CRITERIA
  · Load test passes (100 concurrent, zero collisions)
  · Lead.code UNIQUE constraint holds
  · Migration deploys cleanly; function idempotent (CREATE OR REPLACE)
  · Commit message: "fix(lead-v2.1): B03 concurrency-safe lead code via 
    Postgres advisory lock + sequence table"

DO NOT DO
  · Change lead code format
  · Remove legacy generator (needed as fallback until flag flip stable)
```

---

## Batch B04 · State Machine + Activity Double-Write

**Prompt title:** `[Lead v2.1] B04 State machine — sole authorised path for Lead.status`

```
GOAL
Introduce the Lead state machine as the ONLY authorised mechanism to change 
Lead.status. Existing code paths call the state machine AND continue writing 
legacy fields for backward compat (double-write pattern). After validation, 
flip flag → legacy direct writes throw.

READ FIRST
  04_LEAD_STATE_WORKFLOW.md — full 31-transition table (§3) + guards (§5) + 
  invariants (§11) + typed errors (§12)

FILES TO CREATE
  src/lib/leads/domain/state-machine/
    transitions.ts — export all 31 transitions T-01..T-31 as pure functions:
      transition(currentLead, event, ctx): TransitionResult
      where TransitionResult = { nextStatus, writes: DomainWrite[],
        notifications: NotificationSpec[], auditEntries: AuditEntry[],
        outboxEvents: OutboxEventSpec[] }
    guards.ts — every guard from §5 as pure function:
      hasConsent, notInDnc, ownershipCheck, permissionCheck, hasRequiredFields,
      noDuplicateConversion, withinReactivationWindow, notMerged,
      counsellorAvailable, attemptsRemaining, configVersionActive
    invariants.ts — assertion helpers for I-01..I-15
    events.ts — LeadEvent union type + factory functions
    index.ts — re-exports
  src/lib/leads/application/
    intake.ts — orchestrates T-01 (intake)
    qualify.ts — orchestrates T-05..T-14 (dispositions)
    assign.ts — T-02, T-03, T-04
    counselling.ts — T-15, T-17, T-18, T-19, T-20, T-22, T-23
    convert.ts — T-16, T-22 (delegates to ConversionPort in B07; stubbed for B04)
    archive.ts — T-27, T-28
    reactivate.ts — T-29
    merge.ts — T-31 (stub; full impl B14)
    expire.ts — T-30
    __apply-transition.ts — shared helper that:
      1. Loads Lead via LeadRepository (with ownership check)
      2. Calls state-machine transition() with ctx
      3. Runs invariants
      4. Opens single Prisma transaction, applies all writes: 
         Lead.status update + LeadStatusHistory + LeadActivity(STATUS_CHANGE) 
         + LeadOutboxEvent + specific side-effect rows
      5. Emits audit rows
      6. Returns updated domain entity

FILES TO MODIFY
  src/lib/leads/adapters/prisma-lead-repository.ts (from B02)
    · Add appendActivity, appendStatusHistory, appendAssignment, 
      appendScore, appendFollowUp, appendOutboxEvent methods
    · All within a single db.$transaction wrapper accepting a callback
    · The Lead.status update in this transaction is the only allowed path
  src/app/(portals)/telecaller/leads/[id]/lead-call-panel.tsx
    · Any disposition action calls application/qualify.ts, NOT Prisma directly
  src/app/(portals)/telecaller/leads/[id]/book-counselling/book-form.tsx
    · Booking action calls application/counselling.ts
  src/app/(portals)/admin/leads/**
    · Any status mutation calls appropriate application service
  src/lib/leads/create-lead.ts
    · Delegate to application/intake.ts

NEW APIS
  POST /api/leads/v2/leads/[id]/transitions/[event]/route.ts
    · Body: { reason?, ...event-specific data }
    · Auth: session + permission per §6 of 04_LEAD_STATE_WORKFLOW.md
    · Dispatches to appropriate application service
  POST /api/leads/v2/leads/[id]/archive/route.ts
  POST /api/leads/v2/leads/[id]/unarchive/route.ts
  POST /api/leads/v2/leads/[id]/reactivate/route.ts — enforces 90-day guard, 
    returns 409 REACTIVATION_WINDOW_EXPIRED on failure
  POST /api/leads/v2/leads/[id]/assign/route.ts
  POST /api/leads/v2/leads/[id]/reassign/route.ts
  POST /api/leads/v2/leads/[id]/claim/route.ts

CI GUARD
  Add scripts/guard-lead-status-writes.sh (bash) that greps for 
  `status:\s*['"]NEW\|ASSIGNED\|CONTACTED_QUALIFIED\|...` in TS files 
  outside src/lib/leads/domain/state-machine and 
  src/lib/leads/adapters/prisma-lead-repository.ts. Fail if any match.
  Wire into CI or as a pre-commit hook.

FEATURE FLAG
  LEAD_STATE_MACHINE_ENABLED = 'off' | 'shadow' | 'on' | 'strict'
    off — legacy path only (rollback)
    shadow — state machine runs alongside legacy writes; compare + log 
      discrepancies (staging default first week)
    on — state machine is primary; legacy writes still emitted for compat
    strict — legacy direct-write paths throw; state machine is sole path 
      (target end state)

TESTS TO WRITE
  · Every transition T-01..T-31 covered:
    · Happy path (allowed) → expected writes emitted + LeadStatusHistory 
      row created + outbox event created
    · At least one denied path (wrong actor, wrong current state, or guard 
      failure) → typed domain error thrown, no writes
  · Terminal states (CONVERTED, EXPIRED_AUTO_PURGED) reject all transitions
  · LOST rejects all transitions EXCEPT reactivate; reactivate rejected when 
    lostAt > 90 days ago (T-29 guard)
  · Invariant tests:
    · I-01 grep guard: attempting a Lead.status write from outside allowed 
      files fails CI
    · I-03: attempting a second LeadConversion insert for same leadId → 
      DUPLICATE_CONVERSION 409
    · I-05: attempting a second active LeadAssignment (endedAt IS NULL) 
      violates partial unique index
    · I-14: reactivation guard fires beyond 90 days
  · Double-write parity: after any transition, Lead.status matches the 
    latest LeadStatusHistory.toStatus (staging shadow mode logs mismatches)
  · Transaction rollback: throw inside application service mid-transition → 
    NOTHING persisted (no status change, no history, no outbox)

ACCEPTANCE CRITERIA
  · All existing Path C flows still pass (intake, qualify, book counselling, 
    convert donor, convert recipient, DNC)
  · No file outside allowed set writes Lead.status directly
  · Illegal transitions → STATE_TRANSITION_NOT_ALLOWED 409 with detail
  · Reactivation beyond 90 days → REACTIVATION_WINDOW_EXPIRED 409
  · Feature flag ships default 'shadow' in staging + 'off' in prod
  · Commit message: "feat(lead-v2.1): B04 state machine — 31 transitions + 
    guards + invariants + application services + CI guard"

DO NOT DO
  · Wire outbox dispatcher (B06 — outbox rows are created but not yet 
    processed; safe accumulation)
  · Wire ConversionPort (B07 — convert flow uses stub in this batch, 
    behavioural parity preserved)
  · Rebuild UI (B17)
```

---

## Batch B05 · Domain Separation Refactor

**Prompt title:** `[Lead v2.1] B05 Domain separation — pure entities + mappers`

```
GOAL
Confirm and enforce: L3 domain layer has ZERO framework imports. Prisma types 
live only in adapters. All repository methods return domain entities (not 
PrismaLead).

FILES TO CREATE
  src/lib/leads/adapters/mappers/
    lead-mapper.ts — toDomain(prismaLead): Lead ; toPrisma(lead): PrismaInput
    activity-mapper.ts, follow-up-mapper.ts, assignment-mapper.ts,
    score-mapper.ts, status-history-mapper.ts, counselling-*-mapper.ts,
    campaign-mapper.ts, attribution-mapper.ts, duplicate-case-mapper.ts,
    merge-mapper.ts, dnc-mapper.ts, conversion-mapper.ts,
    config-mapper.ts, outbox-event-mapper.ts, notification-*-mapper.ts

FILES TO MODIFY
  src/lib/leads/adapters/prisma-lead-repository.ts (from B02-B04)
    · Every method returns domain entities via mapper
    · Every input parameter mapped to Prisma via mapper
  All application services (from B04) — ensure they receive/return domain 
    entities, never PrismaLead
  Any residual Prisma imports in domain/ — remove

ADDITIONAL CI GUARD
  eslint no-restricted-imports for src/lib/leads/domain/**:
    forbid @prisma/client, prisma, next, next/*, react

TESTS TO WRITE
  · Round-trip: lead → toPrisma → toDomain equals original (excluding 
    computed fields like updatedAt)
  · Same for every entity
  · Domain unit tests run in a vitest project that has @prisma/client 
    excluded from resolve (proves no accidental Prisma dependency)
  · Application service tests use in-memory fakes (from B01) — no Prisma 
    required

ACCEPTANCE CRITERIA
  · Zero @prisma/client imports in src/lib/leads/domain/**
  · Every repository method returns domain entity types
  · Round-trip tests pass
  · eslint layering rule enforced
  · Commit message: "refactor(lead-v2.1): B05 domain separation — pure 
    entities + Prisma↔Domain mappers + layering guard tightened"

DO NOT DO
  · Change any business behaviour
  · Introduce new features
```

---

## Batch B06 · Outbox + Dispatcher

**Prompt title:** `[Lead v2.1] B06 Transactional outbox + dispatcher`

```
GOAL
Wire the transactional outbox live. Domain events published from state-machine 
transitions accumulate in LeadOutboxEvent; a dispatcher cron reads, dispatches 
to subscribed consumers (CRM stub, notification stub, analytics stub), handles 
retry + DLQ.

FILES TO CREATE
  src/lib/leads/application/outbox-dispatcher.ts
    · dispatchPending(batchSize = 50, ctx): Promise<DispatchSummary>
    · Uses SELECT ... FOR UPDATE SKIP LOCKED to claim rows
    · Preserves per-aggregate ordering (only picks earliest occurredAt per aggregateId)
    · Sets dispatchStatus = IN_FLIGHT + lockedUntil = now + 60s + lockedByWorkerId
    · Calls each subscribed consumer; on failure records error + increments attemptCount
    · Retry ladder: 30s, 2m, 10m, 1h, 6h (compute nextRetryAt from attemptCount)
    · After 5 attempts → move to LeadOutboxDlq + mark original as DEAD
    · On success → set publishedAt + dispatchStatus = PUBLISHED
  src/lib/leads/application/consumers/
    crm-consumer.ts — stub: writes CrmSyncQueue row per outbox event 
      (real CRM adapters land in B16; this batch only enqueues)
    notification-consumer.ts — stub: for LeadAssigned + CounsellingBooked + 
      LeadFollowUpCreated, enqueue notification via NotificationPort (in-app 
      only for B06; real adapters B12)
    analytics-consumer.ts — stub: increments Prometheus-format counters
  src/lib/leads/adapters/prisma-outbox.ts
    · Repository for LeadOutboxEvent + LeadOutboxDlq CRUD + claim
  src/app/api/leads/v2/internal/outbox/dispatch/route.ts
    · HMAC-signed (B02 helper); tick handler calls dispatchPending

FILES TO MODIFY
  src/lib/leads/application/__apply-transition.ts (from B04)
    · Confirm outbox row created in same transaction as domain writes
  src/lib/leads/application/intake.ts (from B04) — same

FEATURE FLAG
  LEAD_OUTBOX_ENABLED = 'off' | 'on'
    default 'off' in prod initially; outbox rows still accumulate but nothing 
    dispatched (safe — no data loss)

CRON SCHEDULE (Vercel cron or platform equivalent)
  Every 30 seconds: POST /api/leads/v2/internal/outbox/dispatch

TESTS TO WRITE
  · Atomicity: throw inside application service after state transition + 
    outbox insert → both rolled back
  · Two workers claim different rows (SKIP LOCKED verified via parallel test)
  · Per-aggregate ordering: two events for same leadId with occurredAt A < B 
    → A published before B (verified via consumer call order)
  · Retry: transient consumer failure → attemptCount++, dispatchStatus = 
    FAILED, next retry at correct time
  · DLQ: 5 failures → moved to LeadOutboxDlq, original marked DEAD
  · Consumer isolation: CRM consumer throws → notification consumer still 
    called for same event (independent subscriptions)
  · Lease timeout: locked row past lockedUntil re-claimable by different worker
  · Flag off: dispatchPending returns { skipped: true } and does not touch rows

ACCEPTANCE CRITERIA
  · All 16 event types from 03 §3.19 dispatchable
  · Zero lost events under rollback test
  · DLQ populated on max attempts
  · Metrics: outbox_lag_seconds < 60 p95 in staging
  · Commit message: "feat(lead-v2.1): B06 transactional outbox + dispatcher 
    + CRM/notification/analytics consumers (stubs)"

DO NOT DO
  · Real CRM adapters (B16)
  · Real notification providers beyond in-app (B12)
  · Backpressure/rate limiting on dispatch (later)
```

---

## Batch B07 · ConversionPort + Double-Convert Guard

**Prompt title:** `[Lead v2.1] B07 ConversionPort + LeadConversion double-convert guard`

```
GOAL
Route all lead-to-donor and lead-to-recipient conversions through ConversionPort. 
LeadConversion(leadId) UNIQUE prevents double conversion. Backfill existing 
converted leads.

FILES TO CREATE
  src/lib/leads/adapters/his-conversion-adapter.ts
    · implements ConversionPort
    · convertToDonor(input, ctx): calls existing createDonorIntake with prefilled 
      data (fullName, phone, email, siteId, dateOfBirth, personType=DONOR, 
      donorSubtype, etc.); returns { donorId, donorCode }
    · convertToRecipient(input, ctx): calls existing recipient creation service
    · isEligibleForDonor / isEligibleForRecipient: checks required fields, DNC, 
      no existing LeadConversion — returns EligibilityResult { eligible, 
      reasons[] }
  src/lib/leads/application/convert.ts (replace B04 stub)
    · Full impl of T-16 (convert_donor) and T-22 (convert_recipient) using 
      the port; single transaction spans:
        1. State machine transition
        2. LeadConversion insert (UNIQUE guard fires on double-convert)
        3. Downstream Donor/Recipient creation via port
        4. Denormalised Lead.convertedDonorId / convertedRecipientId / 
           convertedAt / outcome=WON populated (for backward compat)
        5. LeadActivity(CONVERSION) + LeadStatusHistory + LeadOutboxEvent(LeadConverted)
        6. Complete LEAD_QUALIFICATION SLA
  scripts/backfill-lead-conversions.ts
    · One-time idempotent script: for every existing Lead with 
      convertedDonorId OR convertedRecipientId, insert a LeadConversion row 
      (if not exists) with occurredAt = Lead.convertedAt, 
      decidedByUserId = Lead.assignedTelecallerId (fallback SYSTEM), 
      eligibilitySnapshot = { backfill: true }, notes = 'v2.1_backfill'

FILES TO MODIFY
  src/lib/leads/lead-conversion.ts (existing) — deprecate: delegate to 
    adapter; log deprecation warning if flag off
  src/app/(portals)/telecaller/leads/[id]/lead-call-panel.tsx — convert action 
    calls new API
  src/app/(portals)/counsellor/**/** — same

NEW APIS
  POST /api/leads/v2/leads/[id]/convert/donor/route.ts
  POST /api/leads/v2/leads/[id]/convert/recipient/route.ts
  GET  /api/leads/v2/leads/[id]/convert/eligibility/route.ts

FEATURE FLAG
  LEAD_CONVERSION_PORT_ENABLED = 'off' | 'on'
    default 'off' in prod; flip after backfill verified

TESTS TO WRITE
  · Happy path donor convert: state → CONVERTED, LeadConversion row created, 
    Donor row created, sourceLeadId populated, outbox LeadConverted event 
    emitted, all in single transaction
  · Happy path recipient convert: same pattern
  · Double convert (same lead twice) → DUPLICATE_CONVERSION 409 + no second 
    Donor/Recipient created
  · Downstream failure (mock ConversionPort throws) → transaction rolled back, 
    no LeadConversion, no Donor
  · Eligibility check: missing required fields → not eligible with reasons; 
    DNC present → not eligible; existing conversion → not eligible
  · Backfill script: run twice → idempotent, no duplicate rows

ACCEPTANCE CRITERIA
  · Existing donor + recipient conversion flows work identically to user 
    (behavioural parity)
  · LeadConversion.leadId UNIQUE constraint enforced end-to-end
  · Backfill covers 100% of existing converted leads
  · Legacy Donor.sourceLeadId / Recipient.sourceLeadId still populated
  · Commit message: "feat(lead-v2.1): B07 ConversionPort + LeadConversion 
    double-convert guard + backfill"

DO NOT DO
  · Remove Lead.convertedDonorId / convertedRecipientId (kept as denormalised 
    convenience, dropped only in B18)
  · Change downstream Donor/Recipient models
```

---

## Batch B08 · DNC Central Enforcement + NotificationPort scaffolding

**Prompt title:** `[Lead v2.1] B08 DNC central enforcement + NotificationPort (in-app)`

```
GOAL
Every outbound send goes through NotificationPort. DNC gate enforced inside 
the port — impossible to bypass. Migrate LeadDoNotCallList → LeadDoNotCall 
with source/expiry/authority fields.

FILES TO CREATE
  src/lib/leads/adapters/notification/notification-port.ts
    · Central sender: validates recipient via DNC lookup (unless respectDnc=false 
      AND explicit override), records NotificationDeliveryLog with dncCheckedAt 
      and dncPassed; if blocked, writes BLOCKED_DNC log entry and returns 
      { blocked: true, reason: 'DNC' }
    · Dispatches to registered adapter for channel+provider
  src/lib/leads/adapters/notification/in-app-adapter.ts
    · Writes an in-app notification row (uses existing notification-hub if 
      present; else a minimal NotificationInApp table)
  src/lib/leads/adapters/notification/resend-email-adapter.ts (STUB — real B12)
  src/lib/leads/adapters/notification/sms-magic-adapter.ts (STUB — real B12)
  src/lib/leads/adapters/notification/meta-whatsapp-adapter.ts (STUB — real B12)
  src/lib/leads/application/dnc.ts — DNC CRUD + centralised isBlocked lookup
  scripts/migrate-dnc-to-v2.ts — one-time idempotent:
    · For each row in LeadDoNotCallList with phone, insert LeadDoNotCall 
      { channel: PHONE, value: normalisedPhone, source: 'MANUAL' (default), 
        createdAt/updatedAt preserved }
    · For each row with email, insert LeadDoNotCall { channel: EMAIL, 
      value: lowercasedEmail, source: 'MANUAL' }
    · Create a Postgres VIEW LeadDoNotCallList AS SELECT ... FROM LeadDoNotCall 
      (backward compat)

SCHEMA MIGRATION
  Migration: 2026<date>_dnc_migration/
  1. Add columns to LeadDoNotCallList: source, effectiveFrom, effectiveUntil, 
     removalAuthorityUserId, removedAt, createdByUserId (nullable initially)
  2. Rename LeadDoNotCallList table to LeadDoNotCall (using ALTER TABLE RENAME)
  3. Add channel column with default derivation via one-time UPDATE (rows with 
     non-null phone → PHONE, rows with non-null email → EMAIL, both → split 
     via migration script)
  4. Add unique partial index on (channel, normalisedValue) WHERE removedAt IS NULL
  5. Create VIEW LeadDoNotCallList AS SELECT id, phone, email, createdAt, 
     updatedAt FROM LeadDoNotCall (retain read compat)
  Migration should be reversible and idempotent.

FILES TO MODIFY
  src/lib/leads/create-lead.ts — DNC check delegates to dnc.ts (was inline)
  Any existing Resend inline calls in the codebase → refactored through 
    NotificationPort (email adapter stub logs the intent but returns success 
    until B12 wires real Resend)

NEW APIS
  GET    /api/leads/v2/dnc/route.ts
  POST   /api/leads/v2/dnc/route.ts
  POST   /api/leads/v2/dnc/check/route.ts (bulk lookup, internal)
  DELETE /api/leads/v2/dnc/[id]/route.ts

UI CHANGES
  Enhance existing DNC management surface (admin + telecaller):
    · Show source, effectiveFrom/Until, removal authority
    · Add authority note requirement on remove
    · Bulk import via CSV

FEATURE FLAG
  LEAD_NOTIFICATION_PORT_ENABLED = 'off' | 'in_app_only' | 'on'
    default 'in_app_only' in prod for B08 (real providers off, DNC gate enforced 
    on all channels)

TESTS TO WRITE
  · NotificationPort blocks DNC'd recipient (all 4 channels)
  · BLOCKED_DNC log entry written when send blocked
  · Successful send writes NotificationDeliveryLog with dncPassed=true + 
    provider stub id
  · Adding DNC entry immediately blocks subsequent sends (no cache stale)
  · dnc.ts unit tests: normaliseValue (E.164 phone, lowercase email); 
    lookupChannel matches ALL wildcard
  · Migration idempotency: run twice → no data corruption
  · Legacy view LeadDoNotCallList returns same rows as before migration

ACCEPTANCE CRITERIA
  · No code path can send outbound without going through NotificationPort
  · DNC-listed recipient receives zero comms (verified end-to-end integration 
    test)
  · Migration preserves 100% of existing DNC entries
  · Backward-compat view works for legacy queries
  · Commit message: "feat(lead-v2.1): B08 DNC central enforcement + 
    NotificationPort (in-app live, email/SMS/WA stubs) + LeadDoNotCall migration"

DO NOT DO
  · Wire real Resend / SMS-Magic / Meta WhatsApp (B12)
  · Drop LeadDoNotCallList view (needed for compat until B18)
```

---

## Batch B09 · Configuration Store + Single-Approver Workflow

**Prompt title:** `[Lead v2.1] B09 LeadConfig store + single-approver workflow (SoD)`

```
GOAL
All business rules (scoring, SLA, retention, assignment, follow-up, 
counselling, notification templates, campaign, duplicate) stored in versioned 
LeadConfig with single-approver approval. Author cannot approve own version 
(SoD enforced at DB check constraint).

FILES TO CREATE
  src/lib/leads/adapters/config-store-adapter.ts
    · implements ConfigPort
    · read<T>(key, version?): payload cached in LRU (5-min TTL, invalidated 
      on new version activation)
    · currentVersion(key): active version
    · history(key): all versions
  src/lib/leads/config/keys.ts
    · export const CONFIG_KEYS = { SCORE_WEIGHTS_V1, SLA_MATRIX_V1, 
      RETENTION_POLICY_V1, ASSIGNMENT_RULES_V1, FOLLOW_UP_POLICY_V1, 
      COUNSELLING_POLICY_V1, NOTIFICATION_TEMPLATE_MAP_V1, CAMPAIGN_RULES_V1, 
      DUPLICATE_MATCH_RULES_V1 }
  src/lib/leads/config/schemas.ts
    · Zod schemas per key
  src/lib/leads/config/defaults.ts
    · Frozen v1 defaults exactly matching current hard-coded values
  scripts/seed-lead-config-defaults.ts
    · Insert version 1 for each key with createdByUserId + approvedByUserId 
      = SYSTEM_USER_ID; approvedAt = now; isActive = true
  src/app/api/leads/v2/config/[key]/route.ts — GET + POST (propose new version)
  src/app/api/leads/v2/config/[key]/versions/[version]/approve/route.ts — POST
    · Rejects with 409 CONFIG_SOD_VIOLATION if actorUserId === createdByUserId
  src/app/api/leads/v2/config/[key]/versions/route.ts — GET history
  src/app/(portals)/admin/leads/config/**
    · Configuration UI surface with version diff, approve action, activation 
      timeline

FILES TO MODIFY
  src/lib/leads/lead-scoring.ts (existing)
    · Read weights from ConfigPort (fallback to defaults if flag off)
  src/lib/leads/lead-assignment.ts (existing) — same for ASSIGNMENT_RULES_V1
  src/lib/sla/engine.ts — read tier→SLA duration mapping from SLA_MATRIX_V1
  Retention purge cron — read policy from RETENTION_POLICY_V1
  Duplicate detection (future B14) — reads DUPLICATE_MATCH_RULES_V1

FEATURE FLAG
  LEAD_CONFIG_ENABLED = 'off' | 'partial' | 'on'
    off — always use hard-coded defaults
    partial — read from ConfigPort but fall back to defaults on missing key
    on — always read from ConfigPort; missing key → error

TESTS TO WRITE
  · Author cannot approve own version — 409 CONFIG_SOD_VIOLATION
  · Approval activates version; prior version's effectiveUntil = new 
    effectiveFrom
  · Prior version retained + queryable
  · Scoring reads change when new SCORE_WEIGHTS_V1 activated (integration test 
    with score-golden fixtures)
  · Existing LeadScore rows retain their configVersion reference (immutable)
  · Cache invalidation: activate new version → next read returns new payload
  · DB check constraint: manual INSERT with approvedByUserId = createdByUserId 
    fails

ACCEPTANCE CRITERIA
  · All 9 config keys editable via UI
  · Every propose + approve + activate audit-logged
  · SoD enforced at DB + API + UI
  · Scoring / SLA / assignment reads work identically to hard-coded when 
    seeded defaults active
  · Commit message: "feat(lead-v2.1): B09 LeadConfig versioned store + 
    single-approver workflow (SoD) + Configuration UI"

DO NOT DO
  · Add multi-approver flow (LADR-18 approved single-approver)
  · Auto-approve any key
```

---

## Batch B10 · Follow-up First-Class + Generic Activity API (P1)

**Prompt title:** `[Lead v2.1] B10 LeadFollowUp + generic activity API + Follow-up Queue UI`

```
GOAL
LeadFollowUp as first-class entity. Generic /activities API. Follow-up Queue 
UI. Cron ticks OPEN → DUE → OVERDUE. SLA integration.

FILES TO CREATE
  src/lib/leads/application/follow-up.ts (CRUD + status transitions)
  src/app/api/leads/v2/leads/[id]/follow-ups/route.ts (POST create)
  src/app/api/leads/v2/follow-ups/route.ts (GET list with filters)
  src/app/api/leads/v2/follow-ups/[id]/route.ts (PATCH update)
  src/app/api/leads/v2/follow-ups/[id]/complete/route.ts (POST)
  src/app/api/leads/v2/follow-ups/[id]/cancel/route.ts (POST)
  src/app/api/leads/v2/follow-ups/[id]/reschedule/route.ts (POST)
  src/app/api/leads/v2/leads/[id]/activities/route.ts (POST generic activity)
  src/app/api/leads/v2/internal/follow-ups/tick/route.ts (HMAC-signed cron)
  src/app/(portals)/telecaller/follow-ups/page.tsx — Follow-up Queue surface
  src/app/(portals)/telecaller/**/** — Follow-up dock component

FEATURE FLAG: LEAD_FOLLOWUP_ENABLED

TESTS: OPEN→DUE→OVERDUE lifecycle · reschedule preserves rescheduledFromId · 
SLA warn/breach on OVERDUE · dispatch → cascade via outbox

ACCEPTANCE: Telecaller sees due/overdue follow-ups; every create/complete 
appends LeadActivity(FOLLOW_UP); Commit: "feat(lead-v2.1): B10 LeadFollowUp + 
generic Activity API + Follow-up Queue UI"
```

---

## Batch B11 · Counselling Booking / Session / Outcome (P1)

**Prompt title:** `[Lead v2.1] B11 Counselling triad — Booking + Session + Outcome`

```
GOAL
CounsellingBooking (anchor with rescheduledFromBookingId), CounsellingSession 
(append-only history), CounsellingOutcome (per-session, UNIQUE). Counsellor UI 
rebuilt on new model.

FILES TO CREATE
  src/lib/leads/application/counselling.ts (book, reschedule, cancel, record 
    session, capture outcome, convert)
  src/app/api/leads/v2/counselling/** (endpoints per 05_LEAD_API_RBAC §2.6)
  src/app/api/leads/v2/internal/counselling/tick/route.ts (reminders + no-show 
    detection)
  src/app/(portals)/counsellor/dashboard/page.tsx (rebuilt)
  src/app/(portals)/counsellor/calendar/page.tsx (new)
  src/app/(portals)/counsellor/sessions/[id]/page.tsx (session record + outcome)

FEATURE FLAG: LEAD_COUNSELLING_HISTORY_ENABLED

TESTS: reschedule creates new booking with rescheduledFromBookingId · session 
append-only · outcome UNIQUE per session · no-show detection after grace 
period → state transition

ACCEPTANCE: Counsellor sees full session history; no session record can be 
overwritten; Commit: "feat(lead-v2.1): B11 Counselling triad + Counsellor 
Workspace rebuild"
```

---

## Batch B12 · Real Notification Adapters — SMS-Magic + Resend + Meta WhatsApp (P1)

**Prompt title:** `[Lead v2.1] B12 Real notification adapters — SMS-Magic, Resend, Meta WhatsApp`

```
GOAL
Live outbound comms via NotificationPort adapters. SMS-Magic per LADR-16 
(behind port only). Delivery-status webhooks. Template management UI.

FILES TO CREATE
  src/lib/leads/adapters/notification/sms-magic-adapter.ts
    · Uses SMS-Magic REST API — auth via SMS_MAGIC_API_KEY
    · Send: POST to https://api.sms-magic.com/... (per official docs; verify 
      exact endpoint at build time)
    · Handles rate limit + retry
  src/lib/leads/adapters/notification/resend-email-adapter.ts (real impl)
  src/lib/leads/adapters/notification/meta-whatsapp-adapter.ts (real impl)
  src/app/api/leads/v2/notifications/webhook/sms-magic/route.ts (HMAC-signed via 
    SMS_MAGIC_WEBHOOK_SECRET; updates NotificationDeliveryLog.deliveryStatus)
  src/app/api/leads/v2/notifications/webhook/meta/route.ts (Meta signature)
  src/app/api/leads/v2/notifications/webhook/resend/route.ts (Resend secret)
  src/app/(portals)/admin/leads/notifications/templates/page.tsx (template CRUD + 
    propose/approve UI)
  scripts/seed-notification-templates.ts (seed intake welcome, counselling 
    reminder 24h + 2h, follow-up reminder, SLA breach alert)

ENV VARS: SMS_MAGIC_API_KEY, SMS_MAGIC_SENDER_ID, SMS_MAGIC_WEBHOOK_SECRET, 
  META_WHATSAPP_TOKEN, META_WHATSAPP_PHONE_ID, RESEND_API_KEY

FEATURE FLAGS: LEAD_SMS_ENABLED, LEAD_EMAIL_ENABLED, LEAD_WHATSAPP_ENABLED 
  (independent per channel)

TESTS: sandbox integration for SMS-Magic (verify delivery webhook updates log) 
· Meta signature verified on inbound webhook · email bounce logs BOUNCED · 
retry policy for transient failures · DNC block still fires upstream

ACCEPTANCE: SMS-Magic sandbox → real staging sends verified · every send has 
NotificationDeliveryLog entry with provider message ID · DNC breach = 0 · 
Commit: "feat(lead-v2.1): B12 real notification adapters — SMS-Magic + Resend 
+ Meta WhatsApp + delivery webhooks + template management"
```

---

## Batch B13 · Assignment Upgrade (P1)

**Prompt title:** `[Lead v2.1] B13 Assignment upgrade — site + shift + skill + language + capacity`

```
GOAL
Replace naive round-robin with site + shift + language + skill + capacity 
assignment via AssignmentDirectory (backed by IAM module 12 or fallback stub).

FILES TO CREATE
  src/lib/leads/adapters/iam-assignment-directory.ts (implements 
    AssignmentDirectory; reads from IAM if available, else falls back to 
    User + on-shift heuristics)
  src/lib/leads/application/assign.ts (upgraded — reads ASSIGNMENT_RULES_V1 
    from ConfigPort)
  src/app/api/leads/v2/assignment/directory/route.ts (GET availability)
  src/app/api/leads/v2/assignment/workload/route.ts (GET workload)
  src/app/(portals)/admin/leads/assignment/page.tsx (Assignment Centre UI)

FEATURE FLAG: LEAD_ASSIGNMENT_V2_ENABLED

TESTS: assignment respects site + shift + language + skill · fair rotation 
within matching bucket (±10% over 1000 iterations) · capacity guard blocks 
overload · cross-site blocked unless override permission

ACCEPTANCE: load balanced; Commit: "feat(lead-v2.1): B13 Assignment upgrade 
+ Assignment Centre UI"
```

---

## Batch B14 · Duplicate Detection + Merge (P1)

**Prompt title:** `[Lead v2.1] B14 Duplicate detection + human-review merge`

```
GOAL
Match rules (EXACT / PROBABLE / POSSIBLE) generate DuplicateCase rows. Human 
review via Duplicate Review UI. Merge irreversible + audited per LADR-22.

FILES TO CREATE
  src/lib/leads/domain/duplicate/match-rules.ts (reads DUPLICATE_MATCH_RULES_V1 
    from ConfigPort; phone exact, email exact, name+phone fuzzy, name+email 
    fuzzy)
  src/lib/leads/application/duplicate.ts (case CRUD, merge, keep-separate, 
    dismiss)
  src/lib/leads/application/merge.ts (full impl of T-31, per 
    04_LEAD_STATE_WORKFLOW §8; single transaction; activity copy per strategy)
  src/app/api/leads/v2/duplicates/route.ts (GET list)
  src/app/api/leads/v2/duplicates/[id]/route.ts (GET pair detail)
  src/app/api/leads/v2/duplicates/[id]/merge/route.ts (POST — winnerLeadId + 
    reason + strategy)
  src/app/api/leads/v2/duplicates/[id]/keep-separate/route.ts (POST)
  src/app/api/leads/v2/duplicates/[id]/dismiss/route.ts (POST)
  src/app/(portals)/admin/leads/duplicates/page.tsx (Duplicate Review UI — 
    side-by-side compare)
  Integration in intake path: after Lead creation, check duplicates and 
    create DuplicateCase rows for matches above threshold

FEATURE FLAG: LEAD_DUPLICATE_ENABLED

TESTS: phone exact → EXACT case · name+phone fuzzy → PROBABLE · merge causes 
loser T-31 transition · loser cannot be merged again (unique constraint) · 
activity copy per strategy verified · outbox LeadMerged event emitted

ACCEPTANCE: intake triggers duplicate check; Ops Manager can resolve; merge 
irreversible; Commit: "feat(lead-v2.1): B14 Duplicate detection + merge (EXACT 
/ PROBABLE / POSSIBLE) + Duplicate Review UI"
```

---

## Batch B15 · Campaign + Attribution (P2)

**Prompt title:** `[Lead v2.1] B15 Campaign + Attribution (first-touch immutable, last-touch versioned)`

```
GOAL
Campaign CRUD. LeadAttribution first-touch (immutable) + last-touch (versioned 
via LeadAttributionHistory). Analytics per-campaign CAC. Backfill legacy leads.

FILES TO CREATE
  src/lib/leads/domain/attribution/rules.ts (touch capture + resolution)
  src/lib/leads/application/campaign.ts (CRUD)
  src/lib/leads/application/attribution.ts (captureTouch, resolveCampaign)
  src/app/api/leads/v2/campaigns/** (per 05 §2.11)
  src/app/api/leads/v2/analytics/cac/route.ts
  src/app/(portals)/admin/leads/campaigns/page.tsx (Campaign Manager UI)
  src/app/(portals)/admin/leads/analytics/page.tsx (CAC dashboard) — extend
  Attribution card component for Lead 360
  scripts/backfill-lead-attribution.ts (one-time idempotent; historical leads 
    get { firstTouch: { source, timestamp: capturedAt }, lastTouch: same, 
    touchType: FIRST })

FEATURE FLAG: LEAD_ATTRIBUTION_ENABLED

TESTS: first-touch immutable across subsequent touches · last-touch versioned 
· CAC = spend / count matches raw · backfill idempotent

ACCEPTANCE: every new lead has LeadAttribution row with firstTouch set; 
Campaign Manager shows active campaigns with lead counts; Commit: 
"feat(lead-v2.1): B15 Campaign + Attribution (first-touch immutable, 
last-touch versioned) + CAC analytics"
```

---

## Batch B16 · Real CRM Adapters — Zoho + Salesforce (P2)

**Prompt title:** `[Lead v2.1] B16 Real CRM adapters — Zoho + Salesforce`

```
GOAL
Live CRM sync via outbox consumers. Real Zoho + Salesforce adapters (replace 
B06 stubs). Retry ladder + DLQ + external ID reconciliation.

FILES TO CREATE
  src/lib/leads/adapters/crm/zoho-adapter.ts (real; OAuth flow; upsertLead, 
    updateStatus, logActivity, closeLead, convert operations)
  src/lib/leads/adapters/crm/salesforce-adapter.ts (real)
  src/lib/leads/application/consumers/crm-consumer.ts (upgrade B06 stub to 
    dispatch to correct provider per config)
  src/app/api/leads/v2/crm/queue/route.ts (GET)
  src/app/api/leads/v2/crm/queue/[id]/retry/route.ts (POST)
  src/app/api/leads/v2/crm/dlq/[id]/republish/route.ts (POST)
  src/app/api/leads/v2/crm/dlq/[id]/discard/route.ts (POST)
  src/app/(portals)/admin/leads/crm/page.tsx (CRM Sync Monitor UI upgrade)

ENV VARS: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, 
  ZOHO_ACCOUNT_ID, SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, 
  SALESFORCE_USERNAME, SALESFORCE_PASSWORD, SALESFORCE_INSTANCE_URL

FEATURE FLAGS: CRM_SYNC_ENABLED (existing) + per-provider flag

TESTS: sandbox happy sync for both providers · retry ladder · DLQ manual 
resolve · external ID captured after first successful sync

ACCEPTANCE: every LeadConverted event synced to configured CRM within SLA; 
DLQ manual resolve workflow works; Commit: "feat(lead-v2.1): B16 real CRM 
adapters — Zoho + Salesforce + CRM Sync Monitor upgrade"
```

---

## Batch B17 · Lead 360 + UI Polish (P2)

**Prompt title:** `[Lead v2.1] B17 Lead 360 rebuild + 18 UI surfaces + Path C fixes`

```
GOAL
Kill raw JSON in admin lead detail. Rebuild as Lead 360. All 18 UI surfaces 
per 02_LEAD_ARCHITECTURE_MASTER §2 (and 01_LEAD_PRODUCT_MASTER §5). Fix 
Path C bugs (Aadhaar validation mode: 'onChange', tier column rename to 
"Tier at capture", add Outcome column).

FILES TO CREATE / MODIFY
  src/app/(portals)/admin/leads/[id]/page.tsx (Lead 360 rebuild)
  src/app/(portals)/admin/leads/page.tsx (add Outcome column, rename Tier 
    column)
  src/app/(portals)/telecaller/dashboard/page.tsx (refresh)
  src/app/(portals)/telecaller/queue/page.tsx (Command Palette integration)
  All 18 surfaces per specs — create missing ones (Command Centre, SLA Monitor, 
    Audit surface, etc.)
  src/components/leads/lead-360/** (timeline, identity, score, ownership, 
    attribution, activity, follow-up, counselling, communication, DNC, 
    conversion, audit cards)
  Fix Aadhaar validation: change react-hook-form mode: "onChange" + zod strip 
    whitespace via .transform()

FEATURE FLAG: LEAD_360_ENABLED

TESTS: snapshot tests for each surface (structural); Playwright E2E: intake → 
convert donor entirely UI-driven; Aadhaar validation clears on correction

ACCEPTANCE: zero raw JSON in any operational surface · all Path C bugs 
closed · Commit: "feat(lead-v2.1): B17 Lead 360 + 18 UI surfaces + Path C 
bug fixes"
```

---

## Batch B18 · Deprecations (v2.1.x)

**Prompt title:** `[Lead v2.1] B18 Deprecations — drop legacy fields after 2 clean releases`

```
GOAL
Remove legacy fields once new fields validated in prod for 2+ releases.

PRE-CONDITIONS (verify before starting)
  · B04-B14 shipped to prod
  · Flag LEAD_STATE_MACHINE_ENABLED = 'strict' for 2+ releases
  · Flag LEAD_CONVERSION_PORT_ENABLED = 'on' for 2+ releases
  · Grep confirms zero code references to deprecated columns

SCHEMA MIGRATIONS (each in separate migration for granular rollback)
  1. Drop CallDisposition.qaScore, .recordingUrl, .recordingDurationSec
  2. Drop unused SlaEntityType enum values (run scripts/audit-sla-usage.ts 
     first to confirm zero usage)
  3. Drop Lead.scoreBreakdown
  4. Drop Lead.notes
  5. Drop LeadDoNotCallList view (retain until confirmed zero legacy query 
     usage)

FILES TO REMOVE
  Any dead code referencing dropped fields

TESTS: grep guard verifies no code references dropped fields; existing E2E 
still pass

ACCEPTANCE: Prod stable 2+ releases post-flip on replacements; Commit: 
"chore(lead-v2.1): B18 deprecations — drop legacy Lead.scoreBreakdown, 
Lead.notes, CallDisposition QA/recording fields, unused SlaEntityType 
values, LeadDoNotCallList view"

ROLLBACK: DB migration down restores columns (data loss possible; mitigation: 
2-release validation window)
```

---

## Batches B19-B22 · P3 · AI Enablement (Future)

Skeleton — full prompts authored when P3 begins.

```
B19 · AI Lead Classification (LLM Prioritisation)
  Adds AI-suggested priority ranking; human override always available.
  Guardrails: model + version tracked · confidence stored · fallback to rules · 
  never bypasses RBAC.

B20 · AI Call Summarisation
  Post-call transcript → structured summary + next-best-action suggestions.
  Summary stored on LeadActivity(CALL).metadata; user can edit.

B21 · Predictive Drop-off / Churn Score
  Predicts likelihood of lead going LOST based on behavioural signals.
  Surface in Lead 360; drives proactive re-engagement suggestions.

B22 · Conversational WhatsApp Intake
  LLM-guided intake bot; captures consent, key fields, routes to human when 
  ambiguous or high-stakes.

All P3 batches must include:
  · Data inputs listed + retention consented
  · Model + version pinned + auditable
  · Confidence threshold + human review gate
  · Explainability panel in UI
  · Fallback to deterministic path on model failure
  · A/B test flag for gradual rollout
```

---

## Ordering + Dependencies

```
B01 (Foundation)
   └─▶ B02 (Security P0) — parallel with B03 possible; keep sequential for safety
        └─▶ B03 (Lead Code)
             └─▶ B04 (State Machine) — depends on B01 domain layer
                  └─▶ B05 (Domain Separation refactor) — consolidation
                       └─▶ B06 (Outbox) — depends on B04 state machine writes
                            └─▶ B07 (ConversionPort) — depends on B04 + B06
                                 └─▶ B08 (DNC + NotificationPort) — depends on B04
                                      └─▶ B09 (LeadConfig) — enables B10-B14 configurability
                                           └─▶ B10 (Follow-up)
                                                └─▶ B11 (Counselling triad)
                                                     └─▶ B12 (Real notifications)
                                                          └─▶ B13 (Assignment upgrade)
                                                               └─▶ B14 (Duplicate + merge)
                                                                    └─▶ B15 (Campaign + Attribution)
                                                                         └─▶ B16 (Real CRM)
                                                                              └─▶ B17 (Lead 360 + UI)
                                                                                   └─▶ B18 (Deprecations)
                                                                                        └─▶ B19-B22 P3 AI
```

Rule: never start batch N+1 until batch N is merged, flags flipped where required, DoD verified.

---

## What "done" means for v2.1

Per `06_LEAD_BUILD_MIGRATION.md` §7: Batches B01-B14 shipped, flags flipped ON, IDOR + outbox + config SoD + reactivation + DNC + Lead 360 verified in prod, OpenAPI spec published. Then B15-B17 land as P2 v2.2 releases.

---

**Document owner:** Engineering
**Usage:** paste standing preamble + one batch prompt into Cursor Composer; verify DoD; commit to main; move to next.
