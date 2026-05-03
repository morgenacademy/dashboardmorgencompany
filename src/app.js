import {
  getDatabase, subscribe, loadAll,
  upsertProject, deleteProject,
  upsertTask, deleteTask,
  upsertCustomer, upsertFinance, nextId,
} from './data/store.js';
import { lineChart, barChart, dualLineChart } from './ui/charts.js';
import { logout } from './ui/login.js';

const PIPELINE_STAGES = [
  { value: 'verkennen',         label: 'Verkennen' },
  { value: '1e_gesprek',        label: '1e gesprek' },
  { value: 'offerte_verzonden', label: 'Offerte verzonden' },
  { value: 'onderhandeling',    label: 'Onderhandeling' },
  { value: 'geaccepteerd',      label: 'Geaccepteerd' },
  { value: 'uitvoering',        label: 'Uitvoering' },
  { value: 'afgerond',          label: 'Afgerond' },
  { value: 'on_hold',           label: 'On hold' },
  { value: 'verloren',          label: 'Verloren' },
];
const ACTIVE_STAGES = ['verkennen','1e_gesprek','offerte_verzonden','onderhandeling','geaccepteerd','uitvoering'];

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

const PRODUCT_TYPES = [
  { value: 'training', label: 'Training' },
  { value: 'programma', label: 'Programma' },
  { value: 'automatisering', label: 'Automatisering' },
  { value: 'strategie', label: 'Strategie' },
  { value: 'samenwerking', label: 'Samenwerking' },
  { value: 'abonnement', label: 'Abonnement' },
  { value: 'other', label: 'Overig' },
];

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

const appState = { route: '/', filters: {} };

subscribe(() => renderApp());

window.addEventListener('hashchange', () => renderApp());

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const [path] = hash.split('?');
  const parts = path.split('/').filter(Boolean);
  return { path, parts };
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
  const activeProjects = db.projects.filter((p) => ACTIVE_STAGES.includes(p.pipeline_status));

  // === KPI 1: Bookings YTD ===
  // Wat dit jaar zeker is/komt: ontvangen + gefactureerde income binnen het jaar.
  const incomeThisYear = db.finance.filter((f) => f.type === 'income' && f.date >= yearStart && f.date <= yearEnd);
  const bookings = incomeThisYear
    .filter((f) => ['ontvangen','gefactureerd'].includes(f.payment_status))
    .reduce((s, f) => s + Number(f.amount), 0);
  const ontvangen = incomeThisYear
    .filter((f) => f.payment_status === 'ontvangen')
    .reduce((s, f) => s + Number(f.amount), 0);

  // === KPI 2: Forecast pipeline ===
  // Wat we kunnen winnen — projecten die nog niet definitief zijn.
  const forecastPipeline = db.projects
    .filter((p) => ['verkennen','1e_gesprek','offerte_verzonden','onderhandeling'].includes(p.pipeline_status))
    .reduce((sum, p) => sum + Number(p.forecast_amount || 0), 0);

  // === KPI 3: Run-rate netto ===
  // Som van recurring monthly income - expenses (per maand cashflow)
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

  const openTasks = db.tasks.filter((t) => t.status !== 'done');
  const overdueTasks = openTasks.filter((t) => relDays(t.due_date) !== null && relDays(t.due_date) < 0);

  const expenseYtd = db.finance.filter((f) => f.type === 'expense' && f.date >= yearStart && f.date <= yearEnd).reduce((s, f) => s + Number(f.amount), 0);

  // === Forecast trend chart: cumulatieve revenue per maand ===
  // Werkelijk: ontvangen income tot vandaag, cumulatief
  // Forecast: vanaf vandaag forecast_amount uit pipeline + recurring income, geprojecteerd
  const months = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(Number(yearStart.slice(0,4)), m, 1);
    months.push({
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('nl-NL', { month: 'short' }),
    });
  }
  const todayMonth = today.slice(0, 7);
  const splitIndex = Math.max(0, months.findIndex((m) => m.key === todayMonth));
  let cumActual = 0;
  let cumForecast = 0;
  const series = months.map((m, i) => {
    // Actual: ontvangen+gefactureerd income gevallen in deze maand (alleen tot huidige maand)
    if (i <= splitIndex) {
      const monthIncome = incomeThisYear
        .filter((f) => f.date.slice(0, 7) === m.key && ['ontvangen','gefactureerd'].includes(f.payment_status))
        .reduce((s, f) => s + Number(f.amount), 0);
      cumActual += monthIncome;
    }
    // Forecast: vanaf huidige maand: actual + verwacht-income deze maand + maandelijkse run-rate vooruit
    if (i < splitIndex) {
      cumForecast = cumActual; // forecast lijn loopt nog mee met actual
    } else if (i === splitIndex) {
      cumForecast = cumActual;
    } else {
      // toekomstige maanden: alle income met date in die maand (verwacht/gefactureerd) + run-rate
      const futureIncome = incomeThisYear
        .filter((f) => f.date.slice(0, 7) === m.key)
        .reduce((s, f) => s + Number(f.amount), 0);
      // verspreide forecast over resterende maanden: forecast pipeline / aantal toekomst-maanden
      const remainingMonths = 12 - splitIndex;
      const pipelineSpread = forecastPipeline / remainingMonths;
      cumForecast += futureIncome + pipelineSpread + recurringIncomeMonthly;
    }
    return { label: m.label, actual: cumActual, forecast: cumForecast };
  });

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

      <div class="metric-grid">
        ${metricCard('Bookings YTD', fmtCurrency(bookings), `${fmtCurrency(ontvangen)} ontvangen`, 'success')}
        ${metricCard('Forecast pipeline', fmtCurrency(forecastPipeline), 'verkennen → onderhandeling', 'warning')}
        ${metricCard('Run-rate netto / maand', fmtCurrency(runRateNetto), `${fmtCurrency(recurringIncomeMonthly)} in · ${fmtCurrency(recurringExpenseMonthly)} uit`, runRateNetto >= 0 ? 'success' : 'danger')}
      </div>

      <section class="panel forecast-panel">
        <div class="forecast-panel__head">
          <div>
            <span class="metric-label">Forecast 2026 — cumulatief</span>
            <strong style="font-family:'Barlow';font-weight:900;color:var(--white);font-size:1.4rem;">${fmtCurrency(series[series.length - 1]?.forecast || 0)}</strong>
            <span class="muted" style="font-size:.78rem;">eindjaar bij doorzetten pipeline</span>
          </div>
          <div style="display:flex;gap:14px;font-size:.72rem;color:var(--text-secondary);">
            <span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block;"></span>Werkelijk</span>
            <span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:#9B6FCF;display:inline-block;"></span>Forecast</span>
            <span class="muted">${activeProjects.length} actief · ${openTasks.length} open${overdueTasks.length ? ` · <span style="color:#FF8FB6;">${overdueTasks.length} te laat</span>` : ''} · expense YTD ${fmtCurrency(expenseYtd)}</span>
          </div>
        </div>
        ${dualLineChart({ series, actualKey: 'actual', forecastKey: 'forecast', splitIndex, ariaLabel: 'Cumulatieve revenue 2026' })}
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
          <div class="panel-heading"><div><h2>Pipeline</h2><p>Actieve projecten per stage.</p></div></div>
          <div class="signal-stack">
            ${byStage.map((group) => `
              <div class="signal-card">
                <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
                  <strong>${escapeHtml(group.label)}</strong>
                  <span class="muted">${group.items.length} · ${fmtCurrency(group.items.reduce((s, p) => s + Number(p.actual_amount || p.forecast_amount || p.value_amount || 0), 0))}</span>
                </div>
                <div>${group.items.map((p) => {
                  const c = customersById[p.customer_id];
                  return `<a href="#/projecten/${escapeHtml(p.id)}" class="muted" style="display:block;color:var(--text-primary);">${escapeHtml(c?.name || '')} · ${escapeHtml(p.name)}</a>`;
                }).join('') || '<span class="muted">—</span>'}</div>
              </div>`).join('')}
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
      </span>
      <span class="project-row__action">
        ${p.next_action ? `${escapeHtml(p.next_action)}${p.next_action_date ? `<span class="muted"> · ${dueLabel(p.next_action_date)}</span>` : ''}` : '<span class="muted">—</span>'}
      </span>
      <span class="project-row__meta">
        <span><strong>${openTasks.length}</strong> open</span>
        ${overdue.length ? `<span style="color:#FF8FB6;">${overdue.length} te laat</span>` : ''}
        ${nextDueTask ? `<span class="muted">${dueLabel(nextDueTask.due_date)}</span>` : ''}
      </span>
    </a>`;
}

function renderProjectenList(db) {
  const customersById = Object.fromEntries(db.customers.map((c) => [c.id, c]));
  const filterStatus = appState.filters.pipeline_status || '';
  const filterType = appState.filters.product_type || '';
  const groupBy = appState.filters.group_by || 'status';
  let projects = db.projects;
  if (filterStatus) projects = projects.filter((p) => p.pipeline_status === filterStatus);
  if (filterType) projects = projects.filter((p) => p.product_type === filterType);

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

  return `
    <section class="page-section">
      <div class="section-header">
        <div>
          <h1>Projecten</h1>
          <p>${projects.length} projecten · werkelijk ${fmtCurrency(totalActual)} · forecast ${fmtCurrency(totalForecast)}</p>
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
            <select name="customer_id" required>
              ${db.customers.map((c) => `<option value="${c.id}" ${project?.customer_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)} (${c.type})</option>`).join('')}
            </select>
          </label>
          <label><span>Naam</span><input type="text" name="name" value="${escapeHtml(project?.name || '')}" required /></label>
          <label><span>Beschrijving</span><textarea name="description">${escapeHtml(project?.description || '')}</textarea></label>
          <div class="filter-grid">
            <label><span>Pipeline status</span><select name="pipeline_status">${selectOptions(PIPELINE_STAGES, project?.pipeline_status || 'verkennen')}</select></label>
            <label><span>Type</span><select name="product_type">${selectOptions(PRODUCT_TYPES, project?.product_type || 'other')}</select></label>
            <label><span>Forecast (EUR)</span><input type="number" step="0.01" name="forecast_amount" value="${project?.forecast_amount || 0}" /></label>
            <label><span>Werkelijk (EUR)</span><input type="number" step="0.01" name="actual_amount" value="${project?.actual_amount || 0}" /></label>
            <label><span>Pricing model</span>
              <select name="pricing_model">
                <option value="project" ${project?.pricing_model === 'project' ? 'selected' : ''}>Project (vast)</option>
                <option value="hourly" ${project?.pricing_model === 'hourly' ? 'selected' : ''}>Uurtarief</option>
                <option value="recurring_monthly" ${project?.pricing_model === 'recurring_monthly' ? 'selected' : ''}>Maandelijks</option>
              </select>
            </label>
            <label><span>Prio</span><select name="priority">${selectOptions(PRIORITIES, project?.priority || 'medium')}</select></label>
            <label><span>Owner</span><input type="text" name="owner" value="${escapeHtml(project?.owner || 'Harmen')}" /></label>
            <label><span>Start</span><input type="date" name="start_date" value="${project?.start_date || ''}" /></label>
            <label><span>Geaccepteerd op</span><input type="date" name="accepted_date" value="${project?.accepted_date || ''}" /></label>
            <label><span>Volgende actie datum</span><input type="date" name="next_action_date" value="${project?.next_action_date || ''}" /></label>
          </div>
          <label><span>Volgende actie</span><input type="text" name="next_action" value="${escapeHtml(project?.next_action || '')}" /></label>
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

  const taskRow = (t) => [
    `<input type="checkbox" data-action="toggle-task" data-task-id="${escapeHtml(t.id)}" ${t.status === 'done' ? 'checked' : ''} />`,
    `<strong style="${t.status === 'done' ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${escapeHtml(t.title)}</strong>${t.description ? `<div class="muted">${escapeHtml(t.description)}</div>` : ''}`,
    badge(TASK_STATUSES.find((s) => s.value === t.status)?.label || t.status, t.status === 'done' ? 'success' : t.status === 'blocked' ? 'danger' : t.status === 'in_progress' ? 'warning' : 'info'),
    t.due_date ? badge(dueLabel(t.due_date), dueTone(t.due_date)) : '<span class="muted">—</span>',
    badge(PRIORITIES.find((p) => p.value === t.priority)?.label || t.priority, t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'info'),
    escapeHtml(t.owner || ''),
    `<button type="button" class="button ghost" data-action="delete-task" data-task-id="${escapeHtml(t.id)}">×</button>`,
  ];

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
        ${metricCard('Open taken', openTasks.length, `${doneTasks.length} klaar`)}
        ${metricCard('Income geboekt', fmtCurrency(incomeTotal), `${finance.length} regel(s)`)}
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
          finance.map((f) => [
            fmtDate(f.date),
            escapeHtml(f.description),
            (f.type === 'expense' ? '-' : '+') + fmtCurrency(f.amount),
            escapeHtml(f.category || ''),
            escapeHtml(f.factuur_status || ''),
          ]),
          { compact: true },
        )}
      </section>
    </section>`;
}

function renderTaken(db) {
  const customersById = Object.fromEntries(db.customers.map((c) => [c.id, c]));
  const projectsById = Object.fromEntries(db.projects.map((p) => [p.id, p]));
  const open = db.tasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => relDays(t.due_date) !== null && relDays(t.due_date) < 0).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
  const today = open.filter((t) => relDays(t.due_date) === 0);
  const week = open.filter((t) => { const d = relDays(t.due_date); return d !== null && d > 0 && d <= 7; }).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
  const later = open.filter((t) => { const d = relDays(t.due_date); return d === null || d > 7; });

  const renderGroup = (title, items, tone) => `
    <section class="panel">
      <div class="panel-heading"><div><h2>${title}</h2><p>${items.length} ta${items.length === 1 ? 'ak' : 'ken'}</p></div></div>
      ${table(
        ['','Taak','Project','Deadline','Prio'],
        items.map((t) => {
          const proj = projectsById[t.project_id];
          const cust = proj ? customersById[proj.customer_id] : null;
          return [
            `<input type="checkbox" data-action="toggle-task" data-task-id="${escapeHtml(t.id)}" />`,
            `<strong>${escapeHtml(t.title)}</strong>`,
            `<a href="#/projecten/${escapeHtml(t.project_id)}"><span class="muted">${escapeHtml(cust?.name || '')}</span> · ${escapeHtml(proj?.name || '')}</a>`,
            t.due_date ? badge(dueLabel(t.due_date), tone) : '<span class="muted">—</span>',
            badge(PRIORITIES.find((p) => p.value === t.priority)?.label || t.priority, t.priority === 'high' ? 'danger' : t.priority === 'medium' ? 'warning' : 'info'),
          ];
        }),
        { compact: true },
      )}
    </section>`;

  return `
    <section class="page-section">
      <div class="section-header"><div><h1>Taken</h1><p>Alles wat openstaat, gegroepeerd op urgentie.</p></div></div>
      ${overdue.length ? renderGroup(`Te laat (${overdue.length})`, overdue, 'danger') : ''}
      ${today.length ? renderGroup('Vandaag', today, 'warning') : ''}
      ${week.length ? renderGroup('Deze week', week, 'warning') : ''}
      ${later.length ? renderGroup('Later / zonder deadline', later, 'info') : ''}
      ${!open.length ? `<section class="panel"><p class="empty-state">Geen open taken.</p></section>` : ''}
    </section>`;
}

function renderFinance(db) {
  const incomes = db.finance.filter((f) => f.type === 'income');
  const expenses = db.finance.filter((f) => f.type === 'expense');
  const incomeTotal = incomes.reduce((s, f) => s + Number(f.amount), 0);
  const expenseTotal = expenses.reduce((s, f) => s + Number(f.amount), 0);
  const ontvangen = incomes.filter((f) => f.payment_status === 'ontvangen').reduce((s, f) => s + Number(f.amount), 0);
  const gefactureerd = incomes.filter((f) => f.payment_status === 'gefactureerd').reduce((s, f) => s + Number(f.amount), 0);
  const verwacht = incomes.filter((f) => f.payment_status === 'verwacht').reduce((s, f) => s + Number(f.amount), 0);

  // Per maand Q1 2026 expenses
  const byMonth = {};
  for (const f of db.finance) {
    if (!f.date || f.date < '2026-01-01' || f.date > '2026-12-31') continue;
    const m = f.date.slice(0, 7);
    byMonth[m] ||= { month: m, income: 0, expense: 0 };
    byMonth[m][f.type] += Number(f.amount);
  }
  const monthSeries = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ label: m.month.slice(5), income: m.income, expense: m.expense }));

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

  return `
    <section class="page-section">
      <div class="section-header"><div><h1>Finance</h1><p>Income + expenses, gekoppeld aan projecten waar mogelijk.</p></div></div>

      <div class="metric-grid">
        ${metricCard('Ontvangen', fmtCurrency(ontvangen), 'income met status ontvangen', 'success')}
        ${metricCard('Gefactureerd', fmtCurrency(gefactureerd), 'wacht op betaling', 'warning')}
        ${metricCard('Verwacht', fmtCurrency(verwacht), 'forecast / nog te factureren', 'default')}
        ${metricCard('Expenses totaal', fmtCurrency(expenseTotal), `${expenses.length} regel(s)`, 'warning')}
        ${metricCard('Netto (ontvangen - expense)', fmtCurrency(ontvangen - expenseTotal), '', ontvangen > expenseTotal ? 'success' : 'danger')}
      </div>

      <div class="layout-two">
        <section class="panel">
          <div class="panel-heading"><div><h2>2026 per maand</h2></div></div>
          ${barChart(monthSeries, 'expense', '#9B6FCF', fmtCurrency)}
          <p class="muted">Expense per maand (paars). Income volgt zodra abbo's en facturen geboekt zijn.</p>
        </section>
        <section class="panel">
          <div class="panel-heading"><div><h2>Expenses per categorie</h2></div></div>
          ${table(
            ['Categorie','Bedrag'],
            catSeries.map((c) => [escapeHtml(c.label), fmtCurrency(c.value)]),
            { compact: true },
          )}
        </section>
      </div>

      <section class="panel">
        <div class="panel-heading"><div><h2>Alle regels</h2><p>${db.finance.length} totaal</p></div></div>
        ${table(
          ['Datum','Type','Beschrijving','Vendor','Bedrag','Categorie','Project','Betaalstatus'],
          db.finance.map((f) => {
            const proj = f.project_id ? projectsById[f.project_id] : null;
            const cust = proj ? customersById[proj.customer_id] : null;
            return [
              fmtDate(f.date),
              badge(f.type === 'income' ? 'in' : 'uit', f.type === 'income' ? 'success' : 'warning'),
              escapeHtml(f.description),
              escapeHtml(f.vendor || ''),
              (f.type === 'expense' ? '-' : '+') + fmtCurrency(f.amount),
              escapeHtml(f.category || ''),
              proj ? `<a href="#/projecten/${escapeHtml(proj.id)}"><span class="muted">${escapeHtml(cust?.name || '')}</span> · ${escapeHtml(proj.name)}</a>` : '<span class="muted">—</span>',
              f.type === 'income'
                ? `<select data-action="payment-status" data-id="${escapeHtml(f.id)}">
                     ${['verwacht','gefactureerd','ontvangen','afgeschreven'].map((v) => `<option value="${v}" ${f.payment_status === v ? 'selected' : ''}>${v}</option>`).join('')}
                   </select>`
                : escapeHtml(f.factuur_status || ''),
            ];
          }),
          { compact: true },
        )}
      </section>
    </section>`;
}

function renderKlanten(db) {
  return `
    <section class="page-section">
      <div class="section-header"><div><h1>Klanten & samenwerkingen</h1></div></div>
      <section class="panel">
        ${table(
          ['Naam','Type','Industry','Status','Projecten','Werkelijk','Forecast'],
          db.customers
            .map((c) => ({
              c,
              projects: db.projects.filter((p) => p.customer_id === c.id),
            }))
            .map(({ c, projects }) => {
              const actual = projects.reduce((s, p) => s + Number(p.actual_amount || 0), 0);
              const forecast = projects.reduce((s, p) => s + Number(p.forecast_amount || 0), 0);
              return { c, projects, actual, forecast };
            })
            .sort((a, b) => (b.actual + b.forecast) - (a.actual + a.forecast))
            .map(({ c, projects, actual, forecast }) => [
              `<a href="#/klanten/${escapeHtml(c.id)}"><strong>${escapeHtml(c.name)}</strong></a>`,
              badge(c.type, c.type === 'klant' ? 'success' : c.type === 'samenwerking' ? 'info' : 'warning'),
              escapeHtml(c.industry || ''),
              badge(c.status, c.status === 'active' ? 'success' : 'default'),
              `${projects.length}`,
              actual ? `<strong>${fmtCurrency(actual)}</strong>` : '<span class="muted">—</span>',
              forecast ? fmtCurrency(forecast) : '<span class="muted">—</span>',
            ]),
        )}
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

  document.querySelector('[data-action="logout"]')?.addEventListener('click', () => logout());

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

  document.querySelectorAll('[data-action="delete-task"]').forEach((button) => {
    button.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.taskId;
      if (!confirm('Taak verwijderen?')) return;
      await deleteTask(id);
    });
  });

  document.querySelector('[data-action="add-task"]')?.addEventListener('click', async (e) => {
    const projectId = e.currentTarget.dataset.projectId;
    const title = prompt('Taak titel?');
    if (!title) return;
    const due = prompt('Deadline (YYYY-MM-DD, leeg = geen)?', '');
    const priority = prompt('Prio (high/medium/low)?', 'medium');
    await upsertTask({
      id: nextId('tsk'),
      project_id: projectId,
      title,
      description: '',
      status: 'open',
      priority: ['high','medium','low'].includes(priority) ? priority : 'medium',
      due_date: due || null,
      owner: 'Harmen',
    });
  });

  document.getElementById('project-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    if (!data.id) data.id = nextId('prj');
    data.forecast_amount = Number(data.forecast_amount || 0);
    data.actual_amount = Number(data.actual_amount || 0);
    data.value_amount = data.actual_amount || data.forecast_amount;
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
        <button type="button" class="button ghost" data-action="logout" style="margin-top:auto;width:100%;">Uitloggen</button>
      </aside>
      <main class="main-content">
        ${db.loading ? '<section class="panel"><p class="empty-state">Data laden uit Supabase…</p></section>' : renderPage(db, route)}
      </main>
    </div>`;
  attachEvents();
}

