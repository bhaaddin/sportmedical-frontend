/*
 * R16b - a club's day as ONE framed block with the činnosti inside it.
 *
 * The server keeps a club order's day as the windows it can occupy (before and after the lunch, one per stretch), and each window says
 * which činnosti it holds (`activityIds`, stage 2). The main calendar draws the day's windows of one order as ONE block with a
 * continuous frame in the club's colour (`drawnBlocksOfDay`); this file says what lies INSIDE the frame: one sub-block per window,
 * in the colour of its činnost (several činnosti in one window = equal stripes, never a blend). A window the server did not name
 * činnosti for (an older server, an unfilled order) has no sub-block: the frame keeps the club's hatch there. Pure, no DOM.
 */
import type { TimeBlock } from '../../../api/bookingContracts';
import type { Catalogue } from '../../../components/booking/calendar/model';
import { colourOfActivity } from '../../../components/booking/calendar/model';
import { formatMinutes, spanOnDay, type MinuteRange } from '../../../components/booking/grid/timeRange';
import type { DateOnly } from '../../../utils/time';

/** The colour of a činnost the catalogue does not know (never a club colour: it must not look like another club's frame). */
export const UNKNOWN_ACTIVITY_COLOUR = '#8795a3';

export interface FrameActivity {
  id: string;
  name: string;
  /** `#RRGGBB`. */
  colour: string;
}

/** One window inside the frame. */
export interface FrameSub extends MinuteRange {
  key: string;
  activities: FrameActivity[];
}

export function frameActivities(ids: readonly string[] | null | undefined, catalogue: Catalogue): FrameActivity[] {
  const seen = new Set<string>();
  const out: FrameActivity[] = [];
  for (const id of ids ?? []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const info = catalogue.activities.get(id);
    out.push({ id, name: info?.name ?? 'Činnost', colour: info ? colourOfActivity(catalogue, id, UNKNOWN_ACTIVITY_COLOUR) : UNKNOWN_ACTIVITY_COLOUR });
  }
  return out;
}

/** The sub-blocks of a drawn club block on one day: its windows that name at least one činnost, in time order. */
export function frameSubs(parts: readonly TimeBlock[], day: DateOnly, catalogue: Catalogue): FrameSub[] {
  const subs: FrameSub[] = [];
  for (const part of parts) {
    const activities = frameActivities(part.activityIds, catalogue);
    if (activities.length === 0) continue;
    const span = spanOnDay(part.startUtc, part.endUtc, day);
    if (span.end <= span.start) continue;
    subs.push({ key: part.id, start: span.start, end: span.end, activities });
  }
  return subs.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** The distinct činnosti of a day's frame, in first-seen order (the chips of the month tile, the phone list and the mini calendar). */
export function distinctActivities(subs: readonly Pick<FrameSub, 'activities'>[]): FrameActivity[] {
  const seen = new Set<string>();
  const out: FrameActivity[] = [];
  for (const s of subs) {
    for (const a of s.activities) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      out.push(a);
    }
  }
  return out;
}

/**
 * A CSS background for a sub-block: one colour = a flat tint, several = equal hard-edged vertical stripes (the colours stay readable,
 * the sub-block says "these činnosti, not split by time"). `alpha` is applied to each stop.
 */
export function stripesCss(colours: readonly string[], tint: (hex: string) => string): string {
  const list = colours.length > 0 ? colours : [UNKNOWN_ACTIVITY_COLOUR];
  if (list.length === 1) return `linear-gradient(0deg, ${tint(list[0]!)}, ${tint(list[0]!)})`;
  const step = 100 / list.length;
  const stops = list.map((c, i) => `${tint(c)} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/** "Spiroergometrie, Komplexní prohlídka" - the words behind the colours, for the title / aria-label (colour is never the only cue). */
export const activityNames = (activities: readonly Pick<FrameActivity, 'name'>[]): string => activities.map((a) => a.name).join(', ');

/** "08:00–10:00 Spiroergometrie" for a sub-block's title. */
export const subTitle = (sub: Pick<FrameSub, 'start' | 'end' | 'activities'>): string => `${formatMinutes(sub.start)}–${formatMinutes(sub.end)} ${activityNames(sub.activities)}`;
