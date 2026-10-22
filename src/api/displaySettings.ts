/* ══════════════════════════════════════════════════════════════
   How the clinic's own screens are drawn — the owner's settings.

   The calendar had its view, row length, day span and now-line colour
   written into CalendarGridPage, and the patient card and register a fixed
   list of fields. The owner's rule is that what he may want different is
   his to change in Nastavení, so the server keeps them and these read them:

     GET/PUT /api/v1/settings/calendar-display   (read: anyone signed in)
     GET/PUT /api/v1/settings/patient-fields     (read: patients.view)

   Writes need settings.clinic.manage; the server refuses a value its
   screens cannot draw, field by field.
   ══════════════════════════════════════════════════════════════ */

import { useQuery } from '@tanstack/react-query';
import { client } from './client';
import type { Permission } from '../auth/usePermission';
import { DEFAULT_HOLIDAY_COLOR, effectiveHolidayColor } from '../planner/model/dayLock';

/* ── Calendar ─────────────────────────────────────────────────────── */

export type CalendarView = 'day' | 'week' | 'month';

export interface CalendarDisplaySettings {
  defaultView: CalendarView;
  /** Length of one grid row in minutes; one of `slotLengths`. */
  slotMinutes: number;
  /** First hour the grid shows, 0–23. */
  dayStartHour: number;
  /** Hour the grid ends at, 1–24, after the start. */
  dayEndHour: number;
  /** `#RRGGBB`. */
  nowLineColor: string;
  /** `#RRGGBB` — the colour a closed day (holiday, closure) is painted on the grid. */
  holidayColor: string;
  /** `#RRGGBB` — the colour the lunch break is painted on the grid. */
  lunchColor: string;
  /**
   * Which facts the card on a booked slot shows when the mouse rests on it,
   * in order, by field key (`patientName`, `phone`, `activity`, `status`,
   * `paperwork`, `birthDate`, …). The owner chooses these; the server sends them.
   */
  hoverFields: string[];
  /**
   * `HH:mm` — the lunch break the grid paints. The server keeps them with the
   * rest and `PUT` is the whole settings object: a body that leaves them out
   * WRITES `""` over both (measured on the dev API), so a save has to carry
   * back what it read. Optional only so a fixture need not name them.
   */
  lunchFrom?: string;
  lunchTo?: string;
}

/** One fact the hover card may show, as the server describes it. */
export interface HoverFieldChoice {
  key: string;
  label: string;
  help: string;
  /** Only for accounts that may see sensitive identity data. */
  sensitive: boolean;
}

export interface CalendarDisplayResponse {
  settings: CalendarDisplaySettings;
  /** The choices the server allows — the screen offers these, not its own copy. */
  views: CalendarView[];
  slotLengths: number[];
  defaults: CalendarDisplaySettings;
  /** What the hover card may be asked to show (an older server sends none). */
  hoverFieldCatalogue?: HoverFieldChoice[];
}

/**
 * The hover facts the booking card in the calendar can actually draw. The
 * server's catalogue also lists the note, the insurer and the last change, but
 * a calendar row carries none of them, so ticking one would change nothing;
 * the screen offers only what the card draws.
 */
export const HOVER_FIELDS_THE_CARD_DRAWS: readonly string[] = [
  'patientName', 'phone', 'email', 'birthDate', 'activity', 'service', 'status', 'paperwork',
];

/** What the screen offers when the server sent no catalogue (its own list, the same labels). */
export const HOVER_FIELD_FALLBACK: HoverFieldChoice[] = [
  { key: 'patientName', label: 'Jméno pacienta', help: 'Celé jméno pacienta z registru.', sensitive: false },
  { key: 'phone', label: 'Telefon', help: 'Telefon z profilu pacienta, aby šlo zavolat bez otevírání karty.', sensitive: false },
  { key: 'email', label: 'E-mail', help: 'E-mail z profilu pacienta.', sensitive: false },
  { key: 'activity', label: 'Činnost', help: 'Co je objednáno, například Vstupní prohlídka.', sensitive: false },
  { key: 'service', label: 'Služba', help: 'Služba, pod kterou činnost a kalendář patří.', sensitive: false },
  { key: 'status', label: 'Stav termínu', help: 'Objednán, přišel, nepřišel, dokončeno nebo zrušeno.', sensitive: false },
  { key: 'paperwork', label: 'Podklady', help: 'Zda pacient má dotazník a výpis, které činnost vyžaduje.', sensitive: false },
  { key: 'birthDate', label: 'Datum narození', help: 'Jen pro účty s oprávněním vidět citlivé identifikační údaje.', sensitive: true },
];

/**
 * The checkboxes of the hover section: the server's catalogue (its labels and
 * order) narrowed to what the card draws. A key already saved but unknown to
 * the catalogue is kept out of the list, never silently dropped from the
 * setting itself.
 */
export function hoverChoices(catalogue: readonly HoverFieldChoice[] | undefined): HoverFieldChoice[] {
  const source = catalogue !== undefined && catalogue.length > 0 ? catalogue : HOVER_FIELD_FALLBACK;
  return source.filter((choice) => HOVER_FIELDS_THE_CARD_DRAWS.includes(choice.key));
}

/**
 * What the grid draws with when the server cannot be asked at all.
 *
 * The same values the server's defaults are, so a calendar that loses the
 * settings request still draws the day the clinic has always seen rather than
 * nothing. It is never shown on the settings screen, which reads the server's
 * own `defaults`.
 */
export const CALENDAR_DISPLAY_OFFLINE: CalendarDisplaySettings = {
  defaultView: 'week',
  slotMinutes: 30,
  dayStartHour: 7,
  dayEndHour: 19,
  /* The board's colours (3. 10. 2026), the same ones the server opens with. */
  nowLineColor: '#C0392B',
  /* R6: a fixed strong red, independent of the accent (the server's old beige default is replaced, see `effectiveHolidayColor`). */
  holidayColor: DEFAULT_HOLIDAY_COLOR,
  lunchColor: '#CBD1D8',
  hoverFields: ['patientName', 'activity', 'status', 'phone', 'paperwork'],
};

export const readCalendarDisplay = async (): Promise<CalendarDisplayResponse> => {
  const { data } = await client.get<CalendarDisplayResponse>('/api/v1/settings/calendar-display');
  return withHolidayRed(data);
};

/** R6: the server's old beige holiday default (and a stored colour that fails the guard) is shown and drawn as the fixed red. */
function withHolidayRed(data: CalendarDisplayResponse): CalendarDisplayResponse {
  return {
    ...data,
    settings: { ...data.settings, holidayColor: effectiveHolidayColor(data.settings.holidayColor) },
    defaults: { ...data.defaults, holidayColor: DEFAULT_HOLIDAY_COLOR },
  };
}

export const saveCalendarDisplay = async (
  settings: CalendarDisplaySettings,
): Promise<CalendarDisplayResponse> => {
  const { data } = await client.put<CalendarDisplayResponse>(
    '/api/v1/settings/calendar-display',
    settings,
  );
  return withHolidayRed(data);
};

export const CALENDAR_DISPLAY_QUERY_KEY = ['settings', 'calendar-display'] as const;

/** The calendar settings, or the offline values until (or unless) they arrive. */
export function useCalendarDisplay(): { settings: CalendarDisplaySettings; loaded: boolean } {
  const query = useQuery({
    queryKey: CALENDAR_DISPLAY_QUERY_KEY,
    queryFn: readCalendarDisplay,
    staleTime: 5 * 60 * 1000,
  });

  return {
    settings: query.data?.settings ?? CALENDAR_DISPLAY_OFFLINE,
    loaded: query.data !== undefined,
  };
}

/**
 * The hours the grid shows: the clinic's day, widened to the opening hours
 * of the calendars on screen and to any appointment outside both.
 *
 * A setting may hide empty time, never a patient — somebody booked at 6:30
 * on a grid that starts at 7 would be a booking nobody at the desk can see.
 */
export function gridSpan(
  settings: Pick<CalendarDisplaySettings, 'dayStartHour' | 'dayEndHour'>,
  opening: { start: number; end: number } | null,
  appointmentHours: ReadonlyArray<{ start: number; end: number }> = [],
): { start: number; end: number } {
  let start = settings.dayStartHour;
  let end = settings.dayEndHour;

  for (const span of opening === null ? appointmentHours : [opening, ...appointmentHours]) {
    start = Math.min(start, span.start);
    end = Math.max(end, span.end);
  }

  return { start: Math.max(0, start), end: Math.min(24, Math.max(end, start + 1)) };
}

/* ── Patient fields ───────────────────────────────────────────────── */

export interface PatientField {
  key: string;
  label: string;
  /** `personal` (Osobní údaje) or `registration` (Registrační údaje). */
  group: 'personal' | 'registration';
  onCard: boolean;
  onList: boolean;
  /** Shown only with `patients.sensitive_identity.view`, whatever the setting. */
  sensitive: boolean;
}

export interface PatientFieldVisibility {
  fields: PatientField[];
  /** Keys in the order the clinic chose. */
  visible: string[];
}

export const SENSITIVE_IDENTITY: Permission = 'patients.sensitive_identity.view';

export const readPatientFields = async (): Promise<PatientFieldVisibility> => {
  const { data } = await client.get<PatientFieldVisibility>('/api/v1/settings/patient-fields');
  return data;
};

export const savePatientFields = async (visible: string[]): Promise<PatientFieldVisibility> => {
  const { data } = await client.put<PatientFieldVisibility>('/api/v1/settings/patient-fields', {
    visible,
  });
  return data;
};

export const PATIENT_FIELDS_QUERY_KEY = ['settings', 'patient-fields'] as const;

/**
 * Which fields one screen draws, in the clinic's order.
 *
 * Returns `null` until the setting is known, so a screen can tell "nothing
 * chosen" from "not asked yet" and not flash the whole list first.
 */
export function shownFields(
  visibility: PatientFieldVisibility | undefined,
  surface: 'card' | 'list',
  maySeeSensitive: boolean,
  group?: PatientField['group'],
): PatientField[] | null {
  if (visibility === undefined) return null;

  const byKey = new Map(visibility.fields.map((field) => [field.key, field]));

  return visibility.visible
    .map((key) => byKey.get(key))
    .filter((field): field is PatientField => field !== undefined)
    .filter((field) => (surface === 'card' ? field.onCard : field.onList))
    .filter((field) => maySeeSensitive || !field.sensitive)
    .filter((field) => group === undefined || field.group === group);
}

export function usePatientFields(enabled = true) {
  return useQuery({
    queryKey: PATIENT_FIELDS_QUERY_KEY,
    queryFn: readPatientFields,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
