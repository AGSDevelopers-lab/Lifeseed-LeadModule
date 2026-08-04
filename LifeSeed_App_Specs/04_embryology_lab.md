# 04 · Embryology Lab

**Source:** `LifeSeed_ART_Embryology_Lab.html v1`

**Architecturally different from Andrology** — per ART Act 2021, oocyte stim + OPU + embryology + transfer are Level-2 IVF Clinic activities. Bank does **not** operate these today. This module captures the Bank's **coordination + tracking** role via Clinic Portal + API. Every phase has a **future-Bank toggle** for post-amendment scenarios.

## Phase map (10 phases · E0–E9)

```
E0 · Pre-cycle Setup             → DRF dispatch → L2 receipt → recipient sync → 2nd-stage consent → L2 approval
E1 · Ovarian Stimulation (L2)    → Baseline scan → stim → serial monitoring → trigger (cross-refs R-O5, R-O6)
E2 · OPU (L2)                    → Pre-OPU prep → TVS-guided retrieval → follicular fluid handoff → discharge checklist
E3 · Oocyte Processing (L2)      → Search + COC assessment + Denudation + MII grading, QC-E1, QC-E2
E4 · Fertilization (L2)          → Method decision (ICSI default) · sperm prep (from Andrology dispatch) · insemination · culture setup
E5 · Culture + Grading           → Day 1 (2PN) QC-E3 · Day 3 QC-E4 · Day 5/6 Gardner QC-E5 · optional PGT QC-E7
E6 · Transfer or Vitrify         → Fresh transfer OR Freeze-all decision node
E7 · Fresh Embryo Transfer (L2)  → ET procedure + luteal support + beta-hCG scheduled
E8 · Vitrification + Storage     → L2 primary storage · future Bank backup · QC-E6
E9 · Cycle Outcome Reporting     → Beta-hCG → Clinical pregnancy → Live birth → DRF close → feeds Pathway v3 Phase 4
```

## 7 QC gates

| Gate | Fires on | Threshold |
|---|---|---|
| QC-E1 | Post-OPU | MII% ≥70% (ESHRE Vienna KPI) · yield ≥80% of follicular count |
| QC-E2 | Post-denudation | Per-oocyte grade recorded · disposition planned |
| QC-E3 | Day-1 fertilization | 2PN rate ≥70% of MII |
| QC-E4 | Day-3 cleavage | ≥90% of 2PN reach Day 3 |
| QC-E5 | Day 5/6 blastocyst | Blast rate ≥40% of 2PN (Vienna KPI) |
| QC-E6 | Vitrification survival | ≥95% warming survival |
| QC-E7 | PGT report (if triggered) | Authenticity + counselling documented |

## Location matrix (12 operations)

```
Operation                          Bank        L1          L2
──────────────────────────────────────────────────────────────
Donor selection + allocation       ✓           future      ✓
Baseline scan + hormonal           future      ✓           ✓
Ovarian stimulation                future      ✓           ✓
Serial monitoring                  future      ✓           ✓
Trigger + OPU                      future      no          ✓
Oocyte processing                  future      no          ✓
Fertilization (IVF/ICSI)           future      no          ✓
Culture (Day 1/3/5)                future      no          ✓
PGT biopsy (optional)              future      no          ✓
Vitrification                      future*     no          ✓
Embryo transfer                    no          no          ✓
Outcome tracking + registry        ✓ mandatory feedback    feedback
```

## Cohort Management

Per-DRF cohort tracked embryo-by-embryo. Cohort survives DRF closure (referenced by later FETs).

Cohort fields: `oocyteId, MII/MI/GV, Day-1 2PN, Day-3 grade, Day-5 Gardner, PGT result, disposition, storage ref`

Dispositions: `CULTURE · VITRIFIED · TRANSFERRED · DISCARDED_ABNORMAL · DISCARDED_ARREST`

## Personnel roles

REP-COORD (Reproductive Coordinator) · IVF-CLIN (IVF Clinician) · EMBRYO (Embryologist) · SR-EMBRYO (Senior) · LAB-HEAD · WITNESS · BANK-COORD · QC

All L2-side roles except BANK-COORD (which is bank-side tracking).

## Cycle outcome loop (into Pathway v3 Phase 4)

Feedback is **desired, not mandatory** (per Pathway v3 decision). Auto-nudges from Bank at Day 14 / 30 / 90 / 180 post-transfer. Auto-close as "Closed No Outcome" at day 180 if no feedback.

## Future-Bank toggles (admin config)

All OFF by default in v1. Activate when ART Act permits:
- Bank-side stimulation + monitoring
- Bank-side OPU
- Bank-side embryology
- Bank backup embryo storage

## Vienna KPI thresholds (editable per L2 clinic)

```
Fertilization rate (2PN / MII)          ≥70% (LifeSeed target)
Cleavage rate (Day 3 / 2PN)             ≥90%
Blastocyst rate (Day 5-6 / 2PN)         ≥50%
Good blastocyst rate (Gardner ≥3BB)     ≥40%
Vitrification survival                  ≥95%
Implantation rate per embryo            ≥40%
```

## Key API endpoints (Bank-side tracking)

```
POST   /api/embryology/cycles/:drfId/start           → E0.5 · DRF In-Cycle
POST   /api/embryology/cycles/:drfId/stim-event      → E1 stim monitoring events
POST   /api/embryology/cycles/:drfId/opu             → E2 OPU completed
POST   /api/embryology/cycles/:drfId/oocytes         → E3 oocyte count + grades
POST   /api/embryology/cycles/:drfId/fertilization   → E4 fertilization method + sperm source
POST   /api/embryology/cycles/:drfId/day1-check      → E5 QC-E3 fertilization check
POST   /api/embryology/cycles/:drfId/day3-grade      → E5 QC-E4 cleavage grade
POST   /api/embryology/cycles/:drfId/day5-grade      → E5 QC-E5 blastocyst grade
POST   /api/embryology/cycles/:drfId/pgt-result      → E5 QC-E7 PGT results
POST   /api/embryology/cycles/:drfId/transfer        → E7 transfer done
POST   /api/embryology/cycles/:drfId/vitrify         → E8 vitrification + storage
POST   /api/embryology/cycles/:drfId/beta-hcg        → E9 result
POST   /api/embryology/cycles/:drfId/pregnancy       → E9 clinical pregnancy
POST   /api/embryology/cycles/:drfId/live-birth      → E9 live birth outcome (triggers DRF close)
```

Most of these are called from **Clinic Portal** (L2 clinicians logging events) or **Clinic API bridge** (tech-forward clinics with EMR/HIS pushing events).

## Acceptance criteria

- [ ] Every phase carries `location` field (L2 clinic today; future-Bank toggle)
- [ ] EmbryoCohort auto-created on DRF In-Cycle transition
- [ ] Each embryo tracked individually with full lineage (oocyte → day-1 → day-3 → day-5 → disposition)
- [ ] Cohort survives DRF closure (for later FETs)
- [ ] All 7 QC gates configurable per L2 clinic
- [ ] Vienna KPI thresholds editable per L2 clinic
- [ ] Auto-nudge scheduler for outcome feedback (14/30/90/180 days)
- [ ] Outcome feedback auto-triggers Pathway v3 Phase 4 MRD update
- [ ] Every clinical event logged via Clinic Portal OR API bridge with clinic-user attribution
- [ ] 2-witness attestation on: OPU procedure · fertilization · vitrification labeling · embryo transfer

## Cursor prompts (paste-ready)

```
1. Generate EmbryoCohort + Embryo Prisma models per @data_model.md.

2. Build src/app/(portals)/clinic/cycles/[drfId]/page.tsx — Cycle Log timeline view
   showing all events per DRF. Chronological + filter by event type.

3. Build src/app/(portals)/clinic/cycles/[drfId]/log-event/page.tsx — event log form
   with event type selector + role-appropriate fields (stim event, OPU, fertilization, etc.)

4. Build src/app/(portals)/clinic/cohorts/[drfId]/page.tsx — Cohort Management
   tabular view per embryo with Gardner grade + disposition editor.

5. Build src/app/(portals)/admin/outcomes/page.tsx — Cycle Outcome Monitor for Bank
   with feedback rate KPI per clinic + auto-nudge queue view.

6. Build outcome-nudge scheduler (cron job) — checks DRFs In-Cycle state
   and emits reminders at Day 14/30/90/180. Auto-close at 180 if no outcome.
```
