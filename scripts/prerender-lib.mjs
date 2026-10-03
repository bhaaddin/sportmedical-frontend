/* ══════════════════════════════════════════════════════════════
   PRERENDER — PURE HELPERS

   Everything scripts/prerender.mjs does to a string lives here, with no file or
   network access, so it can be unit-tested (src/web/prerender.test.ts).
   ══════════════════════════════════════════════════════════════ */

/** JSON that is safe inside an inline <script>: no "</script>", no line separators. */
const BS = String.fromCharCode(92); // a backslash, spelled so no tool can eat it
const unicodeEscape = (code) => `${BS}u${code}`;

export function safeJson(value) {
  return JSON.stringify(value)
    .replaceAll('<', unicodeEscape('003c'))
    .replaceAll('>', unicodeEscape('003e'))
    .replaceAll('&', unicodeEscape('0026'))
    .replaceAll(String.fromCharCode(0x2028), unicodeEscape('2028'))
    .replaceAll(String.fromCharCode(0x2029), unicodeEscape('2029'));
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The JS and CSS files a manifest entry needs, following static imports (not dynamic ones).
 * `manifest` is Vite's dist/.vite/manifest.json; returned paths start with '/'.
 */
export function assetsForEntry(manifest, entryKey) {
  const js = [];
  const css = [];
  const seen = new Set();
  const visit = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (chunk === undefined) return;
    js.push(`/${chunk.file}`);
    for (const file of chunk.css ?? []) css.push(`/${file}`);
    for (const imported of chunk.imports ?? []) visit(imported);
  };
  visit(entryKey);
  return { js: [...new Set(js)], css: [...new Set(css)] };
}

/** Is this HTML a page the prerender wrote (and not the SPA shell Vite produced)? */
export function isPrerendered(html) {
  return html.includes('data-prerendered');
}

/** The woff2 files worth preloading: the faces the first screen is set in, Latin and Latin-ext (Czech). */
const PRELOAD_FACES = [/^archivo-latin(?:-ext)?-800-normal/, /^public-sans-latin(?:-ext)?-400-normal/];

export function pickFontPreloads(cssText) {
  const urls = [...cssText.matchAll(/url\((\/assets\/[^)\s]+?\.woff2)\)/g)].map((m) => m[1]);
  const picked = [];
  for (const url of urls) {
    const name = url.slice(url.lastIndexOf('/') + 1);
    if (PRELOAD_FACES.some((face) => face.test(name)) && !picked.includes(url)) picked.push(url);
  }
  return picked;
}

/**
 * Turns the built index.html (the template) into one prerendered page.
 *
 * @param {string} template  the SPA shell as Vite wrote it (dist/app.html)
 * @param {object} page
 * @param {string} page.html         markup for inside #root
 * @param {string} page.styles       emotion <style> tags for exactly this page
 * @param {string} page.title
 * @param {string} page.description
 * @param {object} page.data         snapshot embedded as window.__SM_WEB__
 * @param {string} [page.inlineCss]  CSS (fonts) inlined into <head>
 * @param {string[]} [page.modulePreload]  JS files of the public bundle
 * @param {string[]} [page.fontPreload]    woff2 files
 * @param {boolean} [page.indexable] drop the template's noindex
 * @param {string} [page.canonical]  absolute URL of this page
 */
export function buildPage(template, page) {
  if (!template.includes('<div id="root"></div>')) {
    throw new Error('prerender: the template has no <div id="root"></div> to fill');
  }
  if (!template.includes('</head>')) throw new Error('prerender: the template has no </head>');

  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);

  const head = [];
  head.push(`<meta name="description" content="${description}" />`);
  head.push(`<meta property="og:type" content="website" />`);
  head.push(`<meta property="og:title" content="${title}" />`);
  head.push(`<meta property="og:description" content="${description}" />`);
  head.push('<meta property="og:locale" content="cs_CZ" />');
  if (page.canonical) {
    head.push(`<link rel="canonical" href="${escapeHtml(page.canonical)}" />`);
    head.push(`<meta property="og:url" content="${escapeHtml(page.canonical)}" />`);
  }
  for (const font of page.fontPreload ?? []) {
    head.push(`<link rel="preload" as="font" type="font/woff2" href="${escapeHtml(font)}" crossorigin />`);
  }
  for (const file of page.modulePreload ?? []) {
    head.push(`<link rel="modulepreload" crossorigin href="${escapeHtml(file)}" />`);
  }
  if (page.inlineCss) head.push(`<style data-web-fonts>${page.inlineCss}</style>`);
  head.push(page.styles);
  head.push(`<script>window.__SM_WEB__=${safeJson(page.data)}</script>`);

  let out = template;
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  if (page.indexable) out = out.replace(/\s*<meta name="robots"[^>]*>/, '');
  out = out.replace('</head>', `${head.join('\n    ')}\n  </head>`);
  out = out.replace('<div id="root"></div>', `<div id="root" data-prerendered="1">${page.html}</div>`);
  return out;
}
