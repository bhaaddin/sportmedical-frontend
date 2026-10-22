/*
 * The clinic's REAL calendar as the board needs it: bookings, blocks (club windows and manual),
 * the calendars with their filters and the rota. It is the data side of the old calendar page
 * (`CalendarGridPage`, since replaced by the planner), lifted into one hook - same endpoints, same react-query keys (so the two share the cache), same
 * filter rules - and nothing about drawing.
 *
 * Only the real route uses it (`RealBoard` in `WeekBoardPanel`); the lab and the tests that run on
 * `DemoDataSource` never call it, so they never touch the API.
 *
 * Rules kept from the old page (they were the calendar's agreed behaviour):
 *   - one request for the whole visible window and every calendar; the ticks, the legend and the
 *     worker narrow it on this side;
 *   - a calendar stays when it is ticked and its služba is shown - through the service it runs or
 *     through a činnost it offers in the period;
 *   - the worker filter keeps a booking only on a day of its calendar that the rota gives him;
 *   - the grid never asks for availability (6.1): hours and blocks are drawn, the booking dialog asks.
 */
import { useEffect, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '../../../api/appointments';
import { calendarsApi } from '../../../api/calendars';
import { clinicServicesApi } from '../../../api/clinicServices';
import { workingHoursApi } from '../../../api/workingHours';
import { useCalendarDisplay, type CalendarDisplaySettings } from '../../../api/displaySettings';
import type { Calendar, DayAppointment, PreviewDay, TimeBlock } from '../../../api/bookingContracts';
import { usePermission } from '../../../auth/usePermission';
import { dayBelongsTo, employeesIn, visibleCalendars } from '../../../components/booking/grid/filters';
import {
  EMPTY_CATALOGUE,
  cleanHex,
  passesService,
  serviceIdOfAppointment,
  type Catalogue,
} from '../../../components/booking/calendar/model';
import { useCalendarCatalogue } from '../../../components/booking/calendar/useCalendarCatalogue';
import { pragueDateKey } from '../../../utils/time';
import { boardSettings, useBoardSettings, type FacetCalendar, type FacetEmployee, type FacetService } from './boardSettings';
import { aliasMap, serviceGroups, type GroupActivity } from './serviceGroups';

export interface BoardCalendarData {
  /** Calendars and bookings have been read at least once. */
  ready: boolean;
  /** The first failure of a required read (calendars, bookings), if any. */
  error: unknown;
  /** Every active calendar. */
  allCalendars: Calendar[];
  /** The calendars the filters leave on screen. */
  calendars: Calendar[];
  /**
   * R2: every calendar id -> the primary calendar of its služba (the column it is drawn in). A služba with several calendars is one
   * column; the others ride in the primary's column and are never columns of their own.
   */
  alias: ReadonlyMap<string, string>;
  /** The služba groups of the clinic, in order. */
  groups: ReturnType<typeof serviceGroups>;
  calendarById: ReadonlyMap<string, Calendar>;
  /** The bookings the filters leave on screen, any day of the window. */
  appointments: DayAppointment[];
  blocksByCalendar: ReadonlyMap<string, TimeBlock[]>;
  previewByCalendar: ReadonlyMap<string, ReadonlyMap<string, PreviewDay>>;
  catalogue: Catalogue;
  display: CalendarDisplaySettings;
  mayBook: boolean;
  mayBlock: boolean;
  employeeId: string | null;
  refetch: () => void;
}

const dataOfEach = (results: { data?: TimeBlock[] }[]): (TimeBlock[] | undefined)[] => results.map((r) => r.data);

export function useBoardCalendar(days: readonly string[]): BoardCalendarData {
  const settings = useBoardSettings();
  const mayBook = usePermission('bookings.create');
  const mayBlock = usePermission('bookings.edit');
  const from = days[0] ?? '';
  const to = days[days.length - 1] ?? '';

  const calendarsQuery = useQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list, staleTime: 5 * 60 * 1000 });
  const calendars = useMemo(() => (calendarsQuery.data ?? []).filter((c) => c.isActive), [calendarsQuery.data]);
  const allIds = useMemo(() => calendars.map((c) => c.id), [calendars]);

  const servicesQuery = useQuery({ queryKey: ['clinic-services'], queryFn: clinicServicesApi.list, staleTime: 5 * 60 * 1000 });
  const { catalogue } = useCalendarCatalogue(servicesQuery.data);
  const services = useMemo(
    () => (servicesQuery.data ?? []).filter((s) => s.isActive && calendars.some((c) => c.clinicServiceId === s.id)),
    [servicesQuery.data, calendars],
  );

  const appointmentsQuery = useQuery({
    queryKey: ['day-range', from, to, allIds.join(',')],
    queryFn: () => appointmentsApi.range(from, to, allIds),
    enabled: allIds.length > 0 && from !== '',
    placeholderData: (previous) => previous,
    refetchInterval: 60_000,
  });

  const previewQuery = useQuery({
    queryKey: ['grid-preview', from, to, allIds.join(',')],
    queryFn: async () => {
      const perCalendar = await Promise.all(
        calendars.map(async (calendar) => {
          const rows = await workingHoursApi.preview(calendar.id, from, to);
          return [calendar.id, new Map(rows.map((row) => [row.date, row]))] as const;
        }),
      );
      return new Map<string, Map<string, PreviewDay>>(perCalendar);
    },
    enabled: allIds.length > 0 && from !== '',
    placeholderData: (previous) => previous,
  });
  const previewByCalendar = useMemo(
    () => previewQuery.data ?? new Map<string, Map<string, PreviewDay>>(),
    [previewQuery.data],
  );

  const groups = useMemo(
    () =>
      serviceGroups(
        calendars,
        (servicesQuery.data ?? []).filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.name, colorHex: catalogue.services.get(s.id)?.colorHex ?? s.colorHex ?? null })),
        (serviceId): GroupActivity[] =>
          [...catalogue.activities.values()]
            .filter((a) => a.serviceId === serviceId && a.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs'))
            .map((a) => ({ id: a.id, name: a.name, colour: a.colorHex ?? cleanHex(catalogue.services.get(serviceId)?.colorHex) ?? '#6e91a5' })),
      ),
    [calendars, servicesQuery.data, catalogue],
  );

  const ticksApply = useMemo(() => visibleCalendars(calendars, settings.ticked, null), [calendars, settings.ticked]);
  const serviceSet = settings.serviceSet;
  const shownBase = useMemo(
    () =>
      ticksApply.filter((calendar) => {
        if (serviceSet === null) return true;
        if (calendar.clinicServiceId !== null && serviceSet.has(calendar.clinicServiceId)) return true;
        for (const day of days) {
          for (const id of previewByCalendar.get(calendar.id)?.get(day)?.offeredActivityIds ?? []) {
            const serviceId = catalogue.activities.get(id)?.serviceId;
            if (serviceId && serviceSet.has(serviceId)) return true;
          }
        }
        return false;
      }),
    [ticksApply, serviceSet, days, previewByCalendar, catalogue],
  );
  const shown = shownBase;
  /* R2: a služba is ONE column - the calendars of it that are on screen ride in the first one's column (the gear may still hide a single calendar). */
  const alias = useMemo(() => {
    const onScreen = new Set(shown.map((c) => c.id));
    return aliasMap(
      groups
        .map((g) => ({ calendarIds: g.calendarIds.filter((id) => onScreen.has(id)), primaryId: '' }))
        .filter((g) => g.calendarIds.length > 0)
        .map((g) => ({ ...g, primaryId: g.calendarIds[0]! })),
    );
  }, [groups, shown]);

  const blockLists = useQueries({
    queries: shown.map((calendar) => ({
      queryKey: ['blocks', calendar.id, from, to],
      queryFn: () => appointmentsApi.blocks(calendar.id, from, to),
      enabled: from !== '',
      placeholderData: (previous: TimeBlock[] | undefined) => previous,
    })),
    combine: dataOfEach,
  });
  const blocksByCalendar = useMemo(() => {
    const map = new Map<string, TimeBlock[]>();
    shown.forEach((calendar, i) => map.set(calendar.id, blockLists[i] ?? []));
    return map;
  }, [shown, blockLists]);

  const { settings: display } = useCalendarDisplay();

  const calendarById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);
  const shownIds = useMemo(() => new Set(shown.map((c) => c.id)), [shown]);
  const employeeId = settings.employeeId;

  const appointments = useMemo(() => {
    const out: DayAppointment[] = [];
    for (const appointment of appointmentsQuery.data ?? []) {
      if (!appointment.calendarId || !shownIds.has(appointment.calendarId)) continue;
      const serviceId = serviceIdOfAppointment(appointment, calendarById.get(appointment.calendarId), catalogue);
      if (!passesService(serviceId, serviceSet)) continue;
      const row = previewByCalendar.get(appointment.calendarId)?.get(pragueDateKey(appointment.startUtc));
      if (!dayBelongsTo(row, employeeId)) continue;
      out.push(appointment);
    }
    return out;
  }, [appointmentsQuery.data, shownIds, calendarById, catalogue, serviceSet, previewByCalendar, employeeId]);

  /* The workers follow the služba, not the ticked calendars (as the page does). */

  const facets = useMemo(() => {
    const serviceCalendars = calendars.filter(
      (c) => serviceSet === null || (c.clinicServiceId !== null && serviceSet.has(c.clinicServiceId)),
    );
    const rows: PreviewDay[] = [];
    for (const calendar of serviceCalendars) rows.push(...(previewByCalendar.get(calendar.id)?.values() ?? []));
    const found = employeesIn(rows);
    const employees: FacetEmployee[] = employeeId && !found.some((e) => e.id === employeeId)
      ? [...found, { id: employeeId, name: employeeId }]
      : found;
    const calendarFacets: FacetCalendar[] = serviceCalendars.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      serviceId: c.clinicServiceId,
    }));
    const serviceFacets: FacetService[] = services.map((s) => ({
      id: s.id,
      name: s.name,
      color: catalogue.services.get(s.id)?.colorHex ?? cleanHex(calendars.find((c) => c.clinicServiceId === s.id)?.color) ?? '#6e91a5',
    }));
    return { calendars: calendarFacets, groups, employees, services: serviceFacets };
  }, [calendars, serviceSet, previewByCalendar, employeeId, services, catalogue, groups]);

  useEffect(() => {
    boardSettings.publishFacets(facets);
  }, [facets]);

  const error = calendarsQuery.error ?? appointmentsQuery.error ?? appointmentsQuery.failureReason ?? null;
  return {
    ready: calendarsQuery.isSuccess && (allIds.length === 0 || appointmentsQuery.data !== undefined),
    error,
    allCalendars: calendars,
    calendars: shown,
    alias,
    groups,
    calendarById,
    appointments,
    blocksByCalendar,
    previewByCalendar,
    catalogue: catalogue ?? EMPTY_CATALOGUE,
    display,
    mayBook,
    mayBlock,
    employeeId,
    refetch: () => {
      void appointmentsQuery.refetch();
      void previewQuery.refetch();
    },
  };
}
