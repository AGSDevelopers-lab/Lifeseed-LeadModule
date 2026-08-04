# Tech Stack + Repo Structure

Bootstrap-friendly stack chosen for solo-founder-with-AI build. Every choice optimizes for: (1) code ownership + portability, (2) Cursor productivity, (3) production-defensibility, (4) cost.

## Stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend framework** | Next.js 16.3+ (App Router) + TypeScript | Full-stack in one repo · SSR + API routes · huge Cursor training data |
| **UI components** | shadcn/ui + Tailwind CSS | Copy-paste components you own · matches HTML spec look-and-feel |
| **Forms + Validation** | react-hook-form + zod | Type-safe forms · schema-first validation matches data_model.md |
| **Database** | Postgres via Supabase (managed) | Free tier for dev · migrate to self-host anytime · Row-Level Security |
| **ORM** | Prisma 6 | Type-safe · migrations · matches Cursor-friendly schema syntax · `url`/`directUrl` in schema |
| **Auth** | Supabase Auth OR Clerk | Multi-tenant · RBAC-ready · Aadhaar-eSign integrable |
| **File Storage** | Supabase Storage (dev) · migrate to S3 later | Videos (QC-A5), QR assets, PDF challans, e-sign docs |
| **Payments** | Razorpay SDK (already registered) | Cards / UPI / Netbanking / EMI · Subscriptions API |
| **Payment fallback** | PayU (later) | Redundancy for outage |
| **SMS + WhatsApp** | Twilio + Gupshup / Interakt | Dunning reminders · dispatch notifications · consent OTP |
| **Email** | Resend | Transactional email · templates · low cost |
| **PDF generation** | @react-pdf/renderer OR puppeteer | Challan · Invoice · Consent forms |
| **Barcode / QR** | qrcode.react + zxing-js/library (scanning) | Vial barcodes · QR pack |
| **State management** | Zustand + React Query | Simple + Cursor-friendly · avoid Redux overhead |
| **Deploy** | Vercel (Next.js) OR Render (fuller control) | Both support Postgres · Vercel edge functions for webhooks |
| **CI/CD** | GitHub Actions | Free tier · standard Cursor / Claude output-compatible |

## Repo folder structure

```
lifeseed-app/
├── .cursorrules                    # Cursor's project rules
├── .env.local                      # Secrets (never commit)
├── prisma/
│   └── schema.prisma               # From data_model.md
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # Login, signup, MFA
│   │   ├── (portals)/
│   │   │   ├── donor/              # Donor Portal
│   │   │   ├── recipient/          # Recipient Portal
│   │   │   ├── clinic/             # Clinic Portal
│   │   │   └── admin/              # Bank Admin (SetuAI)
│   │   ├── api/
│   │   │   ├── donors/             # Donor CRUD + gates
│   │   │   ├── drfs/               # DRF Lifecycle
│   │   │   ├── samples/            # Andrology / Cryostorage
│   │   │   ├── dispatches/         # Dispatch state machine
│   │   │   ├── billing/            # Challans + Invoices + Payments
│   │   │   ├── webhooks/
│   │   │   │   ├── razorpay/       # Payment webhooks
│   │   │   │   └── couriers/       # Blue Dart / Delhivery tracking
│   │   │   └── events/             # Internal event bus
│   │   └── layout.tsx
│   ├── components/                 # shadcn + custom
│   │   ├── ui/                     # shadcn primitives
│   │   ├── donor/                  # Module-specific components
│   │   ├── dispatch/
│   │   ├── billing/
│   │   └── shared/                 # Navbar, sidebar, common
│   ├── lib/
│   │   ├── db.ts                   # Prisma client
│   │   ├── auth.ts                 # Auth helpers
│   │   ├── rbac.ts                 # Role check middleware
│   │   ├── audit.ts                # Audit log middleware
│   │   ├── events.ts               # Event bus (Zoho adapter ready)
│   │   ├── gst.ts                  # GST computation helpers
│   │   └── razorpay.ts             # Payment integration
│   ├── hooks/                      # Custom React hooks
│   └── types/                      # Shared TypeScript types
├── public/                         # Static assets, logo, favicon
├── LifeSeed_App_Specs/             # This spec pack
│   ├── README.md
│   ├── data_model.md
│   └── ...
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── README.md
```

## package.json baseline

```json
{
  "name": "lifeseed-app",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "next": "16.3.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "typescript": "^5.4.0",
    "@prisma/client": "^6.0.0",
    "prisma": "^6.0.0",
    "@supabase/supabase-js": "^2.43.0",
    "@supabase/ssr": "^0.3.0",
    "tailwindcss": "^4.0.0",
    "react-hook-form": "^7.51.0",
    "zod": "^3.23.0",
    "@hookform/resolvers": "^3.4.0",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.36.0",
    "razorpay": "^2.9.0",
    "resend": "^3.2.0",
    "@react-pdf/renderer": "^3.4.0",
    "qrcode.react": "^3.1.0",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.383.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/react": "^19.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "16.3.0"
  }
}
```

## Env variables baseline

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database
DATABASE_URL=
DIRECT_URL=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=

# SMS / WhatsApp
GUPSHUP_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=

# Future — Zoho (v1.1)
ZOHO_BOOKS_ORG_ID=
ZOHO_BOOKS_CLIENT_ID=
ZOHO_BOOKS_CLIENT_SECRET=
ZOHO_BOOKS_REFRESH_TOKEN=
```

## Estimated monthly infrastructure cost (MVP)

| Service | Cost |
|---|---|
| Cursor Pro (1 user) | ~₹1,700/mo ($20) |
| Claude API (via Cursor) | ~₹4,000–17,000/mo depending on volume |
| Supabase Pro | ~₹2,100/mo ($25) |
| Vercel Pro (or Render) | ~₹1,700/mo ($20) |
| Domain + Resend + Gupshup starter | ~₹2,000/mo |
| **Total** | **~₹11,500–24,500/mo** |

Well within bootstrap budget. Scale up hosting when pilot clinics onboard.

## First-day setup checklist

- [ ] Create GitHub repo `lifeseed-app` (private)
- [ ] Install Cursor + configure with Claude Sonnet (Pro tier)
- [ ] `npx create-next-app@latest lifeseed-app --typescript --tailwind --app`
- [ ] `npx shadcn-ui@latest init`
- [ ] Set up Supabase project · get keys · add to `.env.local`
- [ ] Set up Razorpay test keys · add to `.env.local`
- [ ] Copy `LifeSeed_App_Specs/` folder into repo root
- [ ] Add `.cursorrules` file with content from `README.md` above
- [ ] Create initial `prisma/schema.prisma` from `data_model.md`
- [ ] `npm run db:push`
- [ ] Commit + push to GitHub
- [ ] First Cursor Composer prompt: "Scaffold the login page + auth flow per @data_model.md + @user_roles_rbac.md"
