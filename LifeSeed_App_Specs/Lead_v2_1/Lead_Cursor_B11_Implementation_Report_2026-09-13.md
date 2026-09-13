# B11 Implementation Evidence Report — Closure Pass

**Date:** 2026-09-13  
**Pass:** Targeted evidence closure (this document supersedes the earlier same-day implementation report for evidence classification).  
**This pass did not run `npx prisma migrate deploy`.**

---

### A. Execution Identity

| Field | Evidence |
|---|---|
| Branch | `main` |
| Starting HEAD (authorization / implementation start) | `96fe3a72efc8ce0ea2f9bc0b325e751c40d7d627` |
| B11 implementation commit | `3e13d3813e96790465941525cf7afd68519969e8` |
| Commit message | `feat(lead-v2.1): B11 counselling triad with multi-booking history` |
| Ending HEAD (this evidence-closure commit) | `a17f3088e3b45fdb8256278a22721f2be5abb860` |
| Push | **not performed** |
| Ancestry (newest first) | `3e13d38` B11 · `96fe3a7` drop SUPER_ADMIN alias · `0c05713` P0-2 RBAC · `f34d244` SR_TELECALLER · `acea623` 05 LADR-24/25 · `8694158` T-21/T-30 · `96a686c` P0-1 · `6b3e0b8` BATCH 0 baseline · `6e1bc56` P0-1 list · `2d2b431` Phase-0 PARTIAL docs · `0ebbe5d` B10 |

`git status` at evidence-closure start (after `3e13d38`, before this pass’s commit): clean tracked tree; untracked preserved: `08_LEAD_MASTER_REENGINEERING.md`, `CURSOR_VERIFICATION_REPORT_2026-09-10.md`, `Lead_Cursor_B11_Design_Lock_Report_2026-09-13.md`, `layering-isolation.test.ts`, `src/lib/leads/testing/negative/`.

---

### B. Database / Environment Evidence

**How 112 tests passed while uniqueness was in question**

The original **112 tests did not connect to Postgres.** They are Vitest unit tests with `vi.mock` (or pure domain/flag/RBAC in-process). They never opened `DATABASE_URL`, never applied a migration, and never inserted `CounsellingBooking` rows. They therefore could not fail on `CounsellingBooking.leadId @unique`.

Evidence:

| File | DB? |
|---|---|
| `counselling.b11.test.ts` | mocks `applyLeadEvent` |
| `counselling-http.route.test.ts` | mocks RBAC, counselling application, prisma-counselling |
| `auto-transitions.test.ts` | mocks `@/lib/db` as `{}` |
| `auto-transition-routes.test.ts` | mocks tick functions + HMAC |
| `permission-matrix.regression.test.ts` | in-memory `ROLE_PERMISSIONS` |
| `lead-access-scope.list.test.ts` | pure function |
| `prisma-lead-repository.idor.test.ts` | fake `LeadReadDb` |
| `transitions.test.ts` | domain SM, no Prisma |
| `feature-flag.test.ts` | env only |
| `round-trip.test.ts` | mapper in-memory |

**Test database type (112 tests):** none / in-process mocks. **Not** a separate migrated test database.

**Concurrency test (this pass):** real Prisma against the **same hosted pooled Postgres** the app `.env` points at (Prisma reports database name `postgres`, schema `public`; **credentials not printed**). That database **already had** `20260913120000_b11_counselling_booking_multi` applied **before this evidence-closure pass** (prior delegated session). This pass **did not** run `migrate deploy`. The concurrency test asserted indexes `CounsellingBooking_one_scheduled_per_lead` present and `CounsellingBooking_leadId_key` absent, then ran two parallel `persistBundle` booking writes.

---

### C. Schema / Migration

| Item | Status |
|---|---|
| Remove whole-table `CounsellingBooking.leadId @unique` | IMPLEMENTED in `prisma/schema.prisma` + migration SQL |
| `rescheduledFromBookingId` self-FK | IMPLEMENTED (pre-existing B01 column; B11 store sets immediate predecessor in-bundle) |
| One-SCHEDULED invariant | IMPLEMENTED: persistBundle pre-insert check + partial unique index + P2002 → `LEAD_INVARIANT_VIOLATION` |
| Partial unique | `CREATE UNIQUE INDEX "CounsellingBooking_one_scheduled_per_lead" ON "CounsellingBooking" ("leadId") WHERE "bookingStatus" = 'SCHEDULED'` |
| Migration file | `prisma/migrations/20260913120000_b11_counselling_booking_multi/migration.sql` |
| A. Migration exists | yes |
| B. Contents | DROP `CounsellingBooking_leadId_key`; CREATE `(leadId, createdAt)` index; CREATE partial unique |
| C. “Test database” for the 112 tests | N/A (no DB) |
| C2. Concurrency-test database | **applied** (index assertions + `migrate status` up to date) |
| D. Hosted dev | **already applied** as of this pass (`migrate status`: 21 migrations, up to date). **This pass did not deploy.** |
| E. Founder action remaining | Do **not** re-run deploy unless status regresses. Remaining Founder actions: **push** (separate), optional browser E2E |

Dual columns `status` (legacy) and `bookingStatus` (B11 lifecycle) remain. Authoritative B11 lifecycle is `bookingStatus`.

---

### D. Domain / Application

| Behavior | Classification |
|---|---|
| Multiple bookings per Lead | IMPLEMENTED + VERIFIED (concurrency test created SCHEDULED + RESCHEDULED on same lead) |
| Reschedule chain / immediate predecessor | IMPLEMENTED (store `lastRescheduledBookingId`); unit T-19 write shape VERIFIED; live chain HTTP **NOT VERIFIED** in browser |
| Cancel distinct from reschedule | IMPLEMENTED (`cancelMode` full vs reschedule + distinct permissions) |
| Sessions append-only | IMPLEMENTED (create-only in store) |
| Outcomes unique/immutable | IMPLEMENTED (P2002 → invariant) |
| Lead SM only for counselling Lead.status | IMPLEMENTED (`persistBundle` / `applyLeadEvent` `forcePersist`; legacy counselling upsert/`applyAuthorizedLeadStatus` removed from book/mark) |

---

### E. API

Canonical `05` §2.6 under `/api/leads/v2/...`:

| Endpoint | Classification |
|---|---|
| POST `/leads/{id}/counselling/bookings` | IMPLEMENTED + VERIFIED (HTTP unit: `counselling.book`) |
| GET `/counselling/bookings/{id}` | IMPLEMENTED + VERIFIED (HTTP unit: `counselling.view`) |
| PATCH `/counselling/bookings/{id}/reschedule` | IMPLEMENTED + VERIFIED (HTTP unit: `counselling.reschedule`) |
| PATCH `/counselling/bookings/{id}/cancel` | IMPLEMENTED + VERIFIED (HTTP unit: `counselling.cancel`) |
| POST `/counselling/bookings/{id}/sessions` | IMPLEMENTED + NOT VERIFIED (route exists; no dedicated HTTP unit in this suite) |
| POST `/counselling/sessions/{id}/outcome` | IMPLEMENTED + NOT VERIFIED (route exists; application unit mocks SM) |
| GET `/counselling/calendar` | IMPLEMENTED + NOT VERIFIED (no HTTP unit) |
| POST `/counselling/sessions/{id}/convert-recipient` | IMPLEMENTED + NOT VERIFIED (delegates ConversionPort HTTP) |
| POST `/internal/counselling/tick` | IMPLEMENTED + VERIFIED (HMAC route unit) |
| Idempotency-Key 24h store | NOT IMPLEMENTED |

---

### F. RBAC

Canonical names only. No `counselling.session.cancel`. No new roles.

| Permission | TELECALLER | SR_TELECALLER | COUNSELLOR | OPS_MANAGER | BANK_SUPER_ADMIN | MARKETING_MANAGER / CRM_ADMIN / BANK_MEDICAL_DIRECTOR |
|---|---|---|---|---|---|---|
| counselling.book | yes | yes | no | yes | yes | no |
| counselling.view | yes | yes | yes | yes | yes | no |
| counselling.reschedule | yes | yes | yes | yes | yes | no |
| counselling.session.record | no | no | yes | yes | yes | no |
| counselling.outcome.record | no | no | yes | yes | yes | no |
| counselling.cancel | yes | yes | yes | yes | yes | no |

VERIFIED by `counselling.b11.test.ts` RBAC cases + `ROLE_PERMISSIONS` source.

---

### G. Tick / Events / Notifications

| Item | Classification |
|---|---|
| HMAC tick preserved | IMPLEMENTED + VERIFIED (`auto-transition-routes.test.ts`) |
| T-18 overdue SCHEDULED → `session_no_show` via SM | IMPLEMENTED + VERIFIED (mocked `applyLeadEvent` in `auto-transitions.test.ts`; **not** live cron) |
| T-21 exhausted no-show → LOST | IMPLEMENTED + VERIFIED (same) |
| Reminders via NotificationPort stubs | IMPLEMENTED + NOT VERIFIED live |
| Outbox CounsellingBooked / Attended / NoShow | IMPLEMENTED in SM transitions; reschedule has **no** extra outbox (04) |
| B12 live adapters | OUT OF SCOPE |

---

### H. UI / History / Calendar

| Item | Classification |
|---|---|
| `LEAD_COUNSELLING_HISTORY_ENABLED` default ON | IMPLEMENTED + VERIFIED (flag unit) |
| Flag OFF hides calendar / legacy copy | IMPLEMENTED + NOT VERIFIED in browser |
| Calendar page `/counsellor/calendar` | IMPLEMENTED + NOT VERIFIED in browser |
| Writes not gated by UI flag | IMPLEMENTED (APIs/SM ignore the flag) |
| Browser E2E | NOT VERIFIED |

---

### I. Testing

**Commands**

```
npx vitest run src/lib/leads/application/counselling.b11.test.ts src/lib/leads/application/counselling-http.route.test.ts src/lib/leads/application/auto-transitions.test.ts src/lib/leads/application/auto-transition-routes.test.ts src/lib/leads/adapters/permission-matrix.regression.test.ts src/lib/leads/adapters/lead-access-scope.list.test.ts src/lib/leads/adapters/prisma-lead-repository.idor.test.ts src/lib/leads/domain/state-machine/transitions.test.ts src/lib/leads/application/feature-flag.test.ts src/lib/leads/adapters/mappers/round-trip.test.ts src/lib/leads/adapters/counselling-booking.concurrency.test.ts
```

**Result (this pass):** 11 files, **113 passed**, **0 failed**.

| Slice | Count / notes |
|---|---|
| Total | 113 |
| Passed | 113 |
| Failed | 0 |
| Original 112 | mocks/domain; **no Postgres** |
| Concurrency | 1 passed: two parallel `persistBundle` booking writes; 1 fulfilled / 1 rejected; final SCHEDULED count = 1; additional RESCHEDULED row allowed (proves whole-table unique is gone) |
| RBAC | counselling.b11 RBAC + permission-matrix |
| API HTTP unit | 4 (book/get/reschedule/cancel) |
| Migration/schema | concurrency test asserts partial unique present, `leadId_key` absent |
| State machine | transitions.test.ts 43 |
| Security/IDOR | prisma-lead-repository.idor.test.ts 5; HMAC tick 4 |

---

### J. Required Authorization Checklist

| Authorization requirement | Classification |
|---|---|
| Read-only preflight before original writes | IMPLEMENTED + VERIFIED (prior execution) |
| Multiple bookings; no whole-table leadId unique | IMPLEMENTED + VERIFIED (schema + concurrency historical row) |
| Reschedule new row; predecessor RESCHEDULED; immediate predecessor FK | IMPLEMENTED + NOT VERIFIED (live HTTP chain) |
| At most one SCHEDULED; transactional under concurrency | IMPLEMENTED + VERIFIED (concurrency test) |
| Document enforcement: app pre-check + partial unique + P2002 | IMPLEMENTED + VERIFIED |
| B11-only unique drop; Prisma-managed migration; no history rewrite | IMPLEMENTED + VERIFIED (file); hosted apply was **prior session**, not this pass |
| Distinct reschedule/cancel APIs and permissions | IMPLEMENTED + VERIFIED |
| No `counselling.session.cancel` permission | IMPLEMENTED + VERIFIED |
| counselling.view + TELECALLER/SR reschedule/cancel; no new roles; no Lead perm broaden | IMPLEMENTED + VERIFIED |
| History flag default ON; UI only; no dual-write; no bypass SM/RBAC/HMAC | IMPLEMENTED + VERIFIED (flag unit + write path) |
| Session append-only | IMPLEMENTED + NOT VERIFIED (live append) |
| Outcome unique/immutable; no correction workflow | IMPLEMENTED + NOT VERIFIED (live duplicate POST) |
| Lead lifecycle only via SM; ConversionPort for convert-recipient | IMPLEMENTED + NOT VERIFIED (live convert) |
| 05 §2.6 endpoints | IMPLEMENTED; HTTP units partial (see E) |
| Idempotency-Key existing architecture | NOT IMPLEMENTED (no store in repo; B10 also omits) |
| HMAC tick; T-18 + reminders stubs; keep T-21 | IMPLEMENTED + VERIFIED (units) |
| Outbox event types; no B12 | IMPLEMENTED / OUT OF SCOPE |
| B10 Activity/FollowUp only as locked | IMPLEMENTED (T-23 follow_up write remains SM) |
| Counsellor workspace/calendar + flag | IMPLEMENTED + NOT VERIFIED (browser) |
| Tests: booking/reschedule/cancel/invariant/concurrency/session/outcome/RBAC/API/SM/tick/UI flag | IMPLEMENTED + VERIFIED except UI browser and some HTTP verbs |
| No B12–B18, STOP-4, E-CONVERSION, production flag cutover | OUT OF SCOPE (not touched) |
| Preserve unrelated untracked files | VERIFIED |
| No push unless separately authorized | VERIFIED (not pushed) |
| This pass: no hosted `migrate deploy` | VERIFIED (not run) |

---

### K. Known Limitations

- Idempotency-Key 24h store: **NOT IMPLEMENTED / EXISTING ARCHITECTURAL GAP** (Lead counselling and B10 follow-up HTTP). Billing gateway has unrelated payment idempotency.
- Browser E2E of counsellor calendar / flag rollback: **NOT VERIFIED**.
- Session/outcome/calendar/convert HTTP: implemented, **limited unit coverage**.
- Hosted migration was applied in a **previous** delegated session; this closure pass only inspected status and used that DB for concurrency. Do not treat this pass as the deploy action.
- Reminder uses single `reminderSentAt`; T-18 grace is 15 minutes.
- Generic `transitions/session_cancelled` still maps `counselling.cancel`; locked external surface is 05 §2.6.

---

### L. Final Status

**AMBER — IMPLEMENTED BUT MATERIAL EVIDENCE REMAINS**

Material remaining evidence is **browser E2E** (and optional live HTTP for session/outcome/calendar). Concurrency of one-SCHEDULED is now **VERIFIED**. The 112-test vs uniqueness question is **resolved**: those tests never used the database. Hosted schema for the concurrency run **is** the B11-migrated schema. No push. No material exception requiring a new architecture decision.
