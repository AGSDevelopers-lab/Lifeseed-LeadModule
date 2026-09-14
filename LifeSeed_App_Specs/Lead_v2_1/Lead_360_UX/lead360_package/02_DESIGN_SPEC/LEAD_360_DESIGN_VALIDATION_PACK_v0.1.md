# LEAD 360 — DESIGN VALIDATION PACK v0.1
### Status: **Superseded by the Founder decision gate** — items B.1/B.2 below (and this document's closing verdict) are resolved in `LEAD_360_DESIGN_FREEZE_DELTA.md`, which is the current source of truth on readiness. This document is retained as the validation record that produced those decisions and is not rewritten here. Companion documents: `LEAD_360_ACTION_RESOLUTION_MATRIX.md`, `LEAD_360_WIREFRAME_SPEC_v0.1.md`. Together these three plus the frozen `07_LEAD_UI_UX_DESIGN_MASTER.md` and `LEAD_360_VISUAL_DESIGN_SPEC_v0.1.md` are the complete Lead 360 design package.
### Covers items 3–10 of the validation gate. Items 1–2 are the companion documents above.

---

## 3 · The 68/32 Layout — Tested, Not Frozen

Evaluated 60/40, 65/35, 68/32, 70/30 against five criteria. `[PROPOSED]` throughout — this is design judgement, not architecture.

| Ratio | Timeline readability | Action Panel usability | Quick Facts density | Tablet degradation | Wide desktop behaviour |
|---|---|---|---|---|---|
| **60/40** | Timeline rows feel comfortable but the rail's extra width doesn't earn its keep — rail cards have more horizontal space than their content (chips, short labels) needs, producing visible dead space inside each card. | Action Panel gains no real usability from the extra width — buttons don't need to be wider. | Quick Facts becomes noticeably sparse-looking at 40%, fields wrap less but look under-filled. | Collapses fine (rail-below-main per Part 3, Visual Spec) — ratio only matters above tablet. | At wide desktop, 40% of a widened viewport becomes excessive — rail would need its own max-width clamp on top of the ratio, adding a second rule to maintain. |
| **65/35** | Slightly better than 60/40, still some rail dead space. | Same. | Same, marginally less sparse. | Same. | Same clamp problem, smaller magnitude. |
| **68/32** (`[PROPOSED]` original) | Timeline rows read as a well-proportioned "main content" column without feeling cramped — this is the ratio where the main column first starts to feel like the primary reading surface rather than sharing top billing with the rail. | Rail cards (chip-sized content: badges, short labels, 2–3 line summaries) fit their content closely at 32% — least dead space of the four options tested. | Quick Facts fields fit without excessive wrap or excessive empty space — the best-fitting option for genuinely short field values (phone, site, language). | Same collapse behaviour as all four — ratio is irrelevant below tablet. | Still needs a wide-desktop max-width clamp, but the clamp is smaller (32% of a very wide viewport is closer to the rail's natural content width than 40% would be). |
| **70/30** | Marginal further gain in main-column breathing room, but rail cards start to feel slightly tight for the Counselling/Duplicate summary cards specifically, which carry more text than the simpler chips. | Slightly tighter than 68/32 for the two content-heavier conditional cards. | Marginal. | Same. | Same, marginal further improvement in clamp magnitude. |

**Recommended baseline: 68/32.** The reasoning that matters most: rail content is inherently *chip-and-short-label* content (SLA, Score, Ownership, Attribution are all single-line-or-two), and 68/32 is the point where that content stops floating in excess whitespace without yet crowding the two content-heavier conditional cards (Counselling summary, Duplicate/Merge summary). 70/30 is close behind and would be the fallback if, once the Counselling/Duplicate cards are actually built, they need more room than 32% comfortably gives — this is a real risk worth naming, not dismissing: those two cards are the ones most likely to force a re-test once real content lengths are known (`[ENGINEERING RECONCILIATION ITEM — new, design-side]`: the actual text length of a Counselling-chain summary or a Duplicate-compare summary hasn't been drafted in full, so this ratio recommendation carries residual uncertainty pending that content). **68/32 is recommended as the design baseline, not frozen as an absolute measurement** — a wide-desktop max-width clamp on the rail is required regardless of which ratio is chosen.

---

## 4 · Right-Rail Density Test

Eight candidate cards: Action Panel, Quick Facts, SLA, Score, Ownership, Attribution, Counselling, Duplicate/Merge. Goal: "Ferrari dashboard underneath" without "dashboard clutter" (Constitution §6, Master Part 1 avoid-list).

**Finding:** eight separate bordered cards, all always the same visual weight, is the clutter failure mode the brief warns against — even though only 4–6 are ever visible at once (Counselling/Duplicate are conditional), a rail that *looks* like a stack of eight interchangeable boxes reads as a dashboard, not an instrument panel with a point of view.

**Recommended rail hierarchy (`[PROPOSED]`), three tiers instead of eight flat cards:**

1. **Tier 1 — Action** (own visual treatment, not a "card" among cards): Action Panel sits at the top, visually distinct from the informational cards below it — it's the one region of the rail that *does* something, and should not share a border style with regions that only *display* something.
2. **Tier 2 — Operational facts, grouped into one combined card** (not four): SLA + Score + Ownership + Attribution merge into a single "At a glance" card with four compact rows/chips inside it, rather than four separate bordered boxes. These four are read together in practice (a telecaller checking "where does this stand operationally" wants all four in one glance, not four card-borders to visually parse), and they're structurally similar in weight (all Derived chips, §3.6–3.9 of the Master) — grouping them is the direct mechanism against clutter without losing any information.
3. **Tier 3 — Conditional context cards, kept separate:** Quick Facts, Counselling summary, Duplicate/Merge summary stay as their own distinct cards, because each is content-heavier and topically distinct enough (static intake data vs. a booking chain vs. a duplicate-comparison state) that merging them would force an awkward internal sub-heading structure inside one card instead of three clean ones.

**Resulting rail, top to bottom:** Action Panel (own treatment) → At-a-glance card (SLA/Score/Ownership/Attribution combined) → Quick Facts → Counselling summary (conditional) → Duplicate/Merge summary (conditional) → audit-trail link (text, not a card). This takes the rail from eight potential card-borders down to a maximum of five, with the busiest four facts absorbed into one glanceable card rather than four bordered repetitions of the same visual pattern. **This is a change from the flat eight-card listing implied in the Master's Part 6.1 layout description — the Master should be updated to reflect this tiering in its next revision, flagged here rather than silently redrawn into the frozen v0.1.**

---

## 5 · Visual Component Anatomy

Seventeen components. No hex values. Each: Purpose / Hierarchy / Content / Interaction / States / Accessibility / Appears / Disappears.

### Identity Header
- **Purpose:** answer "who is this" instantly — the anchor fact everything else attaches to.
- **Hierarchy:** largest text on the page; Lead Code precedes Name (read-aloud order).
- **Content:** Lead Code (mono, click-to-copy), full name.
- **Interaction:** click-to-copy on the code only.
- **States:** default; copy-confirmed (brief inline check/toast); skeleton on load.
- **Accessibility:** code and name both real text (never an image), copy action has an accessible label ("Copy lead code"), copy confirmation announced to screen readers (`aria-live=polite`).
- **Appears:** always, every status. **Disappears:** never (redacted-record mode, §14 Action Resolution Matrix, shows Lead Code alone — name blanks, header itself persists).

### Status Badge
- **Purpose:** the single most load-bearing glance-tier fact — where the lead is right now.
- **Hierarchy:** second-largest element, filled treatment (heaviest badge style on the page).
- **Content:** icon + colour + status text (never colour alone, `[LOCKED]`).
- **Interaction:** none — never directly editable (04's non-negotiable rule).
- **States:** one per status-category (New/Working/Interim/Terminal-positive/Terminal-negative/Terminal-retention); skeleton on load.
- **Accessibility:** rendered as real text with an accessible name equal to the visible label; category communicated by icon+text, not colour alone; sufficient contrast in both themes.
- **Appears:** always. **Disappears:** never.

### Outcome Badge
- **Purpose:** communicate the terminal result, once one exists — kept structurally separate from Status (§3.3, Master).
- **Hierarchy:** outline treatment — deliberately lighter than Status.
- **Content:** WON / LOST / EXPIRED / MERGED, text-only (no icon needed — the outline treatment is itself the differentiator from Status).
- **Interaction:** none.
- **States:** exists / does not exist (no placeholder dash state — this is a binary appears/doesn't).
- **Accessibility:** same text/contrast requirements as Status Badge.
- **Appears:** only once `Lead.outcome` is non-null (terminal transition or merge). **Disappears:** never once set (outcome is one-way).

### Tier-at-capture
- **Purpose:** static intake-time value snapshot — explicitly not current state.
- **Hierarchy:** the quietest badge on the page (muted/secondary weight, §4 Visual Spec).
- **Content:** tier word ("HOT"/"WARM"/"COLD"), label reads "Current Tier," never "Tier at capture."
- **Interaction:** tooltip/info affordance explaining it doesn't update.
- **States:** static — no interactive states beyond hover-for-tooltip.
- **Accessibility:** tooltip content also reachable via focus (keyboard), not hover-only.
- **Appears:** always, every status. **Disappears:** never (persists even post-conversion, deliberately, to fix the D-05 "Tier stays COLD after CONVERTED" confusion by making clear it's a snapshot, not a live field).

### Archive Banner
- **Purpose:** communicate a structural filing fact, kept separate from urgency alerts (§3.4).
- **Hierarchy:** full-width, own row above the alert stack — not louder than Status, differently shaped.
- **Content:** icon + "Archived — filed by {user}, {date}, reason: {reason}."
- **Interaction:** none itself (the Unarchive/Reactivate action lives in the primary-action slot, not inside the banner).
- **States:** present / absent only.
- **Accessibility:** announced via `aria-live=polite` on appearance if reached via a live status change (not on initial page load, to avoid noisy load announcements); real text, not an icon-only badge.
- **Appears:** `isArchived=true`. **Disappears:** on unarchive.

### Alert Banner (DNC / Duplicate / SLA breach)
- **Purpose:** urgency-ordered, independently-triggered facts that need attention before or alongside normal action.
- **Hierarchy:** stacked below the Archive banner, ordered structural-first/urgency-last (DNC → Duplicate → SLA breach — §3.10).
- **Content:** icon + one-line plain-language statement +, where applicable, one relevant action link ("Review duplicates").
- **Interaction:** the embedded action link only; the banner itself doesn't dismiss (these are facts, not notifications to clear).
- **States:** 0–4 simultaneously present (practically 0–3, §I of the Wireframe Spec); each independent.
- **Accessibility:** `aria-live=polite` on live appearance; colour+icon+text, risk-tier colour reserved for genuinely risk-tier banners (DNC/Duplicate/SLA) per the semantic-colour rule.
- **Appears:** condition-specific (DNC-listed / open DuplicateCase / SLA breached). **Disappears:** condition resolved.

### Primary Action
- **Purpose:** the single resolved "what do I do next," per the Action Model.
- **Hierarchy:** highest-emphasis interactive element on the page, fixed position (top-right of header block) regardless of which action it currently is.
- **Content:** one verb-led label ("Record disposition," "Book counselling," "Reactivate"…).
- **Interaction:** click/Enter/`a` shortcut; consequential actions (§3.15, Master) route through confirmation first.
- **States:** default/hover/focus/pressed/loading(pending)/success/failure — full matrix in Visual Spec Part 5; **absent entirely** (not disabled) when no action resolves (Action Resolution Matrix's No-action statuses).
- **Accessibility:** real `<button>` semantics, accessible name matches visible label, focus-visible ring always present, minimum 44×44px target.
- **Appears:** whenever the Action Model resolves one candidate. **Disappears:** No-action states, or when the role has no candidate action at all.

### Secondary Action
- **Purpose:** every other permitted, guard-passing action at this status.
- **Hierarchy:** lower emphasis than Primary, never competing for the same visual weight.
- **Content:** verb-led label, same convention as Primary.
- **Interaction:** same mechanics as Primary at smaller scale; denied-but-relevant renders disabled-with-reason (Part 4, Visual Spec) unless disclosure would leak scope, in which case omitted.
- **States:** same set as Primary.
- **Accessibility:** same requirements as Primary.
- **Appears:** per role/status/guard resolution (Action Resolution Matrix). **Disappears:** when no longer permitted or when the guard/condition no longer applies.

### SLA Chip
- **Purpose:** time-pressure fact, one of the four "At a glance" operational facts (§4 above).
- **Hierarchy:** compact chip, three-state visual escalation (on-track/near-breach/breached).
- **Content:** colour + shape + explicit text ("22m remaining" / "BREACHED" — never colour alone, `[LOCKED]`).
- **Interaction:** none itself (the breach condition drives the separate Alert Banner, not a click on the chip).
- **States:** on-track (rounded/neutral) → near-breach (angular/bordered/warning-icon) → breached (solid/alert/explicit text).
- **Accessibility:** text label always present regardless of visual state; sufficient contrast in the solid/breached state especially.
- **Appears:** whenever an active SLA schedule exists for the lead. **Disappears:** SLA completed/cancelled (e.g. on disposition, or at terminal states — 04 I-13, no LEAD_RESPONSE SLA survives a terminal-state lead).

### Score Chip
- **Purpose:** numeric lead quality + trend, one of the four "At a glance" facts.
- **Content:** numeric value + tier word + trend arrow.
- **Interaction:** none itself; expandable to score-breakdown detail is a rail-card-level expand, not the chip.
- **States:** up (bluish-green-family, never a risk tone) / down (neutral-family, never a risk tone, §3.7) / flat.
- **Accessibility:** trend communicated with an accessible label ("Score trending up"), not the arrow glyph alone.
- **Appears:** whenever `LeadScore` exists (from intake onward). **Disappears:** never once created.

### Ownership Chip
- **Purpose:** current owner, one of the four "At a glance" facts.
- **Content:** owner name (or "Unassigned"), clickable.
- **Interaction:** click expands assignment history inline — never a navigation away (§3.8).
- **States:** default; expanded; skeleton.
- **Accessibility:** expand/collapse communicated via `aria-expanded`, keyboard-operable (Enter/Space).
- **Appears:** always, every status (shows "Unassigned" rather than disappearing at NEW). **Disappears:** never.

### Attribution block
- **Purpose:** first-touch (immutable) + last-touch (editable), one of the four "At a glance" facts.
- **Content:** two distinct rows once both exist — first-touch with a locked-icon affordance, last-touch editable — never merged into one "source" field once both exist.
- **Interaction:** last-touch only is editable (where permitted); first-touch is read-only, its locked icon communicating why.
- **States:** first-touch-only (early lifecycle) vs. both-present.
- **Accessibility:** locked-icon has an accessible label ("First-touch attribution — locked"), not icon-only.
- **Appears:** first-touch from intake; last-touch once a subsequent touch is recorded. **Disappears:** never once present.

### Timeline row
- **Purpose:** the Investigation-tier record, one union of nine source tables (§3.11, Master).
- **Hierarchy:** category-based visual weight (Milestone heaviest → Contact lightest, §4 Visual Spec) — not per-individual-subtype.
- **Content:** icon + one-line summary + relative time (collapsed); expands in place for full detail — never a modal.
- **Interaction:** click/Enter expands; `j`/`k` keyboard navigation between rows.
- **States:** collapsed/expanded/skeleton/new-rows-available indicator (rather than silent insertion, Visual Spec Part 5).
- **Accessibility:** timeline rendered as a semantic list (`<ul>`/`<li>` or ARIA equivalent), each row keyboard-focusable, expand state communicated via `aria-expanded`.
- **Appears:** one row per source-table event, progressively as each category's backing table ships (`[UX REQUIRES BACKEND CAPABILITY]` for 7 of 9 categories today, per the Build Status Snapshot). **Disappears:** never (append-only history).

### Counselling chain
- **Purpose:** condensed Booked→Attended/No-show→Outcome state, visually grouped rather than three unrelated rows.
- **Content:** chained mini-timeline within the rail card, current stage highlighted.
- **Interaction:** expands to the full detail view (session notes, recommendation).
- **States:** booked-only / attended-pending-outcome / outcome-recorded / no-show / cancelled-rescheduled.
- **Accessibility:** the chain communicated as an ordered sequence to assistive tech (not purely visual left-to-right positioning).
- **Appears:** `personType=RECIPIENT` with a booking. **Disappears:** never once a booking history exists (persists even if a later booking supersedes an earlier cancelled one).

### Duplicate summary
- **Purpose:** surface an open or resolved `DuplicateCase` without leaving Lead 360.
- **Content:** match confidence, matched lead's code, review status.
- **Interaction:** expands to full side-by-side compare (full compare/merge action gated to OPS_MANAGER+; read-only preview for other roles).
- **States:** open-unresolved / resolved-kept-separate / resolved-merged (this lead as winner or loser — different framing, §7.3).
- **Accessibility:** compare view keyboard-navigable, not drag/mouse-only.
- **Appears:** `DuplicateCase` exists referencing this lead. **Disappears:** never fully (resolved cases remain visible as history, in a quieter treatment).

### Action Panel
- **Purpose:** the expanded, own-region restatement of Primary + Secondary actions with guard explanations.
- **Hierarchy:** Tier 1 in the rail hierarchy (§4 above) — visually distinct from the informational cards.
- **Content:** action list, each with its enabled/disabled-with-reason state.
- **Interaction:** same as the header's primary/secondary buttons (this is a detail view of the same action set, not a duplicate control surface with independent state).
- **States:** populated / whole-panel denial message (Action Model rule 6) / skeleton.
- **Accessibility:** each action item has the same button/disabled semantics as the header actions; whole-panel denial message uses live-region announcement only on state change, not on load.
- **Appears:** always. **Disappears:** never (the whole-panel denial message is itself content, not an absence).

### Quick Facts region
- **Purpose:** static intake "who/what/where" that doesn't change through the lifecycle.
- **Content:** contact, source channel, site, language, consent status.
- **Interaction:** none (read-only display; the one PATCH-able subset — address/notes/preferredLanguage per 05 §2.2 — routes through the standard edit-limited form pattern, §9.4, not inline-editing inside this card).
- **States:** populated / redacted (EXPIRED_AUTO_PURGED mode, §14 Action Resolution Matrix — fields show "not available — record redacted").
- **Accessibility:** field/value pairs use proper label association, not visual-only alignment.
- **Appears:** always. **Disappears:** never (redacted mode replaces content, not the region).

---

## 6 · Visual State Scenarios

Fifteen states. `WHAT USER SEES FIRST` = the Glance-tier read. `WHAT USER SHOULD DO NEXT` = the resolved primary action (Action Resolution Matrix). `WHAT USER CAN INVESTIGATE` = Investigation-tier content specific to that state.

| # | State | Sees first | Should do next | Can investigate |
|---|---|---|---|---|
| 1 | Fresh NEW | Status=NEW, no owner, SLA countdown | Assign (OPS_MANAGER/SUPER_ADMIN); Hidden page for others | Intake source, attribution, consent captured |
| 2 | Contacted + qualified | Status=CONTACTED_QUALIFIED, Tier | Convert donor / Book counselling (branch by personType) | Call record, qualification timing vs. SLA |
| 3 | Callback requested | Status + upcoming callback context | Record disposition (2 valid outcomes) | Original disposition reason, follow-up SLA |
| 4 | Not reachable | Status + attempt context | Record disposition (2 valid outcomes) — repeat-attempt gap noted (§6, Action Resolution Matrix) | Prior attempt history |
| 5 | DNC | Status=DO_NOT_CALL + DNC banner | None — awaiting auto-close | Which disposition triggered DNC, by whom |
| 6 | Counselling booked | Status + slot date/time | Record session outcome; (Reschedule)/(Cancel) | Booking history, reminder delivery log |
| 7 | Counselling attended | Status, awaiting outcome | Record outcome | Session notes once captured |
| 8 | Counselling no-show | Status + attempt count | Rebook (if attempts remain) or disabled-with-reason | No-show history, reminder delivery |
| 9 | Conversion-ready donor | Status=CONTACTED_QUALIFIED, personType=DONOR | Convert donor (± supervisor confirmation) | Eligibility guard detail, required-fields checklist |
| 10 | Conversion-ready recipient | Status=COUNSELLING_ATTENDED, recommendation captured | Convert recipient | Counselling outcome detail |
| 11 | Duplicate flagged | Status + duplicate banner | Normal status action (most roles) / Review duplicate (OPS_MANAGER+) | Matched lead's summary, match confidence |
| 12 | Archived | Status unchanged + Archive banner | Unarchive (permitted roles) / none (others) | Archive reason, who/when |
| 13 | Converted | Status=CONVERTED + Outcome=WON | None — terminal | Full conversion trail, created-record link |
| 14 | Lost | Status=LOST + Outcome=LOST | Reactivate (if ≤90d, permitted roles) or disabled-with-reason | LOST timing, original disposition chain |
| 15 | SLA breached | Status + SLA banner + solid/alert chip | Unchanged status action, now urgent | Full SLA timeline (warn→near-breach→breach) |

---

## 7 · Telecaller Test — Primary Workflow Simulation

**Simulated path:** Open Lead → understand Lead → call → record disposition → schedule follow-up → continue to next Lead.

1. **Open Lead** — from Lead Queue (Part 8.2, Master), click a row → navigates to Lead 360. *1 navigation change.*
2. **Understand Lead** — header (Glance, ~2s: Status, Tier, SLA) + Quick Facts (Action, ~5–10s: phone, language, site) — **0 additional navigation**, both are above-the-fold on the same screen reached in step 1.
3. **Call** — happens outside the browser (phone system) or via an embedded dialer if one exists (`[UX REQUIRES BACKEND CAPABILITY]` — no telephony integration confirmed in any source document) — **0 navigation change within Lead 360 itself**, though this is the one step this spec cannot fully account for without knowing the actual call mechanism.
4. **Record disposition** — click the single primary action → `CallDispositionPanel` opens **in place** (drawer/inline, never a route change per the avoid-modal-heavy-workflow rule, though the panel itself is closer to a lightweight overlay than a full page — this is *not* a full-screen modal, consistent with "modal-heavy workflow" being on the avoid list while the five genuinely consequential confirmations, §3.13, remain the only true modals) → select outcome → confirm (only for the DNC/destructive-adjacent outcomes; ordinary outcomes like "qualified" proceed on click, §7.1 Master) → optimistic UI updates the header immediately. *0 navigation changes, 1 primary decision (which outcome), 0–1 confirmation depending on outcome.*
5. **Schedule follow-up** — only relevant if the outcome was `disposition_callback` (T-07), in which case the follow-up is **auto-created as a side effect of step 4** — no separate action needed (Action Resolution Matrix §5). For any other outcome, "schedule follow-up" is an optional Pattern-4 action reachable from the same screen without navigating away.
6. **Continue to next Lead** — return to Lead Queue: either a "back to queue" affordance or, if the Queue itself uses `j`/`k` navigation with Lead 360 reachable inline (an alternative worth naming), the next lead could be reached without a full page reload. **This spec recommends (`[PROPOSED]`) a "next lead in queue" navigation shortcut directly from Lead 360's header** — not yet named in the Master, and not something a source document dictates, so flagged as a new proposal rather than assumed.

**Totals for the common-case path (non-callback outcome, no confirmation-requiring outcome):**
- **Navigation changes:** 2 (Queue → Lead 360, Lead 360 → back to Queue or next lead).
- **Primary decisions:** 1 (which disposition outcome).
- **Expected keyboard path:** arrive at Queue → `j`/`k` to select row → `Enter` to open → (call happens) → `a` to trigger primary action → arrow keys/number keys to pick outcome in the panel → `Enter` to confirm → (if next-lead shortcut exists) a single key to advance.
- **Cognitive friction points identified:**
  1. The call-mechanism gap (step 3) is a real unknown — if dialing requires leaving the browser entirely, the "minimum context switching" goal is only partially achievable and depends on infrastructure outside this design's control. `[ENGINEERING RECONCILIATION ITEM — new]`.
  2. If the "next lead" shortcut (step 6) is *not* built, every lead-to-lead cycle costs a full navigation back to the Queue and a re-scan of the list — the single biggest avoidable friction point in the whole loop for a high-volume telecaller. Recommended as a P0/P1 candidate for the Queue+360 pairing specifically.
  3. TELECALLER's supervisor-confirmation step on Convert-donor (Action Resolution Matrix §3) adds a context switch (waiting on a supervisor) that SR_TELECALLER doesn't have — worth surfacing to Ops as a throughput consideration, not a UX defect to fix in this layer.

---

## 8 · 2-Second / 10-Second / Investigation Test

Condensed from §6's table — restated in the exact three-question form requested. Any state that fails is flagged inline.

- **NEW (OPS_MANAGER):** 2s — "unassigned, needs a telecaller, {SLA} left." 10s — "I can assign it." Investigate — intake source/consent. **Pass.**
- **ASSIGNED (TELECALLER):** 2s — "mine, working, {tier}." 10s — "I call, then record what happened." Investigate — nothing yet (new lead). **Pass.**
- **CONTACTED_QUALIFIED:** 2s — "qualified, {tier}, {donor/recipient}." 10s — "convert or book counselling, one obvious button." Investigate — call record. **Pass.**
- **CONTACTED_NOT_INTERESTED / WRONG_NUMBER / DO_NOT_CALL (interim, no-action):** 2s — "closed pending auto-expiry, or DNC-blocked." 10s — "nothing to do — correctly nothing to do." Investigate — why it closed. **Pass, by design** — these are meant to fail the "what can I do" question in favour of "why is there nothing to do," which the whole-panel denial pattern (§3.12) makes into a clear answer rather than a confusing blank.
- **COUNSELLING_BOOKED:** 2s — "booked, {date/time}." 10s — "record the outcome once it happens, or reschedule/cancel now." Investigate — booking history. **Pass.**
- **COUNSELLING_ATTENDED:** 2s — "attended, outcome pending." 10s — "record outcome." Investigate — none yet. **Pass.**
- **COUNSELLING_NO_SHOW:** 2s — "no-show, attempt {n} of 3." 10s — "rebook, or it's about to auto-close." Investigate — prior no-shows. **Pass.**
- **CONVERTED / LOST (no reactivation) / EXPIRED_AUTO_PURGED:** 2s — "terminal, {outcome}." 10s — "nothing (Converted/Expired) or reactivate if eligible (Lost)." Investigate — full trail (except Expired, which is largely redacted). **Pass for Converted/Lost. `[FLAGGED]` for EXPIRED_AUTO_PURGED**: the 10-second question ("what can I do") technically passes (correctly "nothing"), but the *2-second* question risks failing without the redacted-mode treatment recommended in the Action Resolution Matrix §14 — an un-adapted Lead 360 showing mostly-empty Quick Facts fields would read as a broken page, not a deliberately redacted one, at the 2-second glance. This is exactly why that redacted display mode is being flagged as required, not optional.
- **Archived (any status):** 2s — "archived, {reason}, still {underlying status}." 10s — "unarchive, or nothing if not permitted." Investigate — archive history + underlying status's own trail. **Pass**, contingent on the Archive banner rendering above the fold consistently (confirmed in the Wireframe Spec).
- **DNC:** 2s — "blocked from contact." 10s — "nothing — correctly nothing." Investigate — DNC origin. **Pass.**
- **Duplicate flagged (any status):** 2s — "possible duplicate, plus whatever the underlying status shows." 10s — "review duplicate (if permitted) or proceed with normal action." Investigate — matched lead detail. **Pass.**
- **SLA breached (any status):** 2s — "breached by {time}, plus underlying status." 10s — unchanged from underlying status, now urgent. Investigate — full SLA history. **Pass.**

**Overall: 14 of 15 states pass cleanly; 1 (EXPIRED_AUTO_PURGED) passes conditionally on the redacted-display-mode recommendation being adopted** — already carried into the Engineering/Design findings list below.

---

## 9 · Accessibility Check (WCAG 2.2 AA design requirements — not a compliance certification)

| Area | Requirement identified | Where enforced in this design |
|---|---|---|
| **Colour dependency** | No fact ever conveyed by colour alone | Status/SLA/Outcome all pair icon+colour+text (`[LOCKED]`, Constitution §14); semantic-colour-only rule (§4, Visual Spec) prevents decorative colour from acquiring accidental meaning |
| **Contrast** | Text and meaningful icons meet AA contrast in both themes, including the solid/breached SLA state and disabled-action text | Token system (Master Part 4) must define both light/dark values meeting this — not yet value-verified (Reports-module dependency, carried) |
| **Keyboard navigation** | Every interactive element reachable and operable via keyboard alone | `j`/`k` timeline nav, `Enter`/`Esc` patterns, `a` primary-action shortcut (§9.7, Master) — collision check against portal shell still outstanding (`[ENGINEERING RECONCILIATION ITEM]`, carried) |
| **Focus** | Visible focus ring on every interactive element, never suppressed | `[LOCKED]`, Master Part 4/9.6 — applies to badges-that-expand, chips, buttons, timeline rows, dialog contents |
| **Target sizes** | Minimum 44×44px touch targets | Stated at Primary Action and generally in §5 above; needs explicit confirmation on the smallest interactive elements (timeline row expand affordance, Ownership/Attribution chip click targets) — flagged as a build-time check, not resolved by this design pass alone |
| **Semantic hierarchy** | Real heading/list/button semantics, not visual-only structure | Timeline as semantic list; Status/Outcome/Archive as real text, not images; Action Panel items as real buttons |
| **Screen-reader interpretation** | Every glance-tier fact has an accessible-name equivalent to its visual meaning | Covered per-component in §5 above; the one open question is whether the *combination* (Status + Outcome + Tier + Archive read together) needs a single summarizing landmark/label for screen-reader users doing their own "glance" — `[DESIGN DECISION REQUIRED]`, not resolved here: should there be a single `aria-label` summarizing header state for assistive tech, distinct from reading each badge individually? Recommended yes, exact wording not specified. |
| **Alerts** | Live-region announcement without noisy load-time spam | `aria-live=polite` on state *changes*, explicitly not on initial page load (§5 above, Archive/Alert banner) |
| **Status changes** | Optimistic UI + pending/confirmed states (§3.15, Master) must be perceivable non-visually too | Loading/pending state needs an accessible equivalent (e.g. `aria-busy`) on the primary action during the consequential-tier pending window, not just a visual spinner — flagged as a build-time requirement |
| **Dynamic timeline updates** | New rows don't silently rearrange content under an active reader | "New rows available" indicator (§5 above) rather than silent insertion — this protects keyboard/screen-reader users mid-read as much as sighted users mid-scroll |
| **Dialogs** | Focus-trapped, labelled, restore focus on close | `[LOCKED]`, Master §9.6 — applies to all five consequential confirmations |
| **Disabled actions** | Never silent — always paired with an accessible reason | Disabled-with-reason pattern (Constitution RBAC principle) — reason text must be programmatically associated with the control (`aria-describedby`), not just visually adjacent |

**Not claimed:** formal WCAG 2.2 AA compliance certification. These are design requirements for engineering to build against and for an actual audit to verify once implemented.

---

## 10 · Final Design Gate

### A. Design decisions sufficiently mature for implementation
Page anatomy and region layout (Visual Spec Part 1); Glance/Action/Investigation content split (Part 2); the Action Model's precedence order for Archive/Duplicate/DNC (Part 6, cross-checked against the full state machine in the Action Resolution Matrix); the 14-status × role action resolution itself, except the two flagged `[DESIGN DECISION REQUIRED]` items; all ten wireframe scenarios; the 68/32 layout recommendation (with the named residual uncertainty); the tiered rail hierarchy; the 17-component anatomy; the accessibility requirement set.

### B. Design decisions still requiring Founder input
1. Disposition/session-outcome capture: single panel vs. N independent buttons (Action Resolution Matrix Part 4, item 1).
2. OPS_MANAGER/SUPER_ADMIN default posture on owner-driven working statuses: no forced primary vs. Reassign-as-default (item 2).
3. Whether a single summarizing `aria-label` should exist for the header's combined state, for screen-reader users (§9 above).
4. The rail-tiering change (§4) and EXPIRED_AUTO_PURGED redacted mode (Action Resolution Matrix §14) are both recommended additions to the frozen Master — confirm before the next Master revision incorporates them.
5. The SR_TELECALLER `lead.reactivate` correction (Action Resolution Matrix, Part 5 item 6) — confirm before the Master's RBAC table is corrected.

### C. Engineering reconciliation items (consolidated from both companion documents, not re-resolved here)
CONTACTED_QUALIFIED has no exit besides its two forward transitions · NOT_REACHABLE has no modeled repeat-attempt logging · DO_NOT_CALL removal isn't reconciled with status recovery · `counselling.reschedule`/`counselling.cancel` have no matrix row · §2 vs §3 internal contradiction in 04 on terminal-state archive eligibility · SR_TELECALLER's `lead.reactivate` grant, uncaptured in the Master · the actual call/telephony mechanism is unconfirmed by any source document · Counselling/Duplicate rail-card content lengths are undrafted (affects the 68/32 recommendation's confidence) · every item already carried from the Master/Constitution (archive model, SMS provider — resolved at UX level, config approval — resolved at UX level, HIS layout benchmark, keyboard-shortcut collision, Reports colour verification, component library choice, SavedView entity).

### D. UX risks
- **Rail-card content-length risk** (§3): the layout ratio recommendation is built on an estimate of how much text the Counselling/Duplicate cards will actually carry — a real risk of needing to revisit 68/32 once that content is drafted in full.
- **Telephony-integration risk** (§7): the single biggest unresolved variable in the actual telecaller loop is outside this design's visibility — if calling requires leaving the browser, "minimum context switching" is only partially deliverable regardless of how well Lead 360 itself is designed.
- **"Next lead" navigation risk** (§7): if not built, the Queue↔360 loop costs a full navigation per lead — flagged as a likely-high-value, currently-undesigned addition.
- **Two open `[DESIGN DECISION REQUIRED]` items** (B.1, B.2) are both foundational to the Action Panel's actual rendering — implementation of the Action Panel component itself should not start until at least B.1 is resolved, since it changes whether the panel is a single-action-with-submenu or a ranked list.

### E. Recommended implementation sequence
1. Resolve B.1 and B.2 (Founder decisions) — both gate the Action Panel component's basic shape.
2. Build the Lead 360 shell (header, banner stack, two-column layout at 68/32) against a lead in ASSIGNED status only (scenario A) — the simplest, most-real case, to validate the anatomy before layering conditionals.
3. Layer in the No-action pattern (scenario J) and the Archive/DNC/Duplicate overlays (scenarios C/D/E/I) — these are the Action Model's precedence logic made visible, and are the highest-value scenarios to get right early since every other status inherits their pattern.
4. Layer in the Counselling chain and Conversion states (scenarios F/G) once `CounsellingSession`/`LeadConversion` backing exists per the Build Status Snapshot.
5. Build the redacted EXPIRED_AUTO_PURGED mode last — lowest-frequency real-world case, but should not be skipped (§8's flagged 2-second-test risk).

### DESIGN READINESS: **NOT READY FOR CURSOR**
Two `[DESIGN DECISION REQUIRED]` items (B.1, B.2) are load-bearing for the Action Panel's fundamental shape and are not yet resolved — building against either unstated assumption risks a rebuild once you decide. Everything else in this validation pack is implementation-ready. Recommended next step: resolve B.1/B.2 (a short decision, not another design pass), after which this gate can be re-declared READY without redoing the rest of the pack.
