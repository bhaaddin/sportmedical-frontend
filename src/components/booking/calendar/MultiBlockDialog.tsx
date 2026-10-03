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
import { CAL_TEXT } from "./calendarText";
import { pickedLabel, type PickedRange } from "./multiSelect";

/*
 * "Zablokovat čas" for several marked places at once: one reason, one block
 * per place - a time range in the calendar it was drawn in, whole days in
 * every calendar ticked. The server refuses a block over a booked patient
 * with its own sentence; places saved before that stay saved.
 */

export function MultiBlockDialog({
  items,
  calendars,
  onClose,
  onDone,
}: {
  items: readonly PickedRange[];
  calendars: readonly Calendar[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(calendars.map((c) => c.id)));
  const hasDays = items.some((i) => i.kind === "days");

  const save = useMutation({
    mutationFn: async () => {
      for (const item of items) {
        if (item.kind === "time") {
          const { startUtc, endUtc } = rangeToInstants(item.dayKey, item.range);
          await appointmentsApi.createBlock(item.calendarId, startUtc, endUtc, reason.trim());
          continue;
        }
        const startUtc = rangeToInstants(item.from, { start: 0, end: 1 }).startUtc;
        const endUtc = rangeToInstants(item.to, { start: 0, end: 24 * 60 }).endUtc;
        for (const calendar of calendars) {
          if (!picked.has(calendar.id)) continue;
          await appointmentsApi.createBlock(calendar.id, startUtc, endUtc, reason.trim());
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["blocks"] });
      onDone();
    },
  });

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const ready = reason.trim() !== "" && (!hasDays || picked.size > 0) && !save.isPending;

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
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{CAL_TEXT.trayCount(items.length)}</Typography>
          <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.5 }} data-testid="multi-block-list">
            {items.map((item) => (
              <li key={item.id}>
                <Typography sx={{ fontSize: 14 }}>{pickedLabel(item)}</Typography>
              </li>
            ))}
          </Box>
          {hasDays && calendars.length > 1 ? (
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
