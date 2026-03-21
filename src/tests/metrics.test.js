import test from 'node:test';
import assert from 'node:assert/strict';
import { seedData } from '../data/seed.js';
import { buildDashboard, calculateHealthScore, detectSignals, safeDivide } from '../domain/metrics.js';

test('safeDivide beschermt tegen delen door nul', () => {
  assert.equal(safeDivide(10, 0), 0);
  assert.equal(safeDivide(10, 2), 5);
});

test('buildDashboard berekent omzet per uur en repeat rate uit seeddata', () => {
  const dashboard = buildDashboard(seedData, { startDate: '2025-01-01', endDate: '2025-12-31' });
  assert.equal(Math.round(dashboard.overview.totalRevenue), 593100);
  assert.equal(Math.round(dashboard.overview.totalHours), 2486);
  assert.equal(Math.round(dashboard.overview.revenuePerHour), 239);
  assert.equal(Math.round(dashboard.overview.repeatRate * 100), 60);
});

test('product metrics markeren revenue-per-hour winnaars en risicoproposities', () => {
  const dashboard = buildDashboard(seedData, { startDate: '2025-01-01', endDate: '2025-12-31' });
  const speaking = dashboard.products.find((product) => product.id === 'prd_speaking');
  const copilot = dashboard.products.find((product) => product.id === 'prd_custom_copilot');
  assert.ok(speaking.metrics.signals.some((signal) => signal.key === 'best-revenue-per-hour'));
  assert.ok(copilot.metrics.signals.some((signal) => signal.key === 'high-revenue-low-satisfaction'));
  assert.ok(copilot.metrics.signals.some((signal) => signal.key === 'at-risk'));
});

test('health score gebruikt uitlegbare wegingen', () => {
  const score = calculateHealthScore(
    { revenue: 80000, avgRating: 4.7, repeatRate: 0.8, revenuePerHour: 280, revenueTrend: 0.2 },
    { maxRevenue: 100000, maxRevenuePerHour: 300 },
    seedData.metricConfig,
  );
  assert.equal(score, 81);
});

test('detectSignals vangt high hours / low satisfaction combinaties', () => {
  const signals = detectSignals({ revenue: 70000, hours: 300, avgRating: 3.9, revenuePerHour: 233, avgNps: 12, repeatRate: 0.25 }, seedData.metricConfig);
  assert.ok(signals.some((signal) => signal.key === 'high-revenue-low-satisfaction'));
  assert.ok(signals.some((signal) => signal.key === 'low-satisfaction-high-hours'));
  assert.ok(signals.some((signal) => signal.key === 'at-risk'));
});
