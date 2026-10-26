-- Karin: alle Morgen-omzet volgens haar Jortt-auditfiles in het dashboard — 26-10-2026.
-- Uitvoeren in Supabase (project jeqvjtnxgxpjviwhjmzr), SQL-editor. Idempotent.
--
-- Karins Jortt-auditfiles 2025 en 2026 zijn leidend (besluit Karin, 26-10-2026).
-- Alle omzet daarin is Morgen-omzet (behalve bankrente). De controle in
-- 2026-10-26-karin-kosten-morgen.sql (sectie 4) liet zien:
--   - 20 facturen stonden al goed;
--   - 3 juli-facturen zijn volgens Jortt betaald maar stonden op gefactureerd;
--   - 14 facturen ontbraken.
-- De id's volgen de acquisitie-sync (fin_acq_<factuurnummer>): komt de pdf later
-- via de acquisitie-map binnen, dan werkt de sync deze zelfde regel bij.
-- LET OP: de sync zet de betaalstatus terug naar wat de map zegt. Leg de pdf's
-- van betaalde facturen dus in 5. Betaald en open facturen in 4. Gefactureerd.

begin;

-- 1. Ontbrekende facturen (bedragen ex btw, status volgens Jortt per 26-10-2026).
insert into finance_entries (id, date, type, description, amount, vat_amount, category, vendor,
  project_id, recurring, source, owner, entity, factuur_status, payment_status)
values
  ('fin_acq_202503-004', '2025-03-01', 'income', 'Factuur 202503-004 — Gedeelde kosten website Morgen (deel Danielle)', 44.00, null, '', 'Studio Dani', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'ontvangen'),
  ('fin_acq_202509-005', '2025-09-01', 'income', 'Factuur 202509-005 — Jaarkosten website Velo Vital', 346.84, null, '', 'Stichting Wielerevenementen Aalburg', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'ontvangen'),
  ('fin_acq_202607-024', '2026-07-01', 'income', 'Factuur 202607-024 — Feedback op opzet AI Expertclass 2026.3', 200.00, null, '', 'Lindenhaeghe B.V.', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'ontvangen'),
  ('fin_acq_202607-025', '2026-07-01', 'income', 'Factuur 202607-025 — Oplevering nieuwe website (openstaande 50%)', 1111.00, null, '', 'Zjoske Kanters', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'gefactureerd'),
  ('fin_acq_202608-026', '2026-08-01', 'income', 'Factuur 202608-026 — WebBasic', 4.95, null, '', 'Nieuwe kijk op werk', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'gefactureerd'),
  ('fin_acq_202608-029', '2026-08-01', 'income', 'Factuur 202608-029 — Jaarkosten website hosting + platform + e-mail + onderhoud', 445.50, null, '', 'Stichting Wielerevenementen Aalburg', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'ontvangen'),
  ('fin_acq_202608-030', '2026-08-01', 'income', 'Factuur 202608-030 — E-learning AI voor financieel adviseurs', 562.50, null, '', 'Nederlands Compliance Instituut B.V.', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'ontvangen'),
  ('fin_acq_202609-031', '2026-09-01', 'income', 'Factuur 202609-031 — WebBasic', 4.95, null, '', 'Nieuwe kijk op werk', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'ontvangen'),
  ('fin_acq_202609-032', '2026-09-01', 'income', 'Factuur 202609-032 — Jaarkosten website hosting + platform + e-mail + onderhoud', 445.50, null, '', 'Stichting Wielerevenementen Aalburg', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'ontvangen'),
  ('fin_acq_202610-033', '2026-10-01', 'income', 'Factuur 202610-033 — WebBasic', 4.95, null, '', 'Nieuwe kijk op werk', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'gefactureerd'),
  ('fin_acq_202610-034', '2026-10-01', 'income', 'Factuur 202610-034 — 2 MKB-Boost sessies september', 2264.20, null, '', 'AgriFood Capital B.V.', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'ontvangen'),
  ('fin_acq_202610-035', '2026-10-01', 'income', 'Factuur 202610-035 — PE SEH 2026 - AI Expert Class (EDD-00016408)', 800.00, null, '', 'Lindenhaeghe B.V.', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'gefactureerd'),
  ('fin_acq_202610-038', '2026-10-01', 'income', 'Factuur 202610-038 — AI workshop 22-10', 390.00, null, '', 'AgriFood Capital B.V.', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'ontvangen'),
  ('fin_acq_202610-041', '2026-10-01', 'income', 'Factuur 202610-041 — AI workshop', 195.00, null, '', 'Training & Development by Eric', null, 'one_off', 'invoice', 'Karin', 'Morgen', '', 'ontvangen')
on conflict (id) do update set
  date = excluded.date, amount = excluded.amount, vendor = excluded.vendor,
  owner = excluded.owner, payment_status = excluded.payment_status;

-- 2. Juli-facturen zijn volgens Jortt betaald.
update finance_entries set payment_status = 'ontvangen'
where id in ('fin_acq_202607-021', 'fin_acq_202607-022', 'fin_acq_202607-023');

commit;

-- 3. Controle: Karins kant zoals de Afsluiting-tab hem telt.
--    Verwacht:
--      2025: omzet ontvangen 1.955,84 · open 0,00    · kosten 1.674,15 · geschat 0
--      2026: omzet ontvangen 16.914,03 · open 1.920,90 · kosten 5.924,39 · geschat 0
select jaar,
  round(sum(case when type = 'income' and payment_status = 'ontvangen' then amount else 0 end)::numeric, 2) as omzet_ontvangen,
  round(sum(case when type = 'income' and payment_status = 'gefactureerd' then amount else 0 end)::numeric, 2) as omzet_open,
  round(sum(case when type = 'expense' then amount - coalesce(vat_amount, 0) else 0 end)::numeric, 2) as kosten_ex_btw,
  count(*) filter (where type = 'expense' and (source = 'manual' or description ilike '%schatting%')) as geschat
from (
  select *, extract(year from date)::int as jaar from finance_entries
  where owner = 'Karin' and date <= '2026-12-31' and coalesce(entity, '') <> 'HvH BV'
    and not (type = 'expense' and source = 'manual' and recurring = 'monthly')
) k
group by jaar order by jaar;
