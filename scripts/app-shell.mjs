/* ══════════════════════════════════════════════════════════════
   THE SPA SHELL OF THE APPLICATION  (dist/app.html)

   The public site is the root of the domain, so the prerendered landing page takes the name
   dist/index.html. The page Vite wrote there — the shell the application (the staff portal,
   /objednat, /portal …) runs from — is kept as dist/app.html first; vercel.json and
   `vite preview` serve it for every address that is not a file.

   Safe to run twice: once app.html exists it is never copied again, so a prerendered page
   can never overwrite the shell.
   ══════════════════════════════════════════════════════════════ */

import { existsSync } from 'node:fs';
import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { isPrerendered } from './prerender-lib.mjs';

/**
 * Makes sure `<dist>/app.html` is the SPA shell and returns its path.
 * @param {string} dist  the build output directory
 * @returns {Promise<{ file: string, created: boolean }>}
 */
export async function ensureAppShell(dist) {
  const indexPath = path.join(dist, 'index.html');
  const appPath = path.join(dist, 'app.html');
  if (existsSync(appPath)) return { file: appPath, created: false };

  if (!existsSync(indexPath)) throw new Error('dist/index.html is missing — run `vite build` first');
  if (isPrerendered(await readFile(indexPath, 'utf8'))) {
    throw new Error('dist/index.html is already a prerendered page and dist/app.html is missing — run `vite build` again');
  }
  await copyFile(indexPath, appPath);
  return { file: appPath, created: true };
}
