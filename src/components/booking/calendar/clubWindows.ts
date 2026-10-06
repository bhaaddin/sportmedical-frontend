/*
 * A club's reserved windows (ClubBlocks) as they read on a day: "FK Slaný · 08:00–12:00", with the činnost breakdown
 * and "3/22 zapsáno". The phone lists have no grid to hatch them on, so without these a day that holds only a club
 * window read "Žádné rezervace". One window per club block, day and time span (calendars with the same span merge).
 */
import type { ClubBlockView } from "../../../api/clubBlocks";
import type { TimeBlock } from "../../../api/bookingContracts";
import type { DateOnly } from "../../../utils/time";
import { formatMinutes, spanOnDay, touchesDay, type MinuteRange } from "../grid/timeRange";
import { cleanHex } from "./model";

export interface ClubWindow {
  key: string;
  clubBlockId: string;
  clubId: string | null;
  clubName: string;
  colorHex: string | null;
  day: DateOnly;
  start: number;
  end: number;
  /** "08:00–12:00". */
  timeLabel: string;
  /** The window (together with the club's other pieces that day) covers the whole open day. */
  wholeDay: boolean;
  /** "Základní 12 · Komplexní 10", or null when the club block's detail is not known. */
  breakdown: string | null;
  registered: number | null;
  seats: number | null;
  /** The block's whole date range (for the popover). */
  range: { from: DateOnly; to: DateOnly };
  /** Etapa 10: the činnosti this window is restricted to ("Spiroergometrie"); null = it allows all of the order's. */
  only: string | null;
}

const firstWord = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

export function clubWindowsByDay(
  blocksByCalendar: ReadonlyMap<string, readonly TimeBlock[]>,
  days: readonly DateOnly[],
  details: ReadonlyMap<string, ClubBlockView>,
  openRange: (calendarId: string, day: DateOnly) => MinuteRange | null,
  rangeOf: (blockId: string | null | undefined, block: TimeBlock) => { from: DateOnly; to: DateOnly },
  /** Block id -> restricted činnosti of its window (see `windowRestrictions`). */
  restricted?: ReadonlyMap<string, string>,
): Map<string, ClubWindow[]> {
  const out = new Map<string, ClubWindow[]>();
  for (const day of days) {
    const windows = new Map<string, ClubWindow>();
    const spansOf = new Map<string, MinuteRange[]>();
    const coverage = new Map<string, { min: number; max: number; open: MinuteRange | null }>();
    for (const [calendarId, blocks] of blocksByCalendar) {
      for (const block of blocks) {
        if (block.kind !== "club" || !block.clubName || !touchesDay(block.startUtc, block.endUtc, day)) continue;
        const id = block.clubBlockId ?? block.id;
        const span = spanOnDay(block.startUtc, block.endUtc, day);
        if (span.end <= span.start) continue;
        const key = id;
        const have = windows.get(key);
        if (have) {
          /* Another piece of the same block that day (before / after the lunch break, or on another calendar). */
          const spans = [...(spansOf.get(key) ?? [])];
          if (!spans.some((x) => x.start === span.start && x.end === span.end)) {
            spans.push(span);
            spans.sort((a, b) => a.start - b.start);
            spansOf.set(key, spans);
            have.start = Math.min(have.start, span.start);
            have.end = Math.max(have.end, span.end);
            have.timeLabel = spans.map((x) => `${formatMinutes(x.start)}–${formatMinutes(x.end)}`).join(", ");
          }
        } else {
          spansOf.set(key, [span]);
          const detail = details.get(id);
          const seatsView = detail?.activitySeats ?? [];
          windows.set(key, {
            key,
            clubBlockId: id,
            clubId: block.clubId ?? null,
            clubName: block.clubName,
            colorHex: cleanHex(block.colorHex) ?? null,
            day,
            start: span.start,
            end: span.end,
            timeLabel: `${formatMinutes(span.start)}–${formatMinutes(span.end)}`,
            wholeDay: false,
            breakdown: seatsView.length > 0 ? seatsView.filter((s) => s.seats > 0).map((s) => `${firstWord(s.activityName)} ${s.seats}`).join(" · ") : null,
            registered: detail ? detail.registered : null,
            seats: detail ? detail.seats : null,
            range: rangeOf(block.clubBlockId, block),
            only: restricted?.get(id) ?? null,
          });
        }
        const open = openRange(calendarId, day);
        const c = coverage.get(id);
        coverage.set(id, { min: Math.min(c?.min ?? span.start, span.start), max: Math.max(c?.max ?? span.end, span.end), open: c?.open ?? open });
      }
    }
    if (windows.size === 0) continue;
    const list = [...windows.values()].map((w) => {
      const c = coverage.get(w.clubBlockId);
      return c?.open ? { ...w, wholeDay: c.min <= c.open.start && c.max >= c.open.end } : w;
    });
    list.sort((a, b) => a.start - b.start || a.clubName.localeCompare(b.clubName, "cs"));
    out.set(day, list);
  }
  return out;
}

/** One line for a day that has only club windows: "Klub FK Slaný drží celý den" or "Klub FK Slaný 08:00–12:00". */
export function clubOnlyLine(windows: readonly ClubWindow[]): string {
  const clubs = [...new Set(windows.map((w) => w.clubName))];
  const names = clubs.join(", ");
  if (windows.some((w) => w.wholeDay)) return `${clubs.length > 1 ? "Kluby" : "Klub"} ${names} drží celý den`;
  return `${clubs.length > 1 ? "Kluby" : "Klub"} ${names} ${windows.map((w) => w.timeLabel).join(", ")}`;
}
