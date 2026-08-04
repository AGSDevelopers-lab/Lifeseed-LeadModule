# Cursor Workflow · Battle-tested Patterns

Rules + prompt templates + anti-patterns for building LifeSeed app in Cursor with maximum output quality and minimum tokens spent.

## The `.cursorrules` file (paste into repo root)

```
# LifeSeed ART Bank Application

## Context loading (always)
- Read data_model.md and user_roles_rbac.md before generating any code
- For any feature, reference the relevant module spec (01–06) in LifeSeed_App_Specs/

## Stack
- Next.js 16.3+ (App Router) + TypeScript strict mode
- Prisma + Postgres (Supabase-hosted)
- Supabase Auth (multi-tenant + RBAC via ROLE_PERMISSIONS)
- shadcn/ui + Tailwind CSS
- react-hook-form + zod for all forms
- Zustand for client state · React Query for server state

## Coding conventions
- No `any` types — use `unknown` + narrow, or generate proper types from Prisma
- All API routes return typed Response
- All API routes call requirePermission() from src/lib/rbac.ts
- All Prisma writes go through auditLog middleware
- All state transitions use dedicated state machine service (not inline updates)
- All money values in Prisma Decimal (@db.Decimal(19,4)) · display formatting at UI layer
- All timestamps in UTC · convert to IST for display
- All IDs are cuid · never expose auto-incrementing IDs in URLs

## Naming
- API routes: /api/{resource}/[id]/{action}/route.ts
- Prisma models: PascalCase singular (Donor, DRF, Invoice)
- Enums: SCREAMING_SNAKE_CASE
- React components: PascalCase functional components in .tsx
- Client hooks: useXxx pattern

## Never do these
- Never generate placeholder / mock data — use SKU catalogue + example rows from specs
- Never call Prisma directly from components — always through /api routes
- Never bypass requirePermission() checks
- Never skip the auditLog middleware
- Never hardcode business rule thresholds — read from admin config
- Never render raw error messages to users — always through structured error handler

## Compliance non-negotiables
- ART Act 2021 · DPDP Act 2023 · NABL 112 · GST · Aadhaar eSign
- 2-witness attestation on critical operations (labeling, cryo loading, dispatch, tank moves)
- Immutable audit trail with cryptographic hash chain
- PII (Aadhaar) hashed at rest · masked in display

## When adding new features
- Check the module spec first · confirm you're following the state machine
- Update prisma/schema.prisma migration files (not raw SQL)
- Add corresponding tests where possible
- Emit events to EventEmission table for cross-module notifications
```

## The 10 Cursor patterns you'll use most

### Pattern 1 · Generate a Prisma model from spec

```
Prompt to Cursor Composer:
"Add Sample and Vial models to prisma/schema.prisma per @data_model.md.
Include all fields with correct types, enums, indexes, and relations.
Add migration."
```

### Pattern 2 · Generate an API route

```
Prompt:
"Build src/app/api/samples/route.ts (GET + POST) per @03_andrology_lab.md.
POST creates Sample in DRAFT state — requires BANK_ANDROLOGY_TECH role.
GET returns paginated samples with filters (state, donorId, sampleType, priority).
Follow patterns in @cursor_workflow.md. Type everything strictly."
```

### Pattern 3 · Generate a state transition service

```
Prompt:
"Create src/lib/dispatch/stateMachine.ts per @05_dispatch_fulfillment.md.
Export transitionDispatch(id, newState, actorUserId, context) function.
Validate legal transitions (Draft→Booked, Packed→In-Transit, Delivered→Received, etc.).
Emit event to EventEmission table on success. Throw typed errors on invalid transitions."
```

### Pattern 4 · Generate a form component

```
Prompt:
"Build src/app/(portals)/admin/samples/new/page.tsx — Sample Accessioning form per @03_andrology_lab.md L-A0.
Use react-hook-form + zod. Fields: donor picker (search by DonorID), Priority (Regular/Urgent),
Release-timing (Regular/Quarantine), collection date/time, abstinence days (2-7 validation),
collection method, collection location (optional), notes.
Show 2-witness attestation modal before Create Sample.
Post to /api/samples."
```

### Pattern 5 · Generate a table view

```
Prompt:
"Build src/app/(portals)/admin/cryobank/page.tsx — Cryostorage Inventory
per @03_andrology_lab.md. Table columns: Sample Id (with PRM/STD/ECN prefix highlighted),
Donor, Type, Tank, Canister, Rack, Vials, Grade (badge), Category (pill).
Use TanStack Table. Filters for Category, Grade, Tank. Action menu per row: View, Move Location, Discard.
Server-side pagination via /api/inventory."
```

### Pattern 6 · Generate a state Kanban

```
Prompt:
"Build src/app/(portals)/admin/dispatch/page.tsx — Dispatch Queue Kanban per @05_dispatch_fulfillment.md.
Group cards by state (Draft, Booked, Picked, Packed, In-Transit, Delivered, Received, Used, Closed).
Card shows: Dispatch #, Type badge, Vials/Donor, Clinic, Courier + tracking, ETA.
Card click opens dispatch detail. State transitions via drag-drop (with role check).
Use dnd-kit."
```

### Pattern 7 · Generate a webhook consumer

```
Prompt:
"Build src/app/api/webhooks/razorpay/route.ts per @06_billing_finance.md.
Verify HMAC-SHA256 signature using RAZORPAY_WEBHOOK_SECRET env var.
Handle events: payment.captured, payment.failed, payment.authorized, refund.processed.
On payment.captured: create Payment record + trigger reconciliation match.
Return 200 on success, 400 on invalid signature, 500 on processing error."
```

### Pattern 8 · Generate a scheduler / cron

```
Prompt:
"Build src/app/api/cron/dunning/route.ts per @06_billing_finance.md Phase B8.
Runs daily via Vercel cron. Queries Invoice records where state=ISSUED and dueDate is
Due-3, Due-day, Due+7, Due+15, Due+30, Due+60, Due+90. For each, send appropriate
reminder via Gupshup (WhatsApp) + Resend (email). At Due+15, trigger dispatch hold event.
Log every reminder sent to AuditLog."
```

### Pattern 9 · Generate a computed / derived value UI

```
Prompt:
"Build the L-A7.2 Post-Thaw Analysis form per @03_andrology_lab.md.
9 parameters with 5 auto-computed (Total Sperms, Progressive Motility, Total Motility,
Immotile, Total Rapid Motile Sperm). Show only admin-enabled fields (check /api/config/andrology/post-thaw).
Auto-compute fields update on input change (react-hook-form watch).
Submit to /api/samples/[id]/post-thaw."
```

### Pattern 10 · Generate an event emitter + consumer stub

```
Prompt:
"Add event emission pattern per @data_model.md EventEmission model.
Create src/lib/events.ts with emitEvent(name, payload, targetSystem) function.
Persist to EventEmission table with consumerStatus=PENDING.
Add background worker src/lib/workers/zoho-adapter.ts that polls PENDING events
and marks CONSUMED (stub for v1 · real Zoho consumer in v1.1)."
```

## Anti-patterns to avoid

**Anti-pattern 1 · "Build me the entire module" mega-prompt**
Bad: "Build the entire Andrology Lab module."
Why bad: 5000+ lines of output · quality craters · you can't review · debugging nightmare.
Better: Break into 20-30 small prompts (models · service · API routes · forms · tables · specific screens).

**Anti-pattern 2 · Re-pasting entire spec every prompt**
Bad: Paste all of @03_andrology_lab.md contents into every Cursor message.
Why bad: Wastes tokens massively (10-100× more than needed).
Better: Reference via `@03_andrology_lab.md` — Cursor auto-loads it. Only quote specific sections when directly relevant.

**Anti-pattern 3 · Debating architecture in Cursor**
Bad: "Should I use REST or GraphQL? What's better?"
Why bad: Wastes coding tokens on debate that's already resolved in the specs.
Better: Architecture is locked in `STACK.md`. Cursor executes it. Debate in Claude conversation (this one).

**Anti-pattern 4 · Not committing between prompts**
Bad: 3 prompts in, everything works, keep going, then 5th prompt breaks it all.
Why bad: Can't rollback without redoing manual work.
Better: `git commit` after every working Cursor output. Cheap safety net.

**Anti-pattern 5 · Skipping the specs**
Bad: "Build a login page."
Why bad: Cursor invents fields, roles, permissions inconsistent with the actual model.
Better: "Build the login page per @user_roles_rbac.md and @02_portal_architecture.md · Supabase Auth · MFA required for CLINIC and BANK_ADMIN portals."

## Build sequence (16-week rough plan for solo-founder)

```
Week 1-2   · Setup + scaffolding
             - Cursor + repo + Next.js scaffold + Supabase + Razorpay test keys
             - Copy LifeSeed_App_Specs/ into repo · configure .cursorrules
             - Generate Prisma schema from data_model.md
             - Generate RBAC skeleton
             - Login + auth flow (all 4 portals)

Week 3-4   · User + Master Data + Portal shells
             - User Config module (create user · assign roles · MFA setup)
             - Sites · Clinics · Recipients · Donors CRUD
             - Portal shells (Donor · Recipient · Clinic · Bank Admin) with route guards
             - Basic dashboards (KPI tiles · empty state)

Week 5-8   · Donor Pathway (biggest priority)
             - DRF state machine service + API routes
             - Phase 0 Recipient Intake screens
             - Phase 1 Common Trunk screens (registration · duplicate check · consent)
             - Phase 2 Branch screens (Semen + Oocyte)
             - Phase 4 MRD + outcome reporting
             - Cross-cutting: Consent Module · TRF · Sibling Check

Week 9-11  · Andrology Lab
             - Sample models + state machine
             - Sample Accessioning (A0) + Semen Analysis (A1) forms
             - Advanced Tests (A2) form
             - Sample Decision (A3) 3-way branch
             - Preparation (A4) + Vial Creation (A5) + QC gates
             - 24hr QC (A7) + Tank Location Move
             - Quarantine (A8) + Day-180 serology
             - Post-Thaw Analysis (A9) with 9 params
             - Cryostorage Inventory with Category composite rule

Week 12-13 · Dispatch & Fulfillment
             - DispatchOrder + state machine
             - 6 dispatch type flows
             - Cold-chain courier vendor management + webhook consumers
             - 5-QR pack generator
             - Reverse-tagging for untagged bulk

Week 14-15 · Billing & Finance
             - SKU catalogue
             - Challan → Invoice auto-conversion (from Dispatch events)
             - Razorpay integration + webhook consumer
             - Refund rule engine
             - Recurring subscriptions
             - Dunning workflow
             - Financial reports (P&L · AR · Collections)

Week 16    · Embryology tracking + compliance polish + pilot deploy
             - Embryology Cohort Management (lighter build - mostly forms)
             - Audit trail cryptographic chain
             - Aadhaar eSign integration
             - DPDP consent flows polish
             - Basic OWASP hardening
             - Deploy to Vercel · onboard 1-2 pilot clinics
```

## Token efficiency micro-tips

1. **Small prompts beat big prompts** — 20 × 500-token prompts produce better code than 1 × 10,000-token prompt
2. **`@file` beats pasting file contents** — Cursor auto-loads referenced files with efficient context
3. **Commit between prompts** — enables `git diff` reviews without re-generation
4. **Cursor Composer > Chat** for multi-file changes — Composer edits files directly, saves token exchange
5. **Save prompt templates** — common patterns (CRUD table, state machine, webhook) are reused; keep a `.prompts/` folder
6. **Use `edit` on existing files, not `rewrite`** — Cursor's edit mode diffs vs full rewrite
7. **Break big models into feature-focused chunks** — don't ask Cursor to touch 20 files in one prompt
8. **Reject-and-refine** is cheaper than "make it perfect first try" — 2 short iterations beat 1 long attempt

## When to escalate out of Cursor

- **Architecture decisions** — take to Claude conversation (this one) OR Zoom whiteboard with fractional CTO
- **Security review** — human review before shipping anything auth/payments/PII-related
- **Regulatory compliance validation** — CA / compliance consultant review before go-live
- **Complex debugging that Cursor can't solve in 3 attempts** — step back, sketch on paper, or bring in senior dev

## Emergent salvage

If you have partial work in Emergent worth preserving:
- **Salvage:** UI wireframes / mockups (screenshot them, use as visual reference for Cursor prompts)
- **Salvage:** any working data model definitions (translate to Prisma format for `data_model.md`)
- **Do NOT salvage:** Emergent-generated business logic (rebuild in Cursor with type-safety)
- **Do NOT salvage:** Emergent-generated auth (rebuild with Supabase Auth per `STACK.md`)
- **Screenshot everything** before you abandon the Emergent build — visual memory is useful

Time budget for salvage: 4-6 hours max. Beyond that, faster to rebuild from specs.
