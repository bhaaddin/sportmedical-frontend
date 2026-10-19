/*
 * "Zablokovat celé dny" for the days marked in the month: one reason, and per marked place one block from the first
 * minute of its first day to the last minute of its last day in every calendar ticked. The server refuses a block over
 * a booked patient with its own sentence (freeing that time is a decision, not a side effect); places saved before the
 * refusal stay saved, and the calendar is read again either way. The old calendar's `MultiBlockDialog` /
 * `RangeBlockDialog`, for days only.
 */
import { useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { appointmentsApi } from '../../../../api/appointments';
import type { Calendar } from '../../../../api/bookingContracts';
import { daysWord, dayCount, type DayRange } from '../../../../components/booking/calendar/model';
import { pickedLabel } from '../../../../components/booking/calendar/multiSelect';
import { errorText } from '../../../../components/booking/errorText';
import { GRID_TEXT } from '../../../../components/booking/grid/gridText';
import { rangeToInstants } from '../../../../components/booking/grid/timeRange';
import { PLANNER_TEXT } from '../../../text';

export function DaysBlockDialog({
  ranges,
  calendars,
  onClose,
  onDone,
}: {
  ranges: readonly DayRange[];
  calendars: readonly Calendar[];
  onClose: () => void;
  /** Every block was saved. */
  onDone: (blocked: number) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set(calendars.map((c) => c.id)));

  const save = useMutation({
    mutationFn: async () => {
      for (const range of ranges) {
        const startUtc = rangeToInstants(range.from, { start: 0, end: 1 }).startUtc;
        const endUtc = rangeToInstants(range.to, { start: 0, end: 24 * 60 }).endUtc;
        for (const calendar of calendars) {
          if (!picked.has(calendar.id)) continue;
          await appointmentsApi.createBlock(calendar.id, startUtc, endUtc, reason.trim());
        }
      }
    },
    onSuccess: () => onDone(ranges.length),
    /* Places saved before a refusal stay saved: the calendar is read again whatever happened. */
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['blocks'] });
    },
  });

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const ready = reason.trim() !== '' && picked.size > 0 && ranges.length > 0 && !save.isPending;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-label={PLANNER_TEXT.days.blockTitle}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) save.mutate();
        }}
      >
        <DialogTitle>{PLANNER_TEXT.days.blockTitle}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{PLANNER_TEXT.days.selectedCount(ranges.length)}</Typography>
          <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.5 }} data-testid="days-block-list">
            {ranges.map((range) => (
              <li key={range.from + range.to}>
                <Typography sx={{ fontSize: 14 }}>
                  {pickedLabel({ id: range.from, kind: 'days', ...range })} · {daysWord(dayCount(range))}
                </Typography>
              </li>
            ))}
          </Box>
          {calendars.length > 1 ? (
            <Box sx={{ mb: 1.5 }} role="group" aria-label={PLANNER_TEXT.days.pickCalendars}>
              {calendars.map((calendar) => (
                <FormControlLabel
                  key={calendar.id}
                  sx={{ display: 'flex', minHeight: 44, mx: 0 }}
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
