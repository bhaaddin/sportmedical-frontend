/* ══════════════════════════════════════════════════════════════
   ANNOUNCE THE APPLICATION'S FIRST SCREEN IN dist/app.html  (runs after the prerender)

   See app-shell-preload-lib.mjs for what is written and why. Never fails the build over a missing file: a shell
   without the block is the shell Vite wrote, which works, only slower - so this says what it could not do and exits 0.
   A shell that IS there but is not the shell (a prerendered page) is a bug and does fail.
   ══════════════════════════════════════════════════════════════ */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ENTRY, buildPreloadBlock, injectPreloadBlock } from './app-shell-preload-lib.mjs';
import { assetsForEntry } from './prerender-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.APP_SHELL_DIST ? path.resolve(process.env.APP_SHELL_DIST) : path.join(root, 'dist');
const log = (message) => console.log(`[app-shell-preload] ${message}`);

const shellPath = path.join(dist, 'app.html');
const manifestPath = path.join(dist, '.vite', 'manifest.json');
if (!existsSync(shellPath) || !existsSync(manifestPath)) {
  log(`no ${existsSync(shellPath) ? 'manifest' : 'app.html'} in ${dist} - nothing written`);
  process.exit(0);
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
let appCss = '';
for (const file of assetsForEntry(manifest, APP_ENTRY).css) appCss += `${await readFile(path.join(dist, file), 'utf8')}\n`;

const { html, report } = buildPreloadBlock(manifest, appCss);
const shell = await readFile(shellPath, 'utf8');
await writeFile(shellPath, injectPreloadBlock(shell, html));
log(
  `app.html: ${report.entryJs} scripts, ${report.entryCss} stylesheets, ${report.fonts} fonts, ${report.screens} screens announced` +
    (report.skipped.length > 0 ? ` (not in the manifest: ${report.skipped.join(', ')})` : ''),
);
