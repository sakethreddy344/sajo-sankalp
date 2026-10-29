alter table public.holdings
  add column if not exists sip_frequency text not null default 'monthly'
    check (sip_frequency in ('monthly', 'daily')),
  add column if not exists daily_sip numeric(14, 2) not null default 0
    check (daily_sip >= 0);

alter table public.money_entries
  add column if not exists holding_id uuid
    references public.holdings(id) on delete set null;
