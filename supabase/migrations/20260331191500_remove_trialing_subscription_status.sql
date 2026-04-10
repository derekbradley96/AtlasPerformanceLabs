do $$
begin
  alter table public.atlas_coaches
    alter column subscription_status set default 'active';
exception when undefined_table then
  null;
end $$;

do $$
begin
  alter table public.atlas_coaches
    drop constraint if exists atlas_coaches_subscription_status_check;
  alter table public.atlas_coaches
    add constraint atlas_coaches_subscription_status_check
    check (subscription_status in ('active', 'past_due', 'canceled'));
exception when undefined_table then
  null;
end $$;

comment on column public.atlas_coaches.subscription_status is 'Platform plan: active, past_due, canceled';
