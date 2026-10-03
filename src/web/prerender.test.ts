import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assetsForEntry, buildPage, escapeHtml, isPrerendered, pickFontPreloads, safeJson } from '../../scripts/prerender-lib.mjs';
import { ensureAppShell } from '../../scripts/app-shell.mjs';
import { WEB_ROUTES, routeOutputFile } from './routes';

const TEMPLATE = `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="UTF-8" />
    <title>SportMedical Diagnostics</title>
    <meta name="robots" content="noindex" />
    <script type="module" src="/assets/index-abc.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

const PAGE = {
  html: '<h1>Výkon</h1>',
  styles: '<style data-emotion="css a">.a{color:red}</style>',
  title: 'Úvod — A & B',
  description: 'Popis "se" <znaky>',
  data: { builtAt: 1, note: '</script><script>alert(1)</script>' },
};

describe('buildPage', () => {
  it('fills #root, sets title/description, injects the CSS and the snapshot', () => {
    const out = buildPage(TEMPLATE, PAGE);
    expect(out).toContain('<div id="root" data-prerendered="1"><h1>Výkon</h1></div>');
    expect(out).toContain('<title>Úvod — A &amp; B</title>');
    expect(out).toContain('content="Popis &quot;se&quot; &lt;znaky&gt;"');
    expect(out).toContain('<style data-emotion="css a">');
    expect(out).toContain('window.__SM_WEB__=');
    // Everything is inside <head>, before the script of the SPA shell is irrelevant; the head closes once.
    expect(out.match(/<\/head>/g)).toHaveLength(1);
  });

  it('keeps noindex by default and drops it only when asked (the domain moved here)', () => {
    expect(buildPage(TEMPLATE, PAGE)).toContain('name="robots" content="noindex"');
    expect(buildPage(TEMPLATE, { ...PAGE, indexable: true })).not.toContain('name="robots"');
  });

  it('cannot be broken out of by data containing </script>', () => {
    const out = buildPage(TEMPLATE, PAGE);
    const script = out.slice(out.indexOf('window.__SM_WEB__='));
    expect(script.slice(0, script.indexOf('</script>'))).not.toContain('<script>alert');
    expect(out).not.toContain('<script>alert(1)</script>');
  });

  it('adds preloads, inlined font CSS and a canonical URL when given', () => {
    const out = buildPage(TEMPLATE, {
      ...PAGE,
      fontPreload: ['/assets/archivo-latin-800-normal-x.woff2'],
      modulePreload: ['/assets/entry-client-x.js'],
      inlineCss: '@font-face{font-family:Archivo}',
      canonical: 'https://example.cz/sluzby',
    });
    expect(out).toContain('<link rel="preload" as="font" type="font/woff2" href="/assets/archivo-latin-800-normal-x.woff2" crossorigin />');
    expect(out).toContain('<link rel="modulepreload" crossorigin href="/assets/entry-client-x.js" />');
    expect(out).toContain('<style data-web-fonts>@font-face{font-family:Archivo}</style>');
    expect(out).toContain('<link rel="canonical" href="https://example.cz/sluzby" />');
  });

  it('refuses a template it cannot fill instead of writing a broken page', () => {
    expect(() => buildPage('<html><head></head><body></body></html>', PAGE)).toThrow(/root/);
    expect(() => buildPage('<div id="root"></div>', PAGE)).toThrow(/head/);
  });
});

describe('the other helpers', () => {
  it('escapes HTML and JSON for inline scripts', () => {
    expect(escapeHtml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
    expect(safeJson({ a: '<b>&' })).not.toMatch(/[<>&]/);
    expect(JSON.parse(safeJson({ a: '<b>&' }))).toEqual({ a: '<b>&' });
  });

  it('collects the static imports of an entry from the Vite manifest, with their CSS', () => {
    const manifest = {
      'src/web/entry-client.tsx': { file: 'assets/entry.js', css: ['assets/entry.css'], imports: ['_react.js', '_mui.js'] },
      '_react.js': { file: 'assets/react.js' },
      '_mui.js': { file: 'assets/mui.js', imports: ['_react.js'] },
    };
    expect(assetsForEntry(manifest, 'src/web/entry-client.tsx')).toEqual({
      js: ['/assets/entry.js', '/assets/react.js', '/assets/mui.js'],
      css: ['/assets/entry.css'],
    });
    expect(assetsForEntry({}, 'nope')).toEqual({ js: [], css: [] });
  });

  it('picks the first-screen faces for preloading (Latin and Latin-ext, two weights)', () => {
    const css = [
      'url(/assets/archivo-latin-800-normal-A.woff2)', 'url(/assets/archivo-latin-ext-800-normal-B.woff2)',
      'url(/assets/archivo-latin-500-normal-C.woff2)', 'url(/assets/public-sans-latin-400-normal-D.woff2)',
      'url(/assets/public-sans-vietnamese-400-normal-E.woff2)', 'url(/assets/public-sans-latin-ext-400-normal-F.woff2)',
    ].join(' ');
    expect(pickFontPreloads(css)).toEqual([
      '/assets/archivo-latin-800-normal-A.woff2', '/assets/archivo-latin-ext-800-normal-B.woff2',
      '/assets/public-sans-latin-400-normal-D.woff2', '/assets/public-sans-latin-ext-400-normal-F.woff2',
    ]);
  });
});

/* The output layout: the public site is the root of the domain, the SPA shell moves to app.html. */
describe('the output layout of the build (dist/)', () => {
  const dirs: string[] = [];
  const makeDist = async (index: string, app?: string) => {
    const dist = await mkdtemp(path.join(tmpdir(), 'sm-dist-'));
    dirs.push(dist);
    await writeFile(path.join(dist, 'index.html'), index, 'utf8');
    if (app !== undefined) await writeFile(path.join(dist, 'app.html'), app, 'utf8');
    return dist;
  };
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("keeps Vite's SPA shell as dist/app.html before the landing page takes dist/index.html", async () => {
    const dist = await makeDist(TEMPLATE);
    const shell = await ensureAppShell(dist);
    expect(shell).toEqual({ file: path.join(dist, 'app.html'), created: true });
    expect(await readFile(shell.file, 'utf8')).toBe(TEMPLATE);
  });

  it('never copies a prerendered page over an existing app.html (a second run is harmless)', async () => {
    const prerendered = buildPage(TEMPLATE, PAGE);
    const dist = await makeDist(prerendered, TEMPLATE);
    const shell = await ensureAppShell(dist);
    expect(shell.created).toBe(false);
    expect(await readFile(path.join(dist, 'app.html'), 'utf8')).toBe(TEMPLATE);
  });

  it('refuses to turn a prerendered index.html into the shell when app.html is missing', async () => {
    const dist = await makeDist(buildPage(TEMPLATE, PAGE));
    await expect(ensureAppShell(dist)).rejects.toThrow(/already a prerendered page/);
    expect(existsSync(path.join(dist, 'app.html'))).toBe(false);
  });

  it('writes every page at the root: dist/index.html is the landing page, dist/app.html stays the shell', async () => {
    const dist = await makeDist(TEMPLATE);
    const { file } = await ensureAppShell(dist);
    const template = await readFile(file, 'utf8');
    for (const route of WEB_ROUTES) {
      const target = path.join(dist, routeOutputFile(route));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, buildPage(template, { ...PAGE, html: `<h1>${route.id}</h1>` }), 'utf8');
    }
    const landing = await readFile(path.join(dist, 'index.html'), 'utf8');
    expect(isPrerendered(landing)).toBe(true);
    expect(landing).toContain('<h1>landing</h1>');
    expect(isPrerendered(await readFile(path.join(dist, 'app.html'), 'utf8'))).toBe(false);
    for (const route of WEB_ROUTES.filter((r) => r.path !== '/')) {
      expect(existsSync(path.join(dist, route.path.slice(1), 'index.html')), route.path).toBe(true);
    }
    expect(existsSync(path.join(dist, 'web'))).toBe(false);
  });
});
