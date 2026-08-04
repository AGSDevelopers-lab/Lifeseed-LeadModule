# 03 · Andrology Lab

**Source:** `LifeSeed_ART_Andrology_Lab.html v2.2`

Bank-owned lab. Full pipeline from sample accessioning to cryostorage inventory to dispatch handoff. WHO 6th (2021) + ESHRE + ICMR + NABL 112 compliance.

## Phase map (10 phases)

```
A0 · Sample Accessioning        → LIS entry, donor + collection metadata, QC-A1
A1 · Semen Analysis             → Macro + Micro WHO 6th + Other Cellular, QC-A2
A2 · Advanced Tests             → DFI + MAR + dsDNA + Semen Culture (default ON)
A3 · Sample Decision            → Discard / Reschedule / Proceed (3-way)
A4 · Preparation                → DGC (default) / Swim-up / Direct wash, QC-A3
A5 · Vial Creation              → Tank management + aliquoting + labeling, QC-A4
A6 · Cryopreservation Protocol  → Equilibration + slow LN2 vapor + storage
A7 · 24-hr QC + Router          → Test vial thaw + video/QR/auto-tag, QC-A5, Tank Location Move
A8 · Quarantine (180 days)      → Day-165 recall + Day-180 serology, QC-A6
A9 · Post-Thaw Analysis         → 9 params (all admin-toggleable)
A10 · Post-Thaw Decision        → Sample Summary + Discard/Return
   → Cryostorage Inventory tabular view

Note: former QC-A7 (post-thaw pre-dispense) moved to Dispatch & Fulfillment module
```

## Case flags (orthogonal)

- **Priority (SLA):** REGULAR (default) OR URGENT (queue-jumping)
- **Release-timing:** REGULAR OR QUARANTINE (default for donor semen · 180-day hold per ICMR)

Both flags independent · sample can be URGENT + QUARANTINE.

## 7 QC gates (all admin-toggleable per site)

| Gate | Phase | Fires on | Pass criteria |
|---|---|---|---|
| QC-A1 | A0 | Sample handoff to lab | Container integrity · ID match · time < 30 min · complete ejaculate |
| QC-A2 | A1 | Post-WHO 6th baseline | Volume ≥1.5mL · Conc ≥40M/mL · PR ≥40% · Total ≥50% · Morph ≥4% · Vitality ≥60% |
| QC-A3 | A4 | Post-preparation | Recovery ≥30% of pre-wash · PR ≥60% · no debris |
| QC-A4 | A5 | Pre-cryo aliquot | Final conc/vial ≥ threshold · post-cryomedia motility ≥50% · 2-witness labeling · aliquot count reconciled |
| QC-A5 | A7 | 24hr post-freeze | Post-thaw PR ≥40% of pre-freeze · total motile/vial ≥20M · vitality ≥50% |
| QC-A6 | A8 | Day 180 · Quarantine only | HIV I/II · HBsAg · HCV · VDRL · HTLV · CMV IgM ALL negative (ELISA/CLIA, non-toggleable per ICMR) |
| QC-A7 | (Dispatch) | Pre-dispense (optional) | Post-thaw PR ≥30% · vitality ≥50% · no contamination · matches historical QC-A5 |

## L-A7.2 Post-Thaw Analysis — 9 parameters (admin-toggleable)

Every field on/off per site. Formulas auto-compute.

```
1. Concentration (M/mL)                          [input]
2. Total Sperms in Vial                          [auto = Concentration × Volume per Vial]
3. Rapid Progressive Motility (%)                [input]
4. Slow Progressive Motility (%)                 [input]
5. Progressive Motility (%)                      [auto = Rapid PM + Slow PM]
6. Non-Progressive Motility (%)                  [input]
7. Total Motility (%)                            [auto = Progressive + Non-Progressive]
8. Immotile (%)                                  [auto = 100 − Total Motility]
9. Total Rapid Motile Sperm in Vial              [auto = Total Sperm × Rapid PR ÷ 100]

Optional (admin-configurable):
- Vitality (eosin-nigrosin)                      [triggered if Total Motility < 40%]
- Morphology spot check                          [optional post-thaw sanity check]

Recovery threshold (drives QC-A5): post-thaw PR ≥40% of pre-freeze · total motile/vial ≥20M
```

## Cryostorage Inventory · tabular view

Columns: Sample Id · Donor · Type · Cryo Tank ID · Cryo Tank Name · Canister · Rack · Vials · **Grade** · **Category**

**Grade** (from QC-A5 post-thaw metrics):
- A: post-thaw PR ≥60% of pre-freeze
- B: 50–60%
- C: 40–50% (usable, flagged)
- Below 40%: auto-destroy at QC-A5

**Category** (composite rule — independent of Grade):
- PREMIUM (`PRM` prefix in Sample ID · Premium Dewar)
- STANDARD (`STD` prefix · Main Dewar standard rack)
- ECONOMY (`ECN` prefix · Main Dewar reserve rack)

Composite rule engine (admin-configurable):
```
PREMIUM = Grade A + Donor phenotype top-tier + Premium-package eligible
STANDARD = Grade A or B + Standard/Premium-package eligible
ECONOMY = Grade C OR Basic-package eligible only
```

**Location changeable at both levels:**
- Sample-level: admin edit action with 2-witness log
- Tank-level: admin can re-classify a whole dewar and bulk-relocate

Auto-relocate rule: on QC-A6 pass (Quarantine cleared), sample auto-moves from Quarantine-Dewar to Category-default dewar.

## Personnel roles (from `user_roles_rbac.md`)

TECH (Andrology Tech) · SR-ANDRO (Senior Andrologist) · LAB-HEAD · WITNESS · CRYO (Cryobank Tech) · QC (QC Officer).

One user may hold multiple roles. 2-witness always requires 2 distinct user IDs.

## Key API endpoints

```
POST   /api/samples                        → accession new sample (state: DRAFT)
POST   /api/samples/:id/analyze            → save microscopic + macro (state: ANALYZED)
POST   /api/samples/:id/advanced-tests     → DFI/MAR/dsDNA/culture results
POST   /api/samples/:id/decide             → Discard / Reschedule / Proceed
POST   /api/samples/:id/prep               → preparation done (QC-A3)
POST   /api/samples/:id/vials              → create vials (QC-A4)
POST   /api/samples/:id/cryo               → cryo protocol logged (QC-A5 24hr later)
POST   /api/samples/:id/qc-a5              → 24hr post-thaw check + video/QR
POST   /api/samples/:id/tank-move          → transit → storage tank
POST   /api/samples/:id/quarantine-end     → Day-180 serology + QC-A6
POST   /api/samples/:id/post-thaw          → 9-param analysis
POST   /api/samples/:id/close              → post-thaw decision

POST   /api/tanks                          → tank management CRUD
POST   /api/vials/:id/move                 → change location (2-witness attestation)

GET    /api/inventory                      → Cryostorage Inventory query with filters
GET    /api/inventory/available            → available vials for matching (allocation)
```

## Acceptance criteria

- [ ] Every QC gate is admin-toggleable ON/OFF (except QC-A6 which is ICMR statutory)
- [ ] All 9 post-thaw parameters admin-toggleable individually
- [ ] Formulas auto-compute (Total Sperms, Total Motility, Immotile, Total Rapid Motile) — never editable
- [ ] Sample ID auto-prefixed with PRM/STD/ECN based on Category composite rule
- [ ] Category composite rule editable per site via admin UI
- [ ] Grade and Category tracked independently (Grade downgrade does NOT auto-change Category)
- [ ] 2-witness attestation required at: identity check · labeling · cryo loading · retrieval · dispatch handoff · tank moves
- [ ] Sample-Type Router (Regular vs Quarantine) resolves via precedence: Lab decision > Sample collection flag > Donor intake default
- [ ] Quarantine samples physically segregated in Quarantine-Dewar
- [ ] Day-165 donor recall auto-notification (Donor Portal + SMS)
- [ ] Video capture at L-A7.1 (mandatory test vial) — auto-uploaded + QR-linked + tagged to batch
- [ ] Every write action audit-logged

## Cursor prompts (paste-ready)

```
1. Generate Sample + Vial + CryoTank Prisma models per @data_model.md.
   Include SampleState enum with all 12 states.

2. Build src/app/(portals)/admin/samples/new/page.tsx — Sample Accessioning form
   with donor picker, case flags (Priority + Release-timing), collection metadata.
   Use react-hook-form + zod validation.

3. Build src/app/(portals)/admin/samples/[id]/analyze/page.tsx — Semen Analysis form
   with macro + microscopic (WHO 6th) fields. Auto-compute formulas.
   Video upload widget.

4. Build src/app/(portals)/admin/samples/[id]/qc-a5/page.tsx — 24hr QC page
   with post-thaw test vial thaw + video capture + QR generation + auto-tag to vial record.

5. Build src/app/(portals)/admin/samples/[id]/post-thaw/page.tsx — 9 parameter capture
   with admin-toggle rendering (only show enabled fields).

6. Build src/app/(portals)/admin/cryobank/page.tsx — Cryostorage Inventory table
   with Category column, Grade column, filters, sort, batch actions.

7. Build src/app/(portals)/admin/config/categories/page.tsx — Category Composite Rule editor
   + Category-Location mapping UI.
```
