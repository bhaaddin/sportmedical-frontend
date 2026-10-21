/*
 * Recent and pinned: what THIS person opened last and what they pinned, kept in their own browser.
 *
 * Privacy, in order of importance:
 *   - only `EntityRef`s are kept (kind, id, a display label, and the calendar / patient id some kinds need to be
 *     opened). Never a birth number, an insurance number, an e-mail or a telephone: `readRef` throws away anything
 *     whose label looks like one, and the model never receives more than a ref;
 *   - one slot per signed-in account (`sm-shelf:<account id>`): a second person at the same desk does not see the
 *     first one's recents. Recents expire after 30 days and there are at most 12 of each;
 *   - nothing is ever read as trusted: storage may hold junk, another version, or nothing at all (private mode), and
 *     every one of those is an empty memory, never an error.
 *
 * The model is pure (strings in, strings out). The store below is the thin layer that reads and writes `localStorage`
 * and lets every shelf on screen see the same change (`useSyncExternalStore`).
 */
import { readRef, refKey, type EntityRef } from './entities';

export const MEMORY_VERSION = 1;
export const MAX_RECENTS = 12;
export const MAX_PINNED = 12;
/** Recents older than this are forgotten. Pins stay until the person unpins them. */
export const RECENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface RecentEntry extends EntityRef {
  /** When it was opened last, ms since the epoch. */
  at: number;
}

export interface PinnedEntry extends EntityRef {
  at: number;
}

export interface ShelfMemory {
  v: typeof MEMORY_VERSION;
  recents: RecentEntry[];
  pinned: PinnedEntry[];
}

export const emptyMemory = (): ShelfMemory => ({ v: MEMORY_VERSION, recents: [], pinned: [] });

const readAt = (raw: unknown, fallback: number): number =>
  typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : fallback;

function readList<T extends EntityRef & { at: number }>(raw: unknown, limit: number, now: number, ttl: number | null): T[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of raw) {
    const ref = readRef(item);
    if (ref === null) continue;
    const at = readAt((item as { at?: unknown }).at, now);
    if (ttl !== null && now - at > ttl) continue;
    const key = refKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...ref, at } as T);
    if (out.length >= limit) break;
  }
  return out;
}

/** What storage held, as a memory. Anything that is not ours, junk inside it, expired recents and duplicates are dropped. */
export function parseMemory(raw: string | null | undefined, now: number = Date.now()): ShelfMemory {
  if (typeof raw !== 'string' || raw === '') return emptyMemory();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyMemory();
  }
  if (data === null || typeof data !== 'object') return emptyMemory();
  const d = data as Record<string, unknown>;
  if (d.v !== MEMORY_VERSION) return emptyMemory();
  return {
    v: MEMORY_VERSION,
    recents: readList<RecentEntry>(d.recents, MAX_RECENTS, now, RECENT_TTL_MS),
    pinned: readList<PinnedEntry>(d.pinned, MAX_PINNED, now, null),
  };
}

export const serializeMemory = (memory: ShelfMemory): string => JSON.stringify(memory);

/** Opening an entity moves it to the front of the recents; a pinned entry keeps its label current too. */
export function touch(memory: ShelfMemory, input: unknown, now: number = Date.now()): ShelfMemory {
  const ref = readRef(input);
  if (ref === null) return memory;
  const key = refKey(ref);
  /* Re-opening what is already first, under the same name, within a minute changes nothing worth a write. */
  const first = memory.recents[0];
  if (first !== undefined && refKey(first) === key && first.label === ref.label && now - first.at < 60_000) return memory;
  const recents = [{ ...ref, at: now }, ...memory.recents.filter((r) => refKey(r) !== key)].slice(0, MAX_RECENTS);
  const pinned = memory.pinned.map((p) => (refKey(p) === key ? { ...p, label: ref.label } : p));
  return { ...memory, recents, pinned };
}

export function isPinned(memory: ShelfMemory, ref: Pick<EntityRef, 'kind' | 'id'>): boolean {
  const key = refKey(ref);
  return memory.pinned.some((p) => refKey(p) === key);
}

/** Pins a ref that is not pinned and unpins one that is. A full shelf refuses a new pin (the oldest is never dropped silently). */
export function togglePin(memory: ShelfMemory, input: unknown, now: number = Date.now()): ShelfMemory {
  const ref = readRef(input);
  if (ref === null) return memory;
  const key = refKey(ref);
  if (memory.pinned.some((p) => refKey(p) === key)) {
    return { ...memory, pinned: memory.pinned.filter((p) => refKey(p) !== key) };
  }
  if (memory.pinned.length >= MAX_PINNED) return memory;
  return { ...memory, pinned: [{ ...ref, at: now }, ...memory.pinned] };
}

export const forgetRecents = (memory: ShelfMemory): ShelfMemory => ({ ...memory, recents: [] });

/** Recents that are not already pinned (a pinned entry is shown in its own shelf, not twice). */
export function recentsWithoutPins(memory: ShelfMemory): RecentEntry[] {
  const pinned = new Set(memory.pinned.map(refKey));
  return memory.recents.filter((r) => !pinned.has(refKey(r)));
}

/* ───────────────────────────── the browser store ───────────────────────────── */

const PREFIX = 'sm-shelf:';

/** The slot for the signed-in account: its id, or a shared "anon" slot when nobody is known. */
export function memoryKey(): string {
  try {
    const user = JSON.parse(window.localStorage.getItem('user') || '{}') as { id?: unknown };
    const id = typeof user.id === 'string' && /^[\w-]{1,64}$/.test(user.id) ? user.id : 'anon';
    return `${PREFIX}${id}`;
  } catch {
    return `${PREFIX}anon`;
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: { key: string; raw: string | null; memory: ShelfMemory } | null = null;

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** A stable snapshot for `useSyncExternalStore`: the same object until storage changes. */
export function getMemory(): ShelfMemory {
  const key = memoryKey();
  const raw = readRaw(key);
  if (cache !== null && cache.key === key && cache.raw === raw) return cache.memory;
  const memory = parseMemory(raw);
  cache = { key, raw, memory };
  return memory;
}

export const EMPTY_MEMORY: ShelfMemory = emptyMemory();
export const getServerMemory = (): ShelfMemory => EMPTY_MEMORY;

export function subscribeMemory(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PREFIX) || event.key === 'user') listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function commit(next: ShelfMemory): void {
  const key = memoryKey();
  const raw = serializeMemory(next);
  let stored = false;
  try {
    window.localStorage.setItem(key, raw);
    stored = true;
  } catch {
    /* Private mode or a full quota: the shelves still work for this visit, it just is not remembered. */
  }
  /* Without storage the snapshot is held here so the visit still works; with it, the next read parses what was written. */
  cache = stored ? null : { key, raw: readRaw(key), memory: next };
  listeners.forEach((l) => l());
}

/** Remember that this entity was opened. Safe to call from an effect on any page. */
export function rememberOpened(ref: unknown): void {
  const current = getMemory();
  const next = touch(current, ref);
  if (next !== current) commit(next);
}

export function togglePinned(ref: unknown): void {
  const current = getMemory();
  const next = togglePin(current, ref);
  if (next !== current) commit(next);
}

export function clearRecents(): void {
  commit(forgetRecents(getMemory()));
}

/** Test hook: forget what the module cached. */
export function resetMemoryCacheForTests(): void {
  cache = null;
}
