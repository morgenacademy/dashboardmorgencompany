#!/usr/bin/env node
// Regressietest: onleesbare PDF's (Google Drive-placeholders) mogen nooit een
// project, factuurregel of seed-verwijdering opleveren.
//
//   node scripts/test-sync-unreadable.mjs
//
// Bouwt een tijdelijke Acquisitie-map, draait de sync ertegen en controleert de
// uitvoer. De live-abort-test raakt Supabase niet (die breekt af vóór het netwerk).
// De dry-run-test doet read-only GETs naar Supabase en schrijft niets.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYNC = join(__dirname, 'sync-acquisitie.mjs');
const FIX = join(tmpdir(), 'acq-sync-fixture');

// ---------- fixture ----------
function textToPdf(text, outPath) {
  const txt = `${outPath}.txt`;
  writeFileSync(txt, text, 'utf8');
  const r = spawnSync('cupsfilter', [txt], { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout?.length) {
    throw new Error(`cupsfilter faalde voor ${outPath} (nodig om een test-PDF te maken)`);
  }
  writeFileSync(outPath, r.stdout);
  rmSync(txt, { force: true });
}

function buildFixture() {
  rmSync(FIX, { recursive: true, force: true });

  // 1) Geldige offerte → moet gewoon een project opleveren.
  const offerteDir = join(FIX, '1. Pending', '260101 Testklant Widget');
  mkdirSync(offerteDir, { recursive: true });
  textToPdf(
    'Offerte Testklant\n\nBouwen van een widget.\n\nTotaal excl. btw   € 1.000,00\n',
    join(offerteDir, '260101 Testklant - Widget offerte.pdf'),
  );

  // 2) Klantmap met alleen een onleesbare PDF → map volledig overslaan.
  //    Vroeger werd dit "Onbekend: 999" (prj_acq_202601).
  const kapotDir = join(FIX, '5. Betaald', 'Kapotte Klant');
  mkdirSync(kapotDir, { recursive: true });
  writeFileSync(join(kapotDir, '202601-999.pdf'), 'dit is geen pdf, maar een Drive-placeholder', 'utf8');

  // 3) Klantmap met 1 leesbare + 1 onleesbare factuur → factuurtotaal is incompleet,
  //    dus deze klant mag NOOIT als "gedekt" gelden (anders sneuvelt z'n seed-regel).
  const halfDir = join(FIX, '5. Betaald', 'Halve Klant');
  mkdirSync(halfDir, { recursive: true });
  textToPdf(
    'Factuur\n\nFactuurnummer 202601-001\nFactuurdatum 05-01-2026\n\nOmschrijving\nTestdienst\n\nBTW 21% over € 100,00     € 21,00\nFactuurbedrag € 121,00\n',
    join(halfDir, '202601-001.pdf'),
  );
  writeFileSync(join(halfDir, '202601-002.pdf'), 'ook geen pdf', 'utf8');
}

// ---------- runner ----------
function runSync(args) {
  const r = spawnSync('node', [SYNC, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ACQ_DIR: FIX },
    maxBuffer: 20 * 1024 * 1024,
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok || !detail ? '' : `\n      → ${detail}`}`);
};

console.log('\n🧪 sync-acquisitie: onleesbare PDF-regressietest\n');
if (!existsSync(SYNC)) { console.error(`Niet gevonden: ${SYNC}`); process.exit(1); }
buildFixture();

// --- Test A: live-run breekt af, raakt Supabase niet ---
console.log('A. live-run met onleesbare bestanden');
{
  const { code, out } = runSync([]);
  check('exit code 1', code === 1, `kreeg ${code}`);
  check('meldt afbreken', /Live-run afgebroken/.test(out));
  check('noemt het onleesbare bestand', /202601-999\.pdf/.test(out));
  check('schrijft niets (geen upsert-uitvoer)', !/upsert|geschreven|aangemaakt/i.test(out));
}

// --- Test B: dry-run rapporteert netjes, verzint niets ---
console.log('\nB. dry-run');
{
  const { code, out } = runSync(['--dry']);
  check('exit code 0', code === 0, `kreeg ${code}`);
  check('GEEN verzonnen "Onbekend:"-project', !/Onbekend:/.test(out), 'regressie: onleesbare PDF werd weer een offerte');
  check('geen prj_acq_202601 aangemaakt', !/prj_acq_202601/.test(out));
  check('meldt onleesbare bestanden', /onleesbaar/i.test(out));
  check('noemt 202601-999.pdf', /202601-999\.pdf/.test(out));
  check('waarschuwt dat live afbreekt', /live-run breekt af/i.test(out));

  // geldige offerte moet gewoon verwerkt zijn
  check('geldige offerte levert project op', /prj_acq_260101/.test(out));
  check('bedrag uit geldige offerte gelezen', /1\.000/.test(out));

  // partiële dekking: klant met één onleesbare factuur mag geen seeds verliezen
  check('klant met halve facturen niet "gedekt"', /seed-regels blijven staan/i.test(out));
  check('geen seed-regels te vervangen', /0 seed-regel\(s\) te vervangen/.test(out));
}

rmSync(FIX, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? '✖' : '✔'} ${results.length - failed.length}/${results.length} checks geslaagd\n`);
process.exit(failed.length ? 1 : 0);
