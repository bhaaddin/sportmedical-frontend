import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { appointmentsApi } from "../../../api/appointments";
import { formatPragueDateTime, formatPragueTime } from "../../../utils/time";
import { errorText } from "../errorText";
import type { GridMoveRequest } from "../grid/TimeGrid";
import { CAL_TEXT } from "./calendarText";

/*
 * A booking dropped on another time: the desk is asked before anything moves
 * ("Přesunout rezervaci"), and nothing is drawn in the new place until the
 * server has said yes (6.3) - the grid redraws from what it answers. A refusal
 * (somebody else took the time, the booking was changed meanwhile) is shown
 * with the server's own sentence and the booking stays where it was.
 */

export function MoveConfirmDialog({
  move,
  onClose,
}: {
  move: GridMoveRequest;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { appointment } = move;

  const save = useMutation({
    mutationFn: () => appointmentsApi.reschedule(move.calendarId, appointment.id, move.startUtc),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["day-range"] });
      await queryClient.invalidateQueries({ queryKey: ["blocks"] });
      onClose();
    },
  });

  const who = appointment.patientName?.trim() || appointment.activityName;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="move-title">
      <DialogTitle id="move-title">{CAL_TEXT.moveTitle}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontWeight: 700 }}>{who}</Typography>
        {appointment.activityName && who !== appointment.activityName ? (
          <Typography sx={{ color: "text.secondary", fontSize: 14 }}>{appointment.activityName}</Typography>
        ) : null}
        <Box sx={{ mt: 1.5, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 1.5, rowGap: 0.5 }}>
          <Typography sx={{ color: "text.secondary", fontSize: 13 }}>{CAL_TEXT.moveFrom}</Typography>
          <Typography sx={{ fontVariantNumeric: "tabular-nums" }}>
            {formatPragueDateTime(appointment.startUtc)} – {formatPragueTime(appointment.endUtc)}
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: 13 }}>{CAL_TEXT.moveTo}</Typography>
          <Typography sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {formatPragueDateTime(move.startUtc)} – {formatPragueTime(move.endUtc)}
          </Typography>
        </Box>
        {save.error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorText(save.error, t)}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ minHeight: 44 }}>
          {CAL_TEXT.moveBack}
        </Button>
        <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate()} sx={{ minHeight: 44 }}>
          {CAL_TEXT.moveConfirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
