/*
 * Fetching the NEXT likely screen's script while the person is still reading this one - never at the cost of this one.
 *
 * Two triggers, both after the page has painted and the browser is idle:
 *   - a short list per screen (the sign-in page expects the overview, the overview expects the calendar, the clubs
 *     list expects a club's screen ...), and
 *   - the pointer / keyboard focus / finger arriving on a link (the menu items, a card): the click that follows
 *     finds the script already in the cache.
 *
 * What is fetched is the screen's script (`<link rel="modulepreload">`) and its styles only as a low-priority prefetch:
 * nothing runs and nothing is styled until the person really goes there. The list of files per address is written into
 * dist/app.html by scripts/app-shell-preload.mjs (`window.__smPrefetch`); without it (the dev server, the tests) every
 * call here is a no-op. A connection that is slow or asked to save data fetches nothing.
 */
import { afterFirstPaint } from './utils/afterFirstPaint';

declare global {
  interface Window {
    __smPrefetch?: (pathname: string, portal?: boolean) => void;
  }
}

const requested = new Set<string>();

/** After the first paint and an idle moment, wait this much longer: the screen's own data should be on its way home first. */
export const PREFETCH_GRACE_MS = 2_500;

/** Fetch the script of the screen at `pathname` once. `portal`: the person is about to sign in, so the staff portal too. */
export function prefetchScreen(pathname: string, portal = false): void {
  const key = `${portal ? 'p:' : ''}${pathname}`;
  if (requested.has(key)) return;
  requested.add(key);
  try {
    window.__smPrefetch?.(pathname, portal);
  } catch {
    /* a hint; never an error */
  }
}

/** The screens a person is likely to open next, in order of how likely. Plain addresses, nothing per patient or club. */
export function likelyNext(pathname: string): { path: string; portal?: boolean }[] {
  if (pathname === '/login') return [{ path: '/prehled', portal: true }, { path: '/planovani', portal: true }];
  if (pathname === '/prehled') return [{ path: '/planovani' }, { path: '/clubs' }, { path: '/patients' }];
  if (pathname === '/planovani') return [{ path: '/clubs' }, { path: '/patients' }];
  if (pathname === '/clubs') return [{ path: '/planovani' }];
  if (pathname === '/patients') return [{ path: '/planovani' }];
  return [];
}

/**
 * Code that is also RUN ahead of time, not just fetched: the sign-in page's next stop. After "Přihlásit se" the portal and the
 * overview are on screen at once instead of being fetched, parsed and evaluated while the person waits (that was ~300 ms
 * on a phone). Evaluating them only defines components - no styles, no requests, nothing visible - so it is safe to do
 * while somebody types a password. Kept to the one transition where the person is certain to go on.
 */
const WARM_BY_SCREEN: Record<string, readonly (() => Promise<unknown>)[]> = {
  '/login': [() => import('./StaffApp'), () => import('./pages/Dashboard')],
};

/** False on a connection that is slow or told to save data: a hint must never cost somebody's data plan. */
export function connectionAllowsPrefetch(): boolean {
  const connection = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (connection === undefined) return true;
  if (connection.saveData === true) return false;
  return connection.effectiveType === undefined || !/(^|-)2g$/.test(connection.effectiveType);
}

/** The address a link points at inside this site, or null (another site, a hash, a download, a `target`). */
export function internalPath(anchor: HTMLAnchorElement): string | null {
  const href = anchor.getAttribute('href');
  if (href === null || !href.startsWith('/') || href.startsWith('//')) return null;
  if (anchor.target !== '' && anchor.target !== '_self') return null;
  return href.split('?')[0]?.split('#')[0] ?? null;
}

/**
 * Starts both triggers for the screen at `current`. Returns the function that stops them.
 * Safe to call in a test or on a server: it only touches `window` inside, and only after the first paint.
 */
export function startPrefetching(current: string): () => void {
  if (typeof window === 'undefined' || !connectionAllowsPrefetch()) return () => undefined;
  let live = true;
  let timer: ReturnType<typeof setTimeout> | undefined;

  void afterFirstPaint(4_000).then(() => {
    if (!live) return;
    timer = setTimeout(() => {
      if (!live) return;
      for (const next of likelyNext(current)) prefetchScreen(next.path, next.portal === true);
      for (const load of WARM_BY_SCREEN[current] ?? []) void load().catch(() => undefined);
    }, PREFETCH_GRACE_MS);
  });

  const onIntent = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const path = internalPath(anchor);
    if (path !== null) prefetchScreen(path);
  };
  /* pointerover = a mouse arriving, touchstart = a finger going down (a tap loads it a beat before the click), focusin = a key. */
  document.addEventListener('pointerover', onIntent, { passive: true });
  document.addEventListener('touchstart', onIntent, { passive: true });
  document.addEventListener('focusin', onIntent);
  return () => {
    live = false;
    if (timer !== undefined) clearTimeout(timer);
    document.removeEventListener('pointerover', onIntent);
    document.removeEventListener('touchstart', onIntent);
    document.removeEventListener('focusin', onIntent);
  };
}
