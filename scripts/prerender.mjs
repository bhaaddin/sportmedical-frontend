/* ══════════════════════════════════════════════════════════════
   PRERENDER THE PUBLIC SITE  (runs after `vite build` and `vite build --ssr`)

   For every route of the public site (src/web/routes.ts) this writes a complete
   HTML page at the root of the domain — the landing page is dist/index.html, the others
   dist/sluzby/index.html, dist/cenik/index.html, … — with the markup, exactly the CSS it
   uses, the fonts, and a snapshot of the clinic's data, so the first paint needs no
   JavaScript and no API. The browser then hydrates it and refreshes the data.

   Because the landing page takes over dist/index.html, the SPA shell that Vite wrote there
   (what the application — the staff portal, /objednat, /portal … — is served from) is first
   copied to dist/app.html; vercel.json sends every address that is not a file to it. The
   copy is made once: a second run finds app.html and never copies a prerendered page over it.

   The API is asked for prices, clinic details, site content and discount tiers
   with a short timeout. It may be asleep (the free Render plan) or not know an
   endpoint yet — in either case the page is rendered from the defaults, a line
   says so, and the build CONTINUES: the API can never fail the build.
   A bug in the rendering itself does fail it (the previous deployment stays live).

   Environment:
     PRERENDER_API_URL      default https://sportmedical-api.onrender.com  ("off" = do not ask)
     PRERENDER_TIMEOUT_MS   default 8000 per request (all four run in parallel)
     PRERENDER_SITE_URL     e.g. https://sportmedical-diagnostics.cz — adds canonical/og:url
     PRERENDER_INDEXABLE    "1" removes the noindex of the template (set when the domain moves here)
   ══════════════════════════════════════════════════════════════ */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ensureAppShell } from './app-shell.mjs';
import { assetsForEntry, buildPage, pickFontPreloads } from './prerender-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ssrDir = path.join(root, 'node_modules', '.cache', 'sm-ssr');

const API = (process.env.PRERENDER_API_URL || 'https://sportmedical-api.onrender.com').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.PRERENDER_TIMEOUT_MS) > 0 ? Number(process.env.PRERENDER_TIMEOUT_MS) : 8000;
const SITE_URL = (process.env.PRERENDER_SITE_URL || '').replace(/\/+$/, '');
const INDEXABLE = process.env.PRERENDER_INDEXABLE === '1';

const log = (message) => console.log(`[prerender] ${message}`);

/** One GET; null on ANY failure (timeout, 404, DNS, bad JSON). Never throws. */
async function getJson(endpoint) {
  if (API === 'off') return null;
  const started = Date.now();
  try {
    const response = await fetch(`${API}${endpoint}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      log(`${endpoint}: HTTP ${response.status} — using defaults`);
      return null;
    }
    const body = await response.json();
    log(`${endpoint}: ok (${Date.now() - started} ms)`);
    return body;
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? `no answer in ${TIMEOUT_MS} ms` : (error?.cause?.code ?? error?.message ?? 'failed');
    log(`${endpoint}: ${reason} — using defaults`);
    return null;
  }
}

async function main() {
  const shell = await ensureAppShell(dist);
  if (shell.created) log('SPA shell kept as dist/app.html');
  const templatePath = shell.file;
  const entryFile = ['entry-server.js', 'entry-server.mjs'].map((f) => path.join(ssrDir, f)).find((f) => existsSync(f));
  if (entryFile === undefined) throw new Error(`the server bundle is missing in ${ssrDir} — run \`npm run build:ssr\` first`);

  const template = await readFile(templatePath, 'utf8');
  const manifestPath = path.join(dist, '.vite', 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};

  // The public bundle's own files: preload its JS, inline its (font) CSS, preload the first-screen faces.
  const web = assetsForEntry(manifest, 'src/web/entry-client.tsx');
  let inlineCss = '';
  for (const file of web.css) inlineCss += `${await readFile(path.join(dist, file), 'utf8')}\n`;
  const fontPreload = pickFontPreloads(inlineCss);
  if (web.js.length === 0) log('warning: the public bundle is not in the manifest — pages will not be preloaded');

  const ssr = await import(pathToFileURL(entryFile).href);

  const [priceList, clinic, siteContent, discountTiers] = await Promise.all([
    getJson('/api/public/price-list'),
    getJson('/api/public/clinic'),
    getJson('/api/public/site-content'),
    getJson('/api/public/discount-tiers'),
  ]);
  const data = ssr.normalizeBootstrap({ priceList, clinic, siteContent, discountTiers }, Date.now());
  log(
    `data: prices ${data.priceList ? 'from API' : 'defaults ("—")'}, clinic ${data.clinic ? 'from API' : 'defaults'}, ` +
      `content ${data.siteContent ? 'from API' : 'defaults'}, discounts ${data.discountTiers ? 'from API' : 'hidden'}`,
  );

  let written = 0;
  for (const route of ssr.WEB_ROUTES) {
    const result = ssr.render(route.path, data);
    if (!result.found) throw new Error(`route ${route.path} rendered as not-found`);
    if (!result.html.includes('<h1')) throw new Error(`route ${route.path} has no <h1> in its HTML`);

    const page = buildPage(template, {
      html: result.html,
      styles: result.styles,
      title: result.title,
      description: result.description,
      data: result.data,
      inlineCss,
      modulePreload: web.js,
      fontPreload,
      indexable: INDEXABLE,
      canonical: SITE_URL ? `${SITE_URL}${route.path}` : undefined,
    });

    const file = path.join(dist, ssr.routeOutputFile(route));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, page, 'utf8');
    written += 1;
    log(`${route.path.padEnd(16)} → ${path.relative(root, file)}  (${(Buffer.byteLength(page) / 1024).toFixed(1)} kB)`);
  }
  log(`${written} pages written.`);
}

main().catch((error) => {
  console.error('[prerender] FAILED:', error);
  process.exit(1);
});
