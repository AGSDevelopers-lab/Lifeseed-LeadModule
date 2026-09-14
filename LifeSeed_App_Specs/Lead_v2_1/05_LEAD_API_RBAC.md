# 05 · Lead Management — API + RBAC (v2.1)

**Status:** ARCHITECTURE FREEZE · Founder-approved 2026-09-04
**Companion docs:** `01_LEAD_PRODUCT_MASTER.md` · `02_LEAD_ARCHITECTURE_MASTER.md` · `03_LEAD_DATA_MODEL.md` · `04_LEAD_STATE_WORKFLOW.md` · `06_LEAD_BUILD_MIGRATION.md`

---

## 1 · API Architecture Overview

- **Namespaces:**
  - `/api/leads/*` — legacy v1 endpoints (RETAINED for backward compat during migration)
  - `/api/leads/v2/*` — v2.1 surface
  - `/api/leads/v2/internal/*` — cron / worker endpoints (HMAC-signed)
- **Auth:** session cookie (browser) OR JWT bearer (SaaS clients) OR HMAC (internal cron/worker)
- **Idempotency:** required for all POST/PATCH; header `Idempotency-Key: <uuid>`; server dedups within 24h window
- **Pagination:** cursor-based on all list endpoints; `?cursor=<opaque>&limit=<50>`
- **Validation:** zod schema on every input; typed error envelope on failure
- **Errors:** `{ error: { code, message, details[], requestId, documentation } }` — codes per §7
- **Audit:** every non-GET writes to hash-chain audit; GETs on sensitive endpoints (Lead 360, export) also audited with purpose capture
- **Rate limiting:** public intake endpoints IP-limited (10/hr web, 30/hr WhatsApp); authenticated endpoints user-rate-limited per role tier
- **Versioning:** URL-based major (v2), response envelope carries `apiVersion` + `schemaVersion`
- **OpenAPI 3.1 spec:** auto-generated from route schemas; published under `/api/leads/v2/openapi.json`

---

## 2 · Endpoint Inventory

### 2.1 Intake

| Method | Path | Perm | Idempotent | Notes |
|---|---|---|---|---|
| POST | `/v2/intake/web` | Public (rate-limited) | Yes | Web-form intake · full consent capture |
| POST | `/v2/intake/whatsapp` | Meta signature-verified | Yes | Real X-Hub-Signature-256 validation |
| POST | `/v2/intake/phone` | `lead.intake` | Yes | Telecaller manual phone-inbound |
| POST | `/v2/intake/walkin` | `lead.intake` | Yes | Walk-in front-desk capture |
| POST | `/v2/intake/referral` | `lead.intake` | Yes | Clinic/hospital/partner referral · captures referralPartnerId |
| POST | `/v2/intake/api` | API key + `lead.intake.api` | Yes | Partner intake for future SaaS |

**Common request body (illustrative for `/v2/intake/web`):**
```json
{
  "personType": "DONOR",
  "donorSubtype": "SEMEN",
  "fullName": "…",
  "phone": "+91…",
  "email": "…",
  "dateOfBirth": "1996-04-12",
  "address": { "line1":"…", "city":"…", "state":"WB", "pincode":"700028" },
  "siteId": "…",
  "preferredLanguage": "ENGLISH",
  "source": "WEB_FORM",
  "campaignRef": "WB_OCT26_INSTA",
  "attribution": {
    "utm": { "utm_source":"instagram", "utm_medium":"paid_social", "utm_campaign":"wb_oct26" },
    "landingUrl": "https://lifeseed.in/donor/apply",
    "creativeRef": "insta_carousel_v3"
  },
  "consent": {
    "marketing": true,
    "screening": true,
    "dataProcessing": true,
    "version": "lead-v1.0"
  }
}
```

**Response 201:**
```json
{
  "leadId": "…",
  "leadCode": "LED-KOL-20260904-0007",
  "tier": "HOT",
  "message": "Lead created and assigned"
}
```

### 2.2 Leads

| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | `/v2/leads` | `lead.view.any` / `lead.view.own` / `lead.view.assigned_for_counselling` (scope enforced in query) | Cursor-paginated; filters (source, tier, status, outcome, isArchived, personType, siteId, campaignId, from, to, telecallerId) |
| GET | `/v2/leads/{id}` | Same as list, plus ownership check | Lead 360 payload |
| PATCH | `/v2/leads/{id}` | `lead.edit.limited` | Restricted mutable fields only (address, notes → discouraged, preferredLanguage) |
| GET | `/v2/leads/{id}/timeline` | Same as detail | Cursor-paginated activity log |
| GET | `/v2/leads/{id}/attribution` | Same as detail | First-touch + last-touch + history |
| GET | `/v2/leads/{id}/conversion` | Same as detail | Read side of LeadConversion |
| GET | `/v2/leads/export` | `lead.export` | CSV streaming with purpose capture |

### 2.3 Activities

| Method | Path | Perm |
|---|---|---|
| POST | `/v2/leads/{id}/activities` | `lead.disposition` (for CALL) OR `lead.note.add` (for NOTE) OR `lead.view.own` (for FOLLOW_UP creation) |
| POST | `/v2/leads/{id}/calls` | `lead.disposition` — specialised CallRecord create (also creates LeadActivity) |
| POST | `/v2/leads/{id}/notes` | `lead.note.add` — LeadActivity(NOTE) |

### 2.4 State transitions

| Method | Path | Perm | Notes |
|---|---|---|---|
| POST | `/v2/leads/{id}/transitions/{event}` | Event-specific perm (see `04_LEAD_STATE_WORKFLOW.md` §6) | Body: `{ reason, ... event-specific data }` |
| POST | `/v2/leads/{id}/archive` | `lead.archive` | Body: `{ reason }` |
| POST | `/v2/leads/{id}/unarchive` | `lead.unarchive` | Body: `{ reason }` |
| POST | `/v2/leads/{id}/reactivate` | `lead.reactivate` | Body: `{ reason }` — 90-day guard enforced |

### 2.5 Follow-up

| Method | Path | Perm |
|---|---|---|
| POST | `/v2/leads/{id}/follow-ups` | `follow_up.create` |
| PATCH | `/v2/follow-ups/{id}` | `follow_up.update.own` OR `follow_up.update.any` |
| POST | `/v2/follow-ups/{id}/complete` | `follow_up.complete.own` |
| POST | `/v2/follow-ups/{id}/cancel` | `follow_up.cancel.own` OR `.any` |
| POST | `/v2/follow-ups/{id}/reschedule` | `follow_up.reschedule` |
| GET | `/v2/follow-ups` | `follow_up.list` — filters (owner=me, status, dueBefore, dueAfter) |

### 2.6 Counselling

| Method | Path | Perm |
|---|---|---|
| POST | `/v2/leads/{id}/counselling/bookings` | `counselling.book` |
| GET | `/v2/counselling/bookings/{id}` | `counselling.view` |
| PATCH | `/v2/counselling/bookings/{id}/reschedule` | `counselling.reschedule` |
| PATCH | `/v2/counselling/bookings/{id}/cancel` | `counselling.cancel` |
| POST | `/v2/counselling/bookings/{id}/sessions` | `counselling.session.record` — create attended/no-show session record |
| POST | `/v2/counselling/sessions/{id}/outcome` | `counselling.outcome.record` |
| GET | `/v2/counselling/calendar` | `counselling.view` — `?counsellor=&from=&to=` |
| POST | `/v2/counselling/sessions/{id}/convert-recipient` | `lead.convert.recipient` |

### 2.7 Assignment

| Method | Path | Perm |
|---|---|---|
| POST | `/v2/leads/{id}/assign` | `lead.assign` |
| POST | `/v2/leads/{id}/reassign` | `lead.reassign` |
| POST | `/v2/leads/{id}/claim` | `lead.claim` |
| GET | `/v2/assignment/directory` | `lead.assign` — query telecaller availability |
| GET | `/v2/assignment/workload` | `lead.assign` |

### 2.8 DNC

| Method | Path | Perm |
|---|---|---|
| GET | `/v2/dnc` | `dnc.view` — `?channel=&value=` |
| POST | `/v2/dnc` | `dnc.add` |
| POST | `/v2/dnc/check` | `dnc.check` — bulk lookup (internal use by NotificationPort) |
| DELETE | `/v2/dnc/{id}` | `dnc.remove` — requires authority note |

### 2.9 Duplicates

| Method | Path | Perm |
|---|---|---|
| GET | `/v2/duplicates` | `duplicate.review` — filters (status, matchLevel) |
| GET | `/v2/duplicates/{id}` | `duplicate.review` — pair detail |
| POST | `/v2/duplicates/{id}/merge` | `lead.merge` — body: `{ winnerLeadId, reason, strategy }` |
| POST | `/v2/duplicates/{id}/keep-separate` | `duplicate.review` — body: `{ reason }` |
| POST | `/v2/duplicates/{id}/dismiss` | `duplicate.review` — body: `{ reason }` |

### 2.10 Conversion

| Method | Path | Perm |
|---|---|---|
| POST | `/v2/leads/{id}/convert/donor` | `lead.convert` (+ `lead.convert.donor` scoped) |
| POST | `/v2/leads/{id}/convert/recipient` | `lead.convert` (+ `lead.convert.recipient` scoped) |
| GET | `/v2/leads/{id}/convert/eligibility` | `lead.view.own` OR `lead.view.any` — read-only eligibility check |

### 2.11 Campaigns + Attribution

| Method | Path | Perm |
|---|---|---|
| GET | `/v2/campaigns` | `campaign.view` |
| POST | `/v2/campaigns` | `campaign.create` |
| GET | `/v2/campaigns/{id}` | `campaign.view` |
| PATCH | `/v2/campaigns/{id}` | `campaign.edit` |
| POST | `/v2/campaigns/{id}/activate` | `campaign.activate` |
| POST | `/v2/campaigns/{id}/end` | `campaign.end` |

### 2.12 Analytics

| Method | Path | Perm |
|---|---|---|
| GET | `/v2/analytics/funnel` | `analytics.view` — `?groupBy=source|campaign|tier&from=&to=` |
| GET | `/v2/analytics/cac` | `analytics.view` — `?scope=donor|recipient&from=&to=` |
| GET | `/v2/analytics/sla` | `analytics.view` — `?tier=&stage=&from=&to=` |
| GET | `/v2/analytics/telecaller` | `analytics.view` — `?user=&from=&to=` |
| GET | `/v2/analytics/cohort` | `analytics.view` — `?cohortMonth=&metric=` |

### 2.13 CRM

| Method | Path | Perm |
|---|---|---|
| GET | `/v2/crm/queue` | `crm.sync.monitor` |
| POST | `/v2/crm/queue/{id}/retry` | `crm.sync.retry` |
| POST | `/v2/crm/dlq/{id}/republish` | `crm.sync.retry` |
| POST | `/v2/crm/dlq/{id}/discard` | `crm.sync.retry` |
| GET | `/v2/crm/status/{externalId}` | `crm.sync.monitor` |

### 2.14 Configuration

| Method | Path | Perm |
|---|---|---|
| GET | `/v2/config/{key}` | `lead.config.view` |
| GET | `/v2/config/{key}/versions` | `lead.config.view` |
| POST | `/v2/config/{key}` | `lead.config.propose` |
| POST | `/v2/config/{key}/versions/{version}/approve` | `lead.config.approve` — **rejected if actor == author** (SoD) |
| POST | `/v2/config/{key}/versions/{version}/activate` | Auto on approval OR explicit action for effectiveFrom-based |

### 2.15 Audit

| Method | Path | Perm |
|---|---|---|
| GET | `/v2/audit` | `audit.view` — filters (leadId, actorUserId, action, from, to) |
| GET | `/v2/audit/export` | `audit.export` — CSV with purpose capture |
| GET | `/v2/audit/integrity` | `audit.integrity.verify` — hash-chain verification |

### 2.16 Notification (internal + management)

| Method | Path | Perm |
|---|---|---|
| GET | `/v2/notifications/templates` | `notification.template.view` |
| POST | `/v2/notifications/templates` | `notification.template.propose` |
| POST | `/v2/notifications/templates/{id}/approve` | `notification.template.approve` |
| GET | `/v2/notifications/delivery-log` | `notification.log.view` — filters (leadId, channel, status, from, to) |
| POST | `/v2/notifications/webhook/sms-magic` | HMAC-signed (SMS-Magic secret) | Delivery status webhook |
| POST | `/v2/notifications/webhook/meta` | Meta signature | WhatsApp delivery/read webhooks |
| POST | `/v2/notifications/webhook/resend` | Resend secret | Email delivery/bounce webhook |

### 2.17 Internal cron / workers (HMAC-signed, 5-min replay window)

| Method | Path | Purpose |
|---|---|---|
| POST | `/v2/internal/sla/tick` | SLA warn/breach tick |
| POST | `/v2/internal/follow-ups/tick` | Follow-up OPEN → DUE → OVERDUE |
| POST | `/v2/internal/lifecycle/tick` | Auto-transitions (interim → LOST) |
| POST | `/v2/internal/counselling/tick` | Counselling no-show cron + reminder dispatch |
| POST | `/v2/internal/retention/purge` | Retention expiry purge |
| POST | `/v2/internal/outbox/dispatch` | Outbox event dispatcher tick |
| POST | `/v2/internal/crm-sync/tick` | CRM sync consumer tick |

**Auth header (all internal):**
```
X-LifeSeed-Cron-Signature: t=<epoch>, v1=<HMAC-SHA256(t + "." + body, secret)>
```
Server rejects if `|now - t| > 300` seconds or signature invalid.

---

## 3 · Legacy v1 Compatibility Surface

**Retained during migration (no breaking removals):**

| v1 Endpoint | Status | Behaviour |
|---|---|---|
| `POST /api/leads/intake/web` | RETAINED | Wraps v2; adds default consent version if missing (no more silent 400) |
| `POST /api/leads/intake/whatsapp` | RETAINED | Real Meta signature enforced (v2 semantics adopted) |
| `POST /api/leads/intake/webhook/telecaller` | RETAINED | Wraps `/v2/intake/phone` |
| `POST /api/leads/sla/run` | RETAINED | Aliases to `/v2/internal/sla/tick`; supports both static X-Cron-Secret (deprecated) AND HMAC (preferred) — static removed in v2.1.x |
| `POST /api/leads/crm-sync/run` | RETAINED | Aliases to `/v2/internal/crm-sync/tick` |
| `POST /api/leads/purge-expired` | RETAINED | Aliases to `/v2/internal/retention/purge` |
| `GET /api/leads/export` | RETAINED | Aliases to `/v2/leads/export` |

Legacy admin server actions (in `src/app/(portals)/admin/leads/*` and `/telecaller/*`) rewritten to call **application services** (not Prisma) — behaviour preserved, IDOR fixed at repository layer.

---

## 4 · Authentication + Authorisation Model

### 4.1 Authentication

- **Browser session:** Supabase Auth SSR cookie-based (existing)
- **JWT bearer:** for SaaS clients (future) — signed with tenant-issued key
- **API key:** for partner intake endpoints — hashed at rest, prefixed for identification (`lsk_live_…`)
- **HMAC:** for internal cron / worker calls — rotating secret

### 4.2 Authorisation gates (every request)

```
┌──────────────────┐
│ 1 · Authenticate │  Identify actor (userId or systemId)
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 2 · Permission   │  Actor role has the required permission code?
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 3 · Site scope   │  Actor's siteId matches lead.siteId (or has cross-site perm)?
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 4 · Ownership    │  Actor is assigned owner OR has supervisor override?
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 5 · Field scope  │  Redact/mask sensitive fields per role (Prisma middleware)
└────────┬─────────┘
         ▼
      allow / audit
```

Denials always audit-log with `reason` and `requiredPermission`.

### 4.3 Permission codes (v2.1 canonical list)

- `lead.intake` · `lead.intake.api`
- `lead.view.any` · `lead.view.own` · `lead.view.assigned_for_counselling` · `lead.view.for_own_clinic`
- `lead.edit.limited`
- `lead.disposition`
- `lead.assign` · `lead.reassign` · `lead.claim`
- `lead.archive` · `lead.unarchive`
- `lead.reactivate`
- `lead.merge`
- `lead.convert` · `lead.convert.donor` · `lead.convert.recipient` · `lead.convert.approve`
- `lead.note.add`
- `lead.export`
- `lead.config.view` · `lead.config.propose` · `lead.config.approve`
- `follow_up.create` · `follow_up.update.own` · `follow_up.update.any` · `follow_up.complete.own` · `follow_up.cancel.own` · `follow_up.cancel.any` · `follow_up.reschedule` · `follow_up.list`
- `counselling.book` · `counselling.view` · `counselling.reschedule` · `counselling.cancel` · `counselling.session.record` · `counselling.outcome.record`
- `dnc.view` · `dnc.check` · `dnc.add` · `dnc.remove`
- `duplicate.review`
- `campaign.view` · `campaign.create` · `campaign.edit` · `campaign.activate` · `campaign.end`
- `analytics.view`
- `crm.sync.monitor` · `crm.sync.retry` · `crm.config.set`
- `notification.template.view` · `notification.template.propose` · `notification.template.approve` · `notification.log.view`
- `audit.view` · `audit.export` · `audit.integrity.verify`
- `assignment.override` · `qa.sample`

### 4.4 Role → Permission Matrix (default)

| Permission | TELECALLER | SR_TELECALLER | COUNSELLOR | OPS_MANAGER | MARKETING_MGR | CRM_ADMIN | BANK_MED_DIR | BANK_SUPER_ADMIN |
|---|---|---|---|---|---|---|---|---|
| lead.intake | – | – | – | ✓ | – | – | – | ✓ |
| lead.intake.api | – | – | – | – | – | – | – | ✓ |
| lead.view.any | – | – | – | ✓ (site-scoped) | ✓ | – | – | ✓ |
| lead.view.own | ✓ | ✓ | – | – | – | – | – | ✓ |
| lead.view.assigned_for_counselling | – | – | ✓ | – | – | – | – | ✓ |
| lead.view.for_own_clinic | – | – | – | – | – | – | – | ✓ |
| lead.edit.limited | ✓ (own) | ✓ (own) | ✓ (own counselling) | ✓ | – | – | – | ✓ |
| lead.disposition | ✓ (own) | ✓ (own) | – | ✓ (any) | – | – | – | ✓ |
| lead.assign | – | – | – | ✓ | – | – | – | ✓ |
| lead.reassign | – | ✓ (own pool) | – | ✓ | – | – | – | ✓ |
| lead.claim | ✓ | ✓ | – | ✓ | – | – | – | ✓ |
| lead.archive | – | – | – | ✓ | – | – | – | ✓ |
| lead.unarchive | – | – | – | ✓ | – | – | – | ✓ |
| lead.reactivate | – | ✓ (own pool ≤ 90d) | – | ✓ | – | – | – | ✓ |
| lead.merge | – | – | – | ✓ | – | – | – | ✓ |
| lead.convert (donor) | ✓ (with supervisor confirmation) | ✓ | – | ✓ | – | – | – | ✓ |
| lead.convert (recipient) | ✓ (post-counselling only) | ✓ | ✓ | ✓ | – | – | – | ✓ |
| lead.convert.approve | – | – | – | ✓ | – | – | – | ✓ |
| lead.note.add | ✓ (own) | ✓ (own) | ✓ (own counselling) | ✓ | – | – | – | ✓ |
| lead.export | – | – | – | ✓ | ✓ | – | – | ✓ |
| lead.config.view | – | – | – | ✓ | ✓ | ✓ | ✓ | ✓ |
| lead.config.propose | – | – | – | ✓ (SLA/assignment) | ✓ (score/campaign) | – | – | ✓ |
| lead.config.approve | – | – | – | ✓ (SLA/assignment) | ✓ (score/campaign) | – | – | ✓ |
| follow_up.* (own) | ✓ | ✓ | ✓ | ✓ | – | – | – | ✓ |
| follow_up.* (any) | – | – | – | ✓ | – | – | – | ✓ |
| counselling.book | ✓ (own leads) | ✓ | – | ✓ | – | – | – | ✓ |
| counselling.reschedule | ✓ | ✓ | ✓ | ✓ | – | – | – | ✓ |
| counselling.cancel | ✓ | ✓ | ✓ | ✓ | – | – | – | ✓ |
| counselling.session.record | – | – | ✓ | ✓ (override) | – | – | – | ✓ |
| counselling.outcome.record | – | – | ✓ | ✓ (override) | – | – | – | ✓ |
| dnc.view | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | ✓ |
| dnc.check | ✓ (system) | ✓ (system) | ✓ (system) | ✓ (system) | – | – | – | ✓ |
| dnc.add | ✓ (via disposition) | ✓ | ✓ | ✓ | – | – | – | ✓ |
| dnc.remove | – | – | – | ✓ | – | – | – | ✓ |
| duplicate.review | – | – | – | ✓ | – | – | – | ✓ |
| campaign.* | – | – | – | – | ✓ | – | – | ✓ |
| analytics.view | – | – | – | ✓ | ✓ | – | ✓ | ✓ |
| crm.sync.* | – | – | – | – | – | ✓ | – | ✓ |
| notification.template.propose | – | – | – | – | ✓ | – | – | ✓ |
| notification.template.approve | – | – | – | – | ✓ | – | – | ✓ |
| notification.log.view | – | – | – | ✓ | ✓ | – | – | ✓ |
| audit.view | – | – | – | ✓ | ✓ | ✓ | ✓ | ✓ |
| audit.export | – | – | – | – | – | – | – | ✓ |
| audit.integrity.verify | – | – | – | – | – | – | – | ✓ |
| assignment.override | – | – | – | ✓ | – | – | – | ✓ |
| qa.sample | – | – | – | ✓ | – | – | – | ✓ |

**Convention:** ✓ = granted · – = denied. Site/ownership/scope narrowing applied on top.

---

## 5 · IDOR Prevention (P0)

- **Repository-level enforcement:** `LeadRepository.byId(id, ctx)` receives caller context and refuses to return a lead the actor cannot see. No server action / page ever calls Prisma directly for leads.
- **Query-time predicate:** for list endpoints, the repository injects `WHERE (site + ownership) IN (actor's scope)` before executing — the DB never returns rows the actor can't see.
- **Denied access audited:** every denial writes `AuditLog(action='lead.access.denied', actor, targetLeadId, requiredPermission, reason)`
- **Test matrix:** every role × every scope tested for expected allow/deny (`P10` coverage)

---

## 6 · Idempotency

- Every POST/PATCH requires `Idempotency-Key: <uuid>` header
- Server stores hash of `(actorId, endpoint, body)` for 24h keyed by idempotency key
- Retries with same key return cached response
- Different body with same key → 409 IDEMPOTENCY_KEY_CONFLICT

---

## 7 · Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `AUTHENTICATION_REQUIRED` | 401 | No/invalid credentials |
| `PERMISSION_DENIED` | 403 | Perm check failed |
| `SITE_SCOPE_VIOLATION` | 403 | Cross-site access blocked |
| `OWNERSHIP_DENIED` | 403 | Not the owner (IDOR) |
| `NOT_FOUND` | 404 | Entity missing |
| `VALIDATION_FAILED` | 400 | Zod schema failure |
| `CONSENT_MISSING` | 400 | Required consent fields absent |
| `DNC_BLOCKED` | 409 | Send/action blocked by DNC |
| `STATE_TRANSITION_NOT_ALLOWED` | 409 | Invalid event for current state |
| `GUARD_FAILED` | 409 | Domain guard evaluation failed (details include guard name) |
| `DUPLICATE_CONVERSION` | 409 | LeadConversion already exists |
| `MERGE_ALREADY_EXISTS` | 409 | LeadMerge already recorded for loser |
| `REACTIVATION_WINDOW_EXPIRED` | 409 | > 90 days since lostAt |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | Same key, different body |
| `CONFIG_SOD_VIOLATION` | 409 | Author cannot approve own config version |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `HMAC_INVALID` | 401 | Cron/webhook signature invalid |
| `HMAC_REPLAY` | 401 | Timestamp outside 5-min window |
| `SERVER_ERROR` | 500 | Unhandled |
| `SERVICE_UNAVAILABLE` | 503 | Downstream (e.g. Supabase) down |

Response envelope:
```json
{
  "error": {
    "code": "STATE_TRANSITION_NOT_ALLOWED",
    "message": "Lead is in COUNSELLING_BOOKED; cannot apply event convert_donor",
    "details": [
      { "field": "event", "issue": "not allowed from current state" }
    ],
    "requestId": "req_abc123",
    "documentation": "https://docs.lifeseed.in/errors/STATE_TRANSITION_NOT_ALLOWED"
  }
}
```

---

## 8 · Rate Limits

| Endpoint category | Default limit |
|---|---|
| Public web intake | 10 requests / IP / hour |
| Public WhatsApp intake | 30 / IP / hour (post-signature-verify) |
| Authenticated GETs | 300 / user / min |
| Authenticated POSTs | 60 / user / min |
| Export endpoints | 5 / user / hour |
| CRM retry endpoints | 20 / user / min |
| Config approve | 10 / user / hour |
| Internal cron | Unlimited (HMAC-protected) |

Configurable via `RATE_LIMIT_POLICY_V1` in `LeadConfig`.

---

## 9 · Audit Coverage

Every audit row: `id, hashPrev, hashCurr, actorUserId, actorRole, action, targetType, targetId, requestId, requestBodyHash, responseStatus, occurredAt, siteId, clientIp, userAgent, denialReason (if denied)`.

Must-audit actions:
- Every state transition (via T-01..T-31)
- Every access (view/download/export) of Lead 360 or PII-bearing endpoints
- Every DNC add/remove
- Every merge / conversion / reactivation
- Every config version propose / approve / activate
- Every notification template propose / approve
- Every failed auth or permission check
- Every idempotency key conflict
- Every CRM sync retry / DLQ resolution
- Every internal cron invocation

---

**Document owner:** Engineering
**Next review:** upon completion of Batch C1 · full OpenAPI spec exported to `/api/leads/v2/openapi.json`

---

## 10 · Change Log

| Date | Ref | Change |
|---|---|---|
| 2026-09-12 | LADR-24 | Added canonical `lead.convert.approve` to §4.3. §4.4 grants it **only** to `OPS_MANAGER` and `BANK_SUPER_ADMIN`. Distinct from `lead.convert` / `.donor` / `.recipient` (initiate). |
| 2026-09-12 | LADR-25 | Removed `lead.view.any` from `BANK_MED_DIR`. Medical director remains config/analytics/audit viewer only — **no** case-level Lead read/list. |
