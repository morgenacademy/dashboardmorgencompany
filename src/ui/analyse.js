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
