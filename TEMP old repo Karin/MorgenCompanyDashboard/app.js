const STORAGE_KEY = "morgen-company-dashboard-v3";
const LEGACY_STORAGE_KEYS = [
  "morgen-company-dashboard-v2",
  "morgen-company-dashboard-v1",
];
const DEMO_PROJECT_IDS = ["project-avans", "project-workshop", "project-lab"];
const DEMO_COST_IDS = ["cost-tools", "cost-avans", "cost-workshop", "cost-admin"];
const DASHBOARD_START_MONTH = "2025-07";
const DASHBOARD_MONTHS_TO_SHOW = 18;

const PROJECT_STAGES = ["pipeline", "active", "completed"];
const PROJECT_CATEGORIES = [
  "train",
  "build",
  "implement",
  "inspire",
  "uncategorized",
];

const KARIN_FIXED_COSTS = [
  { label: "Management fee Karin", amount: 500 },
  { label: "Boekhoudpakket", amount: 25 },
  { label: "Telefoon", amount: 55.73 },
  { label: "Internet", amount: 25 },
  { label: "Verzekering", amount: 10 },
  { label: "Storytell", amount: 6.99 },
  { label: "Apple storage", amount: 2.99 },
  { label: "Canva", amount: 12 },
  { label: "Bunny", amount: 8.5 },
  { label: "Resend", amount: 17 },
  { label: "Claude", amount: 22 },
  { label: "Kantoorkosten", amount: 50 },
  { label: "Supabase", amount: 40 },
];

const KARIN_PROJECT_SEEDS = [
  {
    id: "karin-agrifood-capital-april",
    name: "AgriFood Capital B.V.",
    monthlyRevenue: 3152.1,
    stage: "active",
    category: "inspire",
    outsideNetwork: true,
    outsideNetworkLeadYear: 2025,
    startMonth: "2026-04",
    endMonth: "2026-04",
    notes: "Samengevoegd: 2x MKB Boost sessie april en uren strippenkaart.",
  },
  {
    id: "karin-agrifood-capital-mei",
    name: "AgriFood Capital B.V.",
    monthlyRevenue: 1000,
    stage: "active",
    category: "inspire",
    outsideNetwork: true,
    outsideNetworkLeadYear: 2025,
    startMonth: "2026-05",
    endMonth: "2026-05",
    notes: "Toegezegd vervolg in mei.",
  },
  {
    id: "karin-agrifood-capital-juni",
    name: "AgriFood Capital B.V.",
    monthlyRevenue: 1000,
    stage: "active",
    category: "inspire",
    outsideNetwork: true,
    outsideNetworkLeadYear: 2025,
    startMonth: "2026-06",
    endMonth: "2026-06",
    notes: "Toegezegd vervolg in juni.",
  },
  {
    id: "karin-agrifood-capital-september",
    name: "AgriFood Capital B.V.",
    monthlyRevenue: 1000,
    stage: "active",
    category: "inspire",
    outsideNetwork: true,
    outsideNetworkLeadYear: 2025,
    startMonth: "2026-09",
    endMonth: "2026-09",
    notes: "Toegezegd vervolg in september.",
  },
  {
    id: "karin-nieuwe-kijk-op-werk",
    name: "Nieuwe kijk op werk",
    monthlyRevenue: 4.95,
    stage: "active",
    startMonth: "2026-02",
    endMonth: "",
    notes: "WebBasic, periodieke factuur die maandelijks doorloopt.",
  },
  {
    id: "karin-pam-van-bruggen",
    name: "Pam van Bruggen",
    monthlyRevenue: 40.5,
    stage: "completed",
    startMonth: "2026-03",
    endMonth: "2026-03",
    notes: "Basiscursus AI.",
  },
  {
    id: "karin-zjoske-kanters-deel-1",
    name: "Zjoske Kanters",
    monthlyRevenue: 1111,
    stage: "completed",
    outsideNetwork: true,
    outsideNetworkLeadYear: 2025,
    startMonth: "2026-03",
    endMonth: "2026-03",
    notes: "Eerste 50% van het website traject is gefactureerd.",
  },
  {
    id: "karin-zjoske-kanters-deel-2",
    name: "Zjoske Kanters",
    monthlyRevenue: 1111,
    stage: "pipeline",
    outsideNetwork: true,
    outsideNetworkLeadYear: 2025,
    startMonth: "2026-05",
    endMonth: "2026-05",
    notes: "Resterende 50% van het website traject staat nog open.",
  },
  {
    id: "karin-vml",
    name: "VML",
    monthlyRevenue: 1750,
    stage: "active",
    category: "train",
    outsideNetwork: true,
    outsideNetworkLeadYear: 2025,
    startMonth: "2026-05",
    endMonth: "2026-05",
    notes: "Potentiele klant, gepland op 22 mei.",
  },
  {
    id: "karin-gemeente-breda",
    name: "Gemeente Breda",
    monthlyRevenue: 450,
    stage: "completed",
    startMonth: "2026-01",
    endMonth: "2026-01",
    notes: "Netto over na creditfactuur: keynote op 17 januari.",
  },
  {
    id: "karin-mariette-reineke",
    name: "Mariette Reineke",
    monthlyRevenue: 800,
    stage: "completed",
    startMonth: "2025-11",
    endMonth: "2025-11",
    notes: "Netto over na creditfactuur: fase 1 aanpassingen website.",
  },
  {
    id: "karin-trappenfabriek-vermeulen",
    name: "Trappenfabriek Vermeulen B.V.",
    monthlyRevenue: 765,
    stage: "completed",
    startMonth: "2025-10",
    endMonth: "2025-10",
    notes: "Workshop op maat op locatie.",
  },
];

const ui = {
  settingsForm: document.querySelector("#settings-form"),
  focusYear: document.querySelector("#focus-year"),
  goalKpis: document.querySelector("#goal-kpis"),
  overviewKpis: document.querySelector("#overview-kpis"),
  categoryRevenue: document.querySelector("#category-revenue"),
  pipelineSpotlight: document.querySelector("#pipeline-spotlight"),
  teamLiquidity: document.querySelector("#team-liquidity"),
  customerBoard: document.querySelector("#customer-board"),
  monthlyPerformance: document.querySelector("#monthly-performance"),
  addProjectButton: document.querySelector("#add-project-button"),
  addCostButton: document.querySelector("#add-cost-button"),
  projectPanel: document.querySelector("#project-panel"),
  costPanel: document.querySelector("#cost-panel"),
  projectForm: document.querySelector("#project-form"),
  projectList: document.querySelector("#project-list"),
  projectSubmit: document.querySelector("#project-submit"),
  projectCancel: document.querySelector("#project-cancel"),
  costForm: document.querySelector("#cost-form"),
  costList: document.querySelector("#cost-list"),
  costProjectSelect: document.querySelector("#cost-project-select"),
  costSubmit: document.querySelector("#cost-submit"),
  costCancel: document.querySelector("#cost-cancel"),
  resetDemo: document.querySelector("#reset-demo"),
};

let state = loadState();
let editingProjectId = null;
let editingCostId = null;

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

initialize();

function initialize() {
  persistPendingMigration();
  bindEvents();
  syncFormsFromState();
  render();
}

function bindEvents() {
  if (ui.settingsForm) {
    ui.settingsForm.addEventListener("submit", handleSettingsSubmit);
  }
  ui.projectForm.addEventListener("submit", handleProjectSubmit);
  ui.costForm.addEventListener("submit", handleCostSubmit);
  ui.focusYear.addEventListener("change", render);
  ui.categoryRevenue.addEventListener("click", handleCategoryRevenueClick);
  ui.projectCancel.addEventListener("click", resetProjectForm);
  ui.costCancel.addEventListener("click", resetCostForm);
  ui.addProjectButton.addEventListener("click", () => openManagementPanel("project"));
  ui.addCostButton.addEventListener("click", () => openManagementPanel("cost"));
  if (ui.projectList) {
    ui.projectList.addEventListener("click", handleProjectListClick);
  }
  ui.costList.addEventListener("click", handleCostListClick);
  ui.resetDemo.addEventListener("click", handleResetDemo);
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  const data = new FormData(ui.settingsForm);

  state.settings = {
    planningStartMonth: data.get("planningStartMonth"),
    monthsToShow: clampNumber(Number(data.get("monthsToShow")), 3, 24),
    karinOpeningBalance: Number(data.get("karinOpeningBalance")),
    harmenOpeningBalance: Number(data.get("harmenOpeningBalance")),
  };
  state.goals = {
    holyShitMoment2026: normalizeGoalSignal(data.get("holyShitMoment2026")),
  };

  saveState();
  syncFormsFromState();
  render();
}

function handleProjectSubmit(event) {
  event.preventDefault();
  const data = new FormData(ui.projectForm);
  const project = {
    id: editingProjectId || createId(),
    name: String(data.get("name")).trim(),
    stage: normalizeProjectStage(data.get("stage")),
    monthlyRevenue: Number(data.get("monthlyRevenue")),
    category: normalizeProjectCategory(data.get("category")),
    outsideNetwork: data.get("outsideNetwork") === "on",
    outsideNetworkLeadYear:
      data.get("outsideNetwork") === "on" ? currentYearNumber() : null,
    owner: normalizeOwner(data.get("owner")),
    startMonth: data.get("startMonth"),
    endMonth: data.get("endMonth") || "",
    notes: String(data.get("notes")).trim(),
  };

  if (!project.name) {
    window.alert("Geef een klant of projectnaam op.");
    return;
  }

  if (!isValidMonthRange(project.startMonth, project.endMonth)) {
    window.alert("De eindmaand moet gelijk aan of later zijn dan de startmaand.");
    return;
  }

  upsertItem("projects", project, editingProjectId);
  resetProjectForm();
  render();
}

function handleCostSubmit(event) {
  event.preventDefault();
  const data = new FormData(ui.costForm);
  const cost = {
    id: editingCostId || createId(),
    label: String(data.get("label")).trim(),
    amount: Number(data.get("amount")),
    owner: normalizeOwner(data.get("owner")),
    projectId: data.get("projectId") || "",
    startMonth: data.get("startMonth"),
    endMonth: data.get("endMonth") || "",
  };

  if (!cost.label) {
    window.alert("Geef een naam voor de kostenregel op.");
    return;
  }

  if (!isValidMonthRange(cost.startMonth, cost.endMonth)) {
    window.alert("De eindmaand moet gelijk aan of later zijn dan de startmaand.");
    return;
  }

  upsertItem("recurringCosts", cost, editingCostId);
  resetCostForm();
  render();
}

function handleProjectListClick(event) {
  const actionButton = event.target.closest("button[data-action]");
  if (!actionButton) {
    return;
  }

  const { action, id } = actionButton.dataset;
  const project = state.projects.find((item) => item.id === id);
  if (!project) {
    return;
  }

  if (action === "edit") {
    editingProjectId = id;
    fillProjectForm(project);
    openManagementPanel("project");
    return;
  }

  if (action === "delete" && window.confirm(`Project "${project.name}" verwijderen?`)) {
    state.projects = state.projects.filter((item) => item.id !== id);
    state.recurringCosts = state.recurringCosts.map((cost) =>
      cost.projectId === id ? { ...cost, projectId: "" } : cost
    );
    if (editingProjectId === id) {
      resetProjectForm();
    }
    saveState();
    render();
  }
}

function handleCostListClick(event) {
  const actionButton = event.target.closest("button[data-action]");
  if (!actionButton) {
    return;
  }

  const { action, id } = actionButton.dataset;
  const cost = state.recurringCosts.find((item) => item.id === id);
  if (!cost) {
    return;
  }

  if (action === "edit") {
    editingCostId = id;
    fillCostForm(cost);
    openManagementPanel("cost");
    return;
  }

  if (action === "delete" && window.confirm(`Kostenregel "${cost.label}" verwijderen?`)) {
    state.recurringCosts = state.recurringCosts.filter((item) => item.id !== id);
    if (editingCostId === id) {
      resetCostForm();
    }
    saveState();
    render();
  }
}

function handleResetDemo() {
  if (!window.confirm("Alle huidige invoer overschrijven met de basisdata?")) {
    return;
  }

  state = createDefaultState();
  resetProjectForm();
  resetCostForm();
  saveState();
  syncFormsFromState();
  render();
}

function handleCategoryRevenueClick(event) {
  const targetButton = event.target.closest("[data-customer-target]");
  if (!targetButton) {
    return;
  }

  const targetId = targetButton.dataset.customerTarget;
  if (!targetId) {
    return;
  }

  const customerCard = document.getElementById(targetId);
  if (!customerCard) {
    return;
  }

  const details = customerCard.querySelector("details");
  if (details) {
    details.open = true;
  }

  customerCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

function openManagementPanel(panel) {
  if (panel === "project") {
    if (ui.projectPanel) {
      ui.projectPanel.open = true;
    }
    if (ui.costPanel) {
      ui.costPanel.open = false;
    }
    ui.projectForm.elements.name.focus();
    return;
  }

  if (ui.costPanel) {
    ui.costPanel.open = true;
  }
  if (ui.projectPanel) {
    ui.projectPanel.open = false;
  }
  ui.costForm.elements.label.focus();
}

function render() {
  populateProjectSelect();
  renderProjectInventory();
  renderCostInventory();

  const monthlyRows = buildMonthlyRows();
  populateYearSelect(monthlyRows);
  ensureFocusYear(monthlyRows);

  const focusYear = Number(ui.focusYear.value || currentYearNumber());
  const yearRows = buildYearRows(monthlyRows, focusYear);
  const yearSummary = buildYearSummary(focusYear, yearRows);
  const customerCards = buildCustomerCards(focusYear, yearRows);

  renderGoalKpis(focusYear, yearSummary);
  renderCategoryRevenue(focusYear, yearSummary);
  renderTeamLiquidity(yearRows, focusYear);
  renderCustomerBoard(customerCards);
  renderMonthlyPerformance(yearRows, focusYear);
}

function renderGoalKpis(focusYear, yearSummary) {
  const totalPictureRevenue = yearSummary.totalPictureRevenue || 0;
  const realizedRevenue = calculateAnnualRevenueForYear(focusYear);
  const externalLeads = countOutsideNetworkCustomersForYear(focusYear);
  const holyShitSignal = normalizeGoalSignal(state.goals.holyShitMoment2026);

  const champagneCards = [
    {
      title: "Nieuwe leads buiten netwerk",
      targetLabel: "Doel: 11 leads",
      currentValue: `${externalLeads} / 11`,
      note: "Leads via vakblad, events partij of een onverwachte externe ingang.",
      progress: Math.min((externalLeads / 11) * 100, 100),
      signal: signalFromProgress(externalLeads / 11),
    },
    {
      title: "Holy shit moment",
      targetLabel: "Doel: 1 doorbraak",
      currentValue: goalSignalToText(holyShitSignal),
      note: "Nieuwe zichtbaarheid of tractie buiten het directe netwerk.",
      progress: holyShitSignal === "green" ? 100 : holyShitSignal === "amber" ? 55 : 18,
      signal: holyShitSignal,
    },
    {
      title: `Omzet ${focusYear}`,
      targetLabel: "Doel: EUR 25.000",
      currentValue: formatCurrency(realizedRevenue),
      note: "Berekend uit toegezegde en gefactureerde omzet binnen het gekozen jaar.",
      progress: Math.min((realizedRevenue / 25000) * 100, 100),
      signal: signalFromProgress(realizedRevenue / 25000),
    },
  ];

  const stageCards = ["pipeline", "active", "completed"].map((stage) => {
    const entry = yearSummary.stageTotals[stage];
    const progress = totalPictureRevenue > 0 ? (entry.value / totalPictureRevenue) * 100 : 0;
    const signal = stage === "completed" ? "green" : "amber";

    return {
      title: `${stageToLabel(stage)} in ${focusYear}`,
      targetLabel: `${entry.customerCount} klant${entry.customerCount === 1 ? "" : "en"} · ${entry.projectCount} traject${entry.projectCount === 1 ? "" : "en"}`,
      currentValue: formatCurrency(entry.value),
      note: `${formatCurrency(entry.byOwner.karin)} Karin · ${formatCurrency(entry.byOwner.harmen)} Harmen`,
      progress,
      signal,
    };
  });

  ui.goalKpis.innerHTML = champagneCards
    .concat(stageCards)
    .map(
      (goal) => `
        <article class="goal-card">
          <div class="goal-header">
            <div>
              <h3>${escapeHtml(goal.title)}</h3>
              <div class="goal-target">${escapeHtml(goal.targetLabel)}</div>
            </div>
            <span class="rag-pill ${goal.signal}">${escapeHtml(goalSignalToLabel(goal.signal))}</span>
          </div>
          <div class="goal-value">${escapeHtml(goal.currentValue)}</div>
          <div class="goal-progress">
            <div class="goal-bar">
              <div class="goal-bar-fill ${goal.signal}" style="width:${Math.max(goal.progress, 6)}%"></div>
            </div>
          </div>
          <p class="helper-text">${escapeHtml(goal.note)}</p>
        </article>
      `
    )
    .join("");
}

function renderOverviewKpis(focusYear, yearSummary) {
  const closingRow = yearSummary.closingRow;

  const kpis = [
    {
      label: `Jaarbeeld ${focusYear}`,
      value: formatCurrency(yearSummary.totalPictureRevenue),
      note: `${yearSummary.monthCoverageLabel} · potentieel + toegezegd + gefactureerd`,
    },
    {
      label: "Forecast kosten",
      value: formatCurrency(yearSummary.totalCosts),
      note: `${formatCurrency(yearSummary.costsByOwner.karin)} Karin · ${formatCurrency(yearSummary.costsByOwner.harmen)} Harmen`,
    },
    {
      label: "Netto zonder potentieel",
      value: formatCurrency(yearSummary.committedNet),
      note:
        yearSummary.committedNet >= 0
          ? "Conservatief beeld op toegezegd + gefactureerd"
          : "Kosten lopen harder dan de zekerdere omzet",
      tone: yearSummary.committedNet >= 0 ? "positive" : "negative",
    },
    {
      label: "Karin forecast",
      value: formatCurrency(yearSummary.ownerBreakdown.karin.revenue),
      note: `Netto ${formatCurrency(yearSummary.ownerBreakdown.karin.net)} zonder potentieel`,
      tone: yearSummary.ownerBreakdown.karin.net >= 0 ? "positive" : "negative",
    },
    {
      label: "Harmen forecast",
      value: formatCurrency(yearSummary.ownerBreakdown.harmen.revenue),
      note: `Netto ${formatCurrency(yearSummary.ownerBreakdown.harmen.net)} zonder potentieel`,
      tone: yearSummary.ownerBreakdown.harmen.net >= 0 ? "positive" : "negative",
    },
    {
      label: "Eindliquiditeit",
      value: formatCurrency(closingRow?.combinedClosing || 0),
      note: closingRow
        ? `${formatCurrency(closingRow.karinClosing)} Karin · ${formatCurrency(closingRow.harmenClosing)} Harmen`
        : "Nog geen maanddata beschikbaar",
      tone: (closingRow?.combinedClosing || 0) >= 0 ? "positive" : "negative",
    },
  ];

  ui.overviewKpis.innerHTML = kpis
    .map(
      (kpi) => `
        <article class="kpi-card">
          <span class="kpi-label">${escapeHtml(kpi.label)}</span>
          <strong class="kpi-value ${kpi.tone || ""}">${escapeHtml(kpi.value)}</strong>
          <p class="kpi-note">${escapeHtml(kpi.note)}</p>
        </article>
      `
    )
    .join("");
}

function renderCategoryRevenue(focusYear, yearSummary) {
  const categoryRows = yearSummary.categoryRows;

  if (!categoryRows.length) {
    ui.categoryRevenue.innerHTML = `
      <div class="empty-state">
        Nog geen categorie-omzet in ${escapeHtml(String(focusYear))}.
      </div>
    `;
    return;
  }

  const totalRevenue = yearSummary.totalPictureRevenue || 0;

  ui.categoryRevenue.innerHTML = categoryRows
    .map((row) => {
      const share = totalRevenue > 0 ? (row.value / totalRevenue) * 100 : 0;

      return `
        <details class="category-card category-detail ${row.variant}">
          <summary>
            <div class="category-card-header">
              <div>
                <span class="category-label">${escapeHtml(row.label)}</span>
                <strong class="category-value">${formatCurrency(row.value)}</strong>
              </div>
              <span class="status-pill">${Math.round(share)}%</span>
            </div>
            <div class="category-bar">
              <div class="category-bar-fill ${row.variant}" style="width:${Math.max(share, row.value > 0 ? 6 : 0)}%"></div>
            </div>
          </summary>
          <div class="category-detail-body">
            ${
              row.customers.length
                ? `
                  <div class="section-label">Klanten in ${escapeHtml(row.label)}</div>
                  <div class="category-customer-list">
                    ${row.customers
                      .map(
                        (customer) => `
                          <button class="category-customer-link" type="button" data-customer-target="${escapeHtml(customer.customerId)}">
                            <span>${escapeHtml(customer.name)}</span>
                            <span>${escapeHtml(ownerToLabel(customer.owner))}</span>
                          </button>
                        `
                      )
                      .join("")}
                  </div>
                `
                : '<div class="helper-text">Nog geen klanten onder dit label.</div>'
            }
          </div>
        </details>
      `;
    })
    .join("");
}

function renderPipelineSpotlight(focusYear, yearSummary) {
  const ownerCards = [
    {
      title: "Karin",
      revenue: yearSummary.ownerBreakdown.karin.revenue,
      costs: yearSummary.ownerBreakdown.karin.costs,
      net: yearSummary.ownerBreakdown.karin.net,
      stageBreakdown: yearSummary.ownerBreakdown.karin.stageBreakdown,
    },
    {
      title: "Harmen",
      revenue: yearSummary.ownerBreakdown.harmen.revenue,
      costs: yearSummary.ownerBreakdown.harmen.costs,
      net: yearSummary.ownerBreakdown.harmen.net,
      stageBreakdown: yearSummary.ownerBreakdown.harmen.stageBreakdown,
    },
    {
      title: "Samen",
      revenue: yearSummary.committedRevenue,
      costs: yearSummary.totalCosts,
      net: yearSummary.committedNet,
      stageBreakdown: {
        pipeline: yearSummary.stageTotals.pipeline.value,
        active: yearSummary.stageTotals.active.value,
        completed: yearSummary.stageTotals.completed.value,
      },
    },
  ];

  const lead = `
    <div class="spotlight-top">
      <div class="spotlight-lead">
        <span class="mini-label">Jaarbeeld ${escapeHtml(String(focusYear))}</span>
        <strong>${formatCurrency(yearSummary.totalPictureRevenue)}</strong>
        <p class="helper-text">
          Opgebouwd uit potentieel, toegezegd en al gefactureerd. Voor liquiditeit
          rekenen we hieronder conservatief zonder potentieel.
        </p>
      </div>
      <div class="spotlight-copy">
        <span class="sub-pill">Potentieel ${formatCurrency(yearSummary.stageTotals.pipeline.value)}</span>
        <span class="sub-pill">Toegezegd ${formatCurrency(yearSummary.stageTotals.active.value)}</span>
        <span class="sub-pill">Gefactureerd ${formatCurrency(yearSummary.stageTotals.completed.value)}</span>
      </div>
    </div>
  `;

  ui.pipelineSpotlight.innerHTML =
    lead +
    `<div class="spotlight-grid">
      ${ownerCards
        .map(
          (card) => `
            <article class="spotlight-card">
              <div class="pill-row">
                <div class="status-pill">${escapeHtml(card.title)}</div>
                <div class="status-pill">Netto ${formatCurrency(card.net)}</div>
              </div>
              <h3>${escapeHtml(card.title)} in ${escapeHtml(String(focusYear))}</h3>
              <div class="spotlight-metrics">
                <div class="metric">
                  <span>Toegezegd + gefactureerd</span>
                  <strong>${formatCurrency(card.revenue)}</strong>
                </div>
                <div class="metric">
                  <span>Kosten</span>
                  <strong>${formatCurrency(card.costs)}</strong>
                </div>
              </div>
              <p class="helper-text">
                Potentieel ${formatCurrency(card.stageBreakdown.pipeline)} ·
                Toegezegd ${formatCurrency(card.stageBreakdown.active)} ·
                Gefactureerd ${formatCurrency(card.stageBreakdown.completed)}
              </p>
            </article>
          `
        )
        .join("")}
    </div>`;
}

function renderTeamLiquidity(yearRows, focusYear) {
  if (!yearRows.length) {
    ui.teamLiquidity.innerHTML =
      '<div class="empty-state">Nog geen liquiditeitsgegevens beschikbaar.</div>';
    return;
  }

  const chartWidth = 1120;
  const chartHeight = 320;
  const padding = { top: 20, right: 18, bottom: 42, left: 64 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const currentMonthValue = currentMonth();
  const lastActualIndex = findLastActualIndex(yearRows, currentMonthValue);

  const values = yearRows.flatMap((row) => [
    row.karinRevenue,
    row.karinCosts,
    row.harmenRevenue,
    row.harmenCosts,
  ]);
  const minValue = 0;
  const maxValue = Math.max(...values, 1);
  const range = maxValue - minValue || 1;

  const xForIndex = (index) =>
    padding.left +
    (yearRows.length === 1 ? innerWidth / 2 : (index / (yearRows.length - 1)) * innerWidth);
  const yForValue = (value) =>
    padding.top + ((maxValue - value) / range) * innerHeight;

  const series = [
    { key: "karinRevenue", person: "karin", metric: "revenue", label: "Karin opbrengst" },
    { key: "karinCosts", person: "karin", metric: "costs", label: "Karin kosten" },
    { key: "harmenRevenue", person: "harmen", metric: "revenue", label: "Harmen opbrengst" },
    { key: "harmenCosts", person: "harmen", metric: "costs", label: "Harmen kosten" },
  ];

  const gridValues = [0, 0.33, 0.66, 1].map((step) => maxValue - step * range);
  const svg = `
    <svg class="chart-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Opbrengst en kosten van Karin en Harmen in ${focusYear}, met forecast als stippellijn">
      ${gridValues
        .map(
          (gridValue) => `
            <line
              class="chart-grid-line"
              x1="${padding.left}"
              y1="${yForValue(gridValue)}"
              x2="${chartWidth - padding.right}"
              y2="${yForValue(gridValue)}"
            />
            <text
              class="chart-axis-label"
              x="${padding.left - 10}"
              y="${yForValue(gridValue) + 4}"
              text-anchor="end"
            >${escapeHtml(shortCurrency(gridValue))}</text>
          `
        )
        .join("")}
      <line
        class="chart-axis-line"
        x1="${padding.left}"
        y1="${padding.top + innerHeight}"
        x2="${chartWidth - padding.right}"
        y2="${padding.top + innerHeight}"
      />
      ${
        lastActualIndex >= 0 && lastActualIndex < yearRows.length - 1
          ? `
            <line
              class="chart-split-line"
              x1="${xForIndex(lastActualIndex)}"
              y1="${padding.top}"
              x2="${xForIndex(lastActualIndex)}"
              y2="${padding.top + innerHeight}"
            />
          `
          : ""
      }
      ${series
        .map((item) => {
          const points = yearRows.map((row, index) => ({
            x: xForIndex(index),
            y: yForValue(row[item.key]),
            value: row[item.key],
            isForecast: row.month > currentMonthValue,
          }));
          const actualPoints =
            lastActualIndex >= 0 ? points.slice(0, lastActualIndex + 1) : [];
          const forecastPoints =
            lastActualIndex < points.length - 1
              ? points.slice(Math.max(lastActualIndex, 0))
              : lastActualIndex === -1
                ? points
                : [];
          const actualPath = buildLinePath(actualPoints);
          const forecastPath = buildLinePath(forecastPoints);

          return `
            ${actualPath ? `<path class="chart-line ${item.person} ${item.metric}" d="${actualPath}" />` : ""}
            ${forecastPath ? `<path class="chart-line ${item.person} ${item.metric} forecast" d="${forecastPath}" />` : ""}
            ${points
              .map(
                (point) => `
                  <circle
                    class="chart-point ${item.person} ${item.metric} ${point.isForecast ? "forecast" : "actual"}"
                    cx="${point.x}"
                    cy="${point.y}"
                    r="${point.isForecast ? 3.6 : 4.4}"
                  />
                `
              )
              .join("")}
          `;
        })
        .join("")}
      ${yearRows
        .map(
          (row, index) => `
            <text
              class="chart-axis-label"
              x="${xForIndex(index)}"
              y="${chartHeight - 12}"
              text-anchor="middle"
            >${escapeHtml(shortMonth(row.month))}</text>
          `
        )
        .join("")}
    </svg>
  `;

  const forecastLabel =
    lastActualIndex >= 0 && lastActualIndex < yearRows.length - 1
      ? `Forecast vanaf ${formatMonth(yearRows[lastActualIndex + 1].month)}`
      : lastActualIndex === -1
        ? `Alles is forecast vanaf ${formatMonth(yearRows[0].month)}`
      : focusYear > currentYearNumber()
        ? `Alles is forecast in ${focusYear}`
        : "Geen forecast-scheiding binnen dit jaar";

  ui.teamLiquidity.innerHTML = `
    <div class="chart-legend">
      <span class="legend-item"><span class="legend-line karin revenue"></span>Karin opbrengst</span>
      <span class="legend-item"><span class="legend-line karin costs"></span>Karin kosten</span>
      <span class="legend-item"><span class="legend-line harmen revenue"></span>Harmen opbrengst</span>
      <span class="legend-item"><span class="legend-line harmen costs"></span>Harmen kosten</span>
      <span class="legend-item"><span class="legend-line neutral forecast"></span>${escapeHtml(forecastLabel)}</span>
    </div>
    <div class="chart-frame">${svg}</div>
  `;
}

function renderCustomerBoard(customerCards) {
  if (!customerCards.length) {
    ui.customerBoard.innerHTML =
      '<div class="empty-state">Nog geen klantgegevens beschikbaar.</div>';
    return;
  }

  ui.customerBoard.innerHTML = customerCards
    .map(
      (customer) => `
        <article class="customer-card compact" id="${escapeHtml(customer.customerId)}">
          <details>
            <summary>
              <div class="customer-card-top">
                <div>
                  <div class="pill-row">
                    <div class="status-pill">${escapeHtml(ownerToLabel(customer.owner))}</div>
                    <div class="status-pill">${escapeHtml(customer.statusLabel)}</div>
                    ${customer.outsideNetwork ? '<div class="status-pill">Buiten netwerk</div>' : ""}
                  </div>
                  <h3>${escapeHtml(customer.name)}</h3>
                </div>
                <span class="customer-chevron">›</span>
              </div>
              <div class="customer-card-metrics">
                <div class="customer-metric-row">
                  <span>Gefactureerd</span>
                  <strong>${formatCurrency(customer.completedValue)}</strong>
                </div>
                <div class="customer-metric-row">
                  <span>Open</span>
                  <strong>${formatCurrency(customer.openValue)}</strong>
                </div>
                <div class="customer-metric-row">
                  <span>Kosten</span>
                  <strong>${formatCurrency(customer.costValue)}</strong>
                </div>
              </div>
            </summary>
            <div class="customer-details compact-details">
              ${
                customer.categoryLabels.length
                  ? `
                    <div class="customer-card-tags">
                      ${customer.categoryLabels
                        .map((label) => `<span class="status-pill">${escapeHtml(label)}</span>`)
                        .join("")}
                    </div>
                  `
                  : ""
              }
              <div class="customer-detail-grid">
                <div class="metric">
                  <span>Totaal beeld</span>
                  <strong>${formatCurrency(customer.completedValue + customer.openValue)}</strong>
                </div>
                <div class="metric">
                  <span>Status</span>
                  <strong>${escapeHtml(customer.statusLabel)}</strong>
                </div>
              </div>
            </div>
          </details>
        </article>
      `
    )
    .join("");
}

function renderMonthlyPerformance(yearRows, focusYear) {
  if (!yearRows.length) {
    ui.monthlyPerformance.innerHTML =
      '<div class="empty-state">Nog geen maandgegevens beschikbaar.</div>';
    return;
  }

  const maxValue = Math.max(
    1,
    ...yearRows.flatMap((row) => [
      row.stageRevenue.pipeline,
      row.stageRevenue.active,
      row.stageRevenue.completed,
      row.combinedCosts,
      Math.abs(row.combinedNet),
    ])
  );

  ui.monthlyPerformance.innerHTML = `
    <div class="performance-stack">
      <section class="performance-group">
        <div class="performance-subtitle">${escapeHtml(String(focusYear))}</div>
        <div class="monthly-grid full-year-grid">
          ${yearRows.map((row) => renderPerformanceCard(row, maxValue)).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderBarLine(label, value, maxValue, variant) {
  const width = Math.max((value / maxValue) * 100, value > 0 ? 4 : 0);
  return `
    <div class="bar-line">
      <div class="bar-label">
        <span>${escapeHtml(label)}</span>
        <span>${formatCurrency(value)}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${variant}" style="width:${width}%"></div>
      </div>
    </div>
  `;
}

function renderPerformanceCard(row, maxValue) {
  return `
    <article class="month-card">
      <div class="month-card-header">
        <h3>${escapeHtml(formatMonth(row.month))}</h3>
        <span class="month-net ${row.combinedNet >= 0 ? "positive" : "negative"}">${formatCurrency(row.combinedNet)}</span>
      </div>
      <div class="bar-stack">
        ${renderBarLine("Potentieel", row.stageRevenue.pipeline, maxValue, "pipeline")}
        ${renderBarLine("Toegezegd", row.stageRevenue.active, maxValue, "active")}
        ${renderBarLine("Gefactureerd", row.stageRevenue.completed, maxValue, "completed")}
        ${renderBarLine("Kosten", row.combinedCosts, maxValue, "costs")}
      </div>
      <div class="inventory-metrics">
        <div class="metric">
          <span>Netto zonder potentieel</span>
          <strong class="${row.combinedNet >= 0 ? "positive" : "negative"}">${formatCurrency(row.combinedNet)}</strong>
        </div>
        <div class="metric">
          <span>Liquiditeit samen</span>
          <strong>${formatCurrency(row.combinedClosing)}</strong>
        </div>
      </div>
    </article>
  `;
}

function buildYearRows(monthlyRows, focusYear) {
  return monthlyRows.filter((row) => getYearFromMonth(row.month) === Number(focusYear));
}

function buildYearSummary(focusYear, yearRows) {
  const yearMonths = yearRows.map((row) => row.month);
  const stageTotals = {
    pipeline: { value: 0, projectCount: 0, customerKeys: new Set(), byOwner: { karin: 0, harmen: 0 } },
    active: { value: 0, projectCount: 0, customerKeys: new Set(), byOwner: { karin: 0, harmen: 0 } },
    completed: { value: 0, projectCount: 0, customerKeys: new Set(), byOwner: { karin: 0, harmen: 0 } },
  };
  const ownerBreakdown = {
    karin: {
      revenue: 0,
      costs: 0,
      net: 0,
      stageBreakdown: { pipeline: 0, active: 0, completed: 0 },
    },
    harmen: {
      revenue: 0,
      costs: 0,
      net: 0,
      stageBreakdown: { pipeline: 0, active: 0, completed: 0 },
    },
  };
  const categoryTotals = createEmptyCategoryTotals();
  const categoryProjectCounts = createEmptyCategoryTotals();
  const categoryStageCounts = createEmptyCategoryStageTotals();
  const categoryCustomers = createEmptyCategoryCustomerMaps();

  for (const project of state.projects) {
    const activeMonths = yearMonths.filter((month) => isActiveInMonth(project, month));
    if (!activeMonths.length) {
      continue;
    }

    const value = activeMonths.length * (Number(project.monthlyRevenue) || 0);
    const stageEntry = stageTotals[project.stage];
    const split = splitByOwner(value, project.owner);
    const category = normalizeProjectCategory(project.category, project);

    stageEntry.value += value;
    stageEntry.projectCount += 1;
    stageEntry.customerKeys.add(buildCustomerKey(project));
    stageEntry.byOwner.karin += split.karin;
    stageEntry.byOwner.harmen += split.harmen;

    ownerBreakdown.karin.stageBreakdown[project.stage] += split.karin;
    ownerBreakdown.harmen.stageBreakdown[project.stage] += split.harmen;
    categoryTotals[category] += value;
    categoryProjectCounts[category] += 1;
    categoryStageCounts[category][project.stage] += 1;
    categoryCustomers[category].set(buildCustomerKey(project), {
      name: project.name,
      owner: project.owner,
      customerId: buildCustomerCardId(project.name, project.owner),
    });
  }

  let totalCosts = 0;
  const costsByOwner = { karin: 0, harmen: 0 };

  for (const cost of state.recurringCosts) {
    const activeMonths = yearMonths.filter((month) => isActiveInMonth(cost, month));
    if (!activeMonths.length) {
      continue;
    }

    const totalAmount = activeMonths.length * (Number(cost.amount) || 0);
    const split = splitByOwner(totalAmount, cost.owner);
    totalCosts += totalAmount;
    costsByOwner.karin += split.karin;
    costsByOwner.harmen += split.harmen;
  }

  ownerBreakdown.karin.revenue =
    ownerBreakdown.karin.stageBreakdown.active + ownerBreakdown.karin.stageBreakdown.completed;
  ownerBreakdown.harmen.revenue =
    ownerBreakdown.harmen.stageBreakdown.active + ownerBreakdown.harmen.stageBreakdown.completed;
  ownerBreakdown.karin.costs = costsByOwner.karin;
  ownerBreakdown.harmen.costs = costsByOwner.harmen;
  ownerBreakdown.karin.net = ownerBreakdown.karin.revenue - ownerBreakdown.karin.costs;
  ownerBreakdown.harmen.net = ownerBreakdown.harmen.revenue - ownerBreakdown.harmen.costs;

  const categoryRows = PROJECT_CATEGORIES.filter(
    (category) =>
      ["train", "build", "implement", "inspire"].includes(category) ||
      (category === "uncategorized" && categoryTotals.uncategorized > 0)
  )
    .map((category) => ({
      key: category,
      label: categoryToLabel(category),
      value: categoryTotals[category],
      projectCount: categoryProjectCounts[category],
      stageLabel: formatCategoryStageLabel(categoryStageCounts[category]),
      customers: Array.from(categoryCustomers[category].values()).sort((left, right) =>
        left.name.localeCompare(right.name, "nl")
      ),
      variant: `category-${category}`,
    }))
    .sort((left, right) => right.value - left.value);

  for (const stage of Object.keys(stageTotals)) {
    stageTotals[stage].customerCount = stageTotals[stage].customerKeys.size;
  }

  const committedRevenue = stageTotals.active.value + stageTotals.completed.value;
  const totalPictureRevenue = committedRevenue + stageTotals.pipeline.value;

  return {
    focusYear,
    stageTotals,
    ownerBreakdown,
    costsByOwner,
    totalCosts,
    committedRevenue,
    totalPictureRevenue,
    committedNet: committedRevenue - totalCosts,
    categoryRows,
    closingRow: yearRows[yearRows.length - 1] || null,
    monthCoverageLabel: formatMonthCoverage(yearRows),
  };
}

function buildCustomerStageGroups(focusYear, yearRows) {
  const yearMonths = yearRows.map((row) => row.month);
  const groups = {
    pipeline: new Map(),
    active: new Map(),
    completed: new Map(),
  };

  for (const project of state.projects) {
    const activeMonths = yearMonths.filter((month) => isActiveInMonth(project, month));
    if (!activeMonths.length) {
      continue;
    }

    const stageMap = groups[project.stage];
    const key = buildCustomerKey(project);
    const entry = stageMap.get(key) || createCustomerStageEntry(project, focusYear);
    const category = normalizeProjectCategory(project.category, project);
    const projectValue = activeMonths.length * (Number(project.monthlyRevenue) || 0);

    entry.yearValue += projectValue;
    entry.outsideNetwork = entry.outsideNetwork || Boolean(project.outsideNetwork);
    entry.categoryLabels.add(categoryToLabel(category));
    entry.projectIds.add(project.id);
    entry.notes.add(project.notes || "");

    for (const month of activeMonths) {
      entry.activeMonths.add(month);
      const monthEntry = entry.monthMap.get(month) || { month, revenue: 0, costs: 0 };
      monthEntry.revenue += Number(project.monthlyRevenue) || 0;
      entry.monthMap.set(month, monthEntry);
    }

    entry.projectLines.push({
      title: project.name,
      meta: `${categoryToLabel(category)} · ${formatMonthRange(project.startMonth, project.endMonth)}`,
      value: projectValue,
    });

    stageMap.set(key, entry);
  }

  for (const stage of Object.keys(groups)) {
    for (const entry of groups[stage].values()) {
      entry.linkedCosts = state.recurringCosts
        .filter((cost) => cost.projectId && entry.projectIds.has(cost.projectId))
        .map((cost) => {
          const activeMonths = yearMonths.filter((month) => isActiveInMonth(cost, month));
          const totalAmount = activeMonths.length * (Number(cost.amount) || 0);

          if (!activeMonths.length || totalAmount === 0) {
            return null;
          }

          for (const month of activeMonths) {
            const monthEntry = entry.monthMap.get(month) || { month, revenue: 0, costs: 0 };
            monthEntry.costs += Number(cost.amount) || 0;
            entry.monthMap.set(month, monthEntry);
          }

          entry.yearCosts += totalAmount;
          return {
            label: cost.label,
            totalAmount,
          };
        })
        .filter(Boolean)
        .sort((left, right) => right.totalAmount - left.totalAmount);

      entry.yearNet = entry.yearValue - entry.yearCosts;
      entry.categoryLabels = Array.from(entry.categoryLabels);
      entry.monthRows = Array.from(entry.monthMap.values()).sort((left, right) =>
        left.month.localeCompare(right.month)
      );
      entry.projectLines.sort((left, right) => right.value - left.value);
      entry.activeMonths = Array.from(entry.activeMonths).sort();
      entry.notesSummary =
        Array.from(entry.notes)
          .filter(Boolean)
          .slice(0, 2)
          .join(" ") || "Geen extra notities toegevoegd.";
    }
  }

  return {
    pipeline: Array.from(groups.pipeline.values()).sort((left, right) => right.yearValue - left.yearValue),
    active: Array.from(groups.active.values()).sort((left, right) => right.yearValue - left.yearValue),
    completed: Array.from(groups.completed.values()).sort((left, right) => right.yearValue - left.yearValue),
  };
}

function buildCustomerCards(focusYear, yearRows) {
  const yearMonths = yearRows.map((row) => row.month);
  const customerMap = new Map();

  for (const project of state.projects) {
    const activeMonths = yearMonths.filter((month) => isActiveInMonth(project, month));
    if (!activeMonths.length) {
      continue;
    }

    const key = buildCustomerKey(project);
    const value = activeMonths.length * (Number(project.monthlyRevenue) || 0);
    const entry = customerMap.get(key) || {
      name: project.name,
      owner: project.owner,
      customerId: buildCustomerCardId(project.name, project.owner),
      outsideNetwork: Boolean(project.outsideNetwork),
      completedValue: 0,
      openValue: 0,
      costValue: 0,
      categoryLabels: new Set(),
      projectIds: new Set(),
      hasActive: false,
      hasPipeline: false,
    };

    if (project.stage === "completed") {
      entry.completedValue += value;
    } else {
      entry.openValue += value;
    }

    entry.hasActive = entry.hasActive || project.stage === "active";
    entry.hasPipeline = entry.hasPipeline || project.stage === "pipeline";
    entry.outsideNetwork = entry.outsideNetwork || Boolean(project.outsideNetwork);
    entry.categoryLabels.add(categoryToLabel(normalizeProjectCategory(project.category, project)));
    entry.projectIds.add(project.id);
    customerMap.set(key, entry);
  }

  for (const entry of customerMap.values()) {
    entry.costValue = state.recurringCosts
      .filter((cost) => cost.projectId && entry.projectIds.has(cost.projectId))
      .reduce((sum, cost) => {
        const activeMonths = yearMonths.filter((month) => isActiveInMonth(cost, month));
        return sum + activeMonths.length * (Number(cost.amount) || 0);
      }, 0);

    entry.categoryLabels = Array.from(entry.categoryLabels).sort((left, right) =>
      left.localeCompare(right, "nl")
    );
    entry.statusLabel = determineCustomerStatusLabel(entry);
  }

  return Array.from(customerMap.values()).sort(
    (left, right) =>
      right.completedValue +
        right.openValue -
        (left.completedValue + left.openValue) ||
      left.name.localeCompare(right.name, "nl")
  );
}

function determineCustomerStatusLabel(customer) {
  if (customer.completedValue > 0 && customer.openValue > 0) {
    return "Deels open";
  }

  if (customer.completedValue > 0) {
    return "Gefactureerd";
  }

  if (customer.hasActive) {
    return "Toegezegd";
  }

  if (customer.hasPipeline) {
    return "Potentieel";
  }

  return "Open";
}

function createCustomerStageEntry(project, focusYear) {
  return {
    name: project.name,
    owner: project.owner,
    focusYear,
    yearValue: 0,
    yearCosts: 0,
    yearNet: 0,
    outsideNetwork: Boolean(project.outsideNetwork),
    categoryLabels: new Set(),
    projectIds: new Set(),
    notes: new Set(),
    activeMonths: new Set(),
    monthMap: new Map(),
    projectLines: [],
    linkedCosts: [],
    monthRows: [],
    notesSummary: "",
  };
}

function buildCustomerKey(project) {
  return `${normalizeOwner(project.owner)}::${project.name.trim().toLowerCase()}`;
}

function buildCustomerCardId(name, owner) {
  return `customer-${slugify(owner)}-${slugify(name)}`;
}

function createEmptyCategoryStageTotals() {
  return PROJECT_CATEGORIES.reduce((totals, category) => {
    totals[category] = { pipeline: 0, active: 0, completed: 0 };
    return totals;
  }, {});
}

function createEmptyCategoryCustomerMaps() {
  return PROJECT_CATEGORIES.reduce((totals, category) => {
    totals[category] = new Map();
    return totals;
  }, {});
}

function formatCategoryStageLabel(stageCounts) {
  const labels = [
    stageCounts.pipeline ? `${stageCounts.pipeline} potentieel` : "",
    stageCounts.active ? `${stageCounts.active} toegezegd` : "",
    stageCounts.completed ? `${stageCounts.completed} gefactureerd` : "",
  ].filter(Boolean);

  return labels.join(" · ") || "Nog geen trajecten";
}

function formatMonthCoverage(yearRows) {
  if (!yearRows.length) {
    return "0 maanden in beeld";
  }

  return `${yearRows.length} maand${yearRows.length === 1 ? "" : "en"} in beeld`;
}

function getYearFromMonth(month) {
  return Number(String(month).split("-")[0]);
}

function populateYearSelect(monthlyRows) {
  const years = Array.from(new Set(monthlyRows.map((row) => getYearFromMonth(row.month))));
  const previousValue = ui.focusYear.value;

  ui.focusYear.innerHTML = years
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("");

  if (years.includes(Number(previousValue))) {
    ui.focusYear.value = previousValue;
  } else if (years.includes(currentYearNumber())) {
    ui.focusYear.value = String(currentYearNumber());
  } else if (years.length) {
    ui.focusYear.value = String(years[0]);
  }
}

function ensureFocusYear(monthlyRows) {
  const availableYears = monthlyRows.map((row) => String(getYearFromMonth(row.month)));
  if (!availableYears.includes(ui.focusYear.value)) {
    ui.focusYear.value = availableYears[0] || String(currentYearNumber());
  }
}

function buildLinePath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function findLastActualIndex(rows, cutoffMonth) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].month <= cutoffMonth) {
      return index;
    }
  }

  return -1;
}

function buildAreaPath(points, baselineY) {
  if (!points.length) {
    return "";
  }

  const line = buildLinePath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  return `${line} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`;
}

function renderProjectInventory() {
  if (!ui.projectList) {
    return;
  }

  if (!state.projects.length) {
    ui.projectList.innerHTML =
      '<div class="empty-state">Nog geen projecten of klanten toegevoegd.</div>';
    return;
  }

  ui.projectList.className = "management-compact-list";
  ui.projectList.innerHTML = state.projects
    .slice()
    .sort((left, right) => left.startMonth.localeCompare(right.startMonth))
    .map(
      (project) => `
        <details class="management-row">
          <summary>
            <div class="management-row-summary">
              <span class="management-row-title">${escapeHtml(project.name)}</span>
              <span class="customer-chevron">›</span>
            </div>
          </summary>
          <div class="management-row-details">
            <div class="pill-row">
              <div class="status-pill">${escapeHtml(ownerToLabel(project.owner))}</div>
              <div class="status-pill">${escapeHtml(stageToLabel(project.stage))}</div>
              <div class="status-pill">${escapeHtml(categoryToLabel(project.category))}</div>
              ${project.outsideNetwork ? '<div class="status-pill">Buiten netwerk</div>' : ""}
            </div>
            <div class="inventory-metrics">
              <div class="metric">
                <span>Bedrag</span>
                <strong>${formatCurrency(project.monthlyRevenue)}</strong>
              </div>
              <div class="metric">
                <span>Periode</span>
                <strong>${formatMonthRange(project.startMonth, project.endMonth)}</strong>
              </div>
            </div>
            ${project.notes ? `<p>${escapeHtml(project.notes)}</p>` : ""}
            <div class="inventory-actions">
              <button class="small-button" type="button" data-action="edit" data-id="${project.id}">Bewerk</button>
              <button class="small-button" type="button" data-action="delete" data-id="${project.id}">Verwijder</button>
            </div>
          </div>
        </details>
      `
    )
    .join("");
}

function renderCostInventory() {
  if (!state.recurringCosts.length) {
    ui.costList.innerHTML =
      '<div class="empty-state">Nog geen terugkerende kosten toegevoegd.</div>';
    return;
  }

  ui.costList.className = "management-compact-list";
  ui.costList.innerHTML = state.recurringCosts
    .slice()
    .sort((left, right) => left.label.localeCompare(right.label, "nl"))
    .map(
      (cost) => `
        <details class="management-row">
          <summary>
            <div class="management-row-summary">
              <span class="management-row-title">${escapeHtml(cost.label)}</span>
              <span class="customer-chevron">›</span>
            </div>
          </summary>
          <div class="management-row-details">
            <div class="pill-row">
              <div class="status-pill">${escapeHtml(ownerToLabel(cost.owner))}</div>
            </div>
            <div class="inventory-metrics">
              <div class="metric">
                <span>Per maand</span>
                <strong>${formatCurrency(cost.amount)}</strong>
              </div>
              <div class="metric">
                <span>Gekoppeld aan</span>
                <strong>${escapeHtml(cost.projectId ? lookupProjectName(cost.projectId) : "Algemene kosten")}</strong>
              </div>
            </div>
            <p>${escapeHtml(formatMonthRange(cost.startMonth, cost.endMonth))}</p>
            <div class="cost-actions">
              <button class="small-button" type="button" data-action="edit" data-id="${cost.id}">Bewerk</button>
              <button class="small-button" type="button" data-action="delete" data-id="${cost.id}">Verwijder</button>
            </div>
          </div>
        </details>
      `
    )
    .join("");
}

function buildMonthlyRows() {
  const months = buildMonthRange(
    state.settings.planningStartMonth,
    state.settings.monthsToShow
  );

  let karinClosing = Number(state.settings.karinOpeningBalance);
  let harmenClosing = Number(state.settings.harmenOpeningBalance);

  return months.map((month, index) => {
    const karinOpening = index === 0 ? Number(state.settings.karinOpeningBalance) : karinClosing;
    const harmenOpening = index === 0 ? Number(state.settings.harmenOpeningBalance) : harmenClosing;

    const monthlyProjects = state.projects.filter((project) => isActiveInMonth(project, month));
    const realizedProjects = state.projects.filter(
      (project) => project.stage !== "pipeline" && isActiveInMonth(project, month)
    );
    const categoryRevenue = createEmptyCategoryTotals();
    const categoryProjectCounts = createEmptyCategoryTotals();
    const stageRevenue = {
      pipeline: 0,
      active: 0,
      completed: 0,
    };

    monthlyProjects.forEach((project) => {
      const category = normalizeProjectCategory(project.category, project);
      categoryRevenue[category] += Number(project.monthlyRevenue) || 0;
      categoryProjectCounts[category] += 1;
      stageRevenue[project.stage] += Number(project.monthlyRevenue) || 0;
    });

    const karinRevenue = realizedProjects.reduce(
      (sum, project) => sum + splitByOwner(project.monthlyRevenue, project.owner).karin,
      0
    );
    const harmenRevenue = realizedProjects.reduce(
      (sum, project) => sum + splitByOwner(project.monthlyRevenue, project.owner).harmen,
      0
    );

    const activeCosts = state.recurringCosts.filter((cost) => isActiveInMonth(cost, month));
    const karinCosts = activeCosts.reduce(
      (sum, cost) => sum + splitByOwner(cost.amount, cost.owner).karin,
      0
    );
    const harmenCosts = activeCosts.reduce(
      (sum, cost) => sum + splitByOwner(cost.amount, cost.owner).harmen,
      0
    );

    karinClosing = karinOpening + karinRevenue - karinCosts;
    harmenClosing = harmenOpening + harmenRevenue - harmenCosts;

    return {
      month,
      karinOpening,
      karinRevenue,
      karinCosts,
      karinNet: karinRevenue - karinCosts,
      karinClosing,
      harmenOpening,
      harmenRevenue,
      harmenCosts,
      harmenNet: harmenRevenue - harmenCosts,
      harmenClosing,
      combinedRevenue: karinRevenue + harmenRevenue,
      combinedCosts: karinCosts + harmenCosts,
      combinedNet: karinRevenue + harmenRevenue - karinCosts - harmenCosts,
      combinedClosing: karinClosing + harmenClosing,
      stageRevenue,
      categoryRevenue,
      categoryProjectCounts,
    };
  });
}

function populateProjectSelect() {
  const previousValue = ui.costProjectSelect.value;
  const options = ['<option value="">Algemene kosten</option>']
    .concat(
      state.projects
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name, "nl"))
        .map(
          (project) =>
            `<option value="${project.id}">${escapeHtml(project.name)} · ${escapeHtml(stageToLabel(project.stage))}</option>`
        )
    )
    .join("");

  ui.costProjectSelect.innerHTML = options;
  ui.costProjectSelect.value = state.projects.some((item) => item.id === previousValue)
    ? previousValue
    : "";

  if (editingCostId) {
    const editedCost = state.recurringCosts.find((item) => item.id === editingCostId);
    if (editedCost) {
      ui.costProjectSelect.value = editedCost.projectId || "";
    }
  }
}

function fillProjectForm(project) {
  ui.projectForm.elements.name.value = project.name;
  ui.projectForm.elements.stage.value = project.stage;
  ui.projectForm.elements.monthlyRevenue.value = project.monthlyRevenue;
  ui.projectForm.elements.category.value = normalizeProjectCategory(project.category, project);
  ui.projectForm.elements.outsideNetwork.checked = Boolean(project.outsideNetwork);
  ui.projectForm.elements.owner.value = project.owner;
  ui.projectForm.elements.startMonth.value = project.startMonth;
  ui.projectForm.elements.endMonth.value = project.endMonth;
  ui.projectForm.elements.notes.value = project.notes || "";
  ui.projectSubmit.textContent = "Project bijwerken";
  ui.projectCancel.hidden = false;
}

function fillCostForm(cost) {
  ui.costForm.elements.label.value = cost.label;
  ui.costForm.elements.amount.value = cost.amount;
  ui.costForm.elements.owner.value = cost.owner;
  ui.costForm.elements.projectId.value = cost.projectId || "";
  ui.costForm.elements.startMonth.value = cost.startMonth;
  ui.costForm.elements.endMonth.value = cost.endMonth;
  ui.costSubmit.textContent = "Kosten bijwerken";
  ui.costCancel.hidden = false;
}

function resetProjectForm() {
  editingProjectId = null;
  ui.projectForm.reset();
  ui.projectForm.elements.stage.value = "pipeline";
  ui.projectForm.elements.category.value = "uncategorized";
  ui.projectForm.elements.outsideNetwork.checked = false;
  ui.projectForm.elements.owner.value = "karin";
  ui.projectForm.elements.startMonth.value = state.settings.planningStartMonth;
  ui.projectSubmit.textContent = "Project opslaan";
  ui.projectCancel.hidden = true;
  if (ui.projectPanel) {
    ui.projectPanel.open = false;
  }
}

function resetCostForm() {
  editingCostId = null;
  ui.costForm.reset();
  ui.costForm.elements.owner.value = "karin";
  ui.costForm.elements.startMonth.value = state.settings.planningStartMonth;
  ui.costProjectSelect.value = "";
  ui.costSubmit.textContent = "Kosten opslaan";
  ui.costCancel.hidden = true;
  if (ui.costPanel) {
    ui.costPanel.open = false;
  }
}

function syncFormsFromState() {
  if (ui.settingsForm) {
    ui.settingsForm.elements.planningStartMonth.value = state.settings.planningStartMonth;
    ui.settingsForm.elements.monthsToShow.value = state.settings.monthsToShow;
    ui.settingsForm.elements.karinOpeningBalance.value = state.settings.karinOpeningBalance;
    ui.settingsForm.elements.harmenOpeningBalance.value = state.settings.harmenOpeningBalance;
    ui.settingsForm.elements.holyShitMoment2026.value = state.goals.holyShitMoment2026;
  }
  ui.focusYear.value = ui.focusYear.value || String(getYearFromMonth(state.settings.planningStartMonth));
  resetProjectForm();
  resetCostForm();
}

function upsertItem(collectionName, item, editedId) {
  const collection = state[collectionName];
  const index = collection.findIndex((entry) => entry.id === editedId);

  if (index >= 0) {
    collection[index] = item;
  } else {
    collection.push(item);
  }

  saveState();
}

function splitByOwner(amount, owner) {
  const numericAmount = Number(amount) || 0;
  if (owner === "shared") {
    return { karin: numericAmount / 2, harmen: numericAmount / 2 };
  }

  if (owner === "harmen") {
    return { karin: 0, harmen: numericAmount };
  }

  return { karin: numericAmount, harmen: 0 };
}

function isActiveInMonth(item, month) {
  return item.startMonth <= month && (!item.endMonth || item.endMonth >= month);
}

function isValidMonthRange(startMonth, endMonth) {
  return Boolean(startMonth) && (!endMonth || endMonth >= startMonth);
}

function buildMonthRange(startMonth, numberOfMonths) {
  return Array.from({ length: numberOfMonths }, (_, index) => addMonths(startMonth, index));
}

function addMonths(month, offset) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1));
}

function shortMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    month: "short",
  }).format(new Date(year, monthNumber - 1, 1));
}

function formatMonthRange(startMonth, endMonth) {
  return endMonth
    ? `${formatMonth(startMonth)} t/m ${formatMonth(endMonth)}`
    : `Vanaf ${formatMonth(startMonth)}`;
}

function ownerToLabel(owner) {
  if (owner === "harmen") {
    return "Harmen";
  }

  if (owner === "shared") {
    return "Gedeeld 50/50";
  }

  return "Karin";
}

function stageToLabel(stage) {
  if (stage === "active") {
    return "Toegezegd";
  }

  if (stage === "completed") {
    return "Gefactureerd";
  }

  return "Potentieel";
}

function normalizeOwner(owner) {
  return ["karin", "harmen", "shared"].includes(owner) ? owner : "karin";
}

function normalizeProjectCategory(category, project = null) {
  if (PROJECT_CATEGORIES.includes(category)) {
    return category;
  }

  const seedProject = project?.id ? findSeedProjectById(project.id) : null;
  if (seedProject?.category && PROJECT_CATEGORIES.includes(seedProject.category)) {
    return seedProject.category;
  }

  if (seedProject) {
    return inferProjectCategory(seedProject);
  }

  if (project) {
    return inferProjectCategory(project);
  }

  return "uncategorized";
}

function normalizeProjectStage(stage) {
  return PROJECT_STAGES.includes(stage) ? stage : "pipeline";
}

function categoryToLabel(category) {
  if (category === "train") {
    return "Train";
  }

  if (category === "build") {
    return "Build";
  }

  if (category === "implement") {
    return "Implement";
  }

  if (category === "inspire") {
    return "Inspire";
  }

  return "Nog in te delen";
}

function lookupProjectName(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  return project ? project.name : "Project niet gevonden";
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatPercentage(value) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return `${Math.round(value)}%`;
}

function shortCurrency(value) {
  const roundedThousands = Math.round((Number(value) || 0) / 100) * 100;
  return currencyFormatter.format(roundedThousands);
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || readLegacyState();
    if (!raw) {
      return createDefaultState();
    }

    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn("Kon opgeslagen dashboarddata niet laden, basisdata wordt gebruikt.", error);
    return createDefaultState();
  }
}

function readLegacyState() {
  for (const key of LEGACY_STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value) {
      return value;
    }
  }

  return "";
}

function normalizeState(rawState) {
  const defaults = createDefaultState();
  const settings = rawState?.settings || {};
  const shouldRealignPlanningWindow =
    settings.planningStartMonth !== DASHBOARD_START_MONTH ||
    Number(settings.monthsToShow) !== DASHBOARD_MONTHS_TO_SHOW;

  const normalizedProjects = Array.isArray(rawState?.projects)
    ? rawState.projects.map((project) => ({
        id: project.id || createId(),
        name: project.name || "",
        stage: inferProjectStage(project),
        monthlyRevenue: Number(project.monthlyRevenue) || 0,
        category: normalizeProjectCategory(project.category, project),
        outsideNetwork: Boolean(project.outsideNetwork),
        outsideNetworkLeadYear: normalizeOutsideNetworkLeadYear(project),
        owner: normalizeOwner(project.owner),
        startMonth: project.startMonth || defaults.settings.planningStartMonth,
        endMonth: project.endMonth || "",
        notes: project.notes || "",
      }))
    : defaults.projects;

  const retaggedProjects = normalizedProjects.map((project) => {
    if (
      project.name === "AgriFood Capital B.V." &&
      project.category !== "inspire"
    ) {
      return { ...project, category: "inspire" };
    }

    if (project.id === "karin-vml") {
      return {
        ...project,
        category: project.category === "uncategorized" ? "train" : project.category,
        stage: project.stage === "pipeline" ? "active" : project.stage,
      };
    }

    return project;
  });
  const didRetagProjects = retaggedProjects.some(
    (project, index) =>
      project.category !== normalizedProjects[index].category ||
      project.stage !== normalizedProjects[index].stage
  );

  const cleanedProjects = retaggedProjects.filter(
    (project) => !DEMO_PROJECT_IDS.includes(project.id)
  );
  const removedDemoProjects = cleanedProjects.length !== retaggedProjects.length;
  const mergedProjects = mergeMissingKarinProjects(cleanedProjects);

  const normalizedRecurringCosts = Array.isArray(rawState?.recurringCosts)
    ? rawState.recurringCosts.map((cost) => ({
        id: cost.id || createId(),
        label: cost.label || "",
        amount: Number(cost.amount) || 0,
        owner: normalizeOwner(cost.owner),
        projectId: cost.projectId || "",
        startMonth: cost.startMonth || defaults.settings.planningStartMonth,
        endMonth: cost.endMonth || "",
      }))
    : defaults.recurringCosts;

  const mergedManagementFeeCosts = mergeKarinManagementFeeCosts(
    normalizedRecurringCosts,
    DASHBOARD_START_MONTH
  );

  const cleanedRecurringCosts = mergedManagementFeeCosts.costs.filter(
    (cost) => !DEMO_COST_IDS.includes(cost.id)
  );
  const removedDemoCosts = cleanedRecurringCosts.length !== mergedManagementFeeCosts.costs.length;
  const mergedRecurringCosts = mergeMissingKarinFixedCosts(
    cleanedRecurringCosts,
    DASHBOARD_START_MONTH
  );
  const hasHarmenProjectData = mergedProjects.projects.some(
    (project) => project.owner === "harmen" || project.owner === "shared"
  );
  const hasHarmenCostData = mergedRecurringCosts.costs.some(
    (cost) => cost.owner === "harmen" || cost.owner === "shared"
  );
  const normalizedHarmenOpeningBalance = numberOrDefault(
    settings.harmenOpeningBalance,
    defaults.settings.harmenOpeningBalance
  );
  const shouldResetHarmenOpeningBalance =
    !hasHarmenProjectData &&
    !hasHarmenCostData &&
    normalizedHarmenOpeningBalance === 9000;
  const harmenOpeningBalance = shouldResetHarmenOpeningBalance
    ? 0
    : normalizedHarmenOpeningBalance;

  return {
    settings: {
      planningStartMonth: DASHBOARD_START_MONTH,
      monthsToShow: DASHBOARD_MONTHS_TO_SHOW,
      karinOpeningBalance: numberOrDefault(
        settings.karinOpeningBalance,
        defaults.settings.karinOpeningBalance
      ),
      harmenOpeningBalance,
    },
    goals: {
      holyShitMoment2026: normalizeGoalSignal(
        rawState?.goals?.holyShitMoment2026 || defaults.goals.holyShitMoment2026
      ),
    },
    projects: mergedProjects.projects,
    recurringCosts: mergedRecurringCosts.costs,
    _needsSave:
      removedDemoProjects ||
      didRetagProjects ||
      mergedProjects.didChangeProjects ||
      mergedManagementFeeCosts.didChangeCosts ||
      removedDemoCosts ||
      mergedRecurringCosts.didAddMissingCosts ||
      shouldResetHarmenOpeningBalance ||
      shouldRealignPlanningWindow,
  };
}

function createDefaultState() {
  const planningStartMonth = DASHBOARD_START_MONTH;

  return {
    settings: {
      planningStartMonth,
      monthsToShow: DASHBOARD_MONTHS_TO_SHOW,
      karinOpeningBalance: 14000,
      harmenOpeningBalance: 0,
    },
    goals: {
      holyShitMoment2026: "red",
    },
    projects: createKarinSeedProjects(),
    recurringCosts: createKarinFixedCosts(planningStartMonth),
  };
}

function currentMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function createKarinFixedCosts(startMonth) {
  return KARIN_FIXED_COSTS.map((cost) => ({
    id: `karin-fixed-${slugify(cost.label)}`,
    label: cost.label,
    amount: cost.amount,
    owner: "karin",
    projectId: "",
    startMonth,
    endMonth: "",
  }));
}

function createKarinSeedProjects() {
  return KARIN_PROJECT_SEEDS.map((project) => ({
    id: project.id,
    name: project.name,
    stage: project.stage,
    monthlyRevenue: project.monthlyRevenue,
    category: inferProjectCategory(project),
    outsideNetwork: Boolean(project.outsideNetwork),
    outsideNetworkLeadYear: project.outsideNetworkLeadYear || null,
    owner: "karin",
    startMonth: project.startMonth,
    endMonth: project.endMonth,
    notes: project.notes,
  }));
}

function mergeMissingKarinProjects(existingProjects) {
  const existingKeys = new Set(existingProjects.map(projectSeedKey));
  const missingProjects = createKarinSeedProjects().filter(
    (project) => !existingKeys.has(projectSeedKey(project))
  );

  return {
    projects: existingProjects.concat(missingProjects),
    didChangeProjects: missingProjects.length > 0,
  };
}

function mergeMissingKarinFixedCosts(existingCosts, startMonth) {
  const existingKeys = new Set(
    existingCosts.map((cost) => `${cost.owner}::${cost.label.trim().toLowerCase()}`)
  );
  const missingCosts = createKarinFixedCosts(startMonth).filter((cost) => {
    const key = `${cost.owner}::${cost.label.trim().toLowerCase()}`;
    return !existingKeys.has(key);
  });

  return {
    costs: existingCosts.concat(missingCosts),
    didAddMissingCosts: missingCosts.length > 0,
  };
}

function mergeKarinManagementFeeCosts(existingCosts, startMonth) {
  const managementFeeLabel = "Management fee Karin";
  const targetKey = `karin::${managementFeeLabel.toLowerCase()}`;
  const sourceLabels = new Set(["eten/koffie", "pt", managementFeeLabel.toLowerCase()]);
  const relevantCosts = existingCosts.filter(
    (cost) => cost.owner === "karin" && sourceLabels.has(cost.label.trim().toLowerCase())
  );

  if (!relevantCosts.length) {
    return { costs: existingCosts, didChangeCosts: false };
  }

  const alreadyMerged =
    relevantCosts.length === 1 &&
    relevantCosts[0].label.trim().toLowerCase() === managementFeeLabel.toLowerCase() &&
    Number(relevantCosts[0].amount) === 500;
  if (alreadyMerged) {
    return { costs: existingCosts, didChangeCosts: false };
  }

  const managementFeeCost = {
    id: `karin-fixed-${slugify(managementFeeLabel)}`,
    label: managementFeeLabel,
    amount: 500,
    owner: "karin",
    projectId: "",
    startMonth,
    endMonth: "",
  };

  const remainingCosts = existingCosts.filter(
    (cost) => !(cost.owner === "karin" && sourceLabels.has(cost.label.trim().toLowerCase()))
  );
  const hasTargetAlready = remainingCosts.some(
    (cost) => `${cost.owner}::${cost.label.trim().toLowerCase()}` === targetKey
  );

  return {
    costs: hasTargetAlready ? remainingCosts : remainingCosts.concat(managementFeeCost),
    didChangeCosts: true,
  };
}

function persistPendingMigration() {
  if (!state._needsSave) {
    return;
  }

  delete state._needsSave;
  saveState();
}

function inferProjectStage(project) {
  if (PROJECT_STAGES.includes(project.stage)) {
    return project.stage;
  }

  if (!project.startMonth) {
    return "pipeline";
  }

  const now = currentMonth();
  if (project.startMonth > now) {
    return "pipeline";
  }

  if (!project.endMonth || project.endMonth >= now) {
    return "active";
  }

  return "completed";
}

function calculateAnnualRevenueForYear(year) {
  const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  return months.reduce((sum, month) => {
    const monthlyRevenue = state.projects
      .filter((project) => project.stage !== "pipeline" && isActiveInMonth(project, month))
      .reduce((projectSum, project) => projectSum + Number(project.monthlyRevenue || 0), 0);
    return sum + monthlyRevenue;
  }, 0);
}

function countOutsideNetworkCustomersForYear(year) {
  const customerKeys = new Set();

  for (const project of state.projects) {
    if (
      !project.outsideNetwork ||
      Number(project.outsideNetworkLeadYear) !== year
    ) {
      continue;
    }

    customerKeys.add(`${normalizeOwner(project.owner)}::${project.name.trim().toLowerCase()}`);
  }

  return customerKeys.size;
}

function projectSeedKey(project) {
  return [
    normalizeOwner(project.owner),
    normalizeProjectStage(project.stage),
    project.name.trim().toLowerCase(),
    project.startMonth,
    project.endMonth || "",
    Number(project.monthlyRevenue) || 0,
  ].join("::");
}

function numberOrDefault(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeOutsideNetworkLeadYear(project) {
  if (!project.outsideNetwork) {
    return null;
  }

  const explicitYear = Number(project.outsideNetworkLeadYear);
  if (Number.isFinite(explicitYear)) {
    return explicitYear;
  }

  const seed = findSeedProjectById(project.id);
  if (seed?.outsideNetworkLeadYear) {
    return seed.outsideNetworkLeadYear;
  }

  return currentYearNumber();
}

function findSeedProjectById(projectId) {
  return KARIN_PROJECT_SEEDS.find((project) => project.id === projectId) || null;
}

function inferProjectCategory(project) {
  const haystack = `${project.name || ""} ${project.notes || ""}`.toLowerCase();

  if (
    haystack.includes("keynote") ||
    haystack.includes("inspiratie") ||
    haystack.includes("lezing")
  ) {
    return "inspire";
  }

  if (
    haystack.includes("implement") ||
    haystack.includes("adoptie") ||
    haystack.includes("inrichting")
  ) {
    return "implement";
  }

  if (
    haystack.includes("workshop") ||
    haystack.includes("sessie") ||
    haystack.includes("cursus") ||
    haystack.includes("training")
  ) {
    return "train";
  }

  if (
    haystack.includes("website") ||
    haystack.includes("webbasic") ||
    haystack.includes("strippenkaart") ||
    haystack.includes("build")
  ) {
    return "build";
  }

  return "uncategorized";
}

function createEmptyCategoryTotals() {
  return PROJECT_CATEGORIES.reduce((totals, category) => {
    totals[category] = 0;
    return totals;
  }, {});
}

function currentYearNumber() {
  return new Date().getFullYear();
}

function signalFromProgress(progressRatio) {
  if (progressRatio >= 0.8) {
    return "green";
  }

  if (progressRatio >= 0.4) {
    return "amber";
  }

  return "red";
}

function normalizeGoalSignal(signal) {
  return ["red", "amber", "green"].includes(signal) ? signal : "red";
}

function goalSignalToLabel(signal) {
  if (signal === "green") {
    return "Green";
  }

  if (signal === "amber") {
    return "Amber";
  }

  return "Red";
}

function goalSignalToText(signal) {
  if (signal === "green") {
    return "Binnen";
  }

  if (signal === "amber") {
    return "In beweging";
  }

  return "Nog niet";
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
