import {
  getDatabase, subscribe, loadAll,
  upsertProject, deleteProject,
  upsertTask, deleteTask,
  upsertCustomer, upsertFinance, deleteFinance, nextId,
} from './data/store.js';
import { lineChart, barChart, dualLineChart, teamMonthlyChart } from './ui/charts.js';

const PIPELINE_STAGES = [
  { value: 'verkennen',         label: 'Verkennen' },
  { value: '1e_gesprek',        label: '1e gesprek' },
  { value: 'offerte_verzonden', label: 'Offerte verzonden' },
  { value: 'geaccepteerd',      label: 'Geaccepteerd' },
  { value: 'uitvoering',        label: 'Uitvoering' },
  { value: 'afgerond',          label: 'Afgerond' },
  { value: 'on_hold',           label: 'On hold' },
  { value: 'verloren',          label: 'Verloren' },
];
const ACTIVE_STAGES = ['verkennen','1e_gesprek','offerte_verzonden','geaccepteerd','uitvoering'];

const TASK_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'Bezig' },
  { value: 'blocked', label: 'Geblokkeerd' },
  { value: 'done', label: 'Klaar' },
];

const PRIORITIES = [
  { value: 'high', label: 'Hoog' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Laag' },
];

const SERVICE_LABELS = [
  { value: 'inspire',   label: 'Inspire' },
  { value: 'build',     label: 'Build' },
  { value: 'train',     label: 'Train' },
  { value: 'implement', label: 'Implement' },
  { value: 'other',     label: 'Overig' },
];

const PRODUCT_TYPES = [
  { value: 'training', label: 'Training' },
  { value: 'programma', label: 'Programma' },
  { value: 'automatisering', label: 'Automatisering' },
  { value: 'strategie', label: 'Strategie' },
  { value: 'samenwerking', label: 'Samenwerking' },
  { value: 'abonnement', label: 'Abonnement' },
  { value: 'other', label: 'Overig' },
];

const GOALS_2026 = {
  external_leads: 11,
  breakthroughs: 1,
  revenue: 25000,
};

const ACCEPTED_STAGES = ['geaccepteerd','uitvoering','afgerond'];
const INTERNAL_HOURLY_RATE = 100;
// Potentieel = nog niet zeker (lead → offerte verzonden)
const POTENTIAL_STAGES = ['verkennen','1e_gesprek','offerte_verzonden'];
// Toegezegd = klant heeft ja gezegd, werk gaat gebeuren / loopt / is af
const COMMITTED_STAGES = ['geaccepteerd','uitvoering','afgerond'];

function ownerShares(owner = '') {
  const o = owner.toLowerCase();
  const people = [];
  if (o.includes('karin'))    people.push('Karin');
  if (o.includes('harmen'))   people.push('Harmen');
  if (o.includes('danielle')) people.push('Danielle');
  if (!people.length) return {};
  const share = 1 / people.length;
  return Object.fromEntries(people.map((p) => [p, share]));
}

function statusFromProgress(pct) {
  if (pct >= 0.75) return 'success';
  if (pct >= 0.25) return 'warning';
  return 'danger';
}

const PIPELINE_TONE = {
  verkennen: 'info', '1e_gesprek': 'info', offerte_verzonden: 'warning',
  onderhandeling: 'warning', geaccepteerd: 'success', uitvoering: 'success',
  afgerond: 'default', on_hold: 'default', verloren: 'danger',
};

function fmtCurrency(value) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
}
function fmtNumber(value, digits = 0) {
  return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value || 0);
}
function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
}
function escapeHtml(value = '') {
  return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
function relDays(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}
function dueLabel(dateStr) {
  const days = relDays(dateStr);
  if (days === null) return '';
  if (days < 0) return `${-days} dagen te laat`;
  if (days === 0) return 'Vandaag';
  if (days === 1) return 'Morgen';
  if (days <= 7) return `Over ${days} dagen`;
  return fmtDate(dateStr);
}
function dueTone(dateStr) {
  const days = relDays(dateStr);
  if (days === null) return 'default';
  if (days < 0) return 'danger';
  if (days <= 2) return 'warning';
  return 'info';
}

const appState = { route: '/', filters: {}, chartHidden: new Set(), editingTask: null, editingCustomer: null, editingTrip: null, tripFilters: {} };

const OWNER_OPTIONS = ['Harmen', 'Karin', 'Danielle', 'Harmen & Karin', 'Harmen & Danielle', 'Karin & Danielle'];

const TRIP_CATEGORY = 'Kilometers';
const isTripEntry = (f) => f.category === TRIP_CATEGORY;

subscribe(() => renderApp());

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const [path, queryString = ''] = hash.split('?');
  const parts = path.split('/').filter(Boolean);
  const query = {};
  if (queryString) {
    for (const pair of queryString.split('&')) {
      if (!pair) continue;
      const [k, v = ''] = pair.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  return { path, parts, query };
}

// ============== Components ==============

function metricCard(label, value, meta = '', tone = 'default') {
  return `<article class="metric-card metric-${tone}">
    <span class="metric-label">${escapeHtml(label)}</span>
    <strong class="metric-value">${value}</strong>
    <span class="metric-meta">${escapeHtml(meta)}</span>
  </article>`;
}

function badge(text, tone = 'default') {
  return `<span class="badge badge-${tone}">${escapeHtml(text)}</span>`;
}

function goalTile({ title, doel, value, pct, description, href = '' }) {
  const status = statusFromProgress(pct);
  const cappedPct = Math.max(0, Math.min(1, pct));
  const Tag = href ? 'a' : 'article';
  const attrs = href ? `href="${href}"` : '';
  return `
    <${Tag} class="champ-tile champ-tile--${status} ${href ? 'champ-tile--link' : ''}" ${attrs}>
      <header class="champ-tile__head">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <span class="muted">Doel: ${escapeHtml(doel)}</span>
        </div>
        <span class="status-dot status-dot--${status}" aria-label="status ${status}"></span>
      </header>
      <strong class="champ-tile__value">${value}</strong>
      <div class="progress-bar"><span style="width:${(cappedPct * 100).toFixed(1)}%"></span></div>
      <p class="champ-tile__note">${escapeHtml(description)}</p>
    </${Tag}>`;
}

function stateTile({ title, count, value, tally, tone, href = '' }) {
  const parts = [];
  for (const [name, amount] of Object.entries(tally)) {
    if (amount > 0) parts.push(`${escapeHtml(name)}: ${fmtCurrency(amount)}`);
  }
  const Tag = href ? 'a' : 'article';
  const attrs = href ? `href="${href}"` : '';
  return `
    <${Tag} class="champ-tile champ-tile--${tone} champ-tile--state ${href ? 'champ-tile--link' : ''}" ${attrs}>
      <header class="champ-tile__head">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <span class="muted">${escapeHtml(count)}</span>
        </div>
        <strong class="champ-tile__amount">${value}</strong>
      </header>
      <p class="champ-tile__note">${parts.length ? parts.join(' · ') : '—'}</p>
    </${Tag}>`;
}

function icsDate(dateStr) {
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function icsEscape(s = '') {
  return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function buildIcs(task, project, customer) {
  const start = new Date(task.meeting_at);
  const end = new Date(start.getTime() + (task.meeting_duration_minutes || 60) * 60000);
  const summary = `${task.title}${customer ? ` · ${customer.name}` : ''}`;
  const desc = [task.description, project ? `Project: ${project.name}` : '', customer ? `Klant: ${customer.name}` : '']
    .filter(Boolean).join('\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Morgen Dashboard//NL',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${task.id}@morgendashboard`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(task.meeting_at)}`,
    `DTEND:${icsDate(end.toISOString())}`,
    `SUMMARY:${icsEscape(summary)}`,
    desc ? `DESCRIPTION:${icsEscape(desc)}` : '',
    task.location ? `LOCATION:${icsEscape(task.location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

function downloadIcs(task, project, customer) {
  const ics = buildIcs(task, project, customer);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${task.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function projectValueCell(p) {
  const actual = Number(p.actual_amount || 0);
  const forecast = Number(p.forecast_amount || 0);
  if (actual && forecast) return `<strong>${fmtCurrency(actual)}</strong> <span class="muted">+ ${fmtCurrency(forecast)} fc</span>`;
  if (actual) return `<strong>${fmtCurrency(actual)}</strong>`;
  if (forecast) return `<span class="muted">${fmtCurrency(forecast)} forecast</span>`;
  if (Number(p.value_amount)) return `<span class="muted">${fmtCurrency(p.value_amount)}</span>`;
  return '<span class="muted">—</span>';
}

function pipelineBadge(stage) {
  const item = PIPELINE_STAGES.find((s) => s.value === stage);
  return badge(item?.label || stage, PIPELINE_TONE[stage] || 'default');
}

function table(headers, rows, options = {}) {
  return `
    <div class="table-wrap">
      <table class="data-table ${options.compact ? 'compact' : ''}">
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.length
          ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${headers.length}" class="empty-cell">Geen records</td></tr>`}</tbody>
      </table>
    </div>`;
}

function selectOptions(items, current, valueKey = 'value', labelKey = 'label') {
  return items.map((item) => `<option value="${escapeHtml(item[valueKey])}" ${item[valueKey] === current ? 'selected' : ''}>${escapeHtml(item[labelKey])}</option>`).join('');
}

// ============== Pages ==============

function renderOverview(db) {
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = today.slice(0, 4) + '-01-01';
  const yearEnd   = today.slice(0, 4) + '-12-31';
  const projectsById = Object.fromEntries(db.projects.map((p) => [p.id, p]));
  const activeProjects = db.projects.filter((p) => ACTIVE_STAGES.includes(p.pipeline_status));

  // ===== Doel-KPI's (Champagne momenten) =====
  const externalLeads = db.projects.filter((p) => p.lead_source === 'buiten_netwerk');
  const breakthroughs = db.projects.filter((p) => p.is_breakthrough);
  const incomeThisYear = db.finance.filter((f) => f.type === 'income' && f.date >= yearStart && f.date <= yearEnd);
  const omzetGefactureerd = incomeThisYear
    .filter((f) => ['ontvangen','gefactureerd'].includes(f.payment_status))
    .reduce((s, f) => s + Number(f.amount), 0);

  const goalLeadsPct = externalLeads.length / GOALS_2026.external_leads;
  const goalBreakPct = breakthroughs.length / GOALS_2026.breakthroughs;
  const goalRevenuePct = omzetGefactureerd / GOALS_2026.revenue;

  // ===== Stand van zaken in EUR — 4 commerciële statussen =====
  // 1) Offerte verzonden: forecast op projecten in pipeline (kan nog misgaan)
  // 2) Toegezegd: klant zei ja, factuur nog niet uit (verwacht-income op COMMITTED projecten)
  // 3) Gefactureerd: factuur uit, klant moet betalen
  // 4) Ontvangen: geld binnen
  const splitProjectsByOwner = (projects, amountKey) => {
    const tally = { Karin: 0, Harmen: 0, Danielle: 0, Onverdeeld: 0 };
    let total = 0;
    let trajecten = 0;
    const klanten = new Set();
    for (const p of projects) {
      const value = Number(p[amountKey] || 0);
      if (!value) continue;
      total += value;
      trajecten++;
      klanten.add(p.customer_id);
      const shares = ownerShares(p.owner);
      const keys = Object.keys(shares);
      if (!keys.length) tally.Onverdeeld += value;
      for (const k of keys) tally[k] = (tally[k] || 0) + value * shares[k];
    }
    return { total, trajecten, klantenCount: klanten.size, tally };
  };

  const splitFinanceByOwner = (entries) => {
    const tally = { Karin: 0, Harmen: 0, Danielle: 0, Onverdeeld: 0 };
    let total = 0;
    const projectSet = new Set();
    const klantenSet = new Set();
    for (const f of entries) {
      const value = Number(f.amount || 0);
      if (!value) continue;
      total += value;
      const proj = f.project_id ? projectsById[f.project_id] : null;
      if (proj) { projectSet.add(proj.id); klantenSet.add(proj.customer_id); }
      const shares = ownerShares(proj?.owner || f.owner || '');
      const keys = Object.keys(shares);
      if (!keys.length) tally.Onverdeeld += value;
      for (const k of keys) tally[k] = (tally[k] || 0) + value * shares[k];
    }
    return { total, trajecten: projectSet.size, klantenCount: klantenSet.size, tally };
  };

  // 1) Offerte verzonden: alle projecten in POTENTIAL_STAGES, telt forecast
  const potentieel = splitProjectsByOwner(
    db.projects.filter((p) => POTENTIAL_STAGES.includes(p.pipeline_status)),
    'forecast_amount',
  );

  // 2/3/4: vanuit income finance entries dit jaar
  const incomeWithCommittedProject = incomeThisYear.filter((f) => {
    const proj = f.project_id ? projectsById[f.project_id] : null;
    return proj && COMMITTED_STAGES.includes(proj.pipeline_status);
  });
  const toegezegd    = splitFinanceByOwner(incomeWithCommittedProject.filter((f) => f.payment_status === 'verwacht'));
  const gefactureerd = splitFinanceByOwner(incomeThisYear.filter((f) => f.payment_status === 'gefactureerd'));
  const ontvangen    = splitFinanceByOwner(incomeThisYear.filter((f) => f.payment_status === 'ontvangen'));

  // ===== Cashflow / run-rate =====
  const monthlyIncome = db.finance
    .filter((f) => f.type === 'income' && f.recurring === 'monthly')
    .reduce((acc, f) => { acc[f.project_id || f.vendor || f.id] = Number(f.amount); return acc; }, {});
  const recurringIncomeMonthly = Object.values(monthlyIncome).reduce((s, v) => s + v, 0);
  const monthlyExpense = db.finance
    .filter((f) => f.type === 'expense' && f.recurring === 'monthly')
    .reduce((acc, f) => {
      const key = f.vendor || f.description;
      acc[key] = Math.max(acc[key] || 0, Number(f.amount));
      return acc;
    }, {});
  const recurringExpenseMonthly = Object.values(monthlyExpense).reduce((s, v) => s + v, 0);
  const runRateNetto = recurringIncomeMonthly - recurringExpenseMonthly;

  // ===== Per service label (Inspire / Build / Train / Implement) =====
  // Alleen projecten die echt 'gevallen' zijn: pipeline in COMMITTED (geaccepteerd / uitvoering / afgerond).
  const labelTotals = {};
  for (const lbl of SERVICE_LABELS) labelTotals[lbl.value] = { label: lbl.label, value: lbl.value, total: 0, count: 0 };
  for (const p of db.projects) {
    if (!COMMITTED_STAGES.includes(p.pipeline_status)) continue;
    const amount = Number(p.actual_amount || 0) + Number(p.forecast_amount || 0);
    if (!amount) continue;
    const k = p.service_label || 'other';
    labelTotals[k].total += amount;
    labelTotals[k].count += 1;
  }
  const labelGrandTotal = Object.values(labelTotals).reduce((s, l) => s + l.total, 0);
  const labelOrder = ['inspire','build','train','implement'];
  const labelTiles = labelOrder.map((k) => labelTotals[k]);

  // For forecast chart
  const forecastPipeline = db.projects
    .filter((p) => ['verkennen','1e_gesprek','offerte_verzonden','onderhandeling'].includes(p.pipeline_status))
    .reduce((sum, p) => sum + Number(p.forecast_amount || 0), 0);

  const openTasks = db.tasks.filter((t) => t.status !== 'done');
  const overdueTasks = openTasks.filter((t) => relDays(t.due_date) !== null && relDays(t.due_date) < 0);

  const expenseYtd = db.finance.filter((f) => f.type === 'expense' && f.date >= yearStart && f.date <= yearEnd).reduce((s, f) => s + Number(f.amount), 0);

  // === Team chart: per maand opbrengst/kosten per persoon ===
  // 4 lijnen: Karin opbrengst, Karin kosten, Harmen opbrengst, Harmen kosten
  const todayMonth = today.slice(0, 7);
  const months = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(Number(yearStart.slice(0,4)), m, 1);
    months.push({
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('nl-NL', { month: 'short' }),
      karinRevenue: 0, karinCosts: 0, harmenRevenue: 0, harmenCosts: 0, danielleRevenue: 0, danielleCosts: 0,
    });
  }
  const monthsByKey = Object.fromEntries(months.map((m) => [m.month, m]));

  for (const f of db.finance) {
    if (!f.date || f.date < yearStart || f.date > yearEnd) continue;
    const amount = Number(f.amount || 0);
    if (!amount) continue;
    // Bepaal toewijzing per maand
    const targetMonths = [];
    if (f.recurring === 'monthly') {
      // Spread over alle maanden vanaf de start-datum (of vanaf jaar-start als eerder)
      const fromIdx = Math.max(0, months.findIndex((m) => m.month >= f.date.slice(0, 7)));
      for (let i = fromIdx; i < months.length; i++) targetMonths.push(months[i]);
    } else {
      const m = monthsByKey[f.date.slice(0, 7)];
      if (m) targetMonths.push(m);
    }
    if (!targetMonths.length) continue;

    // Wie is de eigenaar? Project-owner heeft voorrang, anders f.owner
    const proj = f.project_id ? projectsById[f.project_id] : null;
    const ownerStr = (proj?.owner) || f.owner || '';
    const shares = ownerShares(ownerStr);
    const keys = Object.keys(shares);
    if (!keys.length) continue;

    for (const m of targetMonths) {
      for (const person of keys) {
        const personShare = shares[person] * amount;
        if (f.type === 'income') {
          if (person === 'Karin')    m.karinRevenue    += personShare;
          if (person === 'Harmen')   m.harmenRevenue   += personShare;
          if (person === 'Danielle') m.danielleRevenue += personShare;
        } else {
          if (person === 'Karin')    m.karinCosts    += personShare;
          if (person === 'Harmen')   m.harmenCosts   += personShare;
          if (person === 'Danielle') m.danielleCosts += personShare;
        }
      }
    }
  }

  // Totaal netto per maand = (Karin + Harmen opbrengst) − (Karin + Harmen kosten)
  for (const m of months) {
    m.totalRevenue = (m.karinRevenue || 0) + (m.harmenRevenue || 0) + (m.danielleRevenue || 0);
    m.totalCosts   = (m.karinCosts || 0) + (m.harmenCosts || 0) + (m.danielleCosts || 0);
    m.totalNet     = m.totalRevenue - m.totalCosts;
  }

  const teamSeries = [
    { key: 'totalNet',      label: 'Totaal netto',     color: '#D8FE56', bold: true },
    { key: 'totalRevenue',  label: 'Totaal opbrengst', color: '#FFFFFF' },
    { key: 'totalCosts',    label: 'Totaal kosten',    color: '#FF8FB6' },
    { key: 'karinRevenue',    label: 'Karin opbrengst',    color: '#5BC0A8' },
    { key: 'karinCosts',      label: 'Karin kosten',       color: '#3A7E70' },
    { key: 'harmenRevenue',   label: 'Harmen opbrengst',   color: '#9B6FCF' },
    { key: 'harmenCosts',     label: 'Harmen kosten',      color: '#5B2D8E' },
    { key: 'danielleRevenue', label: 'Danielle opbrengst', color: '#8FB6FF' },
    { key: 'danielleCosts',   label: 'Danielle kosten',    color: '#4A6BB8' },
  ];

  // Lijnen die default uitstaan (om grafiek niet te druk te maken)
  const DEFAULT_HIDDEN = new Set(['karinRevenue','karinCosts','harmenRevenue','harmenCosts','danielleRevenue','danielleCosts']);
  if (!appState._chartInited) {
    appState._chartInited = true;
    for (const k of DEFAULT_HIDDEN) appState.chartHidden.add(k);
  }
  const visibleSeries = teamSeries.filter((s) => !appState.chartHidden.has(s.key));

  const customersById = Object.fromEntries(db.customers.map((c) => [c.id, c]));

  // Aankomende taken (komende 14 dagen + overdue)
  const upcoming = openTasks
    .filter((t) => t.due_date)
    .filter((t) => relDays(t.due_date) <= 14)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    .slice(0, 8);

  // Pipeline overzicht (active projecten gegroepeerd per status)
  const byStage = ACTIVE_STAGES.map((stage) => ({
    stage,
    label: PIPELINE_STAGES.find((s) => s.value === stage).label,
    items: activeProjects.filter((p) => p.pipeline_status === stage),
  }));

  return `
    <section class="page-section">
      <div class="section-header">
        <div>
          <h1>Overview</h1>
          <p>Stuur op pipeline, aankomende taken en cashflow.</p>
        </div>
        <a href="#/projecten/nieuw" class="button primary">+ Nieuw project</a>
      </div>

      <section class="champagne">
        <div class="champagne__head">
          <span class="eyebrow">Champagne momenten</span>
          <h2>Doelen en status van het gekozen jaar</h2>
        </div>

        <div class="champagne__row">
          ${goalTile({
            title: 'Nieuwe leads buiten netwerk',
            doel: `${GOALS_2026.external_leads} leads`,
            value: `${externalLeads.length} / ${GOALS_2026.external_leads}`,
            pct: goalLeadsPct,
            description: 'Leads via vakblad, events, partij of een onverwachte externe ingang.',
            href: '#/projecten?lead_source=buiten_netwerk',
          })}
          ${goalTile({
            title: 'Holy shit moment',
            doel: '1 doorbraak',
            value: breakthroughs.length ? `${breakthroughs.length} ✨` : 'Nog niet',
            pct: goalBreakPct,
            description: 'Nieuwe zichtbaarheid of tractie buiten het directe netwerk.',
            href: '#/projecten?breakthrough=1',
          })}
          ${goalTile({
            title: 'Omzet 2026',
            doel: fmtCurrency(GOALS_2026.revenue),
            value: fmtCurrency(omzetGefactureerd),
            pct: goalRevenuePct,
            description: 'Berekend uit toegezegde en gefactureerde omzet binnen het gekozen jaar.',
            href: '#/finance?type=income&payment=gefactureerd_ontvangen&year=2026',
          })}
        </div>

        <div class="champagne__row champagne__row--four">
          ${stateTile({
            title: 'Offerte verzonden',
            count: `${potentieel.klantenCount} klant${potentieel.klantenCount === 1 ? '' : 'en'} · ${potentieel.trajecten} traject${potentieel.trajecten === 1 ? '' : 'en'}`,
            value: fmtCurrency(potentieel.total),
            tally: potentieel.tally,
            tone: 'danger',
            href: '#/projecten?commercial=offerte_verzonden',
          })}
          ${stateTile({
            title: 'Toegezegd',
            count: `${toegezegd.klantenCount} klant${toegezegd.klantenCount === 1 ? '' : 'en'} · ${toegezegd.trajecten} traject${toegezegd.trajecten === 1 ? '' : 'en'}`,
            value: fmtCurrency(toegezegd.total),
            tally: toegezegd.tally,
            tone: 'warning',
            href: '#/projecten?commercial=toegezegd',
          })}
          ${stateTile({
            title: 'Factuur verzonden',
            count: `${gefactureerd.klantenCount} klant${gefactureerd.klantenCount === 1 ? '' : 'en'} · ${gefactureerd.trajecten} traject${gefactureerd.trajecten === 1 ? '' : 'en'}`,
            value: fmtCurrency(gefactureerd.total),
            tally: gefactureerd.tally,
            tone: 'warning',
            href: '#/projecten?commercial=gefactureerd',
          })}
          ${stateTile({
            title: 'Ontvangen',
            count: `${ontvangen.klantenCount} klant${ontvangen.klantenCount === 1 ? '' : 'en'} · ${ontvangen.trajecten} traject${ontvangen.trajecten === 1 ? '' : 'en'}`,
            value: fmtCurrency(ontvangen.total),
            tally: ontvangen.tally,
            tone: 'success',
            href: '#/projecten?commercial=ontvangen',
          })}
        </div>
      </section>

      <section class="label-panel">
        <div class="champagne__head">
          <span class="eyebrow">Per label</span>
          <h2>Inspire · Build · Train · Implement</h2>
        </div>
        <div class="label-grid">
          ${labelTiles.map((l) => {
            const pct = labelGrandTotal ? l.total / labelGrandTotal : 0;
            return `
              <a class="label-tile label-tile--${l.value}" href="#/projecten?label=${escapeHtml(l.value)}">
                <header>
                  <h3>${escapeHtml(l.label)}</h3>
                  <span class="label-tile__pct">${(pct * 100).toFixed(0)}%</span>
                </header>
                <strong>${fmtCurrency(l.total)}</strong>
                <div class="progress-bar"><span style="width:${(pct * 100).toFixed(1)}%"></span></div>
                <p class="muted" style="margin:0;font-size:.75rem;">${l.count} project${l.count === 1 ? '' : 'en'}</p>
              </a>`;
          }).join('')}
        </div>
      </section>

      <section class="panel forecast-panel">
        <div class="forecast-panel__head">
          <div>
            <span class="metric-label">Opbrengst, kosten en forecast</span>
            <h3 style="margin:0;font-family:'Barlow';font-weight:900;color:var(--white);font-size:1.2rem;">2026 — per maand</h3>
            <span class="muted" style="font-size:.78rem;">Solide tot vandaag, stippellijn = forecast</span>
          </div>
          <div class="chart-legend">
            ${teamSeries.map((s) => {
              const off = appState.chartHidden.has(s.key);
              return `<button type="button" class="legend-btn ${off ? 'legend-btn--off' : ''}" data-action="toggle-series" data-key="${escapeHtml(s.key)}">
                <span class="legend-dot" style="background:${s.color};${s.bold ? 'height:4px;' : ''}"></span>${escapeHtml(s.label)}
              </button>`;
            }).join('')}
            <span class="muted">${activeProjects.length} actief · ${openTasks.length} open${overdueTasks.length ? ` · <span style="color:#FF8FB6;">${overdueTasks.length} te laat</span>` : ''} · expense YTD ${fmtCurrency(expenseYtd)}</span>
          </div>
        </div>
        ${teamMonthlyChart({ months, series: visibleSeries, currentMonth: todayMonth, ariaLabel: 'Opbrengst en kosten per persoon per maand 2026' })}
      </section>

      <div class="layout-two">
        <div class="panel">
          <div class="panel-heading"><div><h2>Aankomende taken</h2><p>Volgende 14 dagen + alles wat te laat is.</p></div></div>
          ${table(
            ['Taak','Project','Deadline','Prio'],
            upcoming.map((t) => {
              const proj = db.projects.find((p) => p.id === t.project_id);
              const customer = proj ? customersById[proj.customer_id] : null;
              return [
                `<a href="#/projecten/${escapeHtml(t.project_id)}"><strong>${escapeHtml(t.title)}</strong></a>`,
                `<span class="muted">${escapeHtml(customer?.name || '')}</span> · ${escapeHtml(proj?.name || '')}`,
                badge(dueLabel(t.due_date), dueTone(t.due_date)),
                badge(PRIORITIES.find((p) => p.value === t.priority)?.label || t.priority, t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'info'),
              ];
            }),
            { compact: true },
          )}
        </div>

        <div class="panel">
          <div class="panel-heading"><div><h2>Pipeline</h2><p>Klik op een fase om de projecten te zien.</p></div></div>
          <div class="signal-stack">
            ${byStage.filter((g) => g.items.length).map((group) => {
              const klanten = [...new Set(group.items.map((p) => customersById[p.customer_id]?.name).filter(Boolean))];
              const totalValue = group.items.reduce((s, p) => s + Number(p.actual_amount || p.forecast_amount || p.value_amount || 0), 0);
              return `
              <a class="signal-card" href="#/projecten?pipeline_status=${escapeHtml(group.stage)}" style="text-decoration:none;color:inherit;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
                  <strong>${escapeHtml(group.label)}</strong>
                  <span class="muted">${group.items.length} · ${fmtCurrency(totalValue)}</span>
                </div>
                <div class="muted" style="font-size:.82rem;">${klanten.length ? klanten.map(escapeHtml).join(' · ') : '—'}</div>
              </a>`;
            }).join('') || '<span class="muted">Geen actieve projecten.</span>'}
          </div>
        </div>
      </div>
    </section>`;
}

function projectRow(p, customer, db) {
  const openTasks = db.tasks.filter((t) => t.project_id === p.id && t.status !== 'done');
  const overdue = openTasks.filter((t) => t.due_date && relDays(t.due_date) < 0);
  const nextDueTask = openTasks.filter((t) => t.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const actual = Number(p.actual_amount || 0);
  const forecast = Number(p.forecast_amount || 0);
  const typeLabel = PRODUCT_TYPES.find((t) => t.value === p.product_type)?.label || p.product_type;
  const prioLabel = PRIORITIES.find((pr) => pr.value === p.priority)?.label || p.priority;
  const hours = Number(p.estimated_hours || 0);
  // Marge berekenen
  const directExpense = db.finance.filter((f) => f.project_id === p.id && f.type === 'expense').reduce((s, f) => s + Number(f.amount), 0);
  const revenueForMargin = actual || forecast || Number(p.value_amount || 0);
  const margin = revenueForMargin - directExpense - hours * INTERNAL_HOURLY_RATE;
  const marginPct = revenueForMargin ? margin / revenueForMargin : 0;
  const showMargin = revenueForMargin > 0 || hours > 0 || directExpense > 0;
  return `
    <a class="project-row" href="#/projecten/${escapeHtml(p.id)}">
      <span class="project-row__status">${pipelineBadge(p.pipeline_status)}</span>
      <span class="project-row__name">
        <strong>${escapeHtml(p.name)}</strong>
        <span class="muted">${escapeHtml(customer?.name || '—')} · ${escapeHtml(typeLabel)}${p.priority === 'high' ? ` · <span style="color:#FF8FB6;">${escapeHtml(prioLabel)} prio</span>` : ''}</span>
      </span>
      <span class="project-row__value">
        ${actual ? `<strong>${fmtCurrency(actual)}</strong>` : ''}
        ${forecast ? `<span class="muted${actual ? ' project-row__forecast' : ''}">${fmtCurrency(forecast)}${actual ? ' fc' : ' forecast'}</span>` : ''}
        ${!actual && !forecast ? '<span class="muted">—</span>' : ''}
        ${showMargin ? `<span class="muted" style="font-size:.72rem;">marge ${fmtCurrency(margin)}${revenueForMargin ? ` · ${fmtNumber(marginPct * 100, 0)}%` : ''}</span>` : ''}
      </span>
      <span class="project-row__action">
        ${p.next_action ? `${escapeHtml(p.next_action)}${p.next_action_date ? `<span class="muted"> · ${dueLabel(p.next_action_date)}</span>` : ''}` : '<span class="muted">—</span>'}
      </span>
      <span class="project-row__meta">
        <span><strong>${openTasks.length}</strong> open</span>
        ${overdue.length ? `<span style="color:#FF8FB6;">${overdue.length} te laat</span>` : ''}
        ${hours ? `<span class="muted">${fmtNumber(hours, 0)}u</span>` : ''}
        ${nextDueTask ? `<span class="muted">${dueLabel(nextDueTask.due_date)}</span>` : ''}
      </span>
    </a>`;
}

function renderProjectenList(db) {
  const route = parseRoute();
  const customersById = Object.fromEntries(db.customers.map((c) => [c.id, c]));
  const urlFilters = route.query || {};
  const filterStatus = urlFilters.pipeline_status || appState.filters.pipeline_status || '';
  const filterType = urlFilters.product_type || appState.filters.product_type || '';
  const groupBy = appState.filters.group_by || 'status';
  const leadSource = urlFilters.lead_source || '';
  const breakthrough = urlFilters.breakthrough === '1';
  const stagesGroup = urlFilters.stages || '';
  let projects = db.projects;
  if (filterStatus) projects = projects.filter((p) => p.pipeline_status === filterStatus);
  if (filterType) projects = projects.filter((p) => p.product_type === filterType);
  if (leadSource) projects = projects.filter((p) => p.lead_source === leadSource);
  if (breakthrough) projects = projects.filter((p) => p.is_breakthrough);
  if (stagesGroup === 'potentieel') projects = projects.filter((p) => POTENTIAL_STAGES.includes(p.pipeline_status));
  if (stagesGroup === 'toegezegd')  projects = projects.filter((p) => COMMITTED_STAGES.includes(p.pipeline_status));
  const labelFilter = urlFilters.label || '';
  if (labelFilter) projects = projects.filter((p) => p.service_label === labelFilter);

  const commercial = urlFilters.commercial || '';
  if (commercial) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const ys = todayStr.slice(0, 4) + '-01-01';
    const ye = todayStr.slice(0, 4) + '-12-31';
    const projWithFin = (status) => new Set(
      db.finance.filter((f) =>
        f.type === 'income' &&
        f.payment_status === status &&
        f.date >= ys && f.date <= ye &&
        f.project_id
      ).map((f) => f.project_id)
    );
    if (commercial === 'offerte_verzonden') {
      projects = projects.filter((p) => POTENTIAL_STAGES.includes(p.pipeline_status));
    } else if (commercial === 'toegezegd') {
      const ids = projWithFin('verwacht');
      projects = projects.filter((p) => COMMITTED_STAGES.includes(p.pipeline_status) && ids.has(p.id));
    } else if (commercial === 'gefactureerd') {
      const ids = projWithFin('gefactureerd');
      projects = projects.filter((p) => ids.has(p.id));
    } else if (commercial === 'ontvangen') {
      const ids = projWithFin('ontvangen');
      projects = projects.filter((p) => ids.has(p.id));
    }
  }

  let groups;
  if (groupBy === 'klant') {
    const byCustomer = new Map();
    for (const p of projects) {
      if (!byCustomer.has(p.customer_id)) byCustomer.set(p.customer_id, []);
      byCustomer.get(p.customer_id).push(p);
    }
    groups = [...byCustomer.entries()]
      .map(([customerId, items]) => {
        const c = customersById[customerId];
        return { key: customerId, label: c?.name || '—', sublabel: c?.type || '', items };
      })
      .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  } else {
    const order = [...ACTIVE_STAGES, 'afgerond', 'on_hold', 'verloren'];
    groups = order.map((stage) => {
      const items = projects.filter((p) => p.pipeline_status === stage);
      return { key: stage, label: PIPELINE_STAGES.find((s) => s.value === stage).label, sublabel: '', items };
    }).filter((g) => g.items.length);
  }

  const totalForecast = projects.reduce((s, p) => s + Number(p.forecast_amount || 0), 0);
  const totalActual = projects.reduce((s, p) => s + Number(p.actual_amount || 0), 0);

  const activeFilters = [];
  if (leadSource === 'buiten_netwerk') activeFilters.push('Lead buiten netwerk');
  if (breakthrough) activeFilters.push('Holy shit moment ✨');
  if (stagesGroup === 'potentieel')   activeFilters.push('Stage: potentieel (verkennen + 1e gesprek)');
  if (stagesGroup === 'toegezegd')    activeFilters.push('Stage: toegezegd (offerte → uitvoering)');
  if (labelFilter)                    activeFilters.push(`Label: ${SERVICE_LABELS.find((l) => l.value === labelFilter)?.label || labelFilter}`);
  if (commercial === 'offerte_verzonden') activeFilters.push('Offerte verzonden (kan nog misgaan)');
  if (commercial === 'toegezegd')         activeFilters.push('Toegezegd — wachten op factuur');
  if (commercial === 'gefactureerd')      activeFilters.push('Factuur verzonden — wachten op betaling');
  if (commercial === 'ontvangen')         activeFilters.push('Ontvangen');

  return `
    <section class="page-section">
      <div class="section-header">
        <div>
          <h1>Projecten</h1>
          <p>${projects.length} projecten · werkelijk ${fmtCurrency(totalActual)} · forecast ${fmtCurrency(totalForecast)}</p>
          ${activeFilters.length ? `<p style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">${activeFilters.map((f) => `<span class="badge badge-info">${escapeHtml(f)}</span>`).join('')} <a href="#/projecten" class="muted" style="font-size:.82rem;">Filters wissen</a></p>` : ''}
        </div>
        <a href="#/projecten/nieuw" class="button primary">+ Nieuw project</a>
      </div>

      <section class="panel">
        <form id="project-filter" class="filter-grid">
          <label><span>Groeperen op</span>
            <select name="group_by">
              <option value="status" ${groupBy === 'status' ? 'selected' : ''}>Pipeline status</option>
              <option value="klant" ${groupBy === 'klant' ? 'selected' : ''}>Klant</option>
            </select>
          </label>
          <label><span>Status</span>
            <select name="pipeline_status">
              <option value="">Alle</option>
              ${PIPELINE_STAGES.map((s) => `<option value="${s.value}" ${filterStatus === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </label>
          <label><span>Type</span>
            <select name="product_type">
              <option value="">Alle</option>
              ${PRODUCT_TYPES.map((t) => `<option value="${t.value}" ${filterType === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
          </label>
          <div class="filter-actions">
            <button type="submit" class="button primary">Toepassen</button>
            <button type="button" class="button ghost" data-action="reset-project-filter">Reset</button>
          </div>
        </form>
      </section>

      ${groups.map((group) => {
        const groupActual = group.items.reduce((s, p) => s + Number(p.actual_amount || 0), 0);
        const groupForecast = group.items.reduce((s, p) => s + Number(p.forecast_amount || 0), 0);
        return `
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h2>${escapeHtml(group.label)} ${group.sublabel ? `<span class="muted" style="font-weight:500;font-size:.7em;">· ${escapeHtml(group.sublabel)}</span>` : ''}</h2>
                <p>${group.items.length} project(en) · werkelijk ${fmtCurrency(groupActual)}${groupForecast ? ` · forecast ${fmtCurrency(groupForecast)}` : ''}</p>
              </div>
            </div>
            <div class="project-list">
              <div class="project-list__head">
                <span>Status</span>
                <span>Project</span>
                <span style="text-align:right;">Waarde</span>
                <span>Volgende actie</span>
                <span style="text-align:right;">Taken</span>
              </div>
              ${group.items.map((p) => projectRow(p, customersById[p.customer_id], db)).join('')}
            </div>
          </section>`;
      }).join('')}
    </section>`;
}

function renderProjectForm(db, project) {
  const isNew = !project;
  return `
    <section class="page-section">
      <div class="section-header"><div><h1>${isNew ? 'Nieuw project' : 'Project bewerken'}</h1></div></div>
      <section class="panel">
        <form id="project-form" class="stack-form">
          <input type="hidden" name="id" value="${escapeHtml(project?.id || '')}" />
          <label><span>Klant</span>
            <div style="display:flex;gap:10px;align-items:center;">
              <select name="customer_id" required style="flex:1;min-width:0;">
                ${db.customers
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => `<option value="${c.id}" ${project?.customer_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)} (${c.type})</option>`).join('')}
              </select>
              <button type="button" class="button ghost" data-action="add-customer" style="white-space:nowrap;flex-shrink:0;">+ Nieuwe klant</button>
            </div>
          </label>
          <label><span>Naam</span><input type="text" name="name" value="${escapeHtml(project?.name || '')}" required /></label>
          <label><span>Beschrijving</span><textarea name="description">${escapeHtml(project?.description || '')}</textarea></label>
          <div class="filter-grid">
            <label><span>Pipeline status</span><select name="pipeline_status">${selectOptions(PIPELINE_STAGES, project?.pipeline_status || 'verkennen')}</select></label>
            <label><span>Type</span><select name="product_type">${selectOptions(PRODUCT_TYPES, project?.product_type || 'other')}</select></label>
            <label><span>Label</span><select name="service_label">${selectOptions(SERVICE_LABELS, project?.service_label || 'other')}</select></label>
            <label><span>Forecast (EUR)</span><input type="number" step="0.01" name="forecast_amount" value="${project?.forecast_amount || 0}" /></label>
            <label><span>Werkelijk (EUR)</span><input type="number" step="0.01" name="actual_amount" value="${project?.actual_amount || 0}" /></label>
            <label><span>Geschatte uren</span><input type="number" step="0.5" name="estimated_hours" value="${project?.estimated_hours || 0}" /></label>
            <label><span>Pricing model</span>
              <select name="pricing_model">
                <option value="project" ${project?.pricing_model === 'project' ? 'selected' : ''}>Project (vast)</option>
                <option value="hourly" ${project?.pricing_model === 'hourly' ? 'selected' : ''}>Uurtarief</option>
                <option value="recurring_monthly" ${project?.pricing_model === 'recurring_monthly' ? 'selected' : ''}>Maandelijks</option>
              </select>
            </label>
            <label><span>Prio</span><select name="priority">${selectOptions(PRIORITIES, project?.priority || 'medium')}</select></label>
            <label><span>Owner</span>
              <select name="owner">
                ${(() => {
                  const cur = project?.owner || 'Harmen';
                  const inList = OWNER_OPTIONS.includes(cur);
                  return OWNER_OPTIONS.map((o) => `<option value="${escapeHtml(o)}" ${o === cur ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('') +
                    (!inList && cur ? `<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)}</option>` : '');
                })()}
              </select>
            </label>
            <label><span>Start</span><input type="date" name="start_date" value="${project?.start_date || ''}" /></label>
            <label><span>Geaccepteerd op</span><input type="date" name="accepted_date" value="${project?.accepted_date || ''}" /></label>
            <label><span>Volgende actie datum</span><input type="date" name="next_action_date" value="${project?.next_action_date || ''}" /></label>
          </div>
          <label><span>Volgende actie</span><input type="text" name="next_action" value="${escapeHtml(project?.next_action || '')}" /></label>
          <div class="filter-grid">
            <label><span>Lead bron</span>
              <select name="lead_source">
                <option value="netwerk" ${project?.lead_source === 'netwerk' || !project?.lead_source ? 'selected' : ''}>Via netwerk</option>
                <option value="buiten_netwerk" ${project?.lead_source === 'buiten_netwerk' ? 'selected' : ''}>Buiten netwerk (telt als KPI-lead)</option>
              </select>
            </label>
            <div>
              <span style="display:block;color:var(--text-secondary);font-size:.72rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin-bottom:7px;">Holy shit moment</span>
              <label class="checkbox-pill">
                <input type="checkbox" name="is_breakthrough" value="true" ${project?.is_breakthrough ? 'checked' : ''} />
                <span>Markeer als doorbraak ✨</span>
              </label>
            </div>
          </div>
          <div class="admin-actions">
            <button type="submit" class="button primary">Opslaan</button>
            <a href="#/projecten" class="button ghost">Annuleren</a>
          </div>
        </form>
      </section>
    </section>`;
}

function renderProjectDetail(db, projectId) {
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) return `<section class="page-section"><div class="section-header"><div><h1>Project niet gevonden</h1></div></div></section>`;
  const customer = db.customers.find((c) => c.id === project.customer_id);
  const tasks = db.tasks.filter((t) => t.project_id === projectId);
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const finance = db.finance.filter((f) => f.project_id === projectId);
  const incomeTotal = finance.filter((f) => f.type === 'income').reduce((s, f) => s + Number(f.amount), 0);
  const directExpenseTotal = finance.filter((f) => f.type === 'expense').reduce((s, f) => s + Number(f.amount), 0);
  const hours = Number(project.estimated_hours || 0);
  const hoursCost = hours * INTERNAL_HOURLY_RATE;
  const revenueForMargin = Number(project.actual_amount || project.forecast_amount || project.value_amount || 0);
  const margin = revenueForMargin - directExpenseTotal - hoursCost;
  const marginPct = revenueForMargin ? margin / revenueForMargin : 0;

  const taskRow = (t) => {
    const meetingInfo = t.meeting_at
      ? `<div class="muted" style="margin-top:4px;display:flex;gap:8px;align-items:center;">📅 ${escapeHtml(new Date(t.meeting_at).toLocaleString('nl-NL', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}${t.location ? ` · ${escapeHtml(t.location)}` : ''}<button type="button" class="legend-btn" data-action="download-ics" data-task-id="${escapeHtml(t.id)}" style="font-size:.7rem;">⬇ .ics</button></div>`
      : '';
    return [
      `<input type="checkbox" data-action="toggle-task" data-task-id="${escapeHtml(t.id)}" ${t.status === 'done' ? 'checked' : ''} />`,
      `<strong style="${t.status === 'done' ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${escapeHtml(t.title)}</strong>${t.description ? `<div class="muted">${escapeHtml(t.description)}</div>` : ''}${meetingInfo}`,
      badge(TASK_STATUSES.find((s) => s.value === t.status)?.label || t.status, t.status === 'done' ? 'success' : t.status === 'blocked' ? 'danger' : t.status === 'in_progress' ? 'warning' : 'info'),
      t.due_date ? badge(dueLabel(t.due_date), dueTone(t.due_date)) : '<span class="muted">—</span>',
      badge(PRIORITIES.find((p) => p.value === t.priority)?.label || t.priority, t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'info'),
      escapeHtml(t.owner || ''),
      `<button type="button" class="button ghost" data-action="toggle-task-btn" data-task-id="${escapeHtml(t.id)}" title="${t.status === 'done' ? 'Heropenen' : 'Afvinken'}">${t.status === 'done' ? '↺' : '✓'}</button> <button type="button" class="button ghost" data-action="delete-task" data-task-id="${escapeHtml(t.id)}" title="Verwijderen">×</button>`,
    ];
  };

  return `
    <section class="page-section">
      <div class="section-header">
        <div>
          <p class="muted"><a href="#/projecten">← Projecten</a> · <a href="#/klanten/${escapeHtml(project.customer_id)}">${escapeHtml(customer?.name || '')}</a></p>
          <h1>${escapeHtml(project.name)}</h1>
          <p>${escapeHtml(project.description || '')}</p>
        </div>
        <div style="display:flex;gap:8px;flex-direction:column;align-items:flex-end;">
          ${pipelineBadge(project.pipeline_status)}
          <div style="display:flex;gap:8px;">
            <a href="#/projecten/${escapeHtml(project.id)}/bewerken" class="button ghost">Bewerken</a>
            <button type="button" class="button ghost" data-action="delete-project" data-id="${escapeHtml(project.id)}" data-name="${escapeHtml(project.name)}" style="border-color:rgba(194,80,128,.5);color:#FF8FB6;">Verwijderen</button>
          </div>
        </div>
      </div>

      <div class="metric-grid">
        ${metricCard('Forecast', fmtCurrency(project.forecast_amount), project.pricing_model === 'recurring_monthly' ? '/ maand' : project.pricing_model, 'warning')}
        ${metricCard('Werkelijk', fmtCurrency(project.actual_amount), 'goedgekeurd / opgeleverd', 'success')}
        ${metricCard('Directe kosten', fmtCurrency(directExpenseTotal), `${finance.filter((f) => f.type === 'expense').length} expense-regel(s)`, directExpenseTotal > 0 ? 'warning' : 'default')}
        ${metricCard('Uren × €' + INTERNAL_HOURLY_RATE, fmtCurrency(hoursCost), `${fmtNumber(hours, 1)} uur geschat`)}
        ${metricCard('Marge', fmtCurrency(margin), revenueForMargin ? `${fmtNumber(marginPct * 100, 0)}% van revenue` : '—', margin > 0 ? 'success' : 'danger')}
        ${metricCard('Open taken', openTasks.length, `${doneTasks.length} klaar`)}
        ${metricCard('Volgende actie', project.next_action_date ? dueLabel(project.next_action_date) : '—', project.next_action || '', dueTone(project.next_action_date))}
      </div>

      <section class="panel">
        <div class="panel-heading">
          <div><h2>Taken</h2><p>${openTasks.length} open · ${doneTasks.length} klaar</p></div>
          <button type="button" class="button primary" data-action="add-task" data-project-id="${escapeHtml(project.id)}">+ Taak</button>
        </div>
        ${table(['','Taak','Status','Deadline','Prio','Owner',''], [...openTasks, ...doneTasks].map(taskRow), { compact: true })}
      </section>

      <section class="panel">
        <div class="panel-heading"><div><h2>Finance</h2><p>Income gekoppeld aan dit project.</p></div></div>
        ${table(
          ['Datum','Beschrijving','Bedrag','Categorie','Status'],
          finance.filter((f) => !isTripEntry(f)).map((f) => [
            fmtDate(f.date),
            escapeHtml(f.description),
            (f.type === 'expense' ? '-' : '+') + fmtCurrency(f.amount),
            escapeHtml(f.category || ''),
            escapeHtml(f.factuur_status || ''),
          ]),
          { compact: true },
        )}
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Kilometers</h2>
            <p>${finance.filter(isTripEntry).length} rit(ten) · ${fmtNumber(finance.filter(isTripEntry).reduce((s, t) => s + Number(t.amount || 0), 0))} km totaal</p>
          </div>
          <button type="button" class="button primary" data-action="add-trip" data-project-id="${escapeHtml(project.id)}">+ Rit</button>
        </div>
        ${(() => {
          const trips = finance.filter(isTripEntry).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          if (trips.length === 0) return '<p class="empty-state">Nog geen ritten gelogd voor dit project.</p>';
          return table(
            ['Datum','Persoon','Route','Doel','Km',''],
            trips.map((t) => [
              fmtDate(t.date),
              escapeHtml(t.owner || ''),
              escapeHtml(t.vendor || ''),
              escapeHtml(t.description || ''),
              fmtNumber(Number(t.amount || 0)),
              `<button type="button" class="button ghost" data-action="edit-trip" data-trip-id="${escapeHtml(t.id)}" title="Bewerken">✎</button> <button type="button" class="button ghost" data-action="delete-trip" data-trip-id="${escapeHtml(t.id)}" title="Verwijderen">×</button>`,
            ]),
            { compact: true },
          );
        })()}
      </section>
    </section>`;
}

function renderTaken(db) {
  const customersById = Object.fromEntries(db.customers.map((c) => [c.id, c]));
  const projectsById = Object.fromEntries(db.projects.map((p) => [p.id, p]));
  const open = db.tasks.filter((t) => t.status !== 'done');
  const done = db.tasks.filter((t) => t.status === 'done')
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
    .slice(0, 20);
  const overdue = open.filter((t) => relDays(t.due_date) !== null && relDays(t.due_date) < 0).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
  const today = open.filter((t) => relDays(t.due_date) === 0);
  const week = open.filter((t) => { const d = relDays(t.due_date); return d !== null && d > 0 && d <= 7; }).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
  const later = open.filter((t) => { const d = relDays(t.due_date); return d === null || d > 7; });

  const taskRowOpen = (t, tone) => {
    const proj = projectsById[t.project_id];
    const cust = proj ? customersById[proj.customer_id] : null;
    return [
      `<input type="checkbox" data-action="toggle-task" data-task-id="${escapeHtml(t.id)}" />`,
      `<strong>${escapeHtml(t.title)}</strong>`,
      `<a href="#/projecten/${escapeHtml(t.project_id)}"><span class="muted">${escapeHtml(cust?.name || '')}</span> · ${escapeHtml(proj?.name || '')}</a>`,
      t.due_date ? badge(dueLabel(t.due_date), tone) : '<span class="muted">—</span>',
      badge(PRIORITIES.find((p) => p.value === t.priority)?.label || t.priority, t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'info'),
    ];
  };

  const renderGroup = (title, items, tone) => `
    <section class="panel">
      <div class="panel-heading"><div><h2>${title}</h2><p>${items.length} ta${items.length === 1 ? 'ak' : 'ken'}</p></div></div>
      ${table(['','Taak','Project','Deadline','Prio'], items.map((t) => taskRowOpen(t, tone)), { compact: true })}
    </section>`;

  const doneSection = done.length ? `
    <section class="panel">
      <div class="panel-heading"><div><h2>Recent klaar</h2><p>${done.length} ta${done.length === 1 ? 'ak' : 'ken'} · vink uit om opnieuw te openen</p></div></div>
      ${table(
        ['','Taak','Project','Klaar op'],
        done.map((t) => {
          const proj = projectsById[t.project_id];
          const cust = proj ? customersById[proj.customer_id] : null;
          return [
            `<input type="checkbox" data-action="toggle-task" data-task-id="${escapeHtml(t.id)}" checked />`,
            `<span style="text-decoration:line-through;color:var(--text-muted);">${escapeHtml(t.title)}</span>`,
            `<a href="#/projecten/${escapeHtml(t.project_id)}"><span class="muted">${escapeHtml(cust?.name || '')}</span> · ${escapeHtml(proj?.name || '')}</a>`,
            t.completed_at ? `<span class="muted">${fmtDate(t.completed_at)}</span>` : '<span class="muted">—</span>',
          ];
        }),
        { compact: true },
      )}
    </section>` : '';

  return `
    <section class="page-section">
      <div class="section-header"><div><h1>Taken</h1><p>Alles wat openstaat, gegroepeerd op urgentie.</p></div></div>
      ${overdue.length ? renderGroup(`Te laat (${overdue.length})`, overdue, 'danger') : ''}
      ${today.length ? renderGroup('Vandaag', today, 'warning') : ''}
      ${week.length ? renderGroup('Deze week', week, 'warning') : ''}
      ${later.length ? renderGroup('Later / zonder deadline', later, 'info') : ''}
      ${!open.length ? `<section class="panel"><p class="empty-state">Geen open taken.</p></section>` : ''}
      ${doneSection}
    </section>`;
}

function renderFinanceBreakdown(entries, q) {
  const personFilter = (q.person || 'totaal').toLowerCase();
  // Per persoon filter: bepaal aandeel
  const filtered = entries.filter((f) => {
    if (personFilter === 'totaal') return true;
    const owner = (f.owner || '').toLowerCase();
    return owner.includes(personFilter);
  });

  // Groepeer per vendor + maand
  const yearForChart = q.year || new Date().getFullYear().toString();
  const ys = `${yearForChart}-01-01`;
  const ye = `${yearForChart}-12-31`;
  const monthsLbl = [];
  for (let mi = 0; mi < 12; mi++) {
    const d = new Date(Number(yearForChart), mi, 1);
    monthsLbl.push({ m: d.toISOString().slice(0, 7), label: d.toLocaleDateString('nl-NL', { month: 'short' }) });
  }

  const rowsByVendor = {};
  for (const f of filtered) {
    if (!f.date || f.date < ys || f.date > ye) continue;
    const vendor = f.vendor || f.description || '—';
    if (!rowsByVendor[vendor]) rowsByVendor[vendor] = { vendor, category: f.category || '', recurring: f.recurring, total: 0, byMonth: {} };
    const row = rowsByVendor[vendor];
    const amount = Number(f.amount || 0);
    if (f.recurring === 'monthly') {
      const fromIdx = Math.max(0, monthsLbl.findIndex((mm) => mm.m >= f.date.slice(0, 7)));
      for (let i = fromIdx; i < monthsLbl.length; i++) {
        row.byMonth[monthsLbl[i].m] = (row.byMonth[monthsLbl[i].m] || 0) + amount;
        row.total += amount;
      }
      if (f.category && !row.category) row.category = f.category;
    } else {
      const m = f.date.slice(0, 7);
      row.byMonth[m] = (row.byMonth[m] || 0) + amount;
      row.total += amount;
    }
  }
  const vendorRows = Object.values(rowsByVendor).sort((a, b) => b.total - a.total);
  const monthTotals = monthsLbl.map((mm) => vendorRows.reduce((s, r) => s + (r.byMonth[mm.m] || 0), 0));
  const grandTotal = monthTotals.reduce((s, v) => s + v, 0);

  const personHref = (p) => {
    const params = new URLSearchParams(q);
    if (p === 'totaal') params.delete('person'); else params.set('person', p);
    return `#/finance?${params.toString()}`;
  };

  return `
    <section class="panel">
      <div class="panel-heading">
        <div><h2>Breakdown</h2><p>${vendorRows.length} regels · totaal ${fmtCurrency(grandTotal)}</p></div>
        <div class="person-toggle">
          ${[
            { v: 'totaal',   l: 'Totaal' },
            { v: 'harmen',   l: 'Harmen' },
            { v: 'karin',    l: 'Karin' },
            { v: 'danielle', l: 'Danielle' },
          ].map((p) => `<a href="${personHref(p.v)}" class="${personFilter === p.v ? 'active' : ''}">${p.l}</a>`).join('')}
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table compact breakdown-table">
          <thead>
            <tr>
              <th>Leverancier / regel</th>
              <th>Categorie</th>
              ${monthsLbl.map((mm) => `<th style="text-align:right;">${escapeHtml(mm.label)}</th>`).join('')}
              <th style="text-align:right;">Totaal</th>
              <th>Recurring?</th>
            </tr>
          </thead>
          <tbody>
            ${vendorRows.map((r) => `
              <tr>
                <td><strong>${escapeHtml(r.vendor)}</strong></td>
                <td>${escapeHtml(r.category)}</td>
                ${monthsLbl.map((mm) => {
                  const v = r.byMonth[mm.m] || 0;
                  return `<td style="text-align:right;${v ? '' : 'color:var(--text-muted);'}">${v ? fmtCurrency(v) : '—'}</td>`;
                }).join('')}
                <td style="text-align:right;"><strong>${fmtCurrency(r.total)}</strong></td>
                <td>${r.recurring === 'monthly' ? '✓ Maandelijks' : r.recurring === 'one_off' ? 'Eenmalig' : escapeHtml(r.recurring || '')}</td>
              </tr>
            `).join('') || `<tr><td colspan="${4 + monthsLbl.length}" class="empty-cell">Geen records</td></tr>`}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid rgba(155,111,207,.4);">
              <td colspan="2"><strong>Totaal</strong></td>
              ${monthTotals.map((v) => `<td style="text-align:right;"><strong>${v ? fmtCurrency(v) : '—'}</strong></td>`).join('')}
              <td style="text-align:right;"><strong>${fmtCurrency(grandTotal)}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>`;
}

function renderFinance(db) {
  const route = parseRoute();
  const q = route.query || {};
  const filterType    = q.type || '';
  const filterPayment = q.payment || '';
  const filterYear    = q.year || '';

  let entries = db.finance;
  if (filterType) entries = entries.filter((f) => f.type === filterType);
  if (filterYear) entries = entries.filter((f) => (f.date || '').slice(0, 4) === filterYear);
  if (filterPayment === 'gefactureerd_ontvangen') {
    entries = entries.filter((f) => ['gefactureerd','ontvangen'].includes(f.payment_status));
  } else if (filterPayment) {
    entries = entries.filter((f) => f.payment_status === filterPayment);
  }

  const incomes = entries.filter((f) => f.type === 'income' && !isTripEntry(f));
  const expenses = entries.filter((f) => f.type === 'expense' && !isTripEntry(f));
  const incomeTotal = incomes.reduce((s, f) => s + Number(f.amount), 0);
  const expenseTotal = expenses.reduce((s, f) => s + Number(f.amount), 0);
  const ontvangen = incomes.filter((f) => f.payment_status === 'ontvangen').reduce((s, f) => s + Number(f.amount), 0);
  const gefactureerd = incomes.filter((f) => f.payment_status === 'gefactureerd').reduce((s, f) => s + Number(f.amount), 0);
  const verwacht = incomes.filter((f) => f.payment_status === 'verwacht').reduce((s, f) => s + Number(f.amount), 0);

  // ===== Finance per maand: income (gefactureerd+ontvangen) + expense + netto =====
  const yearForChart = filterYear || new Date().getFullYear().toString();
  const ys = `${yearForChart}-01-01`;
  const ye = `${yearForChart}-12-31`;
  const months = [];
  for (let mi = 0; mi < 12; mi++) {
    const d = new Date(Number(yearForChart), mi, 1);
    months.push({
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('nl-NL', { month: 'short' }),
      income: 0, expense: 0, net: 0,
    });
  }
  const monthsByKey = Object.fromEntries(months.map((m) => [m.month, m]));
  for (const f of db.finance) {
    if (isTripEntry(f)) continue;
    if (!f.date || f.date < ys || f.date > ye) continue;
    const amount = Number(f.amount || 0);
    if (!amount) continue;
    if (f.recurring === 'monthly') {
      const fromIdx = Math.max(0, months.findIndex((m) => m.month >= f.date.slice(0, 7)));
      for (let i = fromIdx; i < months.length; i++) {
        if (f.type === 'income' && ['gefactureerd','ontvangen'].includes(f.payment_status)) months[i].income += amount;
        else if (f.type === 'expense') months[i].expense += amount;
      }
    } else {
      const m = monthsByKey[f.date.slice(0, 7)];
      if (!m) continue;
      if (f.type === 'income' && ['gefactureerd','ontvangen'].includes(f.payment_status)) m.income += amount;
      else if (f.type === 'expense') m.expense += amount;
    }
  }
  for (const m of months) m.net = m.income - m.expense;
  const todayMonth = new Date().toISOString().slice(0, 7);
  const financeSeries = [
    { key: 'net',     label: 'Netto',    color: '#D8FE56', bold: true },
    { key: 'income',  label: 'Inkomsten', color: '#FFFFFF' },
    { key: 'expense', label: 'Uitgaven',  color: '#FF8FB6' },
  ];

  // Per categorie expenses
  const byCat = {};
  for (const f of expenses) {
    const k = f.category || 'Overig';
    byCat[k] ||= { label: k, value: 0 };
    byCat[k].value += Number(f.amount);
  }
  const catSeries = Object.values(byCat).sort((a, b) => b.value - a.value);

  const customersById = Object.fromEntries(db.customers.map((c) => [c.id, c]));
  const projectsById = Object.fromEntries(db.projects.map((p) => [p.id, p]));

  const activeFilters = [];
  if (filterType === 'income')  activeFilters.push('Type: Income');
  if (filterType === 'expense') activeFilters.push('Type: Expense');
  if (filterPayment === 'gefactureerd_ontvangen') activeFilters.push('Status: gefactureerd + ontvangen');
  else if (filterPayment) activeFilters.push(`Status: ${filterPayment}`);
  if (filterYear) activeFilters.push(`Jaar: ${filterYear}`);

  const linkTile = (label, value, meta, tone, href) =>
    `<a class="metric-card metric-${tone} metric-card--link" href="${href}">
       <span class="metric-label">${escapeHtml(label)}</span>
       <strong class="metric-value">${value}</strong>
       <span class="metric-meta">${escapeHtml(meta)}</span>
     </a>`;

  return `
    <section class="page-section">
      <div class="section-header">
        <div>
          <h1>Finance</h1>
          <p>Income + expenses, gekoppeld aan projecten waar mogelijk.</p>
          ${activeFilters.length ? `<p style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">${activeFilters.map((f) => `<span class="badge badge-info">${escapeHtml(f)}</span>`).join('')} <a href="#/finance" class="muted" style="font-size:.82rem;">Filters wissen</a></p>` : ''}
        </div>
      </div>

      <div class="metric-grid">
        ${linkTile('Ontvangen',     fmtCurrency(ontvangen),    'income met status ontvangen',     'success', '#/finance?type=income&payment=ontvangen')}
        ${linkTile('Gefactureerd',  fmtCurrency(gefactureerd), 'wacht op betaling',                'warning', '#/finance?type=income&payment=gefactureerd')}
        ${linkTile('Verwacht',      fmtCurrency(verwacht),     'forecast / nog te factureren',     'default', '#/finance?type=income&payment=verwacht')}
        ${linkTile('Expenses totaal', fmtCurrency(expenseTotal), `${expenses.length} regel(s)`,    'warning', '#/finance?type=expense')}
        ${linkTile('Netto (ontvangen - expense)', fmtCurrency(ontvangen - expenseTotal), '', ontvangen > expenseTotal ? 'success' : 'danger', '#/finance')}
      </div>

      ${activeFilters.length ? renderFinanceBreakdown(entries, q) : ''}

      <section class="panel forecast-panel">
        <div class="forecast-panel__head">
          <div>
            <span class="metric-label">Inkomsten · Uitgaven · Netto</span>
            <h3 style="margin:0;font-family:'Barlow';font-weight:900;color:var(--white);font-size:1.2rem;">${escapeHtml(yearForChart)} — per maand</h3>
            <span class="muted" style="font-size:.78rem;">Inkomsten: gefactureerd + ontvangen. Recurring kosten gespreid over jaar.</span>
          </div>
          <div class="chart-legend">
            ${financeSeries.map((s) => `<span><span class="legend-dot" style="background:${s.color};${s.bold ? 'height:4px;' : ''}"></span>${escapeHtml(s.label)}</span>`).join('')}
          </div>
        </div>
        ${teamMonthlyChart({ months, series: financeSeries, currentMonth: todayMonth, ariaLabel: `Inkomsten en uitgaven per maand ${yearForChart}` })}
      </section>

      <section class="panel">
        <div class="panel-heading"><div><h2>Expenses per categorie</h2></div></div>
        ${table(
          ['Categorie','Bedrag'],
          catSeries.map((c) => [escapeHtml(c.label), fmtCurrency(c.value)]),
          { compact: true },
        )}
      </section>

      <section class="panel">
        <div class="panel-heading"><div><h2>Alle regels</h2><p>${db.finance.length} totaal · klik in "Project" om kosten te alloceren</p></div></div>
        ${(() => {
          const projectsOrdered = db.projects.slice()
            .sort((a, b) => (customersById[a.customer_id]?.name || '').localeCompare(customersById[b.customer_id]?.name || ''));
          const projectSelect = (currentId, finId) => `
            <select data-action="finance-project" data-id="${escapeHtml(finId)}" style="font-size:.78rem;max-width:240px;">
              <option value=""${currentId ? '' : ' selected'}>— niet gekoppeld —</option>
              ${projectsOrdered.map((p) => `<option value="${escapeHtml(p.id)}"${p.id === currentId ? ' selected' : ''}>${escapeHtml(customersById[p.customer_id]?.name || '')} · ${escapeHtml(p.name)}</option>`).join('')}
            </select>`;
          return table(
            ['Datum','Type','Beschrijving','Vendor','Bedrag','Categorie','Project','Betaalstatus'],
            db.finance.filter((f) => !isTripEntry(f)).map((f) => [
              fmtDate(f.date),
              badge(f.type === 'income' ? 'in' : 'uit', f.type === 'income' ? 'success' : 'warning'),
              escapeHtml(f.description),
              escapeHtml(f.vendor || ''),
              (f.type === 'expense' ? '-' : '+') + fmtCurrency(f.amount),
              escapeHtml(f.category || ''),
              projectSelect(f.project_id || '', f.id),
              f.type === 'income'
                ? `<select data-action="payment-status" data-id="${escapeHtml(f.id)}">
                     ${['verwacht','gefactureerd','ontvangen','afgeschreven'].map((v) => `<option value="${v}" ${f.payment_status === v ? 'selected' : ''}>${v}</option>`).join('')}
                   </select>`
                : escapeHtml(f.factuur_status || ''),
            ]),
            { compact: true },
          );
        })()}
      </section>

      ${renderKilometersSection(db, customersById, projectsById)}
    </section>`;
}

function renderKilometersSection(db, customersById, projectsById) {
  const allTrips = db.finance.filter(isTripEntry);
  const years = Array.from(new Set(allTrips.map((t) => (t.date || '').slice(0, 4)).filter(Boolean))).sort().reverse();
  const currentYear = new Date().getFullYear().toString();
  if (!years.includes(currentYear)) years.unshift(currentYear);

  const fYear  = appState.tripFilters.year  ?? currentYear;
  const fOwner = appState.tripFilters.owner ?? '';

  let trips = allTrips.slice();
  if (fYear)  trips = trips.filter((t) => (t.date || '').slice(0, 4) === fYear);
  if (fOwner) trips = trips.filter((t) => (t.owner || '') === fOwner);
  trips.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalKm = trips.reduce((s, t) => s + Number(t.amount || 0), 0);
  const owners = Array.from(new Set(allTrips.map((t) => t.owner).filter(Boolean))).sort();

  return `
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Kilometers</h2>
          <p>${trips.length} rit(ten) · ${fmtNumber(totalKm)} km totaal · voor de Belastingdienst</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select data-action="trip-filter-year" style="font-size:.82rem;">
            <option value="">Alle jaren</option>
            ${years.map((y) => `<option value="${escapeHtml(y)}" ${y === fYear ? 'selected' : ''}>${escapeHtml(y)}</option>`).join('')}
          </select>
          <select data-action="trip-filter-owner" style="font-size:.82rem;">
            <option value="">Iedereen</option>
            ${owners.map((o) => `<option value="${escapeHtml(o)}" ${o === fOwner ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
          </select>
          <button type="button" class="button ghost" data-action="export-trips-csv">⬇ CSV</button>
          <button type="button" class="button primary" data-action="add-trip">+ Rit</button>
        </div>
      </div>
      ${trips.length === 0
        ? '<p class="empty-state">Nog geen ritten in deze selectie. Klik op "+ Rit" om er één toe te voegen.</p>'
        : table(
            ['Datum','Persoon','Project','Route','Doel','Km',''],
            trips.map((t) => {
              const p = projectsById[t.project_id];
              const c = p ? customersById[p.customer_id] : null;
              return [
                fmtDate(t.date),
                escapeHtml(t.owner || ''),
                p ? `<a href="#/projecten/${escapeHtml(p.id)}"><span class="muted">${escapeHtml(c?.name || '')}</span> · ${escapeHtml(p.name)}</a>` : '<span class="muted">—</span>',
                escapeHtml(t.vendor || ''),
                escapeHtml(t.description || ''),
                fmtNumber(Number(t.amount || 0)),
                `<button type="button" class="button ghost" data-action="edit-trip" data-trip-id="${escapeHtml(t.id)}" title="Bewerken">✎</button> <button type="button" class="button ghost" data-action="delete-trip" data-trip-id="${escapeHtml(t.id)}" title="Verwijderen">×</button>`,
              ];
            }),
            { compact: true },
          )}
    </section>`;
}

function renderKlanten(db) {
  return `
    <section class="page-section">
      <div class="section-header">
        <div><h1>Klanten & samenwerkingen</h1></div>
        <button type="button" class="button primary" data-action="add-customer">+ Nieuwe klant</button>
      </div>
      <section class="panel">
        ${(() => {
          const enriched = db.customers
            .map((c) => {
              const projects = db.projects.filter((p) => p.customer_id === c.id);
              const actual = projects.reduce((s, p) => s + Number(p.actual_amount || 0), 0);
              const forecast = projects.reduce((s, p) => s + Number(p.forecast_amount || 0), 0);
              return { c, projects, actual, forecast };
            })
            .sort((a, b) => (b.actual + b.forecast) - (a.actual + a.forecast));
          const totalProjects = enriched.reduce((s, x) => s + x.projects.length, 0);
          const totalActual   = enriched.reduce((s, x) => s + x.actual, 0);
          const totalForecast = enriched.reduce((s, x) => s + x.forecast, 0);
          const rows = enriched.map(({ c, projects, actual, forecast }) => [
            `<a href="#/klanten/${escapeHtml(c.id)}"><strong>${escapeHtml(c.name)}</strong></a>`,
            badge(c.type, c.type === 'klant' ? 'success' : c.type === 'samenwerking' ? 'info' : 'warning'),
            escapeHtml(c.industry || ''),
            badge(c.status, c.status === 'active' ? 'success' : 'default'),
            `${projects.length}`,
            actual ? `<strong>${fmtCurrency(actual)}</strong>` : '<span class="muted">—</span>',
            forecast ? fmtCurrency(forecast) : '<span class="muted">—</span>',
          ]);
          rows.push([
            '<strong>Totaal</strong>',
            '', '', '',
            `<strong>${totalProjects}</strong>`,
            `<strong>${fmtCurrency(totalActual)}</strong>`,
            `<strong>${fmtCurrency(totalForecast)}</strong>`,
          ]);
          return table(['Naam','Type','Industry','Status','Projecten','Werkelijk','Forecast'], rows);
        })()}
      </section>
    </section>`;
}

function renderKlantDetail(db, customerId) {
  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) return `<section class="page-section"><h1>Klant niet gevonden</h1></section>`;
  const projects = db.projects.filter((p) => p.customer_id === customerId);
  const finance = db.finance.filter((f) => f.project_id && projects.some((p) => p.id === f.project_id));
  const income = finance.filter((f) => f.type === 'income').reduce((s, f) => s + Number(f.amount), 0);
  return `
    <section class="page-section">
      <div class="section-header">
        <div>
          <p class="muted"><a href="#/klanten">← Klanten</a></p>
          <h1>${escapeHtml(customer.name)}</h1>
          <p>${escapeHtml(customer.notes || '')}</p>
        </div>
        <div>${badge(customer.type, 'info')}</div>
      </div>
      <div class="metric-grid">
        ${metricCard('Projecten', projects.length, '', 'success')}
        ${metricCard('Werkelijk', fmtCurrency(projects.reduce((s, p) => s + Number(p.actual_amount || 0), 0)), 'goedgekeurd / opgeleverd', 'success')}
        ${metricCard('Forecast', fmtCurrency(projects.reduce((s, p) => s + Number(p.forecast_amount || 0), 0)), 'in pipeline', 'warning')}
        ${metricCard('Income geboekt', fmtCurrency(income))}
      </div>
      <section class="panel">
        <div class="panel-heading"><div><h2>Projecten</h2></div></div>
        ${table(
          ['Project','Status','Type','Waarde','Volgende actie'],
          projects.map((p) => [
            `<a href="#/projecten/${escapeHtml(p.id)}"><strong>${escapeHtml(p.name)}</strong></a>`,
            pipelineBadge(p.pipeline_status),
            badge(PRODUCT_TYPES.find((t) => t.value === p.product_type)?.label || p.product_type, 'info'),
            projectValueCell(p),
            p.next_action ? `${escapeHtml(p.next_action)}${p.next_action_date ? ` · ${fmtDate(p.next_action_date)}` : ''}` : '<span class="muted">—</span>',
          ]),
          { compact: true },
        )}
      </section>
    </section>`;
}

// ============== Shell ==============

function renderNavigation(route) {
  const items = [
    ['/', 'Overview'],
    ['/projecten', 'Projecten'],
    ['/taken', 'Taken'],
    ['/finance', 'Finance'],
    ['/klanten', 'Klanten'],
  ];
  return `<nav class="side-nav">${items.map(([path, label]) => {
    const active = route.path === path || (path !== '/' && route.path.startsWith(path));
    return `<a class="${active ? 'active' : ''}" href="#${path}">${label}</a>`;
  }).join('')}</nav>`;
}

function renderPage(db, route) {
  if (route.parts[0] === 'projecten' && route.parts[1] === 'nieuw') return renderProjectForm(db, null);
  if (route.parts[0] === 'projecten' && route.parts[1] && route.parts[2] === 'bewerken') {
    return renderProjectForm(db, db.projects.find((p) => p.id === route.parts[1]));
  }
  if (route.parts[0] === 'projecten' && route.parts[1]) return renderProjectDetail(db, route.parts[1]);
  if (route.parts[0] === 'klanten' && route.parts[1]) return renderKlantDetail(db, route.parts[1]);
  switch (route.path) {
    case '/projecten': return renderProjectenList(db);
    case '/taken':     return renderTaken(db);
    case '/finance':   return renderFinance(db);
    case '/klanten':   return renderKlanten(db);
    default:           return renderOverview(db);
  }
}

function attachEvents() {
  document.getElementById('project-filter')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    appState.filters = Object.fromEntries(data.entries());
    renderApp();
  });
  document.querySelector('[data-action="reset-project-filter"]')?.addEventListener('click', () => {
    appState.filters = {}; renderApp();
  });

  document.querySelectorAll('[data-action="toggle-task"]').forEach((checkbox) => {
    checkbox.addEventListener('change', async (e) => {
      const id = e.target.dataset.taskId;
      const task = getDatabase().tasks.find((t) => t.id === id);
      if (!task) return;
      task.status = e.target.checked ? 'done' : 'open';
      await upsertTask(task);
    });
  });

  document.querySelectorAll('[data-action="toggle-task-btn"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.taskId;
      const task = getDatabase().tasks.find((t) => t.id === id);
      if (!task) return;
      task.status = task.status === 'done' ? 'open' : 'done';
      await upsertTask(task);
    });
  });

  // ===== Kilometers / ritten =====
  function openTripDialog(seed = {}) {
    appState.editingTrip = {
      id: '',
      date: new Date().toISOString().slice(0, 10),
      owner: 'Harmen',
      project_id: '',
      route: '',
      purpose: '',
      kilometers: '',
      ...seed,
    };
    renderApp();
  }

  document.querySelectorAll('[data-action="add-trip"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const projectId = e.currentTarget.dataset.projectId || '';
      const project = projectId ? getDatabase().projects.find((p) => p.id === projectId) : null;
      openTripDialog({
        project_id: projectId,
        owner: project?.owner && OWNER_OPTIONS.includes(project.owner) ? project.owner : 'Harmen',
      });
    });
  });

  document.querySelectorAll('[data-action="edit-trip"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.tripId;
      const entry = getDatabase().finance.find((f) => f.id === id);
      if (!entry) return;
      openTripDialog({
        id: entry.id,
        date: entry.date || new Date().toISOString().slice(0, 10),
        owner: entry.owner || 'Harmen',
        project_id: entry.project_id || '',
        route: entry.vendor || '',
        purpose: entry.description || '',
        kilometers: Number(entry.amount || 0),
      });
    });
  });

  document.querySelectorAll('[data-action="delete-trip"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.tripId;
      if (!confirm('Deze rit verwijderen?')) return;
      try {
        await deleteFinance(id);
      } catch (err) {
        alert('Verwijderen mislukt: ' + err.message);
      }
    });
  });

  document.querySelector('[data-action="trip-dialog-cancel"]')?.addEventListener('click', () => {
    appState.editingTrip = null;
    document.getElementById('trip-dialog')?.close();
    renderApp();
  });

  document.getElementById('trip-dialog')?.addEventListener('click', (e) => {
    if (e.target.id === 'trip-dialog') {
      appState.editingTrip = null;
      e.target.close();
      renderApp();
    }
  });

  document.getElementById('trip-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const km = Number(data.kilometers);
    if (!km || km <= 0) { alert('Vul een aantal kilometers in.'); return; }
    const payload = {
      id: data.id || nextId('trip'),
      date: data.date,
      type: 'expense',
      amount: km,
      category: TRIP_CATEGORY,
      vendor: (data.route || '').trim(),
      description: (data.purpose || '').trim(),
      owner: data.owner || 'Harmen',
      project_id: data.project_id || null,
      payment_status: null,
      factuur_status: null,
      recurring: null,
    };
    try {
      await upsertFinance(payload);
      appState.editingTrip = null;
      document.getElementById('trip-dialog')?.close();
    } catch (err) {
      alert('Opslaan mislukt: ' + err.message);
    }
  });

  document.querySelector('[data-action="trip-filter-year"]')?.addEventListener('change', (e) => {
    appState.tripFilters.year = e.target.value;
    renderApp();
  });

  document.querySelector('[data-action="trip-filter-owner"]')?.addEventListener('change', (e) => {
    appState.tripFilters.owner = e.target.value;
    renderApp();
  });

  document.querySelector('[data-action="export-trips-csv"]')?.addEventListener('click', () => {
    const db = getDatabase();
    const customersById = Object.fromEntries(db.customers.map((c) => [c.id, c]));
    const projectsById = Object.fromEntries(db.projects.map((p) => [p.id, p]));
    const fYear  = appState.tripFilters.year  ?? new Date().getFullYear().toString();
    const fOwner = appState.tripFilters.owner ?? '';
    let trips = db.finance.filter(isTripEntry);
    if (fYear)  trips = trips.filter((t) => (t.date || '').slice(0, 4) === fYear);
    if (fOwner) trips = trips.filter((t) => (t.owner || '') === fOwner);
    trips.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const esc = (v) => {
      const s = String(v ?? '');
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Datum','Persoon','Klant','Project','Route','Doel','Kilometers'];
    const rows = trips.map((t) => {
      const p = projectsById[t.project_id];
      const c = p ? customersById[p.customer_id] : null;
      return [t.date || '', t.owner || '', c?.name || '', p?.name || '', t.vendor || '', t.description || '', Number(t.amount || 0)];
    });
    const totalKm = rows.reduce((s, r) => s + Number(r[6] || 0), 0);
    rows.push(['','','','','','Totaal', totalKm]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kilometers${fYear ? '-' + fYear : ''}${fOwner ? '-' + fOwner.replace(/\s+/g, '_') : ''}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.querySelectorAll('[data-action="download-ics"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.taskId;
      const db = getDatabase();
      const task = db.tasks.find((t) => t.id === id);
      if (!task) return;
      const project = db.projects.find((p) => p.id === task.project_id);
      const customer = project ? db.customers.find((c) => c.id === project.customer_id) : null;
      downloadIcs(task, project, customer);
    });
  });

  document.querySelectorAll('[data-action="toggle-series"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const key = e.currentTarget.dataset.key;
      if (appState.chartHidden.has(key)) appState.chartHidden.delete(key);
      else appState.chartHidden.add(key);
      renderApp();
    });
  });

  document.querySelector('[data-action="delete-project"]')?.addEventListener('click', async (e) => {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    if (!confirm(`Project "${name}" verwijderen? Taken horen ook verwijderd, finance-regels worden losgekoppeld.`)) return;
    try {
      await deleteProject(id);
      window.location.hash = '#/projecten';
    } catch (err) {
      alert('Verwijderen mislukt: ' + err.message);
    }
  });

  document.querySelectorAll('[data-action="payment-status"]').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const entry = getDatabase().finance.find((f) => f.id === id);
      if (!entry) return;
      entry.payment_status = e.target.value;
      await upsertFinance(entry);
    });
  });

  document.querySelectorAll('[data-action="finance-project"]').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const entry = getDatabase().finance.find((f) => f.id === id);
      if (!entry) return;
      entry.project_id = e.target.value || null;
      await upsertFinance(entry);
    });
  });

  document.querySelectorAll('[data-action="delete-task"]').forEach((button) => {
    button.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.taskId;
      if (!confirm('Taak verwijderen?')) return;
      await deleteTask(id);
    });
  });

  document.querySelector('[data-action="add-task"]')?.addEventListener('click', (e) => {
    const projectId = e.currentTarget.dataset.projectId;
    const project = getDatabase().projects.find((p) => p.id === projectId);
    appState.editingTask = {
      project_id: projectId,
      title: '',
      description: '',
      owner: project?.owner || 'Harmen',
      priority: 'medium',
      due_date: null,
      meeting_at: null,
      location: '',
      meeting_duration_minutes: 60,
    };
    renderApp();
  });

  document.querySelectorAll('[data-action="add-customer"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.editingCustomer = {
        name: '', type: 'klant', industry: '', status: 'active', notes: '',
      };
      renderApp();
    });
  });

  document.querySelector('[data-action="customer-dialog-cancel"]')?.addEventListener('click', () => {
    appState.editingCustomer = null;
    document.getElementById('customer-dialog')?.close();
    renderApp();
  });

  document.getElementById('customer-dialog')?.addEventListener('click', (e) => {
    if (e.target.id === 'customer-dialog') {
      appState.editingCustomer = null;
      e.target.close();
      renderApp();
    }
  });

  document.getElementById('customer-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const payload = {
      id: data.id || nextId('cus'),
      name: data.name.trim(),
      type: data.type,
      industry: (data.industry || '').trim(),
      status: data.status,
      notes: (data.notes || '').trim(),
    };
    if (!payload.name) return;
    try {
      await upsertCustomer(payload);
      appState.editingCustomer = null;
      document.getElementById('customer-dialog')?.close();
      // Als we op de project-form waren: pre-select de nieuwe klant
      const projSelect = document.querySelector('select[name="customer_id"]');
      if (projSelect) {
        // loadAll re-rendert; de select kan op de oude pagina zijn vernieuwd, maar de optie bestaat nu
        setTimeout(() => {
          const fresh = document.querySelector('select[name="customer_id"]');
          if (fresh) fresh.value = payload.id;
        }, 50);
      }
    } catch (err) {
      alert('Opslaan mislukt: ' + err.message);
    }
  });

  document.querySelector('[data-action="dialog-cancel"]')?.addEventListener('click', () => {
    appState.editingTask = null;
    document.getElementById('task-dialog')?.close();
    renderApp();
  });

  document.querySelector('[data-action="toggle-meeting"]')?.addEventListener('change', (e) => {
    const fields = document.querySelector('.meeting-fields');
    if (!fields) return;
    fields.style.display = e.target.checked ? '' : 'none';
  });

  // Backdrop click → sluit
  document.getElementById('task-dialog')?.addEventListener('click', (e) => {
    if (e.target.id === 'task-dialog') {
      appState.editingTask = null;
      e.target.close();
      renderApp();
    }
  });

  document.getElementById('task-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    const isMeeting = data.is_meeting === 'on';
    const payload = {
      id: data.id || nextId('tsk'),
      project_id: data.project_id,
      title: data.title.trim(),
      description: (data.description || '').trim(),
      status: 'open',
      priority: data.priority || 'medium',
      due_date: data.due_date || null,
      owner: data.owner || 'Harmen',
      meeting_at: isMeeting && data.meeting_at ? new Date(data.meeting_at).toISOString() : null,
      location: isMeeting ? (data.location || '') : '',
      meeting_duration_minutes: isMeeting ? Number(data.meeting_duration_minutes || 60) : 60,
    };
    if (!payload.title) return;
    try {
      await upsertTask(payload);
      appState.editingTask = null;
      document.getElementById('task-dialog')?.close();
    } catch (err) {
      alert('Opslaan mislukt: ' + err.message);
    }
  });

  document.getElementById('project-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    if (!data.id) data.id = nextId('prj');
    data.forecast_amount = Number(data.forecast_amount || 0);
    data.actual_amount = Number(data.actual_amount || 0);
    data.value_amount = data.actual_amount || data.forecast_amount;
    data.is_breakthrough = data.is_breakthrough === 'true';
    if (!data.lead_source) data.lead_source = 'netwerk';
    data.estimated_hours = Number(data.estimated_hours || 0);
    ['start_date','accepted_date','next_action_date','end_date'].forEach((k) => { if (!data[k]) data[k] = null; });
    try {
      await upsertProject(data);
      window.location.hash = `#/projecten/${data.id}`;
    } catch (err) {
      alert('Opslaan mislukt: ' + err.message);
    }
  });
}

export function renderApp() {
  const db = getDatabase();
  const route = parseRoute();
  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-block">
          <span class="eyebrow">Internal operating system</span>
          <h1>Morgen Dashboard</h1>
          <p>Pipeline, taken en cashflow op één plek.</p>
        </div>
        ${renderNavigation(route)}
        ${db.error ? `<p class="muted" style="margin-top:24px;color:var(--tone-danger);">⚠ ${escapeHtml(db.error)}</p>` : ''}
      </aside>
      <main class="main-content">
        ${db.loading ? '<section class="panel"><p class="empty-state">Data laden uit Supabase…</p></section>' : renderPage(db, route)}
      </main>
    </div>
    ${renderTaskDialog(db)}
    ${renderCustomerDialog(db)}
    ${renderTripDialog(db)}`;
  attachEvents();
  if (appState.editingTask) {
    const dlg = document.getElementById('task-dialog');
    if (dlg && !dlg.open) dlg.showModal();
  }
  if (appState.editingCustomer) {
    const dlg = document.getElementById('customer-dialog');
    if (dlg && !dlg.open) dlg.showModal();
  }
  if (appState.editingTrip) {
    const dlg = document.getElementById('trip-dialog');
    if (dlg && !dlg.open) dlg.showModal();
  }
}

function renderCustomerDialog(db) {
  const c = appState.editingCustomer;
  if (!c) return '';
  return `
    <dialog id="customer-dialog" class="task-dialog">
      <form id="customer-form" class="stack-form">
        <header class="task-dialog__head">
          <div>
            <span class="eyebrow" style="color:var(--accent);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;font-weight:600;">${c.id ? 'Klant bewerken' : 'Nieuwe klant'}</span>
          </div>
          <button type="button" class="task-dialog__close" data-action="customer-dialog-cancel" aria-label="Sluiten">×</button>
        </header>
        <input type="hidden" name="id" value="${escapeHtml(c.id || '')}" />
        <label><span>Naam</span><input type="text" name="name" value="${escapeHtml(c.name || '')}" required /></label>
        <div class="filter-grid">
          <label><span>Type</span>
            <select name="type">
              <option value="klant"        ${c.type === 'klant' || !c.type ? 'selected' : ''}>Klant</option>
              <option value="samenwerking" ${c.type === 'samenwerking' ? 'selected' : ''}>Samenwerking</option>
              <option value="prospect"     ${c.type === 'prospect' ? 'selected' : ''}>Prospect</option>
            </select>
          </label>
          <label><span>Industry</span><input type="text" name="industry" value="${escapeHtml(c.industry || '')}" placeholder="bijv. Overheid, AgriFood, IT" /></label>
          <label><span>Status</span>
            <select name="status">
              <option value="active"   ${c.status === 'active' || !c.status ? 'selected' : ''}>Actief</option>
              <option value="inactive" ${c.status === 'inactive' ? 'selected' : ''}>Inactief</option>
            </select>
          </label>
        </div>
        <label><span>Notities</span><textarea name="notes" rows="3" placeholder="Hoe ben je binnengekomen, contact, achtergrond…">${escapeHtml(c.notes || '')}</textarea></label>
        <div class="task-dialog__actions">
          <button type="button" class="button ghost" data-action="customer-dialog-cancel">Annuleren</button>
          <button type="submit" class="button primary">${c.id ? 'Opslaan' : '+ Klant toevoegen'}</button>
        </div>
      </form>
    </dialog>`;
}

function renderTaskDialog(db) {
  const t = appState.editingTask;
  if (!t) return '';
  const project = db.projects.find((p) => p.id === t.project_id);
  const customer = project ? db.customers.find((c) => c.id === project.customer_id) : null;
  const isMeeting = !!t.meeting_at;
  const localDt = t.meeting_at ? new Date(t.meeting_at).toISOString().slice(0, 16) : '';
  const ownerSelected = t.owner || project?.owner || 'Harmen';
  const inOwnerOptions = OWNER_OPTIONS.includes(ownerSelected);
  return `
    <dialog id="task-dialog" class="task-dialog">
      <form id="task-form" class="stack-form">
        <header class="task-dialog__head">
          <div>
            <span class="eyebrow" style="color:var(--accent);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;font-weight:600;">${t.id ? 'Taak bewerken' : 'Nieuwe taak'}</span>
            ${customer ? `<p class="muted" style="margin:6px 0 0;">${escapeHtml(customer.name)} · ${escapeHtml(project?.name || '')}</p>` : ''}
          </div>
          <button type="button" class="task-dialog__close" data-action="dialog-cancel" aria-label="Sluiten">×</button>
        </header>
        <input type="hidden" name="id" value="${escapeHtml(t.id || '')}" />
        <input type="hidden" name="project_id" value="${escapeHtml(t.project_id || '')}" />
        <label><span>Titel</span><input type="text" name="title" value="${escapeHtml(t.title || '')}" required /></label>
        <label><span>Beschrijving</span><textarea name="description" rows="3">${escapeHtml(t.description || '')}</textarea></label>
        <div class="filter-grid">
          <label><span>Voor wie</span>
            <select name="owner">
              ${OWNER_OPTIONS.map((o) => `<option value="${escapeHtml(o)}" ${o === ownerSelected ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
              ${!inOwnerOptions && ownerSelected ? `<option value="${escapeHtml(ownerSelected)}" selected>${escapeHtml(ownerSelected)}</option>` : ''}
            </select>
          </label>
          <label><span>Deadline</span><input type="date" name="due_date" value="${t.due_date || ''}" /></label>
          <label><span>Prio</span>
            <select name="priority">
              <option value="low"    ${t.priority === 'low' ? 'selected' : ''}>Laag</option>
              <option value="medium" ${(t.priority === 'medium' || !t.priority) ? 'selected' : ''}>Medium</option>
              <option value="high"   ${t.priority === 'high' ? 'selected' : ''}>Hoog</option>
            </select>
          </label>
        </div>
        <label class="task-dialog__check">
          <input type="checkbox" name="is_meeting" data-action="toggle-meeting" ${isMeeting ? 'checked' : ''} />
          <span>Dit is een afspraak / meeting</span>
        </label>
        <div class="meeting-fields" style="${isMeeting ? '' : 'display:none;'}">
          <div class="filter-grid">
            <label><span>Datum + tijd</span><input type="datetime-local" name="meeting_at" value="${localDt}" /></label>
            <label><span>Duur (min)</span><input type="number" name="meeting_duration_minutes" value="${t.meeting_duration_minutes || 60}" min="15" step="15" /></label>
            <label><span>Locatie</span><input type="text" name="location" value="${escapeHtml(t.location || '')}" placeholder="Den Bosch, online, …" /></label>
          </div>
        </div>
        <div class="task-dialog__actions">
          <button type="button" class="button ghost" data-action="dialog-cancel">Annuleren</button>
          <button type="submit" class="button primary">${t.id ? 'Opslaan' : '+ Taak toevoegen'}</button>
        </div>
      </form>
    </dialog>`;
}

function renderTripDialog(db) {
  const t = appState.editingTrip;
  if (!t) return '';
  const project = db.projects.find((p) => p.id === t.project_id);
  const customer = project ? db.customers.find((c) => c.id === project.customer_id) : null;
  const ownerSelected = t.owner || 'Harmen';
  const inOwnerOptions = OWNER_OPTIONS.includes(ownerSelected);
  const projectsOrdered = db.projects.slice()
    .sort((a, b) => {
      const ca = db.customers.find((c) => c.id === a.customer_id)?.name || '';
      const cb = db.customers.find((c) => c.id === b.customer_id)?.name || '';
      return ca.localeCompare(cb);
    });
  return `
    <dialog id="trip-dialog" class="task-dialog">
      <form id="trip-form" class="stack-form">
        <header class="task-dialog__head">
          <div>
            <span class="eyebrow" style="color:var(--accent);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;font-weight:600;">${t.id ? 'Rit bewerken' : 'Nieuwe rit'}</span>
            ${customer ? `<p class="muted" style="margin:6px 0 0;">${escapeHtml(customer.name)} · ${escapeHtml(project?.name || '')}</p>` : ''}
          </div>
          <button type="button" class="task-dialog__close" data-action="trip-dialog-cancel" aria-label="Sluiten">×</button>
        </header>
        <input type="hidden" name="id" value="${escapeHtml(t.id || '')}" />
        <div class="filter-grid">
          <label><span>Datum</span><input type="date" name="date" value="${escapeHtml(t.date || new Date().toISOString().slice(0, 10))}" required /></label>
          <label><span>Persoon</span>
            <select name="owner">
              ${OWNER_OPTIONS.map((o) => `<option value="${escapeHtml(o)}" ${o === ownerSelected ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
              ${!inOwnerOptions && ownerSelected ? `<option value="${escapeHtml(ownerSelected)}" selected>${escapeHtml(ownerSelected)}</option>` : ''}
            </select>
          </label>
          <label><span>Kilometers</span><input type="number" name="kilometers" value="${escapeHtml(String(t.kilometers ?? ''))}" min="0" step="0.1" required /></label>
        </div>
        <label><span>Project</span>
          <select name="project_id">
            <option value="">— niet gekoppeld —</option>
            ${projectsOrdered.map((p) => {
              const c = db.customers.find((cu) => cu.id === p.customer_id);
              return `<option value="${escapeHtml(p.id)}" ${p.id === t.project_id ? 'selected' : ''}>${escapeHtml(c?.name || '')} · ${escapeHtml(p.name)}</option>`;
            }).join('')}
          </select>
        </label>
        <label><span>Route (van → naar)</span><input type="text" name="route" value="${escapeHtml(t.route || '')}" placeholder="Hilversum → Oosterhout" /></label>
        <label><span>Doel</span><input type="text" name="purpose" value="${escapeHtml(t.purpose || '')}" placeholder="Bezoek opdrachtgever, kick-off, …" /></label>
        <div class="task-dialog__actions">
          <button type="button" class="button ghost" data-action="trip-dialog-cancel">Annuleren</button>
          <button type="submit" class="button primary">${t.id ? 'Opslaan' : '+ Rit toevoegen'}</button>
        </div>
      </form>
    </dialog>`;
}

