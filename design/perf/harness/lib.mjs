import { pathToFileURL } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/* playwright-core: PLAYWRIGHT_CORE=<folder of playwright-core>; Chromium: CHROME=<chrome.exe> or the ms-playwright cache. */
export async function pw() {
  const dir = process.env.PLAYWRIGHT_CORE;
  const m = dir ? await import(pathToFileURL(join(dir, 'index.js')).href) : await import('playwright-core');
  return m.default ?? m;
}

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), 'AppData', 'Local', 'ms-playwright');
  if (existsSync(cache)) {
    for (const d of readdirSync(cache).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
      const exe = join(cache, d, 'chrome-win64', 'chrome.exe');
      if (existsSync(exe)) return exe;
    }
  }
  throw new Error('Set CHROME=<path to chrome.exe>');
}
export const CHROME = findChrome();

/* A sign-in through the API under test; SM_EMAIL / SM_PW from the environment (the dev-only login file of the dev stack). */
export async function login(base) {
  const r = await fetch(`${base}/api/v1/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: process.env.SM_EMAIL ?? 'admin@sportmedical.cz', password: process.env.SM_PW }),
  });
  const j = await r.json();
  const v = j.value ?? j;
  if (!v.accessToken) throw new Error(`login failed ${JSON.stringify(j).slice(0, 200)}`);
  const parts = (v.account.displayName || '').split(' ');
  return {
    token: v.accessToken,
    user: JSON.stringify({ id: v.account.userId, email: v.account.email, firstName: parts[0], lastName: parts.slice(1).join(' '), role: v.account.role }),
    permissions: JSON.stringify(v.permissions ?? []),
  };
}
