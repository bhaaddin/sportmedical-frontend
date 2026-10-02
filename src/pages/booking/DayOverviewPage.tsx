import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
import { activitiesApi } from "../../api/activities";
import { BookingApiError } from "../../api/apiError";
import { isKnownPaperworkReason, isLateStatus, statusName } from "../../api/bookingContracts";
import type { DayAppointment } from "../../api/bookingContracts";
import {
  addDaysToDateOnly,
  formatPragueTime,
  isLate,
  pragueWallClockToInstant,
  toDateOnly,
} from "../../utils/time";
import { KpiCard, PageHeader, SectionLabel, SoftCard, StatusChip } from "../../components/ui";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { CalendarTogglePills } from "../../components/booking/CalendarTogglePills";
import { NewAppointmentDialog } from "../../components/booking/NewAppointmentDialog";
import { errorText } from "../../components/booking/errorText";
import { formatCzk, formatLongPragueDate, statusTone } from "../../components/booking/appointmentEdit";
import { usePermission } from "../../auth/usePermission";

/**
 * The day at a glance — contract 5.12, laid out as `booking.md` part 3 and
 * drawn with the board's kit (KPI cards, bordered cards, the table head).
 *
 * Two decisions worth stating, because both look like omissions:
 *
 *   - **The `PODKLADY ✓ / ⚠` line appears only when there is an answer.** It
 *     came back in v29 after change 43, which had removed it, was itself
 *     reversed, and the values went live in v32. When `summary.paperwork` is
 *     `null` the line is absent altogether - not "✓ 0 ⚠ 0", which would tell
 *     the desk everything is in order on the strength of nobody having looked.
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

const SCHEDULED = 0;
const CONFIRMED = 1;
const CHECKED_IN = 2;
const COMPLETED = 3;
const NO_SHOW = 5;

export default function DayOverviewPage() {
  const { t } = useTranslation();
  /* The server refuses a booking without it; the button is not offered either.
     Marking somebody as arrived is a status change, which is bookings.edit. */
  const mayBook = usePermission("bookings.create");
  const mayEdit = usePermission("bookings.edit");
  const queryClient = useQueryClient();

  const [date, setDate] = useState<string>(toDateOnly(new Date()));
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [now, setNow] = useState(() => new Date());
  /* 5.9: "spustiteľný z kalendára aj z prehľadu". */
  const [booking, setBooking] = useState(false);

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
  /* The day overview is a live board — arrivals, no-shows and new bookings should
     land on their own. A minute keeps it current without hammering the server. */
  const summaryQuery = useQuery({
    queryKey: ["day-summary", date, shownIds.join(",")],
    queryFn: () => appointmentsApi.daySummary(date, shownIds),
    enabled: shownIds.length > 0,
    refetchInterval: 60_000,
  });

  const dayQuery = useQuery({
    queryKey: ["day-range", date, date, shownIds.join(",")],
    queryFn: () => appointmentsApi.range(date, date, shownIds),
    enabled: shownIds.length > 0,
    refetchInterval: 60_000,
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
    queries: [...new Set(lateRows.map((a) => a.patientId).filter((id) => id !== ""))].map((id) => ({
      queryKey: ["patient", id],
      queryFn: () => patientsApi.getById(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  /* The činnost prices, from one cached list, so the day list can show what each
     appointment costs. */
  const activitiesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesApi.list(),
    staleTime: 5 * 60 * 1000,
  });
  const priceById = useMemo(
    () => new Map((activitiesQuery.data?.activities ?? []).map((a) => [a.id, a.priceCzk])),
    [activitiesQuery.data],
  );

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

  const refreshDay = () => {
    void queryClient.invalidateQueries({ queryKey: ["day-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["day-range"] });
  };

  /* The desk did not come, so it never arrives and never pays. */
  const noShow = useMutation({
    mutationFn: (appointment: DayAppointment) =>
      appointmentsApi.setStatus(appointment.calendarId as string, appointment.id, String(NO_SHOW)),
    onSuccess: refreshDay,
  });

  /* Arrived and paid: the visit is done. */
  const complete = useMutation({
    mutationFn: (appointment: DayAppointment) =>
      appointmentsApi.setStatus(appointment.calendarId as string, appointment.id, String(COMPLETED)),
    onSuccess: refreshDay,
  });

  const summary = summaryQuery.data;
  const utilisation =
    summary && summary.workingMinutes > 0
      ? Math.round((summary.bookedMinutes / summary.workingMinutes) * 100)
      : null;

  const stepBy = (days: number) => setDate((d) => addDaysToDateOnly(d, days));

  const nameOf = (row: DayAppointment) =>
    row.patientId === ""
      ? (row.patientName ?? "Bez pacienta")
      : (patientNameById.get(row.patientId) ?? t("booking.day.loadingName"));

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <PageHeader
        title={t("booking.day.title")}
        /* Noon in Prague on that date, so the weekday is that date's wherever
           the browser happens to be. */
        subtitle={formatLongPragueDate(pragueWallClockToInstant(date, "12:00"))}
        actions={
          <>
            <Stack
              direction="row"
              sx={{
                alignItems: "center",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2.5,
                bgcolor: "background.paper",
                overflow: "hidden",
              }}
            >
              <IconButton
                size="small"
                onClick={() => stepBy(-1)}
                aria-label={t("booking.day.previous")}
                sx={{ borderRadius: 0, width: 40, height: 40 }}
              >
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              <Button
                onClick={() => setDate(toDateOnly(new Date()))}
                sx={{ borderRadius: 0, minHeight: 40, px: 1.5, borderInline: "1px solid", borderColor: "divider" }}
              >
                {t("booking.day.today")}
              </Button>
              <IconButton
                size="small"
                onClick={() => stepBy(1)}
                aria-label={t("booking.day.nextDay")}
                sx={{ borderRadius: 0, width: 40, height: 40 }}
              >
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Stack>
            {mayBook ? (
              <Button variant="contained" onClick={() => setBooking(true)}>
                {t("booking.new.title")}
              </Button>
            ) : null}
          </>
        }
      />

      <AsyncSection
        isLoading={calendarsQuery.isLoading}
        isSettled={calendarsQuery.isSuccess}
        error={calendarsQuery.error}
        isEmpty={calendars.length === 0}
        emptyText={t("booking.grid.noCalendars")}
        onRetry={() => void calendarsQuery.refetch()}
        skeletonRows={3}
      >
        {/* Which columns the day counts: every calendar on by default. */}
        <Box sx={{ mb: 2.5 }}>
          <CalendarTogglePills calendars={calendars} selected={selected} onChange={setSelected} />
        </Box>

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
            <Stack spacing={2.5}>
              {/* Who is out today. Their hours are already left out of the
                  working time below, so the figures and this line agree. */}
              {summary.absent.length > 0 ? (
                <Alert severity="warning">
                  {t("booking.day.absent", {
                    list: summary.absent
                      .map((a) =>
                        `${a.workerDisplayName ?? t("booking.day.absentUnnamed")} (${a.calendarName})`,
                      )
                      .join(", "),
                  })}
                </Alert>
              ) : null}

              {/* ── The five tallies ── */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" },
                  gap: 2,
                }}
              >
                <KpiCard label={t("booking.day.booked")} value={summary.booked} />
                <KpiCard label={t("booking.day.arrived")} value={summary.arrived} tone="green" />
                <KpiCard
                  label={t("booking.status.late")}
                  value={lateRows.length}
                  hint={t("booking.day.lateIsDisplayOnly")}
                  tone={lateRows.length > 0 ? "red" : "ink"}
                />
                <KpiCard label={t("booking.day.didNotCome")} value={summary.didNotCome} />
                <KpiCard label={t("booking.day.cancelled")} value={summary.cancelled} />
              </Box>

              {/* ── By activity and by calendar ── */}
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
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
              </Box>

              {/* ── Who is late, with the one button that fixes it ── */}
              <SoftCard sx={{ p: 0, overflow: "hidden" }}>
                <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5 }}>
                  <SectionLabel sx={{ mb: 0 }}>{t("booking.day.lateList")}</SectionLabel>
                </Box>
                {arrive.error ? (
                  <Alert
                    severity={
                      arrive.error instanceof BookingApiError && arrive.error.isConflict ? "info" : "error"
                    }
                    sx={{ mx: 2.5, mb: 1.5 }}
                  >
                    {errorText(arrive.error, t)}
                  </Alert>
                ) : null}
                <Box sx={{ px: 2.5, pb: 2.5 }}>
                  <AsyncSection
                    isLoading={dayQuery.isLoading}
                    isSettled={dayQuery.isSuccess || dayQuery.isError}
                    error={dayQuery.error}
                    isEmpty={lateRows.length === 0}
                    emptyText={t("booking.day.nobodyLate")}
                    onRetry={() => void dayQuery.refetch()}
                    skeletonRows={2}
                  >
                    <TableContainer sx={{ border: "1px solid", borderColor: "divider" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: 80 }}>Čas</TableCell>
                            <TableCell>Pacient</TableCell>
                            <TableCell>Činnost</TableCell>
                            <TableCell align="right">Cena</TableCell>
                            {mayEdit ? <TableCell align="right" sx={{ width: 220 }}>Příchod</TableCell> : null}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {lateRows.map((row) => (
                            <TableRow key={row.id} hover>
                              <TableCell sx={{ fontWeight: 700 }}>{formatPragueTime(row.startUtc)}</TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>{nameOf(row)}</TableCell>
                              <TableCell>
                                {row.activityName}
                                {calendarById.get(row.calendarId ?? "") ? (
                                  <Box component="span" sx={{ color: "text.secondary" }}>
                                    {" "}
                                    · {calendarById.get(row.calendarId ?? "")?.name}
                                  </Box>
                                ) : null}
                              </TableCell>
                              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                {row.activityId && priceById.get(row.activityId) != null
                                  ? formatCzk(priceById.get(row.activityId)!)
                                  : "—"}
                              </TableCell>
                              {mayEdit ? (
                                <TableCell align="right">
                                  <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
                                    {row.status === SCHEDULED || row.status === CONFIRMED ? (
                                      <>
                                        {/* Only the next real step is offered: came, or
                                            did not. No wall of buttons to tick through. */}
                                        <Button
                                          size="small"
                                          variant="contained"
                                          color="secondary"
                                          disabled={row.calendarId === null || arrive.isPending}
                                          onClick={() => arrive.mutate(row)}
                                          sx={{ color: "#FFFFFF" }}
                                        >
                                          {t("booking.detail.arrived")}
                                        </Button>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          color="error"
                                          disabled={row.calendarId === null || noShow.isPending}
                                          onClick={() => noShow.mutate(row)}
                                        >
                                          {t("booking.detail.noShow")}
                                        </Button>
                                      </>
                                    ) : row.status === CHECKED_IN ? (
                                      /* Here already, so the only thing left is to finish
                                         and take payment. */
                                      <Button
                                        size="small"
                                        variant="contained"
                                        disabled={row.calendarId === null || complete.isPending}
                                        onClick={() => complete.mutate(row)}
                                      >
                                        {t("booking.detail.complete")}
                                      </Button>
                                    ) : (
                                      <StatusChip tone={statusTone(row.status)}>
                                        {t(`booking.status.${statusName(row.status) ?? "unknown"}`)}
                                      </StatusChip>
                                    )}
                                  </Stack>
                                </TableCell>
                              ) : null}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AsyncSection>
                </Box>
              </SoftCard>

              {/* ── Paperwork (4.6, v29): only when there is an answer ── */}
              {summary.paperwork ? (
                <SoftCard>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 1 }}>
                    <SectionLabel sx={{ mb: 0 }}>{t("booking.paperwork.line")}</SectionLabel>
                    <StatusChip tone="green">✓ {summary.paperwork.ready}</StatusChip>
                    <StatusChip tone={summary.paperwork.missing > 0 ? "beige" : "grey"}>
                      ⚠ {summary.paperwork.missing}
                    </StatusChip>
                  </Stack>
                  {/*
                    `who` arrives assembled (4.6), so this never walks the day's
                    appointments to work out who is short of what.
                  */}
                  {summary.paperwork.who.length === 0 ? (
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      {t("booking.paperwork.nobodyMissing")}
                    </Typography>
                  ) : (
                    <TableContainer sx={{ border: "1px solid", borderColor: "divider" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ width: 80 }}>Čas</TableCell>
                            <TableCell>Činnost</TableCell>
                            <TableCell>Chybí</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {summary.paperwork.who.map((row) => (
                            <TableRow key={row.appointmentId} hover>
                              <TableCell sx={{ fontWeight: 700 }}>{formatPragueTime(row.startUtc)}</TableCell>
                              <TableCell>{row.activityName}</TableCell>
                              <TableCell>
                                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                                  {row.missing.map((code) => (
                                    <StatusChip key={code} tone="beige">
                                      {isKnownPaperworkReason(code)
                                        ? t(`booking.paperwork.${code}`)
                                        : t("booking.paperwork.unknown", { code })}
                                    </StatusChip>
                                  ))}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </SoftCard>
              ) : null}

              {/* ── Minutes: free, next, and what stayed empty ── */}
              <SoftCard>
                <SectionLabel>Kapacita dne</SectionLabel>
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
              </SoftCard>
            </Stack>
          ) : null}
        </AsyncSection>
      </AsyncSection>

      {booking && mayBook ? (
        <NewAppointmentDialog
          open
          onClose={() => setBooking(false)}
          onBooked={() => {
            void queryClient.invalidateQueries({ queryKey: ["day-summary"] });
            void queryClient.invalidateQueries({ queryKey: ["day-range"] });
          }}
          initialDate={date}
          initialCalendarId={shownIds.length === 1 ? shownIds[0] : undefined}
        />
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
    <SoftCard>
      <SectionLabel>{title}</SectionLabel>
      {rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {emptyText}
        </Typography>
      ) : (
        <Stack divider={<Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />}>
          {rows.map((row) => (
            <Stack
              key={row.id}
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", justifyContent: "space-between", py: 0.75 }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
                {colorOf?.(row.id) ? (
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: 0.5,
                      flexShrink: 0,
                      backgroundColor: colorOf(row.id),
                    }}
                  />
                ) : null}
                <Typography variant="body2" noWrap>
                  {row.name}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {row.count}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </SoftCard>
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
