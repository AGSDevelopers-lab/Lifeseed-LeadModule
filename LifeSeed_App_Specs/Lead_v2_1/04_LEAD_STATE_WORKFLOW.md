# 04 · Lead Management — State Machine + Workflow (v2.1)

**Status:** ARCHITECTURE FREEZE · Founder-approved 2026-09-04
**Companion docs:** `01_LEAD_PRODUCT_MASTER.md` · `02_LEAD_ARCHITECTURE_MASTER.md` · `03_LEAD_DATA_MODEL.md` · `05_LEAD_API_RBAC.md` · `06_LEAD_BUILD_MIGRATION.md`

> **Rule (non-negotiable):** The state machine is the **only** authorised mechanism to change `Lead.status`. Any code path that mutates `Lead.status` outside the state machine module must fail code review + CI grep guard.

---

## 1 · Three orthogonal concepts (per LADR-21)

| Concept | Field(s) | Purpose | Values |
|---|---|---|---|
| **Status** | `Lead.status` | Where the lead is in its journey | 14 lifecycle states |
| **Outcome** | `Lead.outcome` | How the lead ended (only set at terminal state or on merge) | WON · LOST · EXPIRED · MERGED · null |
| **Archive** | `Lead.isArchived` + `archivedAt/By/Reason` | Whether the lead is filed out of active queues | boolean + metadata |

- Status is *stage*. Outcome is *result*. Archive is *filing*.
- Archive is **orthogonal** — an ARCHIVED lead can still be in status ASSIGNED or CONTACTED_QUALIFIED
- Outcome is only set when a terminal transition occurs OR when a lead is merged
- Reactivation clears outcome (moves from LOST back to ASSIGNED) but does not touch archive state

---

## 2 · State Set (14 states)

| # | State | Kind | Terminal? | Can Archive? | Reactivable? |
|---|---|---|---|---|---|
| 1 | NEW | Initial | No | No | – |
| 2 | ASSIGNED | Working | No | Yes | – |
| 3 | CONTACTED_QUALIFIED | Working | No | Yes | – |
| 4 | CONTACTED_NOT_INTERESTED | Interim | No | Yes | – |
| 5 | CONTACTED_CALLBACK_REQUESTED | Working | No | Yes | – |
| 6 | NOT_REACHABLE | Working | No | Yes | – |
| 7 | WRONG_NUMBER | Interim | No | Yes | – |
| 8 | DO_NOT_CALL | Interim | No | Yes | – |
| 9 | COUNSELLING_BOOKED | Working | No | Yes | – |
| 10 | COUNSELLING_ATTENDED | Working | No | Yes | – |
| 11 | COUNSELLING_NO_SHOW | Working | No | Yes | – |
| 12 | CONVERTED | Terminal-positive | Yes | Yes (audit only) | No |
| 13 | LOST | Terminal-negative | Yes | Yes | **Yes within 90-day window** (LADR-17) |
| 14 | EXPIRED_AUTO_PURGED | Terminal-retention | Yes | Yes (audit only) | No |

**Interim states** auto-progress to LOST on cron tick (see auto-transitions §4).

---

## 3 · Full Transition Matrix

Every row = one state-machine transition. Any mutation of `Lead.status` outside this table is disallowed.

| # | From | Event | Actor / Permission | Guard | To | SLA effect | Side effect (writes) | Audit event | Outbox event |
|---|---|---|---|---|---|---|---|---|---|
| T-01 | – | `intake` | Any with `lead.intake` | Consent captured · DNC clean · required fields present · duplicate check performed | NEW | Start LEAD_RESPONSE SLA (tier-based) | Lead row · LeadActivity(SYSTEM) · LeadStatusHistory · LeadScore · LeadAttribution · LeadAttributionHistory(FIRST) | `lead.intake` | `LeadCreated` |
| T-02 | NEW | `assign` | System OR OPS_MANAGER (`lead.assign`) | On-shift telecaller exists in matching site/skill scope | ASSIGNED | Continue LEAD_RESPONSE SLA (owner now assigned) | LeadAssignment · LeadActivity(ASSIGNMENT) · LeadStatusHistory · Lead.activeAssignmentId + Lead.assignedTelecallerId updated | `lead.assign` | `LeadAssigned` |
| T-03 | ASSIGNED | `reassign` | OPS_MANAGER (`lead.reassign`) | New assignee valid + on-shift · reason supplied | ASSIGNED (same) | Reset SLA warning clock if configured | Close prior LeadAssignment (endedAt+endReason) · new LeadAssignment · LeadActivity(ASSIGNMENT) · LeadStatusHistory (self-loop with `event=reassign`) | `lead.reassign` | `LeadAssigned` |
| T-04 | ASSIGNED | `claim` | TELECALLER (`lead.claim`) | Lead unassigned OR reassignable-to-self policy allows | ASSIGNED (same) | – | LeadAssignment (CLAIM) · LeadActivity | `lead.claim` | `LeadAssigned` |
| T-05 | ASSIGNED | `disposition_qualified` | Owner OR SUPERVISOR (`lead.disposition`) | Ownership check · call record attached | CONTACTED_QUALIFIED | Complete LEAD_RESPONSE SLA · start LEAD_QUALIFICATION SLA | CallRecord · LeadActivity(CALL) · LeadStatusHistory | `lead.disposition` | `LeadContacted` + `LeadQualified` |
| T-06 | ASSIGNED | `disposition_not_interested` | Owner (`lead.disposition`) | Ownership | CONTACTED_NOT_INTERESTED | Complete LEAD_RESPONSE SLA | CallRecord · LeadActivity(CALL) · LeadStatusHistory | `lead.disposition` | `LeadContacted` |
| T-07 | ASSIGNED | `disposition_callback` | Owner (`lead.disposition`) | Ownership · dueAt supplied | CONTACTED_CALLBACK_REQUESTED | Complete LEAD_RESPONSE SLA · start FOLLOW_UP SLA | CallRecord · LeadFollowUp(CALLBACK) · LeadActivity · LeadStatusHistory | `lead.disposition` | `LeadContacted` + `LeadFollowUpCreated` |
| T-08 | ASSIGNED | `disposition_not_reachable` | Owner | Ownership · attemptCount++ (metadata) | NOT_REACHABLE | Extend LEAD_RESPONSE SLA per retry policy (config) | CallRecord · LeadActivity · LeadStatusHistory | `lead.disposition` | `LeadContacted` |
| T-09 | ASSIGNED | `disposition_wrong_number` | Owner | Ownership | WRONG_NUMBER | Complete LEAD_RESPONSE SLA | CallRecord · LeadActivity · LeadStatusHistory | `lead.disposition` | `LeadContacted` |
| T-10 | ASSIGNED | `disposition_do_not_call` | Owner | Ownership | DO_NOT_CALL | Complete LEAD_RESPONSE SLA | CallRecord · LeadDoNotCall(add PHONE + EMAIL if present) · LeadActivity(DNC) · LeadStatusHistory | `lead.disposition` + `lead.dnc.add` | `LeadContacted` + `LeadDncAdded` |
| T-11 | CONTACTED_CALLBACK_REQUESTED | `disposition_qualified` | Owner | Ownership | CONTACTED_QUALIFIED | Complete FOLLOW_UP SLA · start LEAD_QUALIFICATION SLA | CallRecord · LeadFollowUp(COMPLETE) · LeadActivity · LeadStatusHistory | `lead.disposition` | `LeadQualified` + `LeadFollowUpCompleted` |
| T-12 | CONTACTED_CALLBACK_REQUESTED | `disposition_not_interested` | Owner | Ownership | CONTACTED_NOT_INTERESTED | Complete FOLLOW_UP SLA | Same pattern | `lead.disposition` | `LeadContacted` |
| T-13 | NOT_REACHABLE | `disposition_qualified` | Owner | Ownership · fresh call attempted | CONTACTED_QUALIFIED | Complete LEAD_RESPONSE SLA · start LEAD_QUALIFICATION SLA | CallRecord · LeadActivity · LeadStatusHistory | `lead.disposition` | `LeadContacted` + `LeadQualified` |
| T-14 | NOT_REACHABLE | `disposition_wrong_number` | Owner | Ownership | WRONG_NUMBER | Complete LEAD_RESPONSE SLA | Same pattern | `lead.disposition` | `LeadContacted` |
| T-15 | CONTACTED_QUALIFIED | `book_counselling` | Owner OR SUPERVISOR (`counselling.book`) | personType=RECIPIENT · counsellor available in slot · DNC clean for reminders | COUNSELLING_BOOKED | Complete LEAD_QUALIFICATION SLA · start COUNSELLING_BOOKING + COUNSELLING_REMINDER SLAs | CounsellingBooking · LeadActivity(COUNSELLING) · LeadStatusHistory · scheduled reminders (24h + 2h) via SLA | `counselling.book` | `CounsellingBooked` |
| T-16 | CONTACTED_QUALIFIED | `convert_donor` | Owner OR SUPERVISOR (`lead.convert`) | personType=DONOR · required fields present · DNC clean · no prior LeadConversion row · ConversionPort.isEligibleForDonor() = eligible | CONVERTED (outcome=WON) | Complete LEAD_QUALIFICATION SLA | LeadConversion(target=DONOR) · LeadActivity(CONVERSION) · LeadStatusHistory · Lead.outcome=WON · Lead.convertedDonorId + convertedAt populated · downstream Donor created via ConversionPort | `lead.convert.donor` | `LeadConverted` |
| T-17 | COUNSELLING_BOOKED | `session_attended` | COUNSELLOR (`counselling.session.record`) | Booking exists · session record attached | COUNSELLING_ATTENDED | Complete COUNSELLING_BOOKING SLA · cancel remaining reminders | CounsellingSession(ATTENDED) · CounsellingOutcome (if recommendation captured now) · LeadActivity · LeadStatusHistory · CounsellingBooking.bookingStatus=CLOSED | `counselling.session.record` | `CounsellingAttended` |
| T-18 | COUNSELLING_BOOKED | `session_no_show` | System (cron) OR COUNSELLOR | Booking past AND session not recorded | COUNSELLING_NO_SHOW | Complete COUNSELLING_BOOKING SLA · attemptCount++ | CounsellingSession(NO_SHOW) · LeadActivity · LeadStatusHistory · CounsellingBooking.bookingStatus=CLOSED | `counselling.session.no_show` | `CounsellingNoShow` |
| T-19 | COUNSELLING_BOOKED | `session_cancelled` | COUNSELLOR OR LEAD (self-cancel via link) | Booking future | COUNSELLING_BOOKED (same) with new SCHEDULED booking OR back to CONTACTED_QUALIFIED if fully cancelled | Cancel COUNSELLING SLAs · optionally schedule new ones if reschedule | CounsellingBooking.bookingStatus=CANCELLED/RESCHEDULED · optional new CounsellingBooking · LeadActivity · LeadStatusHistory | `counselling.session.cancel` | – (no outbox on cancel-only) |
| T-20 | COUNSELLING_NO_SHOW | `book_counselling` | Owner | attemptCount < config max (default 3) | COUNSELLING_BOOKED | Start fresh COUNSELLING_BOOKING SLA | CounsellingBooking · LeadActivity · LeadStatusHistory | `counselling.book` | `CounsellingBooked` |
| T-21 | COUNSELLING_NO_SHOW | `mark_lost` (auto) | System (cron) | attemptCount ≥ config max | LOST (outcome=LOST) | – | LeadActivity(STATUS_CHANGE reason=exhausted_no_shows) · LeadStatusHistory · Lead.outcome=LOST | `lead.mark_lost` | `LeadLost` |
| T-22 | COUNSELLING_ATTENDED | `convert_recipient` | COUNSELLOR OR SUPERVISOR (`lead.convert`) | CounsellingOutcome.recommendation=RECOMMEND_REGISTER · no prior LeadConversion · DNC clean · ConversionPort.isEligibleForRecipient() = eligible | CONVERTED (outcome=WON) | – | LeadConversion(target=RECIPIENT) · LeadActivity · LeadStatusHistory · Lead.outcome=WON · downstream Recipient created via ConversionPort | `lead.convert.recipient` | `LeadConverted` |
| T-23 | COUNSELLING_ATTENDED | `record_outcome_defer` | COUNSELLOR | CounsellingOutcome captured | COUNSELLING_ATTENDED (same) | – (may schedule follow-up SLA) | CounsellingOutcome · optional LeadFollowUp · LeadActivity | `counselling.outcome.record` | – |
| T-24 | CONTACTED_NOT_INTERESTED | `mark_lost` (auto) | System (cron) | 24h since disposition and no re-engagement | LOST (outcome=LOST) | – | LeadActivity · LeadStatusHistory · Lead.outcome=LOST | `lead.mark_lost` | `LeadLost` |
| T-25 | WRONG_NUMBER | `mark_lost` (auto) | System (cron) | 1h since disposition | LOST (outcome=LOST) | – | Same pattern | `lead.mark_lost` | `LeadLost` |
| T-26 | DO_NOT_CALL | `mark_lost` (auto) | System (cron) | Immediate | LOST (outcome=LOST) | – | Same pattern | `lead.mark_lost` | `LeadLost` |
| T-27 | Any non-terminal | `archive` | SUPERVISOR (`lead.archive`) | Reason supplied | (same status) with `isArchived=true` | – | Lead.isArchived=true · archivedAt/By/Reason · LeadActivity | `lead.archive` | `LeadArchived` |
| T-28 | (archived) | `unarchive` | SUPERVISOR (`lead.unarchive`) | Reason supplied | (same status) with `isArchived=false` | – | Lead.isArchived=false · LeadActivity | `lead.unarchive` | – |
| T-29 | LOST | `reactivate` | SUPERVISOR (`lead.reactivate`) | now() - lostAt ≤ **90 days** (LADR-17) · fresh context reason supplied · Lead not merged | ASSIGNED (outcome cleared to null) | Start fresh LEAD_RESPONSE SLA | LeadActivity(SYSTEM: reactivation) · LeadStatusHistory · Lead.outcome=null · new LeadAssignment | `lead.reactivate` | `LeadReactivated` |
| T-30 | Any non-terminal | `expire_by_retention` | System (cron) | `retentionExpiresAt < now()` AND `outcome IS DISTINCT FROM 'WON'` | EXPIRED_AUTO_PURGED (outcome=EXPIRED) | Cancel any pending SLAs | Redact PII on Lead · Lead.outcome=EXPIRED · Lead.redactedAt/Reason · LeadActivity(SYSTEM) · LeadStatusHistory | `lead.expire` | – (no outbox — internal) |
| T-31 | Any non-terminal | `merge_loser` | OPS_MANAGER (`lead.merge`) via DuplicateCase workflow | LeadMerge row exists with this lead as loser | LOST (outcome=MERGED) with `isArchived=true` | Cancel any pending SLAs | Lead.mergedIntoLeadId set · Lead.outcome=MERGED · Lead.isArchived=true · LeadActivity(MERGE) · LeadStatusHistory · copy activities to winner per MergeCopyStrategy | `lead.merge` | `LeadMerged` |

### 3.1 Illustrative transition diagram (text form)

```
                       ┌─── intake ───┐
                       ▼              │
                     NEW              │
                       │              │
                    assign            │
                       ▼              │
                   ASSIGNED ◄─ reassign/claim
                       │
      ┌────────────────┼─────────────────────┬──────────────────┬────────────────┐
      ▼                ▼                     ▼                  ▼                ▼
CONTACTED_        CONTACTED_       CONTACTED_          NOT_REACHABLE     WRONG_NUMBER
QUALIFIED         NOT_INTERESTED   CALLBACK_                 │           DO_NOT_CALL
      │                │           REQUESTED                  │                │
      │             mark_lost           │                  disposition       mark_lost
      │             (cron 24h)          │                   (retry/wrong)   (immediate)
      │                │                │                     │                │
      │                ▼                │                     ▼                ▼
      │              LOST               │                 WRONG_NUMBER       LOST
      │                                 │                     │
      │                                 │                  mark_lost
      │                                 ▼                     ▼
      │                            disposition_               LOST
      │                            qualified/
      │                            not_interested
      │                                 │
      │◄────────────────────────────────┘
      │
   ┌──┴──────────────────────┐
   ▼                         ▼
convert_donor          book_counselling
   │                         │
   ▼                         ▼
CONVERTED             COUNSELLING_BOOKED ◄─── book_counselling (rebook)
(WON)                        │                              ▲
                             ▼                              │
                        session_attended                    │
                             │                              │
                             ▼                     ┌────────┴─────┐
                    COUNSELLING_ATTENDED           │              │
                             │                    │              │
                             ▼               session_no_show   session_cancelled
                     record_outcome                │              │
                     recommend_register            ▼              ▼
                             │             COUNSELLING_NO_SHOW  (reschedule or
                             ▼                     │             back to
                    convert_recipient          book (< max)      CONTACTED_QUALIFIED)
                             │                     │
                             ▼                     ▼ (attempts ≥ max)
                        CONVERTED (WON)          LOST

Cross-cutting:
  · Any non-terminal ─── archive/unarchive ─── (same status, isArchived toggled)
  · LOST ─── reactivate (within 90 days) ─── ASSIGNED
  · Any non-terminal ─── expire_by_retention ─── EXPIRED_AUTO_PURGED
  · Any non-terminal ─── merge_loser (via DuplicateCase) ─── LOST (outcome=MERGED)
```

---

## 4 · Automatic Transitions (cron / system driven)

| Transition | Trigger | Cron endpoint |
|---|---|---|
| CONTACTED_NOT_INTERESTED → LOST | 24h since disposition · configurable | `POST /api/leads/v2/internal/lifecycle/tick` |
| WRONG_NUMBER → LOST | 1h since disposition · configurable | Same |
| DO_NOT_CALL → LOST | Immediate on next tick | Same |
| COUNSELLING_BOOKED → COUNSELLING_NO_SHOW | Booking end + grace (config, default 30 min) with no session record | `POST /api/leads/v2/internal/counselling/tick` |
| COUNSELLING_NO_SHOW → LOST | attemptCount ≥ max (config, default 3) | Same |
| Any non-terminal → EXPIRED_AUTO_PURGED | retentionExpiresAt < now AND outcome ≠ WON | `POST /api/leads/v2/internal/retention/purge` |
| Follow-up OPEN → DUE → OVERDUE | dueAt approach · lapse | `POST /api/leads/v2/internal/follow-ups/tick` |

All cron endpoints HMAC-signed with 5-min replay window; idempotent; resumable.

---

## 5 · Guards (deterministic pre-checks)

| Guard | Purpose | Applies to |
|---|---|---|
| `hasConsent(scope)` | Marketing / screening / data-processing consent captured | T-01, comms sends |
| `notInDnc(channel, value)` | DNC list clean | T-01, T-15, T-16, T-22, all outbound comms |
| `ownershipCheck(actor, lead)` | Actor is owner OR has supervisor perm | T-05..T-22 dispositions |
| `permissionCheck(actor, perm, scope)` | Actor has the RBAC permission | Every transition |
| `hasRequiredFields(personType)` | Minimum fields present for downstream creation | T-16 (convert_donor), T-22 (convert_recipient) |
| `noDuplicateConversion(leadId)` | No prior LeadConversion row | T-16, T-22 |
| `withinReactivationWindow(lostAt, now)` | `now - lostAt ≤ 90 days` | T-29 |
| `notMerged(leadId)` | Lead has not been merged | T-29 |
| `counsellorAvailable(slot)` | Slot free in counsellor calendar | T-15, T-20 |
| `attemptsRemaining(leadId)` | Retry count < config max | T-08 (retry), T-20 (rebook), T-21 (auto-lost) |
| `configVersionActive(key)` | Config used for scoring/policy is active | T-01 (score at intake) |

Guards evaluated in order; first failure short-circuits with a typed domain error.

---

## 6 · Actor Permission Map

| Actor role | Permissions granted |
|---|---|
| Public (intake) | `lead.intake` (only for public web/WhatsApp) |
| TELECALLER | `lead.view.own` · `lead.disposition` · `lead.claim` · `lead.convert` (with supervisor confirmation for restricted cases) · `counselling.book` · `follow_up.create/complete` · `dnc.check` |
| Sr TELECALLER (extends TELECALLER) | Adds `lead.reassign.own_pool` · `lead.convert` without supervisor confirmation for standard flows |
| COUNSELLOR | `lead.view.assigned_for_counselling` · `counselling.session.record` · `counselling.outcome.record` · `lead.convert.recipient` (per policy) · `follow_up.create/complete` |
| OPS_MANAGER | Adds `lead.assign` · `lead.reassign` · `lead.archive/unarchive` · `lead.reactivate` · `lead.merge` · `dnc.add/remove` · `assignment.override` · `qa.sample` |
| MARKETING_MANAGER | `campaign.*` · `analytics.view` · `attribution.view` |
| CRM_ADMIN | `crm.sync.monitor` · `crm.sync.retry` · `crm.config.set` |
| BANK_SUPER_ADMIN | All above · `lead.config.approve` · `audit.export` |
| BANK_MEDICAL_DIRECTOR | Read-only across all leads · `lead.view.any` |

Detailed matrix in `05_LEAD_API_RBAC.md`.

---

## 7 · Reactivation Semantics (LADR-17)

- Window: **90 calendar days** from `lostAt` (timestamp of transition into LOST)
- `lostAt` derived from the `LeadStatusHistory` row where `toStatus = LOST`
- Guard: `withinReactivationWindow(lostAt, now)`
- On reactivate: `Lead.outcome` cleared to null · fresh LeadAssignment · new LEAD_RESPONSE SLA · LeadActivity(SYSTEM: reactivation, reason=<supplied>) · outbox `LeadReactivated`
- After 90 days: request refused; UI surfaces "Create new lead (subject to DPDP re-consent)"
- The 90-day rule is **not** configurable via ConfigPort in v2.1 — hard-coded in state machine guard to match LADR-17

---

## 8 · Merge Semantics (LADR-22)

Trigger: `DuplicateCase.reviewStatus` moves to MERGED via Ops Manager decision.

Merge algorithm (atomic transaction):
1. Create `LeadMerge` row (winnerLeadId, loserLeadId, decidedByUserId, reason, strategy)
2. Apply state-machine transition T-31 on loser: → LOST (outcome=MERGED, isArchived=true, mergedIntoLeadId set)
3. Copy activities from loser to winner per strategy:
   - `COPY_ALL` — every LeadActivity, CallRecord, LeadFollowUp, CounsellingBooking/Session/Outcome, LeadStatusHistory (as SYSTEM merge notes) — with `metadata.mergeSourceLeadId=loserLeadId`
   - `COPY_MEANINGFUL` — CALL, COUNSELLING, NOTE, CONVERSION only
   - `REFERENCE_ONLY` — winner receives a single LeadActivity(MERGE) row with count summary; loser activities remain on loser record (accessible via merge navigation)
4. Update `DuplicateCase.reviewStatus=MERGED, mergeId=<created>`
5. Append audit + outbox `LeadMerged`

Merge is **irreversible**. To "unmerge", create a new lead and note the correction.

---

## 9 · Retention / Expiry Semantics

- Retention window per file type via `LeadConfig.RETENTION_POLICY_V1` (default `leadUnconverted=365d`)
- Cron computes `retentionExpiresAt` at intake as `capturedAt + policy`
- Purge cron (`/api/leads/v2/internal/retention/purge`) selects leads where `retentionExpiresAt < now() AND outcome IS DISTINCT FROM 'WON'`
- Executes T-30: PII redacted (fullName, phone, email, address nulled) · Lead.outcome=EXPIRED · Lead.status=EXPIRED_AUTO_PURGED · Lead.redactedAt=now · Lead.redactionReason='retention_expiry'
- Aggregate analytics preserved (score, tier, source, campaign)
- Audit row appended; no outbox (internal)
- Converted leads (outcome=WON) exempt — Donor/Recipient retention (25y min) takes over

---

## 10 · Lead 360 Timeline Composition

Timeline for a lead = ordered UNION of:
- `LeadStatusHistory` (STATUS_CHANGE cards)
- `LeadActivity` (all types)
- `LeadAssignment` change events (rendered as ASSIGNMENT cards)
- `LeadScore` recomputation events (rendered as SYSTEM cards)
- `LeadFollowUp` create/complete events (rendered as FOLLOW_UP cards)
- `CounsellingBooking` and `CounsellingSession` events (rendered as COUNSELLING cards)
- `NotificationDeliveryLog` entries (rendered as COMM cards)
- `LeadConversion` (rendered as CONVERSION card)
- `LeadMerge` (rendered as MERGE card)

Ordered by `occurredAt DESC`. Cursor-paginated. No raw JSON in UI.

---

## 11 · Invariants (checked in domain layer + DB constraints)

| # | Invariant | Enforcement |
|---|---|---|
| I-01 | `Lead.status` can only change through the state machine | Grep guard in CI · repository method access only |
| I-02 | Terminal states cannot transition (except LOST → reactivate within 90d) | State machine table |
| I-03 | `LeadConversion.leadId` UNIQUE — no double conversion | DB unique constraint |
| I-04 | `LeadMerge.loserLeadId` UNIQUE — no double merge | DB unique constraint |
| I-05 | Only one active `LeadAssignment` per lead (endedAt IS NULL) | Partial unique index |
| I-06 | Only one active `LeadConfig` per key | Partial unique index |
| I-07 | `LeadConfig.approvedByUserId <> createdByUserId` (SoD) | DB check constraint |
| I-08 | `Lead.outcome` set only for terminal states or MERGED loser | State machine writes |
| I-09 | `Lead.isArchived=true` requires `archivedAt` and `archivedByUserId` | State machine writes + DB check |
| I-10 | `LeadAttribution.firstTouch*` immutable after create | Repository write path + audit review |
| I-11 | Every `LeadStatusHistory` row corresponds to an outbox event OR is explicitly noted internal-only | Runtime assertion in state machine adapter |
| I-12 | DNC-listed contact never receives outbound via NotificationPort | NotificationPort gate + test coverage |
| I-13 | `LEAD_RESPONSE` SLA cannot exist for a terminal-state lead | SLA engine + cancel-on-terminal logic |
| I-14 | Reactivation forbidden beyond 90 days | State machine guard (hard-coded) |
| I-15 | Every state transition writes exactly one row to LeadStatusHistory + one to LeadActivity(STATUS_CHANGE) in same transaction | Test coverage |

---

## 12 · Domain Errors (typed)

| Error | Thrown when |
|---|---|
| `LeadStateTransitionNotAllowedError` | Invalid transition attempted |
| `LeadGuardFailedError` | Guard evaluation failed (includes guardName + reason) |
| `LeadDuplicateConversionError` | LeadConversion row already exists |
| `LeadMergeAlreadyExistsError` | LeadMerge already exists for loser |
| `LeadReactivationWindowExpiredError` | `now - lostAt > 90 days` |
| `LeadDncBlockedError` | Send attempted to DNC'd contact |
| `LeadOwnershipDeniedError` | Actor lacks ownership of lead |
| `LeadConfigVersionMismatchError` | Read attempted at a time no version was active |
| `LeadInvariantViolationError` | Invariant tripped mid-transaction (rare — indicates bug) |

All errors carry structured `{ code, message, context }` for API response shaping.

---

**Document owner:** Engineering
**Next review:** upon completion of Batch C2 (State Machine)
