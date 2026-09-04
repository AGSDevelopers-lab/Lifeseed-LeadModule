# 03 · Lead Management — Data Model (v2.1)

**Status:** ARCHITECTURE FREEZE · Founder-approved 2026-09-04
**Purpose:** Definitive entity + field specification for Lead v2.1. All entities listed with change classification against the current Prisma schema.
**Companion docs:** `01_LEAD_PRODUCT_MASTER.md` · `02_LEAD_ARCHITECTURE_MASTER.md` · `04_LEAD_STATE_WORKFLOW.md` · `05_LEAD_API_RBAC.md` · `06_LEAD_BUILD_MIGRATION.md`

---

## 1 · Conventions

- **Change markers:** `[RETAIN]` unchanged from v1 · `[ADD]` new · `[ALTER]` field-level change to existing · `[DEPRECATE]` retained but stop writing · `[MIGRATE]` structural shift with data move · `[REPLACE]` swap
- **Datatypes:** Postgres native (String → TEXT, DateTime → TIMESTAMPTZ, Int → INT4, BigInt → INT8, JSON → JSONB, cuid → TEXT)
- **All timestamps:** UTC in DB · rendered in local timezone at UI
- **All IDs:** `cuid` unless stated otherwise
- **Retention field defaults:** entities carrying PII have explicit retention rows; audit-only rows retained per module 02 policy (25 years)
- **Audit requirement legend:** `AUDIT: none` · `AUDIT: create/update/delete` · `AUDIT: read+write` (highest sensitivity)
- **Domain view vs persistence:** Each entity here is the **persistence shape** (Prisma model). The domain entity in `src/lib/leads/domain/entities/` is a pure TS type projected from this via adapter (per LADR-19)

## 2 · Master Entity Index

| # | Entity | Status | Owner | Purpose |
|---|---|---|---|---|
| 1 | `Lead` | [ALTER] | LeadRepository | The lead aggregate root |
| 2 | `LeadActivity` | [ADD] | LeadRepository | Generic timeline event log (13 activity types) |
| 3 | `LeadStatusHistory` | [ADD] | LeadRepository | Immutable state-transition log |
| 4 | `LeadScore` | [ADD] | LeadRepository | Immutable score snapshots |
| 5 | `LeadAssignment` | [ADD] | LeadRepository | Immutable assignment history |
| 6 | `LeadFollowUp` | [ADD] | LeadRepository | First-class follow-up task |
| 7 | `CallRecord` | [ALTER] | LeadRepository | Renamed conceptual model of existing `CallDisposition`; select columns deprecated |
| 8 | `CounsellingBooking` | [ALTER] | LeadRepository | Booking anchor · adds reschedule + cancellation fields |
| 9 | `CounsellingSession` | [ADD] | LeadRepository | Session history — never overwritten |
| 10 | `CounsellingOutcome` | [ADD] | LeadRepository | Post-session outcome record with recommendation |
| 11 | `Campaign` | [ADD] | LeadRepository | Marketing campaign metadata |
| 12 | `LeadAttribution` | [ADD] | LeadRepository | Per-lead first-touch (immutable) + latest last-touch |
| 13 | `LeadAttributionHistory` | [ADD] | LeadRepository | Versioned last-touch (append-only) |
| 14 | `DuplicateCase` | [ADD] | LeadRepository | Match candidate + review decision |
| 15 | `LeadMerge` | [ADD] | LeadRepository | Merge decision + audit |
| 16 | `LeadDoNotCall` | [MIGRATE] | LeadRepository | Renamed from `LeadDoNotCallList`; adds source/expiry/authority |
| 17 | `LeadConversion` | [ADD] | LeadRepository | First-class conversion record with double-convert guard |
| 18 | `LeadConfig` | [ADD] | ConfigStore | Versioned business config with single approver |
| 19 | `LeadOutboxEvent` | [ADD] | Outbox dispatcher | Transactional outbox rows |
| 20 | `LeadOutboxDlq` | [ADD] | Outbox dispatcher | Dead letter for unprocessable events |
| 21 | `CrmSyncQueue` | [ALTER] | CrmPort adapter | Existing queue · adds payloadVersion/externalId/lastAttemptError |
| 22 | `NotificationTemplate` | [ADD] | NotificationPort | Registered outbound templates (email/SMS/WhatsApp/in-app) |
| 23 | `NotificationDeliveryLog` | [ADD] | NotificationPort | Every send + delivery-status webhook write |
| 24 | `SlaSchedule` | [RETAIN] | SlaPort | Reused from shared SLA engine; unused enum entries deprecated |

---

## 3 · Entity Specifications

### 3.1 `Lead` [ALTER]

**Purpose:** The lead aggregate root — represents one enquiry from one prospective donor or recipient.

**Ownership:** `LeadRepository`; every write must go through `application/` services.

**Fields:**

| Field | Type | Req? | Notes | Status |
|---|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK | [RETAIN] |
| `code` | TEXT | ✓ | UNIQUE — human-visible `LED-{CITY}-{YYYYMMDD}-{XXXX}` · generated via Postgres sequence + advisory lock (per §Batch C3) | [ALTER] — add UNIQUE constraint |
| `personType` | ENUM(LeadPersonType) | ✓ | DONOR · RECIPIENT | [RETAIN] |
| `donorSubtype` | ENUM(LeadDonorSubType) | – | SEMEN · OOCYTE (when personType=DONOR) | [RETAIN] |
| `fullName` | TEXT | ✓ | | [RETAIN] · redacted at retention purge |
| `phone` | TEXT | ✓ | E.164 normalised · indexed for duplicate lookup | [RETAIN] |
| `email` | TEXT | – | Lowercased · indexed | [RETAIN] |
| `dateOfBirth` | DATE | – | Used by scoring (age fit) | [RETAIN] |
| `address` | JSONB | – | `{ line1, line2, city, state, pincode, country }` | [RETAIN] · redacted at purge |
| `siteId` | TEXT | ✓ | FK → Site | [RETAIN] |
| `preferredLanguage` | ENUM(LeadLanguage) | – | ENGLISH · HINDI · BENGALI · TELUGU · OTHER | [RETAIN] |
| `status` | ENUM(LeadStatus) | ✓ | Current lifecycle stage — see `04_LEAD_STATE_WORKFLOW.md` | [RETAIN] — canonical write path shifts to state machine |
| `outcome` | ENUM(LeadOutcome) | – | WON · LOST · EXPIRED · MERGED · null | [ADD] |
| `isArchived` | BOOLEAN | ✓ | DEFAULT false · orthogonal to status | [ADD] |
| `archivedAt` | TIMESTAMPTZ | – | | [ADD] |
| `archivedByUserId` | TEXT | – | FK → User | [ADD] |
| `archiveReason` | TEXT | – | Free text captured on archive | [ADD] |
| `source` | ENUM(LeadSource) | ✓ | 12 values (WEB_FORM, WHATSAPP, PHONE_INBOUND, TELECALLER, WALK_IN, REFERRAL, CLINIC_REFERRAL, HOSPITAL_REFERRAL, PARTNER, SOCIAL, CAMPAIGN, API, MANUAL) | [ALTER] — extend enum |
| `campaignId` | TEXT | – | FK → Campaign | [ADD] |
| `tierAtCapture` | ENUM(LeadTier) | ✓ | HOT · WARM · COLD · ARCHIVED · Immutable — captured at intake | [ALTER] — rename from `tier` to reflect semantics; keep `tier` as read-alias during migration |
| `latestScoreId` | TEXT | – | FK → LeadScore (denormalised convenience) | [ADD] |
| `latestScoreValue` | INT4 | – | Denormalised · always equal to latest score | [ADD] |
| `scoreBreakdown` | JSONB | ✓ | Retained v1 field — will be superseded by LeadScore.breakdown reads over time | [DEPRECATE] read-first, delete in v2.1.x after 2 clean releases |
| `activeAssignmentId` | TEXT | – | FK → LeadAssignment (denormalised) | [ADD] |
| `assignedTelecallerId` | TEXT | – | FK → User · retained as denormalised convenience | [RETAIN] |
| `capturedAt` | TIMESTAMPTZ | ✓ | | [RETAIN] |
| `retentionExpiresAt` | TIMESTAMPTZ | ✓ | Set at intake via ConfigPort RETENTION_POLICY_V1 | [RETAIN] |
| `redactedAt` | TIMESTAMPTZ | – | Set by retention purge cron | [ADD] |
| `redactionReason` | TEXT | – | `retention_expiry` \| `dpdp_erasure_request` \| `merge_loser` | [ADD] |
| `mergedIntoLeadId` | TEXT | – | FK → Lead (winner) if merged | [ADD] |
| `duplicateOfLeadId` | TEXT | – | Weak marker for review queue | [ADD] |
| `convertedDonorId` | TEXT | – | FK → Donor · denormalised · authoritative row is `LeadConversion` | [RETAIN] |
| `convertedRecipientId` | TEXT | – | FK → Recipient · same | [RETAIN] |
| `convertedAt` | TIMESTAMPTZ | – | Denormalised | [RETAIN] |
| `consentMarketing` | BOOLEAN | ✓ | DPDP · immutable after intake | [RETAIN] |
| `consentScreening` | BOOLEAN | ✓ | DPDP | [RETAIN] |
| `consentDataProcessing` | BOOLEAN | ✓ | DPDP | [RETAIN] |
| `consentVersion` | TEXT | ✓ | E.g. `lead-v1.0` — increments when template evolves | [RETAIN] |
| `consentIp` | INET | ✓ | Captured server-side | [RETAIN] |
| `consentUserAgent` | TEXT | ✓ | | [RETAIN] |
| `notes` | TEXT | – | Free-text summary field — retained but discouraged (use LeadActivity NOTE instead) | [DEPRECATE] |
| `createdAt` | TIMESTAMPTZ | ✓ | | [RETAIN] |
| `updatedAt` | TIMESTAMPTZ | ✓ | | [RETAIN] |
| `version` | INT4 | ✓ | Optimistic concurrency version · DEFAULT 1 · incremented on every update | [ADD] |

**Primary key:** `id`
**Foreign keys:** `siteId` → Site · `assignedTelecallerId` → User · `campaignId` → Campaign · `activeAssignmentId` → LeadAssignment · `latestScoreId` → LeadScore · `mergedIntoLeadId` → Lead · `duplicateOfLeadId` → Lead · `archivedByUserId` → User · `convertedDonorId` → Donor · `convertedRecipientId` → Recipient
**Indexes:**
- `code` UNIQUE
- `phone` (btree)
- `email` (btree, partial WHERE email IS NOT NULL)
- `siteId, status, tierAtCapture, isArchived` composite
- `assignedTelecallerId, status` composite (queue queries)
- `retentionExpiresAt` (btree, partial WHERE outcome IS DISTINCT FROM 'WON') — purge cron
- `campaignId, capturedAt` composite (analytics)
- `mergedIntoLeadId` (btree, partial WHERE mergedIntoLeadId IS NOT NULL) — merge navigation

**Unique constraints:**
- `code`
- (soft) intake dedupe check: `siteId + phone + capturedAt::date` surface for review only — never enforced as unique (merge is the resolution path)

**Lifecycle:** create at intake · updates via state machine only · redact at retention expiry (PII fields nulled) · never hard-deleted
**Audit:** `create/update/delete` — every field change appended to audit chain
**Retention:** capturedAt + `RETENTION_POLICY_V1.leadUnconverted` (default 365 days) for unconverted; converted leads retained per Donor/Recipient policy (25 years min)
**Relationships:** 1..N LeadActivity · 1..N LeadStatusHistory · 1..N LeadScore · 1..N LeadAssignment · 1..N LeadFollowUp · 1..N CallRecord · 0..1 LeadAttribution · 0..N LeadAttributionHistory · 0..N DuplicateCase (as either side) · 0..1 LeadMerge (as loser) · 0..1 LeadConversion · 0..N CounsellingBooking · 0..N CounsellingSession · 0..N NotificationDeliveryLog · 0..N LeadOutboxEvent

---

### 3.2 `LeadActivity` [ADD]

**Purpose:** Generic timeline log covering every noteworthy event on a lead. Powers Lead 360 timeline.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `leadId` | TEXT | ✓ | FK → Lead |
| `activityType` | ENUM(LeadActivityType) | ✓ | CALL · WHATSAPP · SMS · EMAIL · NOTE · FOLLOW_UP · COUNSELLING · APPOINTMENT · STATUS_CHANGE · ASSIGNMENT · ESCALATION · CONVERSION · MERGE · DNC · SYSTEM |
| `channel` | ENUM(LeadChannel) | – | INBOUND · OUTBOUND · SYSTEM |
| `actorUserId` | TEXT | – | FK → User (null if SYSTEM) |
| `actorRole` | TEXT | – | Denormalised at write |
| `occurredAt` | TIMESTAMPTZ | ✓ | |
| `summary` | TEXT | – | Human-readable short description |
| `outcome` | TEXT | – | Free text (e.g. call outcome, note title) |
| `nextAction` | TEXT | – | What the actor said should happen next |
| `nextActionDueAt` | TIMESTAMPTZ | – | If actor set a due time |
| `metadata` | JSONB | – | Type-specific payload (e.g. { durationSec, dispositionId } for CALL; { messageId, templateId, providerId } for outbound comms) |
| `relatedEntityType` | TEXT | – | e.g. 'CallRecord', 'CounsellingBooking' |
| `relatedEntityId` | TEXT | – | ID of related child entity |
| `auditRef` | TEXT | – | Corresponding AuditLog row ID |
| `createdAt` | TIMESTAMPTZ | ✓ | |

**PK:** `id` · **FK:** `leadId, actorUserId`
**Indexes:** `(leadId, occurredAt DESC)` composite (timeline queries) · `(actorUserId, occurredAt)` (productivity) · `activityType` (analytics)
**Lifecycle:** append-only · never updated · never deleted
**Audit:** none (this table *is* the audit surface); its creation is atomic with the domain change it records
**Retention:** matches parent Lead (redacted on purge)

---

### 3.3 `LeadStatusHistory` [ADD]

**Purpose:** Immutable log of every state transition.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `leadId` | TEXT | ✓ | FK → Lead |
| `fromStatus` | ENUM(LeadStatus) | – | Null on initial NEW |
| `toStatus` | ENUM(LeadStatus) | ✓ | |
| `event` | ENUM(LeadEvent) | ✓ | The state-machine event that caused the transition |
| `guardsPassed` | JSONB | – | List of guards evaluated |
| `actorUserId` | TEXT | – | FK → User (null if system) |
| `actorRole` | TEXT | – | Denormalised |
| `reason` | TEXT | – | Actor-supplied reason where required |
| `occurredAt` | TIMESTAMPTZ | ✓ | |
| `outboxEventId` | TEXT | – | FK → LeadOutboxEvent for correlation |
| `auditRef` | TEXT | – | AuditLog row ID |

**PK:** `id` · **FK:** `leadId, actorUserId, outboxEventId`
**Indexes:** `(leadId, occurredAt DESC)` · `(actorUserId)` · `(toStatus, occurredAt)` (dashboards)
**Unique:** `(leadId, occurredAt)` prevents timestamp collision inserts (advisory)
**Lifecycle:** append-only
**Audit:** self-auditing (this table extends the hash-chain)

---

### 3.4 `LeadScore` [ADD]

**Purpose:** Immutable snapshot of a score computation.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `leadId` | TEXT | ✓ | FK → Lead |
| `score` | INT4 | ✓ | 0-100 |
| `tier` | ENUM(LeadTier) | ✓ | Derived from score at write time |
| `breakdown` | JSONB | ✓ | `{ ageFit, source, responseSpeed, completeness, location, languageMatch }` (per rule set version) |
| `configKey` | TEXT | ✓ | e.g. `SCORE_WEIGHTS_V1` |
| `configVersion` | INT4 | ✓ | Version of the config used |
| `triggerReason` | ENUM(ScoreTrigger) | ✓ | `intake` · `manual_rescore` · `config_version_change` · `activity_signal` (future) |
| `computedByUserId` | TEXT | – | Null when triggered by system/cron |
| `computedAt` | TIMESTAMPTZ | ✓ | |
| `notes` | TEXT | – | Optional explanation |

**PK:** `id` · **FK:** `leadId, computedByUserId`
**Indexes:** `(leadId, computedAt DESC)` (latest score) · `(configKey, configVersion)` (impact analysis on config change)
**Lifecycle:** append-only
**Audit:** self-auditing
**Migration:** on first rescore, existing `Lead.scoreBreakdown` copied into a `LeadScore` row with `triggerReason='v1_backfill'`; `Lead.latestScoreId` updated

---

### 3.5 `LeadAssignment` [ADD]

**Purpose:** Immutable assignment history — supersedes single mutable `Lead.assignedTelecallerId` (kept as denormalised read-side field).

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `leadId` | TEXT | ✓ | FK → Lead |
| `assigneeUserId` | TEXT | ✓ | FK → User |
| `assignedByUserId` | TEXT | – | Null if system round-robin |
| `assignmentType` | ENUM(AssignmentType) | ✓ | AUTO_ROUND_ROBIN · MANUAL · REASSIGN · CLAIM · ESCALATION |
| `reason` | TEXT | – | Actor-supplied for manual/reassign |
| `startedAt` | TIMESTAMPTZ | ✓ | |
| `endedAt` | TIMESTAMPTZ | – | Set when a new assignment supersedes this one |
| `endReason` | TEXT | – | `reassigned` · `converted` · `lost` · `archived` · `absent` |
| `siteId` | TEXT | ✓ | Denormalised for scoping |
| `metadata` | JSONB | – | e.g. round-robin cursor snapshot |

**PK:** `id` · **FK:** `leadId, assigneeUserId, assignedByUserId, siteId`
**Indexes:** `(leadId, startedAt DESC)` · `(assigneeUserId, startedAt DESC, endedAt)` (workload) · partial index `(assigneeUserId)` WHERE `endedAt IS NULL` (current queue)
**Unique:** at most one row per `leadId` with `endedAt IS NULL` — enforced via partial unique index
**Lifecycle:** append + close · never deleted

---

### 3.6 `LeadFollowUp` [ADD]

**Purpose:** First-class follow-up task.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `leadId` | TEXT | ✓ | FK → Lead |
| `ownerUserId` | TEXT | ✓ | FK → User (usually assigned telecaller) |
| `type` | ENUM(FollowUpType) | ✓ | CALLBACK · RECONTACT · COUNSELLING_REMINDER · DOC_REQUEST · CUSTOM |
| `priority` | ENUM(FollowUpPriority) | ✓ | LOW · NORMAL · HIGH · URGENT |
| `reason` | TEXT | – | Context (why this follow-up) |
| `dueAt` | TIMESTAMPTZ | ✓ | |
| `status` | ENUM(FollowUpStatus) | ✓ | OPEN · DUE · OVERDUE · COMPLETED · CANCELLED · RESCHEDULED |
| `completedAt` | TIMESTAMPTZ | – | |
| `completedByUserId` | TEXT | – | |
| `outcome` | TEXT | – | Free text or code |
| `nextFollowUpId` | TEXT | – | FK → LeadFollowUp (chain) |
| `rescheduledFromId` | TEXT | – | FK → LeadFollowUp (predecessor when rescheduled) |
| `cancelReason` | TEXT | – | If cancelled |
| `slaScheduleId` | TEXT | – | FK → SlaSchedule (if SLA-tracked) |
| `createdAt` | TIMESTAMPTZ | ✓ | |
| `updatedAt` | TIMESTAMPTZ | ✓ | |

**PK:** `id` · **FK:** `leadId, ownerUserId, completedByUserId, nextFollowUpId, rescheduledFromId, slaScheduleId`
**Indexes:** partial `(ownerUserId, dueAt)` WHERE `status IN ('OPEN','DUE','OVERDUE')` (queue) · `(leadId, createdAt)` · `(status, dueAt)` (cron tick)
**Lifecycle:** OPEN → DUE (cron at approach) → OVERDUE (cron at lapse) → COMPLETED / CANCELLED / RESCHEDULED
**Audit:** create/update
**Retention:** matches parent Lead

---

### 3.7 `CallRecord` [ALTER] (was `CallDisposition`)

**Purpose:** Detailed per-call record. Conceptually renamed; DB table `CallDisposition` retained during migration and views aliased.

| Field | Type | Req? | Notes | Status |
|---|---|---|---|---|
| `id` | TEXT | ✓ | PK | [RETAIN] |
| `leadId` | TEXT | ✓ | FK → Lead | [RETAIN] |
| `activityId` | TEXT | ✓ | FK → LeadActivity (parent timeline row) | [ADD] |
| `telecallerUserId` | TEXT | ✓ | FK → User | [RETAIN] |
| `startedAt` | TIMESTAMPTZ | ✓ | | [RETAIN] |
| `endedAt` | TIMESTAMPTZ | – | | [RETAIN] |
| `durationSec` | INT4 | – | Derived; stored for reporting | [RETAIN] |
| `dispositionType` | ENUM(CallDispositionType) | ✓ | QUALIFIED · NOT_INTERESTED · CALLBACK_REQUESTED · NOT_REACHABLE · WRONG_NUMBER · DO_NOT_CALL · BOOKED_COUNSELLING · CONVERTED · OTHER | [RETAIN] |
| `notes` | TEXT | – | | [RETAIN] |
| `followUpId` | TEXT | – | FK → LeadFollowUp if a follow-up was created | [ADD] |
| `qaScore` | INT4 | – | Unused | [DEPRECATE] drop v2.1.x |
| `recordingUrl` | TEXT | – | Unused | [DEPRECATE] |
| `recordingDurationSec` | INT4 | – | Unused | [DEPRECATE] |
| `createdAt` | TIMESTAMPTZ | ✓ | | [RETAIN] |

**PK:** `id` · **FK:** `leadId, activityId, telecallerUserId, followUpId`
**Indexes:** `(leadId, startedAt DESC)` · `(telecallerUserId, startedAt)` (productivity)
**Lifecycle:** create at call start · update on call end · never deleted
**Audit:** create/update
**Retention:** matches Lead

---

### 3.8 `CounsellingBooking` [ALTER]

**Purpose:** Booking anchor for a counselling appointment.

| Field | Type | Req? | Notes | Status |
|---|---|---|---|---|
| `id` | TEXT | ✓ | PK | [RETAIN] |
| `leadId` | TEXT | ✓ | FK → Lead | [RETAIN] |
| `counsellorUserId` | TEXT | ✓ | FK → User | [RETAIN] |
| `mode` | ENUM(CounsellingMode) | ✓ | IN_PERSON · VIDEO_CALL · PHONE | [RETAIN] |
| `slotStart` | TIMESTAMPTZ | ✓ | | [RETAIN] |
| `slotEnd` | TIMESTAMPTZ | ✓ | | [RETAIN] |
| `durationMin` | INT4 | ✓ | | [RETAIN] |
| `bookedByUserId` | TEXT | ✓ | FK → User | [RETAIN] |
| `bookingStatus` | ENUM(BookingStatus) | ✓ | SCHEDULED · RESCHEDULED · CANCELLED · CLOSED (session recorded) | [ADD] |
| `rescheduledFromBookingId` | TEXT | – | FK → CounsellingBooking | [ADD] |
| `cancelledReason` | TEXT | – | | [ADD] |
| `cancelledByUserId` | TEXT | – | | [ADD] |
| `cancelledAt` | TIMESTAMPTZ | – | | [ADD] |
| `notes` | TEXT | – | | [RETAIN] |
| `createdAt` | TIMESTAMPTZ | ✓ | | [RETAIN] |
| `updatedAt` | TIMESTAMPTZ | ✓ | | [RETAIN] |

**PK:** `id` · **FK:** `leadId, counsellorUserId, bookedByUserId, rescheduledFromBookingId, cancelledByUserId`
**Indexes:** `(counsellorUserId, slotStart)` (calendar) · `(leadId, createdAt)` · `(slotStart)` (reminders cron)
**Unique:** none (a lead may have many bookings over time)
**Lifecycle:** SCHEDULED → RESCHEDULED (via new booking) / CANCELLED / CLOSED (after session recorded)
**Audit:** create/update

---

### 3.9 `CounsellingSession` [ADD]

**Purpose:** Session history — every attempt to hold a session appends one row.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `bookingId` | TEXT | ✓ | FK → CounsellingBooking |
| `leadId` | TEXT | ✓ | Denormalised for query convenience |
| `counsellorUserId` | TEXT | ✓ | |
| `startedAt` | TIMESTAMPTZ | – | Actual session start (may differ from slotStart) |
| `endedAt` | TIMESTAMPTZ | – | |
| `attendanceStatus` | ENUM(SessionAttendance) | ✓ | ATTENDED · NO_SHOW · CANCELLED_BY_CLINIC · CANCELLED_BY_LEAD |
| `notes` | TEXT | – | Session notes |
| `recordedByUserId` | TEXT | ✓ | Usually counsellor |
| `recordedAt` | TIMESTAMPTZ | ✓ | |

**PK:** `id` · **FK:** `bookingId, leadId, counsellorUserId, recordedByUserId`
**Indexes:** `(bookingId)` · `(leadId, recordedAt DESC)` · `(counsellorUserId, recordedAt)` (productivity)
**Lifecycle:** append-only
**Audit:** self-auditing

---

### 3.10 `CounsellingOutcome` [ADD]

**Purpose:** Post-session recommendation & next-step decision.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `sessionId` | TEXT | ✓ | FK → CounsellingSession (UNIQUE — one outcome per session) |
| `leadId` | TEXT | ✓ | Denormalised |
| `recommendation` | ENUM(CounsellingRecommendation) | ✓ | RECOMMEND_REGISTER · DEFER · DECLINE · REFER_OUT |
| `recommendedByUserId` | TEXT | ✓ | |
| `rationale` | TEXT | – | |
| `nextActionType` | TEXT | – | `convert_recipient` · `follow_up` · `close_lead` |
| `nextActionAt` | TIMESTAMPTZ | – | If a follow-up should be scheduled |
| `createdAt` | TIMESTAMPTZ | ✓ | |

**PK:** `id` · **FK:** `sessionId (UNIQUE), leadId, recommendedByUserId`
**Indexes:** `(leadId, createdAt DESC)` · `(recommendation)` (analytics)
**Lifecycle:** create once per session · immutable
**Audit:** self-auditing

---

### 3.11 `Campaign` [ADD]

**Purpose:** Marketing campaign metadata used for attribution + CAC analysis.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `name` | TEXT | ✓ | UNIQUE per organisation |
| `code` | TEXT | ✓ | Short slug (e.g. `WB_OCT26_INSTA`) UNIQUE |
| `source` | ENUM(LeadSource) | ✓ | E.g. SOCIAL · WEB_FORM · CAMPAIGN |
| `medium` | TEXT | – | e.g. `instagram_paid`, `google_search`, `whatsapp_broadcast` |
| `channel` | TEXT | – | e.g. `paid_social`, `organic`, `partner` |
| `startAt` | TIMESTAMPTZ | ✓ | |
| `endAt` | TIMESTAMPTZ | – | Null = ongoing |
| `budgetInr` | DECIMAL(12,2) | – | Total planned spend |
| `actualSpendInr` | DECIMAL(12,2) | – | Rolled from expense system (P2) |
| `ownerUserId` | TEXT | ✓ | Marketing owner |
| `creativeRefs` | JSONB | – | Array of creative asset URLs / IDs |
| `landingPageUrls` | JSONB | – | Array |
| `referralPartnerId` | TEXT | – | If referral partner-driven |
| `utmDefaults` | JSONB | – | Default `{ utm_source, utm_medium, utm_campaign, utm_term, utm_content }` |
| `status` | ENUM(CampaignStatus) | ✓ | DRAFT · ACTIVE · PAUSED · ENDED |
| `notes` | TEXT | – | |
| `createdAt` | TIMESTAMPTZ | ✓ | |
| `updatedAt` | TIMESTAMPTZ | ✓ | |

**PK:** `id` · **FK:** `ownerUserId, referralPartnerId`
**Indexes:** `code` UNIQUE · `(status, startAt, endAt)` (active list)
**Lifecycle:** DRAFT → ACTIVE → PAUSED / ENDED
**Audit:** create/update

---

### 3.12 `LeadAttribution` [ADD]

**Purpose:** Per-lead attribution snapshot — first-touch (immutable) + current last-touch.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `leadId` | TEXT | ✓ | FK → Lead · UNIQUE |
| `firstTouchAt` | TIMESTAMPTZ | ✓ | Immutable |
| `firstTouchSource` | ENUM(LeadSource) | ✓ | Immutable |
| `firstTouchCampaignId` | TEXT | – | Immutable |
| `firstTouchMedium` | TEXT | – | Immutable |
| `firstTouchChannel` | TEXT | – | Immutable |
| `firstTouchCreativeRef` | TEXT | – | Immutable |
| `firstTouchLandingUrl` | TEXT | – | Immutable |
| `firstTouchReferralPartnerId` | TEXT | – | Immutable |
| `firstTouchUtm` | JSONB | – | Immutable |
| `lastTouchAt` | TIMESTAMPTZ | ✓ | Updated when new touch recorded |
| `lastTouchSource` | ENUM(LeadSource) | ✓ | |
| `lastTouchCampaignId` | TEXT | – | |
| `lastTouchMedium` | TEXT | – | |
| `lastTouchChannel` | TEXT | – | |
| `lastTouchCreativeRef` | TEXT | – | |
| `lastTouchLandingUrl` | TEXT | – | |
| `lastTouchReferralPartnerId` | TEXT | – | |
| `lastTouchUtm` | JSONB | – | |
| `createdAt` | TIMESTAMPTZ | ✓ | |
| `updatedAt` | TIMESTAMPTZ | ✓ | |

**PK:** `id` · **FK:** `leadId (UNIQUE), firstTouchCampaignId, lastTouchCampaignId, firstTouchReferralPartnerId, lastTouchReferralPartnerId`
**Indexes:** `(firstTouchCampaignId, createdAt)` · `(lastTouchCampaignId, updatedAt)`
**Lifecycle:** create at first intake · update last-touch on every subsequent touch (with history append)
**Audit:** create/update; changes always paired with LeadAttributionHistory row

---

### 3.13 `LeadAttributionHistory` [ADD]

**Purpose:** Append-only versioned last-touch history so no touch is silently overwritten.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `leadId` | TEXT | ✓ | FK → Lead |
| `touchAt` | TIMESTAMPTZ | ✓ | |
| `source` | ENUM(LeadSource) | ✓ | |
| `campaignId` | TEXT | – | |
| `medium` | TEXT | – | |
| `channel` | TEXT | – | |
| `creativeRef` | TEXT | – | |
| `landingUrl` | TEXT | – | |
| `referralPartnerId` | TEXT | – | |
| `utm` | JSONB | – | |
| `touchType` | ENUM(TouchType) | ✓ | FIRST · SUBSEQUENT |
| `capturedAt` | TIMESTAMPTZ | ✓ | Server time when recorded |

**PK:** `id` · **FK:** `leadId, campaignId, referralPartnerId`
**Indexes:** `(leadId, touchAt)` · `(campaignId, touchAt)` (multi-touch attribution analysis)
**Lifecycle:** append-only

---

### 3.14 `DuplicateCase` [ADD]

**Purpose:** Match candidate awaiting human review.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `leftLeadId` | TEXT | ✓ | FK → Lead |
| `rightLeadId` | TEXT | ✓ | FK → Lead |
| `matchLevel` | ENUM(MatchLevel) | ✓ | EXACT · PROBABLE · POSSIBLE |
| `matchSignals` | JSONB | ✓ | Which rules fired: `{ phoneExact, emailExact, nameFuzzy, phoneFuzzy }` |
| `matchScore` | INT4 | ✓ | 0-100 confidence |
| `detectedAt` | TIMESTAMPTZ | ✓ | |
| `reviewStatus` | ENUM(DupReviewStatus) | ✓ | OPEN · UNDER_REVIEW · MERGED · KEPT_SEPARATE · DISMISSED |
| `reviewedByUserId` | TEXT | – | |
| `reviewedAt` | TIMESTAMPTZ | – | |
| `reviewNotes` | TEXT | – | |
| `mergeId` | TEXT | – | FK → LeadMerge (set when reviewer chose MERGED) |
| `createdAt` | TIMESTAMPTZ | ✓ | |
| `updatedAt` | TIMESTAMPTZ | ✓ | |

**PK:** `id` · **FK:** `leftLeadId, rightLeadId, reviewedByUserId, mergeId`
**Indexes:** `(reviewStatus, matchLevel, detectedAt DESC)` (review queue) · `(leftLeadId)` · `(rightLeadId)`
**Unique:** `(leastLeadId, greatestLeadId, matchLevel)` — where DB expression ensures ordering — prevents duplicate cases for same pair
**Lifecycle:** OPEN → UNDER_REVIEW → MERGED / KEPT_SEPARATE / DISMISSED
**Audit:** create/update

---

### 3.15 `LeadMerge` [ADD]

**Purpose:** Immutable merge decision record.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `duplicateCaseId` | TEXT | – | FK → DuplicateCase (nullable for admin-initiated merges) |
| `winnerLeadId` | TEXT | ✓ | FK → Lead |
| `loserLeadId` | TEXT | ✓ | FK → Lead · UNIQUE (a lead can only be merged once) |
| `decidedByUserId` | TEXT | ✓ | FK → User |
| `reason` | TEXT | ✓ | Actor rationale |
| `activityCopyStrategy` | ENUM(MergeCopyStrategy) | ✓ | COPY_ALL · COPY_MEANINGFUL · REFERENCE_ONLY |
| `activitiesCopiedCount` | INT4 | ✓ | Audit count |
| `mergedAt` | TIMESTAMPTZ | ✓ | |
| `auditRef` | TEXT | – | |

**PK:** `id` · **FK:** `duplicateCaseId, winnerLeadId, loserLeadId (UNIQUE), decidedByUserId`
**Lifecycle:** append-only · never reversed (create a new lead + note if a merge was wrong)
**Audit:** self-auditing
**Post-merge effect:** loser Lead.mergedIntoLeadId set to winner · loser status → LOST · loser outcome → MERGED · loser isArchived → true · winner receives copied activities via LeadActivity with `metadata.mergeSourceLeadId` populated

---

### 3.16 `LeadDoNotCall` [MIGRATE] (was `LeadDoNotCallList`)

**Purpose:** DNC registry checked before every outbound.

| Field | Type | Req? | Notes | Status |
|---|---|---|---|---|
| `id` | TEXT | ✓ | PK | [RETAIN] |
| `channel` | ENUM(DncChannel) | ✓ | PHONE · EMAIL · WHATSAPP · SMS · ALL | [ALTER] · was implicit phone |
| `value` | TEXT | ✓ | Normalised value (E.164 phone, lowercased email) | [ALTER] · was `phone`/`email` separate; unify with normalised value |
| `normalisedValue` | TEXT | ✓ | For lookup (equal to `value` after normalisation) | [ADD] |
| `source` | ENUM(DncSource) | ✓ | LEAD_REQUEST · REGULATOR · SYSTEM · UNSUBSCRIBE_LINK · MANUAL | [ADD] |
| `sourceLeadId` | TEXT | – | FK → Lead if originated from a lead request | [ADD] |
| `reason` | TEXT | – | Free text | [ADD] |
| `effectiveFrom` | TIMESTAMPTZ | ✓ | | [ADD] |
| `effectiveUntil` | TIMESTAMPTZ | – | Null = indefinite | [ADD] |
| `createdByUserId` | TEXT | ✓ | | [ADD] |
| `removalAuthorityUserId` | TEXT | – | Who authorized removal (if soft-removed) | [ADD] |
| `removedAt` | TIMESTAMPTZ | – | Soft-remove | [ADD] |
| `createdAt` | TIMESTAMPTZ | ✓ | | [RETAIN] |
| `updatedAt` | TIMESTAMPTZ | ✓ | | [RETAIN] |

**PK:** `id`
**Unique:** `(channel, normalisedValue)` partial WHERE `removedAt IS NULL` — enforces one active DNC per channel-value
**Indexes:** `(normalisedValue)` for fast lookup · `(effectiveUntil)` partial WHERE not null (expiry cron)
**Lifecycle:** create at DNC event · soft-remove via authority · never hard-deleted
**Audit:** create/update
**Migration:** legacy `LeadDoNotCallList` rows migrated: each row explodes into up-to-two `LeadDoNotCall` rows (phone → channel=PHONE, email → channel=EMAIL) · legacy table renamed to view during transition · dropped in v2.1.x

---

### 3.17 `LeadConversion` [ADD]

**Purpose:** First-class conversion record — the authoritative row.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `leadId` | TEXT | ✓ | FK → Lead · **UNIQUE** — prevents double conversion |
| `targetType` | ENUM(ConversionTarget) | ✓ | DONOR · RECIPIENT |
| `targetEntityId` | TEXT | ✓ | Donor.id or Recipient.id |
| `decidedByUserId` | TEXT | ✓ | |
| `eligibilitySnapshot` | JSONB | ✓ | Snapshot of ConversionPort eligibility check |
| `outboxEventId` | TEXT | – | FK → LeadOutboxEvent (LeadConverted) |
| `occurredAt` | TIMESTAMPTZ | ✓ | |
| `notes` | TEXT | – | |

**PK:** `id` · **FK:** `leadId (UNIQUE), decidedByUserId, outboxEventId`
**Lifecycle:** append-only · irreversible
**Audit:** self-auditing
**Migration:** legacy `Lead.convertedDonorId` / `Lead.convertedRecipientId` still populated in parallel for backward compat; on migration day, existing converted leads backfill `LeadConversion` rows

---

### 3.18 `LeadConfig` [ADD]

**Purpose:** Versioned business config with single-approver audit trail.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `key` | TEXT | ✓ | e.g. `SCORE_WEIGHTS_V1` |
| `version` | INT4 | ✓ | Monotonic per key |
| `payload` | JSONB | ✓ | The config values |
| `payloadSchemaRef` | TEXT | ✓ | Version of schema this payload conforms to |
| `ownerRole` | ENUM(UserRole) | ✓ | Which role may author/approve this key |
| `createdByUserId` | TEXT | ✓ | Author |
| `createdAt` | TIMESTAMPTZ | ✓ | |
| `approvedByUserId` | TEXT | – | Null until approved. **MUST differ from createdByUserId** (SoD) |
| `approvedAt` | TIMESTAMPTZ | – | |
| `effectiveFrom` | TIMESTAMPTZ | – | When active version begins (null = immediately on approval) |
| `effectiveUntil` | TIMESTAMPTZ | – | Set when superseded by next version |
| `isActive` | BOOLEAN | ✓ | Convenience — computed but stored |
| `notes` | TEXT | – | Change rationale |

**PK:** `id`
**Unique:** `(key, version)` · partial unique `(key)` WHERE `isActive = true` (only one active per key)
**Check constraint:** `approvedByUserId <> createdByUserId` OR both null
**Indexes:** `(key, effectiveFrom)` for point-in-time reads
**Lifecycle:** propose → approve → activate → supersede
**Audit:** create/update
**Seed values (v2.1):** SCORE_WEIGHTS_V1, SLA_MATRIX_V1, RETENTION_POLICY_V1, ASSIGNMENT_RULES_V1, FOLLOW_UP_POLICY_V1, COUNSELLING_POLICY_V1, NOTIFICATION_TEMPLATE_MAP_V1, CAMPAIGN_RULES_V1, DUPLICATE_MATCH_RULES_V1 — each pre-populated with current hard-coded values

---

### 3.19 `LeadOutboxEvent` [ADD]

**Purpose:** Transactional outbox rows for domain events.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `aggregateType` | TEXT | ✓ | 'Lead' |
| `aggregateId` | TEXT | ✓ | leadId |
| `eventType` | ENUM(LeadEventType) | ✓ | LeadCreated · LeadAssigned · LeadContacted · LeadQualified · LeadFollowUpCreated · LeadFollowUpCompleted · CounsellingBooked · CounsellingAttended · CounsellingNoShow · LeadLost · LeadConverted · LeadMerged · LeadDncAdded · LeadScoreChanged · LeadArchived · LeadReactivated |
| `eventVersion` | INT4 | ✓ | Schema version of payload (allows evolution) |
| `payload` | JSONB | ✓ | Event data |
| `occurredAt` | TIMESTAMPTZ | ✓ | Business event time |
| `enqueuedAt` | TIMESTAMPTZ | ✓ | When persisted (usually == occurredAt) |
| `publishedAt` | TIMESTAMPTZ | – | Set on successful dispatch to at least one consumer |
| `dispatchStatus` | ENUM(DispatchStatus) | ✓ | PENDING · IN_FLIGHT · PUBLISHED · FAILED · DEAD |
| `attemptCount` | INT4 | ✓ | DEFAULT 0 |
| `lastAttemptAt` | TIMESTAMPTZ | – | |
| `lastAttemptError` | TEXT | – | |
| `lockedUntil` | TIMESTAMPTZ | – | Lease timeout |
| `lockedByWorkerId` | TEXT | – | Worker identifier |

**PK:** `id`
**Indexes:** `(dispatchStatus, enqueuedAt)` for dispatcher pickup · `(aggregateId, occurredAt)` for per-aggregate ordering · partial `(lockedUntil)` WHERE `dispatchStatus='IN_FLIGHT'`
**Lifecycle:** create in same transaction as the domain change · dispatcher moves through statuses · DEAD rows moved to `LeadOutboxDlq`
**Audit:** none (self-audit via publishedAt + attemptCount)

---

### 3.20 `LeadOutboxDlq` [ADD]

**Purpose:** Dead-letter events that exceeded retry attempts.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `originalEventId` | TEXT | ✓ | FK → LeadOutboxEvent |
| `aggregateType` | TEXT | ✓ | |
| `aggregateId` | TEXT | ✓ | |
| `eventType` | TEXT | ✓ | |
| `payload` | JSONB | ✓ | |
| `failureReason` | TEXT | ✓ | |
| `attempts` | INT4 | ✓ | |
| `movedAt` | TIMESTAMPTZ | ✓ | |
| `resolvedAt` | TIMESTAMPTZ | – | When manually resolved |
| `resolvedByUserId` | TEXT | – | |
| `resolutionAction` | ENUM(DlqResolution) | – | REPUBLISH · DISCARD · MANUAL_FIX |

**PK:** `id` · **FK:** `originalEventId, resolvedByUserId`
**Lifecycle:** append on failure · resolve manually via CRM Sync Monitor UI

---

### 3.21 `CrmSyncQueue` [ALTER]

**Purpose:** Outbound queue for CRM adapters, populated from outbox events.

| Field | Type | Req? | Notes | Status |
|---|---|---|---|---|
| `id` | TEXT | ✓ | PK | [RETAIN] |
| `leadId` | TEXT | ✓ | FK → Lead | [RETAIN] |
| `outboxEventId` | TEXT | ✓ | FK → LeadOutboxEvent — provenance | [ADD] |
| `provider` | ENUM(CrmProvider) | ✓ | ZOHO · SALESFORCE · … | [RETAIN] |
| `operation` | ENUM(CrmOperation) | ✓ | UPSERT_LEAD · UPDATE_STATUS · LOG_ACTIVITY · CLOSE_LEAD · CONVERT | [ADD] |
| `payloadVersion` | INT4 | ✓ | | [ADD] |
| `payload` | JSONB | ✓ | | [RETAIN] |
| `externalId` | TEXT | – | Set after first successful sync | [ADD] |
| `status` | ENUM(CrmSyncStatus) | ✓ | PENDING · IN_FLIGHT · SYNCED · FAILED · DEAD | [RETAIN] |
| `attemptCount` | INT4 | ✓ | | [RETAIN] |
| `lastAttemptAt` | TIMESTAMPTZ | – | | [RETAIN] |
| `lastAttemptError` | TEXT | – | | [ADD] |
| `syncedAt` | TIMESTAMPTZ | – | | [RETAIN] |
| `enqueuedAt` | TIMESTAMPTZ | ✓ | | [RETAIN] |

**PK:** `id` · **FK:** `leadId, outboxEventId`
**Indexes:** `(provider, status, enqueuedAt)` · `(leadId, provider)` · `(status)` for monitor
**Lifecycle:** PENDING → IN_FLIGHT → SYNCED / FAILED (→ retry) → DEAD after max attempts
**Audit:** none (self-audit via status + attemptCount)

---

### 3.22 `NotificationTemplate` [ADD]

**Purpose:** Registered outbound templates for each channel.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `key` | TEXT | ✓ | e.g. `LEAD_INTAKE_WELCOME_EMAIL` — UNIQUE per channel |
| `channel` | ENUM(NotificationChannel) | ✓ | EMAIL · SMS · WHATSAPP · IN_APP |
| `provider` | ENUM(NotificationProvider) | ✓ | RESEND · SMS_MAGIC · META_WHATSAPP · IN_APP |
| `subject` | TEXT | – | Email only |
| `body` | TEXT | ✓ | Template body with `{{variable}}` placeholders |
| `variables` | JSONB | ✓ | List of required variable names |
| `language` | ENUM(LeadLanguage) | ✓ | |
| `version` | INT4 | ✓ | |
| `isActive` | BOOLEAN | ✓ | |
| `approvedByUserId` | TEXT | – | |
| `approvedAt` | TIMESTAMPTZ | – | |
| `createdAt` | TIMESTAMPTZ | ✓ | |
| `updatedAt` | TIMESTAMPTZ | ✓ | |

**PK:** `id`
**Unique:** `(key, channel, language, version)` · partial unique `(key, channel, language)` WHERE `isActive = true`
**Indexes:** `(channel, isActive)`
**Lifecycle:** propose → approve → activate → supersede

---

### 3.23 `NotificationDeliveryLog` [ADD]

**Purpose:** Every send + delivery status for auditability + failure rate monitoring.

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | TEXT (cuid) | ✓ | PK |
| `leadId` | TEXT | – | FK → Lead (nullable if system-level notification) |
| `templateId` | TEXT | ✓ | FK → NotificationTemplate |
| `channel` | ENUM(NotificationChannel) | ✓ | |
| `provider` | ENUM(NotificationProvider) | ✓ | |
| `recipient` | TEXT | ✓ | Email / phone / user id (channel-appropriate) |
| `sentAt` | TIMESTAMPTZ | ✓ | |
| `providerMessageId` | TEXT | – | e.g. SMS-Magic message id |
| `deliveryStatus` | ENUM(DeliveryStatus) | ✓ | QUEUED · SENT · DELIVERED · FAILED · BOUNCED · READ · REPLIED |
| `statusUpdatedAt` | TIMESTAMPTZ | – | From provider webhook |
| `failureReason` | TEXT | – | |
| `dncCheckedAt` | TIMESTAMPTZ | ✓ | Proves DNC gate ran |
| `dncPassed` | BOOLEAN | ✓ | Must be true (log entry only exists for passed sends; blocked sends logged as separate row with `deliveryStatus=BLOCKED_DNC`) |
| `payloadHash` | TEXT | – | For dedup detection |

**PK:** `id` · **FK:** `leadId, templateId`
**Indexes:** `(leadId, sentAt DESC)` · `(deliveryStatus, sentAt)` · `(provider, sentAt)` · `(recipient, sentAt)`
**Lifecycle:** append at send · update on provider webhook · never deleted (audit)

---

### 3.24 `SlaSchedule` [RETAIN]

Retained from shared SLA engine per LADR-01 assumption. Unused enum values (per existing spec §14) deprecated in v2.1.x after audit.

---

## 4 · Enums (new + altered)

| Enum | Values | Status |
|---|---|---|
| `LeadPersonType` | DONOR · RECIPIENT | [RETAIN] |
| `LeadDonorSubType` | SEMEN · OOCYTE | [RETAIN] |
| `LeadSource` | WEB_FORM · WHATSAPP · PHONE_INBOUND · TELECALLER · WALK_IN · REFERRAL · CLINIC_REFERRAL · HOSPITAL_REFERRAL · PARTNER · SOCIAL · CAMPAIGN · API · MANUAL | [ALTER] (added HOSPITAL_REFERRAL, PARTNER, CAMPAIGN, API, MANUAL) |
| `LeadLanguage` | ENGLISH · HINDI · BENGALI · TELUGU · OTHER | [RETAIN] |
| `LeadStatus` | NEW · ASSIGNED · CONTACTED_QUALIFIED · CONTACTED_NOT_INTERESTED · CONTACTED_CALLBACK_REQUESTED · NOT_REACHABLE · WRONG_NUMBER · DO_NOT_CALL · COUNSELLING_BOOKED · COUNSELLING_ATTENDED · COUNSELLING_NO_SHOW · CONVERTED · LOST · EXPIRED_AUTO_PURGED | [RETAIN] |
| `LeadOutcome` | WON · LOST · EXPIRED · MERGED | [ADD] |
| `LeadTier` | HOT · WARM · COLD · ARCHIVED_TIER | [ALTER] (renamed ARCHIVED to ARCHIVED_TIER to avoid confusion with archive state) |
| `LeadEvent` | intake · assign · reassign · claim · disposition_qualified · disposition_not_interested · disposition_callback · disposition_not_reachable · disposition_wrong_number · disposition_do_not_call · book_counselling · session_attended · session_no_show · session_cancelled · convert_donor · convert_recipient · archive · unarchive · reactivate · expire_by_retention · merge_loser | [ADD] |
| `LeadActivityType` | CALL · WHATSAPP · SMS · EMAIL · NOTE · FOLLOW_UP · COUNSELLING · APPOINTMENT · STATUS_CHANGE · ASSIGNMENT · ESCALATION · CONVERSION · MERGE · DNC · SYSTEM | [ADD] |
| `LeadChannel` | INBOUND · OUTBOUND · SYSTEM | [ADD] |
| `AssignmentType` | AUTO_ROUND_ROBIN · MANUAL · REASSIGN · CLAIM · ESCALATION | [ADD] |
| `FollowUpType` | CALLBACK · RECONTACT · COUNSELLING_REMINDER · DOC_REQUEST · CUSTOM | [ADD] |
| `FollowUpPriority` | LOW · NORMAL · HIGH · URGENT | [ADD] |
| `FollowUpStatus` | OPEN · DUE · OVERDUE · COMPLETED · CANCELLED · RESCHEDULED | [ADD] |
| `BookingStatus` | SCHEDULED · RESCHEDULED · CANCELLED · CLOSED | [ADD] |
| `SessionAttendance` | ATTENDED · NO_SHOW · CANCELLED_BY_CLINIC · CANCELLED_BY_LEAD | [ADD] |
| `CounsellingRecommendation` | RECOMMEND_REGISTER · DEFER · DECLINE · REFER_OUT | [ADD] |
| `CampaignStatus` | DRAFT · ACTIVE · PAUSED · ENDED | [ADD] |
| `TouchType` | FIRST · SUBSEQUENT | [ADD] |
| `MatchLevel` | EXACT · PROBABLE · POSSIBLE | [ADD] |
| `DupReviewStatus` | OPEN · UNDER_REVIEW · MERGED · KEPT_SEPARATE · DISMISSED | [ADD] |
| `MergeCopyStrategy` | COPY_ALL · COPY_MEANINGFUL · REFERENCE_ONLY | [ADD] |
| `DncChannel` | PHONE · EMAIL · WHATSAPP · SMS · ALL | [ADD] |
| `DncSource` | LEAD_REQUEST · REGULATOR · SYSTEM · UNSUBSCRIBE_LINK · MANUAL | [ADD] |
| `ConversionTarget` | DONOR · RECIPIENT | [ADD] |
| `LeadEventType` (outbox) | LeadCreated · LeadAssigned · LeadContacted · LeadQualified · LeadFollowUpCreated · LeadFollowUpCompleted · CounsellingBooked · CounsellingAttended · CounsellingNoShow · LeadLost · LeadConverted · LeadMerged · LeadDncAdded · LeadScoreChanged · LeadArchived · LeadReactivated | [ADD] |
| `DispatchStatus` | PENDING · IN_FLIGHT · PUBLISHED · FAILED · DEAD | [ADD] |
| `DlqResolution` | REPUBLISH · DISCARD · MANUAL_FIX | [ADD] |
| `NotificationChannel` | EMAIL · SMS · WHATSAPP · IN_APP | [ADD] |
| `NotificationProvider` | RESEND · SMS_MAGIC · META_WHATSAPP · IN_APP | [ADD] |
| `DeliveryStatus` | QUEUED · SENT · DELIVERED · FAILED · BOUNCED · READ · REPLIED · BLOCKED_DNC | [ADD] |
| `CrmProvider` | ZOHO · SALESFORCE | [RETAIN] (extensible) |
| `CrmOperation` | UPSERT_LEAD · UPDATE_STATUS · LOG_ACTIVITY · CLOSE_LEAD · CONVERT | [ADD] |
| `CrmSyncStatus` | PENDING · IN_FLIGHT · SYNCED · FAILED · DEAD | [RETAIN] (adds DEAD) |
| `ScoreTrigger` | intake · manual_rescore · config_version_change · activity_signal | [ADD] |
| `CallDispositionType` | QUALIFIED · NOT_INTERESTED · CALLBACK_REQUESTED · NOT_REACHABLE · WRONG_NUMBER · DO_NOT_CALL · BOOKED_COUNSELLING · CONVERTED · OTHER | [RETAIN] |

---

## 5 · Migration Mapping Table (per user's [RETAIN/ADD/ALTER/DEPRECATE/MIGRATE] requirement)

| Existing entity/field | v2.1 disposition | Batch |
|---|---|---|
| `Lead` (table) | ALTER — additive columns · UNIQUE on code · optimistic version column | M1 |
| `Lead.scoreBreakdown` | DEPRECATE — `LeadScore.breakdown` becomes canonical; drop after 2 releases | M1 + v2.1.x |
| `Lead.notes` | DEPRECATE — use LeadActivity NOTE; drop after 2 releases | M1 + v2.1.x |
| `Lead.tier` | ALTER — logical rename to `tierAtCapture`; keep read-alias | M1 |
| `CallDisposition` (table) | ALTER — add `activityId`, `followUpId`; deprecate `qaScore`, `recordingUrl`, `recordingDurationSec`; conceptual rename to `CallRecord` (view alias) | M1 + M11 |
| `CounsellingBooking` (table) | ALTER — add `bookingStatus`, `rescheduledFromBookingId`, `cancelledReason/By/At` | M1 |
| `LeadDoNotCallList` (table) | MIGRATE — rename to `LeadDoNotCall`; explode phone/email into rows; add source/expiry/authority | M8 |
| `CrmSyncQueue` (table) | ALTER — add `outboxEventId`, `operation`, `payloadVersion`, `externalId`, `lastAttemptError`; add DEAD status | M6 (with outbox) |
| `SlaSchedule` (table) | RETAIN — deprecate unused enum values in v2.1.x | v2.1.x |
| `Donor.sourceLeadId` | RETAIN — denormalised link maintained | – |
| `Recipient.sourceLeadId` | RETAIN — denormalised link maintained | – |
| — | ADD: `LeadActivity`, `LeadStatusHistory`, `LeadScore`, `LeadAssignment`, `LeadFollowUp`, `CounsellingSession`, `CounsellingOutcome`, `Campaign`, `LeadAttribution`, `LeadAttributionHistory`, `DuplicateCase`, `LeadMerge`, `LeadConversion`, `LeadConfig`, `LeadOutboxEvent`, `LeadOutboxDlq`, `NotificationTemplate`, `NotificationDeliveryLog` | M1-M8 |

---

## 6 · Domain-to-Persistence Mapping Rules (LADR-19)

- **Domain entity ≠ Prisma model.** The adapter maps between them.
- Prisma types stay in `src/lib/leads/adapters/**`; never exported to domain
- Domain types live in `src/lib/leads/domain/entities/**` — plain interfaces + methods
- Value objects (`LeadCode`, `TierScore`, `ContactInfo`, `Consent`, `AttributionTouch`, `ArchiveMeta`) are immutable classes with validation
- Repositories return **domain entities**, never `PrismaLead`
- Tests instantiate domain entities directly; no Prisma required for domain unit tests

---

**Document owner:** Engineering
**Next review:** upon completion of Batch C1 (Foundation) migration
