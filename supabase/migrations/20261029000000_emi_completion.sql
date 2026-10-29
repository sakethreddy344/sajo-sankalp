alter table public.emis
  add column if not exists is_completed boolean not null default false;
