-- Afsluiting voor BV (tab #/afsluiting) — schemawijziging, 25-10-2026.
-- Uitvoeren in Supabase (project jeqvjtnxgxpjviwhjmzr). Idempotent.

-- 1. Btw per kostenpost, zodat de verrekening ex btw kan.
--    amount blijft het betaalde bedrag (incl. eventuele NL-btw);
--    vat_amount is het btw-deel daarvan. Leeg = geen NL-btw (buitenlandse SaaS, reverse charge).
alter table public.finance_entries
  add column if not exists vat_amount numeric;

-- 2. Onderlinge verrekeningen tussen Harmen (Harmen van Heist B.V.) en Karin.
--    Bedragen ex btw. Gaan van het saldo op de tab af.
create table if not exists public.settlements (
  id          text primary key,
  date        date not null,
  from_person text not null check (from_person in ('Harmen', 'Karin')),
  to_person   text not null check (to_person in ('Harmen', 'Karin')),
  amount      numeric not null check (amount > 0),
  description text not null default '',
  created_at  timestamptz not null default now(),
  check (from_person <> to_person)
);

-- Zelfde toegang als de andere tabellen: het dashboard is stateless en
-- schrijft met de anon-key.
alter table public.settlements enable row level security;
drop policy if exists "settlements anon all" on public.settlements;
create policy "settlements anon all" on public.settlements
  for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.settlements to anon, authenticated;
