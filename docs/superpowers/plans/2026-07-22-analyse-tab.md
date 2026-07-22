# Analyse-tab met datakwaliteit-wizard — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een `#/analyse`-tab die de acquisitie-analyse live uit Supabase toont (veredeling, sectoren, kanalen, recurring, marge) en de datagaten (label, sector, bedrag, dubbele klant, kanaal) zichtbaar maakt en laat dichten.

**Architecture:** Pure rekenfuncties (`analyseModel`, `analyseGaps`) los van rendering in een nieuwe module `src/ui/analyse.js`, testbaar zonder DOM zoals `finance-model.js`. Label/kanaal-afleiding in een gedeelde `src/label-model.js` die zowel de sync als de app importeert. Twee nieuwe kolommen op `projects`. `app.js` krijgt alleen een nav-item, een route en de wizard-events.

**Tech Stack:** Buildless vanilla JS (ES-modules, geen bundler), Supabase via gevendorde client, `node:assert/strict` voor tests, Supabase MCP voor de migratie.

**Spec:** `docs/superpowers/specs/2026-07-22-analyse-tab-design.md`

---

## File Structure

- **Create** `src/label-model.js` — `PRODUCT_TYPE_TO_LABEL`, `deriveServiceLabel(productType)`, `deriveChannel(text)`. Pure, gedeeld door sync + app.
- **Create** `scripts/test-label-model.mjs` — test voor bovenstaande.
- **Create** `src/ui/analyse.js` — `analyseModel(db)`, `analyseGaps(db)`, `renderAnalyse(db)`.
- **Create** `scripts/test-analyse.mjs` — test voor `analyseModel` + `analyseGaps`.
- **Modify** `scripts/sync-acquisitie.mjs:699,701` — afgeleide `service_label` + `channel`, `label_reviewed: false`.
- **Modify** `src/app.js:1,7,1716,1737,1748` — import, nav-item, route, wizard-events.
- **Modify** `package.json` — `src/ui/analyse.js` en `src/label-model.js` in de lint-lijst.
- **Migratie** (Supabase MCP) — `projects.label_reviewed`, `projects.channel`.

---

## Task 1: Migratie — twee kolommen op `projects`

**Files:** geen (Supabase MCP, project ref `jeqvjtnxgxpjviwhjmzr`).

- [ ] **Step 1: Controleer dat de kolommen nog niet bestaan**

Gebruik de Supabase MCP `execute_sql`:
```sql
select column_name from information_schema.columns
where table_name = 'projects' and column_name in ('label_reviewed','channel');
```
Expected: 0 rijen.

- [ ] **Step 2: Voer de migratie uit**

Gebruik de Supabase MCP `apply_migration` met name `add_label_reviewed_and_channel`:
```sql
alter table projects
  add column label_reviewed boolean not null default false,
  add column channel text not null default 'direct'
    check (channel in ('direct','michielpro','karin'));
```

- [ ] **Step 3: Verifieer + backfill bestaande MichielPro-projecten**

De bestaande projecten met een MichielPro-factuur krijgen meteen het juiste kanaal, zodat de analyse klopt vanaf dag één:
```sql
update projects p set channel = 'michielpro'
where exists (
  select 1 from finance_entries f
  where f.project_id = p.id and f.description ilike '%michielpro%'
);
select channel, count(*) from projects group by 1;
```
Expected: een handvol `michielpro` (PinkRoccade, Onview, PharmaPartners), rest `direct`.

- [ ] **Step 4: Markeer bestaande labels als reviewed**

Alle projecten die nu al een niet-`other` label hebben, of bewust `other` zijn, zijn met de hand gecontroleerd — die hoeven niet in de wizard te verschijnen:
```sql
update projects set label_reviewed = true
where service_label <> 'other'
   or product_type = 'samenwerking';
select label_reviewed, service_label, count(*) from projects group by 1,2 order by 1,2;
```
Expected: alleen de niet-samenwerking `other`-projecten houden `label_reviewed = false` (nu 0, want net opgeruimd).

---

## Task 2: `src/label-model.js` — afleiding van label & kanaal

**Files:**
- Create: `src/label-model.js`
- Test: `scripts/test-label-model.mjs`

- [ ] **Step 1: Schrijf de falende test**

Create `scripts/test-label-model.mjs`:
```js
import assert from 'node:assert/strict';
import { deriveServiceLabel, deriveChannel, PRODUCT_TYPE_TO_LABEL } from '../src/label-model.js';

// product_type -> service_label
assert.equal(deriveServiceLabel('automatisering'), 'build');
assert.equal(deriveServiceLabel('abonnement'), 'build');
assert.equal(deriveServiceLabel('training'), 'train');
assert.equal(deriveServiceLabel('strategie'), 'implement');
assert.equal(deriveServiceLabel('programma'), 'implement');
assert.equal(deriveServiceLabel('samenwerking'), 'other');
assert.equal(deriveServiceLabel('other'), 'other');
assert.equal(deriveServiceLabel(undefined), 'other');
assert.equal(deriveServiceLabel('onbekend-type'), 'other');

// mapping is data, niet alleen functie
assert.equal(PRODUCT_TYPE_TO_LABEL.training, 'train');

// kanaal uit tekst
assert.equal(deriveChannel('Factuur 260708_michielpro_invoice_claudecode'), 'michielpro');
assert.equal(deriveChannel('MichielPro training'), 'michielpro');
assert.equal(deriveChannel('Gewone offerte'), 'direct');
assert.equal(deriveChannel(''), 'direct');
assert.equal(deriveChannel(null), 'direct');

console.log('label-model: OK');
```

- [ ] **Step 2: Run test, verwacht falen**

Run: `node scripts/test-label-model.mjs`
Expected: FAIL — `Cannot find module '../src/label-model.js'`.

- [ ] **Step 3: Schrijf de implementatie**

Create `src/label-model.js`:
```js
// Gedeeld door de acquisitie-sync en de Analyse-tab, zodat er één afleiding is.
// service_label kent 5 waarden: inspire, build, train, implement, other.
// LET OP: 'training' -> 'train' is de meerderheid, maar keynotes/inspiratie zitten
// óók onder product_type 'training' en horen 'inspire'. De sync zet daarom
// label_reviewed=false op afgeleide labels, zodat 'train' langs de wizard komt.
export const PRODUCT_TYPE_TO_LABEL = {
  automatisering: 'build',
  abonnement: 'build',
  training: 'train',
  strategie: 'implement',
  programma: 'implement',
  samenwerking: 'other',
  other: 'other',
};

export function deriveServiceLabel(productType) {
  return PRODUCT_TYPE_TO_LABEL[productType] || 'other';
}

export function deriveChannel(text) {
  return /michielpro/i.test(String(text || '')) ? 'michielpro' : 'direct';
}
```

- [ ] **Step 4: Run test, verwacht slagen**

Run: `node scripts/test-label-model.mjs`
Expected: `label-model: OK`.

- [ ] **Step 5: Commit**

```bash
git add src/label-model.js scripts/test-label-model.mjs
git commit -m "feat(label): gedeelde afleiding van service_label en channel"
```

---

## Task 3: Sync — afgeleide label & kanaal bij nieuwe projecten

**Files:**
- Modify: `scripts/sync-acquisitie.mjs` (import bovenaan; inserts op regel ~699 en ~701)

- [ ] **Step 1: Importeer de helpers**

Voeg bovenaan `scripts/sync-acquisitie.mjs` toe, bij de overige imports:
```js
import { deriveServiceLabel, deriveChannel } from '../src/label-model.js';
```

- [ ] **Step 2: Pas de offerte-insert aan (regel ~699)**

Vervang in de `else toInsert.push({ ... })` voor offerte-projecten `service_label: 'other'` door de afleiding, en voeg `channel` + `label_reviewed` toe. De sleutelvelden worden:
```js
    else toInsert.push({ id: r.id, customer_id: r.customer_id, name: r.name, description: '', pipeline_status: r.pipeline_status, product_type: r.product_type, service_label: deriveServiceLabel(r.product_type), label_reviewed: false, channel: deriveChannel(`${r.name} ${r.hay || ''}`), forecast_amount: r.forecast_amount || 0, actual_amount: 0, value_amount: r.forecast_amount || 0, pricing_model: 'project', priority: 'medium', owner: r.owner || 'Harmen', lead_source: 'netwerk', is_breakthrough: false, estimated_hours: 0, start_date: r.date || null, accepted_date: r.pipeline_status === 'geaccepteerd' ? (r.date || null) : null, next_action: '', next_action_date: null });
```

- [ ] **Step 3: Pas de invoice-insert aan (regel ~701)**

Voor factuur-projecten (`invNewProjects`) blijft `product_type: 'other'` (er is geen betere hint), maar het kanaal is wél af te leiden uit de projectnaam:
```js
  for (const p of invNewProjects) toInsert.push({ id: p.id, customer_id: p.customer_id, name: p.name, description: '', pipeline_status: p.pipeline_status, product_type: 'other', service_label: 'other', label_reviewed: false, channel: deriveChannel(p.name), forecast_amount: 0, actual_amount: 0, value_amount: 0, pricing_model: 'project', priority: 'medium', owner: p.owner || 'Karin', lead_source: 'netwerk', is_breakthrough: false, estimated_hours: 0, start_date: null, accepted_date: null, next_action: '', next_action_date: null });
```

- [ ] **Step 4: Syntaxcheck**

Run: `node --check scripts/sync-acquisitie.mjs`
Expected: geen output (exit 0).

- [ ] **Step 5: Dry-run — verifieer dat er niets breekt**

Run: `node scripts/sync-acquisitie.mjs --dry`
Expected: draait door tot de `DRY: … Niets geschreven.`-regel, geen crash. De nieuwe projecten (Velo Vital) tonen een afgeleid label i.p.v. altijd `other`.

- [ ] **Step 6: Regressietest sync draait nog**

Run: `node scripts/test-sync-unreadable.mjs`
Expected: bestaande sync-test slaagt (geen regressie door de import).

- [ ] **Step 7: Commit**

```bash
git add scripts/sync-acquisitie.mjs
git commit -m "feat(sync): leidt service_label en channel af bij nieuwe projecten"
```

---

## Task 4: `analyseModel(db)` — de rekenkern

**Files:**
- Create: `src/ui/analyse.js`
- Test: `scripts/test-analyse.mjs`

- [ ] **Step 1: Schrijf de falende test**

Create `scripts/test-analyse.mjs`:
```js
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

console.log('analyse-model: OK');
```

- [ ] **Step 2: Run test, verwacht falen**

Run: `node scripts/test-analyse.mjs`
Expected: FAIL — `Cannot find module '../src/ui/analyse.js'`.

- [ ] **Step 3: Schrijf `analyseModel`**

Create `src/ui/analyse.js` (alleen `analyseModel` in deze task; `analyseGaps` en `renderAnalyse` volgen):
```js
// Pure rekenkern voor de Analyse-tab. Geen DOM, testbaar zoals finance-model.js.
// 'finance' is de cache-key voor finance_entries (zie store.js).

const COMMITTED = ['geaccepteerd', 'uitvoering', 'afgerond'];
const OPEN_OFFERTE = ['offerte_verzonden'];
const LABELS = ['inspire', 'build', 'train', 'implement', 'other'];

function isForecastTemplate(e) {
  return e.type === 'expense' && e.recurring === 'monthly' && e.source === 'manual';
}
function inYear(dateStr, year) {
  return typeof dateStr === 'string' && dateStr.slice(0, 4) === String(year);
}

export function analyseModel(db, { year = new Date().getFullYear() } = {}) {
  const projects = db.projects || [];
  const customers = db.customers || [];
  const finance = db.finance || [];
  const custById = Object.fromEntries(customers.map((c) => [c.id, c]));
  const projById = Object.fromEntries(projects.map((p) => [p.id, p]));

  const income = finance.filter((f) => f.type === 'income' && inYear(f.date, year));
  const paidBy = (pred) => income.filter(pred).reduce((s, f) => s + Number(f.amount || 0), 0);
  const sumByProject = (projFilter, statusFilter) =>
    income.filter((f) => statusFilter(f.payment_status) && projFilter(projById[f.project_id]))
      .reduce((s, f) => s + Number(f.amount || 0), 0);
  const openOffertes = (projFilter) => projects
    .filter((p) => OPEN_OFFERTE.includes(p.pipeline_status) && projFilter(p))
    .reduce((s, p) => s + Number(p.value_amount || 0), 0);

  const isPaid = (st) => st === 'ontvangen';
  const isInvoiced = (st) => st === 'gefactureerd';

  // ---- Veredeling per label ----
  const veredeling = LABELS.map((label) => ({
    label,
    betaald: sumByProject((p) => p && p.service_label === label, isPaid),
    gefactureerd: sumByProject((p) => p && p.service_label === label, isInvoiced),
    open: openOffertes((p) => p.service_label === label),
  }));

  // ---- Sectoren ----
  const sectorNames = [...new Set(customers.map((c) => c.industry).filter(Boolean))];
  const sectorOf = (p) => (p && custById[p.customer_id]?.industry) || '';
  const sectoren = sectorNames.map((sector) => ({
    sector,
    gerealiseerd: sumByProject((p) => sectorOf(p) === sector, (st) => isPaid(st) || isInvoiced(st)),
    open: projects.filter((p) => OPEN_OFFERTE.includes(p.pipeline_status) && sectorOf(p) === sector)
      .reduce((s, p) => s + Number(p.value_amount || 0), 0),
  })).sort((a, b) => (b.gerealiseerd + b.open) - (a.gerealiseerd + a.open));

  // ---- Kanalen: lead_source én channel ----
  const bySource = (src) => ({
    source: src,
    projecten: projects.filter((p) => p.lead_source === src).length,
    gerealiseerd: sumByProject((p) => p && p.lead_source === src, (st) => isPaid(st) || isInvoiced(st)),
    open: openOffertes((p) => p.lead_source === src),
  });
  const byChannel = (ch) => ({
    channel: ch,
    betaald: sumByProject((p) => p && (p.channel || 'direct') === ch, isPaid),
    gefactureerd: sumByProject((p) => p && (p.channel || 'direct') === ch, isInvoiced),
    open: openOffertes((p) => (p.channel || 'direct') === ch),
  });
  const kanalen = {
    lead: ['netwerk', 'buiten_netwerk'].map(bySource),
    channel: ['direct', 'michielpro', 'karin'].map(byChannel),
  };

  // ---- Recurring: feitelijke herhaalomzet (headline) ----
  const monthsByCustomer = {};
  for (const f of income) {
    if (!isPaid(f.payment_status) && !isInvoiced(f.payment_status)) continue;
    const cust = projById[f.project_id]?.customer_id;
    if (!cust) continue;
    (monthsByCustomer[cust] ||= { months: new Set(), total: 0 });
    monthsByCustomer[cust].months.add(f.date.slice(0, 7));
    monthsByCustomer[cust].total += Number(f.amount || 0);
  }
  const herhaalKlanten = Object.entries(monthsByCustomer)
    .filter(([, v]) => v.months.size > 1)
    .map(([cust, v]) => ({ klant: custById[cust]?.name || cust, maanden: v.months.size, bedrag: v.total }))
    .sort((a, b) => b.bedrag - a.bedrag);
  const herhaalTotaal = herhaalKlanten.reduce((s, k) => s + k.bedrag, 0);
  const omzetTotaal = paidBy((f) => isPaid(f.payment_status) || isInvoiced(f.payment_status));
  const contractueelMnd = projects
    .filter((p) => p.pricing_model === 'recurring_monthly')
    .reduce((s, p) => s + Number(p.value_amount || 0), 0);

  // ---- Marge: omzet - werkelijke kosten ----
  const expenses = finance.filter((f) => f.type === 'expense' && !isForecastTemplate(f) && inYear(f.date, year));
  const kosten = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const projectgebonden = expenses.filter((e) => e.project_id).reduce((s, e) => s + Number(e.amount || 0), 0);
  const perLabel = {};
  for (const e of expenses) {
    if (!e.project_id) continue;
    const label = projById[e.project_id]?.service_label || 'other';
    perLabel[label] = (perLabel[label] || 0) + Number(e.amount || 0);
  }
  const kostenCategorie = {};
  for (const e of expenses) {
    const cat = e.category || '— geen —';
    kostenCategorie[cat] = (kostenCategorie[cat] || 0) + Number(e.amount || 0);
  }
  const betaaldOmzet = paidBy((f) => isPaid(f.payment_status));

  return {
    year,
    veredeling,
    sectoren,
    kanalen,
    recurring: { herhaalKlanten, herhaalTotaal, omzetTotaal, contractueelMnd },
    marge: {
      omzet: betaaldOmzet,
      kosten,
      netto: betaaldOmzet - kosten,
      margePct: betaaldOmzet ? (1 - kosten / betaaldOmzet) * 100 : 0,
      projectgebonden,
      overhead: kosten - projectgebonden,
      perLabel,
      categorie: Object.entries(kostenCategorie).map(([naam, bedrag]) => ({ naam, bedrag }))
        .sort((a, b) => b.bedrag - a.bedrag),
    },
  };
}
```

- [ ] **Step 4: Run test, verwacht slagen**

Run: `node scripts/test-analyse.mjs`
Expected: `analyse-model: OK`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/analyse.js scripts/test-analyse.mjs
git commit -m "feat(analyse): analyseModel rekenkern met marge en kanalen"
```

---

## Task 5: `analyseGaps(db)` — de vijf datakwaliteit-checks

**Files:**
- Modify: `src/ui/analyse.js` (functie toevoegen)
- Modify: `scripts/test-analyse.mjs` (test toevoegen)

- [ ] **Step 1: Breid de test uit**

Voeg onderaan `scripts/test-analyse.mjs` toe (vóór de laatste `console.log`):
```js
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
```

- [ ] **Step 2: Run test, verwacht falen**

Run: `node scripts/test-analyse.mjs`
Expected: FAIL — `analyseGaps is not a function` (of import-fout).

- [ ] **Step 3: Voeg `analyseGaps` toe aan `src/ui/analyse.js`**

```js
const OPEN_STAGES = ['offerte_verzonden', 'geaccepteerd'];

// Genormaliseerde naam voor de dubbele-klant-heuristiek.
function normName(name) {
  return String(name || '').toLowerCase()
    .replace(/\b(b\.?v\.?|bv|the|de|het)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export function analyseGaps(db) {
  const projects = db.projects || [];
  const customers = db.customers || [];

  // 1 + afgeleid: service_label niet bevestigd. 'other' = geen label, anders = geraden.
  const labelOntbreekt = projects
    .filter((p) => p.label_reviewed === false)
    .map((p) => ({ id: p.id, name: p.name, service_label: p.service_label,
      afgeleid: p.service_label !== 'other', value_amount: Number(p.value_amount || 0) }))
    .sort((a, b) => b.value_amount - a.value_amount);

  // 2: sector leeg
  const sectorOntbreekt = customers
    .filter((c) => !c.industry)
    .map((c) => ({ id: c.id, name: c.name }));

  // 3: offerte met bedrag 0
  const bedragOntbreekt = projects
    .filter((p) => OPEN_STAGES.includes(p.pipeline_status) && Number(p.value_amount || 0) === 0)
    .map((p) => ({ id: p.id, name: p.name }));

  // 4: kanaal leeg (default 'direct' zou gezet moeten zijn; leeg = data-anomalie)
  const kanaalOntbreekt = projects
    .filter((p) => !p.channel)
    .map((p) => ({ id: p.id, name: p.name }));

  // 5: dubbele klant — genormaliseerde naam A substring van B (alleen signaleren)
  const dubbeleKlant = [];
  for (let i = 0; i < customers.length; i++) {
    for (let j = i + 1; j < customers.length; j++) {
      const a = normName(customers[i].name);
      const b = normName(customers[j].name);
      if (!a || !b) continue;
      if (a === b || a.includes(b) || b.includes(a)) {
        dubbeleKlant.push([customers[i], customers[j]]);
      }
    }
  }

  return { labelOntbreekt, sectorOntbreekt, bedragOntbreekt, kanaalOntbreekt, dubbeleKlant };
}
```

- [ ] **Step 4: Run test, verwacht slagen**

Run: `node scripts/test-analyse.mjs`
Expected: `analyse-model: OK`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/analyse.js scripts/test-analyse.mjs
git commit -m "feat(analyse): analyseGaps met vijf datakwaliteit-checks"
```

---

## Task 6: `renderAnalyse(db)` — de pagina

**Files:**
- Modify: `src/ui/analyse.js` (render + kleine helpers)

Rendering gebruikt bestaande stijl-conventies (template-literals, `escapeHtml`). Omdat
`escapeHtml`/`fmtCurrency` in `app.js` leven, krijgt `renderAnalyse` de formatters als
parameter mee vanuit `app.js` (geen circulaire import).

- [ ] **Step 1: Voeg `renderAnalyse` toe aan `src/ui/analyse.js`**

```js
export function renderAnalyse(db, { fmtCurrency, escapeHtml, year = new Date().getFullYear() } = {}) {
  const m = analyseModel(db, { year });
  const g = analyseGaps(db);
  const eur = (n) => fmtCurrency(n || 0);
  const esc = (s) => escapeHtml(String(s ?? ''));

  const bar = (label, sub, value, max, extra = '') => {
    const w = max > 0 ? Math.max(0, (value / max) * 100) : 0;
    return `<div class="an-row">
      <div class="an-row__label"><span>${esc(label)}</span>${sub ? `<em>${esc(sub)}</em>` : ''}</div>
      <div class="an-row__track"><span style="width:${w.toFixed(2)}%">${extra}</span></div>
      <div class="an-row__val">${eur(value)}</div>
    </div>`;
  };

  // ---- Veredeling ----
  const maxVer = Math.max(1, ...m.veredeling.map((r) => r.betaald + r.gefactureerd + r.open));
  const veredelingHtml = m.veredeling.filter((r) => r.betaald + r.gefactureerd + r.open > 0)
    .map((r) => bar(r.label, null, r.betaald + r.gefactureerd + r.open, maxVer)).join('');

  // ---- Sectoren ----
  const maxSec = Math.max(1, ...m.sectoren.map((r) => r.gerealiseerd + r.open));
  const sectorHtml = m.sectoren.map((r) => bar(r.sector, null, r.gerealiseerd + r.open, maxSec)).join('');

  // ---- Kanalen ----
  const kanaalHtml = m.kanalen.channel.filter((r) => r.betaald + r.gefactureerd + r.open > 0)
    .map((r) => bar(r.channel, null, r.betaald + r.gefactureerd + r.open,
      Math.max(1, ...m.kanalen.channel.map((x) => x.betaald + x.gefactureerd + x.open)))).join('');
  const leadHtml = m.kanalen.lead.map((r) => bar(r.source, `${r.projecten} projecten`,
    r.gerealiseerd, Math.max(1, ...m.kanalen.lead.map((x) => x.gerealiseerd)))).join('');

  // ---- Recurring (feitelijk = headline; contractueel = voetnoot) ----
  const recRows = m.recurring.herhaalKlanten
    .map((k) => `<tr><td>${esc(k.klant)}</td><td class="num">${k.maanden}</td><td class="num">${eur(k.bedrag)}</td></tr>`)
    .join('');
  const herhaalPct = m.recurring.omzetTotaal ? (m.recurring.herhaalTotaal / m.recurring.omzetTotaal * 100) : 0;

  // ---- Marge ----
  const margeCat = m.marge.categorie
    .map((c) => bar(c.naam, null, c.bedrag, Math.max(1, ...m.marge.categorie.map((x) => x.bedrag)))).join('');
  const perLabelHtml = Object.entries(m.marge.perLabel)
    .map(([lbl, v]) => `<li>${esc(lbl)}: <strong>${eur(v)}</strong></li>`).join('') || '<li>Geen projectgebonden kosten</li>';

  // ---- Gap-blok ----
  const gapCount = g.labelOntbreekt.length + g.sectorOntbreekt.length + g.bedragOntbreekt.length
    + g.kanaalOntbreekt.length + g.dubbeleKlant.length;

  const labelItems = g.labelOntbreekt.map((p) => `<li data-gap="label" data-id="${esc(p.id)}">
    <span>${esc(p.name)}</span>
    ${p.afgeleid ? `<em>sync raadde <strong>${esc(p.service_label)}</strong> — klopt dit?</em>` : '<em>geen label</em>'}
    <select data-action="gap-label" data-id="${esc(p.id)}">
      ${['inspire', 'build', 'train', 'implement', 'other'].map((l) =>
        `<option value="${l}"${l === p.service_label ? ' selected' : ''}>${l}</option>`).join('')}
    </select>
    <button type="button" class="button ghost" data-action="gap-label-ok" data-id="${esc(p.id)}">${p.afgeleid ? 'klopt' : 'hoort zo'}</button>
  </li>`).join('');

  const sectorItems = g.sectorOntbreekt.map((c) => `<li>
    <span>${esc(c.name)}</span>
    <input list="an-sectors" data-action="gap-sector" data-id="${esc(c.id)}" placeholder="sector…" />
  </li>`).join('');
  const sectorDatalist = `<datalist id="an-sectors">${
    [...new Set((db.customers || []).map((c) => c.industry).filter(Boolean))]
      .map((s) => `<option value="${esc(s)}">`).join('')}</datalist>`;

  const bedragItems = g.bedragOntbreekt.map((p) => `<li>
    <span>${esc(p.name)}</span>
    <input type="number" step="1" data-action="gap-bedrag" data-id="${esc(p.id)}" placeholder="bedrag €" />
  </li>`).join('');

  const kanaalItems = g.kanaalOntbreekt.map((p) => `<li>
    <span>${esc(p.name)}</span>
    <select data-action="gap-kanaal" data-id="${esc(p.id)}">
      ${['direct', 'michielpro', 'karin'].map((c) => `<option value="${c}">${c}</option>`).join('')}
    </select>
  </li>`).join('');

  const dubbelItems = g.dubbeleKlant.map((pair) => `<li>
    <span>${esc(pair[0].name)} &nbsp;↔&nbsp; ${esc(pair[1].name)}</span>
    <em>Lijkt dubbel. Fix hoort in <code>KNOWN_CLIENTS</code> / <code>ID_ALIAS</code> van de sync — een merge hier komt terug.</em>
  </li>`).join('');

  const section = (title, sub, body) => `<section class="card an-card">
    <p class="eyebrow">${esc(title)}</p>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}${body}
  </section>`;

  return `<div class="page an-page">
    <header class="page-head"><h1>Analyse</h1>
      <p>Live uit Supabase · jaar ${year}. Deze tab telt gerealiseerde omzet + open pipeline; de Overview-tegels tellen toegezegd werk.</p>
    </header>

    ${section('Veredeling', 'Omzet per label (betaald + gefactureerd + open offerte).', `<div class="an-bars">${veredelingHtml}</div>`)}
    ${section('Sectoren', 'Gerealiseerd + open offerte per sector.', `<div class="an-bars">${sectorHtml}</div>`)}
    ${section('Kanalen', 'Partner/factuurroute én herkomst van de lead.', `
      <p class="sub-h">Kanaal</p><div class="an-bars">${kanaalHtml}</div>
      <p class="sub-h">Herkomst</p><div class="an-bars">${leadHtml}</div>`)}
    ${section('Recurring', `Feitelijke herhaalomzet: ${eur(m.recurring.herhaalTotaal)} (${herhaalPct.toFixed(1)}% van de omzet).`, `
      <table class="an-table"><thead><tr><th>Klant</th><th class="num">Maanden</th><th class="num">${year}</th></tr></thead><tbody>${recRows}</tbody></table>
      <p class="muted">Contractueel model staat op ${eur(m.recurring.contractueelMnd)}/mnd — losgekoppeld van de realiteit; <code>finance_entries.recurring</code> is hardcoded <code>one_off</code>.</p>`)}
    ${section('Marge — waar het geld heen gaat', `Omzet ${eur(m.marge.omzet)} − kosten ${eur(m.marge.kosten)} = netto ${eur(m.marge.netto)} (${m.marge.margePct.toFixed(1)}%).`, `
      <p class="muted">Projectgebonden ${eur(m.marge.projectgebonden)} · overhead ${eur(m.marge.overhead)}. Projectkosten per label:</p>
      <ul class="an-inline">${perLabelHtml}</ul>
      <p class="sub-h">Kosten per categorie</p><div class="an-bars">${margeCat}</div>`)}

    <section class="card an-card an-gaps">
      <p class="eyebrow">Ontbrekend${gapCount ? ` · ${gapCount}` : ''}</p>
      ${gapCount === 0 ? '<p class="muted">Alles compleet — geen gaten.</p>' : ''}
      ${g.labelOntbreekt.length ? `<p class="sub-h">Label (${g.labelOntbreekt.length})</p><ul class="an-queue">${labelItems}</ul>` : ''}
      ${g.sectorOntbreekt.length ? `<p class="sub-h">Sector (${g.sectorOntbreekt.length})</p>${sectorDatalist}<ul class="an-queue">${sectorItems}</ul>` : ''}
      ${g.bedragOntbreekt.length ? `<p class="sub-h">Bedrag (${g.bedragOntbreekt.length})</p><ul class="an-queue">${bedragItems}</ul>` : ''}
      ${g.kanaalOntbreekt.length ? `<p class="sub-h">Kanaal (${g.kanaalOntbreekt.length})</p><ul class="an-queue">${kanaalItems}</ul>` : ''}
      ${g.dubbeleKlant.length ? `<p class="sub-h">Mogelijk dubbele klant (${g.dubbeleKlant.length})</p><ul class="an-queue">${dubbelItems}</ul>` : ''}
    </section>
  </div>`;
}
```

- [ ] **Step 2: Syntaxcheck**

Run: `node --check src/ui/analyse.js`
Expected: geen output (exit 0).

- [ ] **Step 3: Regressietest blijft groen**

Run: `node scripts/test-analyse.mjs`
Expected: `analyse-model: OK` (render voegt geen nieuwe test toe, maar mag de bestaande niet breken).

- [ ] **Step 4: Commit**

```bash
git add src/ui/analyse.js
git commit -m "feat(analyse): renderAnalyse pagina met analyse + ontbrekend-blok"
```

---

## Task 7: `app.js` — nav-item, route, import

**Files:**
- Modify: `src/app.js:7` (import), `:1716` (nav), `:1737` (route)

- [ ] **Step 1: Importeer renderAnalyse**

Voeg na regel 7 (`import { lineChart, ... } from './ui/charts.js';`) toe:
```js
import { renderAnalyse } from './ui/analyse.js';
```

- [ ] **Step 2: Voeg het nav-item toe**

In `renderNavigation` (regel ~1716), voeg toe ná `['/', 'Overview'],`:
```js
    ['/analyse', 'Analyse'],
```

- [ ] **Step 3: Voeg de route toe**

In de `switch (route.path)` in `renderPage` (regel ~1737), voeg toe vóór `case '/acquisitie':`:
```js
    case '/analyse':   return renderAnalyse(db, { fmtCurrency, escapeHtml });
```

- [ ] **Step 4: Syntaxcheck**

Run: `node --check src/app.js`
Expected: geen output (exit 0).

- [ ] **Step 5: Visuele verificatie in de browser**

Start de dev-server (Browser pane, `preview_start` met de bestaande launch-config of `{name:"dashboard"}`), navigeer naar `/#/analyse`. Controleer met `read_console_messages` (geen errors) en `read_page` dat de vijf analyse-secties + het Ontbrekend-blok renderen. Maak een screenshot.

- [ ] **Step 6: Commit**

```bash
git add src/app.js
git commit -m "feat(app): Analyse-tab in nav en router"
```

---

## Task 8: `app.js` — wizard-events (schrijven via upsert)

**Files:**
- Modify: `src/app.js` (in `attachEvents`, regel ~1748; imports regel ~5 indien nodig)

De wizard schrijft via de bestaande store-helpers. `upsertProject` en `upsertCustomer`
zijn al geïmporteerd (regel 3–5). Elk event patcht het object uit `getDatabase()` en
roept upsert; `subscribe` triggert daarna vanzelf `renderApp()`.

- [ ] **Step 1: Voeg de event-handlers toe in `attachEvents`**

Voeg binnen `function attachEvents()` toe (naast de bestaande `querySelectorAll`-blokken):
```js
  // --- Analyse-wizard ---
  document.querySelectorAll('[data-action="gap-label-ok"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const sel = document.querySelector(`select[data-action="gap-label"][data-id="${id}"]`);
      const project = getDatabase().projects.find((p) => p.id === id);
      if (!project) return;
      if (sel) project.service_label = sel.value;
      project.label_reviewed = true;
      await upsertProject(project);
    });
  });
  document.querySelectorAll('[data-action="gap-sector"]').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const customer = getDatabase().customers.find((c) => c.id === e.currentTarget.dataset.id);
      if (!customer) return;
      customer.industry = e.currentTarget.value.trim();
      if (customer.industry) await upsertCustomer(customer);
    });
  });
  document.querySelectorAll('[data-action="gap-bedrag"]').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const project = getDatabase().projects.find((p) => p.id === e.currentTarget.dataset.id);
      if (!project) return;
      const val = Number(e.currentTarget.value);
      if (!Number.isFinite(val) || val <= 0) return;
      project.value_amount = val;
      await upsertProject(project);
    });
  });
  document.querySelectorAll('[data-action="gap-kanaal"]').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      const project = getDatabase().projects.find((p) => p.id === e.currentTarget.dataset.id);
      if (!project) return;
      project.channel = e.currentTarget.value;
      await upsertProject(project);
    });
  });
```

- [ ] **Step 2: Syntaxcheck**

Run: `node --check src/app.js`
Expected: geen output (exit 0).

- [ ] **Step 3: Functionele verificatie in de browser**

Op `/#/analyse`: als er een gap-item is, wijzig het (bv. een label + "klopt"), en controleer dat het item na de re-render verdwijnt en de teller daalt. Als er geen gaps zijn, maak er tijdelijk één met de Supabase MCP (`update projects set label_reviewed=false where id='…'`), test, en zet terug. Screenshot van het Ontbrekend-blok vóór/na.

- [ ] **Step 4: Commit**

```bash
git add src/app.js
git commit -m "feat(analyse): wizard schrijft label/sector/bedrag/kanaal via upsert"
```

---

## Task 9: Styling + lint-lijst + eindverificatie

**Files:**
- Modify: `package.json` (lint-lijst)
- Modify: het CSS-bestand dat de app laadt (zoek met grep; volg bestaande `.card`/`.eyebrow`-klassen)

- [ ] **Step 1: Voeg de nieuwe modules toe aan de lint-lijst**

In `package.json`, breid het `lint`-script uit met de twee nieuwe bestanden:
```json
    "lint": "node --check src/main.js && node --check src/app.js && node --check src/finance-model.js && node --check src/label-model.js && node --check src/data/store.js && node --check src/ui/charts.js && node --check src/ui/analyse.js && node --check server.js",
```

- [ ] **Step 2: Vind het actieve CSS-bestand**

Run: `grep -rn "\.eyebrow\|\.card {" src/ dashboard.html --include=*.css --include=*.html -l`
Gebruik het bestand dat de app laadt (waarschijnlijk een `<style>` of `.css` naast `dashboard.html`).

- [ ] **Step 3: Voeg de analyse-stijlen toe**

Voeg de klassen toe die `renderAnalyse` gebruikt, in de huisstijl (paars/glas, accent `#D8FE56` spaarzaam). Minimaal:
```css
.an-bars { display: flex; flex-direction: column; gap: .5rem; margin: .6rem 0; }
.an-row { display: grid; grid-template-columns: minmax(120px,1.3fr) minmax(0,3fr) minmax(80px,auto); gap: .8rem; align-items: center; }
.an-row__label { display: flex; flex-direction: column; line-height: 1.2; }
.an-row__label em { font-size: .65rem; text-transform: uppercase; letter-spacing: .1em; color: var(--text-muted); font-style: normal; }
.an-row__track { height: 18px; background: rgba(255,255,255,.05); border-radius: 4px; }
.an-row__track span { display: block; height: 100%; background: #9A72CE; border-radius: 4px; }
.an-row__val { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.an-queue { list-style: none; padding: 0; margin: .4rem 0; display: flex; flex-direction: column; gap: .5rem; }
.an-queue li { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; }
.an-queue em { font-size: .8rem; color: var(--text-muted); font-style: normal; }
.an-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.an-table th, .an-table td { text-align: left; padding: .3rem .6rem .3rem 0; border-bottom: 1px solid rgba(255,255,255,.06); }
.an-table .num, .an-row__val { text-align: right; }
.sub-h { font-size: .68rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--accent, #D8FE56); margin: 1rem 0 .3rem; }
.an-inline { list-style: none; padding: 0; display: flex; gap: 1.2rem; flex-wrap: wrap; }
```

- [ ] **Step 4: Draai de volledige lint**

Run: `npm run lint`
Expected: geen output, exit 0.

- [ ] **Step 5: Draai alle regressietests**

Run: `node scripts/test-label-model.mjs && node scripts/test-analyse.mjs && node scripts/test-sync-unreadable.mjs && node scripts/test-finance-model.mjs`
Expected: alle vier printen hun OK-regel.

- [ ] **Step 6: Eindverificatie in de browser**

Herlaad `/#/analyse`. Controleer: vijf analyse-secties tonen echte bedragen (Marge toont netto ~86%, MichielPro toont de €32k open offerte, Recurring toont de herhaalklanten zonder groot €4,95-getal). Console vrij van errors. Screenshot voor de gebruiker.

- [ ] **Step 7: Commit**

```bash
git add package.json src/  # + het gewijzigde css-bestand
git commit -m "feat(analyse): styling, lint-lijst en eindverificatie"
```

---

## Self-review notities

- **Spec-dekking:** Blok 1 (5 sub-blokken) → Task 4/6; Blok 2 (5 checks) → Task 5/6/8; `label_reviewed` + `channel` → Task 1; auto-afleiden → Task 2/3; twee-definities-uitleg → Task 6 (page-head + veredeling-sub); marge/overhead/doorlopende-kost → Task 4 (`perLabel`, `projectgebonden`) en Task 6 (weergave). De "doorlopende kost op afgerond project" is als data aanwezig (`perLabel`) maar krijgt nog geen eigen signaal-regel in de render — bewust buiten scope van dit plan gehouden om het niet te laten uitdijen; toevoegen kan later als losse taak.
- **Kanaal-afleiding offerte:** `deriveChannel` krijgt `r.name + r.hay`; als `r.hay` niet bestaat op dat punt in de sync, valt het terug op alleen de naam (nog steeds correct voor MichielPro-mappen). De executor verifieert het veld in Step 2 van Task 3.
- **Geen placeholders:** alle code-stappen bevatten volledige code; testcommando's met verwachte output.
