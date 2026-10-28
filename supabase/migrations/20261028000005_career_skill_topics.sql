create table if not exists public.career_skill_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_title text not null check (char_length(trim(goal_title)) between 1 and 200),
  parent_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 100),
  notes text not null default '' check (char_length(notes) <= 50000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, goal_title, id),
  constraint career_skill_topics_parent_same_goal
    foreign key (user_id, goal_title, parent_id)
    references public.career_skill_topics (user_id, goal_title, id)
    on delete cascade
);

create unique index if not exists career_skill_topics_sibling_name_key
  on public.career_skill_topics (
    user_id,
    lower(trim(goal_title)),
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(trim(title))
  );

alter table public.career_skill_topics enable row level security;

create policy "Users can read their own career skill topics"
  on public.career_skill_topics
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own career skill topics"
  on public.career_skill_topics
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own career skill topics"
  on public.career_skill_topics
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own career skill topics"
  on public.career_skill_topics
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.career_skill_topics
  to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'career_skill_topics'
    )
  then
    alter publication supabase_realtime add table public.career_skill_topics;
  end if;
end $$;
