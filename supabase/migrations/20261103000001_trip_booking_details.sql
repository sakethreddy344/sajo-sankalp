alter table public.trips
  add column if not exists booking_details jsonb not null default '[]'::jsonb
    check (jsonb_typeof(booking_details) = 'array');
