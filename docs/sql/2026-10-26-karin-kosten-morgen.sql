-- Karin: kosten die zij namens Morgen betaalde (2025 + 2026) — 26-10-2026.
-- Uitvoeren in Supabase (project jeqvjtnxgxpjviwhjmzr), SQL-editor. Idempotent.
--
-- Bron: Jortt-auditfiles (XAF) van Karin van Tongerlo, boekjaar 2025 en 2026
-- (export 26-10-2026, t/m 26-10-2026). Op 26-10-2026 heeft Karin alle 340
-- kostenposten één voor één ingedeeld als Morgen of eigen; dit zijn de posten
-- die zij als Morgen aanwees. Overzicht met de keuze per post:
-- OneDrive Morgen intern/Admin/Finance/Karin van Tongerlo (eenmanszaak)/.
--
-- amount     = betaald bedrag (kosten in Jortt + te vorderen btw);
-- vat_amount = te vorderen btw volgens Jortt (leeg = geen NL-btw of niet aftrekbaar).
-- Ex btw: 2025 € 1.542,15 en 2026 € 5.924,39 (156 posten).
-- Niet opgenomen: Wix € 132 (maart 2025), die staat er al als
-- fin_exp_2025_wix_1169710647.
-- Let op: bij posten die Karin in Jortt handmatig inboekte (bonnetjes) is de
-- datum de boekdatum (vaak de 1e van de maand), niet de betaaldatum.

begin;

-- 1. Karins Morgen-kosten.
insert into finance_entries (id, date, type, description, amount, vat_amount, category, vendor,
  project_id, recurring, source, owner, entity, factuur_status, payment_status)
values
  ('fin_exp_karin_20250131_harmen_van_heist_b_v', '2025-01-31', 'expense', 'Harmen van Heist B.V. via Rabo Zake (Jortt Karin)', 75.63, 13.13, 'Overig', 'Harmen van Heist B.V.', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250301_openai', '2025-03-01', 'expense', 'Open AI maart (Jortt Karin)', 19.01, null, 'Software/SaaS', 'OpenAI', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250401_openai', '2025-04-01', 'expense', 'OpenAI (Jortt Karin)', 19.01, null, 'Software/SaaS', 'OpenAI', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250425_almgoed', '2025-04-25', 'expense', 'Almgoed bv: ALMKERK 25-04-2025 16:46 Pas: 8763 (Jortt Karin)', 13.50, null, 'Overig', 'Almgoed', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250425_almgoed_2', '2025-04-25', 'expense', 'Almgoed bv: ALMKERK 25-04-2025 16:45 Pas: 8763 (Jortt Karin)', 76.00, null, 'Overig', 'Almgoed', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250425_almgoed_3', '2025-04-25', 'expense', 'Almgoed bv: ALMKERK 25-04-2025 16:46 Pas: 8763 (Jortt Karin)', 40.50, null, 'Overig', 'Almgoed', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250425_par_tee_centre_bv', '2025-04-25', 'expense', 'Par-Tee Centre BV: ALMKERK 25-04-2025 13:13 Pas: 8763 (Jortt Karin)', 6.15, null, 'Overig', 'Par-Tee Centre BV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250501_openai', '2025-05-01', 'expense', 'Open AI (Jortt Karin)', 19.01, null, 'Software/SaaS', 'OpenAI', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250601_openai', '2025-06-01', 'expense', 'OpenAI (Jortt Karin)', 19.01, null, 'Software/SaaS', 'OpenAI', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250701_openai', '2025-07-01', 'expense', 'Chat GTP april (Jortt Karin)', 19.01, null, 'Software/SaaS', 'OpenAI', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250701_openai_2', '2025-07-01', 'expense', 'Open AI credits (Jortt Karin)', 5.31, null, 'AI/API credits', 'OpenAI', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250701_openai_3', '2025-07-01', 'expense', 'OpenAI (Jortt Karin)', 19.01, null, 'Software/SaaS', 'OpenAI', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250701_opus_clip', '2025-07-01', 'expense', 'Opusclip (videotool) (Jortt Karin)', 15.00, null, 'Software/SaaS', 'Opus Clip', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250801_gamma', '2025-08-01', 'expense', 'Gamma (tool voor presentaties - jaarabbo) (Jortt Karin)', 180.00, null, 'Software/SaaS', 'Gamma', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250801_openai', '2025-08-01', 'expense', 'OpenAI (Jortt Karin)', 19.01, null, 'Software/SaaS', 'OpenAI', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250801_opus_clip', '2025-08-01', 'expense', 'Opus Clip (videotool) (Jortt Karin)', 15.00, null, 'Software/SaaS', 'Opus Clip', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250801_overleg_velo_vital', '2025-08-01', 'expense', 'Overleg Velo Vital (Jortt Karin)', 150.00, null, 'Overig', 'Overleg Velo Vital', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250801_wix', '2025-08-01', 'expense', 'Wix mailprogramma (Jortt Karin)', 14.52, 2.52, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250901_openai', '2025-09-01', 'expense', 'Open AI (Jortt Karin)', 19.01, null, 'Software/SaaS', 'OpenAI', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250901_opus_clip', '2025-09-01', 'expense', 'Opusclip (videotool) (Jortt Karin)', 15.00, null, 'Software/SaaS', 'Opus Clip', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20250916_gr8_restaurants_b_v', '2025-09-16', 'expense', 'Gr8 Restaurants B.V.: OOSTERHOUT N 16-09-2025 12:29 Pas: 8763 (Jortt Karin)', 29.20, null, 'Overig', 'Gr8 Restaurants B.V.', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251001_bedankje', '2025-10-01', 'expense', 'Bedankje (Jortt Karin)', 20.50, null, 'Overig', 'Bedankje', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251001_wix', '2025-10-01', 'expense', 'Wix abbo voor Velo Vital (Jortt Karin)', 246.84, 42.84, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_heygen', '2025-12-01', 'expense', 'HeyGen (Jortt Karin)', 25.00, null, 'Software/SaaS', 'HeyGen', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_lovable', '2025-12-01', 'expense', 'Lovable (Jortt Karin)', 25.00, 4.34, 'Software/SaaS', 'Lovable', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_lovable_2', '2025-12-01', 'expense', 'Lovable credits (Jortt Karin)', 8.94, 1.55, 'AI/API credits', 'Lovable', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_lunch_tbv_samenwerking', '2025-12-01', 'expense', 'Lunch tbv samenwerking (Jortt Karin)', 43.05, null, 'Overig', 'Lunch tbv samenwerking', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_mailchimp', '2025-12-01', 'expense', 'Mailchimp (Jortt Karin)', 21.01, 3.65, 'Software/SaaS', 'Mailchimp', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_mailchimp_2', '2025-12-01', 'expense', 'mailchimp (Jortt Karin)', 13.49, 2.34, 'Software/SaaS', 'Mailchimp', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_openai', '2025-12-01', 'expense', 'OpenAI 17/10/2025 (Jortt Karin)', 19.01, null, 'Software/SaaS', 'OpenAI', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_openai_2', '2025-12-01', 'expense', 'OpenAI (Jortt Karin)', 19.01, null, 'Software/SaaS', 'OpenAI', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_runway', '2025-12-01', 'expense', 'Runway (Jortt Karin)', 13.23, null, 'Software/SaaS', 'Runway', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_typeform', '2025-12-01', 'expense', 'Typeform (Jortt Karin)', 30.25, null, 'Software/SaaS', 'Typeform', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_typeform_2', '2025-12-01', 'expense', 'Typeform (Jortt Karin)', 30.25, 5.25, 'Software/SaaS', 'Typeform', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_wix', '2025-12-01', 'expense', 'Wix (Jortt Karin)', 36.30, 6.30, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_wix_2', '2025-12-01', 'expense', 'Wix (Jortt Karin)', 14.52, 2.52, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_wix_3', '2025-12-01', 'expense', 'Wix 7/10/25 (Jortt Karin)', 14.52, 2.52, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_wix_4', '2025-12-01', 'expense', 'Wix (Jortt Karin)', 14.52, 2.52, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251201_wix_5', '2025-12-01', 'expense', 'Wix site (Jortt Karin)', 246.84, 42.84, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20251203_brandzaak_koffie_b_v', '2025-12-03', 'expense', 'Brandzaak Koffie B.V. (Jortt Karin)', 53.60, 9.30, 'Overig', 'Brandzaak Koffie B.V.', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_anthropic_claude', '2026-03-01', 'expense', 'Claude (Jortt Karin)', 21.78, null, 'Software/SaaS', 'Anthropic (Claude)', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_anthropic_claude_2', '2026-03-01', 'expense', 'Claude (Jortt Karin)', 21.78, 3.78, 'Software/SaaS', 'Anthropic (Claude)', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_bunny_net', '2026-03-01', 'expense', 'Bunny.net (Jortt Karin)', 8.92, null, 'Software/SaaS', 'Bunny.net', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_cadeaubon_voor_diensten', '2026-03-01', 'expense', 'Cadeaubon voor diensten (Jortt Karin)', 40.00, 3.30, 'Overig', 'Cadeaubon voor diensten', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_canva', '2026-03-01', 'expense', 'Canva abbo (Jortt Karin)', 12.00, 2.08, 'Software/SaaS', 'Canva', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_canva_2', '2026-03-01', 'expense', 'Canva (Jortt Karin)', 12.00, null, 'Software/SaaS', 'Canva', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_capcut', '2026-03-01', 'expense', 'CapCut (Jortt Karin)', 5.99, 1.04, 'Software/SaaS', 'CapCut', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_domeinnaam', '2026-03-01', 'expense', 'Domeinnaam (Jortt Karin)', 11.01, 1.91, 'Software/SaaS', 'Domeinnaam', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_domeinnaam_2', '2026-03-01', 'expense', 'Domeinnaam (Jortt Karin)', 0.12, 0.02, 'Software/SaaS', 'Domeinnaam', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_domeinnaam_3', '2026-03-01', 'expense', 'Domeinnaam (Jortt Karin)', 0.12, 0.02, 'Software/SaaS', 'Domeinnaam', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_laptop', '2026-03-01', 'expense', 'Laptop (Jortt Karin)', 1199.00, 208.09, 'Hardware', 'Laptop', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_lovable', '2026-03-01', 'expense', 'Lovable (Jortt Karin)', 13.41, 2.33, 'Software/SaaS', 'Lovable', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_lovable_2', '2026-03-01', 'expense', 'Lovable (Jortt Karin)', 27.10, null, 'Software/SaaS', 'Lovable', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_marketing', '2026-03-01', 'expense', 'Marketingkosten (Jortt Karin)', 27.00, 4.69, 'Overig', 'Marketing', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_marketing_2', '2026-03-01', 'expense', 'Marketing (Jortt Karin)', 330.00, null, 'Overig', 'Marketing', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_ns_ov', '2026-03-01', 'expense', 'Trein Prinsenbeek - Den Bosch (Jortt Karin)', 42.60, 7.39, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_ns_ov_2', '2026-03-01', 'expense', 'NS (Jortt Karin)', 24.00, 4.17, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_ns_ov_3', '2026-03-01', 'expense', 'Trein PB-DB (Jortt Karin)', 24.00, 4.17, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_presenter', '2026-03-01', 'expense', 'Presenter (Jortt Karin)', 47.99, 8.33, 'Hardware', 'Presenter', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_resend', '2026-03-01', 'expense', 'Resend (Jortt Karin)', 18.09, null, 'Software/SaaS', 'Resend', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_social_media_planning', '2026-03-01', 'expense', 'Social media planning (Jortt Karin)', 16.18, null, 'Software/SaaS', 'Social media planning', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_social_media_planning_2', '2026-03-01', 'expense', 'Social media planning (Jortt Karin)', 16.18, null, 'Software/SaaS', 'Social media planning', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_social_media_planning_3', '2026-03-01', 'expense', 'Social media planning (Jortt Karin)', 16.18, null, 'Software/SaaS', 'Social media planning', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_social_media_planning_4', '2026-03-01', 'expense', 'Social media planning (Jortt Karin)', 16.18, null, 'Software/SaaS', 'Social media planning', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_social_media_planning_5', '2026-03-01', 'expense', 'Social media planning (Jortt Karin)', 16.18, null, 'Software/SaaS', 'Social media planning', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_social_media_planning_6', '2026-03-01', 'expense', 'Social media planning (Jortt Karin)', 16.18, null, 'Software/SaaS', 'Social media planning', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_social_media_planning_7', '2026-03-01', 'expense', 'Social media planning (Jortt Karin)', 16.18, null, 'Software/SaaS', 'Social media planning', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_supabase', '2026-03-01', 'expense', 'Supabase (Jortt Karin)', 22.26, 3.86, 'Software/SaaS', 'Supabase', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_wix', '2026-03-01', 'expense', 'Wix (Jortt Karin)', 35.09, null, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_wix_2', '2026-03-01', 'expense', 'Wix (Jortt Karin)', 49.63, null, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_wix_3', '2026-03-01', 'expense', 'Wix (Jortt Karin)', 35.09, null, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_wix_4', '2026-03-01', 'expense', 'Wix 13-1-2026 (Jortt Karin)', 19.36, 3.36, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_wix_5', '2026-03-01', 'expense', 'Wix (Jortt Karin)', 19.36, 3.36, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260301_wix_6', '2026-03-01', 'expense', 'Wix (Jortt Karin)', 19.36, 3.36, 'Software/SaaS', 'Wix', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260326_stichting_fight_cancer', '2026-03-26', 'expense', 'Stichting Fight cancer (Jortt Karin)', 11.11, null, 'Overig', 'Stichting Fight cancer', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260501_koffie', '2026-05-01', 'expense', 'Koffie (Jortt Karin)', 57.60, 10.00, 'Overig', 'Koffie', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260504_belgica_b_v', '2026-05-04', 'expense', 'Belgica B V: Breda 03-05-2026 16:56 Pas: 8763 (Jortt Karin)', 31.95, null, 'Overig', 'Belgica B V', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260507_ns_ov', '2026-05-07', 'expense', 'NLOVGY5B8MB84Z75LP: www.ovpay.nl 07-05-2026 17:23 Pas: 8763 (Jortt Karin)', 12.00, 0.99, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260508_ns_ov', '2026-05-08', 'expense', 'NLOVLD5DNEQKPXM5Z7: www.ovpay.nl 07-05-2026 18:14 Pas: 8763 (Jortt Karin)', 12.00, 0.99, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260508_parkeren', '2026-05-08', 'expense', 'PARKING EMMAPASSAGE TI: TILBURG 08-05-2026 17:40 Pas: 8763 (Jortt Karin)', 7.20, 1.25, 'Overig', 'Parkeren', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260515_ns_ov', '2026-05-15', 'expense', 'NLOVLD5DNEB6ZNM5Z7: www.ovpay.nl 14-05-2026 15:51 Pas: 8763 (Jortt Karin)', 2.47, 0.20, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260521_eetcafe_de_stip', '2026-05-21', 'expense', 'Lunch | Diner BCK*Eetcafe De Stip: S-HERTOGENBO 21-05-2026 18:07 Pas: 8763 (Jortt Karin)', 88.60, null, 'Overig', 'Eetcafe De Stip', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260522_parkeren', '2026-05-22', 'expense', 'BNG*Gemeente Utrecht: UTRECHT 22-05-2026 16:39 Pas: 8763 (Jortt Karin)', 15.00, 2.60, 'Overig', 'Parkeren', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_anthropic_claude', '2026-06-01', 'expense', 'Claude (Jortt Karin)', 21.78, 3.78, 'Software/SaaS', 'Anthropic (Claude)', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_anthropic_claude_2', '2026-06-01', 'expense', 'Claude (Jortt Karin)', 21.78, 3.78, 'Software/SaaS', 'Anthropic (Claude)', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_anthropic_claude_3', '2026-06-01', 'expense', 'Claude (Jortt Karin)', 21.78, 3.78, 'Software/SaaS', 'Anthropic (Claude)', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_anthropic_claude_4', '2026-06-01', 'expense', 'Claude (Jortt Karin)', 21.78, 3.78, 'Software/SaaS', 'Anthropic (Claude)', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_audio', '2026-06-01', 'expense', 'Audio (Jortt Karin)', 549.00, 95.28, 'Hardware', 'Audio', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_bunny_net', '2026-06-01', 'expense', 'Bunny (Jortt Karin)', 8.50, 1.48, 'Software/SaaS', 'Bunny.net', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_canva', '2026-06-01', 'expense', 'Canva (Jortt Karin)', 12.00, 2.08, 'Software/SaaS', 'Canva', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_canva_2', '2026-06-01', 'expense', 'Canva (Jortt Karin)', 12.00, 2.08, 'Software/SaaS', 'Canva', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_canva_3', '2026-06-01', 'expense', 'Canva (Jortt Karin)', 12.00, 2.08, 'Software/SaaS', 'Canva', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_google', '2026-06-01', 'expense', 'Google (Jortt Karin)', 25.00, 4.34, 'Software/SaaS', 'Google', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_hostnet', '2026-06-01', 'expense', 'hostnet (Jortt Karin)', 21.74, 3.77, 'Software/SaaS', 'Hostnet', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_hostnet_2', '2026-06-01', 'expense', 'Hostnet (Jortt Karin)', 27.83, 4.83, 'Software/SaaS', 'Hostnet', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_hostnet_3', '2026-06-01', 'expense', 'hostnet (Jortt Karin)', 21.86, 3.79, 'Software/SaaS', 'Hostnet', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_microsoft', '2026-06-01', 'expense', 'Microsoft (Jortt Karin)', 54.10, 9.39, 'Software/SaaS', 'Microsoft', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_microsoft_2', '2026-06-01', 'expense', 'Microsoft (Jortt Karin)', 26.53, 4.60, 'Software/SaaS', 'Microsoft', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_ns_ov', '2026-06-01', 'expense', 'NS maart (Jortt Karin)', 24.00, 4.17, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_ns_ov_2', '2026-06-01', 'expense', 'NS Mei (Jortt Karin)', 75.00, 13.02, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_ns_ov_3', '2026-06-01', 'expense', 'NS juni (Jortt Karin)', 24.00, 4.17, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_ns_ov_4', '2026-06-01', 'expense', 'OV (Jortt Karin)', 12.00, 2.08, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_ns_ov_5', '2026-06-01', 'expense', 'OV (Jortt Karin)', 12.00, 2.08, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_ns_ov_6', '2026-06-01', 'expense', 'NS juni (Jortt Karin)', 81.00, 14.06, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_reiskosten_km_mkb_boost', '2026-06-01', 'expense', 'Reiskosten MKB-boost juni (Jortt Karin)', 79.12, null, 'Overig', 'Reiskosten (km/MKB Boost)', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_reiskosten_km_mkb_boost_2', '2026-06-01', 'expense', 'Reiskosten zakelijke kilometers Q2 2026 - diverse opdrachten Motivra Breda: 12 × 16 km = 192 km VLG zomercongr (Jortt Karin)', 253.00, null, 'Overig', 'Reiskosten (km/MKB Boost)', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_reiskosten_km_mkb_boost_3', '2026-06-01', 'expense', 'mkb boost april (Jortt Karin)', 62.10, null, 'Overig', 'Reiskosten (km/MKB Boost)', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_resend', '2026-06-01', 'expense', 'Resend (Jortt Karin)', 17.89, 3.10, 'Software/SaaS', 'Resend', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_resend_2', '2026-06-01', 'expense', 'Resend (Jortt Karin)', 17.00, 2.95, 'Software/SaaS', 'Resend', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_supabase', '2026-06-01', 'expense', 'Supabase (Jortt Karin)', 15.44, 2.68, 'Software/SaaS', 'Supabase', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_supabase_2', '2026-06-01', 'expense', 'Supabase (Jortt Karin)', 40.91, 7.10, 'Software/SaaS', 'Supabase', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260601_supabase_3', '2026-06-01', 'expense', 'Supabase (Jortt Karin)', 40.96, 7.11, 'Software/SaaS', 'Supabase', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260606_wijnfestival_den_bosch', '2026-06-06', 'expense', 'Wijnfestival Den Bosch: ''S-HERTOGENB 05-07-2026 18:41 Pas: 8763 (Jortt Karin)', 14.50, 2.52, 'Overig', 'Wijnfestival Den Bosch', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260608_brandzaak_koffie_b_v', '2026-06-08', 'expense', 'Brandzaak Koffie B.V. (Jortt Karin)', 57.60, 10.00, 'Overig', 'Brandzaak Koffie B.V.', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260608_parkeren', '2026-06-08', 'expense', 'CCV*Parking Strand: S GRAVENHAGE 06-06-2026 17:35 Pas: 8763 (Jortt Karin)', 21.20, 3.68, 'Overig', 'Parkeren', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260610_ns_ov', '2026-06-10', 'expense', 'NLOVGY5B8NB9YZ45LP: www.ovpay.nl 09-06-2026 17:42 Pas: 8763 (Jortt Karin)', 3.02, 0.25, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260613_brandzaak_koffie_b_v', '2026-06-13', 'expense', 'Brandzaak Koffie B.V. (Jortt Karin)', 57.60, 10.00, 'Overig', 'Brandzaak Koffie B.V.', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260615_ns_ov', '2026-06-15', 'expense', 'NS Reizigers B.V. (Jortt Karin)', 0.01, null, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260615_ora_taverna_bar', '2026-06-15', 'expense', 'ORA Taverna Bar: Breda 13-06-2026 22:25 Pas: 8763 (Jortt Karin)', 275.00, null, 'Overig', 'ORA Taverna Bar', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260716_in_de_zevende_hemel', '2026-07-16', 'expense', 'CCV*IN DE ZEVENDE HEME: S HERTOGENBO 16-07-2026 21:02 Pas: 8763 (Jortt Karin)', 144.44, null, 'Overig', 'In de Zevende Hemel', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260721_ns_ov', '2026-07-21', 'expense', 'NLOVB85Y9LZE7A45VE: www.ovpay.nl 20-07-2026 10:00 Pas: 8763 (Jortt Karin)', 2.19, 0.18, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260727_ns_ov', '2026-07-27', 'expense', 'NLOVMQJAN7D4QXA567: www.ovpay.nl 25-07-2026 16:30 Pas: 8763 (Jortt Karin)', 12.00, 0.99, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260730_nom_nom', '2026-07-30', 'expense', 'Nom Nom: ''S-HERTOGENB 30-07-2026 19:39 Pas: 8763 (Jortt Karin)', 66.00, null, 'Overig', 'Nom Nom', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260804_halfvol_management_en_co', '2026-08-04', 'expense', 'Halfvol Management en Coaching (Jortt Karin)', 340.31, 59.06, 'Overig', 'Halfvol Management en Coaching', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260811_hostnet', '2026-08-11', 'expense', 'Hostnet B.V. (Jortt Karin)', 11.13, 1.93, 'Software/SaaS', 'Hostnet', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260814_ministerie_van_justitie_', '2026-08-14', 'expense', 'Ministerie van Justitie en Veilighe (Jortt Karin)', 33.85, null, 'Overig', 'Ministerie van Justitie en Veilighe', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260820_ns_ov', '2026-08-20', 'expense', 'NS Reizigers B.V. (Jortt Karin)', 0.01, null, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260821_mace', '2026-08-21', 'expense', 'Mace: Oosterhout 21-08-2026 20:33 Pas: 8763 (Jortt Karin)', 89.85, null, 'Overig', 'Mace', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260824_brandzaak_koffie_b_v', '2026-08-24', 'expense', 'Brandzaak Koffie B.V. (Jortt Karin)', 57.60, 10.00, 'Overig', 'Brandzaak Koffie B.V.', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260825_hostnet', '2026-08-25', 'expense', 'Hostnet B.V. (Jortt Karin)', 21.74, 3.77, 'Software/SaaS', 'Hostnet', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260825_ns_ov', '2026-08-25', 'expense', 'NS GROEP IZ NS REIZIGERS (Jortt Karin)', 24.00, 1.98, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260827_kaiseki', '2026-08-27', 'expense', 'Kaiseki: Vught 27-08-2026 22:23 Pas: 8763 (Jortt Karin)', 225.00, null, 'Overig', 'Kaiseki', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260901_hostnet', '2026-09-01', 'expense', 'Hostnet B.V. (Jortt Karin)', 0.12, 0.02, 'Software/SaaS', 'Hostnet', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260904_ns_ov', '2026-09-04', 'expense', 'NLOVW7JW9ZMAPWQJVP: www.ovpay.nl 04-09-2026 11:35 Pas: 8763 (Jortt Karin)', 12.00, 0.99, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260907_ns_ov', '2026-09-07', 'expense', 'NLOVAZJR8LQW4L4JMG: www.ovpay.nl 07-09-2026 17:29 Pas: 8763 (Jortt Karin)', 7.10, 0.59, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260907_ns_ov_2', '2026-09-07', 'expense', 'NLOVLX5MLYMZ68QJWG: www.ovpay.nl 04-09-2026 12:42 Pas: 8763 (Jortt Karin)', 12.00, 0.99, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260908_ns_ov', '2026-09-08', 'expense', 'NLOVLX5MLYX4K8VJWG: www.ovpay.nl 07-09-2026 18:16 Pas: 8763 (Jortt Karin)', 7.10, 0.59, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260918_meerbroeders_b_v', '2026-09-18', 'expense', 'Meerbroeders B.V: ''S-HERTOGENB 18-09-2026 22:41 Pas: 8763 (Jortt Karin)', 143.80, null, 'Overig', 'Meerbroeders B.V', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260921_ns_ov', '2026-09-21', 'expense', 'NLOVVGJ9WDX7KAZJZQ: www.ovpay.nl 18-09-2026 23:41 Pas: 8763 (Jortt Karin)', 12.00, 0.99, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20260922_hostnet', '2026-09-22', 'expense', 'Hostnet B.V. (Jortt Karin)', 0.12, 0.02, 'Software/SaaS', 'Hostnet', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261001_anthropic_claude', '2026-10-01', 'expense', 'Anthropic (Jortt Karin)', 21.78, 3.78, 'Software/SaaS', 'Anthropic (Claude)', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261001_anthropic_claude_2', '2026-10-01', 'expense', 'Claude (Jortt Karin)', 91.38, 15.86, 'Software/SaaS', 'Anthropic (Claude)', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261001_anthropic_claude_3', '2026-10-01', 'expense', 'Claude (Jortt Karin)', 21.78, 3.78, 'Software/SaaS', 'Anthropic (Claude)', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261001_canva', '2026-10-01', 'expense', 'Canva (3x 12 voor kwartaal) (Jortt Karin)', 36.00, 6.25, 'Software/SaaS', 'Canva', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261001_mailerlite', '2026-10-01', 'expense', 'Mailerlite (Jortt Karin)', 20.57, null, 'Software/SaaS', 'Mailerlite', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261001_mastermind_diner', '2026-10-01', 'expense', 'Mastermind diner (Jortt Karin)', 354.50, null, 'Overig', 'Mastermind diner', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261001_microsoft', '2026-10-01', 'expense', 'Microsoft (Jortt Karin)', 81.77, 14.19, 'Software/SaaS', 'Microsoft', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261001_microsoft_2', '2026-10-01', 'expense', 'Microsoft (Jortt Karin)', 25.00, 4.34, 'Software/SaaS', 'Microsoft', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261001_microsoft_3', '2026-10-01', 'expense', 'Micosoft (Jortt Karin)', 54.10, 9.39, 'Software/SaaS', 'Microsoft', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261001_microsoft_4', '2026-10-01', 'expense', 'Microsoft (Jortt Karin)', 54.10, 9.39, 'Software/SaaS', 'Microsoft', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261001_parkeren', '2026-10-01', 'expense', 'Parkeren (Jortt Karin)', 33.55, null, 'Overig', 'Parkeren', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261002_brandzaak_koffie_b_v', '2026-10-02', 'expense', 'Brandzaak Koffie B.V. (Jortt Karin)', 57.60, 10.00, 'Overig', 'Brandzaak Koffie B.V.', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261013_hostnet', '2026-10-13', 'expense', 'Hostnet B.V. (Jortt Karin)', 21.74, 3.77, 'Software/SaaS', 'Hostnet', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261022_ns_ov', '2026-10-22', 'expense', 'NLOVKLJ4LRRNEMYJZY: www.ovpay.nl 22-10-2026 17:28 Pas: 8763 (Jortt Karin)', 12.00, 0.99, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261023_ns_ov', '2026-10-23', 'expense', 'NS GROEP IZ NS REIZIGERS (Jortt Karin)', 9.60, 0.79, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht'),
  ('fin_exp_karin_20261023_ns_ov_2', '2026-10-23', 'expense', 'NLOV8R5LNZXGZ6M5M6: www.ovpay.nl 22-10-2026 18:42 Pas: 8763 (Jortt Karin)', 12.00, 0.99, 'Overig', 'NS / OV', null, 'one_off', 'invoice', 'Karin', 'Karin', '✓ Factuur', 'verwacht')
on conflict (id) do update set
  date = excluded.date, description = excluded.description, amount = excluded.amount,
  vat_amount = excluded.vat_amount, category = excluded.category, vendor = excluded.vendor,
  source = excluded.source, owner = excluded.owner, entity = excluded.entity,
  factuur_status = excluded.factuur_status, payment_status = excluded.payment_status;

-- 2. De geschatte maandbedragen (€ 132,31/maand) zijn nu vervangen door echte
--    cijfers t/m oktober 2026. De prognose-templates (fin_karin_kost_*) blijven staan.
delete from finance_entries where id like 'fin_karin_actual_%';

commit;

-- 3. Controle: Karins kosten per jaar zoals de tab ze telt (ex btw).
--    Verwacht: 2025 = 1.542,15 + 132,00 (Wix) = 1.674,15; 2026 = 5.924,39.
select extract(year from date) as jaar, count(*) as posten,
       round(sum(amount - coalesce(vat_amount, 0))::numeric, 2) as ex_btw,
       count(*) filter (where source = 'manual' or description ilike '%schatting%') as geschat
from finance_entries
where owner = 'Karin' and type = 'expense' and coalesce(entity, '') <> 'HvH BV'
  and not (source = 'manual' and recurring = 'monthly')
group by 1 order by 1;

-- 4. Controle omzet (alleen lezen): Karins Morgen-facturen volgens Jortt naast
--    wat er in het dashboard staat. Bedragen ex btw, netto na creditnota's.
--    'ONTBREEKT' = nog toevoegen (liefst via de acquisitie-map);
--    'STATUS ANDERS' = betaald/open wijkt af. Stuur de uitkomst naar Claude.
with jortt(factuur, datum, klant, bedrag, status) as (values
    ('202503-004', date '2025-03-01', 'Studio Dani (Danielle) — gedeelde kosten website Morgen', 44.00, 'ontvangen'),
    ('202509-005', date '2025-09-01', 'Stichting Wielerevenementen Aalburg — jaarkosten website Velo Vital', 346.84, 'ontvangen'),
    ('202510-006', date '2025-10-01', 'Trappenfabriek Vermeulen — workshop op maat', 765.00, 'ontvangen'),
    ('202511-009', date '2025-11-01', 'Mariette Reineke — fase 1 aanpassingen website', 800.00, 'ontvangen'),
    ('202601-003', date '2026-01-01', 'Gemeente Breda — keynote 17 januari', 450.00, 'ontvangen'),
    ('202602-004', date '2026-02-01', 'Nieuwe kijk op werk — WebBasic', 4.95, 'ontvangen'),
    ('202603-005', date '2026-03-01', 'Nieuwe kijk op werk — WebBasic', 4.95, 'ontvangen'),
    ('202603-006', date '2026-03-01', 'Zjoske Kanters — website traject 50%', 1111.00, 'ontvangen'),
    ('202603-007', date '2026-03-01', 'Pam van Bruggen — basiscursus AI', 40.50, 'ontvangen'),
    ('202604-008', date '2026-04-01', 'Nieuwe kijk op werk — WebBasic', 4.95, 'ontvangen'),
    ('202604-009', date '2026-04-01', 'AgriFood Capital — uren strippenkaart (moderator)', 1160.00, 'ontvangen'),
    ('202604-010', date '2026-04-01', 'AgriFood Capital — 2x MKB Boost april', 1992.10, 'ontvangen'),
    ('202605-011', date '2026-05-01', 'Nieuwe kijk op werk — WebBasic', 4.95, 'ontvangen'),
    ('202605-012', date '2026-05-01', 'VLM — training Basis + Gevorderd', 1750.00, 'ontvangen'),
    ('202605-013', date '2026-05-01', 'AgriFood Capital — 2x MKB Boost mei', 1307.50, 'ontvangen'),
    ('202605-014', date '2026-05-01', 'Unbeatable PT — website + e-mailbeheer', 270.00, 'ontvangen'),
    ('202606-015', date '2026-06-01', 'Nieuwe kijk op werk — WebBasic', 4.95, 'ontvangen'),
    ('202606-016', date '2026-06-01', 'Lindenhaeghe — PE SEH AI in de adviespraktijk', 800.00, 'ontvangen'),
    ('202606-019', date '2026-06-01', 'VLM — moderator zomerevent', 750.00, 'ontvangen'),
    ('202606-020', date '2026-06-01', 'Motivra — programma', 516.46, 'ontvangen'),
    ('202607-021', date '2026-07-01', 'Nieuwe kijk op werk — WebBasic', 4.95, 'ontvangen'),
    ('202607-022', date '2026-06-01', 'AgriFood Capital — 2x MKB Boost juni', 1429.12, 'ontvangen'),
    ('202607-023', date '2026-07-01', 'Lindenhaeghe — AI Expert Class', 800.00, 'ontvangen'),
    ('202607-024', date '2026-07-01', 'Lindenhaeghe — feedback opzet AI Expertclass', 200.00, 'ontvangen'),
    ('202607-025', date '2026-07-01', 'Zjoske Kanters — oplevering website (50%)', 1111.00, 'gefactureerd'),
    ('202608-026', date '2026-08-01', 'Nieuwe kijk op werk — WebBasic', 4.95, 'gefactureerd'),
    ('202608-029', date '2026-08-01', 'Stichting Wielerevenementen Aalburg — jaarkosten website', 445.50, 'ontvangen'),
    ('202608-030', date '2026-08-01', 'Nederlands Compliance Instituut — e-learning AI', 562.50, 'ontvangen'),
    ('202609-031', date '2026-09-01', 'Nieuwe kijk op werk — WebBasic', 4.95, 'ontvangen'),
    ('202609-032', date '2026-09-01', 'Stichting Wielerevenementen Aalburg — jaarkosten website', 445.50, 'ontvangen'),
    ('202610-033', date '2026-10-01', 'Nieuwe kijk op werk — WebBasic', 4.95, 'gefactureerd'),
    ('202610-034', date '2026-10-01', 'AgriFood Capital — 2 MKB Boost september', 2264.20, 'ontvangen'),
    ('202610-035', date '2026-10-01', 'Lindenhaeghe — AI Expert Class', 800.00, 'gefactureerd'),
    ('202610-038', date '2026-10-01', 'AgriFood Capital — AI workshop 22-10', 390.00, 'ontvangen'),
    ('202610-041', date '2026-10-01', 'Training & Development by Eric — AI workshop', 195.00, 'ontvangen')
),
l as (
  select *, row_number() over (partition by bedrag, extract(year from datum) order by datum, factuur) as rn
  from jortt
),
d as (
  select id, date, vendor, description, round(amount::numeric, 2) as amount, payment_status,
         row_number() over (partition by round(amount::numeric, 2), extract(year from date) order by date, id) as rn
  from finance_entries
  where owner = 'Karin' and type = 'income' and payment_status in ('ontvangen', 'gefactureerd')
)
select l.factuur, l.datum, l.klant, l.bedrag, l.status as status_jortt,
       d.id as dashboard_id, d.payment_status as status_dashboard,
       case when d.id is null then 'ONTBREEKT'
            when d.payment_status <> l.status then 'STATUS ANDERS'
            else 'ok' end as uitkomst
from l
left join d on d.amount = l.bedrag and extract(year from d.date) = extract(year from l.datum) and d.rn = l.rn
union all
select null, d.date, coalesce(d.vendor, d.description), d.amount, null, d.id, d.payment_status, 'ALLEEN IN DASHBOARD'
from d
where not exists (
  select 1 from l where l.bedrag = d.amount and extract(year from l.datum) = extract(year from d.date) and l.rn = d.rn
)
order by 2;
