/*
 * R24 - the CONFLICT step of "Přidat do objednávky klubu": the bookings that stand in the club's way, each with a proposed new slot and a
 * choice to tell the client, then "Přesunout a pokračovat". Nothing moves before that button. Lazy (the dialog loads it only on a refusal).
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Typography } from '@mui/material';
import { appointmentsApi } from '../../../api/appointments';
import type { AvailabilitySlot, DayAppointment } from '../../../api/bookingContracts';
import { rememberedNotify, rememberNotify } from '../grid/moveDrag';
import {
  CONFLICT_TEXT,
  proposeSlot,
  revertMoves,
  runMoves,
  searchSpan,
  type ClubWindow,
  type MovePlanItem,
} from './clubConflict';

const when = (iso: string): string =>
  new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const clockOf = (iso: string): string =>
  new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export interface ClubConflictStepProps {
  bookings: readonly DayAppointment[];
  /** The bookings of the same days that stay where they are (a proposal may not land on them). */
  staying: readonly DayAppointment[];
  windows: readonly ClubWindow[];
  calendarName: (calendarId: string | null) => string;
  today: string;
  /** All of them moved: place the club now. */
  onMoved: () => void;
  /** Lets the parent say "moving" (disables its own buttons). */
  onBusy?: (busy: boolean) => void;
  describeError: (error: unknown) => string;
}

type Proposals = Map<string, string | null>;

export function ClubConflictStep({ bookings, staying, windows, calendarName, today, onMoved, onBusy, describeError }: ClubConflictStepProps) {
  const [proposals, setProposals] = useState<Proposals | null>(null);
  const [notify, setNotify] = useState<Record<string, boolean>>(() => Object.fromEntries(bookings.map((b) => [b.id, rememberedNotify()])));
  const [working, setWorking] = useState<'moving' | 'reverting' | null>(null);
  const [outcome, setOutcome] = useState<{ moved: MovePlanItem[]; failed: string | null; reverted: string | null } | null>(null);

  const key = useMemo(() => bookings.map((b) => b.id).join(','), [bookings]);
  useEffect(() => {
    let cancelled = false;
    setProposals(null);
    void (async () => {
      const slotCache = new Map<string, AvailabilitySlot[]>();
      const taken: { calendarId: string | null; startUtc: number; endUtc: number }[] = [];
      const out: Proposals = new Map();
      for (const b of bookings) {
        const span = searchSpan(b.startUtc, today);
        const cacheKey = `${b.calendarId}|${b.activityId}|${span.from}|${span.to}`;
        let slots = slotCache.get(cacheKey);
        if (slots === undefined) {
          try {
            slots = b.calendarId ? await appointmentsApi.getAvailability(b.calendarId, b.activityId, span.from, span.to, { staffStarts: true }) : [];
          } catch {
            slots = [];
          }
          slotCache.set(cacheKey, slots);
        }
        const picked = proposeSlot({ booking: b, slots, windows, taken, staying });
        out.set(b.id, picked);
        if (picked) {
          const start = Date.parse(picked);
          taken.push({ calendarId: b.calendarId, startUtc: start, endUtc: start + (Date.parse(b.endUtc) - Date.parse(b.startUtc)) });
        }
      }
      if (!cancelled) setProposals(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bookings are identified by `key`
  }, [key, today]);

  const missing = proposals !== null && bookings.some((b) => !proposals.get(b.id));
  const ready = proposals !== null && !missing && working === null && outcome === null;

  const setBusyState = (next: 'moving' | 'reverting' | null) => {
    setWorking(next);
    onBusy?.(next !== null);
  };

  const go = async () => {
    if (!proposals) return;
    const plan: MovePlanItem[] = bookings.map((b) => ({ appointmentId: b.id, calendarId: b.calendarId!, fromStartUtc: b.startUtc, toStartUtc: proposals.get(b.id)!, notify: notify[b.id] === true }));
    setBusyState('moving');
    const run = await runMoves(plan, (item) => appointmentsApi.reschedule(item.calendarId, item.appointmentId, item.toStartUtc, undefined, { notifyPatient: item.notify }), describeError);
    if (run.failed) {
      setOutcome({ moved: run.moved, failed: `${CONFLICT_TEXT.failed(run.failed.message)}`, reverted: null });
      setBusyState(null);
      return;
    }
    rememberNotify(Object.values(notify).some(Boolean));
    setBusyState(null);
    setOutcome({ moved: run.moved, failed: null, reverted: null });
    onMoved();
  };

  const revert = async () => {
    if (!outcome) return;
    setBusyState('reverting');
    const stuck = await revertMoves(outcome.moved, (item) => appointmentsApi.reschedule(item.calendarId, item.appointmentId, item.fromStartUtc, undefined, { notifyPatient: item.notify }));
    setOutcome({ moved: stuck, failed: null, reverted: stuck.length === 0 ? CONFLICT_TEXT.reverted : CONFLICT_TEXT.revertStuck(stuck.length) });
    setBusyState(null);
  };

  const byId = new Map(bookings.map((b) => [b.id, b]));
  return (
    <Box data-testid="club-conflict" role="group" aria-label={CONFLICT_TEXT.title} sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Alert severity="warning" sx={{ alignItems: 'flex-start' }}>
        <Typography sx={{ fontWeight: 700 }}>{CONFLICT_TEXT.title}</Typography>
        <Typography variant="body2">{CONFLICT_TEXT.lead(bookings.length)} {CONFLICT_TEXT.hint}</Typography>
      </Alert>

      {proposals === null ? <Typography variant="body2" data-testid="club-conflict-searching" sx={{ color: 'text.secondary' }}>{CONFLICT_TEXT.searching}</Typography> : null}

      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }} data-testid="club-conflict-list">
        {bookings.map((b) => {
          const to = proposals?.get(b.id) ?? null;
          return (
            <Box component="li" key={b.id} data-testid={`club-conflict-${b.id}`} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
              <Typography sx={{ fontWeight: 650 }}>{b.patientName?.trim() || 'Bez jména'}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {`${when(b.startUtc)}–${clockOf(b.endUtc)} · ${b.activityName} · ${calendarName(b.calendarId)}`}
              </Typography>
              {proposals !== null ? (
                to ? (
                  <Typography variant="body2" data-testid={`club-conflict-to-${b.id}`} sx={{ mt: 0.5 }}>
                    {`${CONFLICT_TEXT.proposed}: `}
                    <b>{`${when(to)}–${clockOf(new Date(Date.parse(to) + (Date.parse(b.endUtc) - Date.parse(b.startUtc))).toISOString())}`}</b>
                  </Typography>
                ) : (
                  <Typography variant="body2" color="error" data-testid={`club-conflict-none-${b.id}`} sx={{ mt: 0.5 }}>{CONFLICT_TEXT.none}</Typography>
                )
              ) : null}
              <FormControlLabel
                sx={{ mt: 0.25, minHeight: 44 }}
                control={<Checkbox checked={notify[b.id] === true} disabled={working !== null || outcome !== null} onChange={(e) => setNotify((cur) => ({ ...cur, [b.id]: e.target.checked }))} />}
                label={CONFLICT_TEXT.notify}
              />
            </Box>
          );
        })}
      </Box>

      {missing ? <Alert severity="error" data-testid="club-conflict-blocked">{CONFLICT_TEXT.noneBlock}</Alert> : null}

      {outcome?.failed ? (
        <Alert severity="error" data-testid="club-conflict-failure">
          <div>{outcome.failed}</div>
          {outcome.moved.length > 0 ? (
            <div data-testid="club-conflict-moved">
              {CONFLICT_TEXT.alreadyMoved(outcome.moved.map((m) => `${byId.get(m.appointmentId)?.patientName?.trim() || 'rezervace'} → ${when(m.toStartUtc)}`).join('; '))}
            </div>
          ) : null}
        </Alert>
      ) : null}
      {outcome?.reverted ? <Alert severity="info" data-testid="club-conflict-reverted">{outcome.reverted}</Alert> : null}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {outcome?.failed && outcome.moved.length > 0 ? (
          <Button variant="outlined" onClick={() => void revert()} disabled={working !== null} data-testid="club-conflict-revert" sx={{ minHeight: 44 }}>{CONFLICT_TEXT.revert}</Button>
        ) : null}
        {outcome === null ? (
          <Button variant="contained" onClick={() => void go()} disabled={!ready} data-testid="club-conflict-go" sx={{ minHeight: 44 }}>
            {working === 'moving' ? CONFLICT_TEXT.working : CONFLICT_TEXT.go}
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}

export default ClubConflictStep;
