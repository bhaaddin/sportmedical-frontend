// Static + SPA fallback + /api proxy server that follows vercel.json (rewrites + headers) and serves brotli.
import path from 'node:path';
// usage: node server.mjs <distDir> <port> <vercel.json path>
import http from 'node:http';
import http2 from 'node:http2';
import net from 'node:net';
import fs from 'node:fs';

import zlib from 'node:zlib';

const [distArg, portArg, vercelPath] = process.argv.slice(2); const dist = path.resolve(distArg);
const port = Number(portArg);
const cfg = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
const rewrites = (cfg.rewrites ?? []).map((r) => ({ re: new RegExp(`^${r.source}$`), dest: r.destination }));
const headers = (cfg.headers ?? []).map((h) => ({ re: new RegExp(`^${h.source}$`), list: h.headers }));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.xml', '.webmanifest']);
const cache = new Map();

function resolveFile(pathname) {
  const clean = decodeURIComponent(pathname) === '/' ? '/index.html' : decodeURIComponent(pathname);
  const abs = path.join(dist, clean);
  if (abs.startsWith(dist) && fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  for (const r of rewrites) {
    if (r.re.test(clean)) {
      const f = path.join(dist, r.dest);
      if (fs.existsSync(f)) return f;
    }
  }
  return null;
}

function proxy(req, res) {
  const p = http.request({ host: '127.0.0.1', port: 5092, path: req.url, method: req.method, headers: Object.fromEntries(Object.entries({ ...req.headers, host: 'localhost:5092' }).filter(([k]) => !k.startsWith(':'))) }, (up) => {
    const hh = { ...up.headers }; delete hh.connection; delete hh['transfer-encoding']; delete hh['keep-alive'];
    res.writeHead(up.statusCode ?? 502, hh);
    up.pipe(res);
  });
  p.on('error', () => { res.statusCode = 502; res.end('bad gateway'); });
  req.pipe(p);
}

const tls = { key: fs.readFileSync(new URL('./key.pem', import.meta.url)), cert: fs.readFileSync(new URL('./cert.pem', import.meta.url)), allowHTTP1: true };
const handler = (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/hubs') || url.pathname === '/health') return proxy(req, res);
  const file = resolveFile(url.pathname);
  if (!file) { res.statusCode = 404; return res.end('not found'); }
  const ext = path.extname(file).toLowerCase();
  const h = { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', Vary: 'Accept-Encoding' };
  for (const rule of headers) if (rule.re.test(url.pathname)) for (const x of rule.list) h[x.key] = x.value;
  if (!h['Cache-Control']) h['Cache-Control'] = ext === '.html' ? 'public, max-age=0, must-revalidate' : 'public, max-age=0, must-revalidate';
  let body = cache.get(file);
  if (!body) { body = { raw: fs.readFileSync(file) }; if (COMPRESSIBLE.has(ext)) body.br = zlib.brotliCompressSync(body.raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }); cache.set(file, body); }
  const useBr = body.br && /\bbr\b/.test(req.headers['accept-encoding'] ?? '');
  if (useBr) h['Content-Encoding'] = 'br';
  const out = useBr ? body.br : body.raw;
  h['Content-Length'] = out.length;
  res.writeHead(200, h);
  res.end(req.method === 'HEAD' ? undefined : out);
};
const server = http2.createSecureServer(tls, handler);
server.on('upgrade', (req, socket, head) => {
  const up = net.connect(5092, '127.0.0.1', () => {
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.entries({ ...req.headers, host: 'localhost:5092' }).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
    if (head?.length) up.write(head);
    up.pipe(socket); socket.pipe(up);
  });
  up.on('error', () => socket.destroy()); socket.on('error', () => up.destroy());
});
server.listen(port, () => console.log(`serving ${dist} on ${port}`));
