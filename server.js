import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { getAiNews, getNetlifySites, getSupabaseProjects, getSharepointFiles } from './lib/integrations.mjs';

// Lokale tegenhanger van de Netlify Functions, zodat /api/* ook met `npm start` werkt.
const apiRoutes = {
  '/api/ai-news': getAiNews,
  '/api/netlify-sites': getNetlifySites,
  '/api/supabase-projects': getSupabaseProjects,
  '/api/sharepoint': getSharepointFiles,
};

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, host, port }));
    return;
  }

  const apiPath = req.url.split('?')[0];
  if (apiRoutes[apiPath]) {
    let payload;
    try { payload = await apiRoutes[apiPath](); }
    catch (error) { payload = { ok: false, error: String(error?.message || error) }; }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=120' });
    res.end(JSON.stringify(payload));
    return;
  }

  const url = req.url === '/' ? '/index.html'
            : (req.url === '/dashboard' || req.url === '/dashboard/') ? '/dashboard.html'
            : req.url;
  const filePath = normalize(join(process.cwd(), url.split('?')[0]));
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'text/plain; charset=utf-8' });
    res.end(data);
  } catch {
    try {
      const fallback = await readFile(join(process.cwd(), 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fallback);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(error));
    }
  }
});

server.listen(port, host, () => {
  console.log(`Dashboard running on:`);
  console.log(`- Local:   http://localhost:${port}`);
  console.log(`- Network: http://${host}:${port}`);
  console.log(`- Health:  http://localhost:${port}/health`);
  console.log('Tip: gebruik bij remote workspaces de port preview/forwarding van je omgeving.');
});
