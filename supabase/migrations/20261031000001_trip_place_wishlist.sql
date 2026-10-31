alter table public.trips
  add column if not exists is_wishlisted_place boolean not null default false,
  add column if not exists is_completed boolean not null default false;

create index if not exists trips_wishlisted_places_by_user
  on public.trips (user_id, created_at desc)
  where is_wishlisted_place = true;
