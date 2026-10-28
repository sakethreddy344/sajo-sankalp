create table if not exists public.business_exploration_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  idea_id text not null,
  idea_title text not null,
  content text not null default '',
  image_paths jsonb not null default '[]'::jsonb
    check (jsonb_typeof(image_paths) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (user_id, idea_id)
);

alter table public.business_exploration_notes enable row level security;

create policy "Users can read their own business exploration notes"
  on public.business_exploration_notes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own business exploration notes"
  on public.business_exploration_notes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own business exploration notes"
  on public.business_exploration_notes
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own business exploration notes"
  on public.business_exploration_notes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.business_exploration_notes
  to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-exploration-images',
  'business-exploration-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own business exploration images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'business-exploration-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can upload their own business exploration images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'business-exploration-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update their own business exploration images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'business-exploration-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'business-exploration-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own business exploration images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'business-exploration-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
