/* ══════════════════════════════════════════════════════════════
   THE MOTION SETTING — one value, three states, remembered in this browser.

     'plné'     everything: scroll scenes, parallax, smooth scroll, kinetic type, springs, shaders;
     'omezené'  short fades and small feedback only (a press, a dialog pop, a 6 px nudge) - nothing travels,
                nothing is scrubbed by the scroll, no smooth scroll, shaders are a still;
     'vypnuto'  no movement at all: every change is instant, no transform is ever written.

   Stored in localStorage `sm-motion`. Nothing stored (or junk) follows the system: `prefers-reduced-motion: reduce`
   means 'vypnuto', otherwise 'plné'. An explicit choice wins over the system, because the person made it on purpose
   in Nastavení -> Osobní -> Vzhled.

   The state is mirrored on <html data-motion="full|reduced|off"> (a tiny inline script sets it before the first
   paint of every prerendered page, scripts/prerender-lib.mjs MOTION_BOOT_SCRIPT), so CSS can switch movement off
   without waiting for React, and src/motion/motion.css kills every stray transition when it says "off".
   ══════════════════════════════════════════════════════════════ */

import { cssVariables } from './tokens';

export type MotionPreference = 'plné' | 'omezené' | 'vypnuto';

export const MOTION_STORAGE_KEY = 'sm-motion';
export const MOTION_MODES: readonly MotionPreference[] = ['plné', 'omezené', 'vypnuto'];
export const DEFAULT_MOTION: MotionPreference = 'plné';

/** Labels and one-line explanations, Czech, for the setting. */
export const MOTION_LABELS: Record<MotionPreference, { label: string; hint: string }> = {
  plné: { label: 'Plné', hint: 'Animace, plynulé posouvání a efekty při rolování' },
  omezené: { label: 'Omezené', hint: 'Jen krátké prolnutí a odezva tlačítek' },
  vypnuto: { label: 'Vypnuto', hint: 'Žádný pohyb, vše se změní okamžitě' },
};

/** The value on <html data-motion="...">. ASCII on purpose: CSS attribute selectors stay boring. */
export type MotionAttr = 'full' | 'reduced' | 'off';
export const MOTION_ATTR: Record<MotionPreference, MotionAttr> = { plné: 'full', omezené: 'reduced', vypnuto: 'off' };

/** What a stored value means, or null for anything that is not one of the three (junk, another type, nothing). */
export function parseMotionPreference(raw: unknown): MotionPreference | null {
  return typeof raw === 'string' && (MOTION_MODES as readonly string[]).includes(raw) ? (raw as MotionPreference) : null;
}

export function osPrefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** The effective state from the stored value and the system's setting. Pure. */
export function resolveMotion(stored: MotionPreference | null, osReduced: boolean): MotionPreference {
  return stored ?? (osReduced ? 'vypnuto' : DEFAULT_MOTION);
}

/** A browser that refuses storage (private mode) keeps the choice here, for this visit. */
let memoryChoice: MotionPreference | null = null;

export function readStoredMotion(): MotionPreference | null {
  try {
    return parseMotionPreference(window.localStorage.getItem(MOTION_STORAGE_KEY));
  } catch {
    return memoryChoice;
  }
}

/** What the browser is doing right now: stored choice, else the system's. */
export function currentMotion(): MotionPreference {
  if (typeof window === 'undefined') return DEFAULT_MOTION;
  return resolveMotion(readStoredMotion(), osPrefersReducedMotion());
}

/** What each state allows. `cinematic` = anything that travels or is driven by scroll. */
export interface MotionAllowance {
  /** Any animation at all (fades included). */
  fades: boolean;
  /** Small feedback: press, pop, nudge. */
  micro: boolean;
  /** Parallax, pinned/scrubbed scenes, smooth scroll, kinetic type, tilt, magnet, count-up, moving shaders. */
  cinematic: boolean;
}

export function allowanceFor(mode: MotionPreference): MotionAllowance {
  return { fades: mode !== 'vypnuto', micro: mode !== 'vypnuto', cinematic: mode === 'plné' };
}

/* ── the store (shared by every hook; no React needed to change it) ── */

const listeners = new Set<() => void>();
let started = false;
let cached: MotionPreference | null = null;

function emit(): void {
  cached = null;
  applyToDocument(currentMotion());
  listeners.forEach((listener) => listener());
}

/** Mirrors the state on <html> and writes the token variables once. Safe to call any number of times. */
export function applyToDocument(mode: MotionPreference): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const attr = MOTION_ATTR[mode];
  if (root.getAttribute('data-motion') !== attr) root.setAttribute('data-motion', attr);
  if (root.style.getPropertyValue('--sm-dur-base') === '') {
    for (const [name, value] of Object.entries(cssVariables())) root.style.setProperty(name, value);
  }
}

let stopListening: (() => void) | null = null;

function start(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const onStorage = (event: StorageEvent) => {
    if (event.key === MOTION_STORAGE_KEY || event.key === null) emit();
  };
  window.addEventListener('storage', onStorage);
  let list: MediaQueryList | null = null;
  try {
    list = window.matchMedia('(prefers-reduced-motion: reduce)');
    list.addEventListener('change', emit);
  } catch {
    /* no matchMedia (a very old browser, a test) - the stored value still works */
  }
  stopListening = () => {
    window.removeEventListener('storage', onStorage);
    list?.removeEventListener('change', emit);
  };
  applyToDocument(currentMotion());
}

export function getMotionSnapshot(): MotionPreference {
  start();
  if (cached === null) cached = currentMotion();
  return cached;
}

export function getServerMotionSnapshot(): MotionPreference {
  return DEFAULT_MOTION;
}

export function subscribeMotion(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Choose a state; it applies at once everywhere and is remembered. `null` forgets the choice (follow the system). */
export function setMotionPreference(next: MotionPreference | null): void {
  try {
    if (next === null) window.localStorage.removeItem(MOTION_STORAGE_KEY);
    else window.localStorage.setItem(MOTION_STORAGE_KEY, next);
  } catch {
    memoryChoice = next;
  }
  emit();
}

/** Tests: forget the cache and the listeners. */
export function resetMotionStoreForTests(): void {
  stopListening?.();
  stopListening = null;
  started = false;
  cached = null;
  memoryChoice = null;
  listeners.clear();
}

