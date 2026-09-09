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
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { appointmentsApi } from "../../api/appointments";
import { patientsApi } from "../../api/patients";
import { BookingApiError } from "../../api/apiError";
import {
  canChangeStatus,
  historyActionName,
  isLateStatus,
  statusName,
  statusTally,
} from "../../api/bookingContracts";
import type { DayAppointment, HistoryLine } from "../../api/bookingContracts";
import {
  addDaysToDateOnly,
  formatPragueDate,
  formatPragueDateTime,
  formatPragueTime,
  isLate,
  pragueDateKey,
} from "../../utils/time";
import { AsyncSection } from "./AsyncSection";
import { errorText } from "./errorText";

/**
 * One appointment, opened from the grid — contract 5.8.
 *
 * Three things 5.8 asks for are not here, and the reason is worth writing down
 * rather than leaving as a gap somebody re-discovers:
 *
 *   - **Readiness of the paperwork.** Change 43 of the contract removed it from
 *     4.6 and says not to make room for it: until the `app` lane has cleaned up
 *     its three document templates it would report a missing consent to people
 *     who signed one. A tick that lies is worse than no tick.
 *   - **A note.** No endpoint in 4.5 carries one — not the booking body, not the
 *     day row. Reported to the booking lane rather than invented here.
 *   - **Undo on every action.** 4.5 gives an undo for arrival and for absence
 *     and for nothing else: cancelling and completing are one-way. So those two
 *     ask before they act instead of promising a way back.
 *
 * Everything the screen writes goes through the transition table in
 * `canChangeStatus`, so a button that the server would refuse is never offered.
 */

/** The status codes of 4.5, named where they are used. */
const SCHEDULED = 0;
const CHECKED_IN = 2;
const COMPLETED = 3;
const NO_SHOW = 5;

/** How far ahead a move looks for free time. The API allows 62 days (4.5). */
const RESCHEDULE_WINDOW_DAYS = 13;

interface AppointmentDetailProps {
  appointment: DayAppointment;
  calendar?: { id: string; name: string; color: string };
  open: boolean;
  onClose: () => void;
  /** The grid reloads itself when anything here changed the appointment. */
  onChanged: () => void;
}

export function AppointmentDetail({
  appointment,
  calendar,
  open,
  onClose,
  onChanged,
}: AppointmentDetailProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [moving, setMoving] = useState(false);
  /**
   * A `409` is not an error (6.3): somebody was faster, or the appointment moved
   * on without us. It gets its own calm line rather than the red box, and it
   * carries the server's own sentence - since v23 the same status has two of
   * them, and a fixed one here would tell half the people the wrong thing.
   */
  const [conflict, setConflict] = useState<unknown>(null);

  /**
   * The calendar is in the path, never in the body (4.5). A row that arrived
   * without one cannot be written to at all, and the screen says so instead of
   * sending a request with `undefined` in the URL.
   */
  const calendarId = appointment.calendarId ?? calendar?.id ?? null;

  const patientQuery = useQuery({
    queryKey: ["patient", appointment.patientId],
    queryFn: () => patientsApi.getById(appointment.patientId),
    enabled: open,
  });

  const historyQuery = useQuery({
    queryKey: ["appointment-history", calendarId, appointment.id],
    queryFn: () => appointmentsApi.history(calendarId as string, appointment.id),
    enabled: open && calendarId !== null,
  });

  const late = isLate(
    appointment.startUtc,
    isLateStatus(appointment.status),
    new Date(),
  );
  const name = statusName(appointment.status);
  const statusLabel = name
    ? t(`booking.status.${name}`)
    : t("booking.status.unknown");

  const afterWrite = () => {
    setConflict(null);
    setCancelling(false);
    setCancelReason("");
    setMoving(false);
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
        queryKey: ["availability", calendarId, appointment.activityId],
      });
      onChanged();
    }
  };

  const statusMutation = useMutation({
    mutationFn: ({ to, reason }: { to: number; reason?: string }) =>
      appointmentsApi.setStatus(
        calendarId as string,
        appointment.id,
        String(to),
        reason,
      ),
    onSuccess: afterWrite,
    onError: onWriteError,
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      appointmentsApi.cancel(calendarId as string, appointment.id, reason),
    onSuccess: () => {
      afterWrite();
      onClose();
    },
    onError: onWriteError,
  });

  const rescheduleMutation = useMutation({
    mutationFn: (startUtc: string) =>
      appointmentsApi.reschedule(calendarId as string, appointment.id, startUtc),
    onSuccess: afterWrite,
    onError: onWriteError,
  });

  const busy =
    statusMutation.isPending ||
    cancelMutation.isPending ||
    rescheduleMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <Box component="span" sx={{ fontWeight: 700 }}>
            {formatPragueTime(appointment.startUtc)}–
            {formatPragueTime(appointment.endUtc)}
          </Box>
          <Box component="span" sx={{ color: "text.secondary", fontSize: 14 }}>
            {formatPragueDate(appointment.startUtc)}
          </Box>
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
          {appointment.activityName}
          {calendar ? ` · ${calendar.name}` : ""}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          {/* Status in words, never colour alone (7.1). */}
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Chip
              size="small"
              label={statusLabel}
              color={
                statusTally(appointment.status) === "cancelled"
                  ? "default"
                  : "primary"
              }
            />
            {late ? (
              <Chip
                size="small"
                color="warning"
                label={t("booking.status.late")}
              />
            ) : null}
            {appointment.checkedInUtc ? (
              <Chip
                size="small"
                variant="outlined"
                label={`${t("booking.detail.checkedInAt")} ${formatPragueTime(
                  appointment.checkedInUtc,
                )}`}
              />
            ) : null}
          </Stack>

          {calendarId === null ? (
            <Alert severity="warning">{t("booking.detail.noCalendar")}</Alert>
          ) : null}

          {/* ── Patient and contact (5.8) ── */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              {t("booking.detail.patient")}
            </Typography>
            <AsyncSection
              isLoading={patientQuery.isLoading}
              error={patientQuery.error}
              isSettled={patientQuery.isSuccess || patientQuery.isError}
              isEmpty={!patientQuery.data}
              emptyText={t("booking.detail.patientMissing")}
              onRetry={() => void patientQuery.refetch()}
              skeletonRows={2}
            >
              {patientQuery.data ? (
                <Stack spacing={0.5}>
                  <MuiLink
                    component={RouterLink}
                    to={`/patients/${appointment.patientId}`}
                    sx={{ fontWeight: 600 }}
                  >
                    {patientQuery.data.fullName ??
                      `${patientQuery.data.firstName} ${patientQuery.data.lastName}`}
                  </MuiLink>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {patientQuery.data.phone || t("booking.detail.noPhone")}
                    {" · "}
                    {patientQuery.data.email || t("booking.detail.noEmail")}
                  </Typography>
                </Stack>
              ) : null}
            </AsyncSection>
          </Box>

          {/* ── Actions (5.8) ── */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              {t("booking.common.actions")}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <StatusButton
                label={t("booking.detail.arrived")}
                to={CHECKED_IN}
                from={appointment.status}
                disabled={busy || calendarId === null}
                onClick={() => statusMutation.mutate({ to: CHECKED_IN })}
              />
              <StatusButton
                label={t("booking.detail.noShow")}
                to={NO_SHOW}
                from={appointment.status}
                disabled={busy || calendarId === null}
                /*
                 * `2 -> 5` is allowed on purpose — it is how a mis-click gets
                 * corrected — but marking a patient who is standing at the desk
                 * as absent deserves a question first (4.5, v23).
                 */
                confirmText={
                  appointment.status === CHECKED_IN
                    ? t("booking.detail.confirmNoShow")
                    : undefined
                }
                onClick={() => statusMutation.mutate({ to: NO_SHOW })}
              />
              <StatusButton
                label={t("booking.detail.undo")}
                to={SCHEDULED}
                from={appointment.status}
                disabled={busy || calendarId === null}
                onClick={() => statusMutation.mutate({ to: SCHEDULED })}
              />
              <StatusButton
                label={t("booking.detail.complete")}
                to={COMPLETED}
                from={appointment.status}
                disabled={busy || calendarId === null}
                confirmText={t("booking.detail.confirmComplete")}
                onClick={() => statusMutation.mutate({ to: COMPLETED })}
              />
              <Button
                size="small"
                variant="outlined"
                disabled={busy || calendarId === null}
                onClick={() => {
                  setConflict(null);
                  setMoving((was) => !was);
                }}
              >
                {t("booking.detail.move")}
              </Button>
              <Button
                size="small"
                color="error"
                variant="outlined"
                disabled={
                  busy ||
                  calendarId === null ||
                  !canChangeStatus(appointment.status, 4)
                }
                onClick={() => setCancelling((was) => !was)}
              >
                {t("booking.detail.cancel")}
              </Button>
            </Stack>
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

          {/* ── Cancelling, which 5.8 makes conditional on a reason ── */}
          {cancelling ? (
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 2,
              }}
            >
              <Typography variant="body2" sx={{ mb: 1 }}>
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
                <Button size="small" onClick={() => setCancelling(false)}>
                  {t("booking.detail.keep")}
                </Button>
              </Stack>
            </Box>
          ) : null}

          {/* ── Moving, which only ever offers what the server offered (6.1) ── */}
          {moving && calendarId !== null ? (
            <RescheduleOffer
              calendarId={calendarId}
              activityId={appointment.activityId}
              currentStartUtc={appointment.startUtc}
              busy={busy}
              onPick={(startUtc) => rescheduleMutation.mutate(startUtc)}
              error={rescheduleMutation.error}
            />
          ) : null}

          <Divider />

          {/* ── History (5.8): newest first ── */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              {t("booking.detail.history")}
            </Typography>
            <AsyncSection
              isLoading={historyQuery.isLoading}
              error={historyQuery.error}
              isSettled={historyQuery.isSuccess || historyQuery.isError}
              isEmpty={(historyQuery.data ?? []).length === 0}
              emptyText={t("booking.detail.historyEmpty")}
              onRetry={() => void historyQuery.refetch()}
              skeletonRows={3}
            >
              <Stack spacing={1.5}>
                {[...(historyQuery.data ?? [])]
                  .sort(
                    (a, b) =>
                      new Date(b.atUtc).getTime() - new Date(a.atUtc).getTime(),
                  )
                  .map((line, index) => (
                    <HistoryRow key={`${line.atUtc}-${index}`} line={line} />
                  ))}
              </Stack>
            </AsyncSection>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t("booking.detail.close")}</Button>
      </DialogActions>
    </Dialog>
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
  onClick,
}: {
  label: string;
  from: number;
  to: number;
  disabled: boolean;
  confirmText?: string;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const allowed = canChangeStatus(from, to);

  if (confirming && confirmText) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="body2">{confirmText}</Typography>
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
        <Button size="small" onClick={() => setConfirming(false)}>
          {t("booking.detail.no")}
        </Button>
      </Stack>
    );
  }

  const button = (
    <Box component="span">
      <Button
        size="small"
        variant="outlined"
        disabled={disabled || !allowed}
        onClick={() => (confirmText ? setConfirming(true) : onClick())}
      >
        {label}
      </Button>
    </Box>
  );

  return allowed ? (
    button
  ) : (
    <Tooltip title={t("booking.detail.notAllowed")}>{button}</Tooltip>
  );
}

/**
 * The times a move may go to. 6.1 is absolute: the client never works out what
 * is free, it asks `GET /api/calendars/{id}/availability` and offers exactly
 * what comes back.
 */
function RescheduleOffer({
  calendarId,
  activityId,
  currentStartUtc,
  busy,
  onPick,
  error,
}: {
  calendarId: string;
  activityId: string;
  currentStartUtc: string;
  busy: boolean;
  onPick: (startUtc: string) => void;
  error: unknown;
}) {
  const { t } = useTranslation();
  const from = pragueDateKey(currentStartUtc);
  const to = addDaysToDateOnly(from, RESCHEDULE_WINDOW_DAYS);

  const offer = useQuery({
    queryKey: ["availability", calendarId, activityId, from, to],
    queryFn: () =>
      appointmentsApi.getAvailability(calendarId, activityId, from, to),
  });

  const byDay = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const slot of offer.data ?? []) {
      // The slot the appointment already occupies is not a move.
      if (slot.startUtc === currentStartUtc) continue;
      const key = pragueDateKey(slot.startUtc);
      const list = groups.get(key) ?? [];
      list.push(slot.startUtc);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [offer.data, currentStartUtc]);

  return (
    <Box
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        {t("booking.detail.moveTo")}
      </Typography>
      {error ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {errorText(error, t)}
        </Alert>
      ) : null}
      <AsyncSection
        isLoading={offer.isLoading}
        error={offer.error}
        isSettled={offer.isSuccess || offer.isError}
        isEmpty={byDay.length === 0}
        emptyText={t("booking.detail.noFreeTime")}
        onRetry={() => void offer.refetch()}
        skeletonRows={3}
      >
        <Stack spacing={1.5}>
          {byDay.map(([day, starts]) => (
            <Box key={day}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {formatPragueDate(starts[0])}
              </Typography>
              <Stack
                direction="row"
                sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.5 }}
              >
                {starts.map((startUtc) => (
                  <Button
                    key={startUtc}
                    size="small"
                    variant="outlined"
                    disabled={busy}
                    onClick={() => onPick(startUtc)}
                  >
                    {formatPragueTime(startUtc)}
                  </Button>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </AsyncSection>
    </Box>
  );
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
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {action
          ? t(`booking.history.${action}`)
          : t("booking.history.unknown", { code: line.action })}
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {formatPragueDateTime(line.atUtc)}
        {" · "}
        {line.actorDisplayName ?? t("booking.detail.unknownActor")}
      </Typography>
      {line.oldValue || line.newValue ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {line.oldValue ?? "—"} → {line.newValue ?? "—"}
        </Typography>
      ) : null}
      {line.reason ? (
        <Typography variant="body2">{line.reason}</Typography>
      ) : null}
    </Box>
  );
}

export default AppointmentDetail;
