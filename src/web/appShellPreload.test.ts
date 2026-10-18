import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_ENTRY,
  BLOCK_END,
  BLOCK_START,
  SCREENS,
  STAFF_APP,
  buildPreloadBlock,
  injectPreloadBlock,
} from '../../scripts/app-shell-preload-lib.mjs';
import { apiOriginOf } from './apiOrigin';

const SHELL = `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="UTF-8" />
    <title>SportMedical Diagnostics</title>
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-abc.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

/* a miniature of what Vite writes: the entry imports react + a shared chunk, the staff portal and two screens hang off it */
const MANIFEST = {
  'src/web/appEntry.tsx': { file: 'assets/appEntry-1.js', css: ['assets/appEntry-1.css'], imports: ['_react-1.js', '_shared-1.js'] },
  '_react-1.js': { file: 'assets/react-1.js' },
  '_shared-1.js': { file: 'assets/shared-1.js', imports: ['_react-1.js'] },
  'src/StaffApp.tsx': { file: 'assets/StaffApp-1.js', css: ['assets/StaffApp-1.css'], imports: ['_react-1.js', '_shared-1.js', '_shell-1.js'] },
  '_shell-1.js': { file: 'assets/shell-1.js' },
  'src/pages/Login.tsx': { file: 'assets/Login-1.js', imports: ['_react-1.js', '_shared-1.js'] },
  'src/pages/Dashboard.tsx': { file: 'assets/Dashboard-1.js', imports: ['_shared-1.js', '_shell-1.js', '_dash-1.js'] },
  '_dash-1.js': { file: 'assets/dash-1.js' },
};
const FONT_CSS =
  '@font-face{src:url(/assets/public-sans-latin-400-normal-aaa.woff2) format("woff2")}' +
  '@font-face{src:url(/assets/public-sans-latin-ext-600-normal-bbb.woff2) format("woff2")}' +
  '@font-face{src:url(/assets/public-sans-latin-800-normal-ccc.woff2) format("woff2")}' +
  '@font-face{src:url(/assets/inter-latin-400-normal-ddd.woff2) format("woff2")}';

describe('the SPA shell announces the first screen', () => {
  const { html, report } = buildPreloadBlock(MANIFEST, FONT_CSS);

  it('preloads the application entry and everything it imports, plus its CSS', () => {
    for (const file of ['/assets/appEntry-1.js', '/assets/react-1.js', '/assets/shared-1.js']) {
      expect(html).toContain(`<link rel="modulepreload" crossorigin href="${file}" />`);
    }
    expect(html).toContain('<link rel="stylesheet" crossorigin href="/assets/appEntry-1.css" />');
    expect(report.entryJs).toBe(3);
  });

  it('preloads only the faces the first screen is set in (Public Sans 400 and 600), not every weight', () => {
    expect(html).toContain('href="/assets/public-sans-latin-400-normal-aaa.woff2"');
    expect(html).toContain('href="/assets/public-sans-latin-ext-600-normal-bbb.woff2"');
    expect(html).not.toContain('-800-normal-ccc');
    expect(html).not.toContain('inter-latin');
    expect(report.fonts).toBe(2);
  });

  it('carries one inline script that adds the chunk of the address, and the portal only for a signed-in browser', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
    expect(script).toContain('^/login$');
    expect(script).toContain('^/prehled$');
    expect(script).toContain('localStorage.getItem("token")');
    expect(script).toContain('/assets/Login-1.js');
    /* the dashboard rule lists what the entry does NOT already carry: its own file, the shell and its own part */
    expect(script).toContain('/assets/Dashboard-1.js');
    expect(script).toContain('/assets/dash-1.js');
    expect(script).toContain('/assets/StaffApp-1.js');
    expect(script).not.toContain('/assets/react-1.js');
    expect(() => new Function(script)).not.toThrow();
  });

  it('skips a screen the manifest does not know instead of failing', () => {
    expect(report.skipped).toContain('src/pages/Settings.tsx');
    expect(report.screens).toBe(2);
  });

  it('refuses a manifest without the application entry', () => {
    expect(() => buildPreloadBlock({}, '')).toThrow(/appEntry/);
  });
});

describe('writing the block into the shell', () => {
  const { html } = buildPreloadBlock(MANIFEST, FONT_CSS);

  it('puts it before </head> and leaves the rest of the shell as Vite wrote it', () => {
    const out = injectPreloadBlock(SHELL, html);
    expect(out.indexOf(BLOCK_START)).toBeGreaterThan(out.indexOf('<title>'));
    expect(out.indexOf(BLOCK_END)).toBeLessThan(out.indexOf('</head>'));
    expect(out).toContain('<script type="module" crossorigin src="/assets/index-abc.js"></script>');
    expect(out).toContain('<div id="root"></div>');
  });

  it('is safe to run twice: the second run replaces the block', () => {
    const once = injectPreloadBlock(SHELL, html);
    const twice = injectPreloadBlock(once, html);
    expect(twice).toBe(once);
    expect(twice.split(BLOCK_START)).toHaveLength(2);
  });

  it('never writes into a prerendered public page', () => {
    expect(() => injectPreloadBlock(SHELL.replace('<head>', '<head data-prerendered>'), html)).toThrow(/prerendered/);
  });
});

describe('every announced screen exists in the source', () => {
  const root = path.resolve(__dirname, '..', '..');
  it.each([APP_ENTRY, STAFF_APP, ...SCREENS.map((screen) => screen[1])])('%s', (file) => {
    expect(existsSync(path.join(root, file)), `${file} was renamed or removed: update scripts/app-shell-preload-lib.mjs`).toBe(true);
  });
});

describe('the API origin hint', () => {
  it('is the origin of an absolute address and nothing else', () => {
    expect(apiOriginOf('https://api.example.test/')).toBe('https://api.example.test');
    expect(apiOriginOf(' https://api.example.test:8443/base/path ')).toBe('https://api.example.test:8443');
  });
  it('is nothing when the API is on the page origin or the value is not an address', () => {
    expect(apiOriginOf('')).toBeNull();
    expect(apiOriginOf(undefined)).toBeNull();
    expect(apiOriginOf('/api')).toBeNull();
    expect(apiOriginOf('ftp://files.example.test')).toBeNull();
  });
});
