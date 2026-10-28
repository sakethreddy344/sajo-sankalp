create table if not exists public.user_login_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  primary key (user_id, activity_date)
);

alter table public.user_login_days enable row level security;

create policy "Users can read their own login days"
  on public.user_login_days
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can record their own login days"
  on public.user_login_days
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert
  on public.user_login_days
  to authenticated;
