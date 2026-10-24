import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Box, Button, IconButton, Stack, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddIcon from "@mui/icons-material/Add";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { appointmentsApi } from "../../api/appointments";
import { calendarsApi } from "../../api/calendars";
import { patientsApi } from "../../api/patients";
import { activitiesApi } from "../../api/activities";
import { BookingApiError } from "../../api/apiError";
import { isKnownPaperworkReason, isLateStatus, statusName, statusTally } from "../../api/bookingContracts";
import type { DayAppointment } from "../../api/bookingContracts";
import { addDaysToDateOnly, formatPragueTime, isLate, pragueWallClockToInstant, toDateOnly } from "../../utils/time";
import { StatusChip } from "../../components/ui";
import { CalendarTogglePills } from "../../components/booking/CalendarTogglePills";
import { NewAppointmentDialog } from "../../components/booking/NewAppointmentDialog";
import { errorText } from "../../components/booking/errorText";
import { formatLongPragueDate } from "../../components/booking/appointmentEdit";
import { dayTotalLine, shownPrice } from "../../components/booking/grid/appointmentPrice";
import { usePermission } from "../../auth/usePermission";
import { EntityLink, MetricCard, PageFrame, Shelf, TARGET_SX, type ShelfAction } from "../../ui/shelf";
import { DayRow } from "../../ui/shelf/DayRow";
import { APPOINTMENT_STATUS_WORD } from "../../ui/shelf/words";

/**
 * Dnešní přehled - the desk's day, as shelves (docs/ui-shelf-system.md, route 33; R18: few strong blocks, calm).
 *
 * It answers, in this order, what the person at the desk asks:
 *
 *   Den v číslech        the server's five tallies (contract 5.12) and what the standing visits add up to
 *   Čekárna              who has arrived and waits - the one step left is "Dokončit"
 *   Mají zpoždění        who should be here and is not - "Přišel" or "Nepřišel"
 *   Podklady             who is short of a questionnaire / report / consent (only when the server answered)
 *   Kapacita dne         free minutes still ahead, the next visit, what stayed unused, the day by činnost
 *   one shelf per calendar   the whole day of that column, each row with its status or its one next step
 *
 * Decisions kept from the board this replaces:
 *
 *   - **The paperwork shelf appears only when there is an answer.** `summary.paperwork === null` draws nothing - not
 *     "✓ 0 ⚠ 0", which would tell the desk everything is in order on the strength of nobody having looked.
 *   - **"Free today" is minutes, not places** (owner, 9. 9. 2026): the same ninety minutes is two slots or three.
 *   - **Late is counted here**, from the day's rows, every minute (6.2): a fact about the clock, not a stored state; the
 *     server's `runningLate` would be wrong a minute later and disagree with the list under it.
 *   - The summary and the day list ask for the SAME calendars, so the figures and the lists never argue.
 *   - Only the next real step is offered on a row, never a wall of buttons; a status change is `bookings.edit`, a new
 *     booking `bookings.create` - without them the step is not drawn (the server refuses anyway).
 */

const SCHEDULED = 0;
const CONFIRMED = 1;
const CHECKED_IN = 2;
const COMPLETED = 3;
const NO_SHOW = 5;

const byStart = (a: DayAppointment, b: DayAppointment) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime();
/** A row that still stands (a cancelled visit is not part of the day's work). */
const stands = (a: DayAppointment) => statusTally(a.status) !== "cancelled";

export default function DayOverviewPage() {
  const { t } = useTranslation();
  const mayBook = usePermission("bookings.create");
  const mayEdit = usePermission("bookings.edit");
  const maySeePatients = usePermission("patients.view");
  const maySetUp = usePermission("settings.clinic.manage");
  const queryClient = useQueryClient();

  const [date, setDate] = useState<string>(toDateOnly(new Date()));
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [now, setNow] = useState(() => new Date());
  /* 5.9: "spustiteľný z kalendára aj z prehľadu" - from the header, or from an empty calendar's shelf (that calendar). */
  const [booking, setBooking] = useState<{ calendarId?: string } | null>(null);

  /* 6.2: the clock moves, so the count moves with it. */
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const calendarsQuery = useQuery({ queryKey: ["calendars"], queryFn: calendarsApi.list, staleTime: 5 * 60 * 1000 });
  const calendars = useMemo(() => (calendarsQuery.data ?? []).filter((c) => c.isActive), [calendarsQuery.data]);
  const shownCalendars = useMemo(() => calendars.filter((c) => selected === null || selected.has(c.id)), [calendars, selected]);
  const shownIds = useMemo(() => shownCalendars.map((c) => c.id), [shownCalendars]);
  const calendarById = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);

  /* A live board: arrivals, no-shows and new bookings land on their own, once a minute. */
  const summaryQuery = useQuery({
    queryKey: ["day-summary", date, shownIds.join(",")],
    queryFn: ({ signal }) => appointmentsApi.daySummary(date, shownIds, { signal }),
    enabled: shownIds.length > 0,
    refetchInterval: 60_000,
  });
  const dayQuery = useQuery({
    queryKey: ["day-range", date, date, shownIds.join(",")],
    queryFn: ({ signal }) => appointmentsApi.range(date, date, shownIds, { signal }),
    enabled: shownIds.length > 0,
    refetchInterval: 60_000,
  });

  const day = useMemo(() => [...(dayQuery.data ?? [])].sort(byStart), [dayQuery.data]);
  const standing = useMemo(() => day.filter(stands), [day]);
  const waitingRows = useMemo(() => standing.filter((a) => a.status === CHECKED_IN), [standing]);
  const lateRows = useMemo(() => day.filter((a) => isLate(a.startUtc, isLateStatus(a.status), now)), [day, now]);
  const lateIds = useMemo(() => new Set(lateRows.map((a) => a.id)), [lateRows]);
  const rowsByCalendar = useMemo(() => {
    const map = new Map<string, DayAppointment[]>();
    for (const a of standing) {
      const key = a.calendarId ?? "";
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return map;
  }, [standing]);

  /*
   * The day row carries `patientId` and usually the name; a row without the name has it fetched (once, cached under the key
   * every screen shares) - and only for a person who may read the register.
   */
  const lookups = useMemo(
    () => (maySeePatients ? [...new Set(day.filter((a) => a.patientId !== "" && !a.patientName).map((a) => a.patientId))] : []),
    [day, maySeePatients],
  );
  const patientQueries = useQueries({
    queries: lookups.map((id) => ({ queryKey: ["patient", id], queryFn: () => patientsApi.getById(id), staleTime: 5 * 60 * 1000 })),
  });
  const patientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of patientQueries) if (q.data) map.set(q.data.id, q.data.fullName ?? `${q.data.lastName} ${q.data.firstName}`);
    return map;
  }, [patientQueries]);

  /* The činnost prices, from one cached list. Etapa 12, "ceny všude": agreed, else the row's list price, else the catalogue. */
  const activitiesQuery = useQuery({ queryKey: ["activities"], queryFn: () => activitiesApi.list(), staleTime: 5 * 60 * 1000 });
  const priceById = useMemo(() => new Map((activitiesQuery.data?.activities ?? []).map((a) => [a.id, a.priceCzk])), [activitiesQuery.data]);
  const priceOf = (row: DayAppointment) => shownPrice(row, priceById.get(row.activityId) ?? null);
  /* The day's money: every row that still stands (a cancelled visit or a no-show earns nothing). */
  const dayTotal = useMemo(
    () => dayTotalLine(standing.filter((a) => statusTally(a.status) !== "noShow").map((a) => shownPrice(a, priceById.get(a.activityId) ?? null))),
    [standing, priceById],
  );

  const refreshDay = () => {
    void queryClient.invalidateQueries({ queryKey: ["day-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["day-range"] });
  };
  const setStatus = (status: number) => (appointment: DayAppointment) =>
    appointmentsApi.setStatus(appointment.calendarId as string, appointment.id, String(status));
  /* "Po kliknutí prišiel sa Prišlo aj Mešká zmenia okamžite." */
  const arrive = useMutation({ mutationFn: setStatus(CHECKED_IN), onSuccess: refreshDay });
  /* The patient did not come, so the visit never happens and never pays. */
  const noShow = useMutation({ mutationFn: setStatus(NO_SHOW), onSuccess: refreshDay });
  /* Arrived and paid: the visit is done. */
  const complete = useMutation({ mutationFn: setStatus(COMPLETED), onSuccess: refreshDay });
  const stepError = arrive.error ?? noShow.error ?? complete.error;

  const summary = summaryQuery.data;
  const utilisation = summary && summary.workingMinutes > 0 ? Math.round((summary.bookedMinutes / summary.workingMinutes) * 100) : null;

  const stepBy = (days: number) => setDate((d) => addDaysToDateOnly(d, days));
  const calendarLink: ShelfAction = { label: "Celý den v kalendáři", to: "/planovani", state: { date } };

  /* ── what a row says ── */

  const nameOf = (row: DayAppointment): string =>
    patientNameById.get(row.patientId) ??
    row.patientName ??
    (row.patientId === "" ? "Bez pacienta" : maySeePatients ? t("booking.day.loadingName") : "Pacient");

  const who = (row: DayAppointment): ReactNode =>
    row.patientId === "" ? nameOf(row) : <EntityLink entity={{ kind: "patient", id: row.patientId, label: nameOf(row) }} />;

  const what = (row: DayAppointment, withCalendar: boolean): ReactNode => {
    const calendar = withCalendar ? calendarById.get(row.calendarId ?? "")?.name : undefined;
    return (
      <>
        {row.calendarId !== null ? (
          <EntityLink entity={{ kind: "appointment", id: row.id, calendarId: row.calendarId, label: row.activityName }} />
        ) : (
          row.activityName
        )}
        {calendar !== undefined ? ` · ${calendar}` : null}
      </>
    );
  };

  const price = (row: DayAppointment): ReactNode => {
    const p = priceOf(row);
    return (
      <Box component="span" data-testid="row-price">
        {p.text}
        {p.caption ? <Box component="span" sx={{ display: "block", fontSize: 12, fontWeight: 500, color: "text.secondary" }}>{p.caption}</Box> : null}
      </Box>
    );
  };

  const statusWord = (row: DayAppointment): ReactNode => {
    if (lateIds.has(row.id)) return <StatusChip tone="red" size="sm">{t("booking.status.late")}</StatusChip>;
    const word = APPOINTMENT_STATUS_WORD[statusName(row.status) ?? ""];
    return <StatusChip tone={word?.tone ?? "grey"} size="sm">{word?.label ?? t("booking.status.unknown")}</StatusChip>;
  };

  const step = (label: string, run: () => void, pending: boolean, row: DayAppointment, variant: "contained" | "outlined" = "contained", color?: "error") => (
    <Button
      size="small"
      variant={variant}
      color={color}
      disabled={row.calendarId === null || pending}
      onClick={run}
      aria-label={`${label}: ${nameOf(row)}, ${formatPragueTime(row.startUtc)}`}
      sx={{ ...TARGET_SX, whiteSpace: "nowrap" }}
    >
      {label}
    </Button>
  );

  /* A calendar's column: upcoming visits offer "Přišel" (somebody early), the rest say where they stand. */
  const columnTrailing = (row: DayAppointment): ReactNode =>
    mayEdit && (row.status === SCHEDULED || row.status === CONFIRMED) && !lateIds.has(row.id)
      ? step(t("booking.detail.arrived"), () => arrive.mutate(row), arrive.isPending, row, "outlined")
      : statusWord(row);

  /* ── the states of the page as a whole ── */

  const calendarsFailed = calendarsQuery.isError;
  const noCalendars = calendarsQuery.isSuccess && calendars.length === 0;
  const noneChosen = calendarsQuery.isSuccess && calendars.length > 0 && shownIds.length === 0;
  const working = calendarsQuery.isSuccess && shownIds.length > 0;
  const dayLoading = calendarsQuery.isLoading || (working && dayQuery.isPending);
  const dayFailed = working && dayQuery.isError;

  const summaryEmpty = noCalendars
    ? { text: t("booking.grid.noCalendars"), action: maySetUp ? { label: "Nastavit kalendáře", to: "/calendars" } : undefined }
    : { text: t("booking.day.noCalendarChosen"), action: { label: "Zobrazit všechny", onClick: () => setSelected(null) } };

  return (
    <PageFrame
      title={t("booking.day.title")}
      /* Noon in Prague on that date, so the weekday is that date's wherever the browser happens to be. */
      purpose={formatLongPragueDate(pragueWallClockToInstant(date, "12:00"))}
      actions={
        <Stack
          direction="row"
          data-day-stepper=""
          sx={{ alignItems: "center", border: "1px solid", borderColor: "divider", borderRadius: 2.5, overflow: "hidden" }}
        >
          <IconButton onClick={() => stepBy(-1)} aria-label={t("booking.day.previous")} sx={{ borderRadius: 0, width: 44, height: 44 }}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Button
            onClick={() => setDate(toDateOnly(new Date()))}
            sx={{ borderRadius: 0, minHeight: 44, px: 1.5, borderInline: "1px solid", borderColor: "divider" }}
          >
            {t("booking.day.today")}
          </Button>
          <IconButton onClick={() => stepBy(1)} aria-label={t("booking.day.nextDay")} sx={{ borderRadius: 0, width: 44, height: 44 }}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      }
      primaryAction={mayBook ? { label: t("booking.new.title"), icon: <AddIcon />, onClick: () => setBooking({}) } : undefined}
    >
      {/* Which columns the day counts: every calendar on by default. */}
      {calendars.length > 0 && (
        <Box data-filters="" sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mt: { xs: -1, md: -1.5 } }}>
          <CalendarTogglePills calendars={calendars} selected={selected} onChange={setSelected} />
        </Box>
      )}

      {/* Who is out today. Their hours are already left out of the working time, so the figures and this line agree. */}
      {working && summary && summary.absent.length > 0 && (
        <Alert severity="warning" sx={{ mt: -1 }}>
          {t("booking.day.absent", {
            list: summary.absent.map((a) => `${a.workerDisplayName ?? t("booking.day.absentUnnamed")} (${a.calendarName})`).join(", "),
          })}
        </Alert>
      )}

      <Shelf
        id="summary"
        title="Den v číslech"
        layout="row"
        fill
        minCardWidth={148}
        cardHeight={104}
        skeletons={5}
        stagger={false}
        loading={calendarsQuery.isLoading || (working && summaryQuery.isPending)}
        error={calendarsFailed ? "Kalendáře se nepodařilo načíst." : working && summaryQuery.isError ? "Souhrn dne se nepodařilo načíst." : false}
        onRetry={() => void (calendarsFailed ? calendarsQuery.refetch() : summaryQuery.refetch())}
        empty={noCalendars || noneChosen}
        emptyState={summaryEmpty}
        controls={
          working && dayQuery.data ? (
            <Typography data-testid="day-total" sx={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>{dayTotal}</Typography>
          ) : undefined
        }
      >
        {summary && (
          <>
            <MetricCard label={t("booking.day.booked")} value={summary.booked} />
            <MetricCard label={t("booking.day.arrived")} value={summary.arrived} tone="green" />
            <MetricCard label={t("booking.status.late")} value={lateRows.length} hint={t("booking.day.lateIsDisplayOnly")} tone={lateRows.length > 0 ? "red" : "grey"} />
            <MetricCard label={t("booking.day.didNotCome")} value={summary.didNotCome} />
            <MetricCard label={t("booking.day.cancelled")} value={summary.cancelled} />
          </>
        )}
      </Shelf>

      {(working || calendarsQuery.isLoading) && (
        <>
          {stepError ? (
            <Alert severity={stepError instanceof BookingApiError && stepError.isConflict ? "info" : "error"}>{errorText(stepError, t)}</Alert>
          ) : null}

          <Box
            data-day-grid=""
            sx={{
              display: "grid",
              gap: { xs: 3, md: 3.5 },
              gridTemplateColumns: "minmax(0, 1fr)",
              alignItems: "start",
              "@media (min-width: 1280px)": { gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)" },
            }}
          >
            <Stack spacing={{ xs: 3, md: 3.5 }} sx={{ minWidth: 0 }}>
              <Shelf
                id="waiting"
                title="Čekárna"
                hint="Přišli a čekají"
                count={dayLoading || dayFailed ? undefined : waitingRows.length}
                countTone="green"
                layout="list"
                maxHeight="min(46dvh, 420px)"
                loading={dayLoading}
                error={dayFailed ? "Dnešní termíny se nepodařilo načíst." : false}
                onRetry={() => void dayQuery.refetch()}
                empty={waitingRows.length === 0}
                emptyState={{ text: "Nikdo nečeká.", action: calendarLink }}
              >
                {waitingRows.map((row) => (
                  <DayRow
                    key={row.id}
                    time={formatPragueTime(row.startUtc)}
                    who={who(row)}
                    what={what(row, true)}
                    aside={price(row)}
                    /* Here already: the only thing left is to finish and take payment. */
                    trailing={mayEdit ? step(t("booking.detail.complete"), () => complete.mutate(row), complete.isPending, row) : undefined}
                  />
                ))}
              </Shelf>

              <Shelf
                id="late"
                title={t("booking.day.lateList")}
                hint={t("booking.day.lateIsDisplayOnly")}
                count={dayLoading || dayFailed ? undefined : lateRows.length}
                countTone="red"
                layout="list"
                maxHeight="min(46dvh, 420px)"
                loading={dayLoading}
                error={dayFailed ? "Dnešní termíny se nepodařilo načíst." : false}
                onRetry={() => void dayQuery.refetch()}
                empty={lateRows.length === 0}
                emptyState={{ text: t("booking.day.nobodyLate"), action: calendarLink }}
              >
                {lateRows.map((row) => (
                  <DayRow
                    key={row.id}
                    time={formatPragueTime(row.startUtc)}
                    who={who(row)}
                    what={what(row, true)}
                    aside={price(row)}
                    /* Only the next real step: came, or did not. */
                    trailing={
                      mayEdit ? (
                        <>
                          {step(t("booking.detail.arrived"), () => arrive.mutate(row), arrive.isPending, row)}
                          {step(t("booking.detail.noShow"), () => noShow.mutate(row), noShow.isPending, row, "outlined", "error")}
                        </>
                      ) : undefined
                    }
                  />
                ))}
              </Shelf>
            </Stack>

            <Stack spacing={{ xs: 3, md: 3.5 }} sx={{ minWidth: 0 }}>
              {/* 4.6, v29: only when there is an answer; `who` arrives assembled, nothing here walks the day to build it. */}
              {summary?.paperwork ? (
                <Shelf
                  id="paperwork"
                  title={t("booking.paperwork.line")}
                  hint={`✓ ${summary.paperwork.ready} v pořádku`}
                  count={summary.paperwork.missing}
                  countTone="beige"
                  layout="list"
                  maxHeight="min(40dvh, 360px)"
                  empty={summary.paperwork.who.length === 0}
                  emptyState={{ text: t("booking.paperwork.nobodyMissing"), action: calendarLink }}
                >
                  {summary.paperwork.who.map((p) => {
                    const row = day.find((a) => a.id === p.appointmentId);
                    return (
                      <DayRow
                        key={p.appointmentId}
                        kind="paperwork"
                        time={formatPragueTime(p.startUtc)}
                        who={row ? who(row) : p.patientId !== "" ? <EntityLink entity={{ kind: "patient", id: p.patientId, label: "Pacient" }} /> : "Bez pacienta"}
                        what={<EntityLink entity={{ kind: "appointment", id: p.appointmentId, calendarId: p.calendarId, label: p.activityName }} />}
                        trailing={
                          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75, justifyContent: "flex-end" }}>
                            {p.missing.map((code) => (
                              <StatusChip key={code} tone="beige" size="sm">
                                {isKnownPaperworkReason(code) ? t(`booking.paperwork.${code}`) : t("booking.paperwork.unknown", { code })}
                              </StatusChip>
                            ))}
                          </Stack>
                        }
                      />
                    );
                  })}
                </Shelf>
              ) : null}

              <Shelf
                id="capacity"
                title="Kapacita dne"
                layout="board"
                loading={calendarsQuery.isLoading || (working && summaryQuery.isPending)}
                error={working && summaryQuery.isError ? "Kapacitu dne se nepodařilo načíst." : false}
                onRetry={() => void summaryQuery.refetch()}
              >
                {summary && (
                  <Stack spacing={1.25} sx={{ p: 2 }}>
                    <Line label={t("booking.day.freeToday")} value={t("booking.day.minutes", { count: summary.freeMinutesLeft })} />
                    <Line
                      label={t("booking.day.next")}
                      value={
                        summary.nextAppointment ? (
                          <>
                            {formatPragueTime(summary.nextAppointment.startUtc)} ·{" "}
                            <EntityLink
                              entity={{
                                kind: "appointment",
                                id: summary.nextAppointment.appointmentId,
                                calendarId: summary.nextAppointment.calendarId,
                                label: summary.nextAppointment.activityName,
                              }}
                            />{" "}
                            · {summary.nextAppointment.calendarName}
                          </>
                        ) : (
                          t("booking.day.noneLeft")
                        )
                      }
                    />
                    {/* A day with no working hours has nothing to be unused out of: "0 % využití" for a closed Saturday reads like
                        a bad day rather than no day. */}
                    <Line
                      label={t("booking.day.unused")}
                      value={
                        summary.workingMinutes > 0
                          ? t("booking.day.unusedOf", { unused: summary.unusedMinutes, working: summary.workingMinutes, percent: utilisation })
                          : t("booking.day.noWorkingHours")
                      }
                    />
                    <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1.25 }} data-by-activity="">
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "text.secondary", mb: 0.5 }}>{t("booking.day.byActivity")}</Typography>
                      {summary.byActivity.length === 0 ? (
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>{t("booking.day.nothingBooked")}</Typography>
                      ) : (
                        summary.byActivity.map((a) => <Line key={a.id} label={a.name} value={String(a.count)} />)
                      )}
                    </Box>
                  </Stack>
                )}
              </Shelf>
            </Stack>
          </Box>

          {/* The day per calendar: one column each, side by side where there is room. A failed day list is said above, once. */}
          {!dayFailed && (
            <Box
              data-calendar-columns=""
              sx={{ display: "grid", gap: { xs: 3, md: 2.5 }, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", alignItems: "start" }}
            >
              {shownCalendars.map((c) => {
                const rows = rowsByCalendar.get(c.id) ?? [];
                return (
                  <Shelf
                    key={c.id}
                    id={`calendar-${c.id}`}
                    title={c.name}
                    count={dayLoading ? undefined : rows.length}
                    layout="list"
                    maxHeight="min(56dvh, 520px)"
                    loading={dayLoading}
                    empty={rows.length === 0}
                    emptyState={{
                      text: "Na tento den tu nic není.",
                      action: mayBook ? { label: "Objednat sem", onClick: () => setBooking({ calendarId: c.id }) } : calendarLink,
                    }}
                  >
                    {rows.map((row) => (
                      <DayRow key={row.id} time={formatPragueTime(row.startUtc)} who={who(row)} what={what(row, false)} trailing={columnTrailing(row)} />
                    ))}
                  </Shelf>
                );
              })}
            </Box>
          )}
        </>
      )}

      {booking !== null && mayBook ? (
        <NewAppointmentDialog
          open
          onClose={() => setBooking(null)}
          onBooked={refreshDay}
          initialDate={date}
          initialCalendarId={booking.calendarId ?? (shownIds.length === 1 ? shownIds[0] : undefined)}
        />
      ) : null}
    </PageFrame>
  );
}

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "baseline" }}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>{label}</Typography>
      <Typography component="div" variant="body2" sx={{ fontWeight: 600, textAlign: "right" }}>{value}</Typography>
    </Stack>
  );
}
