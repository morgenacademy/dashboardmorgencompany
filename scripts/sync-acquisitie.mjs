#!/usr/bin/env node
// Acquisitie-map → dashboard (Supabase) sync.
// De Drive-map is leidend; dit script leest 'm en schrijft naar Supabase.
// Zie docs/superpowers/specs/2026-06-16-acquisitie-dashboard-sync-design.md
//
// Gebruik:
//   node scripts/sync-acquisitie.mjs --dry   # toon wat er zou gebeuren, schrijf niets
//   node scripts/sync-acquisitie.mjs         # schrijf naar Supabase
//
// Vereist: `pdftotext` (brew install poppler) voor bedrag-extractie.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- Config ----------
const ACQ_DIR = process.env.ACQ_DIR || '/Users/harmen/Library/CloudStorage/GoogleDrive-harmenvanheist@gmail.com/.shortcut-targets-by-id/1Vw5smxKTXbsiD2UZrq2pGtgM71Fa57aP/Morgen Academy/Acquisitie';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jeqvjtnxgxpjviwhjmzr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_uO70RUh9JTZZEykA_mUyzw_hyMNfi7-';
const DRY = process.argv.includes('--dry');

// Statusmap-prefix → pipeline_status.
const STATUS_BY_PREFIX = [
  ['1.', 'offerte_verzonden'], // 1. Pending
  ['2.', 'geaccepteerd'],      // 2. Geaccepteerd
  ['3.', 'verloren'],          // 3. Afgewezen
  ['4.', 'afgerond'],          // 4. Gefactureerd
  ['5.', 'afgerond'],          // 5. Betaald
];

// Statusmap-prefix → finance payment_status. De map 4./5. laat de sync een
// factuurregel (income) schrijven, zodat het bord + Finance over de hele
// levensloop kloppen. null = geen finance.
const PAYMENT_BY_PREFIX = [
  ['4.', 'gefactureerd'], // 4. Gefactureerd → wacht op betaling
  ['5.', 'ontvangen'],    // 5. Betaald → ontvangen
];

// Bekende klanten: gedetecteerd via substring in map-/bestandsnaam.
// Wink&See bestaat nog niet in Supabase en wordt aangemaakt.
const KNOWN_CLIENTS = [
  { id: 'cus_winksee',     name: 'Wink&See',        type: 'klant',    industry: 'E-commerce / retail', match: [/wink\s*&?\s*see/i] },
  { id: 'cus_gem_tilburg', name: 'Gemeente Tilburg', type: 'prospect', industry: 'Overheid',            match: [/tilburg/i] },
  { id: 'cus_solosolis',   name: 'Solo Solis',       type: 'klant',    industry: 'E-commerce / retail', match: [/solo\s*solis/i] },
];

// Mappen die volledig overgeslagen worden (zelden nodig — alias heeft voorkeur).
const SKIP_FOLDERS = [];

// Folder-offerte → bestaand (handmatig) project-id. Voorkomt dubbels met
// projecten die al taken/finance/historie hebben: de sync update die rij
// (status volgt de map) i.p.v. een parallelle prj_acq_*-rij te maken.
const ID_ALIAS = {
  prj_acq_260518: 'prj_tilburg_voorlopers', // Voorlopersprogramma — heeft al 8 taken
  prj_acq_160604: 'prj_tilburg_keynote',    // Keynote OR — heeft al 1 taak
  prj_acq_260406: 'prj_solosolis_vert',     // Vertaalflow — bestaand, €6.000 + historie
  prj_acq_2607002: 'prj_solosolis_stock',   // Binnenkomende voorraad = bestaand 'pending stock in admin panel'
};

// Per-offerte correcties (bedrag/naam/klant). Gevuld voor de backfill.
let OVERRIDES = {};
const overridesPath = join(__dirname, 'acquisitie-overrides.json');
if (existsSync(overridesPath)) {
  try { OVERRIDES = JSON.parse(readFileSync(overridesPath, 'utf8')); }
  catch (e) { console.warn('⚠ overrides.json onleesbaar:', e.message); }
}

// ---------- Helpers ----------
function statusForFolder(name) {
  for (const [prefix, status] of STATUS_BY_PREFIX) if (name.startsWith(prefix)) return status;
  return null; // Archive e.d. → overslaan
}

function paymentForFolder(name) {
  for (const [prefix, pay] of PAYMENT_BY_PREFIX) if (name.startsWith(prefix)) return pay;
  return null;
}

function pdfText(file) {
  try {
    return execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  } catch {
    return '';
  }
}

// Parse Nederlands bedrag "€ 2.000,00" / "€ 10.500" → number.
function parseEuro(s) {
  const m = String(s).match(/€\s*-?\s*([\d.]+(?:,\d{1,2})?)/);
  if (!m) return null;
  const num = m[1].replace(/\./g, '').replace(',', '.');
  const v = Number(num);
  return Number.isFinite(v) ? v : null;
}

// Headline-bedrag uit een offerte: anker op een "Totaal"-regel (eenmalig/excl btw eerst).
function extractAmount(text) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const totaalIdx = [];
  lines.forEach((l, i) => { if (/totaal/i.test(l)) totaalIdx.push(i); });
  if (!totaalIdx.length) return null;
  // Voorkeur: excl. btw / eenmalig eerst; "incl. BTW" als laatste redmiddel (bruto).
  const ranked = totaalIdx.sort((a, b) => {
    const score = (i) => (/eenmalig|excl/i.test(lines[i]) ? 0 : /incl/i.test(lines[i]) ? 2 : 1);
    return score(a) - score(b);
  });
  for (const i of ranked) {
    // Bedrag op dezelfde regel of de eerstvolgende twee regels.
    for (let j = i; j <= i + 2 && j < lines.length; j++) {
      const amt = parseEuro(lines[j]);
      if (amt && amt > 0) return amt;
    }
  }
  return null;
}

function detectClient(haystack) {
  for (const c of KNOWN_CLIENTS) if (c.match.some((re) => re.test(haystack))) return c;
  return null;
}

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

function folderDate(folderName) {
  const m = folderName.match(/^(\d{2})(\d{2})(\d{2})/); // JJMMDD
  if (!m) return null;
  return `20${m[1]}-${m[2]}-${m[3]}`;
}

function deriveTitle(fileBase, clientName) {
  let t = fileBase
    .replace(/^\d{6,7}\s*/, '')             // nummer-prefix
    .replace(/\boffertes?\b/i, '')
    .replace(/\bvoorstel\b/i, '');
  if (clientName) {
    t = t.replace(new RegExp(clientName.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&'), 'i'), '');
    if (clientName === 'Solo Solis') t = t.replace(/solosolis/i, '');
  }
  t = t.replace(/morgen academy/i, '').replace(/\s*[-–:]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return t || 'Offerte';
}

function guessProductType(s) {
  if (/keynote|training|programma|sessie|workshop|cursus|lab/i.test(s)) return 'training';
  if (/automat|flow|order|voorraad|klantenservice|check|foto|vertaal/i.test(s)) return 'automatisering';
  return 'other';
}

// ---------- Map scannen ----------
function listDirs(p) {
  return readdirSync(p).filter((n) => !n.startsWith('.') && statSync(join(p, n)).isDirectory());
}
function listFiles(p) {
  return readdirSync(p).filter((n) => !n.startsWith('.') && statSync(join(p, n)).isFile());
}

// Kies de offerte-PDF's in een submap.
function chooseOffertePdfs(files) {
  const pdfs = files.filter((f) => extname(f).toLowerCase() === '.pdf' && !/invoice|factuur/i.test(f));
  const withOfferte = pdfs.filter((f) => /offerte/i.test(f));
  return withOfferte.length ? withOfferte : pdfs;
}

function buildRecords() {
  const records = [];
  const flags = [];
  const usedIds = new Set();

  for (const statusDir of listDirs(ACQ_DIR)) {
    const pipeline_status = statusForFolder(statusDir);
    if (!pipeline_status) continue;
    const payment = paymentForFolder(statusDir);
    const statusPath = join(ACQ_DIR, statusDir);

    for (const sub of listDirs(statusPath)) {
      if (SKIP_FOLDERS.some((s) => sub.includes(s))) { flags.push(`skip (al in dashboard): ${sub}`); continue; }
      const subPath = join(statusPath, sub);
      const files = listFiles(subPath);
      const offertes = chooseOffertePdfs(files);
      if (!offertes.length) { flags.push(`geen offerte-PDF in: ${statusDir}/${sub}`); continue; }
      if (offertes.length > 1) flags.push(`${offertes.length} offertes in: ${statusDir}/${sub} (per PDF gesplitst)`);

      for (const file of offertes) {
        const fileBase = basename(file, extname(file));
        const hay = `${sub} ${fileBase}`;
        const client = detectClient(hay);
        const clientName = client ? client.name : (fileBase.replace(/^\d{6,7}\s*/, '').split(/\s*[-–]\s*/)[0].trim() || 'Onbekend');
        const customer_id = client ? client.id : `cus_${slugify(clientName)}`;
        const date = folderDate(sub) || folderDate(fileBase);
        const title = deriveTitle(fileBase, clientName);
        const idToken = (fileBase.match(/^(\d{6,7})/) || [])[1] || slugify(`${date || ''}_${title}`);
        let baseId = `prj_acq_${idToken}`;
        while (usedIds.has(baseId)) baseId = `${baseId}_x`;
        usedIds.add(baseId);
        const id = ID_ALIAS[baseId] || baseId; // bestaand project hergebruiken indien gealiast

        const fullPath = join(subPath, file);
        const amount = extractAmount(pdfText(fullPath));
        if (amount == null) flags.push(`geen bedrag uit PDF: ${file}`);

        const rec = {
          id,
          aliased: id !== baseId,
          customer_id,
          customerObj: client || { id: customer_id, name: clientName, type: 'prospect', industry: '' },
          name: `${clientName}: ${title}`,
          pipeline_status,
          payment,
          product_type: guessProductType(hay),
          forecast_amount: amount || 0,
          date,
          sourceFile: `${statusDir}/${sub}/${file}`,
        };
        // Overrides toepassen (op de acq-basis-id, vóór alias).
        Object.assign(rec, OVERRIDES[baseId] || {});
        records.push(rec);
      }
    }
  }
  return { records, flags };
}

// ---------- Supabase REST ----------
async function sb(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log(`\n📂 Acquisitie-sync ${DRY ? '(DRY RUN — schrijft niets)' : ''}`);
  console.log(`   bron: ${ACQ_DIR}\n`);

  const { records, flags } = buildRecords();

  // Toon overzicht.
  const byStatus = {};
  for (const r of records) (byStatus[r.pipeline_status] ||= []).push(r);
  for (const [status, items] of Object.entries(byStatus)) {
    console.log(`── ${status} (${items.length})`);
    for (const r of items) {
      const amt = r.forecast_amount ? `€${r.forecast_amount.toLocaleString('nl-NL')}` : '—';
      console.log(`   ${r.id.padEnd(20)} ${r.name.slice(0, 48).padEnd(48)} ${amt.padStart(9)}  [${r.customer_id}]`);
    }
  }
  if (flags.length) {
    console.log(`\n⚑ Aandacht:`);
    for (const f of flags) console.log(`   - ${f}`);
  }

  const finPlan = records.filter((r) => r.payment && !r.aliased);
  const finSkip = records.filter((r) => r.payment && r.aliased);
  if (finPlan.length || finSkip.length) {
    console.log(`\n── Finance (factuurregels uit map 4./5.)`);
    for (const r of finPlan) console.log(`   + fin_acq_${r.id.padEnd(18)} ${r.payment.padEnd(12)} €${(r.forecast_amount || 0).toLocaleString('nl-NL')}  ${r.name}`);
    for (const r of finSkip) console.log(`   · ${r.name} → handmatig in Finance (gealiast project)`);
  }

  if (DRY) { console.log(`\n${records.length} offertes (dry run, niets geschreven).\n`); return; }

  // 1) Klanten zorgen (alleen ontbrekende toevoegen).
  const existingCustomers = await sb('customers?select=id');
  const haveCust = new Set(existingCustomers.map((c) => c.id));
  const newCustomers = [];
  const seenNew = new Set();
  for (const r of records) {
    const c = r.customerObj;
    if (!haveCust.has(c.id) && !seenNew.has(c.id)) {
      seenNew.add(c.id);
      newCustomers.push({ id: c.id, name: c.name, type: c.type || 'prospect', industry: c.industry || '', status: 'active', notes: 'Aangemaakt door acquisitie-sync.' });
    }
  }
  if (newCustomers.length) {
    await sb('customers', { method: 'POST', body: newCustomers, prefer: 'resolution=merge-duplicates,return=minimal' });
    console.log(`\n➕ ${newCustomers.length} klant(en) aangemaakt: ${newCustomers.map((c) => c.name).join(', ')}`);
  }

  // 2) Bestaande projecten (per id) → status patchen; nieuwe → volledig inserten.
  const ids = [...new Set(records.map((r) => r.id))];
  const existingProjects = ids.length ? await sb(`projects?select=id&id=in.(${ids.join(',')})`) : [];
  const haveProj = new Set(existingProjects.map((p) => p.id));

  const toInsert = [];
  let patched = 0;
  for (const r of records) {
    if (haveProj.has(r.id)) {
      // Respecteer handmatige correcties: alleen status volgt de map.
      await sb(`projects?id=eq.${r.id}`, { method: 'PATCH', body: { pipeline_status: r.pipeline_status }, prefer: 'return=minimal' });
      patched++;
    } else {
      toInsert.push({
        id: r.id,
        customer_id: r.customer_id,
        name: r.name,
        description: '',
        pipeline_status: r.pipeline_status,
        product_type: r.product_type,
        service_label: 'other',
        forecast_amount: r.forecast_amount || 0,
        actual_amount: 0,
        value_amount: r.forecast_amount || 0,
        pricing_model: 'project',
        priority: 'medium',
        owner: r.owner || 'Harmen',
        lead_source: 'netwerk',
        is_breakthrough: false,
        estimated_hours: 0,
        start_date: r.date || null,
        accepted_date: r.pipeline_status === 'geaccepteerd' ? (r.date || null) : null,
        next_action: '',
        next_action_date: null,
      });
    }
  }
  if (toInsert.length) {
    await sb('projects', { method: 'POST', body: toInsert, prefer: 'resolution=merge-duplicates,return=minimal' });
  }

  // 3) Finance: niet-gealiaste offertes in map 4./5. krijgen een factuurregel
  // (income), idempotent op een deterministische id. Gealiaste/legacy projecten
  // beheren hun finance zelf en worden overgeslagen (geen dubbeltelling).
  const finRows = records
    .filter((r) => r.payment && !r.aliased)
    .map((r) => ({
      id: `fin_acq_${r.id}`,
      date: r.date || null,
      type: 'income',
      description: `Offerte ${r.name}`,
      amount: r.forecast_amount || 0,
      category: '',
      vendor: r.customerObj?.name || '',
      project_id: r.id,
      recurring: 'one_off',
      source: 'invoice', // toegestane waarde; fin_acq_-id markeert sync-beheer
      owner: r.owner || 'Harmen',
      entity: 'Morgen',
      factuur_status: '',
      payment_status: r.payment,
    }));
  if (finRows.length) {
    await sb('finance_entries', { method: 'POST', body: finRows, prefer: 'resolution=merge-duplicates,return=minimal' });
  }

  console.log(`\n✅ Klaar: ${toInsert.length} nieuw, ${patched} bijgewerkt (status), ${finRows.length} factuurregel(s), ${records.length} totaal.\n`);
}

main().catch((e) => { console.error('\n❌ Sync mislukt:', e.message, '\n'); process.exit(1); });
