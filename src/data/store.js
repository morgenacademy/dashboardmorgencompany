import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = 'https://jeqvjtnxgxpjviwhjmzr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_uO70RUh9JTZZEykA_mUyzw_hyMNfi7-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const listeners = new Set();
let cache = {
  customers: [],
  projects: [],
  tasks: [],
  finance: [],
  loading: true,
  error: null,
};

export function getDatabase() {
  return cache;
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(cache);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((listener) => listener(cache));
}

export async function loadAll() {
  cache = { ...cache, loading: true, error: null };
  emit();
  try {
    const [customers, projects, tasks, finance] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('finance_entries').select('*').order('date', { ascending: false }),
    ]);
    const firstError = [customers, projects, tasks, finance].find((r) => r.error)?.error;
    if (firstError) throw firstError;
    cache = {
      customers: customers.data || [],
      projects: projects.data || [],
      tasks: tasks.data || [],
      finance: finance.data || [],
      loading: false,
      error: null,
    };
  } catch (error) {
    cache = { ...cache, loading: false, error: error.message || String(error) };
  }
  emit();
}

export async function upsertProject(project) {
  const { error } = await supabase.from('projects').upsert(project);
  if (error) throw error;
  await loadAll();
}

export async function deleteProject(id) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
  await loadAll();
}

export async function upsertTask(task) {
  const payload = { ...task };
  if (payload.status === 'done' && !payload.completed_at) payload.completed_at = new Date().toISOString();
  if (payload.status !== 'done') payload.completed_at = null;
  const { error } = await supabase.from('tasks').upsert(payload);
  if (error) throw error;
  await loadAll();
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
  await loadAll();
}

export async function upsertCustomer(customer) {
  const { error } = await supabase.from('customers').upsert(customer);
  if (error) throw error;
  await loadAll();
}

export async function upsertFinance(entry) {
  const { error } = await supabase.from('finance_entries').upsert(entry);
  if (error) throw error;
  await loadAll();
}

export function nextId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
