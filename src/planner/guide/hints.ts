/*
 * Which hint (if any) the club planner shows right now - ONE pure function of the planner state, the person's memory
 * and the clock it is handed. Nothing here reads the DOM or starts a timer; the host feeds it and draws the answer.
 *
 * Rules:
 *   - one hint at a time, never two; never while a dialog or the completion card is open;
 *   - at most one hint per 20 seconds (`HINT_GAP_MS`), counted from the moment the last one appeared;
 *   - a hint seen once (closed with x, or settled by the person doing what it said) never comes back;
 *   - "Nezobrazovat" silences all hints for this person;
 *   - priority: `start` before `strip`.
 */
export type HintId = 'start' | 'strip';
export type HintView = 'day' | 'week' | 'month';
export type HintLayout = 'phone' | 'tablet' | 'desktop';

export const HINT_GAP_MS = 20_000;
export const HINT_IDS: readonly HintId[] = ['start', 'strip'];

export interface HintInput {
  /** A club order is being planned and the planner has loaded it. */
  active: boolean;
  /** The order has at least one činnost. */
  activities: number;
  /** Planned persons in the whole order (0 = an empty order). */
  planned: number;
  /** A činnost is armed (chosen below). */
  armed: boolean;
  view: HintView;
  layout: HintLayout;
  /** Cards the strip cannot show at once. */
  hiddenCards: number;
  /** The person already moved the strip (arrow, swipe, escalator). */
  stripUsed: boolean;
  dialogOpen: boolean;
  calloutOpen: boolean;
}

export interface HintMemory {
  seen: Readonly<Partial<Record<HintId, true>>>;
  muted: boolean;
}

export interface HintChoice {
  /** The hint to show now, or null. */
  hint: HintId | null;
  /** Variant of the sentence (start: depends on the view and whether a činnost is armed). */
  variant: string;
  /** When a hint is waiting only for the 20 s gap: the milliseconds left (the host re-asks then), else null. */
  waitMs: number | null;
}

export const EMPTY_MEMORY: HintMemory = { seen: {}, muted: false };

/** Is this hint's condition true for this state (ignoring memory and the gap)? */
export function wants(id: HintId, i: HintInput): boolean {
  if (!i.active || i.activities === 0 || i.dialogOpen || i.calloutOpen) return false;
  if (id === 'start') return i.planned === 0;
  return i.activities >= 4 && i.hiddenCards > 0 && !i.stripUsed;
}

export function startVariant(i: Pick<HintInput, 'view' | 'layout' | 'armed'>): string {
  if (i.layout === 'phone') return 'phone';
  if (i.view === 'month') return i.armed ? 'armedMonth' : 'month';
  return i.armed ? 'armedBoard' : 'board';
}

export interface HintClock {
  /** The hint on screen at the moment (it stays while its condition holds; the gap never removes it). */
  shown: HintId | null;
  /** The hint that appeared last, and when (ms, the same clock as `now`). */
  lastId: HintId | null;
  lastAt: number | null;
}
export const NO_CLOCK: HintClock = { shown: null, lastId: null, lastAt: null };

export function chooseHint(input: HintInput, memory: HintMemory, now: number, clock: HintClock = NO_CLOCK): HintChoice {
  const none: HintChoice = { hint: null, variant: '', waitMs: null };
  if (memory.muted) return none;
  const open = HINT_IDS.filter((id) => !memory.seen[id] && wants(id, input));
  if (open.length === 0) return none;
  const pick = clock.shown !== null && open.includes(clock.shown) ? clock.shown : open[0]!;
  const variant = pick === 'start' ? startVariant(input) : 'strip';
  /* The same hint coming back after a dialog closed is not a new hint: the gap is for a DIFFERENT one. */
  if (pick === clock.shown || pick === clock.lastId || clock.lastAt === null) return { hint: pick, variant, waitMs: null };
  const left = clock.lastAt + HINT_GAP_MS - now;
  return left > 0 ? { hint: null, variant: '', waitMs: left } : { hint: pick, variant, waitMs: null };
}

/* ------------------------------ memory (per person, in this browser) ------------------------------ */

export const HINT_KEY_PREFIX = 'sm-planner-hints:';

/** The key of one person: what the sign-in left in `localStorage.user` (id, else e-mail, else name), else "anon". */
export function hintKeyOf(rawUser: string | null): string {
  let who = 'anon';
  try {
    const u = rawUser ? (JSON.parse(rawUser) as Record<string, unknown>) : null;
    if (u && typeof u === 'object') {
      const pick = [u.id, u.userId, u.email, u.displayName].find((v) => typeof v === 'string' && v.trim() !== '');
      if (typeof pick === 'string') who = pick.trim().toLowerCase().slice(0, 120);
    }
  } catch { /* junk: anonymous */ }
  return `${HINT_KEY_PREFIX}${who}`;
}

/** Whatever is stored becomes a valid memory; junk (not JSON, wrong shapes, unknown ids) becomes the empty one. */
export function parseMemory(raw: string | null): HintMemory {
  if (!raw) return EMPTY_MEMORY;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return EMPTY_MEMORY;
    const o = v as { seen?: unknown; muted?: unknown };
    const seen: Partial<Record<HintId, true>> = {};
    if (o.seen && typeof o.seen === 'object' && !Array.isArray(o.seen)) {
      for (const id of HINT_IDS) if ((o.seen as Record<string, unknown>)[id] === true) seen[id] = true;
    }
    return { seen, muted: o.muted === true };
  } catch {
    return EMPTY_MEMORY;
  }
}

export const serializeMemory = (m: HintMemory): string => JSON.stringify({ seen: m.seen, muted: m.muted });

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Reading never throws (a blocked or private storage is an empty memory). */
export function loadMemory(storage: StorageLike | null, key: string): HintMemory {
  try {
    return parseMemory(storage ? storage.getItem(key) : null);
  } catch {
    return EMPTY_MEMORY;
  }
}

/** Writing never throws either: the memory then lives only until the page is closed. */
export function saveMemory(storage: StorageLike | null, key: string, memory: HintMemory): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, serializeMemory(memory));
    return true;
  } catch {
    return false;
  }
}

export const markSeen = (m: HintMemory, id: HintId): HintMemory => (m.seen[id] ? m : { ...m, seen: { ...m.seen, [id]: true } });
export const mute = (m: HintMemory): HintMemory => (m.muted ? m : { ...m, muted: true });
