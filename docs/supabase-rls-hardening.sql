-- Supabase RLS hardening for Terminal PRO.
-- Review and apply manually in a controlled release window.
-- This file does not delete data. It tightens Data API access and enables
-- defense-in-depth policies for user-owned rows.

-- RLS must be enabled on every table in the exposed public schema.
alter table if exists public.bets enable row level security;
alter table if exists public.strategies enable row level security;
alter table if exists public.user_configs enable row level security;
alter table if exists public.transactions enable row level security;
alter table if exists public.tipster_profiles enable row level security;
alter table if exists public.tipster_follows enable row level security;
alter table if exists public.audit_logs enable row level security;
alter table if exists public.telegram_configs enable row level security;
alter table if exists public.bet_verifications enable row level security;
alter table if exists public.bet_verification_events enable row level security;

-- Legacy/dev DBs may still contain this Supabase-client config table.
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles enable row level security';
  end if;
end $$;

-- Remove broad anonymous/authenticated privileges first. The app now uses the
-- server API for private tables, so browser-side Data API access is not needed.
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Keep authenticated CRUD only where direct Data API access may still be useful
-- under strict owner policies. Do not grant access to audit logs, encrypted
-- Telegram config, verification internals, or append-only ledger events.
grant select, insert, update, delete on table public.bets to authenticated;
grant select, insert, update, delete on table public.strategies to authenticated;
grant select, insert, update, delete on table public.user_configs to authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
grant select, insert, update, delete on table public.tipster_profiles to authenticated;
grant select, insert, delete on table public.tipster_follows to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Public tipster discovery is intentionally public, but only for public profiles.
grant select on table public.tipster_profiles to anon;

do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'grant select, insert, update, delete on table public.profiles to authenticated';
  end if;
end $$;

-- Owner policies for private betting data.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bets' and policyname = 'bets_select_own') then
    create policy bets_select_own on public.bets
      for select to authenticated
      using ((select auth.uid()) is not null and (select auth.uid())::text = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bets' and policyname = 'bets_insert_own') then
    create policy bets_insert_own on public.bets
      for insert to authenticated
      with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bets' and policyname = 'bets_update_own') then
    create policy bets_update_own on public.bets
      for update to authenticated
      using ((select auth.uid()) is not null and (select auth.uid())::text = user_id)
      with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bets' and policyname = 'bets_delete_own') then
    create policy bets_delete_own on public.bets
      for delete to authenticated
      using ((select auth.uid()) is not null and (select auth.uid())::text = user_id);
  end if;
end $$;

-- Owner policies for simple user-owned tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['strategies', 'user_configs', 'transactions', 'telegram_configs', 'bet_verifications', 'bet_verification_events', 'audit_logs']
  loop
    if to_regclass('public.' || table_name) is not null then
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = table_name and policyname = table_name || '_select_own') then
        execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null and (select auth.uid())::text = user_id)', table_name || '_select_own', table_name);
      end if;
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = table_name and policyname = table_name || '_insert_own') then
        execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id)', table_name || '_insert_own', table_name);
      end if;
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = table_name and policyname = table_name || '_update_own') then
        execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) is not null and (select auth.uid())::text = user_id) with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id)', table_name || '_update_own', table_name);
      end if;
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = table_name and policyname = table_name || '_delete_own') then
        execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) is not null and (select auth.uid())::text = user_id)', table_name || '_delete_own', table_name);
      end if;
    end if;
  end loop;
end $$;

-- Legacy profile config table, if present. This table typically uses id = auth.uid().
do $$
begin
  if to_regclass('public.profiles') is not null then
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own') then
      execute 'create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) is not null and (select auth.uid())::text = id::text)';
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own') then
      execute 'create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) is not null and (select auth.uid())::text = id::text)';
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own') then
      execute 'create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) is not null and (select auth.uid())::text = id::text) with check ((select auth.uid()) is not null and (select auth.uid())::text = id::text)';
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_delete_own') then
      execute 'create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid()) is not null and (select auth.uid())::text = id::text)';
    end if;
  end if;
end $$;

-- Tipster profiles: public rows are readable, edits stay owner-only.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tipster_profiles' and policyname = 'tipster_profiles_select_public') then
    create policy tipster_profiles_select_public on public.tipster_profiles
      for select to anon, authenticated
      using (is_public = true or ((select auth.uid()) is not null and (select auth.uid())::text = user_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tipster_profiles' and policyname = 'tipster_profiles_insert_own') then
    create policy tipster_profiles_insert_own on public.tipster_profiles
      for insert to authenticated
      with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tipster_profiles' and policyname = 'tipster_profiles_update_own') then
    create policy tipster_profiles_update_own on public.tipster_profiles
      for update to authenticated
      using ((select auth.uid()) is not null and (select auth.uid())::text = user_id)
      with check ((select auth.uid()) is not null and (select auth.uid())::text = user_id);
  end if;
end $$;

-- Follow rows are owned by the follower.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tipster_follows' and policyname = 'tipster_follows_select_own') then
    create policy tipster_follows_select_own on public.tipster_follows
      for select to authenticated
      using ((select auth.uid()) is not null and (select auth.uid())::text = follower_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tipster_follows' and policyname = 'tipster_follows_insert_own') then
    create policy tipster_follows_insert_own on public.tipster_follows
      for insert to authenticated
      with check ((select auth.uid()) is not null and (select auth.uid())::text = follower_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tipster_follows' and policyname = 'tipster_follows_delete_own') then
    create policy tipster_follows_delete_own on public.tipster_follows
      for delete to authenticated
      using ((select auth.uid()) is not null and (select auth.uid())::text = follower_id);
  end if;
end $$;
