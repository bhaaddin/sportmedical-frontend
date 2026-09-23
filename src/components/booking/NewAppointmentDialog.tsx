import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutlineOutlined";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { appointmentsApi } from "../../api/appointments";
import { activitiesApi } from "../../api/activities";
import { workingHoursApi } from "../../api/workingHours";
import { calendarsApi } from "../../api/calendars";
import { BookingApiError } from "../../api/apiError";
import { isKnownPaperworkReason } from "../../api/bookingContracts";
import { usePermission } from "../../auth/usePermission";
import {
  formatDateOnly,
  formatPragueDateTime,
  parseDateOnly,
  toDateOnly,
} from "../../utils/time";
import { dayState, dayStateLabelKey } from "../../pages/booking/dayState";
import { AsyncSection } from "./AsyncSection";
import { errorText } from "./errorText";
import { PatientSearch } from "./patient/PatientSearch";
import { PatientFilled } from "./patient/PatientFilled";
import type { PatientHit } from "./patient/patientTypeahead";
import {
  endClock,
  isCompleteMoment,
  isDateOnly,
  isStartOffered,
  normalizeTime,
  parseLocalDateTime,
  pragueClock,
  rangeLabel,
  selectionMinutes,
  toStartUtc,
} from "./NewAppointmentDialog.logic";

/**
 * Booking an appointment by hand - contract 5.9, in the order the owner works
 * on the telephone: **date -> time -> patient -> činnost -> book**. Opened from
 * the calendar grid with a time already chosen (a click or a drag), it starts
 * at the patient: the date and the range "od 09:00 do 10:00" are already there,
 * one "Změnit" away if they were wrong.
 *
 * This is the only screen in the application that creates an appointment.
 *
 * Three rules hold the flow together:
 *
 *   - **6.1** - whether a time is free is the server's answer. The chosen start
 *     is checked against `availability` for the chosen činnost, and the only
 *     times offered instead are the ones that answer returned. The činnosti on
 *     offer are the ones the server says the day offers
 *     (`preview.offeredActivityIds`).
 *   - **6.4** - a time outside the offer is reachable only as an override: only
 *     for `bookings.edit`, set apart, and never without a typed reason.
 *   - **6.3** - after the server confirms, nothing is drawn optimistically; the
 *     caller reloads. A `409` is somebody else having been faster: the offer
 *     reloads, the form stays, and the server's sentence is shown calmly.
 *
 * Searching comes before creating a patient - see `patient/PatientSearch.tsx`.
 *
 * The Czech wording new in this version lives in `TEXT` below rather than in
 * `cs.json`, which several teams edit at the same time; moving it there is a
 * mechanical follow-up.
 */

/** 4.5: `source` 0 is the desk. Online is 1, a club is 2; neither books here. */
const SOURCE_STAFF = 0;

const TEXT = {
  when: "Termín",
  patient: "Vyhledávání z databáze",
  activity: "Činnost",
  note: "Poznámka",
  date: "Datum",
  time: "Čas od",
  change: "Změnit",
  pickWhenFirst: "Nejprve vyberte kalendář, datum a čas.",
  pickPatientFirst: "Nejprve vyberte pacienta.",
  offeredOnly: "Jen činnosti, které má kalendář v tento den.",
  dayOffersNothing: "V tento den kalendář nenabízí žádnou činnost",
  selection: (range: string) => `Vybraný úsek v kalendáři: ${range}.`,
  appointment: (range: string, minutes: number) => `Termín ${range} (${minutes} min)`,
  free: "Čas je volný.",
  notOffered: (time: string) =>
    `V ${time} tuto činnost nabídnout nelze — čas je obsazený nebo mimo pracovní dobu.`,
  pickOffered: "Volné začátky v tento den:",
  noneThatDay: "V tento den už pro tuto činnost není volný čas. Zkuste jiné datum.",
  overrideTimeIs: (when: string) => `Objedná se na ${when}, mimo nabídku.`,
};

interface NewAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  /** Whatever list the dialog was opened from reloads itself (6.3). */
  onBooked: () => void;
  /** The day the caller was looking at, when no time was chosen. */
  initialDate?: string;
  /** The calendar the caller was looking at, or the column clicked. */
  initialCalendarId?: string;
  /** Start chosen in the grid, local clinic time `yyyy-MM-ddTHH:mm`. */
  initialStart?: string;
  /** End of the dragged range, local clinic time `yyyy-MM-ddTHH:mm`. */
  initialEnd?: string;
}

export function NewAppointmentDialog({
  open,
  onClose,
  onBooked,
  initialDate,
  initialCalendarId,
  initialStart,
  initialEnd,
}: NewAppointmentDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  /*
   * Booking past the offer: the person who may change an appointment is the
   * person who may book one outside what the server offered.
   */
  const mayOverride = usePermission("bookings.edit");
  /* The working-hours screen is where activities are assigned; it needs this. */
  const mayAssign = usePermission("settings.clinic.manage");
  const mayRegister = usePermission("patients.register");

  /* ── Where and when. From the grid this arrives chosen. ── */
  const startProp = parseLocalDateTime(initialStart);
  const fromGrid = startProp !== null && Boolean(initialCalendarId);

  const [calendarId, setCalendarId] = useState(initialCalendarId ?? "");
  const [date, setDate] = useState(
    startProp?.date ?? initialDate ?? toDateOnly(new Date()),
  );
  const [time, setTime] = useState(startProp?.time ?? "");
  /* The end of the dragged range - it describes the time only until the time changes. */
  const [selectionEnd, setSelectionEnd] = useState<string | null>(() => {
    const endProp = parseLocalDateTime(initialEnd);
    return startProp && selectionMinutes(startProp, endProp) !== null
      ? (endProp?.time ?? null)
      : null;
  });
  const [editingWhen, setEditingWhen] = useState(!fromGrid);

  /* ── Who, what, and a note ── */
  const [patient, setPatient] = useState<PatientHit | null>(null);
  const [activityId, setActivityId] = useState("");
  const [note, setNote] = useState("");

  /* 6.4: a time outside the offer, and never without a reason. */
  const [overriding, setOverriding] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const [conflict, setConflict] = useState<unknown>(null);
  const [booked, setBooked] = useState<{
    startUtc: string;
    warnings: { code: string; message: string }[];
  } | null>(null);

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const activitiesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: activitiesApi.list,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  /* 6.5: a calendar the user may not see is simply not in the answer. */
  const calendars = useMemo(
    () => (calendarsQuery.data ?? []).filter((c) => c.isActive),
    [calendarsQuery.data],
  );
  const activities = useMemo(
    () => (activitiesQuery.data?.activities ?? []).filter((a) => a.isActive),
    [activitiesQuery.data],
  );

  /* One calendar needs no choosing; one the list does not hold is no choice. */
  const effectiveCalendarId = calendars.some((c) => c.id === calendarId)
    ? calendarId
    : calendars.length === 1
      ? calendars[0].id
      : "";
  const calendar = calendars.find((c) => c.id === effectiveCalendarId) ?? null;

  const moment = { date, time };
  const whenComplete = effectiveCalendarId !== "" && isCompleteMoment(moment);
  const startUtc = whenComplete ? toStartUtc(moment) : null;

  /*
   * What the day offers, asked of the server: which činnosti it has and, if
   * none, why (holiday, closed, nothing assigned). Rule 6.1 again - this reads
   * the answer, it does not compute one.
   */
  const previewQuery = useQuery({
    queryKey: ["preview", effectiveCalendarId, date, date],
    queryFn: () => workingHoursApi.preview(effectiveCalendarId, date, date),
    enabled: open && effectiveCalendarId !== "" && isDateOnly(date),
  });
  const offeredActivities = useMemo(() => {
    const ids = new Set((previewQuery.data ?? []).flatMap((p) => p.offeredActivityIds ?? []));
    return activities.filter((a) => ids.has(a.id));
  }, [previewQuery.data, activities]);
  const day = dayState(previewQuery.data ?? []);
  const dayWordKey = dayStateLabelKey(day);
  const activity = offeredActivities.find((a) => a.id === activityId) ?? null;

  /* Is the chosen start offered for this činnost? Only the server knows. */
  const availabilityQuery = useQuery({
    queryKey: ["availability", effectiveCalendarId, activity?.id ?? "", date, date],
    queryFn: () =>
      appointmentsApi.getAvailability(effectiveCalendarId, activity?.id ?? "", date, date),
    enabled: open && startUtc !== null && activity !== null,
  });
  const offered = isStartOffered(availabilityQuery.data, startUtc);
  const alternatives = (availabilityQuery.data ?? []).filter(
    (s) => !isStartOffered([s], startUtc),
  );

  const book = useMutation({
    mutationFn: (input: { overrideReason?: string }) =>
      appointmentsApi.create({
        patientId: patient?.id ?? "",
        calendarId: effectiveCalendarId,
        activityId: activity?.id ?? "",
        startUtc: startUtc ?? "",
        source: SOURCE_STAFF,
        note: note.trim() === "" ? null : note.trim(),
        overrideReason: input.overrideReason,
      }),
    onSuccess: (result) => {
      setConflict(null);
      setBooked({
        startUtc: result.appointment.startUtc,
        warnings: result.warnings ?? [],
      });
      onBooked();
    },
    onError: (error) => {
      if (error instanceof BookingApiError && error.isConflict) {
        /* 6.3: the offer is stale, so fetch it again and keep the form. */
        setConflict(error);
        void queryClient.invalidateQueries({
          queryKey: ["availability", effectiveCalendarId, activity?.id ?? ""],
        });
      }
      if (error instanceof BookingApiError && error.kind === "notFound") {
        /* 4.5/5.9: the lists are older than the server. */
        void queryClient.invalidateQueries({ queryKey: ["calendars"] });
        void queryClient.invalidateQueries({ queryKey: ["activities"] });
      }
    },
  });

  /* Any change to the time drops the dragged end: it no longer describes it. */
  const changeTime = (next: string) => {
    setTime(next);
    setSelectionEnd(null);
    setOverriding(false);
    setConflict(null);
  };

  const resetBooking = () => {
    setPatient(null);
    setActivityId("");
    setNote("");
    setOverriding(false);
    setOverrideReason("");
    setConflict(null);
    setBooked(null);
    book.reset();
  };

  const close = () => {
    resetBooking();
    onClose();
  };

  const ready =
    patient !== null && activity !== null && startUtc !== null && !book.isPending;
  const canBook = ready && availabilityQuery.isSuccess && offered;
  const canBookOverride =
    ready && availabilityQuery.isSuccess && !offered && overrideReason.trim().length > 0;

  /* ── What the dialog looks like once the booking went through ── */
  if (booked) {
    return (
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>{t("booking.new.bookedTitle")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="success">
              {t("booking.new.bookedAt", {
                when: formatPragueDateTime(booked.startUtc),
              })}
            </Alert>
            {/*
              4.5: warnings are shown and do not block. The patient is on the
              phone; refusing the booking over a missing questionnaire would
              send them away over paperwork that can follow.
            */}
            {booked.warnings.map((w) => (
              <Alert key={w.code} severity="warning">
                {w.message ||
                  (isKnownPaperworkReason(w.code.replace(/^.*\./, ""))
                    ? t(`booking.paperwork.${w.code.replace(/^.*\./, "")}`)
                    : t("booking.paperwork.unknown", { code: w.code }))}
              </Alert>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetBooking}>{t("booking.new.another")}</Button>
          <Button variant="contained" onClick={close}>
            {t("booking.detail.close")}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  const weekday = isDateOnly(date)
    ? new Intl.DateTimeFormat("cs-CZ", { weekday: "long" }).format(parseDateOnly(date))
    : "";
  const selectedRange =
    normalizeTime(time) === ""
      ? ""
      : selectionEnd
        ? rangeLabel(time, selectionEnd)
        : `od ${time}`;
  const appointmentRange =
    activity && whenComplete
      ? rangeLabel(time, endClock(moment, activity.durationMinutes))
      : null;
  const dragged =
    whenComplete && selectionEnd
      ? selectionMinutes(moment, { date, time: selectionEnd })
      : null;

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>{t("booking.new.title")}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* ── 1. Date and time ── */}
          <Box component="section" aria-label={TEXT.when}>
            <SectionTitle>{TEXT.when}</SectionTitle>

            <AsyncSection
              isLoading={calendarsQuery.isLoading}
              isSettled={calendarsQuery.isSuccess || calendarsQuery.isError}
              error={calendarsQuery.error}
              isEmpty={calendars.length === 0}
              emptyText={t("booking.new.noCalendars")}
              onRetry={() => void calendarsQuery.refetch()}
              skeletonRows={1}
            >
              {!editingWhen && whenComplete ? (
                <Stack
                  direction="row"
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    border: "1px solid",
                    borderColor: "primary.light",
                    borderRadius: 2,
                    px: 1.5,
                    py: 1,
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>
                      {weekday} {formatDateOnly(date)} · {selectedRange}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {calendar?.name}
                    </Typography>
                  </Box>
                  <Button size="small" onClick={() => setEditingWhen(true)}>
                    {TEXT.change}
                  </Button>
                </Stack>
              ) : (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  {calendars.length > 1 ? (
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label={t("booking.new.calendar")}
                      value={effectiveCalendarId}
                      onChange={(e) => {
                        setCalendarId(e.target.value);
                        setConflict(null);
                      }}
                    >
                      {calendars.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : null}
                  <TextField
                    type="date"
                    size="small"
                    label={TEXT.date}
                    value={date}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      setDate(e.target.value);
                      setSelectionEnd(null);
                      setConflict(null);
                    }}
                    slotProps={{ inputLabel: { shrink: true } }}
                    sx={{ minWidth: 160 }}
                  />
                  <TextField
                    type="time"
                    size="small"
                    label={TEXT.time}
                    value={time}
                    onChange={(e) => changeTime(normalizeTime(e.target.value))}
                    slotProps={{
                      inputLabel: { shrink: true },
                      htmlInput: { step: 300 },
                    }}
                    sx={{ minWidth: 120 }}
                  />
                </Stack>
              )}
            </AsyncSection>

            {/* The day's own word, when it is not an ordinary open day. */}
            {whenComplete && previewQuery.isSuccess && dayWordKey !== null ? (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {TEXT.dayOffersNothing}:{" "}
                {t(dayWordKey, { defaultValue: t("booking.grid.closed.other") })}.
                {day.kind === "nothing-to-book"
                  ? ` ${t("booking.grid.noActivitiesWhy")}`
                  : ""}
              </Alert>
            ) : null}
            {whenComplete && day.kind === "nothing-to-book" && mayAssign ? (
              <Button
                size="small"
                component={RouterLink}
                to="/working-hours"
                sx={{ mt: 0.5 }}
              >
                {t("booking.grid.noActivitiesWhere")}
              </Button>
            ) : null}
          </Box>

          {/* ── 2. The patient, from the database ── */}
          <Box component="section" aria-label={TEXT.patient}>
            <SectionTitle>{TEXT.patient}</SectionTitle>
            {patient ? (
              <PatientFilled hit={patient} onChange={() => setPatient(null)} />
            ) : (
              <PatientSearch
                enabled={open}
                autoFocus={fromGrid}
                mayRegister={mayRegister}
                onPick={setPatient}
              />
            )}
          </Box>

          {/* ── 3. The činnost, and whether the time is free for it ── */}
          <Box component="section" aria-label={TEXT.activity}>
            <SectionTitle>{TEXT.activity}</SectionTitle>
            {!whenComplete ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {TEXT.pickWhenFirst}
              </Typography>
            ) : !patient ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {TEXT.pickPatientFirst}
              </Typography>
            ) : (
              <AsyncSection
                isLoading={activitiesQuery.isLoading || previewQuery.isLoading}
                isSettled={
                  (activitiesQuery.isSuccess || activitiesQuery.isError) &&
                  (previewQuery.isSuccess || previewQuery.isError)
                }
                error={activitiesQuery.error ?? previewQuery.error}
                isEmpty={offeredActivities.length === 0}
                emptyText={
                  activities.length === 0
                    ? t("booking.new.noActivities")
                    : `${TEXT.dayOffersNothing}.`
                }
                onRetry={() => {
                  void activitiesQuery.refetch();
                  void previewQuery.refetch();
                }}
                skeletonRows={1}
              >
                <Stack spacing={1.5}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label={t("booking.new.activity")}
                    value={activity?.id ?? ""}
                    helperText={TEXT.offeredOnly}
                    onChange={(e) => {
                      setActivityId(e.target.value);
                      setOverriding(false);
                      setConflict(null);
                    }}
                  >
                    {offeredActivities.map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.name} · {a.durationMinutes} min
                      </MenuItem>
                    ))}
                  </TextField>

                  {activity && appointmentRange ? (
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>
                        {TEXT.appointment(appointmentRange, activity.durationMinutes)}
                      </Typography>
                      {dragged !== null &&
                      dragged !== activity.durationMinutes &&
                      selectionEnd ? (
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {TEXT.selection(rangeLabel(time, selectionEnd))}
                        </Typography>
                      ) : null}
                    </Box>
                  ) : null}

                  {conflict ? (
                    <Alert severity="info" onClose={() => setConflict(null)}>
                      {errorText(conflict, t)}
                    </Alert>
                  ) : null}

                  {activity ? (
                    <AsyncSection
                      isLoading={availabilityQuery.isLoading}
                      isSettled={availabilityQuery.isSuccess || availabilityQuery.isError}
                      error={availabilityQuery.error}
                      isEmpty={false}
                      emptyText=""
                      onRetry={() => void availabilityQuery.refetch()}
                      skeletonRows={1}
                    >
                      {offered ? (
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: "center", color: "success.main" }}
                        >
                          <CheckCircleOutline fontSize="small" />
                          <Typography variant="body2">{TEXT.free}</Typography>
                        </Stack>
                      ) : (
                        <Stack spacing={1}>
                          <Alert severity="info">{TEXT.notOffered(time)}</Alert>
                          {alternatives.length > 0 ? (
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{ color: "text.secondary", mb: 0.5 }}
                              >
                                {TEXT.pickOffered}
                              </Typography>
                              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
                                {alternatives.map((slot) => (
                                  <Button
                                    key={slot.startUtc}
                                    size="small"
                                    variant="outlined"
                                    disabled={book.isPending}
                                    onClick={() => changeTime(pragueClock(slot.startUtc))}
                                  >
                                    {pragueClock(slot.startUtc)}
                                  </Button>
                                ))}
                              </Stack>
                            </Box>
                          ) : (
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                              {TEXT.noneThatDay}
                            </Typography>
                          )}

                          {/*
                            6.4. Not an ordinary action: only a role that may
                            override sees it at all, it is set apart, and it
                            will not submit without a reason somebody typed.
                          */}
                          {mayOverride ? (
                            overriding ? (
                              <Stack
                                spacing={1}
                                sx={{
                                  border: "1px solid",
                                  borderColor: "warning.main",
                                  borderRadius: 2,
                                  p: 2,
                                }}
                              >
                                <Typography variant="body2">
                                  {t("booking.new.overrideExplain")}
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {TEXT.overrideTimeIs(`${formatDateOnly(date)} ${time}`)}
                                </Typography>
                                <TextField
                                  size="small"
                                  label={t("booking.new.overrideReason")}
                                  value={overrideReason}
                                  onChange={(e) => setOverrideReason(e.target.value)}
                                />
                                <Stack direction="row" spacing={1}>
                                  <Button
                                    size="small"
                                    color="warning"
                                    variant="contained"
                                    disabled={!canBookOverride}
                                    onClick={() =>
                                      book.mutate({ overrideReason: overrideReason.trim() })
                                    }
                                  >
                                    {t("booking.new.overrideBook")}
                                  </Button>
                                  <Button size="small" onClick={() => setOverriding(false)}>
                                    {t("booking.common.cancel")}
                                  </Button>
                                </Stack>
                              </Stack>
                            ) : (
                              <Box>
                                <Button
                                  size="small"
                                  color="warning"
                                  onClick={() => setOverriding(true)}
                                >
                                  {t("booking.new.overrideOpen")}
                                </Button>
                              </Box>
                            )
                          ) : null}
                        </Stack>
                      )}
                    </AsyncSection>
                  ) : null}
                </Stack>
              </AsyncSection>
            )}
          </Box>

          {/* ── 4. The note ── */}
          <Box
            component="section"
            aria-label={TEXT.note}
            sx={{ opacity: patient ? 1 : 0.5 }}
          >
            <SectionTitle>{TEXT.note}</SectionTitle>
            <TextField
              fullWidth
              multiline
              minRows={2}
              size="small"
              disabled={!patient}
              label={t("booking.detail.note")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              helperText={t("booking.new.noteHelp")}
            />
          </Box>

          {/* A real failure, once the calm cases above have had their turn. */}
          {book.error && !conflict ? (
            <Alert severity="error">{errorText(book.error, t)}</Alert>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={close}>{t("booking.common.cancel")}</Button>
        <Button
          variant="contained"
          disabled={!canBook}
          onClick={() => book.mutate({})}
        >
          {t("booking.new.book")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700, mb: 1 }}>
      {children}
    </Typography>
  );
}

export default NewAppointmentDialog;
