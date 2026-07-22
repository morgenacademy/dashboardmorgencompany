export function financeMonthKeys(year) {
  const value = String(year || '');
  if (!/^\d{4}$/.test(value)) return [];
  return Array.from({ length: 12 }, (_, index) => `${value}-${String(index + 1).padStart(2, '0')}`);
}

export function localMonthKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function previousMonthKey(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(monthKey || '')) return '';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return localMonthKey(date);
}

function nextMonthKey(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(monthKey || '')) return '';
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month, 1);
  return localMonthKey(date);
}

function vendorName(entry) {
  return entry.vendor || entry.description || '—';
}

function matchesPerson(entry, personFilter = 'totaal') {
  const person = String(personFilter || 'totaal').toLowerCase();
  if (person === 'totaal') return true;
  return String(entry.owner || '').toLowerCase().includes(person);
}

export function isExpenseForecastTemplate(entry) {
  return entry.type === 'expense' && entry.recurring === 'monthly' && entry.source === 'manual';
}

export function actualExpenseEntries(entries) {
  return entries.filter((entry) => entry.type === 'expense' && !isExpenseForecastTemplate(entry));
}

export function buildActualVendorRows(entries, { personFilter = 'totaal' } = {}) {
  const rowsByVendor = {};
  for (const entry of entries) {
    if (!entry.date || !matchesPerson(entry, personFilter) || isExpenseForecastTemplate(entry)) continue;
    const month = entry.date.slice(5, 7);
    if (!/^\d{2}$/.test(month)) continue;
    const vendor = vendorName(entry);
    rowsByVendor[vendor] ||= { vendor, category: entry.category || '', total: 0, byMonth: {} };
    const row = rowsByVendor[vendor];
    const amount = Number(entry.amount || 0);
    row.byMonth[month] = (row.byMonth[month] || 0) + amount;
    row.total += amount;
    if (!row.category && entry.category) row.category = entry.category;
  }
  return Object.values(rowsByVendor).sort((a, b) => b.total - a.total);
}

function buildRecurringRunRateRows(entries, { baseMonth, personFilter = 'totaal', type = 'expense' } = {}) {
  if (!baseMonth) return [];
  const recurring = entries.filter((entry) => (
    entry.type === type &&
    entry.recurring === 'monthly' &&
    entry.date &&
    entry.date.slice(0, 7) <= baseMonth &&
    matchesPerson(entry, personFilter)
  ));

  // Bank exports are transactions: only the complete basis month is representative.
  const transactionRows = recurring.filter((entry) => entry.source === 'bank_export' && entry.date.slice(0, 7) === baseMonth);

  // Other monthly rows are explicit run-rate models. Keep the latest configured
  // row per owner/entity/vendor/project instead of treating every edit as additive.
  const latestModelRows = new Map();
  for (const entry of recurring.filter((item) => item.source !== 'bank_export')) {
    const key = [entry.owner || '', entry.entity || '', vendorName(entry), entry.project_id || ''].join('::');
    const existing = latestModelRows.get(key);
    if (!existing || entry.date >= existing.date) latestModelRows.set(key, entry);
  }

  const rowsByVendor = {};
  const add = (entry, kind) => {
    const vendor = vendorName(entry);
    rowsByVendor[vendor] ||= {
      vendor,
      category: entry.category || '',
      monthlyAmount: 0,
      transactionAmount: 0,
      modelAmount: 0,
    };
    const row = rowsByVendor[vendor];
    const amount = Number(entry.amount || 0);
    row.monthlyAmount += amount;
    row[kind] += amount;
    if (!row.category && entry.category) row.category = entry.category;
  };
  transactionRows.forEach((entry) => add(entry, 'transactionAmount'));
  latestModelRows.forEach((entry) => add(entry, 'modelAmount'));

  return Object.values(rowsByVendor)
    .filter((row) => row.monthlyAmount > 0)
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

export function buildExpenseForecast(entries, { year, today = new Date(), personFilter = 'totaal' } = {}) {
  const selectedYear = String(year || '');
  const currentMonth = localMonthKey(today);
  if (!/^\d{4}$/.test(selectedYear) || currentMonth.slice(0, 4) !== selectedYear) {
    return { baseMonth: '', forecastStartMonth: '', futureMonths: [], rows: [], grandTotal: 0 };
  }

  const baseMonth = previousMonthKey(currentMonth);
  const forecastStartMonth = nextMonthKey(currentMonth);
  const futureMonths = financeMonthKeys(selectedYear).filter((month) => month >= forecastStartMonth);
  if (baseMonth.slice(0, 4) !== selectedYear || !futureMonths.length) {
    return { baseMonth: '', forecastStartMonth: '', futureMonths: [], rows: [], grandTotal: 0 };
  }

  const rows = buildRecurringRunRateRows(entries, { baseMonth, personFilter, type: 'expense' })
    .map((row) => ({
      ...row,
      basis: row.transactionAmount && row.modelAmount
        ? 'laatste maand + vaste regel'
        : row.transactionAmount
          ? 'laatste volledige maand'
          : 'vaste maandregel',
      byMonth: Object.fromEntries(futureMonths.map((month) => [month.slice(5, 7), row.monthlyAmount])),
      total: row.monthlyAmount * futureMonths.length,
    }));

  return {
    baseMonth,
    forecastStartMonth,
    futureMonths,
    rows,
    grandTotal: rows.reduce((sum, row) => sum + row.total, 0),
  };
}

export function buildFinanceMonthlySeries(entries, { year, today = new Date() } = {}) {
  const selectedYear = String(year || '');
  const monthKeys = financeMonthKeys(selectedYear);
  const currentMonth = localMonthKey(today);
  const currentYear = currentMonth.slice(0, 4);
  const isCurrentYear = selectedYear === currentYear;
  const isPastYear = /^\d{4}$/.test(selectedYear) && selectedYear < currentYear;
  const actualThroughMonth = isCurrentYear ? currentMonth : isPastYear ? `${selectedYear}-12` : `${selectedYear}-00`;
  const months = monthKeys.map((month) => ({ month, income: 0, expense: 0, net: 0 }));
  const monthsByKey = Object.fromEntries(months.map((month) => [month.month, month]));

  for (const entry of entries) {
    const monthKey = (entry.date || '').slice(0, 7);
    const month = monthsByKey[monthKey];
    if (!month || monthKey > actualThroughMonth) continue;
    const amount = Number(entry.amount || 0);
    if (!amount) continue;
    if (entry.type === 'expense' && !isExpenseForecastTemplate(entry)) month.expense += amount;
    if (entry.type === 'income' && ['gefactureerd', 'ontvangen'].includes(entry.payment_status)) month.income += amount;
  }

  let baseMonth = '';
  let forecastStartMonth = '';
  if (isCurrentYear) {
    baseMonth = previousMonthKey(currentMonth);
    forecastStartMonth = nextMonthKey(currentMonth);
    if (baseMonth.slice(0, 4) === selectedYear && forecastStartMonth.slice(0, 4) === selectedYear) {
      const expenseRunRate = buildRecurringRunRateRows(entries, { baseMonth, type: 'expense' })
        .reduce((sum, row) => sum + row.monthlyAmount, 0);
      const incomeRunRate = buildRecurringRunRateRows(
        entries.filter((entry) => entry.type !== 'income' || entry.source !== 'bank_export' || ['gefactureerd', 'ontvangen'].includes(entry.payment_status)),
        { baseMonth, type: 'income' },
      ).reduce((sum, row) => sum + row.monthlyAmount, 0);

      for (const month of months.filter((item) => item.month >= forecastStartMonth)) {
        const expectedOneOff = entries
          .filter((entry) => (
            entry.type === 'income' &&
            entry.recurring !== 'monthly' &&
            entry.payment_status === 'verwacht' &&
            (entry.date || '').slice(0, 7) === month.month
          ))
          .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
        month.income = incomeRunRate + expectedOneOff;
        month.expense = expenseRunRate;
      }
    }
  }

  for (const month of months) month.net = month.income - month.expense;
  return { months, actualThroughMonth, baseMonth, forecastStartMonth };
}
