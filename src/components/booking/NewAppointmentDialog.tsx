import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link as MuiLink,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { appointmentsApi } from "../../api/appointments";
import { activitiesApi } from "../../api/activities";
import { calendarsApi } from "../../api/calendars";
import { searchAllPatients, searchRegistry } from "../../api/patientLookup";
import type { Patient } from "../../api/patients";
import { BookingApiError } from "../../api/apiError";
import { isKnownPaperworkReason } from "../../api/bookingContracts";
import { usePermission } from "../../auth/usePermission";
import {
  addDaysToDateOnly,
  formatPragueDateTime,
  toDateOnly,
} from "../../utils/time";
import { AsyncSection } from "./AsyncSection";
import { AvailabilityPicker } from "./AvailabilityPicker";
import { errorText } from "./errorText";

/**
 * Booking an appointment by hand — contract 5.9.
 *
 * This is the only screen in the application that creates an appointment.
 * Until it existed `POST .../appointments` was called by nothing at all: the
 * API client had the function and no caller, so every part of the booking path
 * - the 409 on a taken slot, the override reason, the note, the warnings that
 * come back with a 201 - had only ever been exercised with curl.
 *
 * The order of the steps is not a layout choice. **Searching for the patient
 * is step one and it is mandatory**, because the alternative is a receptionist
 * typing a name into an empty form and creating the second Anna Černá. A
 * duplicate patient is not a cosmetic fault: it splits a medical history in
 * half.
 *
 * Two rules are load-bearing here and easy to break by accident:
 *
 *   - **6.1** - the times offered are exactly what `availability` returned.
 *     Nothing on this screen works out a free slot. A time outside the offer is
 *     reachable only as an override, which **6.4** says must carry a reason
 *     typed by a person and must be available only to a role that may do it.
 *   - **6.3** - after the server confirms, nothing is drawn optimistically. The
 *     grid reloads from `/api/day`. A `409` is somebody else having been
 *     faster, not an error: the offer reloads, the form stays as it was, and
 *     the server's own sentence is shown calmly.
 */

/** 4.5: `source` 0 is the desk. Online is 1, a club is 2; neither books here. */
const SOURCE_STAFF = 0;

/** How far ahead the offer looks. The range endpoint allows 62 days (4.5). */
const OFFER_WINDOW_DAYS = 13;

interface NewAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  /** Whatever list the dialog was opened from reloads itself (6.3). */
  onBooked: () => void;
  /** The day the caller was looking at, so the offer starts there. */
  initialDate?: string;
  /** The calendar the caller was looking at, when there is only one. */
  initialCalendarId?: string;
}

export function NewAppointmentDialog({
  open,
  onClose,
  onBooked,
  initialDate,
  initialCalendarId,
}: NewAppointmentDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mayOverride = usePermission("calendar:force_override");

  /*
   * ── Step 1: the patient, and nothing else until there is one ──
   *
   * Two fields rather than one box, because that is what the registry takes
   * (`firstName`, `lastName`); a single free-text box would have to guess which
   * half of "Jan Novák" is which, and guess wrong on "Anna Marie Černá".
   */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitted, setSubmitted] = useState<{
    firstName: string;
    lastName: string;
  } | null>(null);
  /* v33: the wider search is a second, deliberate step - never the default. */
  const [alsoUnregistered, setAlsoUnregistered] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);

  /* ── Steps 2 to 5 ── */
  const [calendarId, setCalendarId] = useState(initialCalendarId ?? "");
  const [activityId, setActivityId] = useState("");
  const [from, setFrom] = useState(initialDate ?? toDateOnly(new Date()));
  const [startUtc, setStartUtc] = useState<string | null>(null);
  const [note, setNote] = useState("");

  /* 6.4: a time outside the offer, and never without a reason. */
  const [overriding, setOverriding] = useState(false);
  const [overrideLocal, setOverrideLocal] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const [conflict, setConflict] = useState<unknown>(null);
  const [booked, setBooked] = useState<{
    startUtc: string;
    warnings: { code: string; message: string }[];
  } | null>(null);

  const searchQuery = useQuery({
    queryKey: ["patient-registry", submitted?.firstName, submitted?.lastName],
    queryFn: () => searchRegistry(submitted ?? {}),
    enabled: open && submitted !== null,
  });

  /*
   * The same terms against every row, registered or not. Runs only when the
   * operator asks for it, after the registry came back empty.
   */
  const widerQuery = useQuery({
    queryKey: ["patient-all", submitted?.firstName, submitted?.lastName],
    queryFn: () =>
      searchAllPatients(
        [submitted?.lastName, submitted?.firstName].filter(Boolean).join(" "),
      ),
    enabled: open && alsoUnregistered && submitted !== null,
  });

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

  const book = useMutation({
    mutationFn: (input: {
      startUtc: string;
      overrideReason?: string;
    }) =>
      appointmentsApi.create({
        patientId: patient?.id ?? "",
        calendarId,
        activityId,
        startUtc: input.startUtc,
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
        setStartUtc(null);
        void queryClient.invalidateQueries({
          queryKey: ["availability", calendarId, activityId],
        });
      }
      if (error instanceof BookingApiError && error.kind === "notFound") {
        /* 4.5/5.9: the lists from step 2 are older than the server. */
        void queryClient.invalidateQueries({ queryKey: ["calendars"] });
        void queryClient.invalidateQueries({ queryKey: ["activities"] });
      }
    },
  });

  const submit = () => {
    setAlsoUnregistered(false);
    setSubmitted({ firstName, lastName });
  };

  const reset = () => {
    setFirstName("");
    setLastName("");
    setSubmitted(null);
    setAlsoUnregistered(false);
    setPatient(null);
    setActivityId("");
    setStartUtc(null);
    setNote("");
    setOverriding(false);
    setOverrideLocal("");
    setOverrideReason("");
    setConflict(null);
    setBooked(null);
    book.reset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const canBook =
    patient !== null &&
    calendarId !== "" &&
    activityId !== "" &&
    startUtc !== null &&
    !book.isPending;

  const canBookOverride =
    patient !== null &&
    calendarId !== "" &&
    activityId !== "" &&
    overrideLocal !== "" &&
    overrideReason.trim().length > 0 &&
    !book.isPending;

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
          <Button onClick={() => reset()}>{t("booking.new.another")}</Button>
          <Button variant="contained" onClick={close}>
            {t("booking.detail.close")}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>{t("booking.new.title")}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* ── 1. The patient. Mandatory, and first. ── */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              {t("booking.new.step1")}
            </Typography>

            {patient ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Chip
                  label={
                    patient.fullName ??
                    `${patient.lastName} ${patient.firstName}`
                  }
                  onDelete={() => setPatient(null)}
                />
                <Button size="small" onClick={() => setPatient(null)}>
                  {t("booking.new.changePatient")}
                </Button>
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    fullWidth
                    size="small"
                    autoFocus
                    label={t("booking.new.firstName")}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label={t("booking.new.lastName")}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                  />
                  <Button
                    variant="outlined"
                    disabled={
                      firstName.trim().length === 0 &&
                      lastName.trim().length === 0
                    }
                    onClick={submit}
                  >
                    {t("booking.new.search")}
                  </Button>
                </Stack>

                {submitted ? (
                  <AsyncSection
                    isLoading={searchQuery.isLoading}
                    isSettled={searchQuery.isSuccess || searchQuery.isError}
                    error={searchQuery.error}
                    isEmpty={(searchQuery.data ?? []).length === 0}
                    /*
                      5.9 and v33: an empty result must never read as "this
                      person does not exist". It cannot know that. Both searches
                      distinguish diacritics, and the registry does not see
                      records that were never registered - so the sentence says
                      what an empty answer actually means and offers the wider
                      search rather than the "create" button.
                    */
                    emptyText={t("booking.new.notFoundRegistry")}
                    onRetry={() => void searchQuery.refetch()}
                    skeletonRows={2}
                  >
                    <PatientList
                      patients={searchQuery.data ?? []}
                      onPick={setPatient}
                    />
                  </AsyncSection>
                ) : null}

                {/*
                  v33. Offered only once the registry came back empty, and
                  never as the default: a hit here that the registry does not
                  know means "exists but is not registered" - something to put
                  right, not a reason to create a second person.
                */}
                {submitted &&
                searchQuery.isSuccess &&
                (searchQuery.data ?? []).length === 0 ? (
                  <Stack spacing={1}>
                    {!alsoUnregistered ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setAlsoUnregistered(true)}
                      >
                        {t("booking.new.searchWider")}
                      </Button>
                    ) : (
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600, mb: 0.5 }}
                        >
                          {t("booking.new.unregisteredTitle")}
                        </Typography>
                        <AsyncSection
                          isLoading={widerQuery.isLoading}
                          isSettled={widerQuery.isSuccess || widerQuery.isError}
                          error={widerQuery.error}
                          isEmpty={(widerQuery.data ?? []).length === 0}
                          emptyText={t("booking.new.notFoundAnywhere")}
                          onRetry={() => void widerQuery.refetch()}
                          skeletonRows={2}
                        >
                          <Alert severity="warning" sx={{ mb: 1 }}>
                            {t("booking.new.unregisteredWarning")}
                          </Alert>
                          <PatientList
                            patients={widerQuery.data ?? []}
                            onPick={setPatient}
                          />
                        </AsyncSection>
                      </Box>
                    )}

                    <MuiLink component={RouterLink} to="/patients/register">
                      {t("booking.new.registerLink")}
                    </MuiLink>
                  </Stack>
                ) : null}
              </Stack>
            )}
          </Box>

          {/* ── 2. Calendar and activity ── */}
          <Box sx={{ opacity: patient ? 1 : 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              {t("booking.new.step2")}
            </Typography>
            {/*
              Two empty dropdowns and no explanation is a claim the screen
              cannot make: "there are no calendars" and "the list did not load"
              look identical, and the second one is not the operator's problem
              to solve by giving up. Found by `eng/audit-silent-failures.cjs`,
              which is what it is for.
            */}
            <AsyncSection
              isLoading={calendarsQuery.isLoading || activitiesQuery.isLoading}
              isSettled={
                (calendarsQuery.isSuccess || calendarsQuery.isError) &&
                (activitiesQuery.isSuccess || activitiesQuery.isError)
              }
              error={calendarsQuery.error ?? activitiesQuery.error}
              isEmpty={
                calendars.length === 0 || activities.length === 0
              }
              emptyText={
                calendars.length === 0
                  ? t("booking.new.noCalendars")
                  : t("booking.new.noActivities")
              }
              onRetry={() => {
                void calendarsQuery.refetch();
                void activitiesQuery.refetch();
              }}
              skeletonRows={2}
            >
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                fullWidth
                size="small"
                label={t("booking.new.calendar")}
                value={calendarId}
                disabled={!patient}
                onChange={(e) => {
                  setCalendarId(e.target.value);
                  setStartUtc(null);
                }}
              >
                {calendars.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                size="small"
                label={t("booking.new.activity")}
                value={activityId}
                disabled={!patient}
                onChange={(e) => {
                  setActivityId(e.target.value);
                  setStartUtc(null);
                }}
              >
                {activities.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name} · {a.durationMinutes} min
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            </AsyncSection>
          </Box>

          {/* ── 3. The time, and only what the server offered (6.1) ── */}
          {patient && calendarId && activityId ? (
            <Box>
              <Stack
                direction="row"
                spacing={2}
                sx={{ alignItems: "center", mb: 1, flexWrap: "wrap", gap: 1 }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t("booking.new.step3")}
                </Typography>
                <TextField
                  type="date"
                  size="small"
                  label={t("booking.new.fromDate")}
                  value={from}
                  onChange={(e) => e.target.value && setFrom(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ width: 170 }}
                />
              </Stack>

              {conflict ? (
                <Alert
                  severity="info"
                  sx={{ mb: 1 }}
                  onClose={() => setConflict(null)}
                >
                  {errorText(conflict, t)}
                </Alert>
              ) : null}

              {startUtc ? (
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Chip
                    color="primary"
                    label={formatPragueDateTime(startUtc)}
                    onDelete={() => setStartUtc(null)}
                  />
                  <Button size="small" onClick={() => setStartUtc(null)}>
                    {t("booking.new.changeTime")}
                  </Button>
                </Stack>
              ) : (
                <AvailabilityPicker
                  calendarId={calendarId}
                  activityId={activityId}
                  from={from}
                  to={addDaysToDateOnly(from, OFFER_WINDOW_DAYS)}
                  busy={book.isPending}
                  onPick={(picked) => {
                    setConflict(null);
                    setStartUtc(picked);
                    setOverriding(false);
                  }}
                  emptyText={t("booking.new.noFreeTime")}
                />
              )}

              {/*
                6.4. Not an ordinary action: only a role that may override sees
                it at all, it is set apart, and the form will not submit without
                a reason somebody typed.
              */}
              {mayOverride && !startUtc ? (
                <Box sx={{ mt: 2 }}>
                  {overriding ? (
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
                      <TextField
                        type="datetime-local"
                        size="small"
                        label={t("booking.new.overrideTime")}
                        value={overrideLocal}
                        onChange={(e) => setOverrideLocal(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
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
                            book.mutate({
                              startUtc: new Date(overrideLocal).toISOString(),
                              overrideReason: overrideReason.trim(),
                            })
                          }
                        >
                          {t("booking.new.overrideBook")}
                        </Button>
                        <Button
                          size="small"
                          onClick={() => setOverriding(false)}
                        >
                          {t("booking.common.cancel")}
                        </Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Button
                      size="small"
                      color="warning"
                      onClick={() => setOverriding(true)}
                    >
                      {t("booking.new.overrideOpen")}
                    </Button>
                  )}
                </Box>
              ) : null}
            </Box>
          ) : null}

          {/* ── 4. The note ── */}
          <Box sx={{ opacity: patient ? 1 : 0.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              {t("booking.new.step4")}
            </Typography>
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
          onClick={() =>
            startUtc && book.mutate({ startUtc })
          }
        >
          {t("booking.new.book")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * The rows a search came back with. One component for both surfaces, so the
 * registry's answer and the wider one cannot start looking different from each
 * other by accident.
 */
function PatientList({
  patients,
  onPick,
}: {
  patients: Patient[];
  onPick: (p: Patient) => void;
}) {
  return (
    <Stack divider={<Divider />}>
      {patients.slice(0, 12).map((p) => (
        <Box
          key={p.id}
          component="button"
          type="button"
          onClick={() => onPick(p)}
          sx={{
            textAlign: "left",
            border: "none",
            background: "none",
            font: "inherit",
            cursor: "pointer",
            py: 1,
            "&:focus-visible": {
              outline: "3px solid",
              outlineColor: "primary.main",
            },
          }}
        >
          <Typography sx={{ fontWeight: 600 }}>
            {p.fullName || `${p.lastName} ${p.firstName}`.trim() || p.id}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : "—"}
            {p.phone ? ` · ${p.phone}` : ""}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

export default NewAppointmentDialog;
