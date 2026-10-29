alter table public.emis
  add column if not exists end_date date;

alter table public.emis
  add constraint emis_end_date_after_start_date
  check (end_date is null or start_date is null or end_date >= start_date);
