import { getDatabase, subscribe, upsertRecord, importRecords, nextId, resetDatabase } from './data/store.js';
import { buildDashboard, formatCurrency, formatNumber, formatPercent } from './domain/metrics.js';
import { entityDefinitions, normalizeRecord, parseCsv, validateRecord } from './domain/validation.js';
import { barChart, lineChart, scatterPlot } from './ui/charts.js';

const defaultFilters = {
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  platform: '',
  category: '',
  productId: '',
  customerId: '',
  customerStatus: '',
};

const appState = {
  db: getDatabase(),
  filters: { ...defaultFilters },
};

subscribe((db) => {
  appState.db = db;
  renderApp();
});

function html(strings, ...values) {
  return strings.reduce((result, string, index) => result + string + (values[index] ?? ''), '');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const [path] = hash.split('?');
  const parts = path.split('/').filter(Boolean);
  return { path, parts };
}

function currentDashboard() {
  return buildDashboard(appState.db, appState.filters);
}

function metricCard(label, value, meta = '', tone = 'default') {
  return `<article class="metric-card metric-${tone}"><span class="metric-label">${label}</span><strong class="metric-value">${value}</strong><span class="metric-meta">${meta}</span></article>`;
}

function badge(signal) {
  return `<span class="badge badge-${signal.tone || 'default'}">${signal.label}</span>`;
}

function renderSignalList(signals) {
  if (!signals?.length) return '<span class="muted">Geen signalen</span>';
  return signals.map(badge).join('');
}

function table(headers, rows, options = {}) {
  return `
    <div class="table-wrap">
      <table class="data-table ${options.compact ? 'compact' : ''}">
        <thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead>
        <tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="empty-cell">Geen records</td></tr>`}</tbody>
      </table>
    </div>`;
}

function selectOptions(items, mapFn, placeholder = 'Alle') {
  return [`<option value="">${placeholder}</option>`, ...items.map(mapFn)].join('');
}

function renderFilters(dashboard) {
  const platforms = [...new Set(dashboard.enriched.products.filter((product) => product.isCommercial).map((product) => product.platform))];
  const categories = [...new Set(dashboard.enriched.products.filter((product) => product.isCommercial).map((product) => product.category))];
  return html`
    <section class="filters panel">
      <div class="panel-heading">
        <div>
          <h2>Sturing & filters</h2>
          <p>Gebruik dezelfde filterlaag voor management, klant- en productviews.</p>
        </div>
      </div>
      <form id="filters-form" class="filter-grid">
        <label><span>Start</span><input type="date" name="startDate" value="${appState.filters.startDate}" /></label>
        <label><span>Einde</span><input type="date" name="endDate" value="${appState.filters.endDate}" /></label>
        <label><span>Platform</span><select name="platform">${selectOptions(platforms, (platform) => `<option value="${platform}" ${appState.filters.platform === platform ? 'selected' : ''}>${platform}</option>`)}</select></label>
        <label><span>Categorie</span><select name="category">${selectOptions(categories, (category) => `<option value="${category}" ${appState.filters.category === category ? 'selected' : ''}>${category}</option>`)}</select></label>
        <label><span>Product</span><select name="productId">${selectOptions(dashboard.enriched.products.filter((product) => product.isCommercial), (product) => `<option value="${product.id}" ${appState.filters.productId === product.id ? 'selected' : ''}>${product.name}</option>`)}</select></label>
        <label><span>Klant</span><select name="customerId">${selectOptions(dashboard.enriched.customers, (customer) => `<option value="${customer.id}" ${appState.filters.customerId === customer.id ? 'selected' : ''}>${customer.name}</option>`)}</select></label>
        <label><span>Klantstatus</span><select name="customerStatus">${selectOptions([{ value: 'active', label: 'Actief' }, { value: 'inactive', label: 'Inactief' }], (item) => `<option value="${item.value}" ${appState.filters.customerStatus === item.value ? 'selected' : ''}>${item.label}</option>`)}</select></label>
        <div class="filter-actions">
          <button type="submit" class="button primary">Pas filters toe</button>
          <button type="button" class="button ghost" data-action="reset-filters">Reset</button>
        </div>
      </form>
    </section>`;
}

function renderOverview(dashboard) {
  const { overview, spotlight, products } = dashboard;
  const signalCards = [
    spotlight.topRevenueProduct && { title: 'Top revenue product', body: `${spotlight.topRevenueProduct.name} · ${formatCurrency(spotlight.topRevenueProduct.metrics.revenue)}` },
    spotlight.bestRatedProduct && { title: 'Best rated product', body: `${spotlight.bestRatedProduct.name} · ${formatNumber(spotlight.bestRatedProduct.metrics.avgRating, 1)} / 5` },
    spotlight.bestRevenuePerHour && { title: 'Best revenue per hour', body: `${spotlight.bestRevenuePerHour.name} · ${formatCurrency(spotlight.bestRevenuePerHour.metrics.revenuePerHour)}/uur` },
    spotlight.atRiskCustomer && { title: 'At-risk customer', body: `${spotlight.atRiskCustomer.name} · NPS ${formatNumber(spotlight.atRiskCustomer.metrics.avgNps, 0)}` },
  ].filter(Boolean);

  return html`
    <section class="page-section">
      <div class="section-header">
        <div>
          <h1>Management overview</h1>
          <p>Een operationele besturingslaag over commercie, effort, kwaliteit en groei heen.</p>
        </div>
      </div>
      <div class="metric-grid">
        ${metricCard('Totale omzet', formatCurrency(overview.totalRevenue), `Groei ${formatPercent(overview.revenueGrowth, 0)}`, overview.revenueGrowth >= 0 ? 'success' : 'danger')}
        ${metricCard('Aantal klanten', formatNumber(overview.totalCustomers), `Klantgroei ${formatPercent(overview.customerGrowth, 0)}`, overview.customerGrowth >= 0 ? 'success' : 'danger')}
        ${metricCard('Aantal afnames', formatNumber(overview.totalDeliveries), `Gem. deal ${formatCurrency(overview.avgDealValue)}`)}
        ${metricCard('Totale uren', formatNumber(overview.totalHours, 1), `Uren / € ${formatNumber(overview.hoursPerRevenueEuro, 3)}`)}
        ${metricCard('Omzet per uur', formatCurrency(overview.revenuePerHour), `Contribution ${formatPercent(overview.contributionMargin, 0)}`)}
        ${metricCard('Kwaliteit', `${formatNumber(overview.avgRating, 1)} / 5`, `NPS ${formatNumber(overview.avgNps, 0)} · ${overview.reviewCount} reviews`, overview.avgRating >= 4.5 ? 'success' : overview.avgRating < 4.1 ? 'danger' : 'warning')}
      </div>
      <div class="layout-two">
        <article class="panel">
          <div class="panel-heading"><h2>Omzettrend</h2><p>Per maand binnen de huidige filtercontext.</p></div>
          ${lineChart(overview.series, 'revenue')}
        </article>
        <article class="panel">
          <div class="panel-heading"><h2>Uren vs omzet</h2><p>Quadrant om schaalbaarheid en frictie te spotten.</p></div>
          ${scatterPlot(products, 'metrics.revenuePerHour', 'metrics.avgRating', { x: 'Omzet per uur', y: 'Reviewscore' })}
        </article>
      </div>
      <div class="layout-two">
        <article class="panel">
          <div class="panel-heading"><h2>Platform breakdown</h2><p>Waar zit de commerciële performance?</p></div>
          ${barChart(buildPlatformSeries(dashboard.products), 'revenue')}
        </article>
        <article class="panel">
          <div class="panel-heading"><h2>Sturingssignalen</h2><p>Praktische business rules voor management.</p></div>
          <div class="signal-stack">${signalCards.map((item) => `<div class="signal-card"><strong>${item.title}</strong><span>${item.body}</span></div>`).join('')}</div>
        </article>
      </div>
      <article class="panel">
        <div class="panel-heading"><h2>Top en bottom proposities</h2><p>Combineert omzet, efficiëntie, kwaliteit en signalen.</p></div>
        ${table(
          ['Product', 'Platform', 'Omzet', 'Uren', '€/uur', 'Review', 'Health', 'Signalen'],
          [...dashboard.products].sort((a, b) => b.metrics.healthScore - a.metrics.healthScore).slice(0, 6).map((product) => [
            `<a href="#/products/${product.id}">${product.name}</a>`,
            product.platform,
            formatCurrency(product.metrics.revenue),
            formatNumber(product.metrics.hours, 1),
            formatCurrency(product.metrics.revenuePerHour),
            formatNumber(product.metrics.avgRating, 1),
            `<span class="health-pill">${product.metrics.healthScore}</span>`,
            renderSignalList(product.metrics.signals),
          ]),
        )}
      </article>
    </section>`;
}

function buildPlatformSeries(products) {
  const map = {};
  products.forEach((product) => {
    map[product.platform] ||= { label: product.platform, revenue: 0, hours: 0 };
    map[product.platform].revenue += product.metrics.revenue;
    map[product.platform].hours += product.metrics.hours;
  });
  return Object.values(map);
}

function renderCustomersPage(dashboard) {
  return html`
    <section class="page-section">
      <div class="section-header"><div><h1>Klantoverzicht</h1><p>Segmentatie, performance-indicatoren en doorklik naar detail.</p></div></div>
      <article class="panel">
        <div class="panel-heading"><h2>Klantportfolio</h2><p>Gebruik health, repeat behaviour en effort-efficiëntie om te prioriteren.</p></div>
        ${table(
          ['Klant', 'Type', 'Omzet', 'LTV', 'Uren', '€/uur', 'Review', 'Repeat', 'Health', 'Signalen'],
          [...dashboard.customers].sort((a, b) => b.metrics.revenue - a.metrics.revenue).map((customer) => [
            `<a href="#/customers/${customer.id}">${customer.name}</a>`,
            `${customer.type} · ${customer.status}`,
            formatCurrency(customer.metrics.revenue),
            formatCurrency(customer.metrics.ltv),
            formatNumber(customer.metrics.hours, 1),
            formatCurrency(customer.metrics.revenuePerHour),
            `${formatNumber(customer.metrics.avgRating, 1)} / 5`,
            formatPercent(customer.metrics.repeatRate, 0),
            `<span class="health-pill">${customer.metrics.healthScore}</span>`,
            renderSignalList(customer.metrics.signals),
          ]),
        )}
      </article>
    </section>`;
}

function renderCustomerDetail(dashboard, customerId) {
  const customer = dashboard.customers.find((item) => item.id === customerId);
  if (!customer) return '<section class="page-section"><article class="panel"><h1>Klant niet gevonden</h1></article></section>';
  const deliveries = dashboard.enriched.deliveries.filter((delivery) => delivery.customerId === customer.id);
  return html`
    <section class="page-section">
      <div class="section-header"><div><h1>${customer.name}</h1><p>${customer.type} · ${customer.industry} · ${customer.status}</p></div><a class="button ghost" href="#/customers">← Terug naar klanten</a></div>
      <div class="metric-grid">
        ${metricCard('Omzet', formatCurrency(customer.metrics.revenue), `${customer.metrics.deliveryCount} afnames`)}
        ${metricCard('Totale uren', formatNumber(customer.metrics.hours, 1), `${formatCurrency(customer.metrics.revenuePerHour)}/uur`)}
        ${metricCard('Kwaliteit', `${formatNumber(customer.metrics.avgRating, 1)} / 5`, `NPS ${formatNumber(customer.metrics.avgNps, 0)}`)}
        ${metricCard('Customer health', formatNumber(customer.metrics.healthScore), `${formatPercent(customer.metrics.repeatRate, 0)} repeat rate`, customer.metrics.healthScore >= 70 ? 'success' : customer.metrics.healthScore < 50 ? 'danger' : 'warning')}
      </div>
      <div class="layout-two">
        <article class="panel"><div class="panel-heading"><h2>Omzet & uren over tijd</h2><p>Performance per maand.</p></div>${lineChart(customer.metrics.series, 'revenue')}</article>
        <article class="panel"><div class="panel-heading"><h2>Laatste signalen</h2><p>Risico- en expansiekansen.</p></div><div class="signal-stack">${customer.metrics.signals.map((signal) => `<div class="signal-card">${badge(signal)}</div>`).join('') || '<div class="empty-state">Geen uitzonderingen</div>'}</div></article>
      </div>
      <article class="panel">
        <div class="panel-heading"><h2>Afgenomen proposities</h2><p>Met kwaliteit per levering.</p></div>
        ${table(
          ['Datum', 'Product', 'Omzet', 'Uren', 'Review', 'NPS', 'Contribution', 'Notities'],
          deliveries.map((delivery) => [
            delivery.date,
            `<a href="#/products/${delivery.productId}">${delivery.product.name}</a>`,
            formatCurrency(delivery.amount),
            formatNumber(delivery.hours, 1),
            formatNumber(delivery.avgRating, 1),
            formatNumber(delivery.avgNps, 0),
            formatCurrency(delivery.contribution),
            escapeHtml(delivery.notes || ''),
          ]),
        )}
      </article>
    </section>`;
}

function renderProductsPage(dashboard) {
  return html`
    <section class="page-section">
      <div class="section-header"><div><h1>Productoverzicht</h1><p>Uniform productmodel over Academy, Technology en Company.</p></div></div>
      <article class="panel">
        <div class="panel-heading"><h2>Productperformance</h2><p>Vergelijk omzet, effort, kwaliteit en schaalbaarheid.</p></div>
        ${table(
          ['Product', 'Platform', 'Categorie', 'Omzet', 'Klanten', 'Afnames', 'Uren', '€/uur', 'Review', 'Health', 'Signalen'],
          [...dashboard.products].sort((a, b) => b.metrics.revenue - a.metrics.revenue).map((product) => [
            `<a href="#/products/${product.id}">${product.name}</a>`,
            product.platform,
            `${product.category} · ${product.subcategory}`,
            formatCurrency(product.metrics.revenue),
            formatNumber(product.metrics.customerCount),
            formatNumber(product.metrics.deliveryCount),
            formatNumber(product.metrics.hours, 1),
            formatCurrency(product.metrics.revenuePerHour),
            `${formatNumber(product.metrics.avgRating, 1)} / 5`,
            `<span class="health-pill">${product.metrics.healthScore}</span>`,
            renderSignalList(product.metrics.signals),
          ]),
        )}
      </article>
    </section>`;
}

function renderProductDetail(dashboard, productId) {
  const product = dashboard.products.find((item) => item.id === productId);
  if (!product) return '<section class="page-section"><article class="panel"><h1>Product niet gevonden</h1></article></section>';
  const deliveries = dashboard.enriched.deliveries.filter((delivery) => delivery.productId === product.id);
  const recommendation = product.metrics.healthScore >= 75
    ? 'Opschalen'
    : product.metrics.avgRating >= 4.6 && product.metrics.revenue < 30000
      ? 'Meer commercieel pushen'
      : product.metrics.hours > 250 && product.metrics.avgRating >= 4.3
        ? 'Productizen / standaardiseren'
        : product.metrics.avgRating < 4.1
          ? 'Verbeteren'
          : 'Monitoren';
  return html`
    <section class="page-section">
      <div class="section-header"><div><h1>${product.name}</h1><p>${product.platform} · ${product.category} · ${product.subcategory}</p></div><a class="button ghost" href="#/products">← Terug naar producten</a></div>
      <div class="metric-grid">
        ${metricCard('Omzet', formatCurrency(product.metrics.revenue), `${product.metrics.customerCount} klanten`)}
        ${metricCard('Gem. dealwaarde', formatCurrency(product.metrics.avgDealValue), `${product.metrics.deliveryCount} afnames`)}
        ${metricCard('Effort', formatNumber(product.metrics.hours, 1), `${formatNumber(product.metrics.avgHoursPerDelivery, 1)} uur / levering`)}
        ${metricCard('Efficiëntie', formatCurrency(product.metrics.revenuePerHour), `Contribution ${formatPercent(product.metrics.contributionMargin, 0)}`)}
        ${metricCard('Kwaliteit', `${formatNumber(product.metrics.avgRating, 1)} / 5`, `NPS ${formatNumber(product.metrics.avgNps, 0)}`)}
        ${metricCard('Product health', formatNumber(product.metrics.healthScore), recommendation, product.metrics.healthScore >= 70 ? 'success' : product.metrics.healthScore < 50 ? 'danger' : 'warning')}
      </div>
      <div class="layout-two">
        <article class="panel"><div class="panel-heading"><h2>Omzettrend</h2><p>Performance over tijd.</p></div>${lineChart(product.metrics.series, 'revenue')}</article>
        <article class="panel"><div class="panel-heading"><h2>Kwaliteit vs omzet</h2><p>Leveringsniveau voor audit en productisering.</p></div>${scatterPlot(deliveries.map((delivery) => ({ ...delivery, name: delivery.customer.name })), 'amount', 'avgRating', { x: 'Omzet', y: 'Reviewscore' })}</article>
      </div>
      <article class="panel">
        <div class="panel-heading"><h2>Leveringen voor dit product</h2><p>Onderliggende data blijft controleerbaar.</p></div>
        ${table(
          ['Datum', 'Klant', 'Omzet', 'Uren', '€/uur', 'Review', 'NPS', 'Contribution'],
          deliveries.map((delivery) => [
            delivery.date,
            `<a href="#/customers/${delivery.customerId}">${delivery.customer.name}</a>`,
            formatCurrency(delivery.amount),
            formatNumber(delivery.hours, 1),
            formatCurrency(delivery.revenuePerHour),
            formatNumber(delivery.avgRating, 1),
            formatNumber(delivery.avgNps, 0),
            formatCurrency(delivery.contribution),
          ]),
        )}
      </article>
    </section>`;
}

function renderAuditPage(dashboard) {
  return html`
    <section class="page-section">
      <div class="section-header"><div><h1>Delivery / auditlaag</h1><p>Delivery-, omzet-, uren- en kwaliteitsdata op transactieniveau.</p></div></div>
      <article class="panel">
        ${table(
          ['Datum', 'Klant', 'Product', 'Platform', 'Omzet', 'Uren', 'Review', 'NPS', '€/uur', 'Contribution', 'Status'],
          [...dashboard.enriched.deliveries].sort((a, b) => b.date.localeCompare(a.date)).map((delivery) => [
            delivery.date,
            `<a href="#/customers/${delivery.customerId}">${delivery.customer.name}</a>`,
            `<a href="#/products/${delivery.productId}">${delivery.product.name}</a>`,
            delivery.product.platform,
            formatCurrency(delivery.amount),
            formatNumber(delivery.hours, 1),
            formatNumber(delivery.avgRating, 1),
            formatNumber(delivery.avgNps, 0),
            formatCurrency(delivery.revenuePerHour),
            formatCurrency(delivery.contribution),
            delivery.status,
          ]),
        )}
      </article>
    </section>`;
}

function renderQualityPage(dashboard) {
  const riskyProducts = dashboard.products.filter((product) => product.metrics.signals.some((signal) => signal.key === 'high-revenue-low-satisfaction' || signal.key === 'low-satisfaction-high-hours'));
  const hiddenGems = dashboard.products.filter((product) => product.metrics.signals.some((signal) => signal.key === 'low-revenue-high-satisfaction'));
  return html`
    <section class="page-section">
      <div class="section-header"><div><h1>Quality & health monitor</h1><p>Combineert commerciële performance met klanttevredenheid en schaalbaarheid.</p></div></div>
      <div class="layout-two">
        <article class="panel"><div class="panel-heading"><h2>Quality quadrants</h2><p>Omzet versus reviewscore op productniveau.</p></div>${scatterPlot(dashboard.products.map((product) => ({ ...product, revenue: product.metrics.revenue, rating: product.metrics.avgRating })), 'revenue', 'rating', { x: 'Omzet', y: 'Reviewscore' })}</article>
        <article class="panel"><div class="panel-heading"><h2>Reviewtrend</h2><p>Gemiddelde reviewscore per maand.</p></div>${lineChart(dashboard.overview.series, 'avgRating', '#8b5cf6')}</article>
      </div>
      <div class="layout-two">
        <article class="panel"><div class="panel-heading"><h2>High revenue / low satisfaction</h2><p>Directe verbeterkandidaten.</p></div>${table(['Product', 'Omzet', 'Review', 'NPS', 'Uren', 'Signalen'], riskyProducts.map((product) => [product.name, formatCurrency(product.metrics.revenue), formatNumber(product.metrics.avgRating, 1), formatNumber(product.metrics.avgNps, 0), formatNumber(product.metrics.hours, 1), renderSignalList(product.metrics.signals)]), { compact: true })}</article>
        <article class="panel"><div class="panel-heading"><h2>Low revenue / high satisfaction</h2><p>Opschaalkandidaten met product-market fit-signalen.</p></div>${table(['Product', 'Omzet', 'Review', 'Repeat', '€/uur', 'Signalen'], hiddenGems.map((product) => [product.name, formatCurrency(product.metrics.revenue), formatNumber(product.metrics.avgRating, 1), formatPercent(product.metrics.repeatRate, 0), formatCurrency(product.metrics.revenuePerHour), renderSignalList(product.metrics.signals)]), { compact: true })}</article>
      </div>
    </section>`;
}

function renderAdminPage(dashboard) {
  const entitySelect = Object.keys(entityDefinitions).map((key) => `<option value="${key}">${key}</option>`).join('');
  return html`
    <section class="page-section">
      <div class="section-header"><div><h1>Admin & ingestion</h1><p>Start simpel met handmatige invoer of CSV-import; schaal later door naar API-koppelingen.</p></div></div>
      <div class="layout-two admin-grid">
        <article class="panel">
          <div class="panel-heading"><h2>Handmatige invoer</h2><p>Voeg records toe voor klanten, producten, leveringen, uren en reviews.</p></div>
          <form id="record-form" class="stack-form">
            <label><span>Entity</span><select name="table">${entitySelect}</select></label>
            <label><span>Velden (JSON)</span><textarea name="payload" rows="12" placeholder='{"name":"Nieuwe klant","type":"Enterprise","status":"active"}'></textarea></label>
            <button class="button primary" type="submit">Record opslaan</button>
            <p class="muted">Verplichte velden voor bruikbare analyses: klant + product + datum + omzet voor deliveries, uren voor effort logs, rating voor reviews.</p>
          </form>
        </article>
        <article class="panel">
          <div class="panel-heading"><h2>CSV-import</h2><p>Gebruik exacte kolomnamen uit de tabeldefinities. Handig voor Excel-exporten.</p></div>
          <form id="import-form" class="stack-form">
            <label><span>Entity</span><select name="table">${entitySelect}</select></label>
            <label><span>Mode</span><select name="mode"><option value="append">Append</option><option value="replace">Replace table</option></select></label>
            <label><span>CSV</span><textarea name="csv" rows="12" placeholder="customerId,productId,date,status,amount\ncus_novarail,prd_speaking,2026-01-10,delivered,9500"></textarea></label>
            <button class="button primary" type="submit">Importeer CSV</button>
          </form>
        </article>
      </div>
      <article class="panel">
        <div class="panel-heading"><h2>Datamodel</h2><p>Normalized around products, customers, deliveries, effort logs and reviews.</p></div>
        ${table(['Tabel', 'Doel', 'Verplichte velden'], Object.entries(entityDefinitions).map(([tableName, definition]) => [tableName, describeTable(tableName), definition.required.join(', ')]), { compact: true })}
        <div class="admin-actions"><button class="button ghost" data-action="reset-database">Reset naar seeddata</button></div>
      </article>
      <article class="panel">
        <div class="panel-heading"><h2>Huidige volumes</h2><p>Controleer of de dataset gevuld is voor je analyses.</p></div>
        ${table(['Tabel', 'Aantal'], Object.keys(entityDefinitions).map((tableName) => [tableName, formatNumber(dashboard.enriched[tableName]?.length ?? dashboard.enriched[tableName]?.size ?? appState.db[tableName]?.length ?? 0)]), { compact: true })}
      </article>
    </section>`;
}

function describeTable(tableName) {
  const descriptions = {
    customers: 'Klantenkaart, account owner, type en status.',
    products: 'Uniform productmodel over alle platformen en proposities.',
    deliveries: 'Commerciële leveringen / transacties met omzet op deliveryniveau.',
    effortLogs: 'Lightweight urenregistratie per levering, klant en product.',
    reviews: 'Kwaliteit per levering zodat analyses zuiver blijven.',
  };
  return descriptions[tableName] || '';
}

function renderNavigation() {
  const route = parseRoute();
  const navItems = [
    ['/', 'Overview'],
    ['/customers', 'Klanten'],
    ['/products', 'Producten'],
    ['/audit', 'Audit'],
    ['/quality', 'Quality'],
    ['/admin', 'Admin'],
  ];
  return `<nav class="side-nav">${navItems.map(([path, label]) => `<a class="${route.path === path || (path !== '/' && route.path.startsWith(path)) ? 'active' : ''}" href="#${path}">${label}</a>`).join('')}</nav>`;
}

function renderPage(dashboard) {
  const route = parseRoute();
  if (route.parts[0] === 'customers' && route.parts[1]) return renderCustomerDetail(dashboard, route.parts[1]);
  if (route.parts[0] === 'products' && route.parts[1]) return renderProductDetail(dashboard, route.parts[1]);
  switch (route.path) {
    case '/customers': return renderCustomersPage(dashboard);
    case '/products': return renderProductsPage(dashboard);
    case '/audit': return renderAuditPage(dashboard);
    case '/quality': return renderQualityPage(dashboard);
    case '/admin': return renderAdminPage(dashboard);
    default: return renderOverview(dashboard);
  }
}

function attachEvents() {
  document.getElementById('filters-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    appState.filters = Object.fromEntries(formData.entries());
    renderApp();
  });

  document.querySelector('[data-action="reset-filters"]')?.addEventListener('click', () => {
    appState.filters = { ...defaultFilters };
    renderApp();
  });

  document.getElementById('record-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const table = String(formData.get('table'));
    try {
      const payload = normalizeRecord(JSON.parse(String(formData.get('payload') || '{}')));
      payload.id ||= nextId(entityDefinitions[table].prefix);
      const validation = validateRecord(table, payload);
      if (!validation.valid) throw new Error(`Ontbrekende velden: ${validation.missing.join(', ')}`);
      upsertRecord(table, payload);
      event.currentTarget.reset();
      alert('Record opgeslagen.');
    } catch (error) {
      alert(`Opslaan mislukt: ${error.message}`);
    }
  });

  document.getElementById('import-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const table = String(formData.get('table'));
    const mode = String(formData.get('mode'));
    try {
      const records = parseCsv(String(formData.get('csv') || ''))
        .map(normalizeRecord)
        .map((record) => ({ id: record.id || nextId(entityDefinitions[table].prefix), ...record }));
      const invalid = records.map((record, index) => ({ index, ...validateRecord(table, record) })).filter((item) => !item.valid);
      if (invalid.length) throw new Error(`Invalid rows: ${invalid.map((item) => `${item.index + 2} (${item.missing.join(', ')})`).join('; ')}`);
      importRecords(table, records, mode);
      alert(`${records.length} records geïmporteerd.`);
    } catch (error) {
      alert(`Import mislukt: ${error.message}`);
    }
  });

  document.querySelector('[data-action="reset-database"]')?.addEventListener('click', () => {
    if (confirm('Weet je zeker dat je alle lokale wijzigingen wilt wissen?')) {
      resetDatabase();
    }
  });
}

export function renderApp() {
  const root = document.getElementById('app');
  const dashboard = currentDashboard();
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-block">
          <span class="eyebrow">Internal operating system</span>
          <h1>AI Company Dashboard</h1>
          <p>Stuur op omzet, effort, kwaliteit, klantwaarde en productperformance.</p>
        </div>
        ${renderNavigation()}
      </aside>
      <main class="main-content">
        ${renderFilters(dashboard)}
        ${renderPage(dashboard)}
      </main>
    </div>`;
  attachEvents();
}
