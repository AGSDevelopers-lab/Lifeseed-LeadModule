# LifeSeed ART Bank — Application Spec Pack

Cursor-ready Markdown specifications for the LifeSeed ART Bank management application. Distilled from the 6 module HTML documents into structured, prompt-optimized specs.

## What's in here

| File | Purpose | Priority |
|---|---|---|
| `README.md` | This file — orientation + how to use | Read first |
| `STACK.md` | Tech stack + folder structure + package.json baseline | Setup |
| `data_model.md` | **All entities + relationships** — Prisma-schema style | **Critical** |
| `user_roles_rbac.md` | 15+ roles + permission matrix across modules | Foundational |
| `01_donor_pathway.md` | Phase 0–4 · DRF Lifecycle · 11 rejection gates | Core |
| `02_portal_architecture.md` | 4 portals · screens · auth flows | Core |
| `03_andrology_lab.md` | 10 phases · 7 QC gates · Cryostorage Inventory | Core |
| `04_embryology_lab.md` | L2 coordination · Cohort tracking · 7 QC gates | Core |
| `05_dispatch_fulfillment.md` | 6 dispatch types · 10-state machine · QR pack · Zoho hooks | Core |
| `06_billing_finance.md` | Multi-GSTIN · Challan → Invoice · Recurring · Dunning | Core |
| `cursor_workflow.md` | Prompt templates + rules for Cursor Composer | Read after Setup |

## How to use these specs in Cursor

### Setup (once)

1. Clone starter repo (Next.js + Supabase + shadcn/ui — see `STACK.md`).
2. Drop this entire `LifeSeed_App_Specs/` folder into the repo root.
3. Add to `.cursorrules` (Cursor auto-loads):
   ```
   Always read data_model.md and user_roles_rbac.md before generating code.
   Reference relevant module spec (01–06) for the current feature.
   Follow patterns in cursor_workflow.md.
   Never generate placeholder data — use the SKU catalogue + example rows from module specs.
   ```
4. Cursor will auto-index `.md` files. You can also explicitly reference via `@filename.md` in Composer.

### Working pattern (per feature)

```
Cursor Composer prompt:
  Build [component/screen/API route] for [feature]
  per @data_model.md and @{module_spec}.md.
  Follow patterns in @cursor_workflow.md.
  Constraints: [any specific need]
```

Break each module into 20–30 small Cursor sessions. Commit after every working session. Do not attempt "build me the entire module in one prompt" — output quality drops sharply beyond ~500 lines.

## Cross-module dependencies (build order)

```
1. Data model + RBAC (foundation for everything)
2. Portal shells (Recipient · Clinic · Donor · Bank Admin)
3. Donor Pathway (DRF Lifecycle drives everything downstream)
4. Andrology Lab (feeds Cryostorage Inventory used by Dispatch)
5. Dispatch & Fulfillment (fires events consumed by Billing)
6. Billing & Finance (consumes Dispatch events + service invoices)
7. Embryology Lab (coordination — lighter build, mostly forms)
```

## Compliance non-negotiables

Every module must satisfy:
- **ART Act 2021** — donor anonymity, cap tracking, national registry sync
- **DPDP Act 2023** — consent capture, purpose limitation, data-subject rights
- **NABL 112 (ISO 15189)** — 2-witness on critical steps, audit trail
- **GST** — multi-GSTIN, IGST/CGST/SGST, e-invoicing (>₹5cr turnover)
- **Aadhaar eSign** — for consent + high-value approvals

Enforce at the framework level (middleware, hooks) — not per-feature. See `cursor_workflow.md` for patterns.

## Source-of-truth documents

Full detailed specs remain in the HTML documents (one folder up):
- `LifeSeed_ART_Donor_Pathway.html` (v3)
- `LifeSeed_ART_Portal_Architecture.html` (v1)
- `LifeSeed_ART_Andrology_Lab.html` (v2.2)
- `LifeSeed_ART_Embryology_Lab.html` (v1)
- `LifeSeed_ART_Dispatch_Fulfillment.html` (v1.1)
- `LifeSeed_ART_Billing_Finance.html` (v1)

When in doubt, HTMLs are the visual source-of-truth. Markdown specs are distilled for Cursor consumption. Keep both in sync if you edit either.
