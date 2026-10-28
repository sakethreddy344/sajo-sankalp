create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  trip_date text not null default '' check (char_length(trip_date) <= 100),
  notes text not null default '' check (char_length(notes) <= 1000),
  media jsonb not null default '[]'::jsonb
    check (jsonb_typeof(media) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trips enable row level security;

create policy "Users can read their own trips"
  on public.trips
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own trips"
  on public.trips
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own trips"
  on public.trips
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own trips"
  on public.trips
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.trips
  to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-memories',
  'trip-memories',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own trip memories"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'trip-memories'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can upload their own trip memories"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'trip-memories'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update their own trip memories"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'trip-memories'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'trip-memories'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own trip memories"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'trip-memories'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'trips'
    )
  then
    alter publication supabase_realtime add table public.trips;
  end if;
end $$;
