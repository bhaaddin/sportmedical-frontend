/*
 * What `ApiDataSource` reads and writes - the application's EXISTING API clients, bound once.
 *
 * The data source never imports a client itself: it receives an `ApiDeps`. Production code uses
 * `defaultApiDeps()` (the real `appointmentsApi`, `clubOrdersApi`, ... - no parallel endpoint, no
 * parallel model); the contract tests pass fakes with the same shapes, so every mapping is checked
 * against exact numbers without a server.
 *
 * Reads go through `Reader`, which uses the application's QueryClient when there is one and the
 * SAME query keys the existing screens use (`['day-range', …]`, `['blocks', …]`, `['club-orders', …]`,
 * `['grid-preview', …]`, `['holidays', year]`, …). A planner write then invalidates what the calendar
 * shows (`invalidateClubWorld`) and a calendar write is visible to the planner on its next read.
 */
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { activitiesApi } from '../../api/activities';
import { appointmentsApi, type MoveNotice } from '../../api/appointments';
import type {
  Activity,
  ActivityListResult,
  Appointment,
  Calendar,
  DayAppointment,
  PreviewDay,
  TimeBlock,
} from '../../api/bookingContracts';
import { calendarsApi } from '../../api/calendars';
import { readPublicClinic } from '../../api/clinicSettings';
import { clinicServicesApi, type ClinicService } from '../../api/clinicServices';
import { clubBlocksApi, type ClubBlockView } from '../../api/clubBlocks';
import {
  clubOrdersApi,
  type ClubOrderView,
  type OrderRange,
  type OrderUpdateInput,
  type StaffOrderInput,
} from '../../api/clubOrders';
import { clubSettingsApi, CLUB_SETTINGS_QUERY_KEY, clubsApi, type Club, type ClubSettings } from '../../api/clubs';
import {
  CALENDAR_DISPLAY_QUERY_KEY,
  readCalendarDisplay,
  type CalendarDisplayResponse,
} from '../../api/displaySettings';
import { holidaysApi, type ClinicHoliday } from '../../api/holidays';
import { workingHoursApi } from '../../api/workingHours';
import { parsePermissions, permissionsSnapshot } from '../../auth/localSession';
import { invalidateClubWorld } from '../../components/clubs/clubWorld';

/** Everything the data source needs from the application. */
export interface ApiDeps {
  calendars(): Promise<Calendar[]>;
  activities(): Promise<ActivityListResult>;
  services(): Promise<ClinicService[]>;
  /** The owner's calendar display settings (colours of holiday / lunch, hours of the grid). */
  display(): Promise<CalendarDisplayResponse>;
  clubSettings(): Promise<ClubSettings>;
  /** The clinic's own name (public settings); never throws, '' when unknown. */
  clinicName(): Promise<string>;
  range(from: string, to: string, calendarIds: string[]): Promise<DayAppointment[]>;
  blocks(calendarId: string, from: string, to: string): Promise<TimeBlock[]>;
  /** One answer per calendar: date -> the day as the server works it out. */
  previews(calendarIds: string[], from: string, to: string): Promise<Map<string, Map<string, PreviewDay>>>;
  holidays(year: number): Promise<ClinicHoliday[]>;
  clubBlocks(from: string, to: string): Promise<ClubBlockView[]>;
  appointment(calendarId: string, id: string): Promise<Appointment>;
  reschedule(
    calendarId: string,
    id: string,
    startUtc: string | Date,
    overrideReason?: string,
    options?: { notifyPatient?: boolean; ifMatch?: string | null },
  ): Promise<MoveNotice | null | void>;
  order(id: string): Promise<ClubOrderView>;
  clubOrders(clubId: string): Promise<ClubOrderView[]>;
  createStaffOrder(input: StaffOrderInput): Promise<ClubOrderView>;
  updateOrder(id: string, input: OrderUpdateInput, cancelAffectedAthletes: boolean): Promise<ClubOrderView>;
  confirmOrder(id: string, input: { calendarIds: string[]; ranges: OrderRange[] }): Promise<ClubOrderView>;
  inviteClub(input: { clubId: string; serviceId?: string; note?: string }): Promise<ClubOrderView>;
  club(id: string): Promise<Club>;
  updateClub(id: string, data: Partial<Club>): Promise<Club>;
  /** The permissions of the signed-in user (stored by the sign-in / account refresh). */
  permissions(): readonly string[];
  /** After a write: tell every screen that shows the calendar / the club world. */
  invalidate(): Promise<void>;
}

/** How long a shared read counts as fresh. Writes invalidate explicitly. */
export const READ_STALE_MS = 10_000;

/** A read that uses the application's cache (same key, same shape as the screens) or just calls through. */
export type Reader = <T>(key: QueryKey, run: () => Promise<T>, staleMs?: number) => Promise<T>;

/**
 * With the application's QueryClient the reads share its cache (and its keys) with the calendar. Without one (a
 * standalone source, tests) a small per-source cache does the same job: the API allows 100 calls a minute per
 * session and queues the rest, so a planner that re-reads the catalogue, the hours and the calendars on every
 * drag would stall itself. `clear` forgets what was read (after a write).
 */
export function makeReader(queryClient?: QueryClient | null): { read: Reader; clear: () => void } {
  if (queryClient) {
    return {
      read: (key, run, staleMs = READ_STALE_MS) => queryClient.fetchQuery({ queryKey: key, queryFn: run, staleTime: staleMs, retry: false }),
      clear: () => undefined,
    };
  }
  const memo = new Map<string, { at: number; value: Promise<unknown> }>();
  return {
    read: <T>(key: QueryKey, run: () => Promise<T>, staleMs = READ_STALE_MS): Promise<T> => {
      const k = JSON.stringify(key);
      const hit = memo.get(k);
      if (hit && staleMs > 0 && Date.now() - hit.at < staleMs) return hit.value as Promise<T>;
      const value = run();
      memo.set(k, { at: Date.now(), value });
      value.catch(() => {
        if (memo.get(k)?.value === value) memo.delete(k);
      });
      return value;
    },
    clear: () => memo.clear(),
  };
}

const FIVE_MIN = 5 * 60 * 1000;

/** The real clients, behind the shared query keys. */
export function defaultApiDeps(queryClient?: QueryClient | null): ApiDeps {
  const { read, clear } = makeReader(queryClient);
  return {
    calendars: () => read(['calendars'], calendarsApi.list, FIVE_MIN),
    activities: () => read(['activities'], () => activitiesApi.list(), FIVE_MIN),
    services: () => read(['clinic-services'], clinicServicesApi.list, FIVE_MIN),
    display: () => read(CALENDAR_DISPLAY_QUERY_KEY, readCalendarDisplay, FIVE_MIN),
    clubSettings: () => read(CLUB_SETTINGS_QUERY_KEY, clubSettingsApi.get, FIVE_MIN),
    clinicName: async () => (await read(['public-clinic'], readPublicClinic, FIVE_MIN)).name ?? '',
    range: (from, to, ids) => read(['day-range', from, to, ids.join(',')], () => appointmentsApi.range(from, to, ids)),
    blocks: (calendarId, from, to) => read(['blocks', calendarId, from, to], () => appointmentsApi.blocks(calendarId, from, to)),
    previews: (ids, from, to) =>
      read(['grid-preview', from, to, ids.join(',')], async () => {
        const perCalendar = await Promise.all(
          ids.map(async (id) => {
            const rows = await workingHoursApi.preview(id, from, to);
            return [id, new Map(rows.map((row) => [row.date, row]))] as const;
          }),
        );
        return new Map<string, Map<string, PreviewDay>>(perCalendar);
      }),
    holidays: (year) => read(['holidays', year], () => holidaysApi.year(year), 10 * 60 * 1000),
    clubBlocks: (from, to) => read(['club-blocks', 'details', from, to], () => clubBlocksApi.list({ from, to }), 30_000),
    appointment: (calendarId, id) => appointmentsApi.get(calendarId, id),
    reschedule: (calendarId, id, startUtc, overrideReason, options) =>
      appointmentsApi.reschedule(calendarId, id, startUtc, overrideReason, options),
    order: (id) => read(['club-order', id], () => clubOrdersApi.get(id), 0),
    clubOrders: (clubId) => read(['club-orders', 'pick-duplicate', clubId], () => clubOrdersApi.list({ clubId }), 0),
    createStaffOrder: (input) => clubOrdersApi.createStaff(input),
    updateOrder: (id, input, cancelAffectedAthletes) => clubOrdersApi.update(id, input, cancelAffectedAthletes),
    confirmOrder: (id, input) => clubOrdersApi.confirm(id, input),
    inviteClub: (input) => clubOrdersApi.invite(input),
    club: (id) => read(['club', id], () => clubsApi.getById(id), 0),
    updateClub: (id, data) => clubsApi.update(id, data),
    permissions: () => parsePermissions(permissionsSnapshot()),
    invalidate: async () => {
      clear();
      if (queryClient) await invalidateClubWorld(queryClient);
    },
  };
}

export type { Activity };
