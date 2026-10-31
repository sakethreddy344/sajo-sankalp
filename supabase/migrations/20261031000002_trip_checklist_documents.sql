alter table public.trips
  add column if not exists is_packing_checklist boolean not null default false,
  add column if not exists is_important_document boolean not null default false;

create unique index if not exists trips_one_packing_checklist_per_user
  on public.trips (user_id)
  where is_packing_checklist = true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'important-documents',
  'important-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own important documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'important-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can upload their own important documents"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'important-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own important documents"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'important-documents'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
