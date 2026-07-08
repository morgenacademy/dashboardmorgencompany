#!/usr/bin/env node
// Acquisitie-map → dashboard (Supabase) sync.
// De Drive-map is leidend; dit script leest 'm en schrijft naar Supabase.
// Zie docs/superpowers/specs/2026-06-16-acquisitie-dashboard-sync-design.md
//
// Gebruik:
//   node scripts/sync-acquisitie.mjs --dry   # toon wat er zou gebeuren, schrijf niets
//   node scripts/sync-acquisitie.mjs         # schrijf naar Supabase
//   node scripts/sync-acquisitie.mjs --force # schrijf ook als er onleesbare PDF's zijn
//
// Vereist: `pdftotext` (brew install poppler) voor bedrag-extractie.
//
// Let op: Google Drive File Stream houdt bestanden soms als placeholder (metadata
// aanwezig, inhoud niet lokaal). Zulke PDF's worden overgeslagen, nooit geraden, en
// een live-run breekt af tenzij --force. Zie pdfText().

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, extname, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- Config ----------
const ACQ_DIR = process.env.ACQ_DIR || '/Users/harmen/Library/CloudStorage/GoogleDrive-harmenvanheist@gmail.com/.shortcut-targets-by-id/1Vw5smxKTXbsiD2UZrq2pGtgM71Fa57aP/Morgen Academy/Acquisitie';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jeqvjtnxgxpjviwhjmzr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_uO70RUh9JTZZEykA_mUyzw_hyMNfi7-';
const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');

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

// pdftotext klaagt op stderr maar geeft exit 0 als een bestand geen echte PDF is
// (Drive-placeholder: metadata aanwezig, inhoud niet lokaal). Lege output zou dan
// stilletjes als "offerte zonder bedrag" doorgaan → verzonnen projecten.
const PDF_BROKEN_RE = /may not be a pdf file|couldn't find trailer dictionary|couldn't read xref/i;

// Onleesbare bestanden, verzameld tijdens de run. Eén regel per bestand.
const UNREADABLE = [];

const _pdfCache = new Map();
// Geeft de PDF-tekst terug, of null als het bestand onleesbaar is. null !== ''.
// Bellers MOETEN op null controleren en het bestand dan volledig overslaan.
function pdfText(file) {
  if (_pdfCache.has(file)) return _pdfCache.get(file);
  // Timeout: een lokale PDF parseert in milliseconden. Blijft pdftotext hangen, dan
  // wacht het op een Drive-download die er niet komt → als onleesbaar behandelen.
  const res = spawnSync('pdftotext', ['-layout', file, '-'], {
    encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 8_000,
  });
  let text = null, reason = '';
  if (res.error) reason = res.error.code === 'ETIMEDOUT' ? 'timeout bij lezen (Drive niet lokaal?)' : res.error.message;
  else if (res.status !== 0) reason = `pdftotext exit ${res.status}`;
  else if (PDF_BROKEN_RE.test(res.stderr || '')) reason = 'geen geldige PDF-inhoud (Drive niet lokaal?)';
  else if (!/[A-Za-z0-9]/.test(res.stdout || '')) reason = 'geen tekst in PDF';
  else text = res.stdout;

  if (text === null) UNREADABLE.push({ file, reason });
  _pdfCache.set(file, text);
  return text;
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

// ---------- Facturen (map 4./5. = klant-mappen met factuur-PDF's) ----------
// Klant-mapnaam → bestaand customer-id, voor namen die niet tekstueel matchen.
const CLIENT_ALIAS = {
  'vereniging logistiek management': 'cus_vml',
  'michielpro': 'cus_pinkroccade', // factuur via MichielPro = PinkRoccade-deal
};

function normName(s) {
  return String(s).toLowerCase().replace(/\bb\.?\s*v\.?\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function pdfIsInvoice(text) { return /factuurdatum|factuurnummer|factuur\s+\d{6}-\d{3}/i.test(text); }
function pdfIsOfferte(text) { return /\bofferte\b|\bvoorstel\b/i.test(text); }

// Type van een submap: 'offerte' (offerte-PDF, oude conventie) of 'invoice'
// (klant-map met facturen). Offerte heeft voorrang (bv. SoloSolis Vertaling).
// Geeft 'unreadable' als de map wél PDF's heeft maar geen enkele leesbaar is; dan
// mag er niets uit afgeleid worden (anders wordt een factuur een spookofferte).
function classifyFolder(subPath, files) {
  let hasInv = false, hasOff = false, readable = 0, pdfs = 0;
  for (const f of files) {
    if (extname(f).toLowerCase() !== '.pdf') continue;
    pdfs++;
    const t = pdfText(join(subPath, f));
    if (t === null) continue; // onleesbaar → negeren, niet raden
    readable++;
    if (pdfIsOfferte(t)) hasOff = true;
    if (pdfIsInvoice(t)) hasInv = true;
  }
  if (pdfs && !readable) return 'unreadable';
  if (hasOff) return 'offerte';
  if (hasInv) return 'invoice';
  return 'offerte';
}

function parseInvoice(text) {
  const num = (text.match(/Factuur\s+(\d{6}-\d{3})/i) || [])[1] || null;
  const lines = text.split(/\r?\n/);
  let ex = null;
  for (const l of lines) if (/subtotaal|totaal ex/i.test(l)) { const a = parseEuro(l); if (a) ex = a; }
  // "BTW 21% over € X" → X is de ex-btw basis (werkt voor beide factuur-formaten).
  if (ex == null) { const m = text.match(/btw\s*\d+\s*%\s*over\s*(€\s*[\d.]+,\d{2})/i); if (m) ex = parseEuro(m[1]); }
  if (ex == null) for (const l of lines) if (/totaal incl|factuurbedrag/i.test(l)) { const a = parseEuro(l); if (a) ex = a; }
  const dm = text.match(/Factuurdatum\s+(\d{2})-(\d{2})-(\d{4})/i);
  const date = dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : null;
  let desc = '';
  const oi = lines.findIndex((l) => /Omschrijving/i.test(l));
  if (oi >= 0 && lines[oi + 1]) desc = lines[oi + 1].replace(/\s{2,}.*$/, '').replace(/\s+/g, ' ').trim();
  return { num, ex, date, desc };
}

// Verwerk de factuur-mappen in 4./5. → factuurregels op bestaande projecten.
function buildInvoiceRecords(existingCustomers, existingProjects) {
  const custByNorm = {};
  for (const c of existingCustomers) custByNorm[normName(c.name)] = c;
  const projByCust = {};
  for (const p of existingProjects) (projByCust[p.customer_id] ||= []).push(p);

  const invoices = [], flags = [], newCustomers = [], newProjects = [];
  const seenCust = new Set(existingCustomers.map((c) => c.id));
  // Klanten waarvan minstens één factuur onleesbaar was: hun factuurtotaal is
  // per definitie incompleet, dus hun seed-regels mogen NOOIT vervangen worden.
  const custWithUnreadable = new Set();

  for (const statusDir of listDirs(ACQ_DIR)) {
    if (!statusDir.startsWith('4.') && !statusDir.startsWith('5.')) continue;
    const payment = paymentForFolder(statusDir);
    const statusPath = join(ACQ_DIR, statusDir);
    for (const sub of listDirs(statusPath)) {
      const subPath = join(statusPath, sub);
      const files = listFiles(subPath);
      if (classifyFolder(subPath, files) !== 'invoice') continue;

      const clientRaw = sub.replace(/^\d{6}\s*-?\s*/, '').replace(/\s*-?\s*invoice\b.*$/i, '').replace(/morgenacademy/i, '').trim();
      const aliasId = CLIENT_ALIAS[normName(clientRaw)];
      const cust = aliasId ? existingCustomers.find((c) => c.id === aliasId) : custByNorm[normName(clientRaw)];

      let customer_id;
      if (cust) customer_id = cust.id;
      else {
        customer_id = `cus_${slugify(clientRaw)}`;
        if (!seenCust.has(customer_id)) { seenCust.add(customer_id); newCustomers.push({ id: customer_id, name: clientRaw, type: 'klant', industry: '' }); }
      }

      const projs = projByCust[customer_id] || [];
      let project_id;
      if (projs.length === 1) project_id = projs[0].id;
      else if (projs.length > 1) { flags.push(`${clientRaw}: ${projs.length} projecten — facturen NIET auto-verwerkt (handmatig reconcileren)`); continue; }
      else {
        project_id = `prj_${slugify(clientRaw)}`;
        if (!newProjects.find((p) => p.id === project_id)) newProjects.push({ id: project_id, customer_id, name: `${clientRaw}: dienst`, pipeline_status: 'afgerond', owner: 'Karin' });
      }

      for (const f of files) {
        if (extname(f).toLowerCase() !== '.pdf') continue;
        const t = pdfText(join(subPath, f));
        if (t === null) { custWithUnreadable.add(customer_id); continue; } // nooit een bedrag raden
        if (!pdfIsInvoice(t)) continue;
        const inf = parseInvoice(t);
        const key = inf.num || slugify(basename(f, extname(f)));
        invoices.push({
          finId: `fin_acq_${key}`,
          customer_id, project_id, payment,
          amount: inf.ex || 0,
          date: inf.date || folderDate(sub) || folderDate(f),
          num: inf.num || key,
          desc: inf.desc,
          owner: /harmen van heist/i.test(t) ? 'Harmen' : 'Karin', // factuur-afzender
          client: cust ? cust.name : clientRaw,
          sourceFile: `${statusDir}/${sub}/${f}`,
        });
        if (inf.ex == null) flags.push(`geen bedrag uit factuur: ${f}`);
      }
    }
  }
  return { invoices, flags, newCustomers, newProjects, custWithUnreadable };
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
      const kind = classifyFolder(subPath, files);
      // Geen enkele leesbare PDF → niets afleiden, geen project aanmaken.
      if (kind === 'unreadable') { flags.push(`onleesbare PDF('s), map overgeslagen: ${statusDir}/${sub}`); continue; }
      // Factuur-mappen (klant-map met facturen) in 4./5. → buildInvoiceRecords.
      if ((statusDir.startsWith('4.') || statusDir.startsWith('5.')) && kind === 'invoice') continue;
      // Onleesbare PDF's nooit als offerte gebruiken.
      const offertes = chooseOffertePdfs(files).filter((f) => pdfText(join(subPath, f)) !== null);
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

  // Fail fast: buildRecords() heeft elke PDF al aangeraakt, dus onleesbare bestanden
  // zijn nu bekend. Bij een live-run stoppen we vóór we Supabase ook maar aanraken.
  if (!DRY && UNREADABLE.length && !FORCE) {
    console.error(`\n✖ Live-run afgebroken: ${UNREADABLE.length} bestand(en) onleesbaar, de bron is incompleet.`);
    for (const u of UNREADABLE) console.error(`   - ${relative(ACQ_DIR, u.file)} — ${u.reason}`);
    console.error(`\n  Maak ze lokaal beschikbaar (Google Drive → rechtsklik map → "Download now") en draai opnieuw.`);
    console.error(`  Of forceer bewust: node scripts/sync-acquisitie.mjs --force\n`);
    process.exitCode = 1;
    return;
  }

  // Bestaande data ophalen (nodig voor factuur-matching + seed-reconciliatie).
  const existingCustomers = await sb('customers?select=id,name,type');
  const existingProjects = await sb('projects?select=id,customer_id,name');
  const existingFinance = await sb('finance_entries?select=id,project_id,payment_status,amount,type');

  const { invoices, flags: invFlags, newCustomers: invNewCustomers, newProjects: invNewProjects, custWithUnreadable } = buildInvoiceRecords(existingCustomers, existingProjects);

  // Seed finance-regels die vervangen worden door Karin's facturen: income met
  // status gefactureerd/ontvangen, op een project van een klant die nu facturen
  // heeft, en niet zelf door de sync beheerd (fin_acq_*). Forecast (verwacht) blijft.
  const projToCust = Object.fromEntries(existingProjects.map((p) => [p.id, p.customer_id]));
  // Alleen klanten met een succesvol geparseerd factuurtotaal > 0 én zonder ook maar
  // één onleesbare factuur. Anders zou bv. Unbeatable PT (1 leesbare factuur €270 +
  // 1 onleesbare €516,46) als "gedekt" gelden en z'n seed-regel van €786 verliezen.
  const invTotalByCust = {};
  for (const i of invoices) invTotalByCust[i.customer_id] = (invTotalByCust[i.customer_id] || 0) + i.amount;
  const coveredCustomers = new Set(
    Object.entries(invTotalByCust).filter(([c, t]) => t > 0 && !custWithUnreadable.has(c)).map(([c]) => c),
  );
  const skippedCovered = [...custWithUnreadable].filter((c) => (invTotalByCust[c] || 0) > 0);
  const seedDelete = existingFinance.filter((f) =>
    f.type === 'income' &&
    ['gefactureerd', 'ontvangen'].includes(f.payment_status) &&
    !String(f.id).startsWith('fin_acq_') &&
    coveredCustomers.has(projToCust[f.project_id]),
  );

  // ===== Overzicht: offertes =====
  const byStatus = {};
  for (const r of records) (byStatus[r.pipeline_status] ||= []).push(r);
  for (const [status, items] of Object.entries(byStatus)) {
    console.log(`── ${status} (${items.length})`);
    for (const r of items) {
      const amt = r.forecast_amount ? `€${r.forecast_amount.toLocaleString('nl-NL')}` : '—';
      console.log(`   ${r.id.padEnd(22)} ${r.name.slice(0, 44).padEnd(44)} ${amt.padStart(9)}`);
    }
  }

  // ===== Overzicht: facturen (map 4./5.) =====
  const custName = Object.fromEntries(existingCustomers.map((c) => [c.id, c.name]));
  for (const nc of invNewCustomers) custName[nc.id] = nc.name;
  const invByClient = {};
  for (const i of invoices) (invByClient[i.customer_id] ||= []).push(i);
  if (invoices.length) {
    console.log(`\n── Facturen (map 4./5.)`);
    for (const [cid, items] of Object.entries(invByClient)) {
      const isNew = invNewCustomers.some((c) => c.id === cid);
      const total = items.reduce((s, i) => s + i.amount, 0);
      console.log(`   ${custName[cid] || cid}${isNew ? ' (NIEUWE klant)' : ''} — €${total.toLocaleString('nl-NL')}`);
      for (const i of items) console.log(`      ${i.payment.padEnd(12)} ${('€' + i.amount.toLocaleString('nl-NL')).padStart(11)}  ${i.num}  ${(i.desc || '').slice(0, 28)}`);
    }
  }
  if (invNewProjects.length) console.log(`\n── Nieuwe projecten: ${invNewProjects.map((p) => p.name).join(', ')}`);

  // ===== Seed-regels die vervangen worden =====
  if (seedDelete.length) {
    console.log(`\n── Seed finance-regels die VERWIJDERD worden (vervangen door facturen):`);
    for (const f of seedDelete) console.log(`   - ${String(f.id).padEnd(26)} ${f.payment_status.padEnd(12)} €${Number(f.amount).toLocaleString('nl-NL')}  [${projToCust[f.project_id]}]`);
  }

  const unreadableFlags = UNREADABLE.map((u) => `onleesbaar (${u.reason}): ${relative(ACQ_DIR, u.file)}`);
  const coveredFlags = skippedCovered.map(
    (c) => `${custName[c] || c}: factuur(en) onleesbaar → seed-regels blijven staan (totaal onbetrouwbaar)`,
  );
  const allFlags = [...flags, ...invFlags, ...unreadableFlags, ...coveredFlags];
  if (allFlags.length) { console.log(`\n⚑ Aandacht:`); for (const f of allFlags) console.log(`   - ${f}`); }

  const finPlan = records.filter((r) => r.payment && !r.aliased); // offerte-folders in 4./5.

  if (DRY) {
    const skipped = UNREADABLE.length ? ` · ${UNREADABLE.length} onleesbaar overgeslagen` : '';
    console.log(`\nDRY: ${records.length} offertes · ${invoices.length} facturen · ${invNewCustomers.length} nieuwe klant(en) · ${seedDelete.length} seed-regel(s) te vervangen${skipped}. Niets geschreven.\n`);
    if (UNREADABLE.length) console.log(`⚠ Bron is incompleet — een live-run breekt af tenzij je --force geeft.\n`);
    return;
  }

  // ===== LIVE =====
  // Onleesbare bestanden = incomplete bron. Niet stilzwijgend doorschrijven.
  if (UNREADABLE.length && !FORCE) {
    console.error(`\n✖ Live-run afgebroken: ${UNREADABLE.length} bestand(en) onleesbaar (zie ⚑ hierboven).`);
    console.error(`  Maak ze lokaal beschikbaar (Google Drive → rechtsklik map → "Download now") en draai opnieuw.`);
    console.error(`  Weet je zeker dat het veilig is? Dan: node scripts/sync-acquisitie.mjs --force\n`);
    process.exitCode = 1;
    return;
  }
  if (UNREADABLE.length && FORCE) {
    console.warn(`\n⚠ --force: ${UNREADABLE.length} onleesbaar bestand(en) genegeerd. Totalen kunnen incompleet zijn.\n`);
  }
  const haveCust = new Set(existingCustomers.map((c) => c.id));
  const newCustomers = [], seen = new Set();
  const addCust = (c, note) => { if (c && !haveCust.has(c.id) && !seen.has(c.id)) { seen.add(c.id); newCustomers.push({ id: c.id, name: c.name, type: c.type || 'klant', industry: c.industry || '', status: 'active', notes: note }); } };
  for (const r of records) addCust(r.customerObj, 'Aangemaakt door acquisitie-sync.');
  for (const c of invNewCustomers) addCust(c, 'Aangemaakt door acquisitie-sync (factuur).');
  if (newCustomers.length) { await sb('customers', { method: 'POST', body: newCustomers, prefer: 'resolution=merge-duplicates,return=minimal' }); console.log(`\n➕ ${newCustomers.length} klant(en): ${newCustomers.map((c) => c.name).join(', ')}`); }

  // Offerte-projecten: bestaand → status patchen; nieuw → insert. + nieuwe factuur-projecten.
  const ids = [...new Set(records.map((r) => r.id))];
  const existIds = new Set((ids.length ? await sb(`projects?select=id&id=in.(${ids.join(',')})`) : []).map((p) => p.id));
  const toInsert = [];
  let patched = 0;
  for (const r of records) {
    if (existIds.has(r.id)) { await sb(`projects?id=eq.${r.id}`, { method: 'PATCH', body: { pipeline_status: r.pipeline_status }, prefer: 'return=minimal' }); patched++; }
    else toInsert.push({ id: r.id, customer_id: r.customer_id, name: r.name, description: '', pipeline_status: r.pipeline_status, product_type: r.product_type, service_label: 'other', forecast_amount: r.forecast_amount || 0, actual_amount: 0, value_amount: r.forecast_amount || 0, pricing_model: 'project', priority: 'medium', owner: r.owner || 'Harmen', lead_source: 'netwerk', is_breakthrough: false, estimated_hours: 0, start_date: r.date || null, accepted_date: r.pipeline_status === 'geaccepteerd' ? (r.date || null) : null, next_action: '', next_action_date: null });
  }
  for (const p of invNewProjects) toInsert.push({ id: p.id, customer_id: p.customer_id, name: p.name, description: '', pipeline_status: p.pipeline_status, product_type: 'other', service_label: 'other', forecast_amount: 0, actual_amount: 0, value_amount: 0, pricing_model: 'project', priority: 'medium', owner: p.owner || 'Karin', lead_source: 'netwerk', is_breakthrough: false, estimated_hours: 0, start_date: null, accepted_date: null, next_action: '', next_action_date: null });
  if (toInsert.length) await sb('projects', { method: 'POST', body: toInsert, prefer: 'resolution=merge-duplicates,return=minimal' });

  // Factuurregels schrijven — ADDITIEF EERST, vóór de destructieve seed-delete,
  // zodat een schrijf-fout nooit data wist zonder vervanging.
  const offerteFin = finPlan.map((r) => ({ id: `fin_acq_${r.id}`, date: r.date || '2026-01-01', type: 'income', description: `Offerte ${r.name}`, amount: r.forecast_amount || 0, category: '', vendor: r.customerObj?.name || '', project_id: r.id, recurring: 'one_off', source: 'invoice', owner: r.owner || 'Harmen', entity: 'Morgen', factuur_status: '', payment_status: r.payment }));
  const invoiceFin = invoices.filter((i) => i.amount > 0).map((i) => ({ id: i.finId, date: i.date || '2026-01-01', type: 'income', description: `Factuur ${i.num}${i.desc ? ' — ' + i.desc : ''}`, amount: i.amount || 0, category: '', vendor: i.client, project_id: i.project_id, recurring: 'one_off', source: 'invoice', owner: i.owner || 'Karin', entity: 'Morgen', factuur_status: '', payment_status: i.payment }));
  const allFin = [...offerteFin, ...invoiceFin];
  if (allFin.length) await sb('finance_entries', { method: 'POST', body: allFin, prefer: 'resolution=merge-duplicates,return=minimal' });

  // Pas dáárna de seed-regels verwijderen (nu vervangen door bovenstaande facturen).
  for (const f of seedDelete) await sb(`finance_entries?id=eq.${encodeURIComponent(f.id)}`, { method: 'DELETE', prefer: 'return=minimal' });

  console.log(`\n✅ Klaar: ${toInsert.length} project(en) nieuw, ${patched} status-patch, ${allFin.length} factuurregel(s), ${seedDelete.length} seed verwijderd.\n`);
}

main().catch((e) => { console.error('\n❌ Sync mislukt:', e.message, '\n'); process.exit(1); });
