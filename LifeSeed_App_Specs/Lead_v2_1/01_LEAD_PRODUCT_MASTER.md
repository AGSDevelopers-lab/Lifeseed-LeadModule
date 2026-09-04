# 01 · Lead Management — Product Master (v2.1)

**Status:** ARCHITECTURE FREEZE · Founder-approved 2026-09-04
**Scope:** Product truth for Lead Management inside ART Bank HIS · re-usable as standalone Lead/CRM platform
**Supersedes:** product-scope sections of `08_lead_management_telecaller_counselling.md` (v1) and `08_LEAD_MASTER_REENGINEERING.md` §PHASE 2
**Related docs:** `02_LEAD_ARCHITECTURE_MASTER.md` · `03_LEAD_DATA_MODEL.md` · `04_LEAD_STATE_WORKFLOW.md` · `05_LEAD_API_RBAC.md` · `06_LEAD_BUILD_MIGRATION.md`

---

## 1 · Product Vision

Lead Management is the **acquisition operating system** for LifeSeed ART Bank. Every prospective donor and every prospective recipient enters the business through this module. It captures the enquiry, qualifies it, routes it to the right human, holds them accountable via SLA, converts qualified prospects into Donor or Recipient records, and reports on cost + conversion per source.

The module is bounded so it can eventually be extracted as **LifeSeed Lead / CRM** — a stand-alone SaaS product usable by other clinics, hospitals, and healthcare bank operators.

## 2 · Business Purpose

Every unmanaged lead is money left on the table. The Lead module exists to:

1. Guarantee every enquiry is contacted within an SLA aligned to its tier
2. Prevent enquiries from disappearing into WhatsApp threads or personal notebooks
3. Give telecallers a single workspace so they aren't switching tools
4. Give counsellors visibility into the pipeline routed to them
5. Give Marketing per-campaign CAC without a data scientist
6. Give the Founder a live view of business acquisition health
7. Guarantee DPDP and DNC compliance on every outbound
8. Feed both Donor Pathway (module 01) and Recipient Pathway with clean, consented handoffs

## 3 · In-Scope (what this module owns)

| Capability | Status |
|---|---|
| Enquiry intake — web, WhatsApp, phone-in, walk-in, referral, clinic, hospital, partner, social, campaign, API, manual | [CURRENT + P1 for missing channels] |
| Consent capture (DPDP marketing / screening / data-processing / version / IP / UA) | [CURRENT] |
| Lead identity + human-readable code | [CURRENT] |
| Deterministic rules-based scoring + tier | [CURRENT] |
| Tier-based SLA scheduling + warn + breach + escalate | [CURRENT] |
| Automatic assignment to on-shift telecallers | [CURRENT] · site/skill/language upgrade [P1] |
| Telecaller workspace (queue, disposition, follow-up, convert) | [CURRENT] |
| Formal Lead state machine with guards, actor perms, side-effect intents | [P0 — v2.1 introduces] |
| Generic activity timeline (CALL/WHATSAPP/SMS/EMAIL/NOTE/FOLLOW_UP/COUNSELLING/APPOINTMENT/STATUS_CHANGE/ASSIGNMENT/ESCALATION/CONVERSION/SYSTEM) | [P1] |
| First-class Follow-up entity (OPEN/DUE/OVERDUE/COMPLETED/CANCELLED/RESCHEDULED) | [P1] |
| Counselling — Booking + Session + Outcome separated | [P1] |
| Duplicate detection (EXACT / PROBABLE / POSSIBLE) with human review | [P1] |
| DNC list + centrally-enforced outbound gate | [CURRENT list · P0 gate enforcement] |
| Conversion Port — the single boundary that hands off to Donor / Recipient | [P0] |
| Campaign definition + Attribution (first-touch + last-touch, UTM, creative, landing, referral) | [P2] |
| Analytics — funnel, CAC, telecaller productivity, SLA breach, cohort | [CURRENT basic · P2 comprehensive] |
| CRM synchronisation via event-driven outbox to Zoho / Salesforce / future | [P2] |
| Notifications via NotificationPort (email/SMS/WhatsApp/in-app) with DNC gate | [P1] |
| Configuration store (score weights, SLA matrix, retention, assignment, counselling, notification, campaign) with single-approver audit trail | [P1] |
| Audit trail for every material action | [CURRENT partial · P1 complete] |
| AI assist (classification, next-best-action, summarisation, churn prediction, conversational intake) | [P3 FUTURE — always gated with human review + audit] |

## 4 · Out of Scope (explicit exclusions)

The Lead module is **not**:

- The Donor clinical pathway (module 01 owns donor screening, consent, workup, deferrals)
- The Recipient clinical pathway (owns treatment planning, cycle, outcome)
- Sample collection / andrology lab (module 03)
- Embryology / cryopreservation (module 04)
- Dispatch / recipient chain-of-custody (module 05)
- Billing / invoicing / payments (module 06)
- Medical Records / DAM (module 11)
- IAM / user administration (module 12)
- The place where Donor or Recipient records are created — the Lead module **requests** creation via `ConversionPort`; only the downstream domain creates the entity

## 5 · Personas

| Persona | Role | Primary surface | Success looks like |
|---|---|---|---|
| **Telecaller (Sr / Jr)** | Owns lead pipeline, dispositions calls | Telecaller Workspace + Lead 360 | Zero SLA breaches · high call volume · high qualified rate |
| **Counsellor** | Holds counselling sessions with qualified recipient leads | Counsellor Workspace + Calendar | High attended rate · high recommended-to-register rate |
| **Ops Manager** | Reassigns, resolves duplicates, manages DNC, audits QA sample | Assignment Centre + Duplicate Review + Audit | Load balanced · <2% duplicate rate · zero DNC breach |
| **Marketing Manager** | Owns campaign definition and attribution health | Campaign Manager + Analytics | Accurate CAC per campaign · attribution captured >95% of leads |
| **CRM Admin** | Manages sync to Zoho/Salesforce (when adopted) | CRM Sync Monitor | Zero unsynced records >24h · DLQ empty |
| **Bank Super Admin / Medical Director** | Cross-cutting oversight | Command Centre + Audit | Business health visible at a glance |
| **Prospective Donor** | Enquires about donation | Web form / WhatsApp / phone | Contacted within tier SLA · positive counselling experience |
| **Prospective Recipient** | Enquires about treatment | Web form / WhatsApp / clinic referral | Booked into counselling within SLA · smooth conversion |
| **Referring Clinic / Hospital Partner** | Refers a patient to the ART Bank | Partner intake API + attribution | Referral recognised · commercial terms honoured |

## 6 · User Journeys (canonical)

### 6.1 Donor Journey · web-form origin

1. Prospective donor submits web intake with consent
2. System scores → tier assigned → SLA scheduled → auto-assigned to on-shift telecaller
3. Telecaller sees lead in queue sorted by SLA urgency
4. Telecaller calls · dispositions CONTACTED_QUALIFIED
5. Telecaller triggers **Convert to Donor** → `ConversionPort.convertToDonor()` → Donor record created in module 01, `sourceLeadId` linkage preserved
6. Lead state = CONVERTED (terminal-positive) · analytics reflect
7. Donor continues in Donor Pathway (screening, consent, cryo, etc.)

### 6.2 Recipient Journey · WhatsApp origin

1. Prospective recipient messages LifeSeed WhatsApp
2. Bot captures intake + consent · lead created with signature-verified webhook
3. Score + tier + SLA + assignment
4. Telecaller dispositions CONTACTED_QUALIFIED · books counselling with a Counsellor
5. Counselling reminders scheduled (24h + 2h before) via NotificationPort
6. Counsellor holds session · appends CounsellingSession record with outcome recommendation
7. If recommended → **Convert to Recipient** → Recipient record created, sourceLeadId preserved
8. Lead state = CONVERTED · analytics reflect

### 6.3 Callback Loop

1. Telecaller reaches donor but not ready to decide
2. Disposition = CONTACTED_CALLBACK_REQUESTED · creates LeadFollowUp with dueAt
3. Follow-up cron ticks OPEN → DUE at dueAt → OVERDUE if unactioned
4. Telecaller queue prioritises DUE follow-ups
5. On call, disposition either qualifies or loops again (max attempts configurable)

### 6.4 Duplicate Resolution

1. Ops Manager sees Duplicate Review queue populated by match rules (EXACT / PROBABLE / POSSIBLE)
2. Side-by-side compare of both leads
3. Decision: **Merge** (loser activities preserved on winner, LeadMerge audit row) · **Keep Separate** (dismiss with reason) · **Dismiss** (not actually a match)
4. Merge is irreversible; audit-defensible

### 6.5 LOST → Reactivation (within 90-day window)

1. Lead marked LOST after disposition or attempt exhaustion
2. Within 90 days of `lostAt`, Supervisor may `reactivate` → new context recorded
3. Beyond 90 days, reactivation refused; a new lead must be created (subject to DPDP re-consent)

### 6.6 Retention Expiry

1. Cron detects `retentionExpiresAt < now` and status not CONVERTED
2. State → EXPIRED_AUTO_PURGED · PII (fullName/phone/email/address) redacted
3. Scoring metadata retained for aggregate analytics
4. Audit row records the purge

## 7 · Lead Lifecycle (product view)

Fifteen states. **Only three are terminal:** CONVERTED, LOST (reactivable within 90 days), EXPIRED_AUTO_PURGED (never reactivable).

Status is *what stage the lead is at*. Outcome is *how it ended* (WON / LOST / EXPIRED / MERGED). Archive is a *filing state* (`isArchived: true` moves a lead out of active queues without changing its Status or Outcome). These three concepts are strictly separate — see §3 of `04_LEAD_STATE_WORKFLOW.md`.

## 8 · Telecalling (product view)

Telecallers work off a **prioritised queue** driven by SLA urgency, tier, and follow-up dueness. Every call is a `LeadActivity` of type CALL with disposition (`CallRecord` detail). Dispositions map to state-machine events, not free-form status writes. Deep-links respect ownership scope (P0 IDOR fix). Telecallers cannot see leads outside their assignment scope.

## 9 · Counselling (product view)

Counselling exists only for Recipient leads. A **Booking** captures the intent (counsellor, mode, slot, duration). Each attempt to hold the session appends a **Session** row (never overwrites). Each Session has an **Outcome** (ATTENDED_RECOMMENDED / ATTENDED_NOT_RECOMMENDED / NO_SHOW / CANCELLED_BY_CLINIC / CANCELLED_BY_LEAD). Reschedule creates a new Booking pointing to the previous one via `rescheduledFromBookingId`.

## 10 · Follow-up (product view)

A **first-class task** with owner, type, dueAt, priority, reason, status, outcome, and optional nextFollowUpId chain. Statuses: OPEN → DUE → OVERDUE → COMPLETED / CANCELLED / RESCHEDULED. Integrates with SLA (warn on approach, breach on lapse) and NotificationPort (owner reminder).

## 11 · Conversion (product view)

The **only** business handoff between Lead and downstream domains. Implemented as `ConversionPort`. Convert eligibility checks: status = CONTACTED_QUALIFIED (donor) or COUNSELLING_ATTENDED with RECOMMENDED (recipient); DNC clean; required fields present. Conversion is a single database transaction spanning: Lead state transition · `LeadConversion` row (unique on `leadId` — enforces no-double-convert) · downstream `Donor` or `Recipient` creation with `sourceLeadId` populated · SLA completion · outbox event `LeadConverted`.

## 12 · CRM (product view)

CRM (Zoho / Salesforce / future) is an **event consumer**, not a synchronous dependency. The Lead transaction commits with an outbox event; a background dispatcher publishes it to a CrmSyncQueue; the CRM adapter transforms and pushes. If CRM is down, Lead operations continue. Retry ladder with exponential backoff, DLQ after max attempts, external ID + last-sync tracked per record.

## 13 · Campaign (product view)

Marketing defines a **Campaign** (source, medium, budget, dates, owner, creative refs). Every intake carries **first-touch** and **last-touch** attribution. First-touch is immutable once set. Last-touch is versioned via `LeadAttributionHistory` so a later touchpoint doesn't erase what came before. UTM + landing + creative + referral partner captured per touch. Enables per-campaign CAC and downstream ROI.

## 14 · Analytics (product view)

Six primary views:

1. **Acquisition funnel** — Intake → Assigned → Contacted → Qualified → Counselled → Converted per source and per campaign
2. **CAC** — spend from Campaign / qualified leads · / active donor · / registered recipient
3. **SLA breach** — per tier, per stage, per telecaller
4. **Telecaller productivity** — calls, avg duration, dispositions, conversions, breach count
5. **Cohort retention** — leads captured in month M, converted by month M+n
6. **DPDP + DNC compliance** — consent freshness, DNC coverage, purge job health

Every analytics number carries its **as-of timestamp** and **cohort criteria**.

## 15 · Future Roadmap

| Horizon | Capability |
|---|---|
| **v2.2** | Assignment upgrade (site + shift + skill + language + capacity) · Campaign + Attribution live · CRM real adapters |
| **v2.3** | AI-assisted lead prioritisation (LLM ranking with confidence + human override) · AI call summarisation from telecaller notes · Predictive lead score (behavioural signals over rules) |
| **v3.0 (SaaS)** | Multi-tenant deployment · plugin architecture for tenant-specific rules · marketplace of pre-built campaign templates |
| **v3.1** | Duplicate detection ML · conversational WhatsApp intake with LLM · outbound sequence orchestration |
| **v4.0** | CRM assistant chat over Lead 360 · churn/drop-off prediction · campaign optimisation loop |

Every AI feature must ship with: data inputs · model + version · confidence · human review requirement · audit trail · fallback path. AI never bypasses RBAC.

## 16 · Approved Founder Decisions (from v2.1 freeze)

| # | Decision | Marker | Impact |
|---|---|---|---|
| 1 | SMS provider = **SMS-Magic** (https://www.sms-magic.com/), integrated only through NotificationPort | [APPROVED] | See `02_LEAD_ARCHITECTURE_MASTER.md` §8 |
| 2 | Lead reactivation window = **90 days** | [APPROVED] | See `04_LEAD_STATE_WORKFLOW.md` §7 |
| 3 | Critical configuration = **single authorised approver** (author ≠ approver, audited) | [APPROVED] | See `02_LEAD_ARCHITECTURE_MASTER.md` §11 + `03_LEAD_DATA_MODEL.md` `LeadConfig` |

## 17 · Explicit Non-Goals (guard against scope creep)

- The Lead module will **not** silently create Donor or Recipient records
- The Lead module will **not** perform clinical or medical decisions
- The Lead module will **not** hold payment data
- The Lead module will **not** own document storage (routes to MRD module 11 when documents are attached to a lead)
- The Lead module will **not** synchronously depend on CRM being up
- The Lead module will **not** ship AI features without explainability + human review + audit

---

**Document owner:** Product (Founder-approved)
**Next review:** upon completion of v2.1 build (Batches P0-P3)
