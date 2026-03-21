import { seedData } from './seed.js';

const STORAGE_KEY = 'companydashboard-db-v1';
const listeners = new Set();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function persisted() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getDatabase() {
  if (typeof localStorage === 'undefined') return clone(seedData);
  const current = persisted();
  if (current) return current;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
  return clone(seedData);
}

export function saveDatabase(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  listeners.forEach((listener) => listener(getDatabase()));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetDatabase() {
  saveDatabase(clone(seedData));
}

export function upsertRecord(table, record) {
  const db = getDatabase();
  const items = db[table] || [];
  const existingIndex = items.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    items[existingIndex] = record;
  } else {
    items.push(record);
  }
  db[table] = items;
  saveDatabase(db);
}

export function importRecords(table, records, mode = 'append') {
  const db = getDatabase();
  db[table] = mode === 'replace' ? records : [...db[table], ...records];
  saveDatabase(db);
}

export function nextId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
