/*
 * The planner screen (network plan b5): `GET /api/v1/screens/planner?from&to&calendarIds` answers in ONE request what the
 * planner otherwise reads in four waves (calendars, činnosti, služby, display and club settings, holidays, the working-hours
 * previews, the blocks, the day and the club blocks).
 *
 * This file does not change what the planner reads. It only SEEDS the react-query keys the planner's own reads already use
 * (`makeReader` in deps.ts: `['calendars']`, `['day-range', ...]`, ...) from the sections of that one answer, shaped by the
 * same parsers the single clients use. The reads that follow find fresh data and ask nothing. Anything the screen does not
 * give - an old server (404), a missing permission, a failed or malformed section, a window other than the one asked for -
 * leaves the key empty and the planner asks for it the way it always has. So the worst case is today's behaviour.
 */
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { readActivityList } from '../../api/activities';
import {
  calendarListSchema,
  dayAppointmentListSchema,
  parseResponse,
  previewListSchema,
  timeBlockListSchema,
  type Calendar,
  type PreviewDay,
} from '../../api/bookingContracts';
import { BLOCK_COVER_RULES, DAY_COVER_RULES } from '../../api/appointments';
import client from '../../api/client';
import { clinicServiceListSchema } from '../../api/clinicServices';
import { asList, toBlock } from '../../api/clubBlocks';
import { CLUB_SETTINGS_QUERY_KEY, toClubSettings } from '../../api/clubs';
import { CALENDAR_DISPLAY_QUERY_KEY, withHolidayRed, type CalendarDisplayResponse } from '../../api/displaySettings';
import { parsePermissions, permissionsSnapshot } from '../../auth/localSession';

/** What the screen route asks of the account (the club-blocks route it replaces asks the same). */
export const SCREEN_PERMISSION = 'patients.view';

/** A read this fresh is not asked for again (the planner's own default, see `READ_STALE_MS` in deps.ts). */
const FRESH_MS = 30_000;
/** A failure that may pass (offline, 5xx): do not ask again for this long. */
const BACKOFF_MS = 60_000;
/** A server without the route is not asked again by this tab for this long (a deploy may add it; a reload after that finds it). */
const UNSUPPORTED_MS = 10 * 60_000;
/** Reads of one render (the board's week, the mini calendar's month, the catalogue) are collected for this long and share ONE request. */
const BATCH_MS = 8;
/** The most days the server answers. */
const MAX_DAYS = 62;
const MEMO_KEY = 'sm.plannerScreen.unsupportedUntil';

const readMemo = (): number => {
  try {
    const at = Number(window.sessionStorage.getItem(MEMO_KEY));
    return Number.isFinite(at) ? at : 0;
  } catch {
    return 0;
  }
};
const writeMemo = (until: number): void => {
  try {
    window.sessionStorage.setItem(MEMO_KEY, String(until));
  } catch {
    /* private window: this load simply asks once more */
  }
};

/** When the screen may be asked for again. */
let blockedUntil = readMemo();

/** Test hook: forget what was learned about the server. */
export function resetPlannerScreenForTests(): void {
  blockedUntil = 0;
  try {
    window.sessionStorage.removeItem(MEMO_KEY);
  } catch {
    /* nothing stored */
  }
}

/** Whether this tab has learned, lately, that the server has no planner screen (or it failed and is being left alone). */
export function plannerScreenBlocked(): boolean {
  return Date.now() < blockedUntil;
}

type Section = { data?: unknown; error?: unknown } | null | undefined;

/** The body of a section that arrived, or `undefined` when it failed or is missing. */
function dataOf(section: Section): unknown {
  if (section === null || section === undefined || typeof section !== 'object') return undefined;
  return section.data === null ? undefined : section.data;
}

export interface WindowRange {
  from: string;
  to: string;
}

export interface PlannerScreenSeeder {
  /**
   * Makes sure the planner's reads for the window `range` (and the reference data) are in the cache when the server can say
   * so in one request. Never rejects; resolves when the reads may go ahead.
   */
  seed(range: WindowRange, explicitCalendarIds?: readonly string[]): Promise<void>;
  /** Whether a `seed` for this window would ask the server (false: it resolves at once and the reads go as they always did). */
  willAsk(range: WindowRange, explicitCalendarIds?: readonly string[]): boolean;
}

function isFresh(queryClient: QueryClient, key: QueryKey, ms: number): boolean {
  const state = queryClient.getQueryState(key);
  return state !== undefined && state.data !== undefined && !state.isInvalidated && Date.now() - state.dataUpdatedAt < ms;
}

/** The calendars the planner draws: active ones, narrowed to the explicit choice when it names any that exist. */
export function shownIds(calendars: readonly Calendar[], explicit?: readonly string[]): string[] {
  const active = calendars.filter((c) => c.isActive);
  if (explicit && explicit.length > 0) {
    const chosen = active.filter((c) => explicit.includes(c.id));
    if (chosen.length > 0) return chosen.map((c) => c.id);
  }
  return active.map((c) => c.id);
}

function yearsOf(range: WindowRange): number[] {
  const out: number[] = [];
  for (let y = Number(range.from.slice(0, 4)); y <= Number(range.to.slice(0, 4)); y++) out.push(y);
  return out;
}

const dayNumber = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

interface Held {
  ek: string;
  explicit: readonly string[] | undefined;
  union: WindowRange;
  derive: (window: WindowRange) => void;
}

interface Waiting {
  range: WindowRange;
  done: () => void;
}

export function makePlannerScreenSeeder(queryClient: QueryClient, permissions: () => readonly string[]): PlannerScreenSeeder {
  const batches = new Map<string, { explicit: readonly string[] | undefined; waiting: Waiting[] }>();
  /** Requests on their way, by window and calendars: a read that arrives meanwhile waits for them instead of asking again. */
  const flying = new Map<string, { ek: string; union: WindowRange; promise: Promise<void> }>();

  const put = (key: QueryKey, value: unknown) => queryClient.setQueryData(key, value);

  /** A reference part is replaced only when what is held is old; a fresh copy stays (same object, no needless repaint). */
  const putReference = (key: QueryKey, value: unknown) => {
    if (!isFresh(queryClient, key, FRESH_MS)) put(key, value);
  };

  /**
   * Puts the sections into the cache: the reference parts once, the window's parts under the keys of `union` and of every
   * smaller window a read asked for (cut out of the same rows with the rules the single clients use for their covers).
   */
  async function seedFrom(body: unknown, union: WindowRange, wanted: readonly WindowRange[], explicit?: readonly string[]): Promise<Held['derive'] | null> {
    const sections = (body as { sections?: Record<string, Section> } | null)?.sections;
    if (sections === undefined || sections === null || typeof sections !== 'object') return null;
    const guard = async (run: () => void | Promise<void>) => {
      try {
        await run();
      } catch {
        /* a section that does not parse is a section the planner reads itself */
      }
    };
    const windows = [union, ...wanted.filter((w) => w.from !== union.from || w.to !== union.to)];

    const derivers: ((w: WindowRange) => void)[] = [];
    let calendars: Calendar[] | undefined;
    await guard(() => {
      const raw = dataOf(sections.calendars);
      if (raw === undefined) return;
      calendars = parseResponse(calendarListSchema, raw);
      putReference(['calendars'], calendars);
    });
    await guard(async () => {
      const raw = dataOf(sections.activities);
      if (raw !== undefined) putReference(['activities'], await readActivityList(raw));
    });
    await guard(() => {
      const raw = dataOf(sections.clinicServices);
      if (raw !== undefined) putReference(['clinic-services'], parseResponse(clinicServiceListSchema, raw));
    });
    await guard(() => {
      const raw = dataOf(sections.calendarDisplay);
      if (raw !== undefined) putReference(CALENDAR_DISPLAY_QUERY_KEY, withHolidayRed(raw as CalendarDisplayResponse));
    });
    await guard(() => {
      const raw = dataOf(sections.clubSettings);
      if (raw !== undefined) putReference(CLUB_SETTINGS_QUERY_KEY, toClubSettings(raw));
    });
    await guard(() => {
      const raw = dataOf(sections.holidays);
      if (!Array.isArray(raw)) return;
      for (const year of yearsOf(union)) {
        put(['holidays', year], raw.filter((h) => typeof h?.date === 'string' && h.date.startsWith(`${year}-`)));
      }
    });
    await guard(() => {
      const raw = dataOf(sections.clubBlocks);
      if (raw === undefined) return;
      const list = asList(raw).map(toBlock);
      /* A block belongs to every window it overlaps (the server's rule, `ClubBlockRepository.ListAsync`). */
      const cut = (w: WindowRange) => put(['club-blocks', 'details', w.from, w.to], list.filter((b) => b.toDate >= w.from && b.fromDate <= w.to));
      derivers.push(cut);
      windows.forEach(cut);
    });

    if (calendars === undefined) return null;
    const ids = shownIds(calendars, explicit);
    if (ids.length === 0) return null;
    const idsKey = ids.join(',');

    await guard(() => {
      const raw = dataOf(sections.day);
      if (raw === undefined) return;
      const wantedIds = new Set(ids);
      const rows = parseResponse(dayAppointmentListSchema, raw).filter((a) => a.calendarId === null || wantedIds.has(a.calendarId));
      const cut = (w: WindowRange) => put(['day-range', w.from, w.to, idsKey], rows.filter((a) => DAY_COVER_RULES.inRange(a, w.from, w.to)));
      derivers.push(cut);
      windows.forEach(cut);
    });
    await guard(() => {
      const raw = dataOf(sections.previews) as Record<string, unknown> | undefined;
      if (raw === undefined) return;
      const parsed = new Map<string, PreviewDay[]>();
      for (const id of ids) {
        const rows = raw[id];
        if (rows === undefined) return; /* a calendar the screen did not answer for: the planner reads the previews itself */
        parsed.set(id, parseResponse(previewListSchema, rows));
      }
      const cut = (w: WindowRange) => {
        const perCalendar = new Map<string, Map<string, PreviewDay>>();
        for (const [id, rows] of parsed) {
          perCalendar.set(id, new Map(rows.filter((row) => row.date >= w.from && row.date <= w.to).map((row) => [row.date, row] as const)));
        }
        put(['grid-preview', w.from, w.to, idsKey], perCalendar);
      };
      derivers.push(cut);
      windows.forEach(cut);
    });
    await guard(() => {
      const raw = dataOf(sections.blocks) as Record<string, unknown> | undefined;
      if (raw === undefined) return;
      for (const id of ids) {
        const rows = raw[id];
        if (rows === undefined) continue;
        const blocks = parseResponse(timeBlockListSchema, rows);
        const cut = (w: WindowRange) => put(['blocks', id, w.from, w.to], blocks.filter((b) => BLOCK_COVER_RULES.inRange(b, w.from, w.to)));
        derivers.push(cut);
        windows.forEach(cut);
      }
    });
    return (w) => derivers.forEach((cut) => cut(w));
  }

  /** The answers of the last few requests, so a smaller window asked for a moment later is cut out of them, not asked for. */
  const held: Held[] = [];

  /** Cuts `window` out of a held answer that is still current (its own day is fresh and not marked stale). Whether it could. */
  function deriveFromHeld(window: WindowRange, ek: string): boolean {
    const cached = queryClient.getQueryData<Calendar[]>(['calendars']);
    for (const h of held) {
      if (h.ek !== ek || window.from < h.union.from || window.to > h.union.to) continue;
      const ids = cached === undefined ? [] : shownIds(cached, h.explicit);
      if (ids.length === 0 || !isFresh(queryClient, ['day-range', h.union.from, h.union.to, ids.join(',')], FRESH_MS)) continue;
      h.derive(window);
      return true;
    }
    return false;
  }

  /** The windows whose day is not fresh in the cache: what a request would have to bring. */
  function needed(windows: readonly WindowRange[], explicit?: readonly string[]): WindowRange[] {
    const cached = queryClient.getQueryData<Calendar[]>(['calendars']);
    if (cached === undefined) return [...windows];
    const ids = shownIds(cached, explicit);
    if (ids.length === 0) return [...windows];
    return windows.filter((w) => !isFresh(queryClient, ['day-range', w.from, w.to, ids.join(',')], FRESH_MS));
  }

  async function ask(windows: readonly WindowRange[], explicit?: readonly string[]): Promise<void> {
    if (plannerScreenBlocked()) return;
    if (!permissions().includes(SCREEN_PERMISSION)) return;
    const ek = explicit?.join(',') ?? '';
    let missing = needed(windows, explicit);
    /* A request on its way that covers a window brings it: wait for it rather than ask again. */
    const covering = [...flying.values()].filter((f) => f.ek === ek && missing.some((w) => w.from >= f.union.from && w.to <= f.union.to));
    if (covering.length > 0) {
      await Promise.all(covering.map((f) => f.promise));
      missing = needed(windows, explicit);
    }
    missing = missing.filter((w) => !deriveFromHeld(w, ek));
    if (missing.length === 0) return;
    const union = {
      from: missing.reduce((m, w) => (w.from < m ? w.from : m), missing[0]!.from),
      to: missing.reduce((m, w) => (w.to > m ? w.to : m), missing[0]!.to),
    };
    if (dayNumber(union.to) - dayNumber(union.from) + 1 > MAX_DAYS) {
      /* Not one window: each by itself (one call for them all would be refused). */
      for (const w of missing) await ask([w], explicit);
      return;
    }

    const key = `${union.from}|${union.to}|${ek}`;
    const going = flying.get(key);
    if (going) return going.promise;
    const run = (async () => {
      try {
        const res = await client.get('/api/v1/screens/planner', {
          params: {
            from: union.from,
            to: union.to,
            calendarIds: explicit && explicit.length > 0 ? explicit.join(',') : undefined,
          },
        });
        const derive = await seedFrom(res.data, union, missing, explicit);
        if (derive !== null) {
          held.unshift({ ek, explicit, union, derive });
          held.length = Math.min(held.length, 4);
        }
      } catch (error) {
        const status = (error as { response?: { status?: number } } | undefined)?.response?.status;
        /* 404/405: an older server, which has no such route. Any other failure may pass; ask again later. */
        if (status === 404 || status === 405) {
          blockedUntil = Date.now() + UNSUPPORTED_MS;
          writeMemo(blockedUntil);
        } else {
          blockedUntil = Date.now() + BACKOFF_MS;
        }
      } finally {
        flying.delete(key);
      }
    })();
    flying.set(key, { ek, union, promise: run });
    return run;
  }

  function flush(key: string): void {
    const batch = batches.get(key);
    batches.delete(key);
    if (batch === undefined) return;
    void ask(
      batch.waiting.map((w) => w.range),
      batch.explicit,
    )
      .catch(() => undefined)
      .then(() => batch.waiting.forEach((w) => w.done()));
  }

  return {
    seed(range, explicit) {
      if (plannerScreenBlocked()) return Promise.resolve();
      return new Promise<void>((done) => {
        const key = explicit?.join(',') ?? '';
        let batch = batches.get(key);
        if (batch === undefined) {
          batch = { explicit, waiting: [] };
          batches.set(key, batch);
          setTimeout(() => flush(key), BATCH_MS);
        }
        batch.waiting.push({ range, done });
      });
    },
    willAsk(range, explicit) {
      return !plannerScreenBlocked() && permissions().includes(SCREEN_PERMISSION) && needed([range], explicit).length > 0;
    },
  };
}

const seeders = new WeakMap<QueryClient, PlannerScreenSeeder>();

/** The one seeder of an application's query client: the board's reads and the data source share its batches. */
export function plannerScreenFor(queryClient: QueryClient): PlannerScreenSeeder {
  let seeder = seeders.get(queryClient);
  if (seeder === undefined) {
    seeder = makePlannerScreenSeeder(queryClient, () => parsePermissions(permissionsSnapshot()));
    seeders.set(queryClient, seeder);
  }
  return seeder;
}
