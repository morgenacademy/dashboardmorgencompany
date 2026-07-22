import assert from 'node:assert/strict';
import { analyseModel } from '../src/ui/analyse.js';

const db = {
  customers: [
    { id: 'c1', name: 'Alfa', industry: 'E-commerce / retail' },
    { id: 'c2', name: 'Beta', industry: '' },
  ],
  projects: [
    { id: 'p1', customer_id: 'c1', service_label: 'build', channel: 'direct',
      lead_source: 'netwerk', pipeline_status: 'afgerond', value_amount: 6184 },
    { id: 'p2', customer_id: 'c1', service_label: 'implement', channel: 'michielpro',
      lead_source: 'netwerk', pipeline_status: 'offerte_verzonden', value_amount: 32000 },
    // geaccepteerde deal: toegezegd werk, nog niet gefactureerd
    { id: 'p3', customer_id: 'c1', service_label: 'train', channel: 'direct',
      lead_source: 'netwerk', pipeline_status: 'geaccepteerd', value_amount: 1500 },
  ],
  finance: [
    // omzet
    { id: 'f1', type: 'income', project_id: 'p1', amount: 6184, date: '2026-07-15',
      payment_status: 'ontvangen', description: 'SoloSolis' },
    // kosten: projectgebonden
    { id: 'e1', type: 'expense', project_id: 'p1', amount: 100, date: '2026-03-01',
      payment_status: 'verwacht', recurring: 'one_off', source: 'bank_export',
      category: 'Software/SaaS', vendor: 'Airtable' },
    // kosten: overhead
    { id: 'e2', type: 'expense', project_id: null, amount: 50, date: '2026-03-01',
      payment_status: 'verwacht', recurring: 'one_off', source: 'bank_export',
      category: 'AI/API credits', vendor: 'Anthropic' },
    // forecast-template: mag NIET als actual meetellen
    { id: 'e3', type: 'expense', project_id: null, amount: 999, date: '2026-01-01',
      payment_status: 'verwacht', recurring: 'monthly', source: 'manual',
      category: 'Software/SaaS', vendor: 'Run-rate' },
  ],
};

const m = analyseModel(db, { year: 2026 });

// Marge: omzet 6184 - kosten (100 + 50, NIET de 999-template) = netto 6034
assert.equal(m.marge.omzet, 6184);
assert.equal(m.marge.kosten, 150);
assert.equal(m.marge.netto, 6034);

// Kosten gesplitst: projectgebonden 100 (op build), overhead 50
assert.equal(m.marge.projectgebonden, 100);
assert.equal(m.marge.overhead, 50);
assert.equal(m.marge.perLabel.build, 100);

// Veredeling: build betaald 6184, implement open offerte 32000
const build = m.veredeling.find((r) => r.label === 'build');
assert.equal(build.betaald, 6184);
const implement = m.veredeling.find((r) => r.label === 'implement');
assert.equal(implement.open, 32000);

// Kanaal: michielpro heeft 32000 open (de onzichtbare offerte is nu zichtbaar)
const mp = m.kanalen.channel.find((r) => r.channel === 'michielpro');
assert.equal(mp.open, 32000);

// Geaccepteerd: train-label heeft 1500 toegezegd (p3), los van betaald/open
const train = m.veredeling.find((r) => r.label === 'train');
assert.equal(train.geaccepteerd, 1500);
assert.equal(train.open, 0);
// build heeft geen geaccepteerd (p1 is afgerond)
assert.equal(build.geaccepteerd, 0);
// sector Retail: geaccepteerd 1500 (p3), sector-kanaal-lijn heeft het ook
const retail = m.sectoren.find((r) => r.sector === 'E-commerce / retail');
assert.equal(retail.geaccepteerd, 1500);
// kanaal direct: geaccepteerd 1500
const direct = m.kanalen.channel.find((r) => r.channel === 'direct');
assert.equal(direct.geaccepteerd, 1500);
// lead netwerk: geaccepteerd 1500
const netwerk = m.kanalen.lead.find((r) => r.source === 'netwerk');
assert.equal(netwerk.geaccepteerd, 1500);

import { analyseGaps } from '../src/ui/analyse.js';

const gapDb = {
  customers: [
    { id: 'c1', name: 'Vermeulen', industry: '' },
    { id: 'c2', name: 'Trappenfabriek Vermeulen B.V.', industry: 'Industrie' },
    { id: 'c3', name: 'Gamma', industry: 'Overheid' },
  ],
  projects: [
    // label ontbreekt: other + niet reviewed
    { id: 'p1', customer_id: 'c3', name: 'Geen label', service_label: 'other',
      label_reviewed: false, channel: 'direct', pipeline_status: 'geaccepteerd', value_amount: 500 },
    // afgeleid maar onbevestigd: train + niet reviewed
    { id: 'p2', customer_id: 'c3', name: 'Geraden train', service_label: 'train',
      label_reviewed: false, channel: 'direct', pipeline_status: 'offerte_verzonden', value_amount: 800 },
    // bevestigd: telt niet als gat
    { id: 'p3', customer_id: 'c3', name: 'Bevestigd', service_label: 'build',
      label_reviewed: true, channel: 'direct', pipeline_status: 'afgerond', value_amount: 900 },
    // bedrag ontbreekt: offerte met 0
    { id: 'p4', customer_id: 'c3', name: 'Geen bedrag', service_label: 'build',
      label_reviewed: true, channel: 'direct', pipeline_status: 'offerte_verzonden', value_amount: 0 },
    // kanaal ontbreekt: channel leeg
    { id: 'p5', customer_id: 'c3', name: 'Geen kanaal', service_label: 'build',
      label_reviewed: true, channel: '', pipeline_status: 'afgerond', value_amount: 100 },
  ],
  finance: [],
};

const g = analyseGaps(gapDb);

// label: p1 (geen) + p2 (geraden), niet p3
assert.equal(g.labelOntbreekt.length, 2);
assert.ok(g.labelOntbreekt.some((x) => x.id === 'p1' && x.afgeleid === false));
assert.ok(g.labelOntbreekt.some((x) => x.id === 'p2' && x.afgeleid === true));

// sector: alleen c1 (leeg)
assert.equal(g.sectorOntbreekt.length, 1);
assert.equal(g.sectorOntbreekt[0].id, 'c1');

// bedrag: alleen p4
assert.equal(g.bedragOntbreekt.length, 1);
assert.equal(g.bedragOntbreekt[0].id, 'p4');

// kanaal: alleen p5
assert.equal(g.kanaalOntbreekt.length, 1);
assert.equal(g.kanaalOntbreekt[0].id, 'p5');

// dubbele klant: Vermeulen ~ Trappenfabriek Vermeulen B.V.
assert.equal(g.dubbeleKlant.length, 1);
assert.deepEqual(
  g.dubbeleKlant[0].map((c) => c.id).sort(),
  ['c1', 'c2'],
);

console.log('analyse-model: OK');
