// Gedeelde integratie-logica: gebruikt door de Netlify Functions (productie) én
// door server.js (/api/* lokaal). Tokens komen ALTIJD uit env-vars — nooit in de client.

/* ============================== AI-nieuws (publieke RSS, geen token) ============================== */

const NEWS_SOURCES = [
  { name: 'OpenAI',          url: 'https://openai.com/news/rss.xml' },
  { name: 'DeepMind',        url: 'https://deepmind.google/blog/rss.xml' },
  { name: 'Import AI',       url: 'https://importai.substack.com/feed' },
  { name: 'The Verge',       url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'TechCrunch',      url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/' },
  { name: 'Hacker News',     url: 'https://hnrss.org/newest?q=AI+OR+LLM+OR+%22machine+learning%22&count=15' },
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
    return parseFeed(await r.text(), src.name).slice(0, 6);
  } catch { return []; }
}

export async function getAiNews() {
  const all = (await Promise.all(NEWS_SOURCES.map(fetchFeed))).flat();
  const seen = new Set();
  const sorted = all
    .filter((i) => { const k = i.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  // Max 2 per bron → een diverse radar i.p.v. één feed die de lijst overneemt.
  const perSource = {};
  const items = [];
  for (const i of sorted) {
    perSource[i.source] = (perSource[i.source] || 0) + 1;
    if (perSource[i.source] > 2) continue;
    items.push(i);
    if (items.length >= 12) break;
  }
  return { ok: true, items, count: items.length };
}

/* ============================== Netlify deploys (token via env) ============================== */

export async function getNetlifySites() {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) return { ok: false, error: 'NETLIFY_AUTH_TOKEN niet ingesteld' };
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
