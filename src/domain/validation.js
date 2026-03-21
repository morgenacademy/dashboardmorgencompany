export const entityDefinitions = {
  customers: {
    prefix: 'cus',
    required: ['name', 'type', 'status'],
    fields: ['name', 'type', 'industry', 'status', 'ownerId', 'createdAt'],
  },
  products: {
    prefix: 'prd',
    required: ['name', 'platform', 'category', 'status'],
    fields: ['name', 'platform', 'category', 'subcategory', 'status', 'isCommercial', 'pricingModel', 'defaultInternalHourlyCost', 'description'],
  },
  deliveries: {
    prefix: 'del',
    required: ['customerId', 'productId', 'date', 'amount', 'status'],
    fields: ['customerId', 'productId', 'date', 'status', 'amount', 'directCost', 'quantity', 'notes'],
  },
  effortLogs: {
    prefix: 'eff',
    required: ['deliveryId', 'customerId', 'productId', 'date', 'hours'],
    fields: ['deliveryId', 'customerId', 'productId', 'date', 'hours', 'role'],
  },
  reviews: {
    prefix: 'rev',
    required: ['deliveryId', 'customerId', 'productId', 'date', 'rating'],
    fields: ['deliveryId', 'customerId', 'productId', 'date', 'rating', 'nps', 'recommendationScore', 'comment'],
  },
};

const numericFields = new Set(['amount', 'directCost', 'quantity', 'hours', 'rating', 'nps', 'recommendationScore', 'defaultInternalHourlyCost']);
const booleanFields = new Set(['isCommercial']);

export function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).filter(Boolean);
  if (!rows.length) return [];
  const headers = rows[0].split(',').map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const values = row.split(',');
    return headers.reduce((record, header, index) => {
      record[header] = values[index]?.trim() || '';
      return record;
    }, {});
  });
}

export function normalizeRecord(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => {
    if (numericFields.has(key)) return [key, Number(value || 0)];
    if (booleanFields.has(key)) return [key, value === true || value === 'true'];
    return [key, value];
  }));
}

export function validateRecord(table, record) {
  const definition = entityDefinitions[table];
  const missing = definition.required.filter((field) => !String(record[field] ?? '').trim());
  return {
    valid: missing.length === 0,
    missing,
  };
}
