# 02 · Portal Architecture

**Source:** `LifeSeed_ART_Portal_Architecture.html v1`

4 portals serving the 4-actor B2B2C model. Each portal is a route group in Next.js App Router (`src/app/(portals)/{portal}/`).

## Portal summary

| Portal | Users | Auth | Tech | Route |
|---|---|---|---|---|
| **Donor** | Donor (+ optional guardian) | Mobile OTP | Next.js PWA (installable) · mobile-first | `/donor` |
| **Recipient** | Recipient (+ partner) | Email/mobile + password + 2FA | Next.js responsive web | `/recipient` |
| **Clinic** | Doctor · Coordinator · Nurse · Admin | Email + MFA (TOTP) | Next.js desktop-primary + tablet | `/clinic` |
| **Bank Admin** | 8 role types | SSO + hardware key OR TOTP + IP allow-list | Next.js desktop only · VPN-gated | `/admin` |

## Screen inventory (per portal)

### Donor Portal (`/donor/**`)
```
/onboarding             - Self-registration (mobile OTP)
/profile                - Own profile + docs
/appointments           - Book / reschedule appointments
/results                - View own test results
/status                 - Current phase / gate outcome
/notifications          - Feed
/consents               - View + e-sign consent library
/financial              - Honorarium ledger + receipts
/documents              - Certificates, donation records
/withdraw               - ART Act withdrawal right (one-tap)
/rights                 - Plain-language ART Act rights
/health-tracker         - Quarterly health check questionnaire
/support                - Help / contact / AE report
```

### Recipient Portal (`/recipient/**`)
```
/onboarding             - Self-register OR clinic-invited
/clinic-link            - Link to current treating clinic
/packages               - Package Explorer (tier comparison)
/select                 - Package + engine selection wizard
/consents               - Consent Center (T&Cs, service, DPDP, ART Act)
/drfs                   - DRF Status Tracker
/profiles               - Profile Browser (Profile-select only, respects photo config)
/selection              - Selection + cooling-off tracker
/cycle-status           - Cycle Status Feed from clinic
/financial              - Invoices, payments, refunds
/documents              - Selection cert, cycle records
/outcome                - Co-report outcome (voluntary)
/support                - Grievance
```

### Clinic Portal (`/clinic/**`)
```
/dashboard              - Multi-recipient dashboard + KPIs
/recipients             - Recipient Registry (own clinic scope)
/drfs/new               - DRF Composer
/drfs                   - DRF Tracker (Kanban by state)
/allocations            - Donor Allocation Viewer
/cycles                 - Cycle Log (per-recipient timeline)
/outcomes               - Outcome Log
/financial              - Bank invoices in + Recipient invoices out
/contracts              - Contracts & Amendments with LifeSeed
/compliance             - ART Act Compliance Dashboard (own clinic)
/doctors                - Doctor ART Act Registration Roster
/users                  - User Management (clinic-scoped)
/api-keys               - API Keys & Webhook Config (tech-forward clinics)
/audit                  - Audit Log (own clinic actions)
```

### Bank Admin (`/admin/**`)
```
/dashboard              - Global dashboard + KPIs + queue depths
/donors                 - Donor Pipeline Kanban (by phase/gate)
/drfs/triage            - DRF Triage Queue
/matching               - Matching Engine Console
/allocations            - Allocation Queue
/cryobank               - Cryostorage Inventory (semen + oocyte lots)
/outcomes               - Cycle Outcome Monitor
/dispatch               - Dispatch Queue (all types)
/billing                - Financial Ledger + Aged Receivables
/subscriptions          - Subscription management
/registry               - National Registry Sync Monitor
/compliance             - ART Act + DPDP + PV compliance dashboards
/config/sites           - Site config (per-site settings)
/config/tiers           - Package Tier Editor
/config/photo           - Photo Config Toggle + legal opinion attach
/config/consents        - Consent Library Editor
/config/trf             - TRF Menu Editor
/config/engines         - Matching Engine Registry
/config/sibling         - Sibling Registry Monitor
/config/categories      - Sample Category Composite Rules
/reports                - Ops / clinical / financial / regulatory
/users                  - User Management (roles, permissions, MFA)
/audit                  - Immutable Audit Log
```

## Auth flow

```typescript
// src/lib/auth.ts
import { createServerClient } from '@supabase/ssr';

export async function getSession() {
  const supabase = createServerClient(/*...*/);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  // Attach LifeSeed user + roles
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true, site: true, clinic: true }
  });
  return { supabase: session, user };
}
```

## Portal routing pattern

```typescript
// src/app/(portals)/layout.tsx  (auth wrapper for all portals)
export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: any }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const portalType = detectPortalFromRoute();
  if (!userCanAccessPortal(session.user, portalType)) redirect('/unauthorized');

  return <PortalShell portal={portalType}>{children}</PortalShell>;
}
```

## Cross-portal data flow (12 flows)

Match `Portal Architecture v1` HTML section — every write emits event to `EventEmission` table. Key flows:

- Clinic → Bank: DRF submission, cycle event, outcome logged
- Recipient → Bank: package selection, donor selection, consent
- Bank → Clinic: allocation confirmed, dispatch initiated
- Bank → Donor: honorarium payment, ART Act §29 pregnancy notification
- Clinic → Recipient (via Bank relay): cycle status update

## Clinic API Bridge (REST + Webhook)

For tech-forward clinics with EMR/HIS. See full spec in Portal Architecture HTML.

**Endpoints:**
```
POST /api/v1/drfs                                   → submit DRF programmatically
GET  /api/v1/drfs/:id                               → status
POST /api/v1/allocations/:id/receipt                → confirm receipt
POST /api/v1/cycles/:drfId/events                   → log cycle event
POST /api/v1/cycles/:drfId/outcome                  → log final outcome
GET  /api/v1/invoices                               → reconciliation
```

**Webhook events (Bank → Clinic):**
```
drf.accepted · drf.rejected · drf.match_ready · drf.awaiting_selection ·
drf.allocated · drf.dispatched · drf.receipt_confirmed · drf.outcome_nudge ·
drf.closed · invoice.raised · donor.status_change
```

## Portal shell components (build once, reuse across 4 portals)

- `<PortalShell>` — sidebar + header + main layout
- `<PortalNav>` — portal-specific nav items
- `<PortalHeader>` — logo + user menu + notifications
- `<PortalBreadcrumb>` — auto from route
- `<RoleGuard>` — hide/show children based on permission
- `<WitnessAttestation>` — modal for 2-witness confirmation
- `<AuditTrail>` — inline audit log viewer per entity
- `<StateBadge>` — colored pill for any state (DRF, Dispatch, Invoice, Sample)

## Deployment recommendations

- **Donor Portal:** PWA (Next.js `manifest.json` + service worker) — mobile-first, no app store needed
- **Recipient Portal:** Responsive web + optional native app (Phase 2)
- **Clinic Portal:** Web + tablet-responsive
- **Bank Admin:** Web desktop only + VPN allow-list (Vercel firewall or Cloudflare Access)

## Cursor prompts (paste-ready)

```
1. Generate the portal route structure per @02_portal_architecture.md
   under src/app/(portals)/{donor,recipient,clinic,admin}/
   with layout.tsx wrapping each in RoleGuard.

2. Build PortalShell + PortalNav + PortalHeader shared components
   with shadcn/ui. Nav items configured per portal.

3. Build /login page + Supabase Auth integration.
   MFA setup flow for Clinic + Admin portals.

4. Build /admin/dashboard as first Bank Admin screen with mock KPI tiles.
```
