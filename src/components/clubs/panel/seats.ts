/*
 * The club counted as one whole: how many places it holds per činnost, how many
 * athletes took one, and what is left - for one block and summed over a club's
 * blocks.
 *
 * A block of the new shape carries `activitySeats` (one row per činnost). An
 * older block has only `playerCount`; it counts that many places for EACH of
 * its činnosti, as before. Tolerant on purpose: `activitySeats` may be absent
 * (older server) or partly malformed.
 */
import type { ClubBlockView } from '../../../api/clubBlocks';

export interface ActivitySeats {
  activityId: string;
  activityName: string;
  seats: number;
  registered: number;
}

export type SeatsBlock = Pick<ClubBlockView, 'activityIds' | 'playerCount' | 'seats' | 'registered'> & {
  activitySeats?: unknown;
};

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** Whatever `activitySeats` holds that can be read; null when the block has none. */
export function readActivitySeats(raw: unknown): ActivitySeats[] | null {
  if (!Array.isArray(raw)) return null;
  const rows = raw.flatMap((item): ActivitySeats[] => {
    if (!isRecord(item)) return [];
    const id = typeof item.activityId === 'string' ? item.activityId : '';
    if (id === '') return [];
    const name = typeof item.activityName === 'string' && item.activityName.trim() !== '' ? item.activityName : '';
    return [{ activityId: id, activityName: name, seats: count(item.seats), registered: count(item.registered) }];
  });
  return rows.length > 0 ? rows : null;
}

export const seatsFree = (row: Pick<ActivitySeats, 'seats' | 'registered'>): number => Math.max(0, row.seats - row.registered);

/**
 * One block's places per činnost. `nameOf` names a činnost the block itself
 * does not name (legacy blocks carry only ids).
 */
export function blockActivitySeats(block: SeatsBlock, nameOf: (id: string) => string = () => ''): ActivitySeats[] {
  const own = readActivitySeats(block.activitySeats);
  if (own !== null) return own.map((r) => ({ ...r, activityName: r.activityName || nameOf(r.activityId) }));
  const places = block.playerCount > 0 ? block.playerCount : block.seats;
  const ids = block.activityIds.length > 0 ? block.activityIds : [''];
  return ids.map((id) => ({ activityId: id, activityName: nameOf(id), seats: places, registered: block.registered }));
}

export interface SeatTotals {
  seats: number;
  registered: number;
  free: number;
}

export function sumSeats(rows: readonly Pick<ActivitySeats, 'seats' | 'registered'>[]): SeatTotals {
  const seats = rows.reduce((n, r) => n + r.seats, 0);
  const registered = rows.reduce((n, r) => n + r.registered, 0);
  return { seats, registered, free: Math.max(0, seats - registered) };
}

export const blockSeatTotals = (block: SeatsBlock): SeatTotals => sumSeats(blockActivitySeats(block));

/** The club's active blocks together, one row per činnost (ordered as first met). */
export function clubActivitySeats(blocks: readonly SeatsBlock[], nameOf: (id: string) => string = () => ''): ActivitySeats[] {
  const byId = new Map<string, ActivitySeats>();
  for (const block of blocks) {
    for (const row of blockActivitySeats(block, nameOf)) {
      const key = row.activityId || row.activityName;
      const seen = byId.get(key);
      if (seen === undefined) byId.set(key, { ...row });
      else byId.set(key, { ...seen, activityName: seen.activityName || row.activityName, seats: seen.seats + row.seats, registered: seen.registered + row.registered });
    }
  }
  return [...byId.values()];
}

const FALLBACK_NAME = 'Činnost';

const placesWord = (n: number): string => (n === 1 ? 'místo' : n >= 2 && n <= 4 ? 'místa' : 'míst');
const freeWord = (n: number): string => (n === 1 ? 'volné' : n >= 2 && n <= 4 ? 'volná' : 'volných');

export const activityLabel = (row: Pick<ActivitySeats, 'activityName'>): string => row.activityName || FALLBACK_NAME;

/** "Základní sportovní prohlídka: 10 míst, 3 volná" */
export function seatsSentence(row: ActivitySeats): string {
  const free = seatsFree(row);
  const tail = free === 0 ? 'obsazeno' : `${free} ${freeWord(free)}`;
  return `${activityLabel(row)}: ${row.seats} ${placesWord(row.seats)}, ${tail}`;
}

/** "Celkem 70 míst · 41 zapsáno · 29 volno" */
export function totalsLine(t: SeatTotals): string {
  return `Celkem ${t.seats} ${placesWord(t.seats)} · ${t.registered} zapsáno · ${t.free} volno`;
}

/* ── One shared reading of "how many places per činnost" (Etapa 6) ── */

export interface SeatsLine {
  activityName: string;
  seats: number;
  /** null = not known (a form that is still being filled in). */
  registered?: number | null;
}

/**
 * "Základní 10 · Komplexní 10" - or, with the registrations known, "Základní 4/10 · Komplexní 0/10".
 * Činnosti with no places are left out; an empty list reads "—".
 */
export function formatSeats(lines: readonly SeatsLine[]): string {
  const shown = lines.filter((l) => l.seats > 0);
  if (shown.length === 0) return '—';
  return shown
    .map((l) => `${l.activityName || 'Činnost'} ${typeof l.registered === 'number' ? `${l.registered}/${l.seats}` : l.seats}`)
    .join(' · ');
}

const playersWord = (n: number): string => (n === 1 ? 'hráč' : n >= 2 && n <= 4 ? 'hráči' : 'hráčů');

/** "20 hráčů" - the total that goes next to the breakdown. */
export const formatPlayersTotal = (lines: readonly Pick<SeatsLine, 'seats'>[]): string => {
  const total = lines.reduce((n, l) => n + Math.max(0, l.seats), 0);
  return `${total.toLocaleString('cs-CZ')} ${playersWord(total)}`;
};

/** Both in one: "Základní 10 · Komplexní 10 (20 hráčů)". */
export const formatSeatsWithTotal = (lines: readonly SeatsLine[]): string => {
  const body = formatSeats(lines);
  return body === '—' ? body : `${body} (${formatPlayersTotal(lines)})`;
};
