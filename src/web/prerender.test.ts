import { describe, expect, it } from 'vitest';
import { assetsForEntry, buildPage, escapeHtml, pickFontPreloads, safeJson } from '../../scripts/prerender-lib.mjs';

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
      canonical: 'https://example.cz/web',
    });
    expect(out).toContain('<link rel="preload" as="font" type="font/woff2" href="/assets/archivo-latin-800-normal-x.woff2" crossorigin />');
    expect(out).toContain('<link rel="modulepreload" crossorigin href="/assets/entry-client-x.js" />');
    expect(out).toContain('<style data-web-fonts>@font-face{font-family:Archivo}</style>');
    expect(out).toContain('<link rel="canonical" href="https://example.cz/web" />');
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
