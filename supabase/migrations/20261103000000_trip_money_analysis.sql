alter table public.trips
  add column if not exists is_trip_money_analysis boolean not null default false,
  add column if not exists trip_expenses jsonb not null default '[]'::jsonb
    check (jsonb_typeof(trip_expenses) = 'array');
