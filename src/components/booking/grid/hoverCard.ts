import type { HoverFieldKey } from '../../../api/displaySettings';
import { historyActionName, type HistoryLine } from '../../../api/bookingContracts';
import { formatPragueDateTime } from '../../../utils/time';

/*
 * The card that opens when the mouse rests on a booked block: which facts it
 * shows is the administrator's list (`calendar.hover.fields`), and only the
 * facts on that list are fetched. The grid row already carries the patient's
 * name, the činnost, the status and the paperwork mark; the rest lives on the
 * patient's profile, the appointment itself and its history, and is asked for
 * the first time the card opens, never for every block on the screen.
 */

/** Which requests a card needs, given the facts it will show. */
export interface HoverNeeds {
  /** `GET /api/patients/{id}/profile`: phone, e-mail, insurer. */
  profile: boolean;
  /** `GET /api/patients/{id}`: date of birth. */
  patient: boolean;
  /** `GET .../appointments/{id}`: the note. */
  detail: boolean;
  /** `GET .../appointments/{id}/history`: the last change. */
  history: boolean;
}

export function hoverNeeds(fields: readonly HoverFieldKey[]): HoverNeeds {
  const has = (key: HoverFieldKey) => fields.includes(key);
  return {
    profile: has('phone') || has('email') || has('insurer'),
    patient: has('birthDate'),
    detail: has('note'),
    history: has('history'),
  };
}

/**
 * The newest history line as one sentence: `Přesunuto · 23. 9. 2026 10:31 ·
 * Anna Černá`. `null` when there is no history yet.
 */
export function lastChangeText(
  history: readonly HistoryLine[] | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
  unknownActor: string,
): string | null {
  if (!history || history.length === 0) return null;
  const latest = [...history].sort(
    (a, b) => new Date(b.atUtc).getTime() - new Date(a.atUtc).getTime(),
  )[0];
  const action = historyActionName(latest.action);
  const what = action
    ? t(`booking.history.${action}`)
    : t('booking.history.unknown', { code: latest.action });
  return `${what} · ${formatPragueDateTime(latest.atUtc)} · ${latest.actorDisplayName ?? unknownActor}`;
}

/** `1990-05-02` as `2. 5. 1990`; anything else untouched. */
export function birthDateText(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${Number(match[3])}. ${Number(match[2])}. ${match[1]}`;
}
