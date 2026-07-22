import assert from 'node:assert/strict';
import {
  actualExpenseEntries,
  buildActualVendorRows,
  buildExpenseForecast,
  buildFinanceMonthlySeries,
} from '../src/finance-model.js';

const expense = (date, vendor, amount, source = 'bank_export', owner = 'Harmen', recurring = 'monthly') => ({
  id: `${vendor}-${date}-${amount}`,
  date,
  vendor,
  description: vendor,
  amount,
  category: 'Software/SaaS',
  recurring,
  owner,
  entity: owner,
  type: 'expense',
  source,
});

const entries = [
  expense('2026-01-03', 'Airtable', 209.01),
  expense('2026-04-03', 'Airtable', 42.54),
  expense('2026-06-03', 'Airtable', 42.14),
  expense('2026-04-30', 'Anthropic', 153.25),
  expense('2026-05-31', 'Anthropic', 90),
  expense('2026-06-30', 'Anthropic', 90),
  expense('2026-06-08', 'Lovable', 4.42),
  expense('2026-06-16', 'Lovable', 17.62),
  expense('2026-04-01', 'Coolblue', 46.99, 'bank_export', 'Harmen', 'one_off'),
  expense('2026-01-01', 'Karin vast', 50, 'manual', 'Karin'),
];

const actualRows = buildActualVendorRows(entries, { personFilter: 'harmen' });
const anthropicActual = actualRows.find((row) => row.vendor === 'Anthropic');
const airtableActual = actualRows.find((row) => row.vendor === 'Airtable');
assert.equal(anthropicActual.byMonth['05'], 90);
assert.equal(anthropicActual.byMonth['06'], 90);
assert.equal(airtableActual.byMonth['04'], 42.54);
assert.equal(airtableActual.byMonth['06'], 42.14);
assert.equal(actualRows.find((row) => row.vendor === 'Karin vast'), undefined);

const forecast = buildExpenseForecast(entries, {
  year: '2026',
  today: new Date(2026, 6, 22),
  personFilter: 'totaal',
});
assert.equal(forecast.baseMonth, '2026-06');
assert.equal(forecast.forecastStartMonth, '2026-08');
assert.deepEqual(forecast.futureMonths, ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
assert.equal(forecast.rows.find((row) => row.vendor === 'Anthropic').monthlyAmount, 90);
assert.equal(forecast.rows.find((row) => row.vendor === 'Airtable').monthlyAmount, 42.14);
assert.equal(forecast.rows.find((row) => row.vendor === 'Lovable').monthlyAmount, 22.04);
assert.equal(forecast.rows.find((row) => row.vendor === 'Karin vast').monthlyAmount, 50);
assert.equal(forecast.rows.find((row) => row.vendor === 'Coolblue'), undefined);
assert.equal(forecast.rows.find((row) => row.vendor === 'Anthropic').byMonth['07'], undefined);
assert.equal(forecast.rows.find((row) => row.vendor === 'Anthropic').byMonth['08'], 90);

assert.equal(actualExpenseEntries(entries).some((entry) => entry.vendor === 'Karin vast'), false);

const series = buildFinanceMonthlySeries(entries, { year: '2026', today: new Date(2026, 6, 22) });
assert.equal(series.months.find((month) => month.month === '2026-01').expense, 209.01);
assert.equal(series.months.find((month) => month.month === '2026-05').expense, 90);
assert.equal(series.months.find((month) => month.month === '2026-06').expense, 42.14 + 90 + 4.42 + 17.62);
assert.equal(series.months.find((month) => month.month === '2026-07').expense, 0);
assert.equal(series.months.find((month) => month.month === '2026-08').expense, 42.14 + 90 + 4.42 + 17.62 + 50);

console.log('finance-model: actual en prognose zijn correct gescheiden');
