alter table public.emis
  add column if not exists monthly_payments jsonb not null default '[]'::jsonb
    check (jsonb_typeof(monthly_payments) = 'array');

update public.emis as emi
set monthly_payments = (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'month', to_char(payment.entry_date, 'YYYY-MM'),
        'amount', payment.amount,
        'date', payment.entry_date::text,
        'moneyEntryId', payment.id
      )
      order by payment.entry_date, payment.id
    ),
    '[]'::jsonb
  )
  from public.money_entries as payment
  where payment.user_id = emi.user_id
    and payment.entry_type = 'emi_payment'
    and (
      payment.emi_id = emi.id
      or (payment.emi_id is null and payment.description = emi.name)
    )
)
where monthly_payments = '[]'::jsonb;
