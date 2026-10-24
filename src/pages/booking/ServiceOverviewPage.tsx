import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Box, Button, Collapse, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
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
import { CalendarTogglePills } from "../../components/booking/CalendarTogglePills";
import { statusTone } from "../../components/booking/appointmentEdit";
import { StatusChip } from "../../components/ui";
import { usePermissions } from "../../auth/usePermission";
import { EntityLink, MetricCard, PageFrame, Shelf, TARGET_SX, entityTarget, mayOpen } from "../../ui/shelf";
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
    queryFn: ({ signal }) => appointmentsApi.range(from, to, shownIds, { signal }),
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

  const held = usePermissions();
  const codebookError = calendarsQuery.error ?? activitiesQuery.error ?? servicesQuery.error;
  const codebooksLoading = calendarsQuery.isLoading || activitiesQuery.isLoading || servicesQuery.isLoading;
  const codebooksReady = calendarsQuery.isSuccess && activitiesQuery.isSuccess && servicesQuery.isSuccess;
  const rangeLoading = enabled && (appointmentsQuery.isLoading || previewQuery.isLoading);
  const rangeError = enabled ? (appointmentsQuery.error ?? previewQuery.error) : null;
  const noCalendars = codebooksReady && calendars.length === 0;
  const noneChosen = codebooksReady && calendars.length > 0 && shownIds.length === 0;
  const nothing = codebooksReady && shownIds.length > 0 && !rangeLoading && rangeError === null && rows.length === 0 && !offersPending;
  const ready = codebooksReady && shownIds.length > 0 && !rangeLoading && rangeError === null && rows.length > 0;

  const retryCodebooks = () => {
    void calendarsQuery.refetch();
    void activitiesQuery.refetch();
    void servicesQuery.refetch();
  };
  const retryRange = () => {
    void appointmentsQuery.refetch();
    void previewQuery.refetch();
  };

  const freeCell = (row: OverviewRow): ReactNode =>
    row.freeStarts > 0 ? (
      <Tooltip
        title={
          <Box>
            <Typography variant="caption" component="div">{t("booking.serviceOverview.freeHelp")}</Typography>
            {row.freeByCalendar.map((entry) => (
              <Typography key={entry.calendarId} variant="caption" component="div">
                {calendarById.get(entry.calendarId)?.name ?? entry.calendarId}: {freeText(entry.starts, entry.dates.length)}
              </Typography>
            ))}
          </Box>
        }
      >
        <Typography variant="body2" component="span" tabIndex={0} sx={{ cursor: "help", fontWeight: 600 }}>
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
    );

  return (
    <PageFrame title={t("booking.serviceOverview.title")} purpose={t("booking.serviceOverview.subtitle")}>
      {/* ── Filters: every axis the owner named, nothing fixed ── */}
      <Shelf id="filter" title="Filtr" layout="board">
        <Box sx={{ p: 2 }}>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.5, alignItems: "flex-start", mb: 1.5 }}>
            <TextField
              type="date"
              size="small"
              label={t("booking.serviceOverview.from")}
              value={from}
              onChange={(e) => setRange({ from: e.target.value, to })}
              slotProps={{ inputLabel: { shrink: true }, input: { sx: { minHeight: 44 } } }}
              sx={{ flex: { xs: "1 1 140px", sm: "0 0 auto" } }}
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
              slotProps={{ inputLabel: { shrink: true }, input: { sx: { minHeight: 44 } } }}
              sx={{ flex: { xs: "1 1 140px", sm: "0 0 auto" } }}
            />
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => setRange(thisWeek(today))} sx={{ ...TARGET_SX, minHeight: 44 }}>
                {t("booking.serviceOverview.thisWeek")}
              </Button>
              <Button variant="outlined" onClick={() => setRange(thisMonth(today))} sx={{ ...TARGET_SX, minHeight: 44 }}>
                {t("booking.serviceOverview.thisMonth")}
              </Button>
            </Stack>
            <TextField
              select
              size="small"
              label={t("booking.serviceOverview.worker")}
              value={workerValue}
              onChange={(e) => setWorkerId(e.target.value)}
              slotProps={{ input: { sx: { minHeight: 44 } } }}
              sx={{ minWidth: 220, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}
            >
              <MenuItem value="">{t("booking.serviceOverview.allWorkers")}</MenuItem>
              {workers.map((worker) => (
                <MenuItem key={worker.id} value={worker.id}>{worker.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label={t("booking.serviceOverview.service")}
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              slotProps={{ input: { sx: { minHeight: 44 } } }}
              sx={{ minWidth: 220, flex: { xs: "1 1 100%", sm: "0 0 auto" } }}
            >
              <MenuItem value="">{t("booking.serviceOverview.allServices")}</MenuItem>
              {services
                .filter((service) => service.isActive)
                .map((service) => (
                  <MenuItem key={service.id} value={service.id}>{service.name}</MenuItem>
                ))}
            </TextField>
          </Stack>
          <CalendarTogglePills calendars={calendars} selected={selected} onChange={setSelected} />
        </Box>
      </Shelf>

      {/* A range the day endpoint would refuse is said in the filter (above) and asked nowhere. */}
      {rangeOk && (
        <Shelf
          id="totals"
          title="Volná kapacita"
          hint={offersPending ? t("booking.serviceOverview.offersLoading") : undefined}
          layout="row"
          fill
          minCardWidth={200}
          cardHeight={104}
          skeletons={2}
          stagger={false}
          loading={codebooksLoading || rangeLoading}
          error={codebookError ? "Číselníky se nepodařilo načíst." : rangeError ? "Termíny v rozsahu se nepodařilo načíst." : false}
          onRetry={codebookError ? retryCodebooks : retryRange}
          empty={noCalendars || noneChosen || nothing}
          emptyState={
            noCalendars
              ? { text: t("booking.serviceOverview.noCalendars") }
              : noneChosen
                ? { text: t("booking.serviceOverview.noCalendarChosen"), action: { label: "Zobrazit všechny", onClick: () => setSelected(null) } }
                : { text: t("booking.serviceOverview.empty"), action: { label: "Otevřít kalendář", to: "/planovani", state: { date: from } } }
          }
        >
          <MetricCard label="Objednáno" value={totals.booked} hint="ve zvoleném rozsahu" />
          <MetricCard label="Volné začátky" value={totals.freeStarts} tone="green" hint={freeText(totals.freeStarts, totals.freeDays)} />
        </Shelf>
      )}

      {rangeOk && ready && offersFailed > 0 ? (
        <Alert severity="warning">{t("booking.serviceOverview.offersFailed", { count: offersFailed })}</Alert>
      ) : null}

      {/* ── One shelf per služba: its činnosti, booked and free ── */}
      {rangeOk && ready
        ? groups.map((group) => {
            const service = group.service;
            const booked = group.rows.reduce((sum, row) => sum + row.booked, 0);
            const starts = group.rows.reduce((sum, row) => sum + row.freeStarts, 0);
            const days = new Set(group.rows.flatMap((row) => row.freeDates)).size;
            const serviceRef = service ? { kind: "service" as const, id: service.id, label: service.name } : null;
            return (
              <Shelf
                key={service?.id ?? "none"}
                id={`service-${service?.id ?? "none"}`}
                title={service?.name ?? t("booking.serviceOverview.noService")}
                hint={starts > 0 ? `volno ${freeText(starts, days)}` : undefined}
                count={booked}
                layout="list"
                viewAll={serviceRef && mayOpen("service", held) ? { to: entityTarget(serviceRef).to, label: "Služba" } : undefined}
              >
                {group.rows.map((row) => (
                  <ActivityRow
                    key={row.activityId}
                    row={row}
                    open={open.has(row.activityId)}
                    toggle={toggle}
                    weekdayLine={weekdayLine}
                    whoLine={whoLine}
                    freeCell={freeCell}
                    calendarName={(id) => (id ? (calendarById.get(id)?.name ?? "") : "")}
                  />
                ))}
              </Shelf>
            );
          })
        : null}
    </PageFrame>
  );
}

/** One činnost: what it is, how many are booked, when and by whom, what is still free; its terms on request. */
function ActivityRow({
  row,
  open,
  toggle,
  weekdayLine,
  whoLine,
  freeCell,
  calendarName,
}: {
  row: OverviewRow;
  open: boolean;
  toggle: (activityId: string) => void;
  weekdayLine: (row: OverviewRow) => string;
  whoLine: (row: OverviewRow) => string;
  freeCell: (row: OverviewRow) => ReactNode;
  calendarName: (calendarId: string | null) => string;
}) {
  const { t } = useTranslation();
  const notes = [
    row.cancelled > 0 ? t("booking.serviceOverview.cancelledNote", { count: row.cancelled }) : null,
    row.noShow > 0 ? t("booking.serviceOverview.noShowNote", { count: row.noShow }) : null,
  ].filter(Boolean);
  const label = (k: string) => (
    <Box component="span" sx={{ color: "text.secondary", fontWeight: 500, mr: 0.5 }}>{t(`booking.serviceOverview.column.${k}`)}:</Box>
  );

  return (
    <Box role="listitem" data-row="activity" sx={{ px: 1.5, py: 1.25, "& + &": { borderTop: "1px solid", borderColor: "divider" } }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
        <Box sx={{ flex: "1 1 0", minWidth: 0 }}>
          <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Typography component="div" sx={{ fontSize: 15, fontWeight: 650 }}>
              {row.activity !== null ? <EntityLink entity={{ kind: "activity", id: row.activityId, label: row.activityName }} /> : row.activityName}
            </Typography>
            {row.activity === null ? (
              <StatusChip tone="beige" size="sm">{t("booking.serviceOverview.unlisted")}</StatusChip>
            ) : row.activity.isActive ? null : (
              <StatusChip tone="grey" size="sm">{t("booking.serviceOverview.retired")}</StatusChip>
            )}
          </Stack>
          {/* When, who, free: one line each on a phone, one line together where there is room. */}
          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, flexWrap: "wrap", columnGap: 3, rowGap: 0.25, mt: 0.25 }}>
            <Typography component="div" variant="body2">
              {label("when")}
              <Box component="span">{weekdayLine(row) || "—"}</Box>
            </Typography>
            <Typography component="div" variant="body2">
              {label("who")}
              <Box component="span">{whoLine(row) || "—"}</Box>
            </Typography>
            <Typography component="div" variant="body2">
              {label("free")}
              {freeCell(row)}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography data-booked="" sx={{ fontSize: 22, fontWeight: 750, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{row.booked}</Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>{t("booking.serviceOverview.column.booked")}</Typography>
          {notes.length > 0 ? (
            <Typography variant="caption" sx={{ color: "text.secondary", whiteSpace: "nowrap", display: "block" }}>{notes.join(" · ")}</Typography>
          ) : null}
        </Box>
        <Box sx={{ width: 44, flexShrink: 0 }}>
          {row.appointments.length > 0 ? (
            <IconButton
              aria-expanded={open}
              aria-label={t(open ? "booking.serviceOverview.hideAppointments" : "booking.serviceOverview.showAppointments", { activity: row.activityName })}
              onClick={() => toggle(row.activityId)}
              sx={{ width: 44, height: 44 }}
            >
              {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          ) : null}
        </Box>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Stack spacing={0.75} sx={{ pt: 1.25, pl: { xs: 0, sm: 2 } }} data-appointments="">
          {row.appointments.map((appointment) => {
            const name = statusName(appointment.status);
            const gone = statusTally(appointment.status) === "cancelled";
            const when = `${formatPragueTime(appointment.startUtc)}–${formatPragueTime(appointment.endUtc)}`;
            return (
              <Stack
                key={appointment.id}
                direction="row"
                sx={{
                  alignItems: "center",
                  flexWrap: "wrap",
                  columnGap: 2,
                  rowGap: 0.25,
                  /* 6.6: a cancelled one is drawn differently, never dropped. */
                  color: gone ? "text.disabled" : "text.primary",
                  textDecoration: gone ? "line-through" : "none",
                }}
              >
                <Typography variant="body2" sx={{ minWidth: 90 }}>{formatPragueDate(appointment.startUtc)}</Typography>
                <Typography component="div" variant="body2" sx={{ fontWeight: 600, minWidth: 96 }}>
                  {appointment.calendarId !== null ? (
                    <EntityLink entity={{ kind: "appointment", id: appointment.id, calendarId: appointment.calendarId, label: when }} />
                  ) : (
                    when
                  )}
                </Typography>
                <Typography variant="body2">{calendarName(appointment.calendarId)}</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {appointment.worker?.name ?? t("booking.serviceOverview.unassigned")}
                </Typography>
                <StatusChip tone={gone ? "grey" : statusTone(appointment.status)} size="sm">
                  {name ? t(`booking.status.${name}`) : t("booking.serviceOverview.unknownStatus")}
                </StatusChip>
              </Stack>
            );
          })}
        </Stack>
      </Collapse>
    </Box>
  );
}
