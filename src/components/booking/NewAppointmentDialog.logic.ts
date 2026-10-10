import { pragueWallClockToInstant } from '../../utils/time';
import type { DateOnly } from '../../utils/time';

/**
 * The time arithmetic of the booking dialog.
 *
 * The grid hands the dialog a range as local clinic time - `2026-09-24T09:00`
 * to `2026-09-24T10:00` - because that is what a person dragged across. The
 * server takes a UTC instant and an activity, and the appointment's end is the
 * activity's length, not the drag. Everything between those two shapes is here,
 * so it can be tested on its own - including the day the clocks change, where
 * "09:00 in Prague" is a different UTC hour than the day before.
 *
 * Nothing here works out whether a time is free. That is `availability`'s
 * answer (contract 6.1); `isStartOffered` only reads it.
 */

/** A clinic wall-clock moment: `yyyy-MM-dd` and `HH:mm`. */
export interface LocalMoment {
  date: DateOnly;
  time: string;
}

const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^(\d{2}):(\d{2})$/;

/** `2026-09-24T09:00` -> `{ date, time }`, or null for anything else. */
export function parseLocalDateTime(value: string | undefined | null): LocalMoment | null {
  if (!value) return null;
  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return null;
  const [, date, hours, minutes] = match;
  if (Number(hours) > 23 || Number(minutes) > 59) return null;
  return { date, time: `${hours}:${minutes}` };
}

export function isDateOnly(value: string): boolean {
  return DATE_ONLY.test(value);
}

/** `HH:mm`, 00:00 to 23:59. What `<input type="time">` gives, trimmed of seconds. */
export function normalizeTime(value: string): string {
  const cut = value.slice(0, 5);
  const match = TIME_OF_DAY.exec(cut);
  if (!match) return '';
  return Number(match[1]) > 23 || Number(match[2]) > 59 ? '' : cut;
}

export function isCompleteMoment(moment: LocalMoment): boolean {
  return isDateOnly(moment.date) && normalizeTime(moment.time) !== '';
}

/** The UTC instant a clinic wall-clock moment is, as the API wants it. */
export function toStartUtc(moment: LocalMoment): string {
  return pragueWallClockToInstant(moment.date, moment.time).toISOString();
}

function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * How long the dragged selection is, in minutes - or null when there is no
 * end, the end is on another day, or it is not after the start.
 */
export function selectionMinutes(start: LocalMoment, end: LocalMoment | null): number | null {
  if (!end || end.date !== start.date) return null;
  const length = minutesOfDay(end.time) - minutesOfDay(start.time);
  return length > 0 ? length : null;
}

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Prague',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** `09:05` - a UTC instant as clinic wall-clock time, always two digits. */
export function pragueClock(instant: string | Date): string {
  return clock.format(typeof instant === 'string' ? new Date(instant) : instant);
}

/**
 * When an appointment of `durationMinutes` starting at `start` ends, on the
 * clinic's wall clock. Counted on the instant, not on the clock face, so a
 * clock change inside the appointment is honoured.
 */
export function endClock(start: LocalMoment, durationMinutes: number): string {
  const startMs = Date.parse(toStartUtc(start));
  return pragueClock(new Date(startMs + durationMinutes * 60_000));
}

/** `od 09:00 do 10:00` - the words the owner asked to see. */
export function rangeLabel(from: string, to: string): string {
  return `od ${from} do ${to}`;
}

/** Whether the server offered exactly this start. Compared as instants. */
export function isStartOffered(
  slots: readonly { startUtc: string }[] | undefined,
  startUtc: string | null,
): boolean {
  if (!slots || !startUtc) return false;
  const wanted = Date.parse(startUtc);
  return slots.some((s) => Date.parse(s.startUtc) === wanted);
}

/* ── The drawer's words and small decisions (design board 2026-10-03, screens 8–11) ── */

/** The three ways to fill one slot, as the drawer's mode cards name them. */
export type DrawerMode = 'database' | 'quick' | 'event';

/** Which of the two steps the drawer is on: who comes, then what is done. */
export type DrawerStep = 1 | 2;

/** `2 200 Kč` - money the way the board writes it; `—` when there is no price. */
export function formatCzk(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  /* Thousands are grouped with a no-break space, so "2 200" never wraps. Haléře
     show only when an agreed price carries them (Etapa 12). */
  const grouped = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 })
    .format(amount)
    .replace(/\s/g, ' ');
  return `${grouped} Kč`;
}

/** `1 minuta`, `3 minuty`, `60 minut` - the Czech plural, counted. */
export function minutesWord(minutes: number): string {
  const abs = Math.abs(minutes);
  const word = abs === 1 ? 'minuta' : abs >= 2 && abs <= 4 ? 'minuty' : 'minut';
  return `${minutes} ${word}`;
}

const weekdayFormatter = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long' });

/** `Pondělí` - the weekday of a `yyyy-MM-dd`, capitalised as the board writes it. */
export function weekdayName(date: DateOnly): string {
  if (!DATE_ONLY.test(date)) return '';
  const [year, month, day] = date.split('-').map(Number);
  const word = weekdayFormatter.format(new Date(year, month - 1, day));
  return word.charAt(0).toLocaleUpperCase('cs-CZ') + word.slice(1);
}

/** `26. 10. 2026` - a date-only value, no zone, no leading zeros. */
function dateWords(date: DateOnly): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day}. ${month}. ${year}`;
}

/**
 * The slot card's first line: `Pondělí 26. 10. 2026 · 10:00 — 11:00`, or
 * `… · od 10:00` while there is no end to speak of.
 */
export function slotTitle(date: DateOnly, time: string, end: string | null): string {
  if (!DATE_ONLY.test(date)) return '';
  const when = `${weekdayName(date)} ${dateWords(date)}`;
  const from = normalizeTime(time);
  if (from === '') return when;
  return end ? `${when} · ${from} — ${end}` : `${when} · od ${from}`;
}

/** The slot card's second line: `60 minut volno`, or nothing when no range was dragged. */
export function slotSubtitle(minutes: number | null): string {
  return minutes === null ? '' : `${minutesWord(minutes)} volno`;
}

/** `BK` for `Bohumil Komárek`; one letter for one word; empty for nothing. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toLocaleUpperCase('cs-CZ'))
    .join('');
}

/**
 * `Filip Fehér` typed in one box -> first name and surname. The first word is
 * the first name and everything after it the surname, so `Jan van Dyk` keeps
 * its particle. One word alone is not enough to register anybody: null.
 */
export function splitFullName(value: string): { firstName: string; lastName: string } | null {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  return { firstName: words[0], lastName: words.slice(1).join(' ') };
}

/**
 * A telephone typed at the desk, made sendable: digits only, with the dialling
 * code the register wants (`Zadejte ho s předvolbou`). `773 539 001` is a Czech
 * number, so it gets `+420`; `00421…` and `+421…` keep their country. Empty
 * stays null - a telephone is optional, a half-typed one is not a telephone.
 */
export function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const plus = trimmed.startsWith('+') || trimmed.startsWith('00');
  const digits = trimmed.replace(/\D/g, '').replace(/^00/, '');
  if (digits === '') return null;
  if (plus) return `+${digits}`;
  return `+420${digits.replace(/^0+/, '')}`;
}

/**
 * What the desk types for a caller the register does not know yet ("Rychlá
 * registrace"): four things, and never a date of birth - the patient gives
 * that, and the rest, through the completion link (Etapa 2, decision 7).
 */
export interface QuickPatientDraft {
  /** `Filip Fehér` - one box, split on the way out. */
  name: string;
  /** Carries its dialling code once typed through the phone field. */
  phone: string;
  email: string;
  /** The činnost the caller asked for - the slot is already chosen, so this is the booking. */
  activityId: string;
}

export const EMPTY_QUICK_DRAFT: QuickPatientDraft = {
  name: '',
  phone: '',
  email: '',
  activityId: '',
};

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Which of the four boxes are not fit to send yet, as the sentence to show -
 * the server has the last word, this only spares a round trip for the obvious.
 * An empty result means the form can go.
 */
export function quickDraftProblems(
  draft: QuickPatientDraft,
): Partial<Record<keyof QuickPatientDraft, string>> {
  const out: Partial<Record<keyof QuickPatientDraft, string>> = {};
  if (draft.name.trim() !== '' && splitFullName(draft.name) === null) {
    out.name = 'Zadejte jméno i příjmení.';
  }
  if (draft.email.trim() !== '' && !EMAIL_SHAPE.test(draft.email.trim())) {
    out.email = 'E-mail nevypadá správně.';
  }
  return out;
}

/** Whether the four boxes are all filled well enough to send. */
export function isQuickDraftComplete(draft: QuickPatientDraft): boolean {
  return (
    splitFullName(draft.name) !== null &&
    normalizePhone(draft.phone) !== null &&
    EMAIL_SHAPE.test(draft.email.trim()) &&
    draft.activityId !== ''
  );
}

/** The header's second line, the way the board words each step. */
export function stepSubtitle(step: DrawerStep, mode: DrawerMode): string {
  if (step === 2) return 'Krok 2 ze 2 — co se bude dělat';
  switch (mode) {
    case 'quick':
      /* No second step: the slot is chosen, so the four facts book it. */
      return 'Rychlá registrace — nový pacient';
    case 'event':
      return 'Krok 1 ze 2 — bez pacienta';
    default:
      return 'Krok 1 ze 2 — kdo přijde';
  }
}

/** The header's title. */
export function drawerTitle(_mode: DrawerMode): string {
  return 'Objednat termín';
}

/** `3 nalezeni` / `1 nalezen` - the count in the search box. */
export function foundPatientsWord(count: number): string {
  return count === 1 ? '1 nalezen' : `${count} nalezeni`;
}
