/*
 * How long the výpis still stands, and against what.
 *
 * The server sends one value - `reportValidUntil`, a date, or `null` - and
 * this works out what to say about it. It sends a date and not a number of
 * days on purpose, and the reason is the whole of this file: a count of days
 * would have to be counted from something, and there are two somethings.
 *
 *     on the patient card   measured against TODAY
 *                           "platí ještě 4 měsíce"
 *     on an appointment     measured against THE DAY OF THE APPOINTMENT
 *                           "v den prohlídky už platný nebude"
 *
 * One value, two questions, and the choosing happens here rather than on the
 * server having guessed which was being asked.
 *
 * WHAT THIS IS NOT
 *
 * It is not the gate. Whether a patient may be seen for a given appointment is
 * answered by the server, in `ready` and `missing` on that appointment's own
 * `PaperworkView`, computed against that appointment's day. Calling
 * `reportStandsOn` to decide that would be a second copy of a rule that
 * already exists - the fault this project spends most of its time removing -
 * and the two copies would not even agree: booking takes the appointment's day
 * from its UTC instant, this file takes local midnights, and those differ for
 * an appointment just after midnight.
 *
 * So: this works out what to SAY. What is ALLOWED comes from the server.
 *
 * `null` means there is no valid výpis, and it means that for every reason at
 * once - never uploaded, expired, or uploaded with nobody filling in the date.
 * The owner asked for one sentence for all of them: "treba doplniť výpis", no
 * frightening, no distinguishing. That is not a shortcut here; it is the
 * requirement, and `missing` carries `report_missing` for all of them too.
 */

/** A date-only value as the server sends it: `YYYY-MM-DD`. */
export type DateOnlyString = string;

export type ReportValidity =
  | { kind: 'missing' }
  | { kind: 'valid'; until: Date; daysLeft: number }
  | { kind: 'expired'; until: Date; daysAgo: number };

/*
 * The last day it counts, not the first day it does not.
 *
 * "Platí do 3. 5." is read by everybody as "3. 5. included", so a výpis whose
 * `reportValidUntil` is today is valid today. It was worth asking, because it
 * decides a real day and on that day a patient is either seen or sent home.
 *
 * Asked of booking and confirmed: their rule is `appointmentDay <= until`, not
 * `<`, and for the same reason plus one more - it is a warning, not a bar, so
 * of the two readings the lenient one is right. A výpis issued 3. 5. 2026
 * covers an examination on 3. 5. 2027 and not on 4. 5. 2027.
 *
 * The year itself is added on their side and never here: `AddYears(1)`, not
 * 365 days, so a leap year cannot quietly shorten it.
 */
export const LAST_DAY_IS_INCLUSIVE = true;

/** Midnight of a `YYYY-MM-DD`, in local terms - these are days, not instants. */
function startOfDay(date: DateOnlyString | Date): Date | null {
  if (date instanceof Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (match === null) return null;
  const [, y, m, d] = match;
  const parsed = new Date(Number(y), Number(m) - 1, Number(d));
  /* `new Date(2026, 1, 31)` silently becomes 3 March. A date the server could
     not have sent is a bug to report, not a day to invent. */
  if (parsed.getMonth() !== Number(m) - 1 || parsed.getDate() !== Number(d)) return null;
  return parsed;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between two midnights. Positive when `to` is later. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * What the výpis is, measured against a given day.
 *
 * `against` is the caller's choice and the reason the server sends a date:
 * today on the patient card, the appointment's own day beside an appointment.
 */
export function reportValidity(
  validUntil: DateOnlyString | null | undefined,
  against: Date | DateOnlyString = new Date(),
): ReportValidity {
  if (validUntil === null || validUntil === undefined) {
    return { kind: 'missing' };
  }

  const until = startOfDay(validUntil);
  const day = startOfDay(against);
  /*
   * An unreadable date is not a valid výpis, and saying "platí" about one we
   * could not read would be the worst of the three answers.
   *
   * An empty string arrives here too. There used to be an explicit test for it
   * above; mutation showed it could not change an answer, because `startOfDay`
   * already refuses it - a guard that cannot fail is the thing this repo keeps
   * deleting, so it went.
   */
  if (until === null || day === null) return { kind: 'missing' };

  const left = daysBetween(day, until);
  if (left > 0 || (left === 0 && LAST_DAY_IS_INCLUSIVE)) {
    return { kind: 'valid', until, daysLeft: left };
  }
  return { kind: 'expired', until, daysAgo: -left };
}

/**
 * The phrase for the patient card: how much longer it has.
 *
 * Months while there are months, days once it is close, because "platí ještě
 * 132 dní" is a number nobody converts and "platí ještě 4 měsíce" is one
 * anybody acts on. Under a month the days are what matters again - that is
 * when somebody has to do something about it.
 */
export function remainingText(daysLeft: number): string {
  if (daysLeft === 0) return 'platí jen dnes';
  if (daysLeft === 1) return 'platí ještě dnes a zítra';
  if (daysLeft < 30) return `platí ještě ${daysLeft} dní`;
  const months = Math.floor(daysLeft / 30);
  return months === 1 ? 'platí ještě měsíc' : `platí ještě ${months} měsíce`.replace(
    /(\d+) měsíce/,
    (_m, n: string) => (Number(n) >= 5 ? `${n} měsíců` : `${n} měsíce`),
  );
}

/**
 * How long a výpis is good for, worked out from the day it was issued.
 *
 * THIS IS A SECOND COPY OF A RULE AND IT IS MEANT TO BE DELETED.
 *
 * The rule is the owner's and he stated it plainly: a výpis is good for a year
 * from its date of issue. Booking implements it as `issued.AddYears(1)` and
 * sends the answer as `reportValidUntil` on `PaperworkView`. That is the value
 * this file is built around and the one that should be used.
 *
 * It is not on the running server, it hangs off an appointment, and the patient
 * card has no appointment. So the card could either say nothing about validity
 * at all - which is what it did, and what the owner asked about twice - or work
 * it out from `reportDate`, which it does have.
 *
 * Two copies of "a year" can drift, and if the rule ever becomes two years this
 * one goes wrong silently. That is the cost, it is real, and it is taken
 * knowingly rather than hidden: the moment a server-sent date is available,
 * pass that to `reportValidity` instead and delete this function. Nothing else
 * needs to change, because everything else already takes a date.
 */
export const VYPIS_VALID_MONTHS = 12;

export function validUntilFromIssued(
  issued: DateOnlyString | null | undefined,
): DateOnlyString | null {
  if (issued === null || issued === undefined) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(issued);
  if (match === null) return null;
  const [, y, m, d] = match;

  /*
   * Whole years, not 365 days: a leap year in between would quietly shorten it
   * by a day, and booking guards the same thing with `AddYears(1)`.
   *
   * 29 February is the case that needs saying out loud. A výpis issued on
   * 29. 2. 2028 has no anniversary in 2029; `Date` would roll it to 1 March,
   * which is a day of validity nobody granted. It is pulled back to 28
   * February - the last day of the month it was issued in - which is the
   * reading that never invents a day.
   */
  const year = Number(y) + Math.floor(VYPIS_VALID_MONTHS / 12);
  const month = Number(m);
  const lastOfMonth = new Date(year, month, 0).getDate();
  const day = Math.min(Number(d), lastOfMonth);

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}
