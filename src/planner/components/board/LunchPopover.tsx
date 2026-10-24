/*
 * The pop-out of a click on the OBĚD band (R17): Přesunout (a time box, any time of the day, same duration), Smazat jen dnes,
 * Objednat pacienta sem - and "Vrátit" when the day already carries an exception. Everything is for THIS day only; the weekly lunch is
 * never touched. Loaded when first needed (the planner chunk keeps its budget).
 */
import { useEffect, useState } from 'react';
import { Alert, Box, Button, MenuItem, Popover, Stack, TextField, Typography } from '@mui/material';
import { DESIGN } from '../../../theme';
import { LUNCH_TEXT, checkLunchMove, clockOf, lunchBandLabel, lunchLength, startMinutesOf, type LunchBand } from './lunchModel';
import type { LunchTarget } from './lunchActions';

export interface LunchAction {
  ok: boolean;
  text: string;
}

export interface LunchPopoverProps {
  band: LunchBand;
  /** "St 28. 10." */
  dateLabel: string;
  /** The calendars the day's lunch belongs to (open and on screen). */
  targets: readonly LunchTarget[];
  /** The day's opening hours HH:mm and the bookings of those calendars that day (minutes), for the checks the browser can make. */
  hours: { from: string; to: string } | null;
  bookings: readonly { start: number; end: number }[];
  /** bookings.edit: may move / delete / restore. bookings.create: may book into it. */
  mayEdit: boolean;
  mayBook: boolean;
  point: { x: number; y: number };
  onMove: (startTime: string) => Promise<LunchAction>;
  /** Per-weekday lunch: the weekly break of this weekday (settings.clinic.manage). Absent = not offered. */
  onMoveWeekly?: (startTime: string) => Promise<LunchAction>;
  /** 0 = Sunday; names the weekday on the weekly button. */
  weekday?: number;
  onRemove: () => Promise<LunchAction>;
  onRestore: () => Promise<LunchAction>;
  onBook: (calendarId: string) => void;
  onClose: () => void;
}

/** Keeps the pop-out's own pointer events from reaching the board behind it (React bubbles them through the portal). */
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function LunchPopover({ band, dateLabel, targets, hours, bookings, mayEdit, mayBook, point, onMove, onMoveWeekly, weekday, onRemove, onRestore, onBook, onClose }: LunchPopoverProps) {
  const [start, setStart] = useState(band.from);
  const [calendarId, setCalendarId] = useState(targets[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setStart(band.from);
    setError(null);
  }, [band.day, band.from, band.state]);

  const length = lunchLength(band);
  const minutes = startMinutesOf(start);
  const problem = minutes === null ? LUNCH_TEXT.badStart : checkLunchMove({ start: minutes, length, hours, bookings });
  const unchanged = minutes !== null && clockOf(minutes) === band.from;
  const run = async (action: () => Promise<LunchAction>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result.ok) onClose();
      else setError(result.text);
    } finally {
      setBusy(false);
    }
  };
  const removed = band.state === 'removed';
  /* Only from the weekly lunch: a day that already carries an exception would keep it and hide the weekly change. */
  const every = onMoveWeekly && weekday !== undefined && band.state === 'weekly' ? LUNCH_TEXT.weekly.every[weekday] : undefined;

  return (
    <Popover
      open
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={{ top: point.y, left: point.x }}
      slotProps={{ paper: { sx: { width: 330, maxWidth: 'calc(100vw - 24px)', borderRadius: '13px', border: '1px solid', borderColor: 'divider', boxShadow: DESIGN.shadow.dialog } } }}
    >
      {/*
        The pop-out is a portal, but React still bubbles its pointer events to the board it was opened from - a press on a button here
        started a slot selection underneath (found in a real browser: the click opened the slot menu instead of moving the lunch).
      */}
      <Box role="dialog" aria-label={LUNCH_TEXT.title(dateLabel)} data-testid="lunch-popover" data-state={band.state} sx={{ p: 2 }}
        onPointerDown={stop} onPointerUp={stop} onPointerMove={stop} onMouseDown={stop} onMouseUp={stop} onClick={stop} onDoubleClick={stop} onContextMenu={stop}>
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{`${LUNCH_TEXT.title(dateLabel)} · ${band.from}–${band.to}`}</Typography>
        <Typography data-testid="lunch-state" sx={{ fontSize: 12.5, fontWeight: 700, mt: 0.25 }}>{lunchBandLabel(band.state)}</Typography>
        {band.original ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{LUNCH_TEXT.original(band.original.from, band.original.to)}</Typography> : null}
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{every ? LUNCH_TEXT.weekly.hint(every) : LUNCH_TEXT.onlyToday}</Typography>

        {error !== null ? <Alert severity="error" sx={{ mt: 1.25 }} data-testid="lunch-error">{error}</Alert> : null}

        {mayEdit && !removed ? (
          <Stack spacing={1} sx={{ mt: 1.5 }} data-testid="lunch-move">
            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{LUNCH_TEXT.move}</Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <TextField
                size="small"
                type="time"
                label={LUNCH_TEXT.startLabel}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                error={start !== '' && problem !== null && !unchanged}
                helperText={start !== '' && !unchanged ? problem ?? `${clockOf(minutes ?? 0)}–${clockOf((minutes ?? 0) + length)}` : LUNCH_TEXT.dragHint}
                slotProps={{ htmlInput: { step: 300, 'data-testid': 'lunch-start' }, inputLabel: { shrink: true } }}
                sx={{ flex: 1 }}
              />
              <Button variant="contained" disabled={busy || unchanged || problem !== null} onClick={() => void run(() => onMove(clockOf(minutes ?? 0)))} sx={{ minHeight: 40 }} data-testid="lunch-move-go">
                {LUNCH_TEXT.moveGo}
              </Button>
            </Stack>
            {every && onMoveWeekly ? (
              <Button variant="outlined" disabled={busy || unchanged || minutes === null} onClick={() => void run(() => onMoveWeekly(clockOf(minutes ?? 0)))} sx={{ minHeight: 44, alignSelf: 'flex-start' }} data-testid="lunch-move-weekly">
                {LUNCH_TEXT.weekly.go(every)}
              </Button>
            ) : null}
          </Stack>
        ) : null}

        {mayBook && targets.length > 1 && !removed ? (
          <TextField select size="small" fullWidth label={LUNCH_TEXT.chooseCalendar} value={calendarId} onChange={(e) => setCalendarId(e.target.value)} sx={{ mt: 1.5 }}>
            {targets.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
          </TextField>
        ) : null}

        <Stack direction="row" sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
          {mayBook && !removed ? (
            <Button variant="outlined" disabled={busy || calendarId === ''} onClick={() => { onBook(calendarId); onClose(); }} sx={{ minHeight: 44 }} data-testid="lunch-book">
              {LUNCH_TEXT.bookHere}
            </Button>
          ) : null}
          {mayEdit && !removed ? (
            <Button color="warning" variant="outlined" disabled={busy} onClick={() => void run(onRemove)} sx={{ minHeight: 44 }} data-testid="lunch-remove">
              {LUNCH_TEXT.removeToday}
            </Button>
          ) : null}
          {mayEdit && (band.state === 'moved' || removed) ? (
            <Button variant="outlined" disabled={busy} onClick={() => void run(onRestore)} sx={{ minHeight: 44 }} data-testid="lunch-restore">
              {removed ? LUNCH_TEXT.restoreRemoved : LUNCH_TEXT.restore}
            </Button>
          ) : null}
          <Button onClick={onClose} sx={{ minHeight: 44, ml: 'auto' }}>{LUNCH_TEXT.close}</Button>
        </Stack>
      </Box>
    </Popover>
  );
}
