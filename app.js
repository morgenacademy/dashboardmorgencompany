const STORAGE_KEY = "morgen-company-dashboard-v1";

const ui = {
  settingsForm: document.querySelector("#settings-form"),
  focusMonth: document.querySelector("#focus-month"),
  focusCards: document.querySelector("#focus-cards"),
  projectSummary: document.querySelector("#project-summary"),
  overheadNote: document.querySelector("#overhead-note"),
  monthlyTableBody: document.querySelector("#monthly-table-body"),
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
  bindEvents();
  syncFormsFromState();
  render();
}

function bindEvents() {
  ui.settingsForm.addEventListener("submit", handleSettingsSubmit);
  ui.projectForm.addEventListener("submit", handleProjectSubmit);
  ui.costForm.addEventListener("submit", handleCostSubmit);
  ui.focusMonth.addEventListener("change", render);
  ui.projectCancel.addEventListener("click", resetProjectForm);
  ui.costCancel.addEventListener("click", resetCostForm);
  ui.projectList.addEventListener("click", handleProjectListClick);
  ui.costList.addEventListener("click", handleCostListClick);
  ui.resetDemo.addEventListener("click", handleResetDemo);
}

function handleSettingsSubmit(event) {
  event.preventDefault();
  const data = new FormData(ui.settingsForm);
  const nextSettings = {
    planningStartMonth: data.get("planningStartMonth"),
    monthsToShow: clampNumber(Number(data.get("monthsToShow")), 3, 24),
    karinOpeningBalance: Number(data.get("karinOpeningBalance")),
    harmenOpeningBalance: Number(data.get("harmenOpeningBalance")),
  };

  state.settings = nextSettings;
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
    monthlyRevenue: Number(data.get("monthlyRevenue")),
    owner: data.get("owner"),
    startMonth: data.get("startMonth"),
    endMonth: data.get("endMonth") || "",
    notes: String(data.get("notes")).trim(),
  };

  if (!project.name) {
    window.alert("Geef een projectnaam op.");
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
    owner: data.get("owner"),
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
  if (!window.confirm("Voorbeelddata herstellen? Je huidige invoer wordt overschreven.")) {
    return;
  }

  state = createDefaultState();
  resetProjectForm();
  resetCostForm();
  saveState();
  syncFormsFromState();
  render();
}

function render() {
  populateProjectSelect();
  renderProjectList();
  renderCostList();

  const monthlyRows = buildMonthlyRows();
  ensureFocusMonth(monthlyRows);
  renderFocusCards(monthlyRows);
  renderProjectSummary();
  renderMonthlyTable(monthlyRows);
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
            `<option value="${project.id}">${escapeHtml(project.name)}</option>`
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

function renderProjectList() {
  if (!state.projects.length) {
    ui.projectList.innerHTML =
      '<div class="empty-state">Nog geen projecten toegevoegd.</div>';
    return;
  }

  ui.projectList.innerHTML = state.projects
    .slice()
    .sort((left, right) => left.startMonth.localeCompare(right.startMonth))
    .map((project) => {
      const ownerLabel = ownerToLabel(project.owner);
      const duration = formatMonthRange(project.startMonth, project.endMonth);
      const noteLine = project.notes
        ? `<p>${escapeHtml(project.notes)}</p>`
        : "";

      return `
        <article class="entry">
          <div>
            <h3>${escapeHtml(project.name)}</h3>
            <p>${ownerLabel} · ${formatCurrency(project.monthlyRevenue)} per maand · ${duration}</p>
            ${noteLine}
          </div>
          <div class="entry-actions">
            <button class="small-button" type="button" data-action="edit" data-id="${project.id}">Bewerk</button>
            <button class="small-button" type="button" data-action="delete" data-id="${project.id}">Verwijder</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCostList() {
  if (!state.recurringCosts.length) {
    ui.costList.innerHTML =
      '<div class="empty-state">Nog geen terugkerende kosten toegevoegd.</div>';
    return;
  }

  ui.costList.innerHTML = state.recurringCosts
    .slice()
    .sort((left, right) => left.startMonth.localeCompare(right.startMonth))
    .map((cost) => {
      const projectName = cost.projectId ? lookupProjectName(cost.projectId) : "Algemene kosten";
      const duration = formatMonthRange(cost.startMonth, cost.endMonth);

      return `
        <article class="entry">
          <div>
            <h3>${escapeHtml(cost.label)}</h3>
            <p>${ownerToLabel(cost.owner)} · ${formatCurrency(cost.amount)} per maand · ${escapeHtml(projectName)}</p>
            <p>${duration}</p>
          </div>
          <div class="entry-actions">
            <button class="small-button" type="button" data-action="edit" data-id="${cost.id}">Bewerk</button>
            <button class="small-button" type="button" data-action="delete" data-id="${cost.id}">Verwijder</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderFocusCards(monthlyRows) {
  const focusMonth = ui.focusMonth.value;
  const row = monthlyRows.find((item) => item.month === focusMonth);
  if (!row) {
    ui.focusCards.innerHTML =
      '<div class="empty-state">Geen maandgegevens beschikbaar voor deze selectie.</div>';
    return;
  }

  const cards = [
    {
      title: "Karin",
      opening: row.karinOpening,
      revenue: row.karinRevenue,
      costs: row.karinCosts,
      net: row.karinNet,
      closing: row.karinClosing,
    },
    {
      title: "Harmen",
      opening: row.harmenOpening,
      revenue: row.harmenRevenue,
      costs: row.harmenCosts,
      net: row.harmenNet,
      closing: row.harmenClosing,
    },
    {
      title: "Samen",
      opening: row.karinOpening + row.harmenOpening,
      revenue: row.karinRevenue + row.harmenRevenue,
      costs: row.karinCosts + row.harmenCosts,
      net: row.karinNet + row.harmenNet,
      closing: row.combinedClosing,
    },
  ];

  ui.focusCards.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card">
          <h3>${card.title}</h3>
          <div class="summary-grid">
            <div class="metric">
              <span>Begin</span>
              <strong>${formatCurrency(card.opening)}</strong>
            </div>
            <div class="metric">
              <span>Omzet</span>
              <strong>${formatCurrency(card.revenue)}</strong>
            </div>
            <div class="metric">
              <span>Kosten</span>
              <strong>${formatCurrency(card.costs)}</strong>
            </div>
            <div class="metric">
              <span>Netto</span>
              <strong class="${card.net >= 0 ? "positive" : "negative"}">${formatCurrency(card.net)}</strong>
            </div>
            <div class="metric">
              <span>Eindstand</span>
              <strong class="${card.closing >= 0 ? "positive" : "negative"}">${formatCurrency(card.closing)}</strong>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderProjectSummary() {
  const focusMonth = ui.focusMonth.value;
  const activeProjects = state.projects
    .filter((project) => isActiveInMonth(project, focusMonth))
    .map((project) => {
      const linkedCosts = state.recurringCosts
        .filter((cost) => cost.projectId === project.id && isActiveInMonth(cost, focusMonth))
        .reduce((sum, cost) => sum + Number(cost.amount), 0);

      return {
        ...project,
        linkedCosts,
        net: Number(project.monthlyRevenue) - linkedCosts,
      };
    })
    .sort((left, right) => right.net - left.net);

  const overhead = state.recurringCosts
    .filter((cost) => !cost.projectId && isActiveInMonth(cost, focusMonth))
    .reduce((sum, cost) => sum + Number(cost.amount), 0);

  ui.overheadNote.textContent = overhead
    ? `Algemene kosten in ${formatMonth(focusMonth)}: ${formatCurrency(overhead)}`
    : `Geen algemene kosten in ${formatMonth(focusMonth)}.`;

  if (!activeProjects.length) {
    ui.projectSummary.innerHTML =
      '<div class="empty-state">Geen actieve projecten in deze maand.</div>';
    return;
  }

  ui.projectSummary.innerHTML = activeProjects
    .map(
      (project) => `
        <article class="project-card">
          <div class="pill">${ownerToLabel(project.owner)}</div>
          <h3>${escapeHtml(project.name)}</h3>
          <div class="project-metrics">
            <div class="metric">
              <span>Omzet</span>
              <strong>${formatCurrency(project.monthlyRevenue)}</strong>
            </div>
            <div class="metric">
              <span>Gekoppelde kosten</span>
              <strong>${formatCurrency(project.linkedCosts)}</strong>
            </div>
            <div class="metric">
              <span>Saldo</span>
              <strong class="${project.net >= 0 ? "positive" : "negative"}">${formatCurrency(project.net)}</strong>
            </div>
            <div class="metric">
              <span>Looptijd</span>
              <strong>${formatMonthRange(project.startMonth, project.endMonth)}</strong>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderMonthlyTable(monthlyRows) {
  ui.monthlyTableBody.innerHTML = monthlyRows
    .map(
      (row) => `
        <tr>
          <td>${formatMonth(row.month)}</td>
          <td>${formatCurrency(row.karinRevenue)}</td>
          <td>${formatCurrency(row.karinCosts)}</td>
          <td class="${row.karinClosing >= 0 ? "positive" : "negative"}">${formatCurrency(row.karinClosing)}</td>
          <td>${formatCurrency(row.harmenRevenue)}</td>
          <td>${formatCurrency(row.harmenCosts)}</td>
          <td class="${row.harmenClosing >= 0 ? "positive" : "negative"}">${formatCurrency(row.harmenClosing)}</td>
          <td class="${row.combinedClosing >= 0 ? "positive" : "negative"}">${formatCurrency(row.combinedClosing)}</td>
        </tr>
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
    const harmenOpening =
      index === 0 ? Number(state.settings.harmenOpeningBalance) : harmenClosing;

    const karinRevenue = state.projects
      .filter((project) => isActiveInMonth(project, month))
      .reduce((sum, project) => sum + splitByOwner(project.monthlyRevenue, project.owner).karin, 0);
    const harmenRevenue = state.projects
      .filter((project) => isActiveInMonth(project, month))
      .reduce((sum, project) => sum + splitByOwner(project.monthlyRevenue, project.owner).harmen, 0);

    const karinCosts = state.recurringCosts
      .filter((cost) => isActiveInMonth(cost, month))
      .reduce((sum, cost) => sum + splitByOwner(cost.amount, cost.owner).karin, 0);
    const harmenCosts = state.recurringCosts
      .filter((cost) => isActiveInMonth(cost, month))
      .reduce((sum, cost) => sum + splitByOwner(cost.amount, cost.owner).harmen, 0);

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
      combinedClosing: karinClosing + harmenClosing,
    };
  });
}

function ensureFocusMonth(monthlyRows) {
  if (!monthlyRows.length) {
    return;
  }

  const availableMonths = monthlyRows.map((row) => row.month);
  if (!availableMonths.includes(ui.focusMonth.value)) {
    ui.focusMonth.value = availableMonths[0];
  }
}

function fillProjectForm(project) {
  ui.projectForm.elements.name.value = project.name;
  ui.projectForm.elements.monthlyRevenue.value = project.monthlyRevenue;
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
  ui.projectForm.elements.startMonth.value = state.settings.planningStartMonth;
  ui.projectForm.elements.owner.value = "karin";
  ui.projectSubmit.textContent = "Project opslaan";
  ui.projectCancel.hidden = true;
}

function resetCostForm() {
  editingCostId = null;
  ui.costForm.reset();
  ui.costForm.elements.startMonth.value = state.settings.planningStartMonth;
  ui.costForm.elements.owner.value = "karin";
  ui.costProjectSelect.value = "";
  ui.costSubmit.textContent = "Kosten opslaan";
  ui.costCancel.hidden = true;
}

function syncFormsFromState() {
  ui.settingsForm.elements.planningStartMonth.value = state.settings.planningStartMonth;
  ui.settingsForm.elements.monthsToShow.value = state.settings.monthsToShow;
  ui.settingsForm.elements.karinOpeningBalance.value = state.settings.karinOpeningBalance;
  ui.settingsForm.elements.harmenOpeningBalance.value = state.settings.harmenOpeningBalance;
  ui.focusMonth.value = ui.focusMonth.value || state.settings.planningStartMonth;
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
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${nextMonth}`;
}

function formatMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    month: "long",
    year: "numeric",
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

function lookupProjectName(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  return project ? project.name : "Project niet gevonden";
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn("Kon opgeslagen dashboarddata niet laden, voorbeelddata wordt gebruikt.", error);
    return createDefaultState();
  }
}

function normalizeState(rawState) {
  const defaults = createDefaultState();
  const settings = rawState && rawState.settings ? rawState.settings : {};

  return {
    settings: {
      planningStartMonth:
        settings.planningStartMonth || defaults.settings.planningStartMonth,
      monthsToShow: clampNumber(
        numberOrDefault(settings.monthsToShow, defaults.settings.monthsToShow),
        3,
        24
      ),
      karinOpeningBalance: numberOrDefault(
        settings.karinOpeningBalance,
        defaults.settings.karinOpeningBalance
      ),
      harmenOpeningBalance: numberOrDefault(
        settings.harmenOpeningBalance,
        defaults.settings.harmenOpeningBalance
      ),
    },
    projects: Array.isArray(rawState?.projects)
      ? rawState.projects.map((project) => ({
          id: project.id || createId(),
          name: project.name || "",
          monthlyRevenue: Number(project.monthlyRevenue) || 0,
          owner: ["karin", "harmen", "shared"].includes(project.owner)
            ? project.owner
            : "karin",
          startMonth: project.startMonth || defaults.settings.planningStartMonth,
          endMonth: project.endMonth || "",
          notes: project.notes || "",
        }))
      : defaults.projects,
    recurringCosts: Array.isArray(rawState?.recurringCosts)
      ? rawState.recurringCosts.map((cost) => ({
          id: cost.id || createId(),
          label: cost.label || "",
          amount: Number(cost.amount) || 0,
          owner: ["karin", "harmen", "shared"].includes(cost.owner)
            ? cost.owner
            : "karin",
          projectId: cost.projectId || "",
          startMonth: cost.startMonth || defaults.settings.planningStartMonth,
          endMonth: cost.endMonth || "",
        }))
      : defaults.recurringCosts,
  };
}

function createDefaultState() {
  const planningStartMonth = currentMonth();

  return {
    settings: {
      planningStartMonth,
      monthsToShow: 12,
      karinOpeningBalance: 14000,
      harmenOpeningBalance: 9000,
    },
    projects: [
      {
        id: "project-avans",
        name: "Avans sprint",
        monthlyRevenue: 6200,
        owner: "karin",
        startMonth: planningStartMonth,
        endMonth: addMonths(planningStartMonth, 4),
        notes: "Voorbeeldproject. Pas dit gerust aan.",
      },
      {
        id: "project-workshop",
        name: "Workshop traject",
        monthlyRevenue: 3600,
        owner: "harmen",
        startMonth: planningStartMonth,
        endMonth: addMonths(planningStartMonth, 2),
        notes: "Voorbeeldproject voor Harmen.",
      },
      {
        id: "project-lab",
        name: "Innovatie lab",
        monthlyRevenue: 4800,
        owner: "shared",
        startMonth: addMonths(planningStartMonth, 1),
        endMonth: addMonths(planningStartMonth, 5),
        notes: "Voorbeeldproject dat 50/50 verdeeld wordt.",
      },
    ],
    recurringCosts: [
      {
        id: "cost-tools",
        label: "Tools en software",
        amount: 180,
        owner: "shared",
        projectId: "",
        startMonth: planningStartMonth,
        endMonth: "",
      },
      {
        id: "cost-avans",
        label: "Reis- en locatiekosten",
        amount: 240,
        owner: "karin",
        projectId: "project-avans",
        startMonth: planningStartMonth,
        endMonth: addMonths(planningStartMonth, 4),
      },
      {
        id: "cost-workshop",
        label: "Ondersteuning delivery",
        amount: 420,
        owner: "harmen",
        projectId: "project-workshop",
        startMonth: planningStartMonth,
        endMonth: addMonths(planningStartMonth, 2),
      },
      {
        id: "cost-admin",
        label: "Administratie",
        amount: 300,
        owner: "shared",
        projectId: "",
        startMonth: planningStartMonth,
        endMonth: "",
      },
    ],
  };
}

function currentMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function numberOrDefault(value, fallback) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
