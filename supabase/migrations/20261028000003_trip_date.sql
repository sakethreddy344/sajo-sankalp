alter table public.trips
  add column if not exists trip_date text not null default ''
  check (char_length(trip_date) <= 100);
