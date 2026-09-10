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
  isKnownPaperworkReason,
  isLateStatus,
  isTerminalStatus,
  statusName,
  statusTally,
} from "../../api/bookingContracts";
import type { Appointment, HistoryLine } from "../../api/bookingContracts";
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
 */

/** The status codes of 4.5, named where they are used. */
const SCHEDULED = 0;
const CHECKED_IN = 2;
const COMPLETED = 3;
const NO_SHOW = 5;

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
  const { t } = useTranslation();

  const detailQuery = useQuery({
    queryKey: ["appointment", calendarId, appointmentId],
    queryFn: () => appointmentsApi.get(calendarId, appointmentId),
    enabled: open,
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        {detailQuery.data ? (
          <>
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center", flexWrap: "wrap" }}
            >
              <Box component="span" sx={{ fontWeight: 700 }}>
                {formatPragueTime(detailQuery.data.startUtc)}–
                {formatPragueTime(detailQuery.data.endUtc)}
              </Box>
              <Box
                component="span"
                sx={{ color: "text.secondary", fontSize: 14 }}
              >
                {formatPragueDate(detailQuery.data.startUtc)}
              </Box>
            </Stack>
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", mt: 0.5 }}
            >
              {/* Empty when the activity is gone (4.5) - say so, do not print nothing. */}
              {detailQuery.data.activityName || t("booking.detail.noActivity")}
              {calendar ? ` · ${calendar.name}` : ""}
            </Typography>
          </>
        ) : (
          t("booking.detail.title")
        )}
      </DialogTitle>

      <DialogContent dividers>
        <AsyncSection
          isLoading={detailQuery.isLoading}
          isSettled={detailQuery.isSuccess || detailQuery.isError}
          error={detailQuery.error}
          isEmpty={false}
          emptyText=""
          onRetry={() => void detailQuery.refetch()}
          skeletonRows={5}
        >
          {detailQuery.data ? (
            <DetailBody
              appointment={detailQuery.data}
              calendarId={calendarId}
              onChanged={onChanged}
              onClose={onClose}
            />
          ) : null}
        </AsyncSection>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t("booking.detail.close")}</Button>
      </DialogActions>
    </Dialog>
  );
}

function DetailBody({
  appointment,
  calendarId,
  onChanged,
  onClose,
}: {
  appointment: Appointment;
  calendarId: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [moving, setMoving] = useState(false);
  /**
   * A `409` is not an error (6.3): somebody was faster, or the appointment moved
   * on without us. It gets its own calm line rather than the red box, and it
   * carries the server's own sentence - since v23 that status has two meanings
   * and a fixed one here would tell half the readers the wrong thing.
   */
  const [conflict, setConflict] = useState<unknown>(null);

  const patientQuery = useQuery({
    queryKey: ["patient", appointment.patientId],
    queryFn: () => patientsApi.getById(appointment.patientId),
  });

  const historyQuery = useQuery({
    queryKey: ["appointment-history", calendarId, appointment.id],
    queryFn: () => appointmentsApi.history(calendarId, appointment.id),
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
    mutationFn: (reason: string) =>
      appointmentsApi.cancel(calendarId, appointment.id, reason),
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

  const busy =
    statusMutation.isPending ||
    cancelMutation.isPending ||
    rescheduleMutation.isPending;

  return (
    <Stack spacing={2}>
      {/* Status in words, never colour alone (7.1). */}
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
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
          <Chip size="small" color="warning" label={t("booking.status.late")} />
        ) : null}
        {/*
          4.5, v27: completing an appointment now keeps this. Until then the
          transition wiped it, so "přišel v 9:12" stopped being true the moment
          the visit ended.
        */}
        {appointment.checkedInUtc ? (
          <Chip
            size="small"
            variant="outlined"
            label={`${t("booking.detail.checkedInAt")} ${formatPragueTime(
              appointment.checkedInUtc,
            )}`}
          />
        ) : null}
        {appointment.heldUntilUtc ? (
          <Chip
            size="small"
            color="info"
            label={`${t("booking.detail.heldUntil")} ${formatPragueTime(
              appointment.heldUntilUtc,
            )}`}
          />
        ) : null}
      </Stack>

      {/*
        4.5, v29; live since v32. Rendered only when there is an answer - see
        `paperworkSchema`. When the register does not know the patient this
        whole block is absent rather than reassuring.
      */}
      {appointment.paperwork ? (
        <Alert severity={appointment.paperwork.ready ? "success" : "warning"}>
          {appointment.paperwork.ready
            ? t("booking.paperwork.ready")
            : appointment.paperwork.missing
                .map((code) =>
                  isKnownPaperworkReason(code)
                    ? t(`booking.paperwork.${code}`)
                    : /* An unknown reason is shown as unknown, never dropped. */
                      t("booking.paperwork.unknown", { code }),
                )
                .join(" · ")}
        </Alert>
      ) : null}

      {/* 6.4: an override was made by a person, for a reason they typed. */}
      {appointment.overrideReason ? (
        <Alert severity="warning">
          {t("booking.detail.overridden")}: {appointment.overrideReason}
        </Alert>
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

      {/* ── The desk's note (5.8, v26) ── */}
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {t("booking.detail.note")}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: appointment.note ? "text.primary" : "text.secondary",
            whiteSpace: "pre-wrap",
          }}
        >
          {/*
            The note can only be written when the appointment is booked (4.5).
            Saying so is the point: an empty line would read as "this patient
            said nothing", not as "this screen cannot edit it".
          */}
          {appointment.note || t("booking.detail.noNote")}
        </Typography>
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
            disabled={busy}
            onClick={() => statusMutation.mutate({ to: CHECKED_IN })}
          />
          <StatusButton
            label={t("booking.detail.noShow")}
            to={NO_SHOW}
            from={appointment.status}
            disabled={busy}
            /*
             * `2 -> 5` is allowed on purpose — it is how a mis-click gets
             * corrected — but marking a patient who is standing at the desk as
             * absent deserves a question first (4.5, v23).
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
            disabled={busy}
            onClick={() => statusMutation.mutate({ to: SCHEDULED })}
          />
          <StatusButton
            label={t("booking.detail.complete")}
            to={COMPLETED}
            from={appointment.status}
            disabled={busy}
            confirmText={t("booking.detail.confirmComplete")}
            onClick={() => statusMutation.mutate({ to: COMPLETED })}
          />
          {/*
            A completed or cancelled appointment cannot be moved - the server
            answers `409`, which is right, but offering the button and then
            refusing it wastes somebody's click and teaches them nothing. Found
            in the browser: the move panel opened on a finished appointment and
            listed times it could never accept.
          */}
          <Tooltip
            title={
              isTerminalStatus(appointment.status)
                ? t("booking.detail.notAllowed")
                : ""
            }
          >
            <Box component="span">
              <Button
                size="small"
                variant="outlined"
                disabled={busy || isTerminalStatus(appointment.status)}
                onClick={() => {
                  setConflict(null);
                  setMoving((was) => !was);
                }}
              >
                {t("booking.detail.move")}
              </Button>
            </Box>
          </Tooltip>
          <Button
            size="small"
            color="error"
            variant="outlined"
            disabled={busy || !canChangeStatus(appointment.status, 4)}
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
      {moving ? (
        <RescheduleOffer
          calendarId={calendarId}
          activityId={appointment.activityId}
          currentStartUtc={appointment.startUtc}
          busy={busy}
          onPick={(startUtc) => rescheduleMutation.mutate(startUtc)}
          /*
            A conflict already has its own calm line above (6.3); passing it
            down as well printed the server's sentence twice. Only a real
            failure belongs inside the panel.
          */
          error={conflict ? null : rescheduleMutation.error}
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
          {historyValue(line.oldValue)} → {historyValue(line.newValue)}
        </Typography>
      ) : null}
      {line.reason ? (
        <Typography variant="body2">{line.reason}</Typography>
      ) : null}
    </Box>
  );
}

export default AppointmentDetail;
