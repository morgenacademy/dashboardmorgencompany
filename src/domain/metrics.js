const monthFormatter = new Intl.DateTimeFormat('nl-NL', { month: 'short', year: '2-digit' });

export function safeDivide(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value || 0);
}

export function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value || 0);
}

export function formatPercent(value, digits = 0) {
  return `${formatNumber((value || 0) * 100, digits)}%`;
}

export function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function uniq(values) {
  return [...new Set(values)];
}

export function getDateBucket(date) {
  return date.slice(0, 7);
}

export function labelMonth(bucket) {
  return monthFormatter.format(new Date(`${bucket}-01T00:00:00Z`));
}

export function sortByDate(items, key = 'date') {
  return [...items].sort((a, b) => a[key].localeCompare(b[key]));
}

export function withinPeriod(date, filters) {
  const afterStart = !filters.startDate || date >= filters.startDate;
  const beforeEnd = !filters.endDate || date <= filters.endDate;
  return afterStart && beforeEnd;
}

export function matchesDimension(entity, filters, productsById, customersById) {
  if (filters.platform && entity.productId && productsById[entity.productId]?.platform !== filters.platform) return false;
  if (filters.category && entity.productId && productsById[entity.productId]?.category !== filters.category) return false;
  if (filters.productId && entity.productId !== filters.productId) return false;
  if (filters.customerId && entity.customerId !== filters.customerId) return false;
  if (filters.customerStatus && entity.customerId && customersById[entity.customerId]?.status !== filters.customerStatus) return false;
  return true;
}

export function applyDeliveryFilters(deliveries, filters, productsById, customersById) {
  return deliveries.filter((delivery) => withinPeriod(delivery.date, filters) && matchesDimension(delivery, filters, productsById, customersById));
}

export function createIndexes(data) {
  return {
    customersById: Object.fromEntries(data.customers.map((customer) => [customer.id, customer])),
    productsById: Object.fromEntries(data.products.map((product) => [product.id, product])),
    deliveriesById: Object.fromEntries(data.deliveries.map((delivery) => [delivery.id, delivery])),
    usersById: Object.fromEntries(data.users.map((user) => [user.id, user])),
  };
}

export function getCommercialProducts(products) {
  return products.filter((product) => product.isCommercial);
}

export function enrichData(data, filters = {}) {
  const indexes = createIndexes(data);
  const commercialProductIds = new Set(getCommercialProducts(data.products).map((product) => product.id));
  const deliveries = applyDeliveryFilters(
    data.deliveries.filter((delivery) => commercialProductIds.has(delivery.productId)),
    filters,
    indexes.productsById,
    indexes.customersById,
  );
  const deliveryIds = new Set(deliveries.map((delivery) => delivery.id));
  const efforts = data.effortLogs.filter((effort) => deliveryIds.has(effort.deliveryId));
  const reviews = data.reviews.filter((review) => deliveryIds.has(review.deliveryId));

  const effortByDelivery = groupBy(efforts, 'deliveryId');
  const reviewByDelivery = groupBy(reviews, 'deliveryId');

  const enrichedDeliveries = deliveries.map((delivery) => {
    const product = indexes.productsById[delivery.productId];
    const customer = indexes.customersById[delivery.customerId];
    const deliveryEfforts = effortByDelivery[delivery.id] || [];
    const deliveryReviews = reviewByDelivery[delivery.id] || [];
    const hours = sum(deliveryEfforts, 'hours');
    const avgRating = average(deliveryReviews.map((review) => review.rating));
    const avgNps = average(deliveryReviews.map((review) => review.nps));
    const internalHourlyCost = product?.defaultInternalHourlyCost || data.metricConfig.internalCostFallback;
    const effortCost = hours * internalHourlyCost;
    const contribution = delivery.amount - delivery.directCost - effortCost;
    return {
      ...delivery,
      customer,
      product,
      hours,
      reviewCount: deliveryReviews.length,
      avgRating,
      avgNps,
      revenuePerHour: safeDivide(delivery.amount, hours),
      hoursPerRevenueEuro: safeDivide(hours, delivery.amount),
      effortCost,
      contribution,
      contributionMargin: safeDivide(contribution, delivery.amount),
      reviews: deliveryReviews,
      efforts: deliveryEfforts,
    };
  });

  return { ...data, ...indexes, deliveries: enrichedDeliveries, effortLogs: efforts, reviews };
}

export function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key];
    groups[value] ||= [];
    groups[value].push(item);
    return groups;
  }, {});
}

export function sum(items, key) {
  return items.reduce((total, item) => total + (item[key] || 0), 0);
}

export function calculateGrowth(current, previous) {
  if (!previous) return current ? 1 : 0;
  return (current - previous) / previous;
}

export function createSeries(deliveries) {
  const buckets = groupBy(sortByDate(deliveries), 'date');
  const monthBuckets = {};
  Object.values(buckets).flat().forEach((delivery) => {
    const bucket = getDateBucket(delivery.date);
    monthBuckets[bucket] ||= { bucket, label: labelMonth(bucket), revenue: 0, hours: 0, ratingValues: [], customers: new Set() };
    monthBuckets[bucket].revenue += delivery.amount;
    monthBuckets[bucket].hours += delivery.hours;
    if (delivery.avgRating) monthBuckets[bucket].ratingValues.push(delivery.avgRating);
    monthBuckets[bucket].customers.add(delivery.customerId);
  });
  return Object.values(monthBuckets)
    .sort((a, b) => a.bucket.localeCompare(b.bucket))
    .map((month) => ({
      bucket: month.bucket,
      label: month.label,
      revenue: month.revenue,
      hours: month.hours,
      avgRating: average(month.ratingValues),
      customerCount: month.customers.size,
      revenuePerHour: safeDivide(month.revenue, month.hours),
    }));
}

function normalize(value, min, max) {
  if (max <= min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function calculateHealthScore(metrics, context, config) {
  const weights = config.healthWeights;
  const revenueScore = normalize(metrics.revenue, 0, context.maxRevenue);
  const qualityScore = normalize(metrics.avgRating, 3.5, 5);
  const repeatScore = normalize(metrics.repeatRate, 0, 1);
  const efficiencyScore = normalize(metrics.revenuePerHour, 80, context.maxRevenuePerHour || 300);
  const trendScore = normalize(metrics.revenueTrend, -0.5, 0.6);
  const score = (
    revenueScore * weights.revenue +
    qualityScore * weights.quality +
    repeatScore * weights.repeat +
    efficiencyScore * weights.efficiency +
    trendScore * weights.trend
  ) * 100;
  return Math.round(score);
}

export function detectSignals(metrics, config) {
  const t = config.thresholds;
  const signals = [];
  if (metrics.revenue >= t.highRevenue && metrics.avgRating && metrics.avgRating <= t.lowSatisfaction) {
    signals.push({ key: 'high-revenue-low-satisfaction', label: 'High revenue / low satisfaction', tone: 'danger' });
  }
  if (metrics.revenue <= t.lowRevenue && metrics.avgRating >= t.highSatisfaction) {
    signals.push({ key: 'low-revenue-high-satisfaction', label: 'Low revenue / high satisfaction', tone: 'info' });
  }
  if (metrics.hours >= t.highHours && metrics.avgRating >= t.highSatisfaction) {
    signals.push({ key: 'high-hours-high-satisfaction', label: 'High hours / high satisfaction', tone: 'warning' });
  }
  if (metrics.hours >= t.highHours && metrics.avgRating && metrics.avgRating <= t.lowSatisfaction) {
    signals.push({ key: 'low-satisfaction-high-hours', label: 'Low satisfaction / high hours', tone: 'danger' });
  }
  if (metrics.revenuePerHour >= t.strongRevenuePerHour) {
    signals.push({ key: 'best-revenue-per-hour', label: 'Best revenue per hour', tone: 'success' });
  }
  if (metrics.avgNps && metrics.avgNps <= t.atRiskNps) {
    signals.push({ key: 'at-risk', label: 'At-risk account / proposition', tone: 'danger' });
  }
  if (metrics.repeatRate >= 0.5 && metrics.avgRating >= t.highSatisfaction) {
    signals.push({ key: 'expansion-candidate', label: 'Expansion candidate', tone: 'success' });
  }
  return signals;
}

export function buildEntityMetrics(entityType, entity, deliveries, allSeries, config) {
  const entityDeliveries = deliveries.filter((delivery) => (entityType === 'customer' ? delivery.customerId === entity.id : delivery.productId === entity.id));
  const revenue = sum(entityDeliveries, 'amount');
  const hours = sum(entityDeliveries, 'hours');
  const reviewValues = entityDeliveries.flatMap((delivery) => delivery.reviews);
  const avgRating = average(reviewValues.map((review) => review.rating));
  const avgNps = average(reviewValues.map((review) => review.nps));
  const customerIds = uniq(entityDeliveries.map((delivery) => delivery.customerId));
  const productIds = uniq(entityDeliveries.map((delivery) => delivery.productId));
  const deliveryCount = entityDeliveries.length;
  const repeatRate = entityType === 'customer'
    ? Number(deliveryCount > 1)
    : safeDivide(entityDeliveries.length - customerIds.length, entityDeliveries.length || 1);
  const series = createSeries(entityDeliveries);
  const revenueTrend = series.length >= 2
    ? calculateGrowth(series.at(-1).revenue, series.at(-2).revenue)
    : 0;
  const metrics = {
    revenue,
    hours,
    deliveryCount,
    customerCount: customerIds.length,
    productCount: productIds.length,
    avgDealValue: safeDivide(revenue, deliveryCount),
    avgHoursPerDelivery: safeDivide(hours, deliveryCount),
    revenuePerHour: safeDivide(revenue, hours),
    hoursPerRevenueEuro: safeDivide(hours, revenue),
    contribution: sum(entityDeliveries, 'contribution'),
    contributionMargin: safeDivide(sum(entityDeliveries, 'contribution'), revenue),
    avgRating,
    avgNps,
    reviewCount: reviewValues.length,
    repeatRate,
    revenueTrend,
    ltv: entityType === 'customer' ? revenue : safeDivide(revenue, customerIds.length),
    series,
  };
  const context = {
    maxRevenue: Math.max(...allSeries.map((item) => item.revenue), revenue, 1),
    maxRevenuePerHour: Math.max(...allSeries.map((item) => item.revenuePerHour || 0), metrics.revenuePerHour, 1),
  };
  return {
    ...metrics,
    healthScore: calculateHealthScore(metrics, context, config),
    signals: detectSignals(metrics, config),
  };
}

export function buildDashboard(data, filters = {}) {
  const enriched = enrichData(data, filters);
  const series = createSeries(enriched.deliveries);
  const previousSeries = series.length >= 2 ? series.at(-2) : null;
  const currentSeries = series.at(-1) || { revenue: 0, customerCount: 0 };

  const overview = {
    totalRevenue: sum(enriched.deliveries, 'amount'),
    totalHours: sum(enriched.deliveries, 'hours'),
    totalCustomers: uniq(enriched.deliveries.map((delivery) => delivery.customerId)).length,
    totalDeliveries: enriched.deliveries.length,
    avgDealValue: safeDivide(sum(enriched.deliveries, 'amount'), enriched.deliveries.length),
    revenuePerHour: safeDivide(sum(enriched.deliveries, 'amount'), sum(enriched.deliveries, 'hours')),
    hoursPerRevenueEuro: safeDivide(sum(enriched.deliveries, 'hours'), sum(enriched.deliveries, 'amount')),
    avgRating: average(enriched.reviews.map((review) => review.rating)),
    avgNps: average(enriched.reviews.map((review) => review.nps)),
    reviewCount: enriched.reviews.length,
    repeatRate: safeDivide(enriched.deliveries.length - uniq(enriched.deliveries.map((delivery) => delivery.customerId)).length, enriched.deliveries.length || 1),
    contribution: sum(enriched.deliveries, 'contribution'),
    contributionMargin: safeDivide(sum(enriched.deliveries, 'contribution'), sum(enriched.deliveries, 'amount')),
    revenueGrowth: calculateGrowth(currentSeries.revenue, previousSeries?.revenue || 0),
    customerGrowth: calculateGrowth(currentSeries.customerCount, previousSeries?.customerCount || 0),
    series,
  };

  const allCustomerBase = enriched.customers.map((customer) => buildEntityMetrics('customer', customer, enriched.deliveries, series, enriched.metricConfig));
  const allProductBase = enriched.products.filter((product) => product.isCommercial).map((product) => buildEntityMetrics('product', product, enriched.deliveries, series, enriched.metricConfig));

  const customers = enriched.customers.map((customer, index) => ({
    ...customer,
    metrics: allCustomerBase[index],
  })).filter((customer) => customer.metrics.deliveryCount > 0);

  const products = enriched.products.filter((product) => product.isCommercial).map((product, index) => ({
    ...product,
    metrics: allProductBase[index],
  })).filter((product) => product.metrics.deliveryCount > 0);

  const topRevenueProduct = [...products].sort((a, b) => b.metrics.revenue - a.metrics.revenue)[0];
  const bestRatedProduct = [...products].sort((a, b) => b.metrics.avgRating - a.metrics.avgRating)[0];
  const bestRevenuePerHour = [...products].sort((a, b) => b.metrics.revenuePerHour - a.metrics.revenuePerHour)[0];
  const atRiskCustomer = [...customers].sort((a, b) => (a.metrics.avgNps || 999) - (b.metrics.avgNps || 999))[0];

  return {
    enriched,
    overview,
    customers,
    products,
    spotlight: { topRevenueProduct, bestRatedProduct, bestRevenuePerHour, atRiskCustomer },
  };
}
