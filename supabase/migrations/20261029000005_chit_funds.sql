alter table public.cards
  add column if not exists record_type text not null default 'card'
    check (record_type in ('card', 'chit_fund')),
  add column if not exists monthly_amount numeric
    check (monthly_amount is null or monthly_amount > 0),
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists paid_months jsonb not null default '[]'::jsonb
    check (jsonb_typeof(paid_months) = 'array'),
  add constraint cards_chit_fund_dates_check
    check (record_type <> 'chit_fund' or (
      monthly_amount is not null
      and start_date is not null
      and end_date is not null
      and end_date >= start_date
    ));
