import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { appointmentsApi } from "../../../api/appointments";
import type { TimeBlock } from "../../../api/bookingContracts";
import { formatDateOnly, formatPragueDateTime, formatPragueTime } from "../../../utils/time";
import { errorText } from "../errorText";
import { GRID_TEXT } from "./gridText";
import { rangeLabel, rangeToInstants, type MinuteRange } from "./timeRange";

/*
 * Blocking time from the grid, and taking a block away again.
 *
 * Both calls are `bookings.edit` on the server; the grid offers neither to
 * anybody without it. A block over somebody's appointment is refused with
 * `409` and the server's own sentence - freeing that time means cancelling a
 * patient, which is a decision, not a side effect of a drag.
 *
 * Nothing is drawn before the server answers (6.3): the blocks query is
 * invalidated and the grid redraws from what comes back.
 */

export interface BlockTarget {
  calendarId: string;
  calendarName: string;
  dayKey: string;
  range: MinuteRange;
}

export function BlockReasonDialog({
  target,
  onClose,
}: {
  target: BlockTarget;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const save = useMutation({
    mutationFn: () => {
      const { startUtc, endUtc } = rangeToInstants(target.dayKey, target.range);
      return appointmentsApi.createBlock(target.calendarId, startUtc, endUtc, reason.trim());
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["blocks", target.calendarId] });
      onClose();
    },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (reason.trim() !== "" && !save.isPending) save.mutate();
        }}
      >
        <DialogTitle>{GRID_TEXT.blockTitle}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {target.calendarName} · {formatDateOnly(target.dayKey)} ·{" "}
            {rangeLabel(target.range)}
          </Typography>
          <TextField
            autoFocus
            required
            fullWidth
            label={GRID_TEXT.blockReason}
            helperText={GRID_TEXT.blockReasonHelp}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {save.error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errorText(save.error, t)}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{GRID_TEXT.cancel}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={reason.trim() === "" || save.isPending}
          >
            {GRID_TEXT.block}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function BlockDetailDialog({
  calendarId,
  calendarName,
  block,
  mayRemove,
  onClose,
}: {
  calendarId: string;
  calendarName: string;
  block: TimeBlock;
  mayRemove: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const remove = useMutation({
    mutationFn: () => appointmentsApi.deleteBlock(calendarId, block.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["blocks", calendarId] });
      onClose();
    },
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{GRID_TEXT.blockDetailTitle}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontWeight: 700 }}>{calendarName}</Typography>
        <Typography>
          {formatPragueDateTime(block.startUtc)} – {formatPragueTime(block.endUtc)}
        </Typography>
        <Typography sx={{ mt: 1 }}>{block.reason || GRID_TEXT.blocked}</Typography>
        {mayRemove ? (
          <Typography sx={{ mt: 2, color: "text.secondary", fontSize: 14 }}>
            {GRID_TEXT.unblockConfirm}
          </Typography>
        ) : null}
        {remove.error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorText(remove.error, t)}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{GRID_TEXT.close}</Button>
        {mayRemove ? (
          <Button
            color="error"
            variant="contained"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {GRID_TEXT.unblock}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
