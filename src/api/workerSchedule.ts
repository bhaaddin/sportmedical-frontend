import { client } from './client';

/**
 * Which services one member of staff works, and on what days.
 *
 * ── It is derived, not stored ──
 *
 * There is no "assign services to this employee" record and there must not be
 * one. A worker is named on a ROW of a calendar's working hours, and a
 * calendar belongs to one service — so putting MUDr. Novák on Monday in the
 * Sportovní prohlídky calendar is what gives him that service. A second list
 * would be a copy that can disagree with the rota, and the rota is what
 * availability is computed from.
 *
 * This is the same fact asked from the person's side, because "what does
 * MUDr. Novák do here?" otherwise meant opening every calendar in turn.
 * Changing it still happens on the working-hours screen.
 */

export interface WorkingDayOfSomebody {
  /** 0 = Sunday, as JavaScript and .NET both number it. */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  /** 1 every week, 2 alternating. */
  repeatEveryNWeeks: number;
  weekOffset: number;
  breakStart: string | null;
  breakEnd: string | null;
}

export interface WhereSomebodyWorksEntry {
  calendarId: string;
  calendarName: string;
  calendarColour: string;
  clinicServiceId: string | null;
  clinicServiceName: string;
  schedulePeriodId: string;
  schedulePeriodName: string;
  validFrom: string;
  validTo: string | null;
  /** Whether this period covers the day the question was asked about. */
  isCurrent: boolean;
  days: WorkingDayOfSomebody[];
}

/**
 * The clinic's today, in the clinic's own time zone.
 *
 * Sent with the request because whether a period is "current" is a question
 * about a calendar day, and the server's UTC day turns over an hour or two
 * before Prague's — a rota that ended yesterday evening would come back
 * reported as running. The server refuses the request without it rather than
 * guessing.
 */
export const clinicToday = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Prague' });

export const workerScheduleApi = {
  /** Where this person works. Yourself always; a colleague needs `users.manage`. */
  forUser: async (userId: string): Promise<WhereSomebodyWorksEntry[]> => {
    const { data } = await client.get<WhereSomebodyWorksEntry[]>(
      `/api/workers/${userId}/schedule`,
      { params: { onDate: clinicToday() } },
    );

    return data ?? [];
  },
};

const WEEKDAYS = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];

/** The Czech name of a weekday the server numbered. */
export const weekdayName = (dayOfWeek: number): string =>
  WEEKDAYS[dayOfWeek] ?? String(dayOfWeek);

/** `08:00:00` → `8:00`, which is how a rota is read aloud. */
export const shortTime = (time: string): string => {
  const [hours, minutes] = time.split(':');

  return `${Number(hours)}:${minutes}`;
};

/**
 * One day as a line: "Pondělí 8:00–16:00 (pauza 12:00–12:30)".
 *
 * The alternating-week note is only added when there IS one. A clinic whose
 * every row says "každý týden" is a clinic being told something it cannot act
 * on, in fourteen places.
 */
export const dayLine = (day: WorkingDayOfSomebody): string => {
  const hours = `${shortTime(day.startTime)}–${shortTime(day.endTime)}`;

  const parts = [`${weekdayName(day.dayOfWeek)} ${hours}`];

  if (day.breakStart !== null && day.breakEnd !== null) {
    parts.push(`pauza ${shortTime(day.breakStart)}–${shortTime(day.breakEnd)}`);
  }

  if (day.repeatEveryNWeeks > 1) {
    parts.push(`každý ${day.repeatEveryNWeeks}. týden`);
  }

  return parts.length === 1 ? parts[0] : `${parts[0]} (${parts.slice(1).join(', ')})`;
};

/** The services somebody currently works, named once each. */
export const currentServices = (entries: readonly WhereSomebodyWorksEntry[]): string[] => [
  ...new Set(entries.filter((entry) => entry.isCurrent).map((entry) => entry.clinicServiceName)),
];
