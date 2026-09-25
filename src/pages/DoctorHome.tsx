/* ══════════════════════════════════════════════════════════════
   THE DOCTOR'S WORKSPACE — what `/` is for somebody who treats patients

   Today, and only today: the calendars this account may see, drawn as the
   day grid, and "Dnes čeká" - how many are still to come and who they are,
   by činnost - with the one-click confirmations on each row. Nothing else:
   no tiles, no administration, no settings. An account whose role is not
   Owner or Administrator lands here by default; anybody can choose it in
   Můj účet ("Lékařské rozhraní").

   Every number is the server's. The rows are `GET /api/day` for today and
   the calendars the user may see; the tallies are `GET /api/day/summary`
   over the same calendars, so the count and the list never disagree.
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Chip, Divider, Paper, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { activitiesApi } from '../api/activities';
import { appointmentsApi } from '../api/appointments';
import { calendarsApi } from '../api/calendars';
import { holidaysApi } from '../api/holidays';
import { patientsApi } from '../api/patients';
import { workingHoursApi } from '../api/workingHours';
import { useCalendarDisplay } from '../api/displaySettings';
import type { DayAppointment, PreviewDay, TimeBlock } from '../api/bookingContracts';
import { isLateStatus, statusName, statusTally } from '../api/bookingContracts';
import { usePermission } from '../auth/usePermission';
import { AsyncSection } from '../components/booking/AsyncSection';
import { AppointmentDetail } from '../components/booking/AppointmentDetail';
import { NewAppointmentDialog } from '../components/booking/NewAppointmentDialog';
import { SmartConfirmations } from '../components/booking/SmartConfirmations';
import { TimeGrid, type GridBookingRequest } from '../components/booking/grid/TimeGrid';
import { dayMark, type DayMark } from '../components/booking/grid/dayMarks';
import { parseTimeOfDay, spanOnDay, touchesDay, visibleHours, type MinuteRange } from '../components/booking/grid/timeRange';
import { dayOfWeekOf, formatDateOnly, formatPragueTime, pragueDateKey } from '../utils/time';

export const DOCTOR_TEXT = {
  title: 'Dnes',
  waiting: 'Dnes čeká',
  waitingHelp: 'Objednaní, kteří ještě nepřišli a jejichž termín dnes nebyl zrušen ani dokončen. Klikněte Přišel, jakmile jsou tady.',
  nobodyWaiting: 'Dnes už nikdo nečeká.',
  byActivity: 'Podle činnosti',
  arrivedToday: 'Přišlo',
  doneToday: 'Hotovo',
  noCalendars: 'Nemáte přístup k žádnému kalendáři. Přístup nastavuje správce v Nastavení → Kalendáře.',
  calendar: 'Kalendář',
  loadingName: 'načítá se…',
  previewFailed: 'Pracovní dobu se nepodařilo načíst, mřížka je bez ní.',
} as const;

const OPEN_MARK: DayMark = { redNumber: false, closed: false, label: null, detail: null };

function dataOfEach(results: { data?: TimeBlock[] }[]): (TimeBlock[] | undefined)[] {
  return results.map((r) => r.data);
}

export default function DoctorHome() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const mayBook = usePermission('bookings.create');
  const mayBlock = usePermission('bookings.edit');

  const [now, setNow] = useState(() => new Date());
  const [openId, setOpenId] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ key: number; prefill: Partial<GridBookingRequest> } | null>(null);

  /* The clock moves, so "asi nepřišel" and the now-line move with it. */
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const today = pragueDateKey(now);

  const calendarsQuery = useQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list, staleTime: 5 * 60 * 1000 });
  const calendars = useMemo(() => (calendarsQuery.data ?? []).filter((c) => c.isActive), [calendarsQuery.data]);
  const ids = useMemo(() => calendars.map((c) => c.id), [calendars]);
  const calendarById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);

  const dayQuery = useQuery({
    queryKey: ['day-range', today, today, ids.join(',')],
    queryFn: () => appointmentsApi.range(today, today, ids),
    enabled: ids.length > 0,
    refetchInterval: 60_000,
  });
  const summaryQuery = useQuery({
    queryKey: ['day-summary', today, ids.join(',')],
    queryFn: () => appointmentsApi.daySummary(today, ids),
    enabled: ids.length > 0,
    refetchInterval: 60_000,
  });

  const activitiesQuery = useQuery({ queryKey: ['activities'], queryFn: activitiesApi.list, staleTime: 5 * 60 * 1000 });
  const activityById = useMemo(
    () => new Map((activitiesQuery.data?.activities ?? []).map((a) => [a.id, a])),
    [activitiesQuery.data],
  );

  const previewQuery = useQuery({
    queryKey: ['grid-preview', today, today, ids.join(',')],
    queryFn: async () => {
      const perCalendar = await Promise.all(
        calendars.map(async (calendar) => {
          const rows = await workingHoursApi.preview(calendar.id, today, today);
          return [calendar.id, new Map(rows.map((row) => [row.date, row]))] as const;
        }),
      );
      return new Map<string, Map<string, PreviewDay>>(perCalendar);
    },
    enabled: ids.length > 0,
  });
  const previewByCalendar = useMemo(
    () => previewQuery.data ?? new Map<string, Map<string, PreviewDay>>(),
    [previewQuery.data],
  );

  const blockLists = useQueries({
    queries: calendars.map((calendar) => ({
      queryKey: ['blocks', calendar.id, today, today],
      queryFn: () => appointmentsApi.blocks(calendar.id, today, today),
      enabled: !isPhone,
    })),
    combine: dataOfEach,
  });
  const blocksByCalendar = useMemo(() => {
    const map = new Map<string, TimeBlock[]>();
    calendars.forEach((calendar, i) => map.set(calendar.id, blockLists[i] ?? []));
    return map;
  }, [calendars, blockLists]);

  const holidaysQuery = useQuery({
    queryKey: ['holidays', Number(today.slice(0, 4))],
    queryFn: () => holidaysApi.year(Number(today.slice(0, 4))),
    staleTime: 10 * 60 * 1000,
  });
  const marks = useMemo(() => {
    const holiday = (holidaysQuery.data ?? []).find((h) => h.date === today);
    const rows = calendars
      .map((c) => previewByCalendar.get(c.id)?.get(today))
      .filter((row): row is PreviewDay => row !== undefined);
    return new Map<string, DayMark>([[today, rows.length === 0 && !holiday ? OPEN_MARK : dayMark(holiday, rows)]]);
  }, [holidaysQuery.data, calendars, previewByCalendar, today]);

  const { settings: display } = useCalendarDisplay();

  const rows = useMemo(
    () =>
      [...(dayQuery.data ?? [])]
        .filter((a) => a.calendarId !== null && calendarById.has(a.calendarId))
        .sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime()),
    [dayQuery.data, calendarById],
  );
  const byDay = useMemo(() => new Map<string, DayAppointment[]>([[today, rows]]), [rows, today]);

  const openSpan = useMemo(() => {
    const working: MinuteRange[] = [];
    const items: MinuteRange[] = [];
    for (const calendar of calendars) {
      const row = previewByCalendar.get(calendar.id)?.get(today);
      if (!row) continue;
      const start = parseTimeOfDay(row.startTime);
      const end = parseTimeOfDay(row.endTime);
      if (row.isOpen && start !== null && end !== null) working.push({ start, end });
    }
    for (const a of rows) items.push(spanOnDay(a.startUtc, a.endUtc, today));
    for (const blocks of blocksByCalendar.values()) {
      for (const b of blocks) {
        if (touchesDay(b.startUtc, b.endUtc, today)) items.push(spanOnDay(b.startUtc, b.endUtc, today));
      }
    }
    const span = visibleHours(working, items);
    /* The clinic's day (Nastavení → Vzhled kalendáře) widened to what is on it, never narrowed. */
    return { start: Math.min(span.start, display.dayStartHour), end: Math.max(span.end, display.dayEndHour) };
  }, [calendars, previewByCalendar, rows, blocksByCalendar, today, display.dayStartHour, display.dayEndHour]);

  /* "Dnes čeká": still expected, in the order they are due. */
  const waiting = useMemo(() => rows.filter((a) => isLateStatus(a.status)), [rows]);
  const waitingByActivity = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of waiting) counts.set(a.activityName, (counts.get(a.activityName) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [waiting]);

  const patientQueries = useQueries({
    queries: [...new Set(rows.map((a) => a.patientId))].map((id) => ({
      queryKey: ['patient', id],
      queryFn: () => patientsApi.getById(id),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const patientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of patientQueries) {
      if (q.data) map.set(q.data.id, q.data.fullName ?? `${q.data.lastName} ${q.data.firstName}`);
    }
    return map;
  }, [patientQueries]);

  const summary = summaryQuery.data;
  const openAppointment = openId === null ? null : (rows.find((a) => a.id === openId) ?? null);
  const reload = () => {
    void dayQuery.refetch();
    void summaryQuery.refetch();
  };

  return (
    <Box sx={{ maxWidth: 1680, mx: 'auto' }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {DOCTOR_TEXT.title}
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            {t(`booking.workingHours.weekday.${dayOfWeekOf(today)}`)} {formatDateOnly(today)}
            {marks.get(today)?.label ? ` · ${marks.get(today)?.label}` : ''}
          </Typography>
        </Box>
        {summary ? (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Chip label={`${DOCTOR_TEXT.waiting}: ${waiting.length}`} color="primary" />
            <Chip label={`${DOCTOR_TEXT.arrivedToday}: ${summary.arrived}`} variant="outlined" />
            <Chip label={`${t('booking.day.didNotCome')}: ${summary.didNotCome}`} variant="outlined" />
          </Stack>
        ) : null}
      </Stack>

      <AsyncSection
        isLoading={calendarsQuery.isLoading}
        isSettled={calendarsQuery.isSuccess || calendarsQuery.isError}
        error={calendarsQuery.error}
        isEmpty={calendars.length === 0}
        emptyText={DOCTOR_TEXT.noCalendars}
        onRetry={() => void calendarsQuery.refetch()}
        skeletonRows={3}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 380px' }, gap: 3, alignItems: 'start' }}>
          {/* ── The day, as the grid draws it ── */}
          <Box sx={{ minWidth: 0 }}>
            {previewQuery.error ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {DOCTOR_TEXT.previewFailed}
              </Alert>
            ) : null}
            <AsyncSection
              isLoading={dayQuery.isLoading}
              isSettled={dayQuery.isSuccess || dayQuery.isError}
              error={dayQuery.error}
              isEmpty={false}
              emptyText=""
              onRetry={reload}
              skeletonRows={6}
            >
              {isPhone ? (
                <Stack spacing={0.5}>
                  {rows.length === 0 ? (
                    <Typography sx={{ color: 'text.secondary' }}>{t('booking.grid.emptyDay')}</Typography>
                  ) : (
                    rows.map((a) => (
                      <Paper key={a.id} variant="outlined" sx={{ p: 1 }} onClick={() => setOpenId(a.id)}>
                        <Typography sx={{ fontWeight: 700 }}>
                          {formatPragueTime(a.startUtc)} · {patientNameById.get(a.patientId) ?? DOCTOR_TEXT.loadingName}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {a.activityName} · {statusName(a.status) ? t(`booking.status.${statusName(a.status)}`) : t('booking.status.unknown')}
                        </Typography>
                      </Paper>
                    ))
                  )}
                </Stack>
              ) : (
                <TimeGrid
                  days={[today]}
                  view="day"
                  selectedDay={today}
                  calendars={calendars}
                  appointmentsByDay={byDay}
                  previewByCalendar={previewByCalendar}
                  blocksByCalendar={blocksByCalendar}
                  marks={marks}
                  openSpan={openSpan}
                  now={now}
                  employeeId={null}
                  nowLineColor={display.nowLineColor}
                  mayBook={mayBook}
                  mayBlock={mayBlock}
                  onOpen={setOpenId}
                  onBook={(request) => setBooking((c) => ({ key: (c?.key ?? 0) + 1, prefill: request }))}
                  onPickDay={() => undefined}
                />
              )}
            </AsyncSection>
          </Box>

          {/* ── Dnes čeká ── */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {DOCTOR_TEXT.waiting}
              <Box component="span" sx={{ ml: 1, color: 'primary.main' }}>
                {waiting.length}
              </Box>
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
              {DOCTOR_TEXT.waitingHelp}
            </Typography>

            {waitingByActivity.length > 0 ? (
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }} aria-label={DOCTOR_TEXT.byActivity}>
                {waitingByActivity.map(([name, count]) => (
                  <Chip key={name} size="small" variant="outlined" label={`${name}: ${count}`} />
                ))}
              </Stack>
            ) : null}

            <AsyncSection
              isLoading={dayQuery.isLoading}
              isSettled={dayQuery.isSuccess || dayQuery.isError}
              error={dayQuery.error}
              isEmpty={waiting.length === 0}
              emptyText={DOCTOR_TEXT.nobodyWaiting}
              onRetry={reload}
              skeletonRows={3}
            >
              <Stack divider={<Divider />} spacing={1}>
                {waiting.map((a) => {
                  const calendar = a.calendarId ? calendarById.get(a.calendarId) : undefined;
                  return (
                    <Box key={a.id} sx={{ py: 0.5 }} data-testid={`waiting-${a.id}`}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 700, minWidth: 48 }}>{formatPragueTime(a.startUtc)}</Typography>
                        <Typography
                          component="button"
                          onClick={() => setOpenId(a.id)}
                          sx={{ background: 'none', border: 0, p: 0, cursor: 'pointer', color: 'primary.main', fontWeight: 600, font: 'inherit' }}
                        >
                          {patientNameById.get(a.patientId) ?? DOCTOR_TEXT.loadingName}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {a.activityName}
                          {calendar ? ` · ${calendar.name}` : ''}
                        </Typography>
                        {statusTally(a.status) === 'booked' && a.status === 1 ? (
                          <Chip size="small" variant="outlined" label={t('booking.status.Confirmed')} />
                        ) : null}
                      </Stack>
                      <Box sx={{ mt: 0.5 }}>
                        <SmartConfirmations
                          booking={{ id: a.id, calendarId: a.calendarId, patientId: a.patientId, activityId: a.activityId, startUtc: a.startUtc, status: a.status }}
                          activity={activityById.get(a.activityId) ?? null}
                          now={now}
                          onChanged={reload}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </AsyncSection>

            {/* Arrived today, so "Zaplaceno" is one click from here too. */}
            {rows.some((a) => a.status === 2) ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {DOCTOR_TEXT.arrivedToday}
                </Typography>
                <Stack divider={<Divider />} spacing={1}>
                  {rows
                    .filter((a) => a.status === 2)
                    .map((a) => (
                      <Box key={a.id} sx={{ py: 0.5 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <Typography sx={{ fontWeight: 700, minWidth: 48 }}>{formatPragueTime(a.startUtc)}</Typography>
                          <Typography sx={{ fontWeight: 600 }}>{patientNameById.get(a.patientId) ?? DOCTOR_TEXT.loadingName}</Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {a.activityName}
                            {a.checkedInUtc ? ` · ${t('booking.detail.checkedInAt')} ${formatPragueTime(a.checkedInUtc)}` : ''}
                          </Typography>
                        </Stack>
                        <Box sx={{ mt: 0.5 }}>
                          <SmartConfirmations
                            booking={{ id: a.id, calendarId: a.calendarId, patientId: a.patientId, activityId: a.activityId, startUtc: a.startUtc, status: a.status }}
                            activity={activityById.get(a.activityId) ?? null}
                            now={now}
                            onChanged={reload}
                          />
                        </Box>
                      </Box>
                    ))}
                </Stack>
              </Box>
            ) : null}
          </Paper>
        </Box>
      </AsyncSection>

      {booking && mayBook ? (
        <NewAppointmentDialog
          key={booking.key}
          open
          onClose={() => setBooking(null)}
          onBooked={reload}
          initialDate={booking.prefill.dayKey ?? today}
          initialCalendarId={booking.prefill.calendarId}
          initialStart={booking.prefill.start}
          initialEnd={booking.prefill.end}
        />
      ) : null}

      {openAppointment?.calendarId ? (
        <AppointmentDetail
          appointmentId={openAppointment.id}
          calendarId={openAppointment.calendarId}
          calendar={calendarById.get(openAppointment.calendarId)}
          open
          onClose={() => setOpenId(null)}
          onChanged={reload}
        />
      ) : null}
    </Box>
  );
}
