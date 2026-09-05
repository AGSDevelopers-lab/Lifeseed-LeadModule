# 07 · Lead Module — Engineering Source of Truth

**Status:** Implemented in code (additive Prisma migration `20260902120000_lead_management`).  
**Not yet mirrored in** `data_model.md` or `user_roles_rbac.md` — those files still describe the original 6-module pack. Treat **this document + Prisma schema** as the current contract until those files are updated.  
**Position in product:** Upstream of Donor Pathway (`01`) and Recipient acquisition. A Lead is a *pre-clinical enquiry*, not a Donor/Recipient. Conversion is the only legal handoff into those entities.

Use this file when enhancing, extracting, or porting the module. Facts below are taken from the running implementation, not from an original HTML spec (none exists for Leads).

---

## 1. Purpose and product boundaries

### In scope (today)

- Capture enquiry (web, WhatsApp stub, telecaller inbound).
- Score + tier at intake; assign to a telecaller; SLA on first response / qualification window.
- Call dispositions; Do Not Call (DNC) list; counselling booking (1:1 per lead).
- Convert qualified donor lead → `Donor` (via existing P0 intake); recipient lead → `Recipient`.
- DPDP-oriented retention: unconverted PII auto-redact after 1 year; converted leads are exempt.
- Optional CRM outbound queue (Zoho / Salesforce stubs).
- Admin list / analytics / CSV export (non-PII columns).
- Funnel reporting (`logistics.donor_funnel`) joining Lead statuses to Donor phases.

### Out of scope (do not fold into this module)

- Donor screening, consents STAGE_2, samples, cryo, DRF, dispatch, billing.
- Aadhaar collection at telecall (deferred to P1 + STAGE_2 consent).
- Multi-tenant `orgId` / ART-bank tenancy (the app is currently single-bank).
- Real telephony, call recording ingest, QA sampling UI (schema fields exist; unused).
- A dedicated Lead **state machine service** (statuses are updated inline).

### Non-goals that affect design

- Lead is **not** a Donor. `Donor.sourceLeadId` is nullable so pre-Lead donors remain valid.
- One Lead converts to **at most one** Donor **or** one Recipient (unique FKs both ways in practice).
- Person type is immutable after create (`DONOR` | `RECIPIENT`). Changing type is not supported.

---

## 2. Layered architecture (as built)

```
┌─────────────────────────────────────────────────────────────────┐
│  PORTALS (Next.js App Router, server components + RHF-ish forms)│
│  /admin/leads*   /telecaller/*   /counsellor/*                  │
│  Server actions: src/app/(portals)/leads/actions.ts             │
└────────────────────────────┬────────────────────────────────────┘
                             │ requirePermission()
┌────────────────────────────▼────────────────────────────────────┐
│  HTTP INTAKE (public or session)                                │
│  POST /api/leads/intake/web                                     │
│  POST /api/leads/intake/whatsapp                                │
│  POST /api/leads/intake/webhook/telecaller                      │
│  GET  /api/leads/export                                         │
│  POST /api/leads/purge-expired | sla/run | crm-sync/run         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  DOMAIN (portable core — keep this folder cohesive)             │
│  src/lib/leads/*                                                │
│    create-lead.ts · lead-scoring.ts · lead-assignment.ts        │
│    lead-conversion.ts · lead-code-generator.ts · rate-limit.ts  │
└──┬──────────────┬──────────────┬──────────────┬─────────────────┘
   │              │              │              │
   ▼              ▼              ▼              ▼
 Prisma        SLA engine     CRM queue      Donor/Recipient
 Lead*         src/lib/sla    src/lib/crm    (tight coupling
 models        (shared)       (shared)        on convert)
```

**Convention mismatch vs `cursor_workflow.md`:** pages and server actions call Prisma directly. The “never Prisma from components” rule is already violated for this module (and most of the app). If you extract a portable package, introduce a repository/service boundary here first.

There is **no** `EventEmission` usage for leads. Cross-module notify is either Prisma FK writes or CRM queue rows.

---

## 3. File map (complete)

### Domain

| Path | Responsibility |
|---|---|
| `src/lib/leads/create-lead.ts` | Intake orchestration: DNC check, consent gate, code, score, persist, assign, SLA, CRM enqueue, audit |
| `src/lib/leads/lead-scoring.ts` | Deterministic 0–100 score + HOT/WARM/COLD/ARCHIVED tier |
| `src/lib/leads/lead-assignment.ts` | Forced or auto-assign; stamps `Lead.sla*DueAt` |
| `src/lib/leads/lead-conversion.ts` | Donor/Recipient conversion + `guessSiteCode` |
| `src/lib/leads/lead-code-generator.ts` | `LED-{CITY}-{YYYYMMDD}-{seq}` |
| `src/lib/leads/rate-limit.ts` | In-memory IP limiter (web intake only) |

### Shared (Lead is a *client*, not owner)

| Path | Lead usage |
|---|---|
| `src/lib/sla/definitions.ts` | `lead_*_response`, counselling reminders; also donor/embryology SLAs |
| `src/lib/sla/engine.ts` | `scheduleSla`, `runPendingChecks`, `markCompletedByEntity` |
| `src/lib/crm/sync-queue.ts` | `enqueue` on create; `runPendingSync` |
| `src/lib/crm/adapters/zoho-adapter.ts` | Stub delay + console |
| `src/lib/crm/adapters/salesforce-adapter.ts` | Stub |
| `src/lib/audit.ts` | All mutations |
| `src/lib/rbac.ts` / `rbac-permissions.ts` | Permissions + portal routing |
| `src/app/(portals)/admin/donors/actions.ts` | `createDonorIntake` — **hard import from conversion** |
| `src/lib/reports/definitions/logistics-donor-funnel.ts` | Funnel stages |
| `src/lib/reports/definitions/clinical-donor-acceptance.ts` | `hasSourceLead` / `sourceLeadId` columns |
| `src/lib/reports/dashboards.ts` | Lead captured / conversion % tiles |

### HTTP

| Route | Auth | Notes |
|---|---|---|
| `POST /api/leads/intake/web` | Public (middleware allowlist) | Rate-limited; source forced `WEB_FORM` |
| `POST /api/leads/intake/whatsapp` | Signature header | Stub; fire-and-forget create; always DONOR |
| `POST /api/leads/intake/webhook/telecaller` | Session + `lead.create` | Source `PHONE_INBOUND`; self-assign |
| `GET /api/leads/export` | `lead.export` | CSV, 5000 rows, **no phone/email/name** |
| `POST /api/leads/purge-expired` | Cron secret **or** `lead.archive` | Batches 200 |
| `POST /api/leads/sla/run` | Cron secret **or** `lead.list` | Runs **all** pending SLAs, not only leads |
| `POST /api/leads/crm-sync/run` | Cron secret **or** `crm.sync.manual` | |

**Security fact:** cron routes are on `PUBLIC_PREFIXES` in `middleware.ts` (no Supabase session required). Protection is only `x-cron-secret` === `LEADS_CRON_SECRET` || `CRON_SECRET`. If secret is unset, cron path fails closed only if a session with the right permission is present.

### UI

| Path | Portal |
|---|---|
| `src/app/(portals)/admin/leads/page.tsx` | List + funnel counts + filters |
| `src/app/(portals)/admin/leads/[id]/page.tsx` | Detail + `LeadAdminActions` |
| `src/app/(portals)/admin/leads/analytics/page.tsx` | Conversion / SLA breach tiles |
| `src/app/(portals)/admin/leads/do-not-call/page.tsx` | DNC admin |
| `src/app/(portals)/telecaller/dashboard/page.tsx` | KPI tiles |
| `src/app/(portals)/telecaller/queue/page.tsx` | Assigned open leads, SLA sort |
| `src/app/(portals)/telecaller/leads/page.tsx` | Assigned only (`lead.view`) |
| `src/app/(portals)/telecaller/leads/new/page.tsx` | Client form → telecaller intake API |
| `src/app/(portals)/telecaller/leads/[id]/page.tsx` | Call panel; **no assignment ownership check** |
| `src/app/(portals)/telecaller/leads/[id]/lead-call-panel.tsx` | Disposition + convert UI |
| `src/app/(portals)/telecaller/leads/[id]/book-counselling/*` | Booking form |
| `src/app/(portals)/telecaller/do-not-call/*` | DNC add |
| `src/app/(portals)/counsellor/dashboard/page.tsx` | Upcoming sessions |
| `src/app/(portals)/counsellor/sessions/*` | Mark attended / no-show |
| `src/app/(portals)/leads/actions.ts` | Shared server actions |
| `src/components/consent/lead-consent-notice.tsx` | DPDP notice + 3 consents + grievance officer |
| `src/components/auth/portal-shell.tsx` | Nav for admin / telecaller / counsellor |

### Persistence

| Path | Notes |
|---|---|
| `prisma/schema.prisma` | Enums + models from ~L1419 |
| `prisma/migrations/20260902120000_lead_management/migration.sql` | Additive; new `UserRole` values; `Donor.sourceLeadId`; `Recipient.sourceLeadId` |

---

## 4. Data model (facts that constrain design)

### 4.1 Enums

**`LeadPersonType`:** `DONOR` | `RECIPIENT`  
**`LeadDonorSubType`:** `SEMEN` | `OOCYTE` (nullable; only meaningful for DONOR)  
**`LeadSource`:** `WEB_FORM`, `WHATSAPP_BOT`, `PHONE_INBOUND`, `WALK_IN`, `REFERRAL`, `SOCIAL_FACEBOOK`, `SOCIAL_INSTAGRAM`, `SOCIAL_GOOGLE_ADS`, `CLINIC_REFERRAL`, `PARTNER_HOSPITAL`, `OTHER`  
**`LeadTier`:** `HOT` | `WARM` | `COLD` | `ARCHIVED` — **tier is not a status**. Archive-by-admin sets `tier=ARCHIVED` **and** `status=LOST`. Scoring can also emit `ARCHIVED` for score &lt; 30 at intake while status remains `NEW`.  
**`LeadStatus`:** see state section.  
**`CallDispositionType`:** subset of statuses (no counselling/convert/purge).  
**`CounsellingMode`:** `IN_PERSON` | `VIDEO_CALL` | `PHONE`  
**`CounsellingBookingStatus`:** `BOOKED` | `ATTENDED` | `NO_SHOW` | `RESCHEDULED` | `CANCELLED`  
**`SlaEntityType` (shared):** `LEAD_RESPONSE`, `LEAD_QUALIFICATION`, `COUNSELLING_BOOKING`, `COUNSELLING_REMINDER`, plus donor/embryology types. **Only `LEAD_RESPONSE` and `COUNSELLING_REMINDER` are scheduled today.**  
**`CrmEntityType`:** `LEAD` | `DONOR` | `RECIPIENT`  
**`CrmSyncTarget`:** `ZOHO` | `SALESFORCE` (enqueue defaults to ZOHO)  
**`DncSource`:** `SELF_REQUEST` | `OPS_ADD` | `COMPLIANCE_ADD` (`SELF_REQUEST` unused in UI)

### 4.2 `Lead` fields (behavioural notes)

| Field | Constraint / behaviour |
|---|---|
| `id` | cuid |
| `leadCode` | Unique human ID `LED-{CITY}-{YYYYMMDD}-{XXXX}`. Date is **UTC** from `capturedAt.toISOString()`. City codes: KOL/HYD/DEL/MUM/BLR/CHN/PUN/AHM else `OTH`. Sequence = `count(prefix)+1` — **race-prone** under concurrent intake. |
| `sourceMetadata` | JSON. Conversion stores `preferredIntakeAt`, `coordinatorUserId`, `aadhaarDeferred`. WhatsApp stores `raw` + `text`. |
| `phone` | Indexed, **not unique**. DNC is the only phone uniqueness. Duplicate enquiries are allowed. |
| `phoneCountryCode` | Default `+91` |
| `score` / `scoreBreakdown` | Frozen at intake (response-speed component is 0 until rescored — **no rescore path**) |
| `assignedTelecallerId` | SET NULL on user delete |
| `slaResponseDueAt` / `slaQualifyDueAt` | Denormalised copies of SLA engine for UI sort |
| `convertedDonorId` / `convertedRecipientId` | Unique columns on Lead. **Not** the Prisma relation fields. The ORM relation `convertedDonor` is the **back-relation of `Donor.sourceLeadId`**. Conversion writes **both** Lead columns and Donor/Recipient `sourceLeadId`. |
| `doNotCallFlag` | Denormalised; DNC table is source of truth at intake |
| `consent*` | DPDP. `consentDataProcessing` required at create. Versions seen: `lead-v1.0`, `telecaller-v1`, `wa-v1` |
| `retentionExpiresAt` | `capturedAt + 1 calendar year UTC`. Set **null** on convert (never auto-purge converted) |
| `lastActivityAt` | Updated on assign, disposition, book, convert, archive, purge |

Indexes: `status`, `tier`, `personType`, `assignedTelecallerId`, `retentionExpiresAt`, `phone`.

### 4.3 Related models

**`CallDisposition`:** many per lead. Unused in UI: `qaScore`, `qaSampledByUserId`, `qaSampledAt`, `recordingUrl`.  
**`CounsellingBooking`:** **1:1** (`leadId` unique). Reschedule = upsert same row. No history of prior slots. Reminder SLAs keyed by **booking id**, not lead id.  
**`LeadDoNotCallList`:** `phone` unique. `expiresAt` respected at intake (`isOnDoNotCallList`). Expired rows are **not** auto-deleted.  
**`SlaSchedule`:** unique `(entityType, entityId, stageKey)`. Generic engine; Lead is one consumer.  
**`CrmSyncQueue`:** no unique on `(entityType, entityId)` — duplicate enqueue possible.

### 4.4 Downstream FKs (portability critical)

```
Donor.sourceLeadId     → Lead.id  UNIQUE, ON DELETE SET NULL
Recipient.sourceLeadId → Lead.id  UNIQUE, ON DELETE SET NULL
```

Pre-existing donors/recipients have `sourceLeadId = null`. Reports treat that as “no source lead”.

---

## 5. Status lifecycle (implemented, not a state machine)

There is **no** `src/lib/leads/stateMachine.ts`. Transitions are scattered in actions/create/assign/purge.

```
                    create
                      │
                      ▼
                    NEW ──auto/force assign──► ASSIGNED
                                                 │
                    ┌────────────────────────────┤  saveDisposition
                    │                            ▼
                    │              CONTACTED_QUALIFIED ──► CONVERTED
                    │              CONTACTED_NOT_INTERESTED
                    │              CONTACTED_CALLBACK_REQUESTED  (still “open” for queue capacity)
                    │              NOT_REACHABLE                 (still open)
                    │              WRONG_NUMBER
                    │              DO_NOT_CALL  (+ DNC upsert)
                    │              LOST
                    │
                    │  bookCounselling (any person type in action;
                    │  UI button only for RECIPIENT on telecaller detail)
                    ▼
           COUNSELLING_BOOKED ──mark ATTENDED──► COUNSELLING_ATTENDED ──► CONVERTED
                              ──mark NO_SHOW──► COUNSELLING_NO_SHOW
                    │
                    ├── archiveLead  → status LOST, tier ARCHIVED  (blocked if CONVERTED)
                    └── purge / cron → EXPIRED_AUTO_PURGED + PII null  (blocked if CONVERTED)
```

**Conversion gate:** status must be `CONTACTED_QUALIFIED` **or** `COUNSELLING_ATTENDED`.  
**Open queue (capacity / auto-assign):** `NEW`, `ASSIGNED`, `CONTACTED_CALLBACK_REQUESTED`, `NOT_REACHABLE`, `COUNSELLING_BOOKED`.  
**Telecaller work queue (UI):** assigned to self, status **not in** `CONVERTED | LOST | EXPIRED_AUTO_PURGED | DO_NOT_CALL`.

**Illegal / missing transitions (design debt):**

- No dedicated transition for `RESCHEDULED` / `CANCELLED` counselling → Lead status stays `COUNSELLING_BOOKED` if booking flags change without `markCounsellingSession`.
- Disposition after counselling can **overwrite** counselling statuses (no guard).
- `NEW` can remain forever if auto-assign off and no telecallers / all at cap.
- WhatsApp create is async (`void ...catch`); failures are silent.

---

## 6. Scoring (hardcoded — conflicts with “no hardcoded thresholds”)

`scoreLead` sums components, clamps 0–100.

| Component | Max | Rule |
|---|---|---|
| Age | 20 | Recipient: always 15. Oocyte: 23–35 → 20; 21–37 → 12; else 4. Semen: 21–40 → 20; 18–45 → 12; else 4. Parses `ageGroup` as `n-n` midpoint or single number. Missing age → 5. |
| Source | 20 | Referral 20, clinic referral 18, walk-in/partner hospital 15, web/WhatsApp 10, phone 8, socials 5, other 2 |
| Response speed | 10 | `responseHours` ≤1 → 10; ≤6 → 5; ≤24 → 2. **Always 0 at intake** |
| Completeness | 20 | 8 fields equally weighted: name, phone, email, city, state, pincode, ageGroup, preferredLanguage |
| Location | 10 | City/state normalised against `SERVICE_AREAS`: WB/WestBengal, TG/Telangana, Delhi, Mumbai, Bangalore/Bengaluru, Hyderabad, Kolkata. Hit → 10; any other filled → 3 |
| Language | 5 | english, hindi, bengali, telugu (case-insensitive) |

**Tiers:** ≥75 HOT, ≥55 WARM, ≥30 COLD, else ARCHIVED.

SLA keyed off **tier at intake**:

| Tier | SLA key | First response | Complete (qualify) | Escalation roles |
|---|---|---|---|---|
| HOT | `lead_hot_response` | 2h | 24h | 25% OPS_MANAGER, 50% MARKETING_MANAGER, 100% BANK_SUPER_ADMIN |
| WARM | `lead_warm_response` | 24h | 72h | 50% OPS, 100% MARKETING |
| COLD or ARCHIVED | `lead_cold_response` | 72h | 168h | 100% OPS |

Escalation today is **audit + status on `SlaSchedule`**, not guaranteed inbox/WhatsApp (engine writes audit; check `runPendingChecks` if adding real notify).

Counselling reminders: SLA rows start at `scheduledAt - 24h` and `- 2h` (skipped if that instant is already past).

---

## 7. Assignment

- Env `LEADS_AUTO_ASSIGN_ENABLED` default **true** (disabled only if string `"false"`).
- Env `LEADS_MAX_QUEUE_PER_TELECALLER` default **20**.
- Pool: `User.isActive` + role `TELECALLER`. **Ignores `User.siteId`, language, shift, skills.**
- Picks lowest open-lead count under cap. Not true round-robin (ties = first in `findMany` order).
- Forced assign (`lead.assign` / telecaller self on inbound) **bypasses cap**.
- If no eligible telecaller, lead stays `NEW` (`assignLead` returns `null`).

---

## 8. Conversion contracts

### Donor (`convertLeadToDonor`)

Requires: DONOR person type, status gate, name+phone, not DNC.  
Maps `donorSubType OOCYTE` → `DonorType.OOCYTE` else SEMEN.  
Calls `createDonorIntake` (admin donor actions) — inherits **all** P0 validation, site existence, ART rules inside that function.  
Then sets `Donor.sourceLeadId`, Lead `CONVERTED` + `convertedDonorId`, clears `retentionExpiresAt`, completes SLA entity types `LEAD_RESPONSE` and `LEAD_QUALIFICATION` (latter may have no row).  
Aadhaar optional; if omitted, extra audit `lead.converted.aadhaar_deferred`.  
Handoff metadata (preferred intake time, coordinator) lives only in `sourceMetadata` + audit — **no Appointment row**.

Permissions at action: `lead.convert` **and** `donor.create`. TELECALLER and OPS_MANAGER have both.

### Recipient (`convertLeadToRecipient`)

Requires email as well as name/phone.  
Creates `Recipient` **directly** (does not go through clinic `recipient.create` action). Code `R-{YYYYMMDD}-{seq}` UTC date. Requires `clinicId`.  
Does **not** mark SLA complete (donor path does).

### UI quirks

- Telecaller “Book counselling” button shown only when `personType === RECIPIENT` **and** `canConvert` — so booking is hidden until already qualified. Action `bookCounselling` itself has no person-type or status check.
- Donor convert collects DOB, gender, site, optional coordinator / preferred intake.

`guessSiteCode(city,state)`: Telangana/Hyderabad/TG → `SiteCode.TG`, else `SiteCode.WB`. Used as a **hint helper**, not auto-applied in create-lead.

---

## 9. Consent, DPDP, PII, compliance

| Rule | Implementation |
|---|---|
| Purpose limitation | Three booleans: processing (required), screening, marketing |
| Notice | `LeadConsentNotice` EN/HI/BN/TE. Hindi/Bengali/Telugu bodies labelled placeholder |
| Grievance officer | Hardcoded: Naitik Ganguly, `naitik@butterflyartbank.com` |
| IP / UA | Stored on web + telecaller intake |
| WhatsApp | Sets `consentMarketing=true`, `consentDataProcessing=true` **without a human checkbox** — compliance risk if used in prod |
| Retention | 1 year unconverted; cron redacts name, phone, email, city, state, pincode, consentIp, UA; **keeps** leadCode, score, tier, source, status `EXPIRED_AUTO_PURGED` |
| Converted | `retentionExpiresAt = null`; cannot archive or purge |
| Export | Omits identifiers other than `leadCode` |
| DNC | Blocks **new** intake; existing leads flagged via disposition or `addToDnc` (all leads with that phone → `DO_NOT_CALL`) |
| Aadhaar | Not on Lead model |
| Audit | `lead.create`, `lead.assign`, `lead.disposition`, `counselling.book`, `counsellor.mark`, `lead.convert.donor/recipient`, `dnc.add`, `lead.archive`, `lead.purge` |
| ART Act | Conversion into Donor pathway is the compliance boundary; Lead itself is enquiry CRM |
| 2-witness | **Not** used on Lead operations |
| IST display | Queue/detail show **UTC ISO strings**, not IST |

---

## 10. RBAC and portals

### New roles (not in original `user_roles_rbac.md`)

`TELECALLER`, `COUNSELLOR`, `OPS_MANAGER`, `MARKETING_MANAGER`, `CRM_ADMIN`

`portalForRole`: TELECALLER → `/telecaller/dashboard`; COUNSELLOR → `/counsellor/dashboard`; OPS / MARKETING / CRM_ADMIN → **admin** portal (they get admin nav including Leads).

### Permission matrix (actual `ROLE_PERMISSIONS`)

| Permission | SUPER_ADMIN | TELECALLER | COUNSELLOR | OPS_MANAGER | MARKETING | CRM_ADMIN |
|---|---|---|---|---|---|---|
| `lead.list` | ✓ | | | ✓ | ✓ | ✓ |
| `lead.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `lead.create` | ✓ | ✓ | | ✓ | | |
| `lead.assign` | ✓ | | | ✓ | | |
| `lead.convert` | ✓ | ✓ | | ✓ | | |
| `lead.archive` | ✓ | | | ✓ | | |
| `lead.purge` | ✓ | | | | | |
| `lead.export` | ✓ | | | | ✓ | |
| `telecaller.*` | ✓ | ✓ | | ✓ | | |
| `counselling.book` | ✓ | ✓ | | ✓ | | |
| `counsellor.*` | ✓ | | ✓ | ✓ | | |
| `dnc.list/add` | ✓ | ✓ | | ✓ | | |
| `dnc.remove` | ✓ | | | ✓ | | |
| `donor.create` | ✓ | ✓ | | ✓ | | |
| `crm.sync.*` | ✓ | | | | | ✓ |
| `marketing.*` | ✓ | | | | ✓ | |
| `ops.qa_sample` | ✓ | | | ✓ | | |

No other bank roles (`BANK_BRM`, `BANK_DONOR_COORD`, …) have `lead.*`. They cannot list leads in admin unless they also hold SUPER_ADMIN.

**IDOR note:** telecaller detail loads any lead by cuid if the user has `lead.view`. List is filtered to assigned; deep link is not.

Middleware protects `/telecaller` and `/counsellor` like other portals (login required). Layout still uses shared `PortalShell` — a counsellor hitting `/admin/leads` is a page-level permission issue (`lead.list` missing → redirect).

---

## 11. Environment and ops

| Variable | Default | Effect |
|---|---|---|
| `LEADS_CRON_SECRET` | example `change-me-in-prod` | Header `x-cron-secret` |
| `CRON_SECRET` | fallback for leads crons | Shared with other jobs |
| `LEADS_RATE_LIMIT_PER_IP_PER_HOUR` | 10 | Web intake |
| `LEADS_MAX_QUEUE_PER_TELECALLER` | 20 | Auto-assign cap |
| `LEADS_AUTO_ASSIGN_ENABLED` | true | |
| `COUNSELLING_DEFAULT_DURATION_MIN` | 30 | |
| `CRM_SYNC_ENABLED` | **false** | If false, enqueue writes `SKIPPED` |
| `WHATSAPP_WEBHOOK_SECRET` | `stub_ok_dev` | Also accepts any `x-gupshup-signature` **starting with** `stub_ok_` |

No `vercel.json` cron entries for lead jobs were found — **schedulers must be wired externally** (or they never run).

Rate limiter is **process memory**. On Vercel/serverless it does not coordinate across isolates; limit is per instance, not per IP globally.

---

## 12. Integrations (ports)

| Port | Direction | Maturity |
|---|---|---|
| Public web form | In | Real JSON API; no CSRF token; CORS = same-origin unless you front it |
| WhatsApp (Gupshup) | In | Stub signature + naive field mapping; always DONOR |
| Click-to-call | Out | `tel:` link only |
| Zoho CRM | Out | Queue + stub |
| Salesforce | Out | Queue + stub |
| Resend / Gupshup notify | Out | Not used by Lead SLA escalations |
| EventEmission / Zoho adapter worker | — | Not wired for Lead |

CRM payload on create: `{ leadCode, source, tier }` only.

---

## 13. Portability — what is portable vs what is LifeSeed-specific

### Relatively portable (keep as a package)

- Prisma models: Lead, CallDisposition, CounsellingBooking, LeadDoNotCallList (if you accept 1:1 counselling).
- `lead-code-generator`, `lead-scoring` **if** city/service-area/language/thresholds move to config.
- Intake pipeline shape: consent → DNC → identity → score → assign → SLA → audit.
- Status vocabulary + disposition map.
- DPDP retention + redact (keep analytics columns).
- RBAC permission **names** (`lead.*`, `dnc.*`, `counselling.*`).

### LifeSeed-coupled (must inject or replace)

| Coupling | Why it blocks a clean extract |
|---|---|
| `convertLeadToDonor` → `createDonorIntake` | Imports a portal server action, DonorType, Site, ART P0 rules |
| `convertLeadToRecipient` → `Recipient` + `clinicId` | Assumes LifeSeed Recipient model |
| `SiteCode` WB/TG | Two-site bank |
| `SERVICE_AREAS` / `CITY_CODES` | India / LifeSeed geography |
| Grievance officer copy | Legal entity Butterfly ART Bank |
| Shared `SlaSchedule` + embryology/donor keys in same definitions file | Extract SLA as a plugin or duplicate |
| Shared `CrmSyncQueue` | Same |
| `UserRole` enum values in Postgres | Additive ALTER TYPE; other products may not want these roles |
| `portalForRole` + PortalShell nav | App shell, not module |
| Reports module funnel | Downstream analytics |
| `audit.log` shape (`donorRelId`) | Platform audit |
| Next.js App Router + server actions | Framework |

### Recommended portable module boundary

```
@lifeseed/leads
  domain: types, scoring, assignment policy, code gen, DNC, retention
  ports:
    LeadRepository
    AssignmentDirectory (list telecallers + open counts)
    Clock / IdGenerator
    AuditPort
    ConversionPort.convertDonor(input) / convertRecipient(input)  // implemented by host
    SlaPort.schedule / complete
    CrmPort.enqueue
    ConfigPort  // thresholds, SLA hours, cities, queue cap, retention days
```

Host app (this repo) would implement ports with Prisma, `createDonorIntake`, `scheduleSla`, `enqueue`.

**Do not** ship in-memory rate limit or WhatsApp stub-prefix auth in a portable package.

### Multi-tenant / other ART banks

Today there is **no** `bankId` / `orgId` on Lead. Porting to another bank in the same DB requires a tenant column on Lead, DNC, SLA, CRM queue, and assignment pools. Site-aware assignment (`User.siteId`) is the natural first split.

---

## 14. Design debts that will bite enhancements

1. **No state machine** — easy to invent illegal status combos; counselling vs disposition race.
2. **Scoring never re-run** after first call (response-speed points unused).
3. **Lead code sequence** not transactional (`count` then insert).
4. **Duplicate phones** allowed except DNC block on create.
5. **Counselling 1:1** — cannot book a second session without overwriting.
6. **Dual conversion IDs** (`Lead.convertedDonorId` vs `Donor.sourceLeadId`) can drift if one write fails.
7. **Public cron routes** — secret must be strong; SLA runner is global.
8. **WhatsApp consent** auto-true.
9. **IDOR** on telecaller `[id]`.
10. **Hardcoded scoring/SLA/retention** vs workspace rule “read from admin config”.
11. **Specs drift** — Cursor agents still load `data_model.md` without Lead.
12. **No tests** in repo for this module.
13. **Export/list caps** 200 / 100 / 5000 — no pagination protocol.
14. **`LEAD_QUALIFICATION` / `COUNSELLING_BOOKING` entity types** unused for schedule.
15. **QA / recording fields** unused.
16. **Archive** uses `LOST` status — analytics that count LOST mix “true lost” and archived.
17. **Book counselling UI** gated on `canConvert` for recipients only — product vs schema mismatch.
18. **Server components query Prisma** — harder to reuse domain from a worker or another app.

---

## 15. Safe enhancement order (for later work)

1. Back-fill `data_model.md` + `user_roles_rbac.md` from this file so agents stay consistent.
2. Introduce `transitionLead(id, to, actor, context)` with an explicit allowed-edges table; route all status writes through it.
3. Move scoring/SLA/retention/queue cap/service areas into admin config (JSON on `Config` or similar).
4. Ownership check on telecaller detail; optional duplicate-phone merge.
5. Extract `ConversionPort` so Lead does not import donor actions.
6. Wire crons; replace in-memory rate limit; tighten WhatsApp auth.
7. Rescore on first disposition; complete `LEAD_RESPONSE` on first contact (not only convert).
8. Counselling history (1:N) if product needs reschedules without losing SLA rows.
9. Real CRM adapters; emit `EventEmission` on convert for Donor Coord dashboards.
10. Tests: scoring table, DNC, conversion gates, purge exemption, assign cap.

---

## 16. Cursor / agent instructions

When changing Lead behaviour:

- Read this file and `prisma/schema.prisma` Lead section.
- Keep conversion as the only write into Donor/Recipient.
- Do not collect Aadhaar on Lead.
- Do not auto-purge `CONVERTED`.
- All new APIs: `requirePermission` except documented public intake.
- All writes: `audit.log`.
- Do not hardcode new business thresholds; if you must ship a default, read env **and** leave a config hook.
- Prefer extending `src/lib/leads/*` over adding logic in pages.
- If you add a status, update: Prisma enum, disposition map (if call-related), open-queue arrays, funnel report `STAGES`, this document.

---

## 17. Quick reference — create path (happy path)

1. Client POST intake with `consentDataProcessing=true`.
2. Reject if phone on DNC (and not expired).
3. Generate `LED-…` code; score; set retention +1y; insert `NEW`.
4. Auto-assign → `ASSIGNED` (or stay `NEW`).
5. `scheduleSla` for tier + stamp due dates on Lead.
6. `CrmSyncQueue` PENDING or SKIPPED.
7. Audit `lead.create`.
8. Telecaller disposition → new `CallDisposition` + status.
9. Optional counselling upsert → `COUNSELLING_BOOKED` + reminder SLAs.
10. Convert → Donor/Recipient + unique source link + `CONVERTED` + retention cleared.
