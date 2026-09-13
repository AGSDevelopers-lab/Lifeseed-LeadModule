# B13 Evidence Report — Staged / Fallback Assignment Upgrade

**Date:** 2026-09-13  
**Status:** CLOSED (implementation complete; production flag remains OFF)

---

## A. Executive summary

B13 ships a fallback `AssignmentDirectory` using only existing `User.siteId`, `User.isActive`, TELECALLER/SR_TELECALLER roles, and `countAssignedOpenLeads`. Site matching and `assignment.override` are enforced at the application boundary. Capacity continues to use `maxQueuePerTelecaller` / `openStatuses`. `assigneeAvailable` is computed from the directory (not hardcoded). `LEAD_ASSIGNMENT_V2_ENABLED` defaults OFF and preserves the legacy round-robin path. ASSIGNMENT_RULES_V1 gained site/override/rotation fields through the existing LeadConfig SoD schema. SR_TELECALLER reassignment is constrained to the existing **User.siteId** pool. No Prisma migration, no new User fields, no IAM Module 12, no B11/B12 edits.

---

## B. Starting HEAD / branch

- **Branch:** `main`
- **Starting HEAD:** `1ebe10ce19c2dfab12bfe6966b7a9dd3132c133a`

---

## C. Implementation commit SHA(s)

See section D (filled after git commit).

---

## D. Ending HEAD / branch

See git commit output in this session; branch remains `main` (no push).

---

## E. Files changed

B13 commit: assignment adapter, policy, eligibility, commands, lead-assignment v2 branch, APIs, Assignment Centre UI, tests, evidence report, flag, ASSIGNMENT_RULES_V1 schema/defaults, `.env.example`.

---

## F. AssignmentDirectory fallback evidence

Port unchanged: `listAvailableTelecallers(siteId?)`.

Returned fields per row:

| Field | Source | Notes |
| --- | --- | --- |
| `userId` | `User.id` | Existing |
| `siteId` | `User.siteId` | Existing |
| `openLeadCount` | `countAssignedOpenLeads` | Existing |
| `languages` | always `[]` | **Not fabricated** |
| `skills` | always `[]` | **Not fabricated** |

Evidence: `src/lib/leads/adapters/prisma-assignment-directory.ts`, `prisma-assignment-directory.test.ts`, `b13-assignment.api.test.ts`.

---

## G. Site-matching evidence

`siteMatchesCandidate` requires `candidate.siteId === lead.ownership.siteId` when `siteMatchingPolicy=require_match` and override is false. Tests in `assignment-policy.test.ts` and `b13-assignment.test.ts` (`blocks cross-site assign without assignment.override`).

---

## H. Cross-site override evidence

Actors with existing `assignment.override` (OPS_MANAGER, BANK_SUPER_ADMIN) pass `siteMatchesCandidate(..., override=true)`. Test: `permits cross-site assign with assignment.override`. Enforced in `assertExplicitAssigneeAllowed` (not UI-only).

---

## I. Capacity evidence (no regression)

Eligible set requires `openLeadCount < maxQueuePerTelecaller`. Legacy `lead-assignment.ts` capacity loop is unchanged when the v2 flag is OFF. V2 uses the same `loadAssignmentRules()` / `openStatuses` / `countAssignedOpenLeads`.

---

## J. Genuine assigneeAvailable computation evidence

`src/lib/leads/application/commands.ts` `assignLeadToUser` / `reassignLeadToUser` call `computeGenuineAssigneeAvailable` (directory + site + capacity). Comment in code: temporary fallback pending IAM Module 12.

Hardcoded `facts: { assigneeAvailable: true }` **removed** from commands (source assertion in `b13-assignment.test.ts`). Guard functions in `guards.ts` are unchanged; only facts changed.

Empty directory → `assigneeAvailable: false` (tested).

---

## K. SR_TELECALLER own-pool enforcement + negative tests

**Existing repository concept used:** `User.siteId` (same site as the SR_TELECALLER actor). No new team/reporting model.

- Negative: SR_TELECALLER → target at another site → `LeadOwnershipDeniedError` (`assignment-policy.test.ts`, `b13-assignment.test.ts`).
- OPS_MANAGER / BANK_SUPER_ADMIN unrestricted (tested).
- Permission remains canonical `lead.reassign` (HTTP EVENT_PERM + `actorHasPerm` no longer alias reassign → assign, so SR can exercise the existing permission).

---

## L. GET /v2/assignment/directory evidence

`src/app/api/leads/v2/assignment/directory/route.ts` — `requirePermission("lead.list")`, backed by `PrismaAssignmentDirectory`. Test: empty languages/skills; 401 without session.

---

## M. GET /v2/assignment/workload evidence

`src/app/api/leads/v2/assignment/workload/route.ts` — same adapter + `maxQueuePerTelecaller` and per-site aggregates. Tested.

---

## N. Assignment Centre UI evidence

Route: `src/app/(portals)/admin/leads/assignment/page.tsx` + client table: site, active eligibility, open leads, capacity. Copy states shift/skill/language are not matched. Link from admin leads index.

**Browser E2E:** not executed in this session (portal login required). Structure verified by code + API tests.

---

## O. ASSIGNMENT_RULES_V1 config evidence (via SoD flow)

Schema extension in `assignmentRulesSchema` (defaults so prior payloads still parse):

```json
{
  "maxQueuePerTelecaller": 20,
  "autoAssignEnabled": true,
  "openStatuses": ["NEW", "ASSIGNED", "..."],
  "siteMatchingPolicy": "require_match",
  "crossSiteOverridePolicy": "assignment_override",
  "rotationStrategy": "least_open_then_user_id"
}
```

Propose/approve/activate unchanged (`proposeConfigVersion` → `parseConfigPayload`). Test: legacy three-field payload still parses and receives defaults. No new config permission.

---

## P. RBAC confirmation (no permission/role change)

No edits to `src/lib/rbac-permissions.ts`. Canonical permissions remain `lead.assign`, `lead.reassign`, `lead.claim`, `assignment.override`. Permission-matrix regression passed.

HTTP mapping: `reassign` now requires `lead.reassign` (the existing canonical permission), not `lead.assign`.

---

## Q. Schema/migration confirmation

**ZERO B13 migrations.** No `prisma/schema.prisma` change. `LeadAssignment_one_open_per_lead` untouched.

---

## R. Full test results

| Suite | Result |
| --- | --- |
| assignment-policy.test.ts | 9 passed |
| b13-assignment.test.ts | 10 passed |
| b13-assignment.api.test.ts | 3 passed |
| prisma-assignment-directory.test.ts | 1 passed |
| b13-assignment.concurrency.test.ts (Postgres) | 1 passed — unique index held, exactly one open row |
| transitions.test.ts | 43 passed |
| __apply-transition.test.ts | 4 passed |
| feature-flag.test.ts | 13 passed |
| permission-matrix.regression.test.ts | 5 passed |
| config-store.test.ts | 8 passed |
| seed-lead-config-defaults.test.ts | 1 passed |
| layering-isolation + layering.test | passed |
| p05-sm-path-guard.test.ts | 3 passed |
| counselling.b11.test.ts | 10 passed |
| notification-port + b12-api | passed |

---

## S. B11/B12 non-regression confirmation

No B11 counselling files and no B12 notification adapter/route/UI files were modified. B11 counselling application tests and B12 API/port tests passed.

---

## T. Explicit DEFERRED / IAM-DEPENDENT list

These are **not** implemented (not “partial”, not “not needed”):

1. Shift-based availability / any shift schedule or Shift entity
2. Skill-based matching / User skill field
3. Language-based matching / User language field; Lead.preferredLanguage not used as a telecaller attribute
4. IAM Module 12 data model and semantics
5. Frozen spec ±10% fair-rotation **across shift/skill/language buckets** (applied only to site + capacity + active eligibility)

---

## U. Any material STOPs/exceptions encountered

None of the §5 stop gates fired. SR own-pool is expressible as **User.siteId**.

---

## V. Final status per item

| Item | Status |
| --- | --- |
| AssignmentDirectory fallback adapter | IMPLEMENTED / TESTED / VERIFIED |
| Site-aware assignment | IMPLEMENTED / TESTED / VERIFIED |
| Cross-site without override blocked | IMPLEMENTED / TESTED / VERIFIED |
| Cross-site with assignment.override | IMPLEMENTED / TESTED / VERIFIED |
| Capacity guard preserved | IMPLEMENTED / TESTED / VERIFIED |
| Genuine assigneeAvailable | IMPLEMENTED / TESTED / VERIFIED |
| No eligible candidate → guard fact false | IMPLEMENTED / TESTED / VERIFIED |
| Fair rotation (site+capacity+active ±10%) | IMPLEMENTED / TESTED / VERIFIED |
| SR_TELECALLER own-pool (User.siteId) | IMPLEMENTED / TESTED / VERIFIED |
| OPS_MANAGER / BANK_SUPER_ADMIN unrestricted reassign | IMPLEMENTED / TESTED / VERIFIED |
| LEAD_ASSIGNMENT_V2_ENABLED default OFF + legacy path | IMPLEMENTED / TESTED / VERIFIED |
| GET /v2/assignment/directory | IMPLEMENTED / TESTED / VERIFIED |
| GET /v2/assignment/workload | IMPLEMENTED / TESTED / VERIFIED |
| Assignment Centre UI | IMPLEMENTED / VERIFIED (code; browser login not run) |
| ASSIGNMENT_RULES_V1 SoD extension | IMPLEMENTED / TESTED / VERIFIED |
| Concurrency one-open-per-lead | TESTED / VERIFIED |
| Existing SM/assignment tests | TESTED / VERIFIED |
| Shift matching | DEFERRED |
| Skill matching | DEFERRED |
| Language matching | DEFERRED |
| IAM Module 12 | DEFERRED |
| Production flag ON | NOT IMPLEMENTED (correct) |
| Schema/migration | NOT IMPLEMENTED (correct — zero migrations) |
| B11/B12 file changes | NOT IMPLEMENTED (correct) |
