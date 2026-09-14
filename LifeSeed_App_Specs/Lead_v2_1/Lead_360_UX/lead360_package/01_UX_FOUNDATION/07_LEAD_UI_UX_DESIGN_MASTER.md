# 07 · LEAD UI/UX DESIGN MASTER
### Status: **FROZEN — DESIGN MASTER v0.1 (ARCHITECTURE/UX SPECIFICATION)**, Founder-approved structure, QA corrections applied
### Governs: Lead Management v2.1, all 18 UI surfaces

**Changelog (v0.1 freeze):** current-UI-status wording corrected to distinguish TARGET-surface status from live legacy v1 surfaces (Final Section D); configuration-approval target UX confirmed as single-approver (Part 1, Part 8.16); SMS provider confirmed as SMS-Magic behind a provider-agnostic `NotificationPort` presentation (Part 1); write behaviour split into reversible/optimistic vs. consequential/pending-confirmed tiers (§3.15, Part 6.4).

**Changelog (Founder decision gate, Lead 360 design freeze):** Part 6.1's rail description updated to the locked three-tier hierarchy; Part 6.2's RBAC table corrected — SR_TELECALLER holds `lead.reactivate` (own pool, ≤90 days), previously omitted; Part 3.12 updated to state the locked capture-panel principle for co-equal outcome actions and the locked no-forced-primary default for OPS_MANAGER/SUPER_ADMIN on owner-driven working statuses. Full decision record: `LEAD_360_DESIGN_FREEZE_DELTA.md`. No other structural sections changed.

---

## Part 0 · How to read this document

**Source-of-truth hierarchy governing every decision below:**
1. Founder-approved decisions / `LEAD_UX_DESIGN_CONSTITUTION_v0.2.md`
2. `Lead_v2_1/00–07` frozen architecture and product specifications
3. `08 · Lead Management Re-engineering v2.0`, where it provides current-state evidence
4. Existing HIS architecture/design-system conventions (Document A)
5. Current implementation evidence (Doc 08 Phase 1, self-reported, not independently verified)
6. UX design judgement

**Labels used throughout, never silently upgraded or downgraded:**
- `[LOCKED]` — stated explicitly by the Founder
- `[DERIVED]` — a direct, load-bearing consequence of a frozen architecture document
- `[PROPOSED]` — design judgement, not sourced from a locked instruction
- `[UX REQUIRES BACKEND CAPABILITY]` — the design assumes something that does not yet exist; dependency named
- `[ENGINEERING RECONCILIATION ITEM]` — a standing conflict between source documents that UX does not resolve
- `[UX BASELINE — pending engineering reconciliation]` — the specific case of the Archive conflict, carried through every surface it touches

This document does not claim anything here is implemented. It is a specification to build toward, not a description of the running system. Where evidence about the running system is cited, its source and verification status is stated every time.

---

## Part 1 · UX Constitution (governing, not restated in full)

`LEAD_UX_DESIGN_CONSTITUTION_v0.2.md` is the governing constitution for every principle below — this document does not re-litigate it, only applies it.

**Design philosophy** `[LOCKED]`: *"Apple-like clarity with enterprise healthcare information density." "Calm at first glance. Powerful on demand." "Apple on the outside, Ferrari dashboard underneath."*

**North Star** `[LOCKED]`: *"Every Lead tells you, at a glance, exactly where it stands and what to do next — with the full operational truth one interaction away, never hidden, never overwhelming."*

**Three speeds** `[LOCKED]`: Glance (~2s, header-driven) → Action (~5–10s, one obvious primary action) → Investigation (progressive disclosure, timeline-driven).

**Design language — avoid** `[LOCKED, from this authorization]`: generic Bootstrap admin aesthetics, excessive cards/shadows, giant sidebar navigation, decorative gradients, unnecessary animation, dashboard clutter, raw JSON, arbitrary colour coding, icon-only controls, modal-heavy workflows, tab proliferation.

**Design language — prefer**: strong hierarchy, whitespace, semantic colour, typography-driven hierarchy, progressive disclosure, contextual actions, inline editing where safe, drawers/sheets where appropriate, predictable confirmation, excellent tables, excellent keyboard support, clear empty/error/loading states, density only where operationally useful.

**Engineering Reconciliation Items carried into this document** (from your authorization message, tracked, never silently resolved):
Doc 08 vs Lead_v2_1 target-architecture conflicts · current implementation vs target architecture · SMS provider implementation/source conflict · configuration approval-count conflict · archive implementation migration · existing HIS detail-page layout benchmark (not yet performed) · portal keyboard-shortcut collision check · Reports colour-system verification · any unresolved data-model dependency discovered below (flagged inline as found).

**Founder-clarified target defaults (this QA pass — target UX direction only, not new architecture; the underlying engineering conflicts stay open above):**
- **Configuration approval** — target UX is a **single authorised approver**, not a dual-approval workflow. Doc 08's two-approver reference remains an `[ENGINEERING RECONCILIATION ITEM]` at the policy/engineering level only; it does not make the design in Part 8.16 ambiguous.
- **SMS provider** — target provider is **SMS-Magic**, but this is a `NotificationPort` adapter-level fact, not a UX fact. The operational UI never names or brands the provider, and a future provider swap must never require a UX redesign. Doc 08's alternate-provider reference remains engineering reconciliation only.

---

## Part 2 · Lead Domain Information Architecture

```
Global HIS Shell (existing portal-shell, nav, auth — Document A's actual code;
                   exact component API unconfirmed — [ENGINEERING RECONCILIATION ITEM])
   ↓
Lead Domain (one bounded context, 12 ports, per 02_LEAD_ARCHITECTURE_MASTER.md — NOT a separate app)
   ↓
Three role-lenses over the SAME domain objects:
   ├─ Command / Oversight   → Command Centre, Analytics, SLA Monitor, Audit, Configuration, CRM Sync Monitor
   │                          (OPS_MANAGER, MARKETING_MANAGER, CRM_ADMIN, BANK_SUPER_ADMIN, BANK_MEDICAL_DIRECTOR)
   ├─ Frontline Execution   → Telecaller Workspace, Lead Queue, Follow-up Queue, New Lead,
   │                          Assignment Centre, Duplicate Review, DNC
   │                          (TELECALLER, SR_TELECALLER)
   └─ Counselling           → Counsellor Workspace, Counselling Calendar
                              (COUNSELLOR)
   ↓
Lead 360 — every lens routes here for "this one Lead" (flagship, Part 6)
   ↓
Operational workflows (Part 7) — all mutate the SAME Lead aggregate, never a lens-specific copy
```

**Lead navigation model** `[PROPOSED]`: within the existing HIS shell's navigation, Lead surfaces group under one "Lead" section, sub-grouped by lens for Command-lens users (who may need all three groups) and collapsed to just their lens for Telecaller/Counsellor roles (who never need Command surfaces in their nav at all — not merely hidden by permission, absent from the nav entirely, since a denied-but-visible nav item creates noise the RBAC denial pattern in Part 3 is meant to avoid at the action level, not the nav level). Exact placement within the existing shell's nav structure is `[ENGINEERING RECONCILIATION ITEM]` — Document A does not describe the shell's nav data structure in enough detail to specify precisely.

---

## Part 3 · Object Model Presentation Grammar

This is the reusable language every surface in this document speaks. It is established once, here, and referenced — not redefined — everywhere else. Lead 360 (Part 6) is its canonical demonstration.

### 3.1 Identity
Lead Code (`LED-{CITY}-{YYYYMMDD}-{XXXX}`, monospace, click-to-copy) + Name. Code always precedes name — it's the token telecallers read aloud on calls and search by.

### 3.2 Status
`[DERIVED]` from `04_LEAD_STATE_WORKFLOW.md` §2 — 14 states, filled badge, colour by category (New/Working/Interim/Terminal-positive/Terminal-negative/Terminal-retention), icon + colour + text always paired (`[LOCKED]`, Constitution §14). Only the state machine may change this value (04's non-negotiable rule) — no UI ever implies a direct status edit.

### 3.3 Outcome
`[DERIVED]` from 04 §1 — `Lead.outcome` ∈ {WON, LOST, EXPIRED, MERGED, null}. Rendered as an **outline badge**, structurally distinct from Status's filled treatment, and **only rendered once an outcome exists** — never a placeholder dash. This directly fixes the historical "Tier stays COLD after CONVERTED" confusion (Doc 08 D-05, self-reported) by giving Outcome its own visible slot instead of overloading Tier.

### 3.4 Archive `[UX BASELINE — pending engineering reconciliation]`
`[DERIVED]` from `04_LEAD_STATE_WORKFLOW.md` §1 (verified verbatim: *"Archive is orthogonal — an ARCHIVED lead can still be in status ASSIGNED or CONTACTED_QUALIFIED"*) and `05_LEAD_API_RBAC.md` §2.4 (archive/unarchive are separate endpoints from state transitions). Rendered as a **full-width banner**, never a badge in the Status/Outcome/Tier row — putting it there would re-conflate exactly what 04 separates. `Doc 08 §5.1–5.2` models `ARCHIVED` as state 15 of its own state machine — a structurally different, unreconciled model. This UX is built on 04's model per your explicit direction; Doc 08's model is legacy/current-state material pending Engineering's own reconciliation, not adopted here.

### 3.5 Tier-at-capture
`[DERIVED]` — current mutable `Lead.tier`, muted/secondary visual weight, explicitly labelled **"Current Tier"** (never "Tier at capture") with a tooltip stating it can change as the lead is scored. Never merged with Outcome or Status.

### 3.6 SLA
`[DERIVED]` from `SlaSchedule`/`SlaPort`. Chip combining colour + shape + text (`[LOCKED]`, Principle 7 of the 10 non-negotiables) — rounded/neutral well before breach, angular/bordered/warning-icon as it nears breach, solid/alert with explicit "BREACHED" text after. Never colour alone.

### 3.7 Score
`[DERIVED]` from `LeadScore`. Chip: numeric value + tier word + trend indicator (up = bluish-green-family token, down = neutral-family token — a lower score is not an error state, never rendered in a warning colour).

### 3.8 Ownership
`[DERIVED]` from `LeadAssignment`. Clickable chip → expands assignment history inline (never a navigation away).

### 3.9 Attribution
`[DERIVED]` from `LeadAttribution`/`LeadAttributionHistory` and I-10 (first-touch immutable). First-touch renders with a locked-icon affordance; last-touch renders as editable/updatable. Never shown as a single merged "source" field once both exist.

### 3.10 Alerts / banners
Stacking order (structural/legal state first, urgency last), each independently triggered: Archived → DNC → Duplicate flagged → SLA breached. Maximum 4, in practice rarely more than 1. Each states the fact plainly and offers exactly one relevant action where applicable (e.g. "Review duplicates").

### 3.11 Timeline / activity grammar
`[DERIVED]` from `04_LEAD_STATE_WORKFLOW.md` §10 — the timeline is the **ordered union of 9 named source tables** (`LeadStatusHistory`, `LeadActivity`, `LeadAssignment`, `LeadScore`, `LeadFollowUp`, `CounsellingBooking`/`CounsellingSession`, `NotificationDeliveryLog`, `LeadConversion`, `LeadMerge`), `occurredAt DESC`, cursor-paginated, no raw JSON. **One coherent grammar, not 15 unrelated styles**: every row is icon + one-line summary + relative time by default (Glance), expands in place — never a modal — for full detail (Investigation). Visual differentiation is by **category**, not by every individual sub-type:

| Category | Covers | Treatment |
|---|---|---|
| Transition | Status changes | Neutral, shows from→to inline |
| Contact | Calls, notification sends | Neutral/blue, outcome subtag |
| Task | Follow-ups | Amber only if overdue, neutral otherwise |
| Counselling | Booking→Session→Outcome | One visually-chained group, not three unrelated rows |
| Ownership | Assignment changes | Neutral, person-swap icon |
| Scoring | Score recomputation | Trend icon only, no alarming colour |
| Attribution | First/last-touch | Tag icon, locked variant for first-touch |
| Risk | Duplicate/merge/DNC | Vermillion-family token, only category using a warning hue |
| Milestone | Conversion | Terminal styling, one occurrence, links to the created record (RBAC-gated) |

Rows are added progressively as their source table ships — `[UX REQUIRES BACKEND CAPABILITY]`: every category except Transition/Contact (partially real, per Build Status Snapshot) currently has **0% of its source table built**. The full 9-category grammar is the target contract; what actually renders on any given day is whatever's shipped.

### 3.12 Action hierarchy
`[PROPOSED]`, except destructive confirmation (`[LOCKED]`, Principle 2): exactly one primary action (high emphasis), secondary actions below it, denied-but-relevant actions shown disabled with an inline reason unless disclosure itself would leak scope (in which case omitted, not shown-disabled). Two refinements `[LOCKED — Founder decision gate]`: (1) where a status's forward transitions are genuinely co-equal outcomes of one real-world event (a call, a counselling session) rather than a ranked lifecycle choice, the single primary action opens a capture panel containing those outcomes internally, never several independently-ranked competing buttons; (2) for OPS_MANAGER/BANK_SUPER_ADMIN specifically, on a normally-progressing owner-driven working status, no primary action is forced — their candidate actions (disposition-override, reassign, archive, counselling-override) render as equal-weight secondary actions, except where the state machine provides genuinely only one meaningful action (Assign, Reactivate, Review duplicate). Full resolution per status/role: `LEAD_360_ACTION_RESOLUTION_MATRIX.md`.

### 3.13 Confirmation patterns
`[LOCKED]`: merge, convert, DNC add, archive, reactivate always confirm. Merge and archive (least reversible) require typing the Lead code; the rest use single explicit confirm/cancel.

### 3.14 Empty / loading / error states
Skeletons shaped like final layout (no layout shift), partial-failure isolation (one region's fetch failing never blanks the page), empty states that don't render when a section has nothing to show (Part 3.10's conditional cards), plain-language errors with retry, never a raw error payload.

### 3.15 Write behaviour by risk tier
`[LOCKED]`, Principle 5 (optimistic-interaction philosophy) — applied per operation risk, not uniformly:
- **Reversible / low-risk writes** (disposition on non-terminal states, follow-up create/complete, note edits, filter/view changes): immediate optimistic UI + toast, background revalidation, rollback + error toast + retry on failure — as originally specified.
- **Consequential / high-risk writes** — the same set requiring confirmation per §3.13 (merge, conversion, DNC add, archive, reactivate): confirmation → **pending/processing state** (control disabled, inline spinner or "Processing…" label, no premature success signal) → **authoritative server confirmation** → success state (badge/banner/timeline update) → audit/timeline row appears. The UI never visually implies an irreversible operation has succeeded before the server has confirmed it. On failure, the pending state clears back to the pre-action state with an error toast and retry — never a silent revert indistinguishable from ordinary optimistic rollback.

This distinction governs every "Confirmation → Feedback" step in Part 7's workflow specifications below; it refines how Principle 5 is applied, it does not remove or contradict it.

---

## Part 4 · Design Tokens

Semantic, not hard-coded — so the real Reports-module palette (unverified, `[ENGINEERING RECONCILIATION ITEM]`) can be substituted without redesign.

| Category | Token examples | Notes |
|---|---|---|
| Typography | `font.family.primary`, `font.family.mono` (Lead Code only), `font.size.{xs..3xl}`, `font.weight.{regular,medium,semibold}` | Max 2 font families total (`[LOCKED]`) |
| Spacing | `space.{0,1,2,3,4,6,8,12,16,24}` (4px base unit, proposed) | `[PROPOSED]` scale |
| Radius | `radius.{sm,md,lg,pill}` | Restrained — no heavy rounding (avoid generic-SaaS look) |
| Elevation | `elevation.{0,1,2}` | Minimal use — flat hierarchy preferred over shadow stacking |
| Borders | `border.width.{hairline,default}`, `border.color.{default,strong,focus}` | |
| Focus | `focus.ring.width`, `focus.ring.color`, `focus.ring.offset` | Always visible, never suppressed |
| Colour — background | `color.background.{page,surface,raised,inverse}` | |
| Colour — text | `color.text.{primary,secondary,muted,inverse,link}` | |
| Colour — border | `color.border.{default,strong,focus}` | |
| Colour — action | `color.action.{primary,primary-hover,secondary,destructive}` | |
| Colour — status | `color.status.{new,working,interim,terminal-positive,terminal-negative,terminal-retention}` | Maps to the 14-state categories (§3.2), not 14 individual hues |
| Colour — risk | `color.risk.{low,medium,high,breach}` | SLA + duplicate/DNC/merge family |
| Colour — score | `color.score.{up,down,neutral}` | `down` is a neutral tone, never a risk tone (§3.7) |
| Icon sizing | `icon.size.{sm,md,lg}` | |
| Control height | `control.height.{sm,md,lg}` | Consistent input/button/chip heights |
| Breakpoints | `breakpoint.{tablet,desktop,wide}` | Desktop-primary — see Part 9.5 |
| Motion | `motion.duration.{fast,default}`, `motion.easing.default` | Respects `prefers-reduced-motion` |
| Z-index | `z.{base,sticky,drawer,dialog,toast}` | |

Exact hex/px values are intentionally not specified in this document — `[PROPOSED, pending Reports-module verification]`. A token implementation file is an engineering artifact, not part of this UX Master.

---

## Part 5 · Component Architecture

| Tier | Components | Status |
|---|---|---|
| **HIS-wide candidates** | Nav shell, Header/Breadcrumb, auth-gated route wrapper, generic Button/Input/Select/Table primitives, Toast, Confirmation Dialog, Empty/Loading/Error wrappers | Unconfirmed against real code beyond Document A's existence-level listing — `[ENGINEERING RECONCILIATION ITEM]` |
| **Lead-domain components** (reusable across all 18 surfaces) | StatusBadge, OutcomeBadge, TierChip, ArchiveBanner, SLAChip, ScoreChip, OwnershipChip, AttributionTag, Timeline, ActionPanel, DeniedAction, CursorTable, FollowUpCard, CounsellingChain, DuplicateCompareView, DNCBanner, ConversionSummaryCard, AuditRow | All 0% built per Build Status Snapshot — `[UX REQUIRES BACKEND CAPABILITY]` for the data, design-only today |
| **Lead-specific components** | CallDispositionPanel, IntakeConsentForm, CampaignAttributionForm, ConfigApprovalWorkflow | Only make sense inside 1–2 surfaces |
| **Future-CRM candidates** | Timeline, CursorTable+saved-views pattern, ActionPanel gating pattern | Designed inside Lead now with an eye to reuse if the CRM ecosystem expands later — not built as HIS-wide today |

Component library itself (shadcn/ui vs. hand-rolled) is unresolved — `[ENGINEERING RECONCILIATION ITEM]`. Every component name above is a design-vocabulary label, not an implementation API.

---

## Part 6 · Lead 360 — Flagship Reference Implementation

Lead 360 demonstrates every element of Part 3 at once. It is the canonical reference — every other surface reuses these exact patterns rather than inventing variants.

### 6.1 Layout
Single-scroll (`[PROPOSED]`, preferred direction — benchmark against existing HIS detail-page conventions not yet possible, `[ENGINEERING RECONCILIATION ITEM]`): sticky header → conditional alert banners → two-column body (Timeline main column ~68%/rail ~32%, `[PROPOSED]` ratio, recommended not frozen — see `LEAD_360_DESIGN_VALIDATION_PACK_v0.1.md` Part 3). Rail is **three tiers, not a flat card stack**, `[LOCKED — Founder decision gate]`: Tier 1 Action Panel (own visual treatment) → Tier 2 combined At-a-glance card (SLA + Score + Ownership + Attribution, one card not four) → Tier 3 Quick Facts + conditional Counselling summary + conditional Duplicate/Merge summary. Full anatomy: `LEAD_360_VISUAL_DESIGN_SPEC_v0.1.md` Part 1.

### 6.2 RBAC presentation (8 roles only, per Constitution §19)

| Role | Sees | Can do | Hidden | Disabled (with reason) | Read-only |
|---|---|---|---|---|---|
| TELECALLER | Own/assigned leads only | Disposition, claim, book counselling, convert donor (with supervisor confirmation for restricted cases), follow-up create/complete | Config, Audit export, other telecallers' leads | Reassign, archive, merge, DNC remove | Score breakdown detail |
| SR_TELECALLER | Same as TELECALLER + own pool | + Reassign within own pool, convert without supervisor confirmation for standard flows, **reactivate own-pool leads from LOST within the 90-day window** (`[LOCKED — Founder decision gate, Decision 6]`; corrects an earlier omission — 05 §4.4 grants this explicitly) | Config, Audit export | Archive, merge | — |
| COUNSELLOR | Leads assigned for counselling | Session record, outcome record, convert recipient (per policy), follow-up | Assignment tools, DNC management | Reassign, archive | Attribution, score |
| OPS_MANAGER | Any lead, site-scoped | Assign/reassign, archive/unarchive, reactivate, merge, DNC add/remove | — | — (full operational access within scope) | — |
| MARKETING_MANAGER | Any lead (attribution/campaign context) | Campaign CRUD, attribution view | Disposition, conversion actions | Assign, archive | Everything except campaign/attribution |
| CRM_ADMIN | CRM-relevant fields | CRM sync monitor/retry, CRM config | Disposition, counselling | Most lead-mutation actions | Most of the record |
| BANK_SUPER_ADMIN | Everything | Everything + config approval, audit export | — | — | — |
| BANK_MEDICAL_DIRECTOR | Everything (read) | — | — | Every mutation action | Entire record |

`[UX REQUIRES BACKEND CAPABILITY]` — this table describes the **intended trust boundary**. Doc 08 (D-06, self-reported, not independently verified) states ownership enforcement is currently missing on lead detail — an active IDOR. This table is not a claim that the boundary is enforced today.

### 6.3 Empty / loading / error, keyboard, accessibility, print
As specified in Part 3.14, 3.15, and Part 9 (cross-cutting) — Lead 360 is their reference application, not a special case. Print/export: Lead 360's print view is a condensed milestone summary (status transitions, counselling triad, conversion) — it does **not** embed regulatory forms M/M1/13/15 (Constitution §22 default: those belong to the downstream clinical/MRD domain, likely surfaced in Conversion Centre, Part 8.12).

### 6.4 Engineering handoff (template, applied)

| Element | Component | Data required | Domain dependency | Permission dependency | Loading | Error | Optimistic? |
|---|---|---|---|---|---|---|---|
| Timeline | `Timeline` | Union of 9 tables | `LeadRepository.search` equivalent, `04 §10` composition | View-scope per 6.2 | Skeleton rows | Inline retry, page intact | No (read) |
| Status badge | `StatusBadge` | `Lead.status` | State machine (04) | View-scope | Skeleton | — | Non-destructive transitions: yes (optimistic tier). Destructive subset (§3.13): pending → confirmed tier |
| Action Panel | `ActionPanel` | Role + status → allowed transitions | `05_LEAD_API_RBAC.md` §4 matrix | Per-action permission | Skeleton buttons | Disabled + retry | Per-action |
| Archive banner | `ArchiveBanner` | `isArchived`, `archivedAt/By/Reason` | 04's orthogonal model — `[UX BASELINE — pending engineering reconciliation]` | `lead.archive`/`lead.unarchive` | — | — | Pending → confirmed (§3.15, consequential tier — not immediate-optimistic) |

This four-column pattern (component / data / dependency / permission, plus loading/error/optimistic) is the template every surface below is described against, at a summary level rather than exhaustively per-element, to avoid 42 isolated screen specs.

---

## Part 7 · Consequential Workflow Specifications

Each workflow below follows: entry point → preconditions → primary action → secondary actions → validation → confirmation → success feedback → failure feedback → audit event → state/outcome/archive implications → notification implications → permission implications → recovery path. All transitions cite their exact `04_LEAD_STATE_WORKFLOW.md` transition ID(s) — verified against the source document directly.

### 7.1 Status transition (generic pattern)
- **Entry:** Action Panel primary/secondary action, gated by current status + role (Part 6.2).
- **Preconditions:** Guards per 04 §5 (ownership, permission, DNC-clean, required fields, etc. — varies by transition).
- **Validation:** Guard failure surfaces the specific typed domain error (04 §12) in plain language, never a raw error code.
- **Confirmation:** Required only for the destructive subset (§3.13); ordinary dispositions (e.g. `disposition_qualified`) proceed on click with optimistic UI, no modal.
- **Feedback:** Toast + inline badge update on success; rollback + error toast with retry on failure.
- **Audit:** Every transition writes `LeadStatusHistory` + `LeadActivity(STATUS_CHANGE)` in one transaction (04, I-15) — UI reflects this as a single timeline row, never two.
- **State implications:** Status changes; Outcome only changes at terminal transitions or merge (I-08); Archive is never touched by a status transition (§3.4).
- **Recovery:** Any denied transition surfaces the informative-denial pattern (§3.12); no dead-end states in the UI.

### 7.2 DNC add/remove
- **Entry:** `disposition_do_not_call` (T-10, from Action Panel) or standalone DNC surface (Part 8.10).
- **Preconditions:** Ownership (for the disposition path); `dnc.add`/`dnc.remove` permission (standalone).
- **Confirmation:** Required (§3.13) — this is irreversible in effect even though technically removable, since it blocks all outbound contact.
- **Feedback:** Immediate banner appears on Lead 360 (§3.10); toast confirms.
- **Audit:** `lead.dnc.add`/`lead.disposition`, outbox `LeadDncAdded`.
- **Notification implication:** `[UX REQUIRES BACKEND CAPABILITY]` — the "enforced at every outbound channel via NotificationPort" guarantee is target architecture; today (per Doc 08, self-reported) DNC is checked at intake only, not consistently pre-communication. The UI states the intended guarantee; it does not claim it is active. As with all outbound-notification UX, this stays provider-agnostic — SMS-Magic is the Founder-directed target provider behind `NotificationPort`, but no surface names or brands it.
- **Recovery:** Removal requires `removalAuthorityUserId` context (03 data model) — UI must capture and display who authorized removal, not just that it happened.

### 7.3 Duplicate review / merge
- **Entry:** Duplicate Review surface (Part 8.10) or the Lead 360 duplicate banner.
- **Preconditions:** Open `DuplicateCase`; `lead.merge` permission (OPS_MANAGER+).
- **Primary action:** Side-by-side compare → select winner → merge.
- **Validation:** `LeadMerge.loserLeadId` UNIQUE (I-04) — a lead can only be merged once; UI must handle the "already merged" case gracefully, not as a generic error.
- **Confirmation:** Required, typed-code confirmation (most severe tier, §3.13) — merge is explicitly irreversible per LADR-22 ("to 'unmerge,' create a new lead and note the correction").
- **Feedback:** Winner's timeline gains a Risk-category row (§3.11); loser's record shows a "merged into {code}" state.
- **Audit:** `lead.merge`, outbox `LeadMerged`.
- **State implications:** Loser → `LOST` (outcome=MERGED, isArchived=true) via T-31 — this is the one transition where Archive and a status transition happen together, by explicit design (04's own model, not a UX invention).
- **Recovery:** None (irreversible) — the confirmation step is the only safety net, must be unambiguous.

### 7.4 Conversion (donor/recipient)
- **Entry:** Action Panel, gated on `CONTACTED_QUALIFIED` (donor, T-16) or `COUNSELLING_ATTENDED` with a captured recommendation (recipient, T-22).
- **Preconditions:** `noDuplicateConversion` guard (I-03 unique constraint), `ConversionPort.isEligibleForDonor/Recipient()`, DNC-clean, required fields present.
- **Confirmation:** Required, typed-code tier (§3.13) — a Lead becomes a Donor/Recipient record through `ConversionPort` only; the UI never implies direct record creation.
- **Feedback:** Timeline gains a Milestone-category row (§3.11), terminal styling; a link to the created record (RBAC-gated visibility).
- **Failure:** `LeadDuplicateConversionError` surfaces as "this lead has already been converted" — never a raw constraint-violation message.
- **Audit:** `lead.convert.donor`/`lead.convert.recipient`, outbox `LeadConverted`.
- **State implications:** `CONVERTED` (outcome=WON), terminal, no further transitions except audit-only archive.
- **Recovery:** None (terminal) — this is intentional per the architecture.
- **`[UX REQUIRES BACKEND CAPABILITY]`**: the double-convert guard and atomic `ConversionPort` transaction are target architecture; Doc 08 (self-reported) states current conversion is direct-coupled with dual conversion IDs that "can diverge" (D-10). The UI presents the safe target behaviour; it is not a claim that today's conversion action is safe.

### 7.5 Archive / Reactivate
- **Entry:** Action Panel (`archive`/`unarchive`, T-27/T-28) or Lead 360's archive banner (`reactivate`, T-29, only when `status=LOST`).
- **Preconditions:** `SUPERVISOR`-tier permission + reason (archive/unarchive); reactivate additionally requires `withinReactivationWindow` (≤90 days, hard-coded per LADR-17, not ConfigPort-driven).
- **Confirmation:** Required (§3.13).
- **Feedback:** Archive banner appears/clears (§3.4); reactivate clears Outcome to null and starts a fresh SLA — reflected as a new Milestone-category timeline row, not a silent state reset.
- **Failure:** Reactivation past 90 days is refused; UI surfaces "Create new lead (subject to DPDP re-consent)" per 04 §7 verbatim, not a generic denial.
- **Audit:** `lead.archive`/`lead.unarchive`/`lead.reactivate`, outbox `LeadArchived`/`LeadReactivated`.
- **`[UX BASELINE — pending engineering reconciliation]`**: this entire workflow is built on 04's orthogonal model (status untouched by archive). If Engineering's reconciliation with Doc 08 changes that model, this workflow's state-implication row is the one that changes, not the confirmation/audit/feedback pattern around it.

### 7.6 Counselling booking / session / outcome
- **Entry:** Action Panel `book_counselling` (T-15, `CONTACTED_QUALIFIED` + `personType=RECIPIENT` only).
- **Preconditions:** Counsellor slot available, DNC-clean for reminders.
- **Feedback:** Timeline gains a Counselling-category chained group (§3.11) as the booking progresses: booked → attended/no-show → outcome.
- **Two locked sub-decisions, applied here exactly as resolved earlier:**
  - `COUNSELLING_ATTENDED` shows a single primary action, **"Record outcome"** — no separate decline/defer buttons (`[ARCHITECTURE CONFLICT]`, carried forward: 04 has no auto-LOST path for a declined/deferred outcome — asymmetric vs. other states, designed to spec as-is).
  - `session_cancelled` (T-19) shows **two explicit actions** — "Reschedule counselling" and "Cancel counselling" — never one button with a follow-up prompt.
- **Recovery:** No-show recycles up to the configured attempt max (default 3, T-20/T-21) before auto-LOST — UI shows remaining attempts, not just pass/fail.
- **`[UX REQUIRES BACKEND CAPABILITY]`**: `CounsellingSession` history is 0% built (Doc 08 D-09/D-17, self-reported: current booking is a single mutable record that overwrites prior history). This workflow's "chained group" timeline treatment is target-contract design, not a description of what renders today.

### 7.7 Assignment / Reassignment / Claim
- **Entry:** Assignment Centre (Part 8.9) or Lead 360's Ownership chip.
- **Preconditions:** T-02 (system or OPS_MANAGER, on-shift telecaller in matching site/skill scope); T-03 reassign requires a supplied reason; T-04 claim requires unassigned-or-self-claim policy.
- **Feedback:** Timeline gains an Ownership-category row; SLA clock behaviour follows 04's per-transition SLA-effect column exactly (e.g. reassign resets the warning clock only if configured — the UI does not assume a reset by default).
- **`[UX REQUIRES BACKEND CAPABILITY]`**: site/shift/skill/language-aware `AssignmentDirectory` is target architecture; current assignment (Doc 08, self-reported) is round-robin only. Assignment Centre's full manual-override/workload-balancer vision is designed against the target contract.

### 7.8 Follow-up create / complete / reschedule
- **Entry:** `disposition_callback` (T-07) auto-creates one; Follow-up Queue (Part 8.6) manages the rest.
- **Feedback:** Timeline gains a Task-category row, amber only when overdue.
- **`[UX REQUIRES BACKEND CAPABILITY]`**: `LeadFollowUp` as a first-class entity is 0% built — today it's approximated via SLA schedules (Doc 08, self-reported). Designed against the target contract (T-07, T-11).

---

## Part 8 · Surface Catalogue

Pattern-application entries — each surface reuses Part 3's grammar and Part 7's workflows rather than inventing new ones. Not full redesigns; the point is a coherent system, not 42 pretty pages.

**8.1 Command Centre** — Purpose: site-wide operational oversight. Users: OPS_MANAGER, BANK_SUPER_ADMIN, MARKETING_MANAGER. Components: KPI summary strip, SLA breach ticker (reuses SLA chip grammar), source funnel, telecaller heatmap. `[UX REQUIRES BACKEND CAPABILITY]`: cached aggregate tables — 0% built.

**8.2 Lead Queue / List** — Purpose: working queue. Users: TELECALLER, SR_TELECALLER, OPS_MANAGER. Reuses CursorTable + StatusBadge/SLAChip/ScoreChip inline. Priority sort, filters (tier/status/site/lang), inline disposition. Core list is designable now (v1 real); saved views are a data-model gap (no `SavedView` entity found anywhere — `[ENGINEERING RECONCILIATION ITEM]`, new).

**8.3 Lead 360** — see Part 6.

**8.4 New Lead / Intake** — Purpose: multi-channel capture. Users: any with `lead.intake`. Reuses form pattern (§9.4), DNC check on save (§7.2's guard), consent capture. Real and running for web/phone/walk-in (v1); WhatsApp intake is currently a signature-verification stub (Doc 08 D-12, self-reported) — the UI must not claim WhatsApp intake is production-hardened.

**8.5 Telecaller Workspace** — Purpose: combined queue + call panel + follow-up dock. Users: TELECALLER, SR_TELECALLER. Reuses Lead 360's Action Panel pattern in miniature, plus a CallDispositionPanel. v1 real but confirmed defective (D-06 IDOR, tight coupling) — RBAC-gated elements here carry the same live-defect caveat as Part 6.2.

**8.6 Follow-up Queue** — Due today / overdue / next 7 days, complete inline. Reuses Task-category timeline row styling for consistency. See §7.8.

**8.7 Counsellor Workspace** — Today's sessions + calendar + notes editor. See §7.6. v1 exists against the single-mutable-booking model only.

**8.8 Counselling Calendar** — Week/month view, slot availability, rebooking. `[UX REQUIRES BACKEND CAPABILITY]`: `counsellorAvailable(slot)` guard (04 §5) exists as a target guard; scheduling-system backing not evidenced.

**8.9 Assignment Centre** — See §7.7.

**8.10 Duplicate Review / DNC** — Duplicate Review: match queue, side-by-side compare, merge action — see §7.3. DNC: search, add, export, bulk remove with authority note — see §7.2. Both 0% built (Doc 08, self-reported): duplicate phones currently create parallel leads unchecked (D-08); DNC list/add/remove itself is real and running.

**8.11 Conversion Centre** — List of qualified leads with convert action + eligibility gate. See §7.4. This is the surface assigned regulatory-forms display (Constitution §22 default) — `[PROPOSED]`, to be confirmed when this surface gets full design attention; not specified further here to avoid inventing form-rendering behaviour beyond what's decided.

**8.12 Campaign Manager** — Campaign CRUD, attribution reports. Users: MARKETING_MANAGER. `[UX REQUIRES BACKEND CAPABILITY]`: 0% built beyond a bare `source` enum.

**8.13 Analytics** — Funnel (source/tier/site), CAC, cohort. `[UX REQUIRES BACKEND CAPABILITY]`: no Lead-specific analytics exist anywhere in the HIS today (Document A confirms only a Finance dashboard and Cycle Outcome Monitor exist elsewhere).

**8.14 SLA Monitor** — Live breaches, at-risk, historical rate. Reuses SLA chip grammar at list scale. Underlying engine is the most currently-real piece of the whole module (`src/lib/sla/engine.ts`, generalized from embryology, self-reported real).

**8.15 CRM Sync Monitor** — Pending queue, failures, retry, external IDs. Reuses CursorTable. `CrmSyncQueue` table + stub adapters exist; real sync behaviour is `[UX REQUIRES BACKEND CAPABILITY]`.

**8.16 Configuration** — Score weights, SLA matrix, retention policy, assignment rules, with version + approval. **Target UX (Founder-confirmed, this pass): single authorised approver**, not a multi-approver workflow. Every configuration change surfaces: current active version, pending-change diff, approval status (`pending`/`approved`/`rejected`), approved-by + approved-at, rejection reason where applicable, and full version history. `[ENGINEERING RECONCILIATION ITEM]`: Doc 08's self-reported "2-approver mandatory" reference remains unreconciled against I-07 (04's single-approver+SoD decision) at the engineering/policy level — that conflict does not change the target UX specified here, which is built for one authorised approver throughout.

**8.17 Audit** — Filterable log per lead/user/action type. Reuses AuditRow, generic pattern already exists elsewhere in HIS (shared hash-chain, module 02) — designable now as a view; full Lead-action coverage is `[PARTIALLY IMPLEMENTED]` (Doc 08, self-reported).

---

## Part 9 · Cross-Cutting Patterns

**9.1 Search** — `[PROPOSED]`: Lead-scoped today, architected to extend to Donors/Recipients/MRD/Inventory/Counselling later, per the original brief. Never claims AI search unless implementation supports it.

**9.2 Filtering / saved views** — Filters: derived from `GET /v2/leads` query params (05 §2.2, real target contract: source, tier, status, outcome, isArchived, personType, siteId, campaignId, from, to, telecallerId). Saved views: no entity exists to persist them — `[ENGINEERING RECONCILIATION ITEM]`, new finding, needs a data-model decision before this can move past design proposal.

**9.3 Tables** — CursorTable is the one table component for all 18 surfaces: cursor pagination (`[DERIVED]`, 05 §1's own contract, never offset-based), bulk actions, inline actions where safe, keyboard nav (`j`/`k`), clear empty/loading/error states.

**9.4 Forms** — `[DERIVED]`: react-hook-form + zod is the actual current v1 pattern, not just a target choice. Validation mode `onChange` (fixes the Aadhaar-persists-error defect, D-03, self-reported) — every Lead form uses this mode, not `onSubmit`.

**9.5 Responsive behaviour** — `[LOCKED]`: desktop-primary/desktop-first. No full mobile Lead product designed. Tablet: workflows remain usable, same layout compressed. Mobile: appropriate responsive degradation only (not a redesigned mobile IA) for accidental phone use; the mobile scanner/PWA concept is explicitly deferred to P2/post-v2.1, not designed here.

**9.6 Accessibility** — `[LOCKED]`: WCAG 2.2 AA. Applied throughout: colour+icon+text pairing (never colour alone), visible focus, semantic structure, 44×44px touch targets, `prefers-reduced-motion` respected, confirmation dialogs focus-trapped and labelled, timeline as a semantic list.

**9.7 Keyboard interaction** — `j`/`k` (timeline/list navigation), `Enter` (activate/expand), `Esc` (collapse/cancel), `g o`/`g t` (jump to section), `a` (trigger primary action), `/` (focus search, shell-owned). `[ENGINEERING RECONCILIATION ITEM]`: collision check against existing portal-shell global shortcuts not yet performed.

**9.8 Performance UX** — Skeleton screens, optimistic UI throughout (§3.15), streaming/paginated exports (current CSV export is real but unpaginated per Doc 08, self-reported — target is streaming). Doc 08's own test-strategy targets (k6: intake p95 < 500ms, queue list p95 < 300ms) are cited as **target performance budgets informing UX patience thresholds** (e.g. when a skeleton should give way to a "taking longer than usual" state), not as verified current performance.

**9.9 Print / export** — Lead 360's pattern (Part 6.3) is canonical: condensed milestone summary, no regulatory forms. Lead does not become the regulatory document workspace (Constitution §22).

**9.10 Privacy / DPDP UX** — `[LOCKED]`, Principle 4: any action touching PII beyond scope requires and records a purpose. Applies to exports, cross-lead comparisons (duplicate review), and any field/section-level access beyond a role's normal scope.

---

## Part 10 · Role UX Matrix (surface-level, high)

| Surface | TELECALLER | SR_TELECALLER | COUNSELLOR | OPS_MANAGER | MARKETING_MGR | CRM_ADMIN | SUPER_ADMIN | MED_DIRECTOR |
|---|---|---|---|---|---|---|---|---|
| Command Centre | — | — | — | Full | Partial | — | Full | Read |
| Lead Queue | Own | Own+pool | Assigned-for-counselling | Full | — | — | Full | Read |
| Lead 360 | Own | Own+pool | Assigned | Full | Read (attribution) | Read (CRM fields) | Full | Read |
| New Lead | If `lead.intake` | Yes | — | Yes | — | — | Yes | — |
| Telecaller Workspace | Full | Full | — | — | — | — | Read | — |
| Follow-up Queue | Own | Own+pool | Own | Full | — | — | Full | Read |
| Counsellor Workspace | — | — | Full | — | — | — | Read | Read |
| Counselling Calendar | — | — | Full | Partial | — | — | Read | Read |
| Assignment Centre | — | Partial | — | Full | — | — | Full | Read |
| Duplicate Review | — | — | — | Full | — | — | Full | Read |
| DNC | Check only | Check only | Check only | Full | — | — | Full | Read |
| Conversion Centre | Own | Own | Own (recipient) | Full | — | — | Full | Read |
| Campaign Manager | — | — | — | — | Full | — | Full | — |
| Analytics | — | — | — | Partial | Full | — | Full | Read |
| SLA Monitor | — | — | — | Full | Partial | — | Full | Read |
| CRM Sync Monitor | — | — | — | — | — | Full | Full | — |
| Configuration | — | — | — | Partial | Partial (score) | Partial (CRM) | Full (+approve) | — |
| Audit | — | — | — | — | — | — | Full | — |

"—" means the surface does not appear in that role's navigation at all (Part 2), not merely a disabled state.

---

## Final Section

**A. UX decisions locked**
Design philosophy, North Star, three speeds, Status/Outcome/Archive separation (as UX baseline on 04's model), destructive-action confirmation, optimistic UI, WCAG 2.2 AA, desktop-primary, max 2 fonts, icon+colour+text pairing, motion restraint, DPDP purpose-capture, zero raw JSON, keyboard-first as philosophy, UX Quality Bar. **Plus, from the Lead 360 Founder decision gate** (full record: `LEAD_360_DESIGN_FREEZE_DELTA.md`): capture-panel resolution for co-equal outcome actions; no forced primary for OPS_MANAGER/SUPER_ADMIN on owner-driven working statuses; combined screen-reader header summary; three-tier rail hierarchy; EXPIRED_AUTO_PURGED redacted display mode; SR_TELECALLER's `lead.reactivate` grant (Part 6.2, corrected).

**B. UX proposals** (not sourced from a locked instruction — open to revision without being an "architecture change")
Single-scroll Lead 360 layout, three-lens navigation model, specific keyboard shortcut set, cross-surface component vocabulary, "one screen, one obvious next action," timeline category groupings (§3.11), Conversion Centre as the regulatory-forms-owning surface.

**C. Engineering reconciliation items** (tracked, not resolved here — carried forward; two items now carry an explicit Founder-directed TARGET UX position from this QA pass, noted where that applies)
Doc 08 vs Lead_v2_1 target-architecture conflicts (archive model) · current implementation vs. target architecture generally · archive implementation migration · existing HIS detail-page layout benchmark (still not performed — Document A doesn't describe layout structure) · portal keyboard-shortcut collision check · Reports colour-system verification · component library choice (shadcn vs. hand-rolled) · **SMS provider** (engineering/vendor-selection level only — UX target is a provider-agnostic `NotificationPort` presentation; Founder-directed provider is SMS-Magic; Doc 08's alternate reference is reconciliation-only, Part 1) · **configuration approval-count** (engineering/policy level only — UX target is single-approver per Founder direction, Part 8.16) · no `SavedView` entity exists anywhere for the saved-views UX proposal (§9.2).

**D. Current implementation gaps** (from `LEAD_BUILD_STATUS_SNAPSHOT.md`, self-reported via Doc 08, not independently verified)
0 of 18 TARGET v2.1 UI surfaces currently have a satisfactory/non-defective implementation scaffold. This does not mean nothing exists today: legacy v1 Admin/Telecaller/Counsellor surfaces are live and handling real traffic, but are confirmed defective or architecturally obsolete in the areas this Master redesigns — admin lead detail renders raw JSON, Telecaller Workspace has an active IDOR, Counsellor Workspace runs against a single-mutable-booking model with no session history. Every entity behind the timeline/follow-up/counselling-history/duplicate/config/notification/analytics/campaign grammar is listed [MISSING]. SLA, DNC (basic), scoring (display), forms validation, and conversion (unsafe) are the only target-relevant pieces genuinely real today, alongside the three legacy v1 surface groups noted above.

**E. Build dependencies** — full 19-row table in the prior UX Architecture Gate reconciliation; summarized per-surface in Part 8 above.

**F. Migration considerations** — Doc 08's own migration principle (additive-first, feature-flagged, M1–M13/C1–C15) governs how these UX patterns should land incrementally; **B01–B06/C1–C15 equivalence remains UNKNOWN**, no mapping found. UX should not assume any particular batch sequence delivers a particular surface by a particular date.

**G. P0/P1/P2 UX implementation priority** (mirrors Doc 08's own backlog framing, applied to UX)
- **P0:** Lead 360 (kills raw JSON, D-02), Telecaller Workspace RBAC-safe rebuild (contingent on IDOR fix), Lead Queue.
- **P1:** Follow-up Queue, Counsellor Workspace + Calendar, Assignment Centre, Duplicate Review, DNC, Conversion Centre.
- **P2:** Command Centre, Campaign Manager, Analytics, SLA Monitor, CRM Sync Monitor, Configuration, Audit.

**H. Definition of Done for Lead UX** (per-surface)
Zero raw JSON · every write optimistic+toast+revalidated · every destructive action confirmed · RBAC presentation matches the role matrix (Part 10) with correct denial behaviour · WCAG 2.2 AA annotations present · empty/loading/error states specified · keyboard navigation works · print/export (where applicable) excludes regulatory forms · every element whose backing capability doesn't exist yet is labelled `[UX REQUIRES BACKEND CAPABILITY]` in the handoff spec.

**I. Design-system candidates that should graduate into HIS-wide components**
StatusBadge/OutcomeBadge pattern (any HIS entity with a status/outcome split could reuse it), Timeline component, CursorTable + saved-views pattern (once the data-model gap closes), ActionPanel RBAC-gating pattern, ConfirmDialog tiering (typed-code vs. single-confirm), semantic design-token structure (Part 4).

**J. Future CRM candidates**
Timeline, CursorTable+saved-views, ActionPanel gating, AttributionTag first/last-touch pattern — all designed with Lead's stated future as a broader CRM ecosystem in mind, not built as standalone-CRM-specific today.

---

*This document does not claim any part of it is implemented, does not alter architecture or code, and does not invent backend capabilities beyond what is labelled `[UX REQUIRES BACKEND CAPABILITY]`. It is the authoritative UX specification for the Lead module, pending final Founder sign-off, and the seed of the broader LifeSeed HIS Design System.*
