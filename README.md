# LifeSeed ART Bank

Next.js 16 App Router application for LifeSeed ART Bank operations (donor pathway, labs, dispatch, billing) with Supabase Auth + Prisma RBAC.

## Getting Started

```bash
npm install
cp .env.example .env.local
# fill Supabase + DATABASE_URL values
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to `/login`.

## Auth setup

LifeSeed uses **Supabase Auth** for identity and **Prisma `User` + `UserRoleAssignment`** for RBAC.

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Copy **Project URL** and **anon / publishable key** into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server-only; never expose to browser
DATABASE_URL=postgresql://...                     # Supabase pooled connection string
DIRECT_URL=postgresql://...                       # Supabase direct connection (migrations)
```

3. In Supabase Dashboard → **Authentication** → **URL configuration**, add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - your production `/auth/callback`

### 2. Create an Auth user

1. Dashboard → **Authentication** → **Users** → **Add user**.
2. Use email + password (or magic link later).
3. For local seed operators, create Auth users whose **emails match** seeded Prisma users, e.g.:
   - `superadmin@lifeseed.local`
   - `sr.andrologist.wb@lifeseed.local`
   - `doctor.kolkata-ivf@lifeseed.local`

`getSession()` links Auth → Prisma by **auth user id** first, then by **email** (so seed `cuid` users keep their role assignments until you remount roles onto UUID rows).

**Optional remount (id = auth UUID):** do **not** run a bare

```sql
UPDATE "User" SET id = '<paste-auth-user-uuid>' WHERE email = 'superadmin@lifeseed.local';
```

That breaks (or orphans) `UserRoleAssignment` / `AuditLog` FKs. Use the transactional script instead:

[`supabase/migrations/remount-user-id-to-auth-uuid.sql`](supabase/migrations/remount-user-id-to-auth-uuid.sql)

Replace `<paste-auth-user-uuid>` (all occurrences) with the Auth user UUID and adjust the email if remounting a different operator.

### 3. Enable Auth → `public."User"` sync trigger

Run the SQL migration in the Supabase SQL editor (or via Supabase CLI):

[`supabase/migrations/enable-auth-sync.sql`](supabase/migrations/enable-auth-sync.sql)

What it does:

- On `auth.users` **INSERT**, upserts into `public."User"` with `id = auth.users.id`.
- If a Prisma user already exists with the same email (seeded), it **updates that row** so existing `UserRoleAssignment` rows remain valid.
- Phone is filled from Auth metadata or a deterministic `auth-…` placeholder (User.phone is unique + required).

### 4. Assign roles

After sign-in as a user with `BANK_SUPER_ADMIN`:

1. Open `/admin/users`.
2. Use **Assign Role** to create `UserRoleAssignment` rows (audited as `role.assigned`).
3. Or rely on `npx prisma db seed` for the baseline matrix.

### 5. Smoke-test

```bash
curl http://localhost:3000/api/health
# → { "status": "ok", "db": true, "timestamp": "..." }
```

Sign in at `/login` → `/portal` (auto-redirect if single portal) → portal home.

## Stack notes

- Next.js 16 · Prisma 6 · Postgres (Supabase) · `@supabase/ssr`
- Money fields: `Decimal(19,4)`
- All mutating API routes must call `requirePermission()` and emit audit events via `audit.log()` / Prisma audit extension

## Learn More

- Specs: `LifeSeed_App_Specs/`
- RBAC: `LifeSeed_App_Specs/user_roles_rbac.md`
- Data model: `LifeSeed_App_Specs/data_model.md`
