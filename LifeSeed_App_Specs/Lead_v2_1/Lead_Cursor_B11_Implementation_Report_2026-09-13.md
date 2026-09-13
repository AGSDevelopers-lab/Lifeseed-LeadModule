# B11 Implementation Evidence Report

**Date:** 2026-09-13  
**Authorization:** B11 Cursor Execution Authorization v1.0 — ALL PHASES AUTHORIZED (exception-based STOP gates)  
**Starting HEAD:** `96fe3a7`  
**Branch:** `main`  
**Push:** not performed (not authorized)

## Phase 0 preflight (evidence)

| # | Finding |
|---|---|
| HEAD / branch | `96fe3a7` on `main` |
| Working tree at start | Untracked only (preserved): `08_LEAD_MASTER_REENGINEERING.md`, `CURSOR_VERIFICATION_REPORT_2026-09-10.md`, `Lead_Cursor_B11_Design_Lock_Report_2026-09-13.md`, `layering-isolation.test.ts`, `src/lib/leads/testing/negative/` |
| `CounsellingBooking.leadId @unique` | **Present** at preflight |
| Dual `status` + `bookingStatus` | **Present.** Authoritative B11 lifecycle = `bookingStatus` (SCHEDULED/RESCHEDULED/CANCELLED/CLOSED). Legacy `status` retained. |
| `rescheduledFromBookingId` | Self-FK `BookingReschedule` already on schema |
| Session / Outcome | Present; Outcome `sessionId` UNIQUE |
| Application | `counselling.ts` re-exported book/record from commands; store **upserted by leadId** |
| HTTP | Only HMAC `POST /v2/internal/counselling/tick` |
| UI | Telecaller book form + counsellor dashboard/sessions (Prisma in pages) |
| Tick | T-21 exhausted no-show → LOST via SM `forcePersist`; HMAC preserved |
| RBAC | `counselling.view` absent; TELECALLER/SR had `.book` only |
| UserRole | Includes `SR_TELECALLER` |
| SM | T-15–T-23 in `transitions.ts`; ConversionPort present |
| Flags | `feature-flag.ts`; no history flag |
| Migrations | 20 applied, **up to date**, none pending |
| Data | 3 bookings, all `SCHEDULED`, **0** leads with >1 booking, **0** SCHEDULED duplicates |

No §24 STOP from preflight. Dual status fields classified as existing architecture (not ambiguous authority: `bookingStatus` is B11 lifecycle).

## Schema / migration

**IMPLEMENTED (files):** drop whole-table unique on `CounsellingBooking.leadId`; Lead relation `counsellingBookings[]`; index `(leadId, createdAt)`; migration `prisma/migrations/20260913120000_b11_counselling_booking_multi/migration.sql` drops `CounsellingBooking_leadId_key` and creates partial unique `CounsellingBooking_one_scheduled_per_lead` WHERE `bookingStatus = 'SCHEDULED'`.

**NOT VERIFIED:** `prisma migrate deploy` was blocked in this environment after generate succeeded. **Do not treat the database as migrated until Founder (or Cursor with approval) runs `npx prisma migrate deploy`.** Prisma Client **was** regenerated locally.

**Enforcement:** application pre-insert reject of a second SCHEDULED row **plus** DB partial unique (P2002 mapped to `LEAD_INVARIANT_VIOLATION`). Transaction = existing `persistBundle` interactive tx. Race: unique violation → invariant error. Application-only was judged insufficient under concurrency; DB-only would miss a clear domain error before insert — **both layers**.

**Rollback of uniqueness:** restore unique index only if at most one row per lead (would fail after real reschedules).

## Domain / API / RBAC / flag / tick / UI

| Area | Status |
|---|---|
| Reschedule new row + predecessor RESCHEDULED + immediate `rescheduledFromBookingId` | IMPLEMENTED (store `lastRescheduledBookingId` in same persist bundle) |
| Distinct HTTP reschedule vs cancel | IMPLEMENTED (`05` §2.6 paths) |
| Internal T-19 share | IMPLEMENTED (`session_cancelled` + `cancelMode`) |
| Canonical perms; no `counselling.session.cancel` | IMPLEMENTED |
| History flag default ON, UI-only | IMPLEMENTED `isLeadCounsellingHistoryEnabled` |
| Session append-only / outcome create-once | IMPLEMENTED (P2002 → invariant) |
| Lead status via SM `persistBundle` (`forcePersist` on counselling commands) | IMPLEMENTED; legacy book upsert + `applyAuthorizedLeadStatus` for counselling **removed** |
| Convert-recipient on session | IMPLEMENTED → existing ConversionPort HTTP |
| Tick T-18 grace 15min + reminders via NotificationPort stubs + T-21 retained | IMPLEMENTED |
| Outbox names CounsellingBooked/Attended/NoShow | Existing T-15/17/18; reschedule **no** extra outbox (04 cancel-only) |
| Counsellor calendar + history links | IMPLEMENTED; flag off hides calendar and restores legacy dashboard copy |
| Idempotency-Key 24h store | **NOT IMPLEMENTED** (no existing store in repo; B10 APIs also omit it) |
| Browser E2E | **NOT VERIFIED** (no interactive browser pass) |
| Concurrent DB race against live unique index | **NOT VERIFIED** until migration is deployed |
| STOP-4 / B12 / production SM flags | **OUT OF SCOPE** |

## Tests executed (VERIFIED)

`npx vitest run` on 10 files: **112 passed**.

Includes B11 application/RBAC/flag, HTTP permission names, HMAC tick route, T-21 + T-18 tick helper, T-19 write shape, access-scope 1:N, IDOR repo, permission matrix, mappers.

## Files preserved (not in B11 commit)

Untracked pre-existing files listed in Phase 0 — **not** absorbed.

## Known limitations

1. Migration SQL is in-repo; **database apply pending** environment approval.  
2. Idempotency-Key persistence not added (would be new architecture).  
3. Reminder uses single `reminderSentAt` column.  
4. T-18 grace = 15 minutes (implementation detail).  
5. Counsellor list/calendar still uses adapter Prisma (not client-side dual model).  
6. Generic `POST .../transitions/session_cancelled` still maps permission `counselling.cancel`; B11 counselling APIs are the locked external surface.

## §24 exceptions

None that stopped implementation. Migration **deploy** could not be executed here (tool auto-review). That is an environment gate, not a design conflict.

## Commit / push

See git after Phase 7 commit. Push: **not done**.
