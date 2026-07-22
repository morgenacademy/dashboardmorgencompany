// Pure rekenkern voor de Analyse-tab. Geen DOM, testbaar zoals finance-model.js.
// 'finance' is de cache-key voor finance_entries (zie store.js).

const COMMITTED = ['geaccepteerd', 'uitvoering', 'afgerond'];
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

  const isPaid = (st) => st === 'ontvangen';
  const isInvoiced = (st) => st === 'gefactureerd';

  // ---- Veredeling per label ----
  const veredeling = LABELS.map((label) => ({
    label,
    betaald: sumByProject((p) => p && p.service_label === label, isPaid),
    gefactureerd: sumByProject((p) => p && p.service_label === label, isInvoiced),
    open: openOffertes((p) => p.service_label === label),
  }));

  // ---- Sectoren ----
  const sectorNames = [...new Set(customers.map((c) => c.industry).filter(Boolean))];
  const sectorOf = (p) => (p && custById[p.customer_id]?.industry) || '';
  const sectoren = sectorNames.map((sector) => ({
    sector,
    gerealiseerd: sumByProject((p) => sectorOf(p) === sector, (st) => isPaid(st) || isInvoiced(st)),
    open: projects.filter((p) => OPEN_OFFERTE.includes(p.pipeline_status) && sectorOf(p) === sector)
      .reduce((s, p) => s + Number(p.value_amount || 0), 0),
  })).sort((a, b) => (b.gerealiseerd + b.open) - (a.gerealiseerd + a.open));

  // ---- Kanalen: lead_source én channel ----
  const bySource = (src) => ({
    source: src,
    projecten: projects.filter((p) => p.lead_source === src).length,
    gerealiseerd: sumByProject((p) => p && p.lead_source === src, (st) => isPaid(st) || isInvoiced(st)),
    open: openOffertes((p) => p.lead_source === src),
  });
  const byChannel = (ch) => ({
    channel: ch,
    betaald: sumByProject((p) => p && (p.channel || 'direct') === ch, isPaid),
    gefactureerd: sumByProject((p) => p && (p.channel || 'direct') === ch, isInvoiced),
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

export function renderAnalyse(db, { fmtCurrency, escapeHtml, year = new Date().getFullYear() } = {}) {
  const m = analyseModel(db, { year });
  const g = analyseGaps(db);
  const eur = (n) => fmtCurrency(n || 0);
  const esc = (s) => escapeHtml(String(s ?? ''));

  const bar = (label, sub, value, max, extra = '') => {
    const w = max > 0 ? Math.max(0, (value / max) * 100) : 0;
    return `<div class="an-row">
      <div class="an-row__label"><span>${esc(label)}</span>${sub ? `<em>${esc(sub)}</em>` : ''}</div>
      <div class="an-row__track"><span style="width:${w.toFixed(2)}%">${extra}</span></div>
      <div class="an-row__val">${eur(value)}</div>
    </div>`;
  };

  // ---- Veredeling ----
  const maxVer = Math.max(1, ...m.veredeling.map((r) => r.betaald + r.gefactureerd + r.open));
  const veredelingHtml = m.veredeling.filter((r) => r.betaald + r.gefactureerd + r.open > 0)
    .map((r) => bar(r.label, null, r.betaald + r.gefactureerd + r.open, maxVer)).join('');

  // ---- Sectoren ----
  const maxSec = Math.max(1, ...m.sectoren.map((r) => r.gerealiseerd + r.open));
  const sectorHtml = m.sectoren.map((r) => bar(r.sector, null, r.gerealiseerd + r.open, maxSec)).join('');

  // ---- Kanalen ----
  const kanaalHtml = m.kanalen.channel.filter((r) => r.betaald + r.gefactureerd + r.open > 0)
    .map((r) => bar(r.channel, null, r.betaald + r.gefactureerd + r.open,
      Math.max(1, ...m.kanalen.channel.map((x) => x.betaald + x.gefactureerd + x.open)))).join('');
  const leadHtml = m.kanalen.lead.map((r) => bar(r.source, `${r.projecten} projecten`,
    r.gerealiseerd, Math.max(1, ...m.kanalen.lead.map((x) => x.gerealiseerd)))).join('');

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

  return `<div class="page an-page">
    <header class="page-head"><h1>Analyse</h1>
      <p>Live uit Supabase · jaar ${year}. Gerealiseerde omzet + open pipeline.</p>
    </header>

    ${section('Veredeling', 'Omzet per label (betaald + gefactureerd + open offerte).', `<div class="an-bars">${veredelingHtml}</div>`)}
    ${section('Sectoren', 'Gerealiseerd + open offerte per sector.', `<div class="an-bars">${sectorHtml}</div>`)}
    ${section('Kanalen', 'Partner/factuurroute én herkomst van de lead.', `
      <p class="sub-h">Kanaal</p><div class="an-bars">${kanaalHtml}</div>
      <p class="sub-h">Herkomst</p><div class="an-bars">${leadHtml}</div>`)}
    ${section('Recurring', `Feitelijke herhaalomzet: ${eur(m.recurring.herhaalTotaal)} (${herhaalPct.toFixed(1)}% van de omzet).`, `
      <table class="an-table"><thead><tr><th>Klant</th><th class="num">Maanden</th><th class="num">${year}</th></tr></thead><tbody>${recRows}</tbody></table>
      <p class="muted">Contractueel model staat op ${eur(m.recurring.contractueelMnd)}/mnd — losgekoppeld van de realiteit; <code>finance_entries.recurring</code> is hardcoded <code>one_off</code>.</p>`)}
    ${section('Marge — waar het geld heen gaat', `Omzet ${eur(m.marge.omzet)} − kosten ${eur(m.marge.kosten)} = netto ${eur(m.marge.netto)} (${m.marge.margePct.toFixed(1)}%).`, `
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
