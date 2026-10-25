import assert from 'node:assert/strict';
import { afsluitingModel } from '../src/ui/afsluiting.js';

const near = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 0.005, `${msg}: ${actual} ≠ ${expected}`);

// --- Het rekenvoorbeeld van Harmen: 30k/12k bij Harmen, 20k/8k bij Karin → 3.000 van Harmen naar Karin.
{
  const db = {
    finance: [
      { id: 'i1', type: 'income', owner: 'Harmen', entity: 'Morgen', amount: 30000, date: '2026-03-01', payment_status: 'ontvangen' },
      { id: 'e1', type: 'expense', owner: 'Harmen', entity: 'Morgen', amount: 12000, date: '2026-03-01', source: 'bank_export', recurring: 'one_off' },
      { id: 'i2', type: 'income', owner: 'Karin', entity: 'Morgen', amount: 20000, date: '2026-03-01', payment_status: 'ontvangen' },
      { id: 'e2', type: 'expense', owner: 'Karin', entity: 'Karin', amount: 8000, date: '2026-03-01', source: 'invoice', recurring: 'one_off' },
    ],
    settlements: [],
  };
  const m = afsluitingModel(db);
  near(m.personen.Harmen.netto, 18000, 'netto Harmen');
  near(m.personen.Karin.netto, 12000, 'netto Karin');
  near(m.verschuldigd, 3000, 'Harmen is Karin 3.000 verschuldigd');
  near(m.resterend, 3000, 'nog niets verrekend');
  assert.equal(m.richting.van, 'Harmen');
  assert.equal(m.richting.naar, 'Karin');
  near(m.richting.bedrag, 3000, 'over te maken');
}

// --- Wat wel en niet meetelt.
{
  const db = {
    finance: [
      // telt: ontvangen omzet (ex btw)
      { id: 'i1', type: 'income', owner: 'Harmen', entity: 'Morgen', amount: 1000, date: '2025-10-01', payment_status: 'ontvangen' },
      // open: gefactureerd, niet in het saldo
      { id: 'i2', type: 'income', owner: 'Harmen', entity: 'Morgen', amount: 500, date: '2026-10-05', payment_status: 'gefactureerd' },
      // telt niet: toegezegd, nog niet gefactureerd
      { id: 'i3', type: 'income', owner: 'Harmen', entity: 'Morgen', amount: 9999, date: '2026-07-10', payment_status: 'verwacht' },
      // telt niet: na 31-12-2026
      { id: 'i4', type: 'income', owner: 'Karin', entity: 'Morgen', amount: 7777, date: '2027-01-02', payment_status: 'ontvangen' },
      // kosten met btw: telt ex btw (121 - 21 = 100)
      { id: 'e1', type: 'expense', owner: 'Harmen', entity: 'Morgen', amount: 121, vat_amount: 21, date: '2026-08-19', source: 'bank_export', recurring: 'one_off' },
      // kosten zonder btw-veld (buitenlandse SaaS): telt volledig
      { id: 'e2', type: 'expense', owner: 'Harmen', entity: 'Morgen', amount: 50, date: '2026-09-03', source: 'bank_export', recurring: 'monthly' },
      // telt niet: eigen BV-kosten, geen Morgen
      { id: 'e3', type: 'expense', owner: 'Harmen', entity: 'HvH BV', amount: 1227.27, date: '2025-09-29', source: 'invoice', recurring: 'one_off' },
      // telt niet: prognose-template (manual + monthly)
      { id: 'e4', type: 'expense', owner: 'Karin', entity: 'Karin', amount: 54.1, date: '2026-01-01', source: 'manual', recurring: 'monthly' },
      // telt wel, maar is geschat (manual)
      { id: 'e5', type: 'expense', owner: 'Karin', entity: 'Karin', amount: 10, date: '2026-02-01', source: 'manual', recurring: 'one_off' },
      // telt wel, maar is geschat (SCHATTING in omschrijving)
      { id: 'e6', type: 'expense', owner: 'Harmen', entity: 'Morgen', amount: 16.59, date: '2026-10-14', source: 'invoice', recurring: 'monthly', description: 'Make (USD 18,82) SCHATTING o.b.v. sep-koers' },
    ],
    settlements: [],
  };
  const m = afsluitingModel(db);
  const h = m.personen.Harmen;
  const k = m.personen.Karin;
  near(h.binnen, 1000, 'alleen ontvangen omzet telt');
  near(h.open, 500, 'gefactureerd staat apart als open');
  near(h.uit, 100 + 50 + 16.59, 'kosten ex btw, zonder BV-eigen');
  near(h.btw, 21, 'btw apart zichtbaar');
  near(k.binnen, 0, 'Karin: omzet na 2026 telt niet');
  near(k.uit, 10, 'Karin: prognose-template telt niet');
  assert.equal(h.geschat.aantal, 1, 'Harmen: één geschatte post');
  near(h.geschat.bedrag, 16.59, 'Harmen: geschat bedrag');
  assert.equal(k.geschat.aantal, 1, 'Karin: één geschatte post');
  assert.ok(h.inkomsten.every((r) => r.payment_status === 'ontvangen'), 'inkomstenlijst bevat alleen ontvangen');
  assert.equal(h.openFacturen.length, 1);
  // per jaar
  near(h.perJaar['2025'].binnen, 1000, 'Harmen 2025 binnen');
  near(h.perJaar['2026'].uit, 166.59, 'Harmen 2026 uit');
  // kosten per leverancier gegroepeerd
  assert.ok(Array.isArray(h.kostenPerLeverancier));
}

// --- Eerdere verrekeningen gaan van het resterende bedrag af, in beide richtingen.
{
  const base = [
    { id: 'i1', type: 'income', owner: 'Harmen', entity: 'Morgen', amount: 1000, date: '2026-01-01', payment_status: 'ontvangen' },
  ];
  // Harmen heeft netto 1000, Karin 0 → Harmen is Karin 500 verschuldigd.
  let m = afsluitingModel({ finance: base, settlements: [
    { id: 's1', date: '2025-04-10', from_person: 'Harmen', to_person: 'Karin', amount: 44, description: 'Factuur 202503-003' },
  ] });
  near(m.verschuldigd, 500, 'verschuldigd');
  near(m.alVerrekend, 44, 'al van Harmen naar Karin');
  near(m.resterend, 456, 'resterend na verrekening');

  m = afsluitingModel({ finance: base, settlements: [
    { id: 's2', date: '2026-02-01', from_person: 'Karin', to_person: 'Harmen', amount: 100 },
  ] });
  near(m.resterend, 600, 'betaling Karin → Harmen verhoogt wat Harmen moet');

  // Karin is per saldo verschuldigd → richting draait om
  m = afsluitingModel({ finance: [
    { id: 'i2', type: 'income', owner: 'Karin', entity: 'Morgen', amount: 800, date: '2026-01-01', payment_status: 'ontvangen' },
  ], settlements: [] });
  assert.equal(m.richting.van, 'Karin');
  assert.equal(m.richting.naar, 'Harmen');
  near(m.richting.bedrag, 400, 'Karin maakt 400 over');

  // Gelijk → geen richting
  m = afsluitingModel({ finance: [], settlements: [] });
  assert.equal(m.richting.van, null);
  near(m.richting.bedrag, 0, 'niets over te maken');
}

// --- Open facturen: saldo als alles betaald is.
{
  const m = afsluitingModel({ finance: [
    { id: 'i1', type: 'income', owner: 'Harmen', entity: 'Morgen', amount: 1000, date: '2026-01-01', payment_status: 'ontvangen' },
    { id: 'i2', type: 'income', owner: 'Harmen', entity: 'Morgen', amount: 400, date: '2026-10-05', payment_status: 'gefactureerd' },
    { id: 'i3', type: 'income', owner: 'Karin', entity: 'Morgen', amount: 200, date: '2026-07-03', payment_status: 'gefactureerd' },
  ], settlements: [] });
  near(m.resterend, 500, 'saldo op ontvangen');
  near(m.resterendInclOpen, 600, 'saldo als open facturen betaald zijn: (1400 - 200) / 2');
}

// --- Ontbrekende settlements-tabel: model werkt gewoon met een lege lijst.
{
  const m = afsluitingModel({ finance: [] });
  assert.deepEqual(m.verrekeningen, []);
}

console.log('test-afsluiting: alle checks groen');
