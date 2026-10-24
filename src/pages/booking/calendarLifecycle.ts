/*
 * The three states a calendar can be in, kept apart.
 *
 * Contract v37, 4.1, changes 87 and 88. Until 13. 9. 2026 `DELETE` deactivated
 * and there was no separate deactivate at all, so one button meant both things
 * - which is what the owner objected to in his own words: "neaktívny je keď ho
 * zneaktívnim, a nie keď ho odstránim".
 *
 *     aktivní     new bookings yes
 *     neaktivní   new bookings NO; existing appointments stand, nobody cancelled
 *     smazaný     never carried anything; gone with its periods, hours, day
 *                 activities, exceptions, blocks and access
 *
 * Worth recording because it changes what this screen is for: `IsActive` was
 * measured to mean nothing at all before - no rule read it, so a "deleted"
 * calendar still took bookings. The state is real now.
 */
import type { AttentionGroup } from '../../ui/shelf/attention';

export interface CalendarLike {
  isActive: boolean;
}

/**
 * What the list shows.
 *
 * Inactive ones are hidden by default. The owner's complaint is a crowded
 * screen and hiding is the answer to that; deleting is not, because deleting
 * takes the appointments with it - and the server refuses precisely then,
 * which is the refusal somebody meets at the worst moment.
 */
export function visibleCalendars<T extends CalendarLike>(
  calendars: readonly T[],
  showInactive: boolean,
): T[] {
  return showInactive ? [...calendars] : calendars.filter((c) => c.isActive);
}

/** How many are hidden right now - the switch says so rather than just offering. */
export function hiddenCount(calendars: readonly CalendarLike[]): number {
  return calendars.filter((c) => !c.isActive).length;
}

/**
 * Whether a calendar that cannot be deleted can be deactivated instead.
 *
 * Offered only after the server has refused, and only when there is something
 * to offer: suggesting "zneaktivnit" for a calendar that already is would be a
 * button that does nothing to a person who has just been told no.
 */
export function offerDeactivateInstead(
  calendar: CalendarLike | null,
  deleteFailed: boolean,
): boolean {
  return deleteFailed && calendar !== null && calendar.isActive;
}

/**
 * The ones the grid leaves out, so it can name them instead of dropping them.
 *
 * The planning grid draws only active calendars - an inactive one's hours no
 * longer count - and until now that meant a calendar simply vanished from the
 * chip row with no explanation, while its appointments went on being drawn
 * among everyone else's. "Kam sa podela Ordinace" is the question that
 * follows, and the screen had no answer on it.
 *
 * Paired with `visibleCalendars` on purpose: between them every calendar is
 * either drawn or named, and `everyCalendarIsShownOrNamed` in the tests holds
 * that. A calendar in neither is one that disappeared.
 */
export function inactiveAmong<T extends CalendarLike>(calendars: readonly T[]): T[] {
  return calendars.filter((c) => !c.isActive);
}

/* ───────────────────────────── the shelf look (Phase 2, S-5) ───────────────────────────── */


/**
 * "Vyžaduje pozornost" on Kalendáře: an ACTIVE calendar that runs no služba offers nothing on any day, and nothing else
 * says why. Each case opens that calendar's form (`editCalendarId`). From the list the screen already reads; `null` when
 * nothing is wrong. An inactive one is not a problem - it takes no bookings anyway.
 */
export function calendarsAttention(
  calendars: readonly { id: string; name: string; isActive: boolean; clinicServiceId: string | null }[],
): AttentionGroup | null {
  const silent = calendars.filter((c) => c.isActive && c.clinicServiceId === null);
  if (silent.length === 0) return null;
  return {
    id: 'scheduleProblems',
    severity: 'high',
    title: 'Kalendář bez služby',
    count: silent.length,
    items: silent.slice(0, 5).map((c) => ({
      id: c.id,
      title: `„${c.name}“ bez služby`,
      detail: 'Pacient se do něj neobjedná. Vyberte mu službu.',
      to: '/calendars',
      state: { editCalendarId: c.id },
    })),
    summary: silent.length === 1 ? 'Jeden kalendář nenabízí žádný termín.' : `${silent.length} ${silent.length < 5 ? 'kalendáře nenabízejí' : 'kalendářů nenabízí'} žádný termín.`,
    action: { label: 'Nastavit službu', to: '/calendars', state: { editCalendarId: silent[0].id } },
  };
}

/** The calendar a link asks for (router state, read once): mark it (`openCalendarId`) or open its form (`editCalendarId`). */
export function calendarDeepLink(state: unknown): { kind: 'open' | 'edit'; id: string } | null {
  if (state === null || typeof state !== 'object') return null;
  const s = state as Record<string, unknown>;
  if (typeof s.editCalendarId === 'string' && s.editCalendarId !== '') return { kind: 'edit', id: s.editCalendarId };
  if (typeof s.openCalendarId === 'string' && s.openCalendarId !== '') return { kind: 'open', id: s.openCalendarId };
  return null;
}
