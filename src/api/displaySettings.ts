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

/* ── Calendar ─────────────────────────────────────────────────────── */

export type CalendarView = 'day' | 'week' | 'month';

/**
 * The facts the card on a booked block can show. The server holds the
 * catalogue (`hoverFieldCatalogue`) with a label and one sentence of help for
 * each; this is the closed list the card knows how to draw.
 */
export type HoverFieldKey =
  | 'patientName'
  | 'phone'
  | 'email'
  | 'activity'
  | 'service'
  | 'status'
  | 'paperwork'
  | 'note'
  | 'insurer'
  | 'birthDate'
  | 'history';

export interface HoverFieldCatalogueEntry {
  key: string;
  label: string;
  help: string;
  /** Shown only with `patients.sensitive_identity.view`, whatever the setting says. */
  sensitive: boolean;
}

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
  /** What the card on a booked block shows, in this order; keys of the catalogue. */
  hoverFields: string[];
  /**
   * The clinic-wide lunch as `HH:mm`, both empty when the clinic has none by
   * default. A working-hours row with its own break outranks it.
   */
  lunchFrom: string;
  lunchTo: string;
}

export interface CalendarDisplayResponse {
  settings: CalendarDisplaySettings;
  /** The choices the server allows — the screen offers these, not its own copy. */
  views: CalendarView[];
  slotLengths: number[];
  hoverFieldCatalogue: HoverFieldCatalogueEntry[];
  defaults: CalendarDisplaySettings;
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
  slotMinutes: 15,
  dayStartHour: 7,
  dayEndHour: 19,
  nowLineColor: '#D32F2F',
  hoverFields: ['patientName', 'activity', 'status', 'phone', 'paperwork'],
  lunchFrom: '12:00',
  lunchTo: '12:30',
};

/** The known keys, so an unknown one from an older server is drawn as nothing rather than crashing the card. */
export const HOVER_FIELD_KEYS: readonly HoverFieldKey[] = [
  'patientName',
  'phone',
  'email',
  'activity',
  'service',
  'status',
  'paperwork',
  'note',
  'insurer',
  'birthDate',
  'history',
];

export function isHoverFieldKey(key: string): key is HoverFieldKey {
  return (HOVER_FIELD_KEYS as readonly string[]).includes(key);
}

/**
 * The hover facts a screen may draw for this person: the clinic's list, in its
 * order, minus the sensitive ones when the permission is missing — whatever
 * the setting says. The server withholds those values anyway; this keeps an
 * empty row off the card.
 */
export function hoverFieldsFor(
  settings: Pick<CalendarDisplaySettings, 'hoverFields'>,
  maySeeSensitive: boolean,
  catalogue: readonly HoverFieldCatalogueEntry[] = [],
): HoverFieldKey[] {
  const sensitive = new Set(
    catalogue.length > 0
      ? catalogue.filter((entry) => entry.sensitive).map((entry) => entry.key)
      : ['insurer', 'birthDate'],
  );
  return settings.hoverFields
    .filter(isHoverFieldKey)
    .filter((key) => maySeeSensitive || !sensitive.has(key));
}

export const readCalendarDisplay = async (): Promise<CalendarDisplayResponse> => {
  const { data } = await client.get<CalendarDisplayResponse>('/api/v1/settings/calendar-display');
  return data;
};

export const saveCalendarDisplay = async (
  settings: CalendarDisplaySettings,
): Promise<CalendarDisplayResponse> => {
  const { data } = await client.put<CalendarDisplayResponse>(
    '/api/v1/settings/calendar-display',
    settings,
  );
  return data;
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
