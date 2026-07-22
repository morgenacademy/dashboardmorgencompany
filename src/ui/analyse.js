// Pure rekenkern voor de Analyse-tab. Geen DOM, testbaar zoals finance-model.js.
// 'finance' is de cache-key voor finance_entries (zie store.js).

const OPEN_OFFERTE = ['offerte_verzonden'];
const LABELS = ['inspire', 'build', 'train', 'implement', 'other'];

function isForecastTemplate(e) {
  return e.type === 'expense' && e.recurring === 'monthly' && e.source === 'manual';
}
function inYear(dateStr, year) {
  return typeof dateStr === 'string' && dateStr.slice(0, 4) === String(year);
}

export function analyseModel(db, { year = new Date().getFullYear() } = {}) {
  const projects = db.projects || [];
  const customers = db.customers || [];
  const finance = db.finance || [];
  const custById = Object.fromEntries(customers.map((c) => [c.id, c]));
  const projById = Object.fromEntries(projects.map((p) => [p.id, p]));

  const income = finance.filter((f) => f.type === 'income' && inYear(f.date, year));
  const paidBy = (pred) => income.filter(pred).reduce((s, f) => s + Number(f.amount || 0), 0);
  const sumByProject = (projFilter, statusFilter) =>
    income.filter((f) => statusFilter(f.payment_status) && projFilter(projById[f.project_id]))
      .reduce((s, f) => s + Number(f.amount || 0), 0);
  const openOffertes = (projFilter) => projects
    .filter((p) => OPEN_OFFERTE.includes(p.pipeline_status) && projFilter(p))
    .reduce((s, p) => s + Number(p.value_amount || 0), 0);
  // Toegezegd = omzet die eraan komt: finance-regels met payment_status='verwacht'
  // (geaccepteerde offertes én vervolgtermijnen op lopende projecten). Uit finance,
  // niet uit projects.value_amount: zo telt een project dat nog op 'geaccepteerd'
  // staat maar al betaald is (bv. VML) niet dubbel, en tellen Karin's
  // vervolgtermijnen (Zjoske deel 2, AgriFood) wél mee.
  const accepted = (projFilter) => sumByProject(projFilter, (st) => st === 'verwacht');

  const isPaid = (st) => st === 'ontvangen';
  const isInvoiced = (st) => st === 'gefactureerd';

  // ---- Veredeling per label ----
  const veredeling = LABELS.map((label) => ({
    label,
    betaald: sumByProject((p) => p && p.service_label === label, isPaid),
    gefactureerd: sumByProject((p) => p && p.service_label === label, isInvoiced),
    geaccepteerd: accepted((p) => p.service_label === label),
    open: openOffertes((p) => p.service_label === label),
  }));

  // ---- Sectoren ----
  const sectorNames = [...new Set(customers.map((c) => c.industry).filter(Boolean))];
  const sectorOf = (p) => (p && custById[p.customer_id]?.industry) || '';
  const sectoren = sectorNames.map((sector) => ({
    sector,
    gerealiseerd: sumByProject((p) => sectorOf(p) === sector, (st) => isPaid(st) || isInvoiced(st)),
    geaccepteerd: accepted((p) => sectorOf(p) === sector),
    open: openOffertes((p) => sectorOf(p) === sector),
  })).sort((a, b) => (b.gerealiseerd + b.geaccepteerd + b.open) - (a.gerealiseerd + a.geaccepteerd + a.open));

  // ---- Matrix: sector × label ----
  // Per cel twee waarden: 'vast' (betaald + gefactureerd + geaccepteerd) en 'open'
  // (open offerte). De render telt open erbij op als de switch aan staat.
  // 'other' valt weg als kolom (samenwerkingsgesprekken, geen dienst).
  const MATRIX_LABELS = LABELS.filter((l) => l !== 'other');
  const matrix = sectoren.map(({ sector }) => ({
    sector,
    cells: MATRIX_LABELS.map((label) => {
      const f = (p) => p && p.service_label === label && sectorOf(p) === sector;
      return {
        label,
        vast: sumByProject(f, (st) => isPaid(st) || isInvoiced(st)) + accepted(f),
        open: openOffertes(f),
      };
    }),
  }));

  // ---- Kanalen: lead_source én channel ----
  const bySource = (src) => ({
    source: src,
    projecten: projects.filter((p) => p.lead_source === src).length,
    gerealiseerd: sumByProject((p) => p && p.lead_source === src, (st) => isPaid(st) || isInvoiced(st)),
    geaccepteerd: accepted((p) => p.lead_source === src),
    open: openOffertes((p) => p.lead_source === src),
  });
  const byChannel = (ch) => ({
    channel: ch,
    betaald: sumByProject((p) => p && (p.channel || 'direct') === ch, isPaid),
    gefactureerd: sumByProject((p) => p && (p.channel || 'direct') === ch, isInvoiced),
    geaccepteerd: accepted((p) => (p.channel || 'direct') === ch),
    open: openOffertes((p) => (p.channel || 'direct') === ch),
  });
  const kanalen = {
    lead: ['netwerk', 'buiten_netwerk'].map(bySource),
    channel: ['direct', 'michielpro', 'karin'].map(byChannel),
  };

  // ---- Recurring: feitelijke herhaalomzet (headline) ----
  const monthsByCustomer = {};
  for (const f of income) {
    if (!isPaid(f.payment_status) && !isInvoiced(f.payment_status)) continue;
    const cust = projById[f.project_id]?.customer_id;
    if (!cust) continue;
    (monthsByCustomer[cust] ||= { months: new Set(), total: 0 });
    monthsByCustomer[cust].months.add(f.date.slice(0, 7));
    monthsByCustomer[cust].total += Number(f.amount || 0);
  }
  const herhaalKlanten = Object.entries(monthsByCustomer)
    .filter(([, v]) => v.months.size > 1)
    .map(([cust, v]) => ({ klant: custById[cust]?.name || cust, maanden: v.months.size, bedrag: v.total }))
    .sort((a, b) => b.bedrag - a.bedrag);
  const herhaalTotaal = herhaalKlanten.reduce((s, k) => s + k.bedrag, 0);
  const omzetTotaal = paidBy((f) => isPaid(f.payment_status) || isInvoiced(f.payment_status));
  const contractueelMnd = projects
    .filter((p) => p.pricing_model === 'recurring_monthly')
    .reduce((s, p) => s + Number(p.value_amount || 0), 0);

  // ---- Marge: omzet - werkelijke kosten ----
  const expenses = finance.filter((f) => f.type === 'expense' && !isForecastTemplate(f) && inYear(f.date, year));
  const kosten = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const projectgebonden = expenses.filter((e) => e.project_id).reduce((s, e) => s + Number(e.amount || 0), 0);
  const perLabel = {};
  for (const e of expenses) {
    if (!e.project_id) continue;
    const label = projById[e.project_id]?.service_label || 'other';
    perLabel[label] = (perLabel[label] || 0) + Number(e.amount || 0);
  }
  const kostenCategorie = {};
  for (const e of expenses) {
    const cat = e.category || '— geen —';
    kostenCategorie[cat] = (kostenCategorie[cat] || 0) + Number(e.amount || 0);
  }
  const betaaldOmzet = paidBy((f) => isPaid(f.payment_status));

  return {
    year,
    veredeling,
    sectoren,
    matrix,
    matrixLabels: MATRIX_LABELS,
    kanalen,
    recurring: { herhaalKlanten, herhaalTotaal, omzetTotaal, contractueelMnd },
    marge: {
      omzet: betaaldOmzet,
      kosten,
      netto: betaaldOmzet - kosten,
      margePct: betaaldOmzet ? (1 - kosten / betaaldOmzet) * 100 : 0,
      projectgebonden,
      overhead: kosten - projectgebonden,
      perLabel,
      categorie: Object.entries(kostenCategorie).map(([naam, bedrag]) => ({ naam, bedrag }))
        .sort((a, b) => b.bedrag - a.bedrag),
    },
  };
}

const OPEN_STAGES = ['offerte_verzonden', 'geaccepteerd'];

// Genormaliseerde naam voor de dubbele-klant-heuristiek.
function normName(name) {
  return String(name || '').toLowerCase()
    .replace(/\b(b\.?v\.?|bv|the|de|het)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export function analyseGaps(db) {
  const projects = db.projects || [];
  const customers = db.customers || [];

  // 1 + afgeleid: service_label niet bevestigd. 'other' = geen label, anders = geraden.
  const labelOntbreekt = projects
    .filter((p) => p.label_reviewed === false)
    .map((p) => ({ id: p.id, name: p.name, service_label: p.service_label,
      afgeleid: p.service_label !== 'other', value_amount: Number(p.value_amount || 0) }))
    .sort((a, b) => b.value_amount - a.value_amount);

  // 2: sector leeg
  const sectorOntbreekt = customers
    .filter((c) => !c.industry)
    .map((c) => ({ id: c.id, name: c.name }));

  // 3: offerte met bedrag 0
  const bedragOntbreekt = projects
    .filter((p) => OPEN_STAGES.includes(p.pipeline_status) && Number(p.value_amount || 0) === 0)
    .map((p) => ({ id: p.id, name: p.name }));

  // 4: kanaal leeg (default 'direct' zou gezet moeten zijn; leeg = data-anomalie)
  const kanaalOntbreekt = projects
    .filter((p) => !p.channel)
    .map((p) => ({ id: p.id, name: p.name }));

  // 5: dubbele klant — genormaliseerde naam A substring van B (alleen signaleren)
  const dubbeleKlant = [];
  for (let i = 0; i < customers.length; i++) {
    for (let j = i + 1; j < customers.length; j++) {
      const a = normName(customers[i].name);
      const b = normName(customers[j].name);
      if (!a || !b) continue;
      if (a === b || a.includes(b) || b.includes(a)) {
        dubbeleKlant.push([customers[i], customers[j]]);
      }
    }
  }

  return { labelOntbreekt, sectorOntbreekt, bedragOntbreekt, kanaalOntbreekt, dubbeleKlant };
}

export function renderAnalyse(db, { fmtCurrency, escapeHtml, includeOpen = true, year = new Date().getFullYear() } = {}) {
  const m = analyseModel(db, { year });
  const g = analyseGaps(db);
  const eur = (n) => fmtCurrency(n || 0);
  const esc = (s) => escapeHtml(String(s ?? ''));

  // Totaal per balk. Betaald + gefactureerd + geaccepteerd altijd; open offertes
  // alleen als de switch aan staat. Sectoren/lead gebruiken 'gerealiseerd' i.p.v.
  // losse betaald/gefactureerd, dus twee varianten.
  const openPart = (r) => (includeOpen ? Number(r.open || 0) : 0);
  const totFull = (r) => Number(r.betaald || 0) + Number(r.gefactureerd || 0) + Number(r.geaccepteerd || 0) + openPart(r);
  const totReal = (r) => Number(r.gerealiseerd || 0) + Number(r.geaccepteerd || 0) + openPart(r);

  const bar = (label, sub, value, max, extra = '') => {
    const w = max > 0 ? Math.max(0, (value / max) * 100) : 0;
    return `<div class="an-row">
      <div class="an-row__label"><span>${esc(label)}</span>${sub ? `<em>${esc(sub)}</em>` : ''}</div>
      <div class="an-row__track"><span style="width:${w.toFixed(2)}%">${extra}</span></div>
      <div class="an-row__val">${eur(value)}</div>
    </div>`;
  };

  // ---- Veredeling ----
  const maxVer = Math.max(1, ...m.veredeling.map(totFull));
  const veredelingHtml = m.veredeling.filter((r) => totFull(r) > 0)
    .map((r) => bar(r.label, null, totFull(r), maxVer)).join('');

  // ---- Sectoren ----
  const maxSec = Math.max(1, ...m.sectoren.map(totReal));
  const sectorHtml = m.sectoren.filter((r) => totReal(r) > 0)
    .map((r) => bar(r.sector, null, totReal(r), maxSec)).join('');

  // ---- Matrix: sector × label (heatmap) ----
  const matrixRows = m.matrix
    .map((row) => {
      const cells = row.cells.map((c) => Number(c.vast || 0) + openPart(c));
      return { sector: row.sector, cells, total: cells.reduce((s, v) => s + v, 0) };
    })
    .filter((x) => x.total > 0);
  const matrixMax = Math.max(1, ...matrixRows.flatMap((x) => x.cells));
  const heat = (v) => (v > 0 ? `background:rgba(155,111,207,${(0.1 + 0.5 * (v / matrixMax)).toFixed(3)})` : '');
  const matrixHtml = `<div class="an-matrix-wrap"><table class="an-matrix">
    <thead><tr><th>Sector</th>${m.matrixLabels.map((l) => `<th class="num">${esc(l)}</th>`).join('')}<th class="num">Totaal</th></tr></thead>
    <tbody>${matrixRows.map((x) => `<tr>
      <td>${esc(x.sector)}</td>
      ${x.cells.map((v) => `<td class="num heat" style="${heat(v)}">${v > 0 ? eur(v) : '<span class="an-zero">·</span>'}</td>`).join('')}
      <td class="num total">${eur(x.total)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;

  // ---- Kanalen ----
  const maxCh = Math.max(1, ...m.kanalen.channel.map(totFull));
  const kanaalHtml = m.kanalen.channel.filter((r) => totFull(r) > 0)
    .map((r) => bar(r.channel, null, totFull(r), maxCh)).join('');
  const maxLead = Math.max(1, ...m.kanalen.lead.map(totReal));
  const leadHtml = m.kanalen.lead.map((r) => bar(r.source, `${r.projecten} projecten`, totReal(r), maxLead)).join('');

  // ---- Recurring (feitelijk = headline; contractueel = voetnoot) ----
  const recRows = m.recurring.herhaalKlanten
    .map((k) => `<tr><td>${esc(k.klant)}</td><td class="num">${k.maanden}</td><td class="num">${eur(k.bedrag)}</td></tr>`)
    .join('');
  const herhaalPct = m.recurring.omzetTotaal ? (m.recurring.herhaalTotaal / m.recurring.omzetTotaal * 100) : 0;

  // ---- Marge ----
  const margeCat = m.marge.categorie
    .map((c) => bar(c.naam, null, c.bedrag, Math.max(1, ...m.marge.categorie.map((x) => x.bedrag)))).join('');
  const perLabelHtml = Object.entries(m.marge.perLabel)
    .map(([lbl, v]) => `<li>${esc(lbl)}: <strong>${eur(v)}</strong></li>`).join('') || '<li>Geen projectgebonden kosten</li>';

  // ---- Gap-blok ----
  const gapCount = g.labelOntbreekt.length + g.sectorOntbreekt.length + g.bedragOntbreekt.length
    + g.kanaalOntbreekt.length + g.dubbeleKlant.length;

  const labelItems = g.labelOntbreekt.map((p) => `<li data-gap="label" data-id="${esc(p.id)}">
    <span>${esc(p.name)}</span>
    ${p.afgeleid ? `<em>sync raadde <strong>${esc(p.service_label)}</strong> — klopt dit?</em>` : '<em>geen label</em>'}
    <select data-action="gap-label" data-id="${esc(p.id)}">
      ${['inspire', 'build', 'train', 'implement', 'other'].map((l) =>
        `<option value="${l}"${l === p.service_label ? ' selected' : ''}>${l}</option>`).join('')}
    </select>
    <button type="button" class="button ghost" data-action="gap-label-ok" data-id="${esc(p.id)}">${p.afgeleid ? 'klopt' : 'hoort zo'}</button>
  </li>`).join('');

  const sectorItems = g.sectorOntbreekt.map((c) => `<li>
    <span>${esc(c.name)}</span>
    <input list="an-sectors" data-action="gap-sector" data-id="${esc(c.id)}" placeholder="sector…" />
  </li>`).join('');
  const sectorDatalist = `<datalist id="an-sectors">${
    [...new Set((db.customers || []).map((c) => c.industry).filter(Boolean))]
      .map((s) => `<option value="${esc(s)}">`).join('')}</datalist>`;

  const bedragItems = g.bedragOntbreekt.map((p) => `<li>
    <span>${esc(p.name)}</span>
    <input type="number" step="1" data-action="gap-bedrag" data-id="${esc(p.id)}" placeholder="bedrag €" />
  </li>`).join('');

  const kanaalItems = g.kanaalOntbreekt.map((p) => `<li>
    <span>${esc(p.name)}</span>
    <select data-action="gap-kanaal" data-id="${esc(p.id)}">
      ${['direct', 'michielpro', 'karin'].map((c) => `<option value="${c}">${c}</option>`).join('')}
    </select>
  </li>`).join('');

  const dubbelItems = g.dubbeleKlant.map((pair) => `<li>
    <span>${esc(pair[0].name)} &nbsp;↔&nbsp; ${esc(pair[1].name)}</span>
    <em>Lijkt dubbel. Fix hoort in <code>KNOWN_CLIENTS</code> / <code>ID_ALIAS</code> van de sync — een merge hier komt terug.</em>
  </li>`).join('');

  const section = (title, sub, body) => `<section class="card an-card">
    <p class="eyebrow">${esc(title)}</p>${sub ? `<p class="muted">${esc(sub)}</p>` : ''}${body}
  </section>`;

  const basis = 'betaald + gefactureerd + toegezegd';
  const grondslag = includeOpen ? `${basis} + open offertes` : basis;

  return `<div class="page an-page">
    <header class="page-head">
      <div class="an-head-row">
        <h1>Analyse</h1>
        <label class="an-toggle">
          <input type="checkbox" data-action="toggle-open-offertes"${includeOpen ? ' checked' : ''} />
          <span>Open offertes meetellen</span>
        </label>
      </div>
      <p>Jaar ${year} · bedragen tellen ${esc(grondslag)}.</p>
    </header>

    ${section('Veredeling', `Per label: ${grondslag}.`, `<div class="an-bars">${veredelingHtml}</div>`)}
    ${section('Sectoren', `Per sector: ${grondslag}.`, `<div class="an-bars">${sectorHtml}</div>`)}
    ${section('Matrix — sector × label', `Welk type werk in welke sector. Kleur = omvang. ${grondslag}.`, matrixHtml)}
    ${section('Kanalen', 'Partner/factuurroute én herkomst van de lead.', `
      <p class="sub-h">Kanaal</p><div class="an-bars">${kanaalHtml}</div>
      <p class="sub-h">Herkomst</p><div class="an-bars">${leadHtml}</div>`)}
    ${section('Recurring', `Feitelijke herhaalomzet: ${eur(m.recurring.herhaalTotaal)} (${herhaalPct.toFixed(1)}% van de omzet).`, `
      <table class="an-table"><thead><tr><th>Klant</th><th class="num">Maanden</th><th class="num">${year}</th></tr></thead><tbody>${recRows}</tbody></table>
      <p class="muted">Contractueel model staat op ${eur(m.recurring.contractueelMnd)}/mnd — losgekoppeld van de realiteit; <code>finance_entries.recurring</code> is hardcoded <code>one_off</code>.</p>`)}
    ${section('Marge — waar het geld heen gaat', `Cash: ontvangen ${eur(m.marge.omzet)} − uitgaven ${eur(m.marge.kosten)} = netto ${eur(m.marge.netto)} (${m.marge.margePct.toFixed(1)}%). Ontvangen = binnengekomen omzet, niet de gefactureerde/open pipeline hierboven.`, `
      <p class="muted">Projectgebonden ${eur(m.marge.projectgebonden)} · overhead ${eur(m.marge.overhead)}. Projectkosten per label:</p>
      <ul class="an-inline">${perLabelHtml}</ul>
      <p class="sub-h">Kosten per categorie</p><div class="an-bars">${margeCat}</div>`)}

    <section class="card an-card an-gaps">
      <p class="eyebrow">Ontbrekend${gapCount ? ` · ${gapCount}` : ''}</p>
      ${gapCount === 0 ? '<p class="muted">Alles compleet — geen gaten.</p>' : ''}
      ${g.labelOntbreekt.length ? `<p class="sub-h">Label (${g.labelOntbreekt.length})</p><ul class="an-queue">${labelItems}</ul>` : ''}
      ${g.sectorOntbreekt.length ? `<p class="sub-h">Sector (${g.sectorOntbreekt.length})</p>${sectorDatalist}<ul class="an-queue">${sectorItems}</ul>` : ''}
      ${g.bedragOntbreekt.length ? `<p class="sub-h">Bedrag (${g.bedragOntbreekt.length})</p><ul class="an-queue">${bedragItems}</ul>` : ''}
      ${g.kanaalOntbreekt.length ? `<p class="sub-h">Kanaal (${g.kanaalOntbreekt.length})</p><ul class="an-queue">${kanaalItems}</ul>` : ''}
      ${g.dubbeleKlant.length ? `<p class="sub-h">Mogelijk dubbele klant (${g.dubbeleKlant.length})</p><ul class="an-queue">${dubbelItems}</ul>` : ''}
    </section>
  </div>`;
}
