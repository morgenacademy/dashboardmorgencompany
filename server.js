import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, host, port }));
    return;
  }

  const url = req.url === '/' ? '/index.html' : req.url;
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
