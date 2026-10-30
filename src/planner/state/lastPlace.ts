/*
 * Where the desk was on the clinic calendar: the day and the view. Leaving for a patient's card and coming back opens
 * the calendar there again instead of on today. Kept for this browser tab only (sessionStorage) and only for the day it
 * was written on, so the next morning starts on today as before. A blocked or broken storage simply means "today".
 */
import type { PlannerView } from './plannerState';

const KEY = 'sm.planner.lastPlace';

interface LastPlace {
  day: string;
  view: PlannerView;
  savedOn: string;
}

export function readLastPlace(today: string): { day: string; view: PlannerView } | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw === null) return null;
    const place = JSON.parse(raw) as Partial<LastPlace>;
    if (place.savedOn !== today || typeof place.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(place.day)) return null;
    if (place.view !== 'day' && place.view !== 'week' && place.view !== 'month') return null;
    return { day: place.day, view: place.view };
  } catch {
    return null;
  }
}

export function writeLastPlace(day: string, view: PlannerView, today: string): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ day, view, savedOn: today } satisfies LastPlace));
  } catch {
    /* no storage: the calendar opens on today next time */
  }
}
