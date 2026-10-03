import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Dialog,
  FormControlLabel,
  IconButton,
  Link as MuiLink,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import MailOutlineIcon from "@mui/icons-material/EmailOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { appointmentsApi } from "../../api/appointments";
import { patientsApi } from "../../api/patients";
import { activitiesApi } from "../../api/activities";
import { documentsApi } from "../../api/documents";
import { patientPreRegistrationApi } from "../../api/patientPreRegistration";
import { BookingApiError } from "../../api/apiError";
import { linkErrorText } from "./patient/linkErrorText";
import {
  canChangeStatus,
  historyActionName,
  isKnownPaperworkReason,
  isLateStatus,
  isTerminalStatus,
  statusName,
} from "../../api/bookingContracts";
import type { Activity, Appointment, DayAppointment, HistoryLine } from "../../api/bookingContracts";
import {
  addDaysToDateOnly,
  formatDateOnly,
  formatPragueDateTime,
  formatPragueTime,
  isLate,
  pragueDateKey,
} from "../../utils/time";
import { DESIGN, SectionLabel, SoftCard, StatusChip } from "../ui";
import { AsyncSection } from "./AsyncSection";
import { AvailabilityPanel } from "./AvailabilityPicker";
import { errorText } from "./errorText";
import { PortalLinkButton } from "./patient/PortalLinkButton";
import { usePermission } from "../../auth/usePermission";
import { useCompletionLink } from "./quick/useCompletionLink";
import { QuickPendingCard } from "./quick/QuickPendingCard";
import { formatDeadline } from "./quick/quickBooking";
import {
  DockedBar,
  dialogFrameProps,
  useDetailLayout,
  type DetailLayout,
} from "./AppointmentDetail.layout";
import {
  STATUS,
  draftFrom,
  durationMinutes,
  formatCzk,
  formatLongPragueDate,
  formatShortPragueDateTime,
  formatWallClock,
  initials,
  isOfferedStart,
  LEGAL_CONSENTS_TEXT,
  PAPERWORK_STATE_LABEL,
  PAPERWORK_STATE_TONE,
  paperworkRows,
  paperworkSummary,
  paymentView,
  planEdit,
  reachableStatuses,
  sourceLabel,
  statusTone,
  type EditDraft,
  type PaperworkRow,
} from "./appointmentEdit";

/**
 * One appointment, opened from the grid — contract 5.8, drawn as the board's
 * screens 12 (detail) and 13 (edit).
 *
 * It reads `GET .../appointments/{id}` rather than the row the grid already
 * holds. That endpoint did not exist when this screen was first built; the
 * booking lane added it in v26 after this lane reported that 5.8 could not be
 * satisfied without it. Reading it means a link to an appointment has something
 * to live on, and a change made in another window shows up here instead of a
 * stale copy of a row.
 *
 * Readiness of the paperwork is here as of v29, after change 43 - which had
 * removed it - was itself reversed; the values went live in v32. It is drawn
 * only when there is an answer: `null` means the register does not know this
 * patient, and that is shown as nothing at all. "Nobody could look" and
 * "something is missing" are different claims, and the whole reason the field
 * was held back for so long was that it used to make the second one about
 * people who had handed everything in.
 *
 * Everything the screen writes goes through the transition table in
 * `canChangeStatus`, so a button the server would refuse is never offered. And
 * 4.5 gives an undo to arrival and absence and to nothing else, so cancelling
 * and completing ask before they act rather than promising a way back.
 *
 * The edit mode (screen 13) is the same three writes the detail always had -
 * `/time`, `/status`, cancel - behind one form. There is no endpoint to change
 * an appointment's činnost, its length or its note, so those fields are shown
 * as they are and say so rather than pretending.
 */

/** How far ahead a move looks for free time. The API allows 62 days (4.5). */
const RESCHEDULE_WINDOW_DAYS = 13;

interface AppointmentDetailProps {
  appointmentId: string;
  /** 4.5: the calendar is in the path. Without it there is nothing to read. */
  calendarId: string;
  calendar?: { id: string; name: string; color: string };
  open: boolean;
  onClose: () => void;
  /** The grid reloads itself when anything here changed the appointment. */
  onChanged: () => void;
}

export function AppointmentDetail({
  appointmentId,
  calendarId,
  calendar,
  open,
  onClose,
  onChanged,
}: AppointmentDetailProps) {
  const detailQuery = useQuery({
    queryKey: ["appointment", calendarId, appointmentId],
    queryFn: () => appointmentsApi.get(calendarId, appointmentId),
    enabled: open,
  });

  /* The činnost's price and length, from the one cached activities list, so
     the desk sees what the appointment costs without leaving this dialog. */
  const activitiesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesApi.list(),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const layout = useDetailLayout();

  return (
    <Dialog open={open} onClose={onClose} {...dialogFrameProps(layout)}>
      {detailQuery.data ? (
        <DetailBody
          layout={layout}
          appointment={detailQuery.data}
          activities={activitiesQuery.data?.activities ?? []}
          calendarId={calendarId}
          calendarName={calendar?.name}
          onChanged={onChanged}
          onClose={onClose}
        />
      ) : (
        <>
          <Box sx={{ p: 3 }}>
            <AsyncSection
              isLoading={detailQuery.isLoading}
              isSettled={detailQuery.isSuccess || detailQuery.isError}
              error={detailQuery.error}
              isEmpty={false}
              emptyText=""
              onRetry={() => void detailQuery.refetch()}
              skeletonRows={5}
            >
              {null}
            </AsyncSection>
          </Box>
          <Footer>
            <Box />
            <Button variant="outlined" onClick={onClose}>
              Zavřít
            </Button>
          </Footer>
        </>
      )}
    </Dialog>
  );
}

/* ── Layout pieces shared by both modes ── */

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        px: 3,
        py: 2,
        flexShrink: 0,
        borderTop: "1px solid",
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      {children}
    </Stack>
  );
}

function DetailBody({
  layout,
  appointment,
  activities,
  calendarId,
  calendarName,
  onChanged,
  onClose,
}: {
  layout: DetailLayout;
  appointment: Appointment;
  activities: Activity[];
  calendarId: string;
  calendarName?: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mayEdit = usePermission("bookings.edit");
  const mayCancel = usePermission("bookings.cancel");

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [moving, setMoving] = useState(false);
  /* On a phone the move panel opens in the scrolling body while the button that
     opened it is docked below; bring the panel into view so it is not hidden. */
  const movePanelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (moving && layout === "full-screen") {
      movePanelRef.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [moving, layout]);
  /**
   * A `409` is not an error (6.3): somebody was faster, or the appointment moved
   * on without us. It gets its own calm line rather than the red box, and it
   * carries the server's own sentence - since v23 that status has two meanings
   * and a fixed one here would tell half the readers the wrong thing.
   */
  const [conflict, setConflict] = useState<unknown>(null);

  const hasPatient = appointment.patientId !== "";

  const patientQuery = useQuery({
    queryKey: ["patient", appointment.patientId],
    queryFn: () => patientsApi.getById(appointment.patientId),
    enabled: hasPatient,
  });
  /* The list entry above has no contacts; phone and e-mail live on the
     patient's profile, which is what the booking dialog fills the card
     from. Read the same source, or the desk sees "telefon neuveden" for a
     patient whose number is on file. */
  const profileQuery = useQuery({
    queryKey: ["patient-profile", appointment.patientId],
    queryFn: () => patientsApi.getProfile(appointment.patientId),
    enabled: hasPatient,
  });
  const phone: string | undefined =
    profileQuery.data?.phone ?? patientQuery.data?.phone ?? appointment.unregisteredPhone ?? undefined;
  const email: string | undefined = profileQuery.data?.email ?? patientQuery.data?.email;
  const patientName = hasPatient
    ? patientQuery.data
      ? (patientQuery.data.fullName ??
        `${patientQuery.data.firstName} ${patientQuery.data.lastName}`)
      : null
    : (appointment.unregisteredName ?? null);

  const historyQuery = useQuery({
    queryKey: ["appointment-history", calendarId, appointment.id],
    queryFn: () => appointmentsApi.history(calendarId, appointment.id),
  });

  /* The grid's row for this appointment: partner, discount and payment (G3). */
  const appointmentDay = pragueDateKey(appointment.startUtc);
  const dayRowQuery = useQuery({
    queryKey: ["appointment-day-row", calendarId, appointment.id, appointmentDay],
    queryFn: async () => {
      const rows = await appointmentsApi.range(appointmentDay, appointmentDay, [calendarId]);
      return rows.find((r) => r.id === appointment.id) ?? null;
    },
  });

  /* Etapa 2, C2: a desk quick registration whose deadline is still running. The
     detail answers it; the day row (which the grid carries) is the fallback. */
  const registrationDeadlineUtc =
    appointment.registrationDeadlineUtc ?? dayRowQuery.data?.registrationDeadlineUtc ?? null;
  const quickPending =
    (appointment.quickRegistrationPending ?? dayRowQuery.data?.quickRegistrationPending ?? false) === true;

  const activity = activities.find((a) => a.id === appointment.activityId) ?? null;
  const price = activity?.priceCzk ?? null;
  const minutes = durationMinutes(appointment.startUtc, appointment.endUtc);

  const late = isLate(appointment.startUtc, isLateStatus(appointment.status), new Date());
  const name = statusName(appointment.status);
  const statusLabel = name ? t(`booking.status.${name}`) : t("booking.status.unknown");

  const afterWrite = () => {
    setConflict(null);
    setCancelling(false);
    setCancelReason("");
    setMoving(false);
    void queryClient.invalidateQueries({
      queryKey: ["appointment", calendarId, appointment.id],
    });
    void queryClient.invalidateQueries({
      queryKey: ["appointment-history", calendarId, appointment.id],
    });
    onChanged();
  };

  /** 6.3: reload and show, do not shout. Anything else is a real failure. */
  const onWriteError = (error: unknown) => {
    if (error instanceof BookingApiError && error.isConflict) {
      setConflict(error);
      void queryClient.invalidateQueries({
        queryKey: ["appointment", calendarId, appointment.id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["availability", calendarId, appointment.activityId],
      });
      onChanged();
    }
  };

  const statusMutation = useMutation({
    mutationFn: ({ to, reason }: { to: number; reason?: string }) =>
      appointmentsApi.setStatus(calendarId, appointment.id, String(to), reason),
    onSuccess: afterWrite,
    onError: onWriteError,
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => appointmentsApi.cancel(calendarId, appointment.id, reason),
    onSuccess: () => {
      afterWrite();
      onClose();
    },
    onError: onWriteError,
  });

  const rescheduleMutation = useMutation({
    mutationFn: (startUtc: string) =>
      appointmentsApi.reschedule(calendarId, appointment.id, startUtc),
    onSuccess: afterWrite,
    onError: onWriteError,
  });

  /**
   * "Uložit změny": the time and the status are two calls on the server, made
   * in that order so a move that is refused leaves the status as it was.
   */
  const saveMutation = useMutation({
    mutationFn: async (plan: { startUtc: string | null; status: number | null }) => {
      if (plan.startUtc) {
        await appointmentsApi.reschedule(calendarId, appointment.id, plan.startUtc);
      }
      if (plan.status !== null) {
        await appointmentsApi.setStatus(calendarId, appointment.id, String(plan.status));
      }
    },
    onSuccess: () => {
      afterWrite();
      setMode("view");
    },
    onError: onWriteError,
  });

  const busy =
    statusMutation.isPending ||
    cancelMutation.isPending ||
    rescheduleMutation.isPending ||
    saveMutation.isPending;

  const terminal = isTerminalStatus(appointment.status);

  const cancelBox =
    cancelling && mayCancel ? (
      <Box
        sx={{
          border: "1px solid",
          borderColor: DESIGN.tone.red.line,
          bgcolor: DESIGN.tone.red.bg,
          borderRadius: 2.5,
          p: 2,
        }}
      >
        <Typography variant="body2" sx={{ mb: 1, color: DESIGN.tone.red.fg }}>
          {t("booking.detail.cancelIsFinal")}
        </Typography>
        <TextField
          fullWidth
          size="small"
          autoFocus
          label={t("booking.detail.reason")}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
        {cancelMutation.error && !conflict ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {errorText(cancelMutation.error, t)}
          </Alert>
        ) : null}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button
            size="small"
            color="error"
            variant="contained"
            disabled={cancelReason.trim().length === 0 || busy}
            onClick={() => cancelMutation.mutate(cancelReason.trim())}
          >
            {t("booking.detail.cancelConfirm")}
          </Button>
          <Button size="small" variant="outlined" onClick={() => setCancelling(false)}>
            {t("booking.detail.keep")}
          </Button>
        </Stack>
      </Box>
    ) : null;

  if (mode === "edit") {
    return (
      <EditMode
        layout={layout}
        appointment={appointment}
        activities={activities}
        activity={activity}
        calendarId={calendarId}
        patientName={patientName}
        note={appointment.note}
        busy={busy}
        conflict={conflict}
        error={saveMutation.error}
        mayCancel={mayCancel}
        onBack={() => {
          setConflict(null);
          setMode("view");
        }}
        onClose={onClose}
        onSave={(plan) => saveMutation.mutate(plan)}
        onCancelRequest={() => {
          setMode("view");
          setCancelling(true);
        }}
      />
    );
  }

  const compact = layout === "full-screen";

  /* Arrival, the slot, cancelling - in the rail on the right, or docked at the bottom of a phone. */
  const railActions = (
    <>
          {!mayEdit && !mayCancel ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t("booking.detail.noActionsAllowed")}
            </Typography>
          ) : null}

          {/* Arrival, finishing and moving are bookings.edit on the server,
              cancelling is bookings.cancel; what the account lacks is not
              offered, rather than offered and then refused. */}
          {mayEdit ? (
            <>
              <Box>
                <SectionLabel>Příchod</SectionLabel>
                <Stack spacing={1}>
                  <StatusButton
                    label={t("booking.detail.arrived")}
                    to={STATUS.checkedIn}
                    from={appointment.status}
                    disabled={busy}
                    variant="contained"
                    onClick={() => statusMutation.mutate({ to: STATUS.checkedIn })}
                  />
                  <StatusButton
                    label={t("booking.detail.noShow")}
                    to={STATUS.noShow}
                    from={appointment.status}
                    disabled={busy}
                    /*
                     * `2 -> 5` is allowed on purpose — it is how a mis-click gets
                     * corrected — but marking a patient who is standing at the desk
                     * as absent deserves a question first (4.5, v23).
                     */
                    confirmText={
                      appointment.status === STATUS.checkedIn
                        ? t("booking.detail.confirmNoShow")
                        : undefined
                    }
                    onClick={() => statusMutation.mutate({ to: STATUS.noShow })}
                  />
                  {canChangeStatus(appointment.status, STATUS.completed) ? (
                    <StatusButton
                      label={t("booking.detail.complete")}
                      to={STATUS.completed}
                      from={appointment.status}
                      disabled={busy}
                      confirmText={t("booking.detail.confirmComplete")}
                      onClick={() => statusMutation.mutate({ to: STATUS.completed })}
                    />
                  ) : null}
                  {canChangeStatus(appointment.status, STATUS.scheduled) ? (
                    <StatusButton
                      label={t("booking.detail.undo")}
                      to={STATUS.scheduled}
                      from={appointment.status}
                      disabled={busy}
                      onClick={() => statusMutation.mutate({ to: STATUS.scheduled })}
                    />
                  ) : null}
                </Stack>
              </Box>

              <Box>
                <SectionLabel>Termín</SectionLabel>
                <Stack spacing={1}>
                  {/*
                    A completed or cancelled appointment cannot be moved - the server
                    answers `409`, which is right, but offering the button and then
                    refusing it wastes somebody's click and teaches them nothing.
                  */}
                  <Tooltip title={terminal ? t("booking.detail.notAllowed") : ""}>
                    <Box component="span" sx={{ display: "block" }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        disabled={busy || terminal}
                        sx={{ minHeight: 44 }}
                        onClick={() => {
                          setConflict(null);
                          setMoving(false);
                          setMode("edit");
                        }}
                      >
                        Upravit
                      </Button>
                    </Box>
                  </Tooltip>
                  <Tooltip title={terminal ? t("booking.detail.notAllowed") : ""}>
                    <Box component="span" sx={{ display: "block" }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        disabled={busy || terminal}
                        sx={{ minHeight: 44 }}
                        onClick={() => {
                          setConflict(null);
                          setMoving((was) => !was);
                        }}
                      >
                        {t("booking.detail.move")}
                      </Button>
                    </Box>
                  </Tooltip>
                </Stack>
              </Box>
            </>
          ) : null}

          {mayCancel ? (
            <Stack spacing={1.5} sx={{ pt: mayEdit ? 1 : 0 }}>
              <Button
                fullWidth
                color="error"
                variant="outlined"
                disabled={busy || !canChangeStatus(appointment.status, STATUS.cancelled)}
                onClick={() => setCancelling((was) => !was)}
                sx={{ minHeight: 44 }}
              >
                {t("booking.detail.cancel")}
              </Button>
              {/* ── Cancelling, which 5.8 makes conditional on a reason ── */}
              {cancelBox}
            </Stack>
          ) : null}
    </>
  );

  /*
   * The same actions for a phone, docked under the scrolling body: arrival on
   * the first row, the slot on the second, cancelling on its own full row - each
   * at least 48 px tall. What the account may not do is not offered, as in the rail.
   */
  const dockButton = { minHeight: 48, fontSize: 14 } as const;
  const dockActions = (
    <>
      {!mayEdit && !mayCancel ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {t("booking.detail.noActionsAllowed")}
        </Typography>
      ) : null}
      {mayCancel ? cancelBox : null}
      {mayEdit ? (
        <>
          <Stack direction="row" spacing={1}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <StatusButton
                minHeight={48}
                label={t("booking.detail.arrived")}
                to={STATUS.checkedIn}
                from={appointment.status}
                disabled={busy}
                variant="contained"
                onClick={() => statusMutation.mutate({ to: STATUS.checkedIn })}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <StatusButton
                minHeight={48}
                label={t("booking.detail.noShow")}
                to={STATUS.noShow}
                from={appointment.status}
                disabled={busy}
                confirmText={
                  appointment.status === STATUS.checkedIn ? t("booking.detail.confirmNoShow") : undefined
                }
                onClick={() => statusMutation.mutate({ to: STATUS.noShow })}
              />
            </Box>
          </Stack>
          {canChangeStatus(appointment.status, STATUS.completed) ||
          canChangeStatus(appointment.status, STATUS.scheduled) ? (
            <Stack direction="row" spacing={1}>
              {canChangeStatus(appointment.status, STATUS.completed) ? (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <StatusButton
                minHeight={48}
                    label={t("booking.detail.complete")}
                    to={STATUS.completed}
                    from={appointment.status}
                    disabled={busy}
                    confirmText={t("booking.detail.confirmComplete")}
                    onClick={() => statusMutation.mutate({ to: STATUS.completed })}
                  />
                </Box>
              ) : null}
              {canChangeStatus(appointment.status, STATUS.scheduled) ? (
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <StatusButton
                minHeight={48}
                    label={t("booking.detail.undo")}
                    to={STATUS.scheduled}
                    from={appointment.status}
                    disabled={busy}
                    onClick={() => statusMutation.mutate({ to: STATUS.scheduled })}
                  />
                </Box>
              ) : null}
            </Stack>
          ) : null}
          <Stack direction="row" spacing={1}>
            <Button
              fullWidth
              variant="outlined"
              disabled={busy || terminal}
              onClick={() => {
                setConflict(null);
                setMoving(false);
                setMode("edit");
              }}
              sx={dockButton}
            >
              Upravit
            </Button>
            <Button
              fullWidth
              variant="outlined"
              disabled={busy || terminal}
              onClick={() => {
                setConflict(null);
                setMoving((was) => !was);
              }}
              sx={dockButton}
            >
              {t("booking.detail.move")}
            </Button>
          </Stack>
        </>
      ) : null}
      {mayCancel ? (
        <Button
          fullWidth
          color="error"
          variant="outlined"
          disabled={busy || !canChangeStatus(appointment.status, STATUS.cancelled)}
          onClick={() => setCancelling((was) => !was)}
          sx={dockButton}
        >
          {t("booking.detail.cancel")}
        </Button>
      ) : null}
    </>
  );

  const historyBlock = (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <SectionLabel sx={{ mb: 0.75 }}>{t("booking.detail.history")}</SectionLabel>
      <AsyncSection
        isLoading={historyQuery.isLoading}
        error={historyQuery.error}
        isSettled={historyQuery.isSuccess || historyQuery.isError}
        isEmpty={(historyQuery.data ?? []).length === 0}
        emptyText={t("booking.detail.historyEmpty")}
        onRetry={() => void historyQuery.refetch()}
        skeletonRows={2}
      >
        <Stack component="ul" spacing={0.5} sx={{ listStyle: "none", p: 0, m: 0 }}>
          {[...(historyQuery.data ?? [])]
            .sort((a, b) => new Date(b.atUtc).getTime() - new Date(a.atUtc).getTime())
            .map((line, index) => (
              <HistoryRow key={`${line.atUtc}-${index}`} line={line} />
            ))}
        </Stack>
      </AsyncSection>
    </Box>
  );

  const leftColumn = (
        <Stack spacing={2.5} sx={{ flex: 1, minWidth: 0, p: compact ? 2 : 3 }}>
          {/*
            The owner's rule (3. 10. 2026): a patient in the system sees, at the
            top, every protocol this visit requires and where each one stands.
            A slot with no register entry has nothing to track.
          */}
          {hasPatient ? (
            <PaperworkSection
              appointment={appointment}
              activity={activity}
              patientId={appointment.patientId}
            />
          ) : null}

          {/*
            4.5, v29; live since v32. Rendered only when there is an answer - see
            `paperworkSchema`. When the register does not know the patient this
            whole block is absent rather than reassuring.
          */}
          {quickPending && hasPatient ? (
            <QuickPendingCard
              patientId={appointment.patientId}
              email={email}
              deadlineUtc={registrationDeadlineUtc}
            />
          ) : appointment.paperwork && !appointment.paperwork.ready ? (
            <RegistrationWarning
              patientId={appointment.patientId}
              email={email}
              reasons={appointment.paperwork.missing.map((code) =>
                isKnownPaperworkReason(code)
                  ? t(`booking.paperwork.${code}`)
                  : /* An unknown reason is shown as unknown, never dropped. */
                    t("booking.paperwork.unknown", { code }),
              )}
            />
          ) : null}

          {/* 6.4: an override was made by a person, for a reason they typed. */}
          {appointment.overrideReason ? (
            <Alert severity="warning">
              {t("booking.detail.overridden")}: {appointment.overrideReason}
            </Alert>
          ) : null}

          {/* ── Patient and contact (5.8) ── */}
          <SoftCard sx={{ p: 2 }}>
            {hasPatient && patientQuery.isLoading ? (
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }} aria-busy="true">
                <Skeleton variant="circular" width={44} height={44} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="40%" />
                  <Skeleton width="60%" />
                </Box>
              </Stack>
            ) : hasPatient && patientQuery.isError ? (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={() => void patientQuery.refetch()}>
                    {t("booking.common.retry")}
                  </Button>
                }
              >
                {t("booking.detail.patientMissing")}
              </Alert>
            ) : (
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Avatar sx={{ width: 44, height: 44, fontSize: 15 }}>{initials(patientName)}</Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {hasPatient ? (
                    <MuiLink
                      component={RouterLink}
                      to={`/patients/${appointment.patientId}`}
                      underline="hover"
                      sx={{ fontWeight: 700, fontSize: 16, color: "text.primary" }}
                    >
                      {patientName ?? t("booking.detail.patient")}
                    </MuiLink>
                  ) : (
                    <Typography sx={{ fontWeight: 700, fontSize: 16 }}>
                      {patientName ?? "Bez pacienta"}
                    </Typography>
                  )}
                  <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
                    {phone || t("booking.detail.noPhone")}
                    {" · "}
                    {email || t("booking.detail.noEmail")}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <ContactButton label="Zavolat" href={phone ? `tel:${phone}` : undefined}>
                    <PhoneOutlinedIcon fontSize="small" />
                  </ContactButton>
                  <ContactButton label="Napsat e-mail" href={email ? `mailto:${email}` : undefined}>
                    <MailOutlineIcon fontSize="small" />
                  </ContactButton>
                  <ContactButton
                    label="Otevřít kartu pacienta"
                    to={hasPatient ? `/patients/${appointment.patientId}` : undefined}
                  >
                    <OpenInNewIcon fontSize="small" />
                  </ContactButton>
                </Stack>
              </Stack>
            )}
          </SoftCard>

          {/* ── CENA · PLATBA · ZDROJ ── */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 2 }}>
            <Fact label="Cena" value={price != null ? formatCzk(price) : "—"} />
            {/*
              G3 (3. 10. 2026): the day row carries `paymentState` and `invoiceId`;
              the single-appointment view does not, so the row is read from the
              one-day range of this calendar - one bounded request.
            */}
            <PaymentFact
              row={dayRowQuery.data ?? null}
              pending={dayRowQuery.isPending}
              failed={dayRowQuery.isError}
              appointment={appointment}
              hasPatient={hasPatient}
            />
            <Fact label="Zdroj" value={sourceLabel(appointment.source)} />
          </Box>

          {/* ── The desk's note (5.8, v26) - written at booking, read here ── */}
          <Box>
            <SectionLabel>Poznámka</SectionLabel>
            <TextField
              fullWidth
              multiline
              minRows={2}
              value={appointment.note ?? ""}
              placeholder={t("booking.detail.noNote")}
              slotProps={{ input: { readOnly: true } }}
            />
          </Box>

          {conflict ? (
            /* 6.3: calm, no red, and the form stays exactly as it was. */
            <Alert severity="info" onClose={() => setConflict(null)}>
              {errorText(conflict, t)}
            </Alert>
          ) : null}

          {statusMutation.error && !conflict ? (
            <Alert severity="error">{errorText(statusMutation.error, t)}</Alert>
          ) : null}

          {/* ── Moving, which only ever offers what the server offered (6.1) ── */}
          {moving ? (
            <Box ref={movePanelRef}>
            <AvailabilityPanel
              title={t("booking.detail.moveTo")}
              calendarId={calendarId}
              activityId={appointment.activityId}
              from={pragueDateKey(appointment.startUtc)}
              to={addDaysToDateOnly(pragueDateKey(appointment.startUtc), RESCHEDULE_WINDOW_DAYS)}
              excludeStartUtc={appointment.startUtc}
              busy={busy}
              onPick={(startUtc) => rescheduleMutation.mutate(startUtc)}
              emptyText={t("booking.detail.noFreeTime")}
              /*
                A conflict already has its own calm line above (6.3); passing it
                down as well printed the server's sentence twice. Only a real
                failure belongs inside the panel.
              */
              error={conflict ? null : rescheduleMutation.error}
            />
            </Box>
          ) : null}

          {/* The patient's personal portal link, issuable straight from the booking. */}
          {hasPatient ? (
            <Box>
              <SectionLabel>Portál pacienta</SectionLabel>
              <PortalLinkButton patientId={appointment.patientId} />
            </Box>
          ) : null}
        </Stack>
  );

  return (
    <>
      {/* ── Header: the 3px accent edge, the time, the day, the činnost ── */}
      <Stack
        direction={compact ? "column" : "row"}
        sx={{
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          px: compact ? 2 : 3,
          pt: 2.5,
          pb: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          position: "relative",
          flexShrink: 0,
        }}
      >
        {/* On a phone the close button stands in the corner and the chips run under the title. */}
        {compact ? (
          <IconButton
            aria-label="Zavřít"
            onClick={onClose}
            sx={{ position: "absolute", top: 8, right: 8, width: 44, height: 44 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        ) : null}
        <Box sx={{ borderLeft: "3px solid", borderColor: "primary.main", pl: 2, minWidth: 0, pr: compact ? 5 : 0 }}>
          <Typography
            component="h2"
            sx={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2 }}
          >
            {formatPragueTime(appointment.startUtc)} — {formatPragueTime(appointment.endUtc)}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            {formatLongPragueDate(appointment.startUtc)} · {minutes} minut
          </Typography>
          <Typography sx={{ fontWeight: 600, fontSize: 15, mt: 0.5 }}>
            {/* Empty when the activity is gone (4.5) - say so, do not print nothing. */}
            {appointment.activityName || t("booking.detail.noActivity")}
            {calendarName ? (
              <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                {" "}
                · {calendarName}
              </Box>
            ) : null}
          </Typography>
        </Box>

        <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap", justifyContent: compact ? "flex-start" : "flex-end" }}>
          {/* Status in words, never colour alone (7.1). */}
          <StatusChip tone={statusTone(appointment.status)} dot>
            {statusLabel}
          </StatusChip>
          {late ? <StatusChip tone="beige">{t("booking.status.late")}</StatusChip> : null}
          {/*
            4.5, v27: completing an appointment now keeps this. Until then the
            transition wiped it, so "přišel v 9:12" stopped being true the moment
            the visit ended.
          */}
          {appointment.checkedInUtc ? (
            <StatusChip tone="grey">
              {t("booking.detail.checkedInAt")} {formatPragueTime(appointment.checkedInUtc)}
            </StatusChip>
          ) : null}
          {appointment.heldUntilUtc ? (
            <StatusChip tone="blue">
              {t("booking.detail.heldUntil")} {formatPragueTime(appointment.heldUntilUtc)}
            </StatusChip>
          ) : null}
          {appointment.paperwork?.ready ? (
            <StatusChip tone="green">Podklady v pořádku</StatusChip>
          ) : null}
          {compact ? null : (
            <IconButton aria-label="Zavřít" onClick={onClose} sx={{ ml: 0.5, width: 44, height: 44 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      </Stack>

      {/* The body scrolls; the header above and the actions below stay where they are. */}
      <Box sx={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
        <Box sx={{ display: "flex", flexDirection: compact ? "column" : "row" }}>
          {leftColumn}

          {/* ── Right rail: arrival, the slot, cancelling ── */}
          {compact ? null : (
            <Stack
              spacing={2.5}
              sx={{
                width: layout === "dialog-centered" ? 260 : 300,
                flexShrink: 0,
                p: 3,
                borderLeft: "1px solid",
                borderColor: "divider",
                bgcolor: "background.default",
              }}
            >
              {railActions}
            </Stack>
          )}
        </Box>
        {compact ? <Box sx={{ px: 2, pb: 2.5 }}>{historyBlock}</Box> : null}
      </Box>

      {compact ? (
        <DockedBar label="Akce s rezervací">{dockActions}</DockedBar>
      ) : (
        <Footer>
          {historyBlock}
          <Button variant="outlined" onClick={onClose} sx={{ flexShrink: 0 }}>
            {t("booking.detail.close")}
          </Button>
        </Footer>
      )}
    </>
  );
}


/**
 * PLATBA, from the day row: Bez dokladu / Nezaplaceno / Částečně zaplaceno /
 * Zaplaceno, with the one step that follows - open the invoice there is, or
 * issue one. Both land on Fakturace with what it needs in `location.state`.
 */
function PaymentFact({
  row,
  pending,
  failed,
  appointment,
  hasPatient,
}: {
  row: DayAppointment | null;
  pending: boolean;
  failed: boolean;
  appointment: Appointment;
  hasPatient: boolean;
}) {
  const navigate = useNavigate();
  const view = paymentView(row?.paymentState ?? null);
  const invoiceId = row?.invoiceId ?? null;
  return (
    <Box>
      <SectionLabel sx={{ mb: 0.25 }}>Platba</SectionLabel>
      {pending ? (
        <Skeleton width={96} height={22} />
      ) : failed || row === null ? (
        <Typography sx={{ fontWeight: 600, fontSize: 15, color: "text.secondary" }}>—</Typography>
      ) : (
        <Stack sx={{ alignItems: "flex-start", gap: 0.5 }}>
          <StatusChip tone={view.tone}>{view.label}</StatusChip>
          {invoiceId ? (
            <Button
              size="small"
              variant="text"
              sx={{ px: 0.5, minWidth: 0 }}
              onClick={() => navigate("/billing", { state: { invoiceId } })}
            >
              Otevřít doklad
            </Button>
          ) : hasPatient ? (
            <Button
              size="small"
              variant="text"
              sx={{ px: 0.5, minWidth: 0 }}
              onClick={() =>
                navigate("/billing", {
                  state: {
                    patientId: appointment.patientId,
                    appointmentId: appointment.id,
                    activityId: appointment.activityId,
                  },
                })
              }
            >
              Vystavit doklad
            </Button>
          ) : null}
        </Stack>
      )}
    </Box>
  );
}

/** A label in small caps over a value - CENA, PLATBA, ZDROJ. */
function Fact({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <Box>
      <SectionLabel sx={{ mb: 0.25 }}>{label}</SectionLabel>
      <Typography sx={{ fontWeight: 600, fontSize: 15, color: muted ? "text.secondary" : "text.primary" }}>
        {value}
      </Typography>
    </Box>
  );
}

/** The square icon buttons on the patient card: phone, mail, open. */
function ContactButton({
  label,
  href,
  to,
  children,
}: {
  label: string;
  href?: string;
  to?: string;
  children: React.ReactNode;
}) {
  const sx = {
    width: 44,
    height: 44,
    border: "1px solid",
    borderColor: "divider",
    borderRadius: 2,
    bgcolor: "background.paper",
    color: "text.primary",
  } as const;
  const disabled = !href && !to;
  const button = to ? (
    <IconButton aria-label={label} component={RouterLink} to={to} sx={sx}>
      {children}
    </IconButton>
  ) : href ? (
    <IconButton aria-label={label} href={href} sx={sx}>
      {children}
    </IconButton>
  ) : (
    <IconButton aria-label={label} disabled sx={sx}>
      {children}
    </IconButton>
  );
  return disabled ? (
    button
  ) : (
    <Tooltip title={label}>{button}</Tooltip>
  );
}

/**
 * The beige card: registration is unfinished. "Zkopírovat odkaz" issues the
 * patient's completion link and puts it on the clipboard; "Poslat
 * znovu" issues it and opens the desk's own mail client with it, because
 * nothing here sends mail by itself yet.
 */
function RegistrationWarning({
  patientId,
  email,
  reasons,
}: {
  patientId: string;
  email?: string;
  reasons: string[];
}) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* When the issued link stops working: the server's answer, never a number written here. */
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const issue = useMutation({
    mutationFn: async () => {
      const issued = await patientPreRegistrationApi.issueLink(patientId);
      setExpiresAt(issued.expiresAtUtc ?? null);
      return issued.url ?? `${window.location.origin}${issued.path}`;
    },
    onSuccess: (full) => setLink(full),
  });

  const copyLink = async () => {
    const full = link ?? (await issue.mutateAsync().catch(() => null));
    if (!full) return;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the address is on screen to copy by hand */
    }
  };

  const sendAgain = async () => {
    const full = link ?? (await issue.mutateAsync().catch(() => null));
    if (!full || !email) return;
    const subject = encodeURIComponent("Dokončení registrace");
    const body = encodeURIComponent(
      `Dobrý den,\n\ndokončete prosím registraci na tomto odkazu:\n${full}${
        expiresAt ? `\n\nOdkaz platí do ${formatDeadline(expiresAt)}.` : ""
      }`,
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_self");
  };

  const canSend = Boolean(email) && patientId !== "";

  return (
    <Box
      sx={{
        bgcolor: DESIGN.tone.beige.bg,
        border: "1px solid",
        borderColor: DESIGN.tone.beige.line,
        borderRadius: 3,
        p: 2,
        color: DESIGN.tone.beige.fg,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <WarningAmberIcon fontSize="small" sx={{ mt: 0.25 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Registrace není dokončena</Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            {reasons.length === 1 && reasons[0] === "Chybí dotazník"
              ? "Pacient zatím nevyplnil vstupní dotazník."
              : reasons.join(" · ")}
          </Typography>
          {patientId !== "" ? (
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                disabled={issue.isPending}
                onClick={() => void copyLink()}
                sx={{
                  bgcolor: DESIGN.tone.beige.fg,
                  color: "#FFFFFF",
                  "&:hover": { bgcolor: DESIGN.tone.beige.fg },
                }}
              >
                {copied ? "Zkopírováno" : "Zkopírovat odkaz na registraci"}
              </Button>
              <Tooltip title={canSend ? "" : "Pacient nemá uvedený e-mail."}>
                <Box component="span">
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={issue.isPending || !canSend}
                    onClick={() => void sendAgain()}
                    sx={{
                      color: DESIGN.tone.beige.fg,
                      borderColor: DESIGN.tone.beige.line,
                      bgcolor: "transparent",
                    }}
                  >
                    Poslat znovu
                  </Button>
                </Box>
              </Tooltip>
            </Stack>
          ) : null}
          {link ? (
            <Box
              sx={{
                mt: 1.5,
                fontFamily: "monospace",
                fontSize: 12,
                wordBreak: "break-all",
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: DESIGN.tone.beige.line,
                borderRadius: 2,
                px: 1.25,
                py: 0.75,
                color: "text.primary",
              }}
            >
              {link}
            </Box>
          ) : null}
          {link ? (
            <Typography variant="caption" sx={{ display: "block", mt: 0.75 }}>
              {expiresAt ? `Platí do ${formatDeadline(expiresAt)}. ` : ""}
              Vygenerování nového odkazu ten předchozí zneplatní.
            </Typography>
          ) : null}
          {issue.isError ? (
            <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: DESIGN.tone.red.fg }}>
              {linkErrorText(issue.error)}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Box>
  );
}

/**
 * PODKLADY K TÉTO PROHLÍDCE - every requirement of this činnost/service with a
 * state pill each. What is required comes from the server three ways (see
 * `paperworkRows`); this component only fetches the document check, words the
 * rows and offers the one action that exists today for a missing one.
 */
function PaperworkSection({
  appointment,
  activity,
  patientId,
}: {
  appointment: Appointment;
  activity: Activity | null;
  patientId: string;
}) {
  const mayManageRules = usePermission("settings.clinic.manage");

  /* One read for the patient, filtered to this appointment: the same call the
     patient card makes, so the two never disagree. */
  const checkQuery = useQuery({
    queryKey: ["patient-document-check", patientId],
    queryFn: () => documentsApi.checkRequired(patientId),
    staleTime: 60 * 1000,
  });
  const documents = checkQuery.data
    ? checkQuery.data.requirements.filter((r) => r.appointmentId === appointment.id)
    : null;

  const rows = paperworkRows({
    paperwork: appointment.paperwork,
    questionnaireRequirement: activity?.questionnaireRequirement ?? null,
    documents,
    formatDate: (iso) => formatDateOnly(iso.slice(0, 10)),
  }).map((row) =>
    /* While the check is still on its way, say so instead of "could not". */
    row.key === "documents" && row.state === "unknown" && checkQuery.isPending
      ? { ...row, detail: "ověřuji…" }
      : row,
  );
  const summary = paperworkSummary(rows);

  return (
    <SoftCard sx={{ p: 2 }} data-testid="paperwork-section">
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
        <SectionLabel component="h3" sx={{ mb: 0 }}>
          Podklady k této prohlídce
        </SectionLabel>
        <StatusChip tone={checkQuery.isPending && summary.text !== "vše v pořádku" ? "grey" : summary.tone} size="sm">
          {summary.text}
        </StatusChip>
      </Stack>

      <Stack component="ul" spacing={0} sx={{ listStyle: "none", p: 0, m: 0 }} aria-label="Podklady k této prohlídce">
        {rows.map((row) => (
          <PaperworkRowView key={row.key} row={row} patientId={patientId} />
        ))}
      </Stack>

      {/* The legal consents are always required; the list above is only what the činnost adds. */}
      <Typography
        variant="caption"
        data-testid="legal-consents"
        sx={{ color: "text.secondary", display: "block", mt: 1, pt: 1, borderTop: "1px solid", borderColor: "divider" }}
      >
        {LEGAL_CONSENTS_TEXT}
      </Typography>

      <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, mt: 1.25, flexWrap: "wrap" }}>
        {checkQuery.isError ? (
          <Button size="small" variant="text" onClick={() => void checkQuery.refetch()}>
            Zkusit znovu
          </Button>
        ) : null}
        {mayManageRules ? (
          <MuiLink component={RouterLink} to="/pravidla-dokumentu" underline="hover" sx={{ fontSize: 13 }}>
            Pravidla dokumentů
          </MuiLink>
        ) : null}
      </Stack>
    </SoftCard>
  );
}

/** One line of the section: the requirement, its pill, its reason, its one action. */
function PaperworkRowView({ row, patientId }: { row: PaperworkRow; patientId: string }) {
  return (
    <Stack
      component="li"
      direction="row"
      sx={{
        alignItems: "center",
        gap: 1.5,
        py: 0.875,
        borderTop: "1px solid",
        borderColor: "divider",
        "&:first-of-type": { borderTop: "none" },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{row.label}</Typography>
        {row.detail ? (
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
            {row.detail}
          </Typography>
        ) : null}
      </Box>
      {row.action === "completionLink" && row.state === "missing" ? (
        <CopyCompletionLink patientId={patientId} />
      ) : null}
      {row.action === "documents" ? (
        <Button
          size="small"
          variant="text"
          component={RouterLink}
          to={`/patients/${patientId}/dokumenty`}
          sx={{ whiteSpace: "nowrap" }}
        >
          Dokumenty pacienta
        </Button>
      ) : null}
      <StatusChip tone={PAPERWORK_STATE_TONE[row.state]} size="sm">
        {row.state === "ok" ? "✓ " : ""}
        {PAPERWORK_STATE_LABEL[row.state]}
      </StatusChip>
    </Stack>
  );
}

/**
 * The action for a missing registration or questionnaire: issue the patient's
 * completion link and put it on the clipboard. The same link the beige
 * card below issues; this one is the short form for a row.
 */
function CopyCompletionLink({ patientId }: { patientId: string }) {
  const [copied, setCopied] = useState(false);
  const issue = useMutation({
    mutationFn: async () => {
      const issued = await patientPreRegistrationApi.issueLink(patientId);
      return issued.url ?? `${window.location.origin}${issued.path}`;
    },
    onSuccess: async (full) => {
      try {
        await navigator.clipboard.writeText(full);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        /* clipboard blocked; the beige card below shows the address to copy by hand */
      }
    },
  });
  return (
    <Tooltip title={issue.isError ? "Odkaz se nepodařilo vygenerovat." : ""}>
      <Button
        size="small"
        variant="text"
        disabled={issue.isPending}
        onClick={() => issue.mutate()}
        sx={{ whiteSpace: "nowrap" }}
      >
        {copied ? "Zkopírováno" : "Zkopírovat odkaz"}
      </Button>
    </Tooltip>
  );
}

/**
 * A status button that knows whether the move exists. When it does not, the
 * button stays visible and disabled with the reason on hover — a control that
 * vanishes teaches nobody why.
 */
function StatusButton({
  label,
  from,
  to,
  disabled,
  confirmText,
  variant = "outlined",
  minHeight,
  onClick,
}: {
  label: string;
  from: number;
  to: number;
  disabled: boolean;
  confirmText?: string;
  variant?: "outlined" | "contained";
  /** The board draws "Přišel" 46 px and its neighbours 44; a phone's docked bar asks for 48. */
  minHeight?: number;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const allowed = canChangeStatus(from, to);

  if (confirming && confirmText) {
    return (
      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2.5, p: 1.5, bgcolor: "background.paper" }}>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {confirmText}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="contained"
            disabled={disabled}
            onClick={() => {
              setConfirming(false);
              onClick();
            }}
          >
            {t("booking.detail.yes")}
          </Button>
          <Button size="small" variant="outlined" onClick={() => setConfirming(false)}>
            {t("booking.detail.no")}
          </Button>
        </Stack>
      </Box>
    );
  }

  const button = (
    <Box component="span" sx={{ display: "block" }}>
      <Button
        fullWidth
        variant={variant}
        color={variant === "contained" ? "secondary" : "inherit"}
        disabled={disabled || !allowed}
        onClick={() => (confirmText ? setConfirming(true) : onClick())}
        sx={{
          minHeight: minHeight ?? (variant === "contained" ? 46 : 44),
          ...(variant === "contained" ? { color: "#FFFFFF" } : {}),
        }}
      >
        {label}
      </Button>
    </Box>
  );

  return allowed ? button : <Tooltip title={t("booking.detail.notAllowed")}>{button}</Tooltip>;
}

/**
 * 3.3: UTC on the wire, Prague on the screen. `oldValue` and `newValue` are
 * free text - for a booking or a move they carry an instant, for other actions
 * they may carry anything - so an instant is recognised and converted, and
 * everything else is passed through untouched.
 *
 * Found in the browser, not by reading: the history of a freshly booked
 * appointment read `— → 2026-09-15T06:00:00.0000000Z`, which is the wire
 * talking to the person at the desk.
 */
function historyValue(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(parsed.getTime())
    ? formatPragueDateTime(value)
    : value;
}

/**
 * One history line. `action` is the *second* numbering of 4.5, not the status
 * one — `3` here is "cancelled" while `3` as a status is "completed". An
 * unknown action is drawn as unknown and never drops the row.
 */
function HistoryRow({ line }: { line: HistoryLine }) {
  const { t } = useTranslation();
  const action = historyActionName(line.action);

  return (
    <Stack component="li" direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          bgcolor: "text.disabled",
          flexShrink: 0,
          mt: "7px",
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">
          {action ? t(`booking.history.${action}`) : t("booking.history.unknown", { code: line.action })}
          {" — "}
          {formatPragueDateTime(line.atUtc)}
          <Box component="span" sx={{ color: "text.secondary" }}>
            {" · "}
            {line.actorDisplayName ?? t("booking.detail.unknownActor")}
          </Box>
        </Typography>
        {line.oldValue || line.newValue ? (
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
            {historyValue(line.oldValue)} → {historyValue(line.newValue)}
          </Typography>
        ) : null}
        {line.reason ? (
          <Typography variant="caption" sx={{ display: "block" }}>
            {line.reason}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}

/* ══════════════════════════════════════════════════════════════
   Edit mode - board screen 13, "Úprava rezervace"
   ══════════════════════════════════════════════════════════════ */

function EditMode({
  layout,
  appointment,
  activities,
  activity,
  calendarId,
  patientName,
  note,
  busy,
  conflict,
  error,
  mayCancel,
  onBack,
  onClose,
  onSave,
  onCancelRequest,
}: {
  layout: DetailLayout;
  appointment: Appointment;
  activities: Activity[];
  activity: Activity | null;
  calendarId: string;
  patientName: string | null;
  note: string | null;
  busy: boolean;
  conflict: unknown;
  error: unknown;
  mayCancel: boolean;
  onBack: () => void;
  onClose: () => void;
  onSave: (plan: { startUtc: string | null; status: number | null }) => void;
  onCancelRequest: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<EditDraft>(() => draftFrom(appointment));

  /* A write elsewhere refreshed the appointment under the form: start again
     from what it is now rather than from what it was. */
  useEffect(() => {
    setDraft(draftFrom(appointment));
  }, [appointment.startUtc, appointment.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = planEdit(appointment, draft);
  const hasChanges = plan.startUtc !== null || plan.status !== null;
  const minutes = activity?.durationMinutes ?? durationMinutes(appointment.startUtc, appointment.endUtc);

  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(draft.date);
  const timeValid = /^\d{2}:\d{2}$/.test(draft.time);

  /* 6.1: whether the typed start is free is the server's answer, never ours. */
  const offerQuery = useQuery({
    queryKey: ["availability", calendarId, appointment.activityId, draft.date, draft.date],
    queryFn: () =>
      appointmentsApi.getAvailability(calendarId, appointment.activityId, draft.date, draft.date),
    enabled: plan.startUtc !== null && dateValid && timeValid,
    staleTime: 60 * 1000,
  });

  const newStart = plan.startUtc ?? appointment.startUtc;
  const newEnd = new Date(new Date(newStart).getTime() + minutes * 60_000).toISOString();
  const span = `${formatWallClock(newStart)} — ${formatWallClock(newEnd)}`;

  const slotLine = (() => {
    if (!dateValid || !timeValid) {
      return { tone: "beige" as const, text: "Zadejte platné datum a čas." };
    }
    if (plan.startUtc === null) {
      return { tone: "grey" as const, text: `Termín zůstává ${span}.` };
    }
    if (offerQuery.isLoading) {
      return { tone: "grey" as const, text: `Ověřuji, zda je ${span} volný…` };
    }
    if (offerQuery.isError) {
      return {
        tone: "beige" as const,
        text: `Volné časy se nepodařilo načíst. Uložení rozhodne server.`,
      };
    }
    if (isOfferedStart(offerQuery.data, plan.startUtc)) {
      return {
        tone: "green" as const,
        text: `Nový termín ${span} je volný. Nekoliduje s žádnou rezervací.`,
      };
    }
    return {
      tone: "beige" as const,
      text: `Nový termín ${span} není mezi nabízenými volnými časy. Server ho může odmítnout.`,
    };
  })();

  const pills = activities.filter((a) => a.isActive || a.id === appointment.activityId);
  if (activity === null && appointment.activityName) {
    /* The činnost is not in the list (retired, or the list has not arrived):
       still show the one the appointment has, so the row is never blank. */
    pills.unshift({
      id: appointment.activityId,
      name: appointment.activityName,
      durationMinutes: minutes,
      isActive: false,
    } as Activity);
  }

  const statusOptions = reachableStatuses(appointment.status);
  const statusLabelOf = (code: number) => {
    const n = statusName(code);
    return n ? t(`booking.status.${n}`) : t("booking.status.unknown");
  };

  const compact = layout === "full-screen";

  return (
    <>
      {/* ── Header: back, title, who and when ── */}
      <Stack
        direction="row"
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: compact ? 2 : 3,
          py: compact ? 1.5 : 2.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
          <IconButton
            aria-label="Zpět na detail"
            onClick={onBack}
            sx={{
              width: 46,
              height: 46,
              flexShrink: 0,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2.5,
              bgcolor: "background.paper",
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>
              Úprava rezervace
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
              {patientName ? `${patientName} · ` : ""}
              {formatShortPragueDateTime(appointment.startUtc)}
            </Typography>
          </Box>
        </Stack>
        <IconButton aria-label="Zavřít" onClick={onClose} sx={{ width: 44, height: 44 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* The body scrolls; the header above and the buttons below stay where they are. */}
      <Box sx={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
      <Stack spacing={2.5} sx={{ p: compact ? 2 : 3 }}>
        {/* ── SLUŽBA ── */}
        <Box>
          <SectionLabel>Služba</SectionLabel>
          <ToggleButtonGroup
            exclusive
            value={appointment.activityId}
            aria-label="Služba"
            sx={{ flexWrap: "wrap", gap: 1, bgcolor: "transparent" }}
          >
            {pills.map((a) => (
              <ToggleButton
                key={a.id}
                value={a.id}
                /* No endpoint changes an appointment's činnost; only the one it has is live. */
                disabled={a.id !== appointment.activityId}
                sx={{
                  minHeight: 44,
                  borderRadius: "10px !important",
                  border: "1px solid !important",
                  borderColor: "divider !important",
                  ml: "0 !important",
                  px: 2,
                  bgcolor: "background.paper",
                  "&.Mui-selected": {
                    bgcolor: "secondary.main",
                    borderColor: "secondary.main !important",
                    color: "#FFFFFF",
                  },
                }}
              >
                {a.name}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            Změna služby přepíše délku i cenu podle ceníku.
            {pills.length > 1 ? " Změna služby zatím není v tomto okně dostupná." : ""}
          </Typography>
        </Box>

        {/* ── DATUM · ZAČÁTEK · DÉLKA · STAV ── */}
        <Box
          sx={{
            display: "grid",
            /* One field per row on a phone; four across where there is room. */
            gridTemplateColumns: compact ? "1fr" : layout === "dialog-centered" ? "1fr 1fr" : "1.4fr 1fr 1fr 1fr",
            gap: 2,
          }}
        >
          <Box>
            <SectionLabel>Datum</SectionLabel>
            <TextField
              fullWidth
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              slotProps={{ htmlInput: { "aria-label": "Datum" } }}
            />
          </Box>
          <Box>
            <SectionLabel>Začátek</SectionLabel>
            <TextField
              fullWidth
              type="time"
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })}
              slotProps={{ htmlInput: { "aria-label": "Začátek", step: 300 } }}
            />
          </Box>
          <Box>
            <SectionLabel>Délka</SectionLabel>
            {/* The length is the činnost's (6.1); it is shown, not typed. */}
            <TextField
              fullWidth
              value={`${minutes} minut`}
              slotProps={{ input: { readOnly: true }, htmlInput: { "aria-label": "Délka" } }}
            />
          </Box>
          <Box>
            <SectionLabel>Stav</SectionLabel>
            <TextField
              fullWidth
              select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: Number(e.target.value) })}
              slotProps={{ htmlInput: { "aria-label": "Stav" } }}
            >
              {statusOptions.map((code) => (
                <MenuItem key={code} value={code}>
                  {statusLabelOf(code)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>

        {/* ── Is the new slot free? ── */}
        <Stack
          direction="row"
          spacing={1.25}
          role="status"
          sx={{
            alignItems: "center",
            px: 2,
            py: 1.5,
            borderRadius: 2.5,
            border: "1px solid",
            borderColor: slotLine.tone === "grey" ? "divider" : DESIGN.tone[slotLine.tone].line,
            bgcolor: slotLine.tone === "grey" ? "background.default" : DESIGN.tone[slotLine.tone].bg,
            color: slotLine.tone === "grey" ? "text.primary" : DESIGN.tone[slotLine.tone].fg,
          }}
        >
          <AccessTimeIcon fontSize="small" sx={{ color: "inherit", opacity: 0.8 }} />
          <Typography variant="body2" sx={{ color: "inherit" }}>
            {slotLine.text}
          </Typography>
        </Stack>

        {/* ── POZNÁMKA (read-only: 4.5 writes it only at booking) ── */}
        <Box>
          <SectionLabel>Poznámka</SectionLabel>
          <TextField
            fullWidth
            multiline
            minRows={3}
            value={note ?? ""}
            placeholder={t("booking.detail.noNote")}
            slotProps={{ input: { readOnly: true } }}
          />
        </Box>

        <Tooltip title="Odesílání potvrzení pacientovi zatím není napojené.">
          <FormControlLabel
            control={<Checkbox disabled />}
            label="Poslat pacientovi potvrzení o změně"
            sx={{ alignSelf: "flex-start", mr: 0 }}
          />
        </Tooltip>

        {conflict ? <Alert severity="info">{errorText(conflict, t)}</Alert> : null}
        {error && !conflict ? <Alert severity="error">{errorText(error, t)}</Alert> : null}
      </Stack>
      </Box>

      {compact ? (
        /* Phone: the save button is the pinned primary action, the other two sit under it. */
        <DockedBar label="Akce úpravy">
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            disabled={busy || !hasChanges || !dateValid || !timeValid}
            onClick={() => onSave(plan)}
            sx={{ color: "#FFFFFF", minHeight: 48, fontSize: 15 }}
          >
            Uložit změny
          </Button>
          <Stack direction="row" spacing={1}>
            <Button fullWidth variant="outlined" onClick={onBack} disabled={busy} sx={{ minHeight: 48 }}>
              Zahodit změny
            </Button>
            {mayCancel ? (
              <Button
                fullWidth
                color="error"
                variant="outlined"
                disabled={busy || !canChangeStatus(appointment.status, STATUS.cancelled)}
                onClick={onCancelRequest}
                sx={{ minHeight: 48 }}
              >
                {t("booking.detail.cancel")}
              </Button>
            ) : null}
          </Stack>
        </DockedBar>
      ) : (
        <Footer>
          <Box>
            {mayCancel ? (
              <Button
                color="error"
                variant="outlined"
                disabled={busy || !canChangeStatus(appointment.status, STATUS.cancelled)}
                onClick={onCancelRequest}
                sx={{ minHeight: 44 }}
              >
                {t("booking.detail.cancel")}
              </Button>
            ) : null}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={onBack} disabled={busy} sx={{ minHeight: 44 }}>
              Zahodit změny
            </Button>
            <Button
              variant="contained"
              color="secondary"
              disabled={busy || !hasChanges || !dateValid || !timeValid}
              onClick={() => onSave(plan)}
              sx={{ color: "#FFFFFF", minHeight: 44 }}
            >
              Uložit změny
            </Button>
          </Stack>
        </Footer>
      )}
    </>
  );
}

export default AppointmentDetail;
