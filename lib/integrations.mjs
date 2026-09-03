// Gedeelde integratie-logica: gebruikt door de Netlify Functions (productie) én
// door server.js (/api/* lokaal). Tokens komen ALTIJD uit env-vars — nooit in de client.

/* ============================== AI-nieuws (publieke RSS, geen token) ============================== */

const NEWS_SOURCES = [
  { name: 'Anthropic',       url: 'https://news.google.com/rss/search?q=Anthropic+Claude&hl=nl&gl=NL&ceid=NL:nl', strip: true },
  { name: 'OpenAI',          url: 'https://openai.com/news/rss.xml' },
  { name: 'DeepMind',        url: 'https://deepmind.google/blog/rss.xml' },
  { name: 'Import AI',       url: 'https://importai.substack.com/feed' },
  { name: 'The Verge',       url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'TechCrunch',      url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/' },
  { name: 'Hacker News',     url: 'https://hnrss.org/newest?q=AI+OR+LLM+OR+%22machine+learning%22&count=15' },
  { name: 'Something Big',   url: 'https://somethingbig.ai/feed.xml' },
];

function stripXml(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;|&apos;/gi, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function firstTag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? m[1] : '';
}
function parseFeed(xml, source) {
  const out = [];
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const it of items) {
    const title = stripXml(firstTag(it, 'title'));
    const link = stripXml(firstTag(it, 'link'));
    const date = firstTag(it, 'pubDate') || firstTag(it, 'dc:date') || '';
    if (title) out.push({ title, link, date, source });
  }
  if (!out.length) {
    const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    for (const en of entries) {
      const title = stripXml(firstTag(en, 'title'));
      const lm = en.match(/<link[^>]*href="([^"]+)"/i);
      const date = firstTag(en, 'updated') || firstTag(en, 'published') || '';
      if (title) out.push({ title, link: lm ? lm[1] : '', date, source });
    }
  }
  return out.map((i) => ({ ...i, date: i.date ? safeIso(i.date) : null }));
}
function safeIso(d) { const t = new Date(d); return Number.isNaN(t.getTime()) ? null : t.toISOString(); }

async function fetchFeed(src) {
  try {
    const r = await fetch(src.url, { headers: { 'User-Agent': 'MorgenCockpit/1.0' }, signal: AbortSignal.timeout(8000), redirect: 'follow' });
    if (!r.ok) return [];
    let items = parseFeed(await r.text(), src.name).slice(0, 6);
    if (src.strip) items = items.map((i) => ({ ...i, title: i.title.replace(/\s+[–-]\s+[^–-]+$/, '').trim() }));
    return items;
  } catch { return []; }
}

// AI Report (aireport.nl) draait op beehiiv en heeft geen publieke RSS.
// Lichte scrape van de homepage: pak de /p/<slug> artikel-links + titel.
async function fetchAiReport() {
  try {
    const r = await fetch('https://www.aireport.nl', { headers: { 'User-Agent': 'Mozilla/5.0 MorgenCockpit/1.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const html = await r.text();
    const out = [];
    const seen = new Set();
    const re = /<a\b[^>]*href="(\/p\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null && out.length < 4) {
      const slug = m[1];
      if (seen.has(slug) || slug === '/p/masterclasses') continue;
      seen.add(slug);
      let title = stripXml(m[2]);
      if (title.length < 8 || title.length > 140) {
        title = slug.replace('/p/', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }
      out.push({ title, link: 'https://www.aireport.nl' + slug, date: null, source: 'AI Report' });
    }
    return out;
  } catch { return []; }
}

export async function getAiNews() {
  const [rssAll, aireport] = await Promise.all([
    Promise.all(NEWS_SOURCES.map(fetchFeed)).then((a) => a.flat()),
    fetchAiReport(),
  ]);
  const seen = new Set();
  const sorted = rssAll
    .filter((i) => { const k = i.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  // Max 2 per bron → een diverse radar i.p.v. één feed die de lijst overneemt.
  const perSource = {};
  const items = [];
  for (const i of sorted) {
    perSource[i.source] = (perSource[i.source] || 0) + 1;
    if (perSource[i.source] > 2) continue;
    items.push(i);
    if (items.length >= 10) break;
  }
  // AI Report (geen RSS, geen datum) gegarandeerd bovenaan.
  items.unshift(...aireport.slice(0, 2));
  return { ok: true, items: items.slice(0, 12), count: Math.min(items.length, 12) };
}

/* ============================== Netlify deploys (token via env) ============================== */

export async function getNetlifySites() {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) return { ok: false, error: 'NETLIFY_API_TOKEN niet ingesteld' };
  try {
    const r = await fetch('https://api.netlify.com/api/v1/sites?per_page=20&sort_by=updated_at', {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, error: `Netlify ${r.status}` };
    const data = await r.json();
    const items = (Array.isArray(data) ? data : []).slice(0, 12).map((s) => ({
      name: s.name, url: s.ssl_url || s.url, admin: s.admin_url,
      updated: s.updated_at, state: s.published_deploy?.state || s.state || '',
    }));
    return { ok: true, items };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

/* ============================== Supabase projecten (token via env) ============================== */

export async function getSupabaseProjects() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return { ok: false, error: 'SUPABASE_ACCESS_TOKEN niet ingesteld' };
  try {
    const r = await fetch('https://api.supabase.com/v1/projects', {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, error: `Supabase ${r.status}` };
    const data = await r.json();
    const items = (Array.isArray(data) ? data : []).slice(0, 12).map((p) => {
      const ref = p.id || p.ref;
      return { name: p.name, region: p.region, status: p.status, url: `https://supabase.com/dashboard/project/${ref}` };
    });
    return { ok: true, items };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

/* ============================== SharePoint (Microsoft Graph, app-only) ============================== */

// Client-credentials flow: een Azure-app-registratie met application permission
// `Sites.Read.All` + admin consent. Nooit in de client — token blijft server-side.
//
// Verplicht : MS_CLIENT_ID, MS_CLIENT_SECRET
// Optioneel : MS_TENANT_ID     → tenant-id (default hieronder)
//             SHAREPOINT_HOST  → tenant-host (default hieronder)
//             SHAREPOINT_SITES → komma-lijst met sitepaden ("/sites/Morgen,/sites/Academy").
//                                Leeg = alle sites die de app mag zien, nieuwste eerst.

// De tenant-id is geen geheim: hij staat ook in de Teams-deeplink van "Morgen intern".
const MS_TENANT_DEFAULT = 'a7e3d42c-1c30-4558-91d7-89e3ed906fdc';
const SHAREPOINT_HOST_DEFAULT = 'morgencompany.sharepoint.com';

async function msGraphToken() {
  const tenant = process.env.MS_TENANT_ID || MS_TENANT_DEFAULT;
  const clientId = process.env.MS_CLIENT_ID;
  const secret = process.env.MS_CLIENT_SECRET;
  if (!clientId || !secret) {
    return { error: 'Microsoft Graph niet gekoppeld (MS_CLIENT_ID / MS_CLIENT_SECRET ontbreken)' };
  }
  try {
    const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
      signal: AbortSignal.timeout(6000),
    });
    const data = await r.json().catch(() => ({}));
    // Alleen de kern van error_description: de trace-/correlation-id's zijn ruis in een flyout.
    if (!r.ok || !data.access_token) {
      const why = String(data.error_description || data.error || '').split(/\r?\n|Trace ID:/)[0].trim();
      return { error: `Microsoft login ${r.status}${why ? `: ${why}` : ''}` };
    }
    return { token: data.access_token };
  } catch (e) { return { error: String(e.message || e) }; }
}

async function graphGet(token, path) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`Graph ${r.status}`);
  return r.json();
}

// Sitepaden uit env winnen; anders de sites die de app mag zien, laatst gewijzigd eerst.
async function sharepointSites(token, host) {
  const configured = (process.env.SHAREPOINT_SITES || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (configured.length) {
    const found = await Promise.all(configured.slice(0, 5).map(async (p) => {
      const path = p.startsWith('/') ? p : `/${p}`;
      try { return await graphGet(token, `/sites/${host}:${encodeURI(path)}`); } catch { return null; }
    }));
    return found.filter(Boolean);
  }
  const data = await graphGet(token, '/sites?search=*&$top=20');
  return (data.value || [])
    .filter((s) => s.id)
    .sort((a, b) => (b.lastModifiedDateTime || '').localeCompare(a.lastModifiedDateTime || ''))
    .slice(0, 5);
}

// Bewust géén $orderby: documentbibliotheken geven daar soms een 501 op — zelf sorteren is veiliger.
// Een site zonder documentbibliotheek geeft een 404 op /drive; die slaan we stil over.
async function sharepointSiteItems(token, site) {
  try {
    const data = await graphGet(token, `/sites/${site.id}/drive/root/children?$top=25`);
    const label = site.displayName || site.name || '';
    return (data.value || []).map((it) => ({
      name: it.name || '',
      url: it.webUrl || site.webUrl || '',
      site: label,
      kind: it.folder ? 'folder' : 'file',
      modified: it.lastModifiedDateTime || null,
      by: it.lastModifiedBy?.user?.displayName || '',
    }));
  } catch { return []; }
}

export async function getSharepointFiles() {
  const auth = await msGraphToken();
  if (auth.error) return { ok: false, error: auth.error };
  const host = process.env.SHAREPOINT_HOST || SHAREPOINT_HOST_DEFAULT;
  try {
    const sites = await sharepointSites(auth.token, host);
    if (!sites.length) return { ok: true, items: [] };
    const perSite = await Promise.all(sites.map((s) => sharepointSiteItems(auth.token, s)));
    const items = perSite.flat()
      .sort((a, b) => (b.modified || '').localeCompare(a.modified || ''))
      .slice(0, 12);
    return { ok: true, items };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
