# 00 · Lead v2.1 — Cross-Document Consistency Audit

**Purpose:** Final quality gate before v2.1 architecture is declared complete.
**Date:** 2026-09-04
**Auditor:** Lead Product / Enterprise Architect (Claude)
**Documents audited:** `01_LEAD_PRODUCT_MASTER.md` · `02_LEAD_ARCHITECTURE_MASTER.md` · `03_LEAD_DATA_MODEL.md` · `04_LEAD_STATE_WORKFLOW.md` · `05_LEAD_API_RBAC.md` · `06_LEAD_BUILD_MIGRATION.md`

---

## Audit Result Summary

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Product scope matches architecture | ✅ PASS | Both docs treat Lead as bounded domain within HIS · same 18-surface UI · same personas · same in/out-of-scope boundaries · both cite the positioning statement verbatim |
| 2 | Architecture matches data model | ✅ PASS | 12 ports in `02` correspond to services in `03` writing to entities: `LeadRepository` ↔ Lead + related · `AssignmentDirectory` ↔ LeadAssignment · `ConversionPort` ↔ LeadConversion · `SlaPort` ↔ SlaSchedule · `AuditPort` ↔ AuditLog · `CrmPort` ↔ CrmSyncQueue · `NotificationPort` ↔ NotificationTemplate + Log · `ConfigPort` ↔ LeadConfig · `CampaignPort` ↔ Campaign + LeadAttribution · outbox architecture (§6 in `02`) ↔ LeadOutboxEvent + LeadOutboxDlq (§3.19-3.20 in `03`) |
| 3 | Data model matches APIs | ✅ PASS | Every API endpoint in `05` maps to entities in `03`: intake → Lead + LeadAttribution + LeadScore + LeadActivity · timeline → LeadActivity + LeadStatusHistory + LeadFollowUp + CounsellingSession + NotificationDeliveryLog · duplicates → DuplicateCase · merge → LeadMerge · convert → LeadConversion · config → LeadConfig · notification management → NotificationTemplate + Log |
| 4 | APIs match RBAC | ✅ PASS | Every endpoint in `05` §2 lists a permission from `05` §4.3 canonical list · role-permission matrix (§4.4) grants every listed permission to at least one role · state-machine actor permissions in `04` §6 are subset of API permissions in `05` §4.3 |
| 5 | State machine matches workflows | ✅ PASS | All 31 transitions in `04` §3 covered by API endpoints (transitions endpoint in `05` §2.4 + specialised endpoints for archive/unarchive/reactivate/assign/reassign/claim/convert) · auto-transitions (§4 in `04`) covered by internal cron endpoints (§2.17 in `05`) · 14 states listed in `04` §2 match `LeadStatus` enum in `03` §4 |
| 6 | Conversion matches Donor/Recipient boundaries | ✅ PASS | `01` explicitly excludes Donor/Recipient creation; `02` isolates via ConversionPort; `03` LeadConversion UNIQUE(leadId) prevents double convert; `04` T-16 + T-22 route through ConversionPort; `05` `POST /v2/leads/{id}/convert/{donor|recipient}` gates on eligibility; `06` B07 batch delivers ConversionPort with backfill of legacy fields |
| 7 | CRM matches event/outbox architecture | ✅ PASS | `02` §6 declares outbox-driven CRM · `03` §3.19-3.20 defines LeadOutboxEvent + LeadOutboxDlq · `03` §3.21 CrmSyncQueue links to outbox via `outboxEventId` FK · `05` §2.13 CRM endpoints are read/retry only (no synchronous sync) · `06` B06 (outbox) precedes B16 (real CRM adapters) — dependency order correct |
| 8 | DNC matches notification architecture | ✅ PASS | `02` §7 states "DNC gate enforced inside NotificationPort BEFORE adapter invocation" · `03` §3.23 NotificationDeliveryLog requires `dncCheckedAt` + `dncPassed` (blocked sends logged as BLOCKED_DNC) · `04` guard `notInDnc` applied at T-01 + T-15 + T-16 + T-22 + all outbound comms · `05` §2.8 DNC endpoints + §2.16 delivery log · `06` B08 delivers central enforcement · LADR-16 confirms SMS-Magic sits behind NotificationPort |
| 9 | Configuration matches approval model | ✅ PASS | `01` §16 records single-approver decision · `02` §11 details SoD (author ≠ approver) · `03` §3.18 LeadConfig has DB check constraint `approvedByUserId <> createdByUserId` · `04` no state transition depends on multi-approver · `05` §2.14 endpoint returns `CONFIG_SOD_VIOLATION` when actor=author · `06` B09 delivers single-approver workflow with SoD |
| 10 | Reactivation matches 90-day decision | ✅ PASS | `01` §6.5 states 90-day window · `01` §16 LADR-17 approves · `02` §16 lists LADR-17 · `04` §7 explicit 90-day guard · `04` T-29 guard `withinReactivationWindow(lostAt, now)` · `04` §11 invariant I-14 (hard-coded, not ConfigPort — matches decision) · `05` `REACTIVATION_WINDOW_EXPIRED` error code · `06` B04 (state machine) delivers the guard |
| 11 | SMS-Magic appears only behind NotificationPort | ✅ PASS | `01` §16 LADR-16 explicitly says "integrated only through NotificationPort" · `02` §8 details adapter path `src/lib/leads/adapters/notification/sms-magic-adapter.ts` · `03` §3.22 NotificationTemplate lists SMS_MAGIC as a provider, not a domain concept · `04` no direct SMS-Magic reference · `05` webhook endpoint `/v2/notifications/webhook/sms-magic` isolated in notification namespace · `06` B12 places SMS-Magic in adapters layer only · zero references to SMS-Magic in domain layer |
| 12 | Prisma is absent from domain layer | ✅ PASS | `02` §2.1 declares layering rule (ESLint `no-restricted-imports`) · `02` §3 says "Domain entities are plain TypeScript" · `03` §6 states "Domain entity ≠ Prisma model" and mapping rules · LADR-19 approved · `06` B01 scaffolds domain with layering enforcement · B05 refactors any residual Prisma imports and adds mappers |
| 13 | Archive is not improperly represented as lifecycle status | ✅ PASS | `01` §7 declares Status/Outcome/Archive as three separate concepts · `02` LADR-21 approved · `03` Lead has both `status`, `outcome`, `isArchived` (with archivedAt/By/Reason) as distinct fields · `04` §1 makes orthogonality explicit · `04` T-27/T-28 archive/unarchive preserve status · `04` §11 invariant I-09 requires archive metadata · `05` list filters expose isArchived independently · no code path conflates them |
| 14 | Existing data migration is accounted for | ✅ PASS | `03` §5 migration mapping table covers every legacy entity/field with [RETAIN/ADD/ALTER/DEPRECATE/MIGRATE] · `06` §6 rollback + data preservation guarantees · `06` B07 backfills existing converted leads into LeadConversion · B08 explodes `LeadDoNotCallList` into `LeadDoNotCall` rows · B11 preserves existing CounsellingBooking · B15 backfills attribution for historical leads · B18 deprecations only after 2 clean releases |
| 15 | Existing Lead functionality is not accidentally removed | ✅ PASS | `06` §6 explicit no-removal guarantee for status/assignment/conversion/score legacy fields · `05` §3 legacy `/api/leads/*` endpoints RETAINED and aliased to v2 · `04` all 14 existing statuses retained in v2.1 (with orthogonal archive concept added) · `03` `Donor.sourceLeadId` and `Recipient.sourceLeadId` retained · `06` state machine adopted via double-write pattern (B04) so nothing breaks · every P0 batch has explicit rollback via feature flag flip |

---

## Consistency issues found + resolutions

| Issue | Severity | Resolution |
|---|---|---|
| `LeadTier.ARCHIVED` enum value conflicts semantically with new `Lead.isArchived` field | Low | Renamed enum value to `ARCHIVED_TIER` in `03` §4 to distinguish from archive state (LADR-21) — noted as `[ALTER]` |
| Legacy spec §5 (existing v1) uses `SlaEntityType` with unused values | Low | `03` §3.24 marks retained but flags deprecation in B18 · `06` B18 explicitly drops after usage audit |
| `Lead.notes` free-text field vs generic `LeadActivity(NOTE)` | Low | `03` marks `Lead.notes` [DEPRECATE]; UI already discourages · `06` B18 drops after 2 releases |
| Score storage split between `Lead.scoreBreakdown` and `LeadScore.breakdown` during migration | Low (transient) | `03` §3.1 shows `Lead.scoreBreakdown` [DEPRECATE] with `Lead.latestScoreId` FK as the new canonical pointer · double-write during migration · drops in B18 |
| Some AI-related fields already exist as stubs (QA, recording) but P3 defers | Low | `03` §3.7 marks them [DEPRECATE] · `06` B18 drops after 2 releases · P3 AI batches (B19-B22) design their own persistence separately |

None of these break v2.1 correctness — all are handled by additive migration + double-write + delayed deprecation.

---

## Open Items (post-freeze, before build)

| # | Item | Owner | Deadline |
|---|---|---|---|
| O-01 | Obtain SMS-Magic sandbox credentials for staging | Founder / Ops | Before B12 (P1) |
| O-02 | Confirm which Marketing Manager role owns `SCORE_WEIGHTS_V1` vs which Ops Manager owns `SLA_MATRIX_V1` for LeadConfig ownership | Founder | Before B09 (P0/P1 boundary) |
| O-03 | Verify existing production Lead volume + peak intake rate for load-test sizing | Engineering | Before B03 (P0) |
| O-04 | Confirm Meta WhatsApp App ID / secret setup for signature verification | Founder / Engineering | Before B02 (P0) |
| O-05 | Choose per-tenant vs per-organisation LeadConfig scope for future SaaS extraction | Founder | Before v3.0 |

---

## Decision Log Delta (v2.1 additions)

| ADR | Title | Status | Doc |
|---|---|---|---|
| LADR-16 | SMS-Magic sole SMS vendor · behind NotificationPort only | [APPROVED] | `02` §8 |
| LADR-17 | LOST reactivation window = 90 days · hard-coded | [APPROVED] | `04` §7 |
| LADR-18 | Config approval = single approver with SoD | [APPROVED] | `02` §11 · `03` §3.18 |
| LADR-19 | Pure domain entities (not Prisma) | [APPROVED] | `02` §2.1, §3 |
| LADR-20 | Transactional outbox for domain events | [APPROVED] | `02` §6 · `03` §3.19-3.20 |
| LADR-21 | Status / Outcome / Archive are three orthogonal concepts | [APPROVED] | `04` §1 |
| LADR-22 | Duplicates go through review — never auto-merge | [APPROVED] | `04` §8 |
| LADR-23 | First-touch attribution immutable · last-touch versioned | [APPROVED] | `03` §3.12-3.13 |

---

## Assumption Log

| # | Assumption | Owner |
|---|---|---|
| A-01 | Existing shared SLA engine remains authoritative — Lead uses SlaPort as wrapper | Engineering |
| A-02 | Existing audit hash-chain (module 02) is extended, not forked | Engineering |
| A-03 | Supabase Postgres continues as data store through v2.x | Founder |
| A-04 | IAM module 12 lands before Assignment upgrade B13 | Product |
| A-05 | MRD module 11 lands before lead-attached documents feature (P2) | Product |
| A-06 | SMS-Magic sandbox available before B12 | Ops |

---

## Change Log

| Version | Date | Change | Author |
|---|---|---|---|
| 2.0 | 2026-09-04 | Initial re-engineering master (Phases 1-11) | Engineering (Claude) |
| 2.1 | 2026-09-04 | Founder Architecture Freeze — pure domain entities, outbox, status/outcome/archive separation, duplicate case, attribution first/last-touch, SMS-Magic decision, 90-day reactivation, single-approver config · 6-doc master set produced · consistency audit passed | Product + Engineering (Claude) |

---

## Verdict

**All 15 consistency checks: ✅ PASS**

Documentation is internally consistent, aligned to Founder decisions, and ready to control Cursor implementation. **No coding to begin** until per-batch Cursor prompts are authored in `07_LEAD_CURSOR_BATCH_PROMPTS.md` (next deliverable, on request).

---

**Sign-off required from:**
- Founder (Arindam)
- Engineering Lead
- Legal / Compliance (Sumit) — DPDP + audit review

Once signed, the six master documents become the source of truth. Any deviation must be flagged, explained, and re-approved.
