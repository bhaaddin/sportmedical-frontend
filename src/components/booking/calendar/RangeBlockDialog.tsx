import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { appointmentsApi } from "../../../api/appointments";
import type { Calendar } from "../../../api/bookingContracts";
import { errorText } from "../errorText";
import { GRID_TEXT } from "../grid/gridText";
import { rangeToInstants } from "../grid/timeRange";
import { dayCount, daysWord, rangeDates, type DayRange } from "./model";

/*
 * "Zablokovat čas" for a run of days: whole days, in the calendars ticked.
 * One block per calendar from the start of the first day to the end of the
 * last; the server refuses the lot with its own sentence if a patient is
 * booked in it (freeing that time is a decision, not a side effect).
 */

export function RangeBlockDialog({
  range,
  calendars,
  onClose,
}: {
  range: DayRange;
  calendars: readonly Calendar[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(calendars.map((c) => c.id)));

  const save = useMutation({
    mutationFn: async () => {
      const startUtc = rangeToInstants(range.from, { start: 0, end: 1 }).startUtc;
      const endUtc = rangeToInstants(range.to, { start: 0, end: 24 * 60 }).endUtc;
      for (const calendar of calendars) {
        if (!picked.has(calendar.id)) continue;
        await appointmentsApi.createBlock(calendar.id, startUtc, endUtc, reason.trim());
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["blocks"] });
      onClose();
    },
  });

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const ready = reason.trim() !== "" && picked.size > 0 && !save.isPending;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) save.mutate();
        }}
      >
        <DialogTitle>{GRID_TEXT.blockTitle}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5 }}>
            {rangeDates(range)} · {daysWord(dayCount(range))}
          </Typography>
          {calendars.length > 1 ? (
            <Box sx={{ mb: 1.5 }} role="group" aria-label={GRID_TEXT.calendars}>
              {calendars.map((calendar) => (
                <FormControlLabel
                  key={calendar.id}
                  sx={{ display: "flex", minHeight: 44, mx: 0 }}
                  control={<Checkbox checked={picked.has(calendar.id)} onChange={() => toggle(calendar.id)} />}
                  label={calendar.name}
                />
              ))}
            </Box>
          ) : null}
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
          <Button onClick={onClose} sx={{ minHeight: 44 }}>
            {GRID_TEXT.cancel}
          </Button>
          <Button type="submit" variant="contained" disabled={!ready} sx={{ minHeight: 44 }}>
            {GRID_TEXT.block}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
