/*
 * R2 - the calendar selector is by SLUŽBA, not by calendar and never by činnost.
 *
 * The owner: "click a SLUŽBA and see two calendars at once, side by side. I do not need a calendar per ČINNOST - one calendar per
 * služba, and each služba contains its činnosti." The data keeps one row per calendar (`clinicServiceId` says which služba it
 * runs), so the board groups them:
 *
 *   one group = one služba = one chip = one column of a split day
 *     - the group's name and colour are the služba's own (the calendar's name, "Ordinace 1", never reaches the chip);
 *     - a služba with several calendars shows ONE column; its first calendar (sortOrder, then name) is the group's primary and
 *       the others ride in its column (`aliasMap`): a calendar that exists only for one činnost is never a column of its own,
 *       and nothing is deleted - the rows stay in the data and the bookings stay on screen;
 *     - a calendar that runs no služba at all (`clinicServiceId` null) is its own group, named after itself: nothing it holds
 *       may become invisible.
 *
 * Clicking: with every služba shown, a click shows ONLY that služba; a click on another adds it (two services = two columns per
 * day, the split of fix 2.4); a click on a shown one hides it; hiding the last one goes back to "Všechny". Pure rules, no DOM.
 */
import type { Calendar } from '../../../api/bookingContracts';

export interface ServiceLike {
  id: string;
  name: string;
  colorHex?: string | null;
  isActive?: boolean;
}

export interface GroupActivity {
  id: string;
  name: string;
  colour: string;
}

export interface ServiceGroup {
  /** The služba's id, or the calendar's own id when the calendar runs no služba. */
  id: string;
  serviceId: string | null;
  name: string;
  /** The primary calendar's own name ("Ordinace 1", "Diagnostika"): what the Kalendáře chips say (R20). */
  calendarName: string;
  /** `#RRGGBB`. */
  colour: string;
  /** Every calendar of the group, primary first. */
  calendarIds: string[];
  /** The calendar the group's column books into and is represented by. */
  primaryId: string;
  /** The calendars that ride in the primary's column (never a column of their own). */
  hiddenCalendarIds: string[];
  /** The činnosti the služba offers: shown as pills inside the selector, never as calendars. */
  activities: GroupActivity[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const FALLBACK = '#6e91a5';

const byOrder = (a: Calendar, b: Calendar): number => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs');
const colourOf = (hex: string | null | undefined): string | null => (hex && HEX.test(hex) ? hex : null);

export function serviceGroups(
  calendars: readonly Calendar[],
  services: readonly ServiceLike[],
  activitiesOf: (serviceId: string) => GroupActivity[] = () => [],
): ServiceGroup[] {
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const sorted = [...calendars].sort(byOrder);
  const groups = new Map<string, Calendar[]>();
  for (const calendar of sorted) {
    const key = calendar.clinicServiceId && serviceById.has(calendar.clinicServiceId) ? calendar.clinicServiceId : calendar.id;
    const list = groups.get(key);
    if (list) list.push(calendar);
    else groups.set(key, [calendar]);
  }
  return [...groups].map(([key, list]) => {
    const service = serviceById.get(key);
    const primary = list[0]!;
    return {
      id: key,
      serviceId: service ? service.id : null,
      name: service ? service.name : primary.name,
      calendarName: primary.name,
      colour: colourOf(service?.colorHex) ?? colourOf(primary.color) ?? FALLBACK,
      calendarIds: list.map((c) => c.id),
      primaryId: primary.id,
      hiddenCalendarIds: list.slice(1).map((c) => c.id),
      activities: service ? activitiesOf(service.id) : [],
    };
  });
}

/** Every calendar id -> the primary calendar of its group (the column it is drawn in). */
export function aliasMap(groups: readonly Pick<ServiceGroup, 'calendarIds' | 'primaryId'>[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const g of groups) for (const id of g.calendarIds) map.set(id, g.primaryId);
  return map;
}

/** The group is on screen (`ticked` null = everything is). */
export const groupOn = (ticked: ReadonlySet<string> | null, group: Pick<ServiceGroup, 'calendarIds'>): boolean =>
  ticked === null || group.calendarIds.some((id) => ticked.has(id));

/** The calendar set after a click on a group's chip (null = all shown). */
export function toggleGroupSet(
  ticked: ReadonlySet<string> | null,
  groups: readonly Pick<ServiceGroup, 'id' | 'calendarIds'>[],
  id: string,
): ReadonlySet<string> | null {
  const clicked = groups.find((g) => g.id === id);
  if (!clicked) return ticked;
  if (ticked === null) return new Set(clicked.calendarIds);
  const next = new Set(ticked);
  if (groupOn(ticked, clicked)) for (const c of clicked.calendarIds) next.delete(c);
  else for (const c of clicked.calendarIds) next.add(c);
  const allOn = groups.every((g) => g.calendarIds.every((c) => next.has(c)));
  if (next.size === 0 || allOn) return null;
  return next;
}

/** How many groups are on screen. */
export const groupsOnScreen = (ticked: ReadonlySet<string> | null, groups: readonly Pick<ServiceGroup, 'calendarIds'>[]): number =>
  groups.filter((g) => groupOn(ticked, g)).length;
