/*
 * Pure helpers of the club portal (Etapa 11): which windows a day holds, who is booked in each, which činnosti a
 * window allows, how far a činnost is registered, and which notices are fresh. Nothing here knows a wording or a
 * price; the server's lists are only grouped and sorted.
 */
import type { ClubPortal, PortalActivity, PortalAthlete, PortalNotice, PortalWindow } from '../../../api/publicClubOrder';

export const FRESH_DAYS = 7;

/** The windows of each day, earliest first. */
export function windowsByDate(windows: readonly PortalWindow[]): Map<string, PortalWindow[]> {
  const map = new Map<string, PortalWindow[]>();
  for (const w of [...windows].sort((a, b) => `${a.date} ${a.startLocal}`.localeCompare(`${b.date} ${b.startLocal}`))) {
    map.set(w.date, [...(map.get(w.date) ?? []), w]);
  }
  return map;
}

/** Players booked on `date`: a player belongs to the window that holds their start; the rest are returned as `loose`. */
export function playersOfDay(
  date: string,
  windows: readonly PortalWindow[],
  athletes: readonly PortalAthlete[],
): { perWindow: { window: PortalWindow; athletes: PortalAthlete[] }[]; loose: PortalAthlete[] } {
  const dayWindows = windows.filter((w) => w.date === date).sort((a, b) => a.startLocal.localeCompare(b.startLocal));
  const dayAthletes = athletes.filter((a) => a.date === date).sort((a, b) => a.startLocal.localeCompare(b.startLocal) || a.name.localeCompare(b.name, 'cs'));
  const taken = new Set<PortalAthlete>();
  const perWindow = dayWindows.map((window) => {
    const mine = dayAthletes.filter((a) => !taken.has(a) && a.startLocal >= window.startLocal && a.startLocal < window.endLocal);
    mine.forEach((a) => taken.add(a));
    return { window, athletes: mine };
  });
  return { perWindow, loose: dayAthletes.filter((a) => !taken.has(a)) };
}

/** "Základní, Komplexní" for a window; `fallback` when it allows every činnost of the order (no ids). */
export function activityNames(window: PortalWindow, activities: readonly PortalActivity[], fallback: string): string {
  if (window.activityIds.length === 0) return fallback;
  const names = window.activityIds.map((id) => activities.find((a) => a.activityId === id)?.name).filter((n): n is string => n !== undefined && n !== '');
  return names.length > 0 ? names.join(', ') : fallback;
}

/** "08:00–12:00" */
export const timeRange = (w: { startLocal: string; endLocal: string }): string => `${w.startLocal}–${w.endLocal}`;

/** 0..100, never above 100 and never NaN. */
export const percentOf = (registered: number, seats: number): number => (seats <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((registered / seats) * 100))));

/** A notice from the last `FRESH_DAYS` days. */
export function isFresh(notice: PortalNotice, now: number = Date.now()): boolean {
  const at = Date.parse(notice.atUtc);
  return Number.isFinite(at) && now - at >= 0 && now - at <= FRESH_DAYS * 24 * 60 * 60 * 1000;
}

/** The desk's latest message on a cancelled order (the first notice: the list is newest first). */
export const latestNotice = (portal: ClubPortal): PortalNotice | null => portal.notices[0] ?? null;

/** The month (yyyy-MM) a calendar opens on: the first day that is today or later, else the last window's month. */
export function openingMonth(dates: readonly string[], today: string): string | null {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  const upcoming = sorted.find((d) => d >= today) ?? sorted[sorted.length - 1];
  return upcoming.slice(0, 7);
}
