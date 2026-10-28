create table if not exists public.available_credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);

create unique index if not exists available_credit_cards_user_name_key
  on public.available_credit_cards (user_id, lower(trim(name)));

alter table public.available_credit_cards enable row level security;

create policy "Users can read atheir own available credit cards"
  on public.available_credit_cards
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own available credit cards"
  on public.available_credit_cards
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own available credit cards"
  on public.available_credit_cards
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own available credit cards"
  on public.available_credit_cards
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.available_credit_cards
  to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'available_credit_cards'
    )
  then
    alter publication supabase_realtime add table public.available_credit_cards;
  end if;
end $$;
