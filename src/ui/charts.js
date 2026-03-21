import { formatCurrency, formatNumber } from '../domain/metrics.js';

function getValue(point, key) {
  return key.split('.').reduce((value, part) => value?.[part], point) || 0;
}

function svg(width, height, content) {
  return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img">${content}</svg>`;
}

export function lineChart(series, key, color = '#2563eb') {
  if (!series.length) return '<div class="empty-state">Geen data in de geselecteerde periode.</div>';
  const width = 620;
  const height = 220;
  const padding = 28;
  const values = series.map((point) => getValue(point, key));
  const max = Math.max(...values, 1);
  const stepX = (width - padding * 2) / Math.max(series.length - 1, 1);
  const points = series.map((point, index) => {
    const x = padding + index * stepX;
    const y = height - padding - (getValue(point, key) / max) * (height - padding * 2);
    return { ...point, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const circles = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}" /><title>${point.label}: ${formatNumber(getValue(point, key), 1)}</title>`).join('');
  const labels = points.map((point) => `<text x="${point.x}" y="${height - 6}" text-anchor="middle" class="chart-label">${point.label}</text>`).join('');
  const grid = [0.25, 0.5, 0.75, 1].map((tick) => {
    const y = height - padding - tick * (height - padding * 2);
    return `<line x1="${padding}" x2="${width - padding}" y1="${y}" y2="${y}" class="chart-grid"></line>`;
  }).join('');
  return svg(width, height, `${grid}<path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>${circles}${labels}`);
}

export function barChart(series, key, color = '#14b8a6', formatter = formatCurrency) {
  if (!series.length) return '<div class="empty-state">Geen data beschikbaar.</div>';
  const width = 620;
  const height = 220;
  const padding = 24;
  const max = Math.max(...series.map((point) => getValue(point, key)), 1);
  const barWidth = Math.min(52, (width - padding * 2) / series.length - 10);
  const gap = ((width - padding * 2) - barWidth * series.length) / Math.max(series.length - 1, 1);
  const bars = series.map((point, index) => {
    const value = getValue(point, key);
    const x = padding + index * (barWidth + gap);
    const barHeight = (value / max) * (height - padding * 2);
    const y = height - padding - barHeight;
    return `<g><rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="10" fill="${color}"></rect><text x="${x + barWidth / 2}" y="${height - 6}" text-anchor="middle" class="chart-label">${point.label}</text><title>${point.label}: ${formatter(value)}</title></g>`;
  }).join('');
  return svg(width, height, bars);
}

export function scatterPlot(points, xKey, yKey, labels) {
  if (!points.length) return '<div class="empty-state">Geen punten om te plotten.</div>';
  const width = 620;
  const height = 280;
  const padding = 34;
  const maxX = Math.max(...points.map((point) => getValue(point, xKey)), 1);
  const maxY = Math.max(...points.map((point) => getValue(point, yKey)), 1);
  const dots = points.map((point) => {
    const x = padding + (getValue(point, xKey) / maxX) * (width - padding * 2);
    const y = height - padding - (getValue(point, yKey) / maxY) * (height - padding * 2);
    const color = point.metrics?.healthScore >= 75 ? '#16a34a' : point.metrics?.healthScore >= 55 ? '#f59e0b' : '#dc2626';
    return `<g><circle cx="${x}" cy="${y}" r="8" fill="${color}" opacity="0.85"></circle><text x="${x + 10}" y="${y - 10}" class="chart-label">${point.name}</text><title>${point.name} · ${labels.x}: ${formatNumber(getValue(point, xKey), 1)} · ${labels.y}: ${formatNumber(getValue(point, yKey), 1)}</title></g>`;
  }).join('');
  const midX = width / 2;
  const midY = height / 2;
  const axes = `<line x1="${padding}" x2="${width - padding}" y1="${height - padding}" y2="${height - padding}" class="chart-grid"></line><line x1="${padding}" x2="${padding}" y1="${padding}" y2="${height - padding}" class="chart-grid"></line><line x1="${midX}" x2="${midX}" y1="${padding}" y2="${height - padding}" class="chart-grid chart-grid-accent"></line><line x1="${padding}" x2="${width - padding}" y1="${midY}" y2="${midY}" class="chart-grid chart-grid-accent"></line><text x="${width / 2}" y="${height - 6}" text-anchor="middle" class="chart-axis">${labels.x}</text><text x="18" y="${height / 2}" class="chart-axis" transform="rotate(-90 18 ${height / 2})">${labels.y}</text>`;
  return svg(width, height, `${axes}${dots}`);
}
