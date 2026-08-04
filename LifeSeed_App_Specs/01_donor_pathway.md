# 01 · Donor Pathway (DRF Lifecycle)

**Source:** `LifeSeed_ART_Donor_Pathway.html v3`

The pull mechanism for the entire system. Recipient → Clinic → Bank via signed DRF. Donor pipeline runs through 4 phases with 11 rejection gates.

## Actors

Donor (vendor) · Recipient / Commissioning Couple (customer) · IVF Level-2 ART Clinic (referrer + executor) · LifeSeed Bank (middle-tier).

## Phase map

```
Phase 0 · Recipient Intake        → R1–R9 (upstream, triggers DRF)
Phase 1 · Common Trunk (donor)    → R-1, R-2 gates
Phase 2 · Semen Branch            → R-S3, R-S4, R-S5, R-S6 gates + Sample Router
Phase 2 · Oocyte Branch           → R-O3, R-O4, R-O5, R-O6, R-O7 gates + Recipient Hold + L2 Approval
Phase 4 · MRD + Longitudinal      → G-EXIT (ART Act cap) + Cycle Outcome Loop (desired)
```

## DRF Lifecycle state machine

```
Draft → Submitted → Accepted / Rejected → Matching → Match Ready →
  (Profile-select only) Awaiting Recipient Selection →
  Allocated → Dispatched → In-Cycle → Closed (with Outcome) / Closed (No Outcome)

Cancelled reachable from Draft / Submitted / Accepted / Matching / Match Ready / Allocated (pre-dispatch)
```

## Phase 0 · Recipient Intake nodes (build order)

| Node | Owner | Purpose |
|---|---|---|
| R1 · Recipient walks into L2 Clinic | Clinic | Clinical case initiated |
| R2 · Clinical assessment + referral | Clinic | Refer to Bank |
| R3 · Recipient Registration at Bank | Bank (Recipient Portal) | Self OR clinic-invited registration |
| R4 · Package Explainer | Bank | T&Cs, Anonymous vs Profile-select, tier options |
| R5 · Recipient selects package + engines | Bank | Selection captured + engine subs activated |
| R6 · DRF Drafted at Clinic Portal | Clinic | Auto-populated from recipient selection |
| R7 · Doctor digital signature | Clinic (doctor) | ART Act reg # embedded |
| R8 · DRF Submitted to Bank | Clinic → Bank | State: Draft → Submitted |
| R9 · Bank DRF Acceptance Check (Gate DRF-A) | Bank | Clinic ART Act status · completeness · payment terms · sibling pre-check → Accepted or Rejected |

## Phase 1 · Common Donor Trunk

Nodes 1–5 (Registration · Duplicate Check · Contact Validation · Document Verification · Registration Consent) → **Gate R-1 (Post Initial Registration)** → Node 5 (Initial Medical Screening) → **Gate R-2 (Post Initial Medical Screening)** → Branch to Semen or Oocyte.

### Gate reject reason codes (extends)
```
R-1: REG-AGE, REG-MAR, REG-CHILD, OPS-KYC, OPS-DUP, OPS-GEO, WDR-VOL
R-2: MED-INF, MED-ECG, MED-PHY, MED-HX, GEN-HX (may route to Genetic Counselling)
```

## Phase 2 · Semen Branch

```
S1 Andrology Consult → S2 Initial Semen Analysis → [R-S3] → S3 Pre-IVF Blood Panel → [R-S4]
→ Eligibility Board (3-sign) → S4 Donor Passport → S5 Procedure Consent (2nd stage)
→ S6 Working Sample Collection → S7 Cryo + Batch ID → S8 24-hr Freezing Check → [R-S5]
→ Sample-Type Router (Regular / Quarantine)
→ [Quarantine path: 180d + repeat serology] → S9 Released to Allocation Inventory
→ S10 Recipient Match + Sibling Check → S11 Allocation + Bidirectional Tag → S12 Vial Dispensed → [R-S6]
```

**Reject codes:**
```
R-S3: SEM-CNT, SEM-MOT, SEM-MRP, SEM-DFI, SEM-CRY
R-S4: MED-INF, GEN-KAR, GEN-CAR, MED-END, PSY-FAIL
R-S5: SEM-PST, SEM-BQF (destroy batch, donor status = REVIEW)
R-S6: OPS-DSP, AE-REC (no donor-level rejection today; future cap trigger)
```

## Phase 2 · Oocyte Branch

```
O1 Gynae Consult + TVS + hormonal → O2 Initial Scan (Dry/Day 2) → [R-O3]
→ O3 Pre-IVF Blood Panel → [R-O4]
→ Eligibility Board (3-sign) → O4 Donor Passport
→ Donor Type Router (Anonymous / Profile-select)
→ O5 Recipient Matching + Sibling Check → O6 Allocation + Bidirectional Tag
→ Recipient Hold (couple fitness-to-receive)
→ O7 Procedure Consent (2nd stage) → ART Level-2 Clinic Approval for Stim Start
→ O8 Stimulation Protocol → O9 Stim Day 1–5 → [R-O5] → O10 Stim Day 6–10 → [R-O6]
→ O11 Trigger + OPU → O12 Oocyte Count + Grading → [R-O7]
→ O13 Fresh transfer OR Vitrification → O14 Donor Discharge → O15 Case Closure
```

## Phase 4 · MRD + Longitudinal

Cycle Outcome Feedback Loop (desired, not mandatory · auto-nudge at 14/30/90/180 days · auto-close at day 180 as "Closed No Outcome") → MRD Updation → ART Act Registry Sync → Donor Master Update → **G-EXIT (statutory cap check)** → **G-EXIT-B (bank policy cap check, semen, toggle OFF default)** → Quarterly Health Check → Return to Active Pool.

## Cross-cutting services (used by pathway)

- **Consent Module** — library, callable per donor/type/cycle
- **Lab & Genetic Tests Repository (TRF)** — on-demand via DRF from Clinic/Doctor/Recipient
- **Sibling Registry Check** — called at every allocation
- **Genetic Counselling Loop-back** — optional route from any medical/genetic-flag rejection
- **Adverse Event (AE) Flag** — cross-cutting
- **Donor Withdrawal Path** — triggerable at any node post-consent
- **Matching Engine Repository** — per Profile-select case
- **Capped-Use Trigger (Semen)** — configurable per site

## Financial models (per clinic contract, DRF-level override)

- **Model A** — Direct-to-Recipient (Bank invoices recipient)
- **Model B** — Clinic-Markup Wholesale (Bank → Clinic; Clinic → Recipient)
- **Model C** — Hybrid Split (package/engines to recipient; donor material to clinic)

## Key API endpoints

```
POST   /api/drfs                          → create (Draft)
POST   /api/drfs/:id/submit               → Draft → Submitted (clinic doctor sign)
POST   /api/drfs/:id/accept               → Submitted → Accepted (Bank)
POST   /api/drfs/:id/reject               → Submitted → Rejected
POST   /api/drfs/:id/start-matching       → Accepted → Matching
POST   /api/drfs/:id/allocate             → Match Ready → Allocated (writes bidirectional tag)
POST   /api/drfs/:id/dispatch             → Allocated → Dispatched (triggers Dispatch module)
POST   /api/drfs/:id/cycle-start          → Dispatched → In-Cycle
POST   /api/drfs/:id/outcome              → In-Cycle → Closed (with outcome)
POST   /api/drfs/:id/cancel               → any pre-dispatch state → Cancelled

GET    /api/drfs?state=&clinicId=&recipientId=
GET    /api/drfs/:id
```

## Acceptance criteria

- [ ] Only registered L2 clinics can transition DRF from Draft → Submitted
- [ ] Doctor signature required (with ART Act reg # + timestamp) for DRF submission
- [ ] Bank state transitions require appropriate role permission (see `user_roles_rbac.md`)
- [ ] Bidirectional tag written atomically at Allocation (donor ← recipient/couple/cycle; recipient ← donor/selection mode)
- [ ] ART Act 1-donor-1-couple rule enforced at Allocation (oocyte)
- [ ] Cycle outcome auto-nudges scheduled on DRF In-Cycle transition (14/30/90/180 days)
- [ ] Auto-close as "Closed No Outcome" at day 180 if no outcome reported
- [ ] Every state transition emits `crm.state_transition` event
- [ ] All state transitions audit-logged with actor + timestamp + before/after

## Cursor prompts (paste-ready)

```
1. Generate the DrfState enum + Prisma model per @data_model.md
   + state transition service (drfService.ts) enforcing legal transitions
   + emit events on each transition.

2. Build /api/drfs/route.ts + [id]/route.ts + [id]/{submit,accept,reject,allocate,...}/route.ts
   with RBAC checks per @user_roles_rbac.md.

3. Build Recipient Portal screens for R3 (registration), R4 (package explainer),
   R5 (selection wizard) with react-hook-form + zod validation.

4. Build Clinic Portal screens for R6 (DRF Composer), R7 (doctor sign flow),
   DRF Tracker (Kanban view by state).

5. Build Bank Admin screens for DRF Triage Queue (accept/reject with reason codes),
   Matching Engine Console (Anonymous auto-match + Profile-select allocation).
```
