import { Fragment, useCallback, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { activitiesApi } from "../../api/activities";
import { appointmentsApi } from "../../api/appointments";
import { calendarsApi } from "../../api/calendars";
import { clinicServicesApi } from "../../api/clinicServices";
import { workingHoursApi } from "../../api/workingHours";
import { statusName, statusTally, type AvailabilitySlot } from "../../api/bookingContracts";
import { AsyncSection } from "../../components/booking/AsyncSection";
import {
  addDaysToDateOnly,
  dayOfWeekOf,
  formatPragueDate,
  formatPragueTime,
  parseDateOnly,
  toDateOnly,
} from "../../utils/time";
import {
  buildOverview,
  groupByService,
  offeredPairs,
  overviewTotals,
  workersInRange,
  type CalendarPreview,
  type OfferedStarts,
  type OverviewRow,
} from "./serviceOverview";

/**
 * Přehled podle služeb - the owner's "overview by service".
 *
 * What the administrator asked to see: how many bookings each činnost has,
 * when they are, which employee provides them, and how much is still free -
 * "chosen in the system (filters), nothing hardcoded". So every axis is a
 * filter: the date range, the calendars, the employee, the service. The
 * employee list is whoever the rota names in that range, not the account
 * list, because somebody with no day on any calendar has nothing here.
 *
 * Nothing on this screen is computed from working hours or activity lengths
 * (6.1). The three columns are three endpoints regrouped - see
 * `serviceOverview.ts` for which is which. Free capacity in particular is the
 * count of starts the booking dialog would offer, asked once per calendar and
 * činnost the preview says that calendar offers in the range, and it is
 * labelled as starts and days rather than as places (4.6).
 */

/** 4.5: the range endpoint refuses more, so the screen says so before the trip. */
const MAX_RANGE_DAYS = 62;
const CODEBOOK_STALE_MS = 5 * 60 * 1000;
/** 4.4: free times are never cached for long - the next answer may differ. */
const OFFER_STALE_MS = 60 * 1000;

function thisWeek(today: string): { from: string; to: string } {
  const monday = addDaysToDateOnly(today, -((dayOfWeekOf(today) + 6) % 7));
  return { from: monday, to: addDaysToDateOnly(monday, 6) };
}

function thisMonth(today: string): { from: string; to: string } {
  const first = `${today.slice(0, 8)}01`;
  const date = parseDateOnly(today);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return { from: first, to: `${today.slice(0, 8)}${String(lastDay).padStart(2, "0")}` };
}

export default function ServiceOverviewPage() {
  const { t } = useTranslation();
  const today = toDateOnly(new Date());

  const [range, setRange] = useState(() => thisWeek(today));
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [workerId, setWorkerId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const { from, to } = range;
  const rangeReversed = to < from;
  const rangeTooLong = !rangeReversed && addDaysToDateOnly(from, MAX_RANGE_DAYS - 1) < to;
  const rangeOk = !rangeReversed && !rangeTooLong;

  /* ── Codebooks ── */

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: CODEBOOK_STALE_MS,
  });
  const activitiesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: activitiesApi.list,
    staleTime: CODEBOOK_STALE_MS,
  });
  const servicesQuery = useQuery({
    queryKey: ["clinic-services"],
    queryFn: clinicServicesApi.list,
    staleTime: CODEBOOK_STALE_MS,
  });

  const calendars = useMemo(
    () => (calendarsQuery.data ?? []).filter((c) => c.isActive),
    [calendarsQuery.data],
  );
  const calendarById = useMemo(
    () => new Map(calendars.map((c) => [c.id, c])),
    [calendars],
  );
  const activities = useMemo(
    () => activitiesQuery.data?.activities ?? [],
    [activitiesQuery.data],
  );
  const activityById = useMemo(
    () => new Map(activities.map((a) => [a.id, a])),
    [activities],
  );
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);

  const shownIds = useMemo(
    () =>
      calendars
        .filter((c) => selected === null || selected.has(c.id))
        .map((c) => c.id),
    [calendars, selected],
  );
  const enabled = rangeOk && shownIds.length > 0;

  /* ── The range: appointments (4.5) and the rota behind them (4.2) ── */

  const appointmentsQuery = useQuery({
    queryKey: ["day-range", from, to, shownIds.join(",")],
    queryFn: () => appointmentsApi.range(from, to, shownIds),
    enabled,
    placeholderData: (previous) => previous,
  });

  const previewQuery = useQuery({
    queryKey: ["overview-preview", from, to, shownIds.join(",")],
    queryFn: async (): Promise<CalendarPreview[]> =>
      Promise.all(
        shownIds.map(async (calendarId) => ({
          calendarId,
          days: await workingHoursApi.preview(calendarId, from, to),
        })),
      ),
    enabled,
    placeholderData: (previous) => previous,
  });

  const previews = useMemo(() => previewQuery.data ?? [], [previewQuery.data]);
  const workers = useMemo(() => workersInRange(previews), [previews]);
  /* A worker chosen for one range may have no day in the next. */
  const workerValue = workers.some((w) => w.id === workerId) ? workerId : "";

  /* ── Free starts (4.4): one question per calendar and činnost it offers ── */

  const pairs = useMemo(
    () =>
      offeredPairs(previews).filter(
        (pair) =>
          serviceId === "" ||
          activityById.get(pair.activityId)?.clinicServiceId === serviceId,
      ),
    [previews, serviceId, activityById],
  );

  /*
   * Folded once per change of results, so `offered` keeps its identity while
   * nothing arrives - the table below is rebuilt from it and should not be
   * rebuilt because a query object was re-created.
   */
  const combineOffers = useCallback(
    (results: UseQueryResult<AvailabilitySlot[]>[]) => ({
      offered: pairs.flatMap((pair, index): OfferedStarts[] => {
        const slots = results[index]?.data;
        return slots ? [{ ...pair, slots }] : [];
      }),
      pending: new Set(pairs.filter((_, i) => results[i]?.isPending).map((p) => p.activityId)),
      failed: new Set(pairs.filter((_, i) => results[i]?.isError).map((p) => p.activityId)),
      failedCount: results.filter((result) => result.isError).length,
    }),
    [pairs],
  );

  const offers = useQueries({
    queries: pairs.map((pair) => ({
      queryKey: ["availability", pair.calendarId, pair.activityId, from, to],
      queryFn: () =>
        appointmentsApi.getAvailability(pair.calendarId, pair.activityId, from, to),
      staleTime: OFFER_STALE_MS,
    })),
    combine: combineOffers,
  });

  const offersPending = offers.pending.size > 0;
  const offersFailed = offers.failedCount;
  const pendingActivities = offers.pending;
  const failedActivities = offers.failed;

  /* ── Put together ── */

  const rows = useMemo(
    () =>
      buildOverview({
        activities,
        services,
        appointments: appointmentsQuery.data ?? [],
        previews,
        offered: offers.offered,
        filter: { workerId: workerValue || null, serviceId: serviceId || null },
      }),
    [activities, services, appointmentsQuery.data, previews, offers.offered, workerValue, serviceId],
  );
  const groups = useMemo(() => groupByService(rows), [rows]);
  const totals = useMemo(() => overviewTotals(rows), [rows]);

  const toggle = (activityId: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });

  const weekdayLine = (row: OverviewRow) =>
    row.byWeekday
      .map((count, day) => ({ count, day }))
      .filter((entry) => entry.count > 0)
      /* Monday first, as a Czech week is read. */
      .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7))
      .map((entry) => `${t(`booking.serviceOverview.weekdayShort.${entry.day}`)} ${entry.count}`)
      .join(" · ");

  const whoLine = (row: OverviewRow) =>
    row.byWorker
      .map(
        ({ worker, count }) =>
          `${worker?.name ?? t("booking.serviceOverview.unassigned")} (${count})`,
      )
      .join(", ");

  const freeText = (starts: number, days: number) =>
    `${t("booking.serviceOverview.startsCount", { count: starts })} ${t("booking.serviceOverview.daysCount", { count: days })}`;

  const codebookError =
    calendarsQuery.error ?? activitiesQuery.error ?? servicesQuery.error;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {t("booking.serviceOverview.title")}
        </Typography>
        <Typography sx={{ color: "text.secondary" }}>
          {t("booking.serviceOverview.subtitle")}
        </Typography>
      </Box>

      {/* ── Filters: every axis the owner named, nothing fixed ── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack
          direction="row"
          sx={{ flexWrap: "wrap", gap: 2, alignItems: "flex-start", mb: 1.5 }}
        >
          <TextField
            type="date"
            size="small"
            label={t("booking.serviceOverview.from")}
            value={from}
            onChange={(e) => setRange({ from: e.target.value, to })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="date"
            size="small"
            label={t("booking.serviceOverview.to")}
            value={to}
            onChange={(e) => setRange({ from, to: e.target.value })}
            error={!rangeOk}
            helperText={
              rangeReversed
                ? t("booking.serviceOverview.rangeReversed")
                : rangeTooLong
                  ? t("booking.serviceOverview.rangeTooLong", { days: MAX_RANGE_DAYS })
                  : undefined
            }
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
            <Button size="small" variant="outlined" onClick={() => setRange(thisWeek(today))}>
              {t("booking.serviceOverview.thisWeek")}
            </Button>
            <Button size="small" variant="outlined" onClick={() => setRange(thisMonth(today))}>
              {t("booking.serviceOverview.thisMonth")}
            </Button>
          </Stack>
          <TextField
            select
            size="small"
            label={t("booking.serviceOverview.worker")}
            value={workerValue}
            onChange={(e) => setWorkerId(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">{t("booking.serviceOverview.allWorkers")}</MenuItem>
            {workers.map((worker) => (
              <MenuItem key={worker.id} value={worker.id}>
                {worker.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={t("booking.serviceOverview.service")}
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">{t("booking.serviceOverview.allServices")}</MenuItem>
            {services
              .filter((service) => service.isActive)
              .map((service) => (
                <MenuItem key={service.id} value={service.id}>
                  {service.name}
                </MenuItem>
              ))}
          </TextField>
        </Stack>

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
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
      </Paper>

      <AsyncSection
        isLoading={
          calendarsQuery.isLoading || activitiesQuery.isLoading || servicesQuery.isLoading
        }
        isSettled={
          calendarsQuery.isSuccess && activitiesQuery.isSuccess && servicesQuery.isSuccess
        }
        error={codebookError}
        isEmpty={calendars.length === 0}
        emptyText={t("booking.serviceOverview.noCalendars")}
        onRetry={() => {
          void calendarsQuery.refetch();
          void activitiesQuery.refetch();
          void servicesQuery.refetch();
        }}
        skeletonRows={3}
      >
        {!rangeOk ? null : (
          <AsyncSection
            isLoading={appointmentsQuery.isLoading || previewQuery.isLoading}
            isSettled={
              shownIds.length === 0 ||
              ((appointmentsQuery.isSuccess || appointmentsQuery.isError) &&
                (previewQuery.isSuccess || previewQuery.isError))
            }
            error={appointmentsQuery.error ?? previewQuery.error}
            isEmpty={shownIds.length === 0 || (rows.length === 0 && !offersPending)}
            emptyText={
              shownIds.length === 0
                ? t("booking.serviceOverview.noCalendarChosen")
                : t("booking.serviceOverview.empty")
            }
            onRetry={() => {
              void appointmentsQuery.refetch();
              void previewQuery.refetch();
            }}
            skeletonRows={5}
          >
            <Stack
              direction="row"
              sx={{ flexWrap: "wrap", gap: 2, alignItems: "baseline", mb: 1 }}
            >
              <Typography sx={{ fontWeight: 700 }}>
                {t("booking.serviceOverview.totals", {
                  booked: t("booking.serviceOverview.bookedCount", { count: totals.booked }),
                  free: freeText(totals.freeStarts, totals.freeDays),
                })}
              </Typography>
              {offersPending ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {t("booking.serviceOverview.offersLoading")}
                </Typography>
              ) : null}
            </Stack>

            {offersFailed > 0 ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {t("booking.serviceOverview.offersFailed", { count: offersFailed })}
              </Alert>
            ) : null}

            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("booking.serviceOverview.column.activity")}</TableCell>
                    <TableCell align="right">{t("booking.serviceOverview.column.booked")}</TableCell>
                    <TableCell>{t("booking.serviceOverview.column.when")}</TableCell>
                    <TableCell>{t("booking.serviceOverview.column.who")}</TableCell>
                    <TableCell>{t("booking.serviceOverview.column.free")}</TableCell>
                    <TableCell padding="checkbox" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map((group) => (
                    <GroupRows
                      key={group.service?.id ?? "none"}
                      title={group.service?.name ?? t("booking.serviceOverview.noService")}
                      rows={group.rows}
                      open={open}
                      toggle={toggle}
                      weekdayLine={weekdayLine}
                      whoLine={whoLine}
                      freeCell={(row) =>
                        row.freeStarts > 0 ? (
                          <Tooltip
                            title={
                              <Box>
                                <Typography variant="caption" component="div">
                                  {t("booking.serviceOverview.freeHelp")}
                                </Typography>
                                {row.freeByCalendar.map((entry) => (
                                  <Typography key={entry.calendarId} variant="caption" component="div">
                                    {calendarById.get(entry.calendarId)?.name ?? entry.calendarId}:{" "}
                                    {freeText(entry.starts, entry.dates.length)}
                                  </Typography>
                                ))}
                              </Box>
                            }
                          >
                            <Typography variant="body2" component="span" sx={{ cursor: "help" }}>
                              {freeText(row.freeStarts, row.freeDates.length)}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" component="span" sx={{ color: "text.secondary" }}>
                            {pendingActivities.has(row.activityId)
                              ? t("booking.serviceOverview.freeLoading")
                              : failedActivities.has(row.activityId)
                                ? t("booking.serviceOverview.freeFailed")
                                : t("booking.serviceOverview.freeNone")}
                          </Typography>
                        )
                      }
                      calendarName={(id) => (id ? (calendarById.get(id)?.name ?? "") : "")}
                    />
                  ))}
                </TableBody>
              </Table>
            </Box>
          </AsyncSection>
        )}
      </AsyncSection>
    </Box>
  );
}

function GroupRows({
  title,
  rows,
  open,
  toggle,
  weekdayLine,
  whoLine,
  freeCell,
  calendarName,
}: {
  title: string;
  rows: OverviewRow[];
  open: Set<string>;
  toggle: (activityId: string) => void;
  weekdayLine: (row: OverviewRow) => string;
  whoLine: (row: OverviewRow) => string;
  freeCell: (row: OverviewRow) => React.ReactNode;
  calendarName: (calendarId: string | null) => string;
}) {
  const { t } = useTranslation();

  return (
    <>
      <TableRow>
        <TableCell colSpan={6} sx={{ backgroundColor: "action.hover" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        </TableCell>
      </TableRow>
      {rows.map((row) => {
        const isOpen = open.has(row.activityId);
        return (
          <Fragment key={row.activityId}>
            <TableRow hover>
              <TableCell>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {row.activityName}
                  </Typography>
                  {row.activity === null ? (
                    <Chip size="small" variant="outlined" label={t("booking.serviceOverview.unlisted")} />
                  ) : row.activity.isActive ? null : (
                    <Chip size="small" variant="outlined" label={t("booking.serviceOverview.retired")} />
                  )}
                </Stack>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {row.booked}
                </Typography>
                {row.cancelled > 0 || row.noShow > 0 ? (
                  <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap" }}>
                    {[
                      row.cancelled > 0
                        ? t("booking.serviceOverview.cancelledNote", { count: row.cancelled })
                        : null,
                      row.noShow > 0
                        ? t("booking.serviceOverview.noShowNote", { count: row.noShow })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                ) : null}
              </TableCell>
              <TableCell>
                <Typography variant="body2">{weekdayLine(row) || "—"}</Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{whoLine(row) || "—"}</Typography>
              </TableCell>
              <TableCell>{freeCell(row)}</TableCell>
              <TableCell padding="checkbox">
                {row.appointments.length > 0 ? (
                  <IconButton
                    size="small"
                    aria-label={t(
                      isOpen
                        ? "booking.serviceOverview.hideAppointments"
                        : "booking.serviceOverview.showAppointments",
                      { activity: row.activityName },
                    )}
                    onClick={() => toggle(row.activityId)}
                  >
                    {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                ) : null}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={6} sx={{ py: 0, borderBottom: isOpen ? undefined : "none" }}>
                <Collapse in={isOpen} unmountOnExit>
                  <Stack spacing={0.5} sx={{ py: 1, pl: 2 }}>
                    {row.appointments.map((appointment) => {
                      const name = statusName(appointment.status);
                      const gone = statusTally(appointment.status) === "cancelled";
                      return (
                        <Stack
                          key={appointment.id}
                          direction="row"
                          spacing={2}
                          sx={{
                            alignItems: "baseline",
                            flexWrap: "wrap",
                            /* 6.6: a cancelled one is drawn differently, never dropped. */
                            color: gone ? "text.disabled" : "text.primary",
                            textDecoration: gone ? "line-through" : "none",
                          }}
                        >
                          <Typography variant="body2" sx={{ minWidth: 90 }}>
                            {formatPragueDate(appointment.startUtc)}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 96 }}>
                            {formatPragueTime(appointment.startUtc)}–{formatPragueTime(appointment.endUtc)}
                          </Typography>
                          <Typography variant="body2">{calendarName(appointment.calendarId)}</Typography>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            {appointment.worker?.name ?? t("booking.serviceOverview.unassigned")}
                          </Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={name ? t(`booking.status.${name}`) : t("booking.serviceOverview.unknownStatus")}
                          />
                        </Stack>
                      );
                    })}
                  </Stack>
                </Collapse>
              </TableCell>
            </TableRow>
          </Fragment>
        );
      })}
    </>
  );
}
