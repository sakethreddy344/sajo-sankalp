create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  monthly_sip numeric(14, 2) not null default 0 check (monthly_sip >= 0),
  current_value numeric(14, 2) not null default 0 check (current_value >= 0),
  created_at timestamptz not null default now()
);

alter table public.holdings enable row level security;

create policy "Users can read their own holdings"
  on public.holdings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own holdings"
  on public.holdings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own holdings"
  on public.holdings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own holdings"
  on public.holdings
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.holdings
  to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'holdings'
    )
  then
    alter publication supabase_realtime add table public.holdings;
  end if;
end $$;
