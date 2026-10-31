create table if not exists public.gift_occasions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_name text not null check (char_length(trim(person_name)) between 1 and 100),
  occasion_type text not null default 'Birthday'
    check (occasion_type in ('Birthday', 'Anniversary', 'Special occasion', 'Other')),
  occasion_date date not null,
  relationship text not null default '' check (char_length(relationship) <= 100),
  gift_ideas text not null default '' check (char_length(gift_ideas) <= 5000),
  plans text not null default '' check (char_length(plans) <= 5000),
  repeats_annually boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 150),
  category text not null default '' check (char_length(category) <= 100),
  ingredients text not null default '' check (char_length(ingredients) <= 10000),
  instructions text not null default '' check (char_length(instructions) <= 20000),
  notes text not null default '' check (char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gift_occasions enable row level security;
alter table public.recipe_ideas enable row level security;

create policy "Users can read their own gift occasions"
  on public.gift_occasions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own gift occasions"
  on public.gift_occasions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own gift occasions"
  on public.gift_occasions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own gift occasions"
  on public.gift_occasions for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own recipe ideas"
  on public.recipe_ideas for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own recipe ideas"
  on public.recipe_ideas for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own recipe ideas"
  on public.recipe_ideas for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own recipe ideas"
  on public.recipe_ideas for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.gift_occasions, public.recipe_ideas to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gift_occasions'
    ) then
      alter publication supabase_realtime add table public.gift_occasions;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recipe_ideas'
    ) then
      alter publication supabase_realtime add table public.recipe_ideas;
    end if;
  end if;
end $$;
