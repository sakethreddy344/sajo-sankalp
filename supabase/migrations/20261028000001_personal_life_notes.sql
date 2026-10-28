create table if not exists public.personal_life_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id text not null,
  goal_title text not null,
  content text not null default '',
  image_paths jsonb not null default '[]'::jsonb
    check (jsonb_typeof(image_paths) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (user_id, goal_id)
);

alter table public.personal_life_notes enable row level security;

create policy "Users can read their own personal life notes"
  on public.personal_life_notes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own personal life notes"
  on public.personal_life_notes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own personal life notes"
  on public.personal_life_notes
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own personal life notes"
  on public.personal_life_notes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.personal_life_notes
  to authenticated;
