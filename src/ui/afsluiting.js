// Afsluiting voor BV: wat is er namens Morgen binnengekomen en betaald, per
// persoon, en wie maakt per saldo hoeveel over naar wie. Zolang er geen Morgen
// BV is, factureert en betaalt Harmen via Harmen van Heist B.V. en Karin via
// haar eigen onderneming; alles wordt 50/50 gedeeld.
//
// Pure rekenkern (afsluitingModel) + render, zoals analyse.js. Dek rekenregels
// af in scripts/test-afsluiting.mjs.
//
// Grondslag (besloten 25-10-2026):
// - Alles ex btw. Omzet staat al ex btw in finance_entries; bij kosten gaat
//   vat_amount eraf (ontbreekt het veld, dan telt de post als zonder NL-btw).
// - Periode: alles t/m 31-12-2026.
// - Saldo op ontvangen geld; gefactureerd-maar-niet-betaald staat apart.
// - Eerdere onderlinge betalingen (tabel settlements) gaan van het saldo af.

export const PERSONEN = ['Harmen', 'Karin'];
export const PERSOON_LABEL = {
  Harmen: 'Harmen (Harmen van Heist B.V.)',
  Karin: 'Karin (Karin van Tongerlo)',
};
const TOT = '2026-12-31';

const num = (v) => Number(v || 0);
const round2 = (v) => Math.round(v * 100) / 100;

function isForecastTemplate(e) {
  return e.type === 'expense' && e.recurring === 'monthly' && e.source === 'manual';
}

function isGeschat(e) {
  return e.source === 'manual' || /schatting/i.test(e.description || '');
}

function exBtw(e) {
  return num(e.amount) - num(e.vat_amount);
}

function leegPersoon() {
  return {
    binnen: 0, open: 0, uit: 0, btw: 0, netto: 0,
    inkomsten: [], openFacturen: [], kosten: [], kostenPerLeverancier: [],
    geschat: { aantal: 0, bedrag: 0 },
    perJaar: {},
  };
}

function jaar(p, j) {
  p.perJaar[j] ||= { binnen: 0, uit: 0 };
  return p.perJaar[j];
}

export function afsluitingModel(db, { tot = TOT } = {}) {
  const finance = db.finance || [];
  const personen = Object.fromEntries(PERSONEN.map((naam) => [naam, leegPersoon()]));

  for (const e of finance) {
    const p = personen[e.owner];
    if (!p || !e.date || e.date > tot) continue;
    // Eigen BV-kosten van Harmen (iMac, sluitpost) zijn geen Morgen-geld.
    if (e.entity === 'HvH BV') continue;
    const j = e.date.slice(0, 4);

    if (e.type === 'income') {
      if (e.payment_status === 'ontvangen') {
        p.binnen += num(e.amount);
        jaar(p, j).binnen += num(e.amount);
        p.inkomsten.push(e);
      } else if (e.payment_status === 'gefactureerd') {
        p.open += num(e.amount);
        p.openFacturen.push(e);
      }
      continue;
    }

    if (e.type === 'expense' && !isForecastTemplate(e)) {
      const bedrag = exBtw(e);
      p.uit += bedrag;
      p.btw += num(e.vat_amount);
      jaar(p, j).uit += bedrag;
      p.kosten.push(e);
      if (isGeschat(e)) {
        p.geschat.aantal += 1;
        p.geschat.bedrag += bedrag;
      }
    }
  }

  for (const p of Object.values(personen)) {
    p.netto = p.binnen - p.uit;
    p.inkomsten.sort((a, b) => a.date.localeCompare(b.date));
    p.openFacturen.sort((a, b) => a.date.localeCompare(b.date));
    const perLev = {};
    for (const e of p.kosten) {
      const naam = e.vendor || e.description || 'Onbekend';
      perLev[naam] ||= { leverancier: naam, aantal: 0, bedrag: 0, geschat: false };
      perLev[naam].aantal += 1;
      perLev[naam].bedrag += exBtw(e);
      if (isGeschat(e)) perLev[naam].geschat = true;
    }
    p.kostenPerLeverancier = Object.values(perLev).sort((a, b) => b.bedrag - a.bedrag);
  }

  const h = personen.Harmen;
  const k = personen.Karin;
  // Ieder hoort de helft van het totale netto te houden. Wat Harmen meer
  // heeft dan die helft, is hij Karin verschuldigd (negatief = andersom).
  const verschuldigd = (h.netto - k.netto) / 2;

  const verrekeningen = [...(db.settlements || [])]
    .filter((s) => s.date && s.date <= tot)
    .sort((a, b) => a.date.localeCompare(b.date));
  const alVerrekend = verrekeningen.reduce((s, v) => {
    if (v.from_person === 'Harmen' && v.to_person === 'Karin') return s + num(v.amount);
    if (v.from_person === 'Karin' && v.to_person === 'Harmen') return s - num(v.amount);
    return s;
  }, 0);

  const resterend = verschuldigd - alVerrekend;
  const resterendInclOpen = ((h.netto + h.open) - (k.netto + k.open)) / 2 - alVerrekend;

  const richtingVan = (bedrag) => {
    const r = round2(bedrag);
    if (r > 0) return { van: 'Harmen', naar: 'Karin', bedrag: r };
    if (r < 0) return { van: 'Karin', naar: 'Harmen', bedrag: -r };
    return { van: null, naar: null, bedrag: 0 };
  };

  return {
    tot,
    personen,
    verschuldigd,
    verrekeningen,
    alVerrekend,
    resterend,
    resterendInclOpen,
    richting: richtingVan(resterend),
    richtingInclOpen: richtingVan(resterendInclOpen),
    jaren: [...new Set(Object.values(personen).flatMap((p) => Object.keys(p.perJaar)))].sort(),
  };
}

// Op de cent: bij een onderlinge betaling telt elke euro, anders dan bij de
// afgeronde bedragen op de rest van het dashboard.
const fmtEuroCent = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function renderAfsluiting(db, { escapeHtml, settlementsError = null } = {}) {
  const m = afsluitingModel(db);
  const eur = (n) => fmtEuroCent.format(n || 0);
  const esc = (s) => escapeHtml(String(s ?? ''));
  const datum = (d) => (d ? d.split('-').reverse().join('-') : '');
  const h = m.personen.Harmen;
  const k = m.personen.Karin;

  const zin = (r) => (r.van
    ? `<strong>${esc(r.van)}</strong> maakt <strong>${eur(r.bedrag)}</strong> over naar <strong>${esc(r.naar)}</strong>`
    : 'Jullie staan precies gelijk');

  const persoonKaart = (naam, p) => `<section class="card an-card afs-person">
    <p class="eyebrow">${esc(PERSOON_LABEL[naam])}</p>
    <dl class="afs-sum">
      <div><dt>Binnengekomen namens Morgen</dt><dd>${eur(p.binnen)}</dd></div>
      <div><dt>Betaald namens Morgen</dt><dd>− ${eur(p.uit)}</dd></div>
      <div class="afs-sum__net"><dt>Netto</dt><dd>${eur(p.netto)}</dd></div>
    </dl>
    ${p.open ? `<p class="muted">Nog open (gefactureerd, niet betaald): ${eur(p.open)}</p>` : ''}
    ${p.geschat.aantal ? `<p class="afs-warn">${p.geschat.aantal} geschatte kostenpost${p.geschat.aantal === 1 ? '' : 'en'} (${eur(p.geschat.bedrag)}): nog vervangen door echte bedragen.</p>` : ''}
    ${p.btw ? `<p class="muted">Kosten ex btw; ${eur(p.btw)} btw eraf gehaald.</p>` : ''}
    <details class="afs-details"><summary>Binnengekomen (${p.inkomsten.length})</summary>
      <table class="an-table"><thead><tr><th>Datum</th><th>Klant</th><th>Omschrijving</th><th class="num">Ex btw</th></tr></thead><tbody>
      ${p.inkomsten.map((e) => `<tr><td>${datum(e.date)}</td><td>${esc(e.vendor)}</td><td>${esc(e.description)}</td><td class="num">${eur(e.amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Niets ontvangen</td></tr>'}
      </tbody></table>
    </details>
    <details class="afs-details"><summary>Betaald, per leverancier (${p.kosten.length} posten)</summary>
      <table class="an-table"><thead><tr><th>Leverancier</th><th class="num">Posten</th><th class="num">Ex btw</th></tr></thead><tbody>
      ${p.kostenPerLeverancier.map((r) => `<tr><td>${esc(r.leverancier)}${r.geschat ? ' <em class="afs-tag">geschat</em>' : ''}</td><td class="num">${r.aantal}</td><td class="num">${eur(r.bedrag)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Geen kosten</td></tr>'}
      </tbody></table>
    </details>
  </section>`;

  const jaarRijen = m.jaren.map((j) => {
    const hj = h.perJaar[j] || { binnen: 0, uit: 0 };
    const kj = k.perJaar[j] || { binnen: 0, uit: 0 };
    return `<tr><td>${j}</td><td class="num">${eur(hj.binnen)}</td><td class="num">${eur(hj.uit)}</td><td class="num">${eur(kj.binnen)}</td><td class="num">${eur(kj.uit)}</td></tr>`;
  }).join('');

  const verrekenRijen = m.verrekeningen.map((v) => `<tr>
    <td>${datum(v.date)}</td><td>${esc(v.from_person)} → ${esc(v.to_person)}</td><td>${esc(v.description)}</td>
    <td class="num">${eur(v.amount)}</td>
    <td><button type="button" class="button ghost" data-action="afs-del-settlement" data-id="${esc(v.id)}">Verwijder</button></td>
  </tr>`).join('');

  const openRijen = [...h.openFacturen.map((e) => ['Harmen', e]), ...k.openFacturen.map((e) => ['Karin', e])]
    .map(([naam, e]) => `<tr><td>${datum(e.date)}</td><td>${esc(naam)}</td><td>${esc(e.vendor)}</td><td>${esc(e.description)}</td><td class="num">${eur(e.amount)}</td></tr>`)
    .join('');

  const vandaag = new Date().toISOString().slice(0, 10);

  return `<div class="page an-page afs-page">
    <header class="page-head">
      <h1>Afsluiting voor BV</h1>
      <p>Wat er namens Morgen is binnengekomen en betaald, per persoon, t/m ${datum(m.tot)}. Alle bedragen ex btw. Ieder houdt de helft van het netto resultaat.</p>
    </header>

    <section class="card an-card afs-result">
      <p class="eyebrow">Per saldo, op ontvangen geld</p>
      <p class="afs-result__zin">${zin(m.richting)}</p>
      <p class="muted">Als ook de openstaande facturen betaald zijn: ${zin(m.richtingInclOpen)}.</p>
    </section>

    <div class="afs-duo">
      ${persoonKaart('Harmen', h)}
      ${persoonKaart('Karin', k)}
    </div>

    <section class="card an-card">
      <p class="eyebrow">Zo is het berekend</p>
      <table class="an-table afs-calc"><tbody>
        <tr><td>Netto Harmen</td><td class="num">${eur(h.netto)}</td></tr>
        <tr><td>Netto Karin</td><td class="num">${eur(k.netto)}</td></tr>
        <tr><td>Totaal netto Morgen</td><td class="num">${eur(h.netto + k.netto)}</td></tr>
        <tr><td>Ieders helft</td><td class="num">${eur((h.netto + k.netto) / 2)}</td></tr>
        <tr><td>Harmen is Karin verschuldigd: (netto Harmen − netto Karin) ÷ 2</td><td class="num">${eur(m.verschuldigd)}</td></tr>
        <tr><td>Al verrekend (Harmen → Karin, min Karin → Harmen)</td><td class="num">− ${eur(m.alVerrekend)}</td></tr>
        <tr class="afs-calc__total"><td>Nog over te maken door Harmen (negatief = door Karin)</td><td class="num">${eur(m.resterend)}</td></tr>
      </tbody></table>
      <p class="sub-h">Per jaar</p>
      <table class="an-table"><thead><tr><th>Jaar</th><th class="num">Harmen binnen</th><th class="num">Harmen betaald</th><th class="num">Karin binnen</th><th class="num">Karin betaald</th></tr></thead><tbody>${jaarRijen}</tbody></table>
    </section>

    <section class="card an-card">
      <p class="eyebrow">Al verrekend</p>
      <p class="muted">Onderlinge betalingen die al gedaan zijn, ex btw. Ze gaan van het saldo af.</p>
      ${settlementsError ? `<p class="afs-warn">De tabel voor verrekeningen is niet bereikbaar (${esc(settlementsError)}). Voer de migratie uit in <code>docs/sql/2026-10-25-afsluiting-bv.sql</code>.</p>` : ''}
      <table class="an-table"><thead><tr><th>Datum</th><th>Van → naar</th><th>Omschrijving</th><th class="num">Ex btw</th><th></th></tr></thead>
      <tbody>${verrekenRijen || '<tr><td colspan="5" class="muted">Nog niets verrekend</td></tr>'}</tbody></table>
      <form class="afs-form" data-action="afs-add-settlement">
        <label><span>Datum</span><input type="date" name="date" value="${vandaag}" required /></label>
        <label><span>Van</span><select name="from_person"><option>Harmen</option><option>Karin</option></select></label>
        <label><span>Naar</span><select name="to_person"><option>Karin</option><option>Harmen</option></select></label>
        <label><span>Bedrag ex btw</span><input type="number" name="amount" step="0.01" min="0.01" required /></label>
        <label class="afs-form__wide"><span>Omschrijving</span><input type="text" name="description" placeholder="bijv. factuur 202503-003" /></label>
        <button type="submit" class="button">Toevoegen</button>
      </form>
    </section>

    <section class="card an-card">
      <p class="eyebrow">Openstaande facturen</p>
      <p class="muted">Verstuurd maar nog niet betaald. Tellen niet mee in het saldo hierboven.</p>
      <table class="an-table"><thead><tr><th>Datum</th><th>Wie</th><th>Klant</th><th>Omschrijving</th><th class="num">Ex btw</th></tr></thead>
      <tbody>${openRijen || '<tr><td colspan="5" class="muted">Geen openstaande facturen</td></tr>'}</tbody></table>
    </section>
  </div>`;
}
