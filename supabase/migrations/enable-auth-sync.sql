-- LifeSeed: sync Supabase Auth users → public."User"
-- Apply in Supabase SQL editor or via: supabase db push / migration run
--
-- Strategy:
-- 1. On auth.users INSERT → upsert public."User" with id = auth.users.id (UUID text)
-- 2. Phone is required + unique on User; use metadata phone or a deterministic placeholder
-- 3. Existing seed users (cuid ids) stay linked by matching email in app getSession()
--    Until you re-seed or remount roles onto the auth UUID row.

create extension if not exists "pgcrypto";

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  v_phone := coalesce(
    nullif(new.phone, ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    'auth-' || replace(new.id::text, '-', '')
  );

  -- Prefer update-by-email so seeded operators keep their UserRoleAssignment rows
  -- when an Auth user is created with the same email.
  update public."User"
  set
    email = new.email,
    phone = case
      when phone like 'auth-%' or phone is null then v_phone
      else phone
    end,
    "isActive" = true
  where email = new.email;

  if found then
    return new;
  end if;

  insert into public."User" (
    id,
    email,
    phone,
    "passwordHash",
    "isActive",
    "mfaEnabled",
    "siteId",
    "clinicId",
    "createdAt",
    "lastLoginAt"
  )
  values (
    new.id::text,
    new.email,
    v_phone,
    null,
    true,
    false,
    null,
    null,
    timezone('utc', now()),
    null
  )
  on conflict (id) do update
  set
    email = excluded.email,
    "isActive" = true;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- Optional: keep email in sync on auth user update
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public."User"
  set email = new.email
  where id = new.id::text
     or email = old.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;

create trigger on_auth_user_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_auth_user_updated();
