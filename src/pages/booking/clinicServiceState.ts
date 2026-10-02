/*
 * What one služba is, read off its own counts.
 *
 * A service is the thing that carries meaning: činnosti belong to it, a
 * calendar runs it, and a required document hangs off it. Which means it has
 * two ways of being useless that look identical in a list of names:
 *
 *     no činnosti    nothing to book under it, ever
 *     no kalendář    nothing is booked in it, because nowhere runs it
 *
 * Neither is an error and neither shows up anywhere else. A clinic with three
 * services, one of them empty, looks exactly like a clinic where everything
 * works - and the first anybody hears of it is a day that offers nothing for a
 * reason nobody on that screen can see. That is the shape this project has
 * spent its time removing, so the list says it here.
 */

export interface ClinicServiceLike {
  isActive: boolean;
  activities: number;
  calendars: number;
}

export type ServiceGap =
  | 'none'
  /** Nothing to book under it. The first thing to fix. */
  | 'no-activities'
  /** Has činnosti, but nowhere runs it - so none of them can be booked. */
  | 'no-calendar'
  /** Both, which is simply a service nobody has set up yet. */
  | 'nothing-set-up';

/**
 * What is missing before this service can carry a booking.
 *
 * An inactive service is not reported on: it is not meant to be offered, so
 * having no činnosti under it is the intended state rather than a gap. Saying
 * otherwise would put a warning on every service the owner has deliberately
 * retired.
 */
export function serviceGap(service: ClinicServiceLike): ServiceGap {
  if (!service.isActive) return 'none';

  const noActivities = service.activities === 0;
  const noCalendar = service.calendars === 0;

  if (noActivities && noCalendar) return 'nothing-set-up';
  if (noActivities) return 'no-activities';
  if (noCalendar) return 'no-calendar';
  return 'none';
}

/** The sentence for each, in the words of what to do about it. */
export const SERVICE_GAP_TEXT: Record<Exclude<ServiceGap, 'none'>, string> = {
  'nothing-set-up':
    'Zatím nenastavená — nemá činnosti ani kalendář, takže se na ni nedá objednat.',
  'no-activities':
    'Nemá žádnou činnost, takže se na ni nedá objednat. Přiřaďte jí činnosti.',
  'no-calendar':
    'Neběží ji žádný kalendář, takže se její činnosti nedají nikam objednat.',
};

/**
 * Whether deleting is worth offering at all.
 *
 * The server refuses with `409` while anything hangs off the service, and says
 * how many of each. That refusal is never final - a service empties as its
 * činnosti are moved - so the button stays and the message explains, rather
 * than the screen deciding on the server's behalf and hiding it.
 *
 * What is worth saying before the click is that it will be refused, so nobody
 * spends the click to find out.
 */
export function deletionWillBeRefused(service: ClinicServiceLike): boolean {
  return service.activities > 0 || service.calendars > 0;
}

/** "3 činnosti · 1 kalendář", in Czech, where one and five differ. */
export function countsText(service: ClinicServiceLike): string {
  const activities =
    service.activities === 1 ? '1 činnost'
      : service.activities >= 2 && service.activities <= 4 ? `${service.activities} činnosti`
        : `${service.activities} činností`;
  const calendars =
    service.calendars === 1 ? '1 kalendář'
      : service.calendars >= 2 && service.calendars <= 4 ? `${service.calendars} kalendáře`
        : `${service.calendars} kalendářů`;
  return `${activities} · ${calendars}`;
}
