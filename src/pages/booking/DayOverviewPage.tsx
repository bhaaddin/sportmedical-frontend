import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { appointmentsApi } from "../../api/appointments";
import { calendarsApi } from "../../api/calendars";
import { patientsApi } from "../../api/patients";
import { BookingApiError } from "../../api/apiError";
import { isLateStatus } from "../../api/bookingContracts";
import type { DayAppointment } from "../../api/bookingContracts";
import {
  addDaysToDateOnly,
  dayOfWeekOf,
  formatDateOnly,
  formatPragueTime,
  isLate,
  toDateOnly,
} from "../../utils/time";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { errorText } from "../../components/booking/errorText";

/**
 * The day at a glance — contract 5.12, laid out as `booking.md` part 3.
 *
 * Two decisions worth stating, because both look like omissions:
 *
 *   - **No `PODKLADY ✓ / ⚠` line.** 4.6 says it is not in this summary and asks
 *     in as many words not to make room for it: until the `app` lane finishes
 *     three document templates it would report a missing consent to somebody who
 *     had just signed one.
 *   - **"Free today" is minutes, not places.** The plan drew "4 places"; the
 *     owner settled on minutes on 9. 9. 2026, because the same ninety minutes is
 *     two slots or three depending on the activity. Nothing here divides it.
 *
 * Where the numbers come from is also deliberate. Four of the five tallies are
 * the server's, from `/api/day/summary`. *Late* is not: 6.2 makes it a fact
 * about the clock rather than a stored state, so it is counted here from the
 * day's rows and re-counted every minute. The server's `runningLate` is a
 * snapshot that would be wrong sixty seconds later — and would disagree with
 * the list printed right underneath it, which is worse than being absent.
 */

const CHECKED_IN = 2;

export default function DayOverviewPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [date, setDate] = useState<string>(toDateOnly(new Date()));
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [now, setNow] = useState(() => new Date());

  /* 6.2: the clock moves, so the count moves with it. */
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const calendars = useMemo(
    () => (calendarsQuery.data ?? []).filter((c) => c.isActive),
    [calendarsQuery.data],
  );

  const shownIds = useMemo(
    () =>
      calendars.filter((c) => selected === null || selected.has(c.id)).map((c) => c.id),
    [calendars, selected],
  );

  /*
   * Both requests get the same calendars. Different sets would put the summary
   * and the list of late patients out of step, and the screen would be arguing
   * with itself in front of the person reading it.
   */
  const summaryQuery = useQuery({
    queryKey: ["day-summary", date, shownIds.join(",")],
    queryFn: () => appointmentsApi.daySummary(date, shownIds),
    enabled: shownIds.length > 0,
  });

  const dayQuery = useQuery({
    queryKey: ["day-range", date, date, shownIds.join(",")],
    queryFn: () => appointmentsApi.range(date, date, shownIds),
    enabled: shownIds.length > 0,
  });

  const calendarById = useMemo(
    () => new Map(calendars.map((c) => [c.id, c])),
    [calendars],
  );

  const lateRows = useMemo(
    () =>
      (dayQuery.data ?? [])
        .filter((a) => isLate(a.startUtc, isLateStatus(a.status), now))
        .sort(
          (a, b) =>
            new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime(),
        ),
    [dayQuery.data, now],
  );

  /*
   * The day row carries `patientId` and no name (4.5), and a row that says
   * "9:00 · Základní prohlídka · [přišel]" is not something anybody can act on
   * at a desk. So the names are fetched — but only for the people who are
   * actually late, which is a handful, not for the whole day.
   */
  const patientQueries = useQueries({
    queries: [...new Set(lateRows.map((a) => a.patientId))].map((id) => ({
      queryKey: ["patient", id],
      queryFn: () => patientsApi.getById(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const patientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of patientQueries) {
      if (q.data) {
        map.set(
          q.data.id,
          q.data.fullName ?? `${q.data.lastName} ${q.data.firstName}`,
        );
      }
    }
    return map;
  }, [patientQueries]);

  const arrive = useMutation({
    mutationFn: (appointment: DayAppointment) =>
      appointmentsApi.setStatus(
        appointment.calendarId as string,
        appointment.id,
        String(CHECKED_IN),
      ),
    onSuccess: () => {
      /* "Po kliknutí prišiel sa Prišlo aj Mešká zmenia okamžite." */
      void queryClient.invalidateQueries({ queryKey: ["day-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["day-range"] });
    },
  });

  const summary = summaryQuery.data;
  const utilisation =
    summary && summary.workingMinutes > 0
      ? Math.round((summary.bookedMinutes / summary.workingMinutes) * 100)
      : null;

  const stepBy = (days: number) => setDate((d) => addDaysToDateOnly(d, days));

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t("booking.day.title")}
          </Typography>
          <Typography sx={{ color: "text.secondary" }}>
            {t(`booking.workingHours.weekday.${dayOfWeekOf(date)}`)}{" "}
            {formatDateOnly(date)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => stepBy(-1)}
            aria-label={t("booking.day.previous")}
          >
            <ChevronLeftIcon fontSize="small" />
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setDate(toDateOnly(new Date()))}
          >
            {t("booking.day.today")}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => stepBy(1)}
            aria-label={t("booking.day.nextDay")}
          >
            <ChevronRightIcon fontSize="small" />
          </Button>
        </Stack>
      </Stack>

      <AsyncSection
        isLoading={calendarsQuery.isLoading}
        isSettled={calendarsQuery.isSuccess}
        error={calendarsQuery.error}
        isEmpty={calendars.length === 0}
        emptyText={t("booking.grid.noCalendars")}
        onRetry={() => void calendarsQuery.refetch()}
        skeletonRows={3}
      >
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}>
          {calendars.map((calendar) => {
            const on = selected === null || selected.has(calendar.id);
            return (
              <Chip
                key={calendar.id}
                label={calendar.name}
                variant={on ? "filled" : "outlined"}
                onClick={() => {
                  const next = new Set(selected ?? calendars.map((c) => c.id));
                  if (next.has(calendar.id)) next.delete(calendar.id);
                  else next.add(calendar.id);
                  setSelected(next);
                }}
                sx={{
                  backgroundColor: on ? calendar.color : undefined,
                  color: on ? "#fff" : undefined,
                }}
              />
            );
          })}
        </Stack>

        <AsyncSection
          isLoading={summaryQuery.isLoading}
          isSettled={summaryQuery.isSuccess || summaryQuery.isError}
          error={summaryQuery.error}
          isEmpty={shownIds.length === 0}
          emptyText={t("booking.day.noCalendarChosen")}
          onRetry={() => void summaryQuery.refetch()}
          skeletonRows={5}
        >
          {summary ? (
            <Stack spacing={3}>
              {/* ── The five tallies ── */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 3 }}>
                  <Tally
                    label={t("booking.day.booked")}
                    value={summary.booked}
                  />
                  <Tally
                    label={t("booking.day.arrived")}
                    value={summary.arrived}
                  />
                  <Tally
                    label={t("booking.status.late")}
                    value={lateRows.length}
                    note={t("booking.day.lateIsDisplayOnly")}
                  />
                  <Tally
                    label={t("booking.day.didNotCome")}
                    value={summary.didNotCome}
                  />
                  <Tally
                    label={t("booking.day.cancelled")}
                    value={summary.cancelled}
                  />
                </Stack>
              </Paper>

              {/* ── By activity and by calendar ── */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ alignItems: "stretch" }}
              >
                <Breakdown
                  title={t("booking.day.byActivity")}
                  rows={summary.byActivity}
                  emptyText={t("booking.day.nothingBooked")}
                />
                <Breakdown
                  title={t("booking.day.byCalendar")}
                  rows={summary.byCalendar}
                  emptyText={t("booking.day.nothingBooked")}
                  colorOf={(id) => calendarById.get(id)?.color}
                />
              </Stack>

              {/* ── Who is late, with the one button that fixes it ── */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  {t("booking.day.lateList")}
                </Typography>
                {arrive.error ? (
                  <Alert
                    severity={
                      arrive.error instanceof BookingApiError &&
                      arrive.error.isConflict
                        ? "info"
                        : "error"
                    }
                    sx={{ mb: 1 }}
                  >
                    {errorText(arrive.error, t)}
                  </Alert>
                ) : null}
                <AsyncSection
                  isLoading={dayQuery.isLoading}
                  isSettled={dayQuery.isSuccess || dayQuery.isError}
                  error={dayQuery.error}
                  isEmpty={lateRows.length === 0}
                  emptyText={t("booking.day.nobodyLate")}
                  onRetry={() => void dayQuery.refetch()}
                  skeletonRows={2}
                >
                  <Stack divider={<Divider />}>
                    {lateRows.map((row) => (
                      <Stack
                        key={row.id}
                        direction="row"
                        spacing={2}
                        sx={{
                          alignItems: "center",
                          justifyContent: "space-between",
                          py: 1,
                          flexWrap: "wrap",
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={2}
                          sx={{ alignItems: "baseline", flexWrap: "wrap" }}
                        >
                          <Typography sx={{ fontWeight: 700, minWidth: 56 }}>
                            {formatPragueTime(row.startUtc)}
                          </Typography>
                          <Typography>
                            {patientNameById.get(row.patientId) ??
                              t("booking.day.loadingName")}
                          </Typography>
                          <Typography sx={{ color: "text.secondary" }}>
                            {row.activityName}
                            {calendarById.get(row.calendarId ?? "")
                              ? ` · ${calendarById.get(row.calendarId ?? "")?.name}`
                              : ""}
                          </Typography>
                        </Stack>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={row.calendarId === null || arrive.isPending}
                          onClick={() => arrive.mutate(row)}
                        >
                          {t("booking.detail.arrived")}
                        </Button>
                      </Stack>
                    ))}
                  </Stack>
                </AsyncSection>
              </Box>

              {/* ── Minutes: free, next, and what stayed empty ── */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1}>
                  <Line
                    label={t("booking.day.freeToday")}
                    value={t("booking.day.minutes", {
                      count: summary.freeMinutesLeft,
                    })}
                  />
                  <Line
                    label={t("booking.day.next")}
                    value={
                      summary.nextAppointment
                        ? `${formatPragueTime(
                            summary.nextAppointment.startUtc,
                          )} · ${summary.nextAppointment.activityName} · ${
                            summary.nextAppointment.calendarName
                          }`
                        : t("booking.day.noneLeft")
                    }
                  />
                  {/*
                    A day with no working hours has nothing to be unused out of.
                    Dividing by it would print "0 % využití" for a closed
                    Saturday, which reads like a bad day rather than no day.
                  */}
                  <Line
                    label={t("booking.day.unused")}
                    value={
                      summary.workingMinutes > 0
                        ? t("booking.day.unusedOf", {
                            unused: summary.unusedMinutes,
                            working: summary.workingMinutes,
                            percent: utilisation,
                          })
                        : t("booking.day.noWorkingHours")
                    }
                  />
                </Stack>
              </Paper>
            </Stack>
          ) : null}
        </AsyncSection>
      </AsyncSection>
    </Box>
  );
}

function Tally({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
      {note ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {note}
        </Typography>
      ) : null}
    </Box>
  );
}

function Breakdown({
  title,
  rows,
  emptyText,
  colorOf,
}: {
  title: string;
  rows: { id: string; name: string; count: number }[];
  emptyText: string;
  colorOf?: (id: string) => string | undefined;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {emptyText}
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {rows.map((row) => (
            <Stack
              key={row.id}
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {colorOf?.(row.id) ? (
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: colorOf(row.id),
                    }}
                  />
                ) : null}
                <Typography variant="body2">{row.name}</Typography>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {row.count}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ justifyContent: "space-between", flexWrap: "wrap" }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
    </Stack>
  );
}
