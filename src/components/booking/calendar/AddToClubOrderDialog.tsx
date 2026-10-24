/*
 * "Přidat do objednávky klubu" (Etapa 12): the SECOND way to add calendar time to a club order. The first is
 * `ChangePlayersDialog`'s "Pokračovat: vybrat termíny", started from the order itself, which enlarges an order
 * whose numbers now need more time than its windows hold. This one starts from a PLAIN mark in the calendar (the
 * desk painted a free range the normal way, outside pick mode): pick the club, then one of its live orders
 * (Requested or Confirmed), optionally restrict the new window to some of the order's činnosti (Etapa 10 routing),
 * and save with ONE `update` call that merges the marked range into the order's existing windows. Seats are never
 * touched here.
 *
 * Per Etapa 9's "club in one place" rule a club ORDER is still only ever CREATED via "Klubová objednávka" - this
 * dialog never offers that; it only attaches time to an order that already exists.
 */
import { Suspense, lazy, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List,
  ListItemButton, TextField, Typography,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { Calendar } from '../../../api/bookingContracts';
import { clubsApi } from '../../../api/clubs';
import type { Club } from '../../../api/clubs';
import { ClubOrderError, clubOrdersApi } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { useDevice } from '../../../layout/useDevice';
import { isOverrideForbidden, workerBusyOf, type WorkerBusy } from '../../../api/workerBusy';
import type { DateOnly } from '../../../utils/time';
import { invalidateClubWorld } from '../../clubs/clubWorld';
import { editBlockRefs } from '../../clubs/order/editSession';
import { orderCode, rangeLine } from '../../clubs/order/orderFormat';
import { rowFromRange, rowIndexForError } from '../../clubs/order/orderLogic';
import { firstWord, normalizeAllowed, toggleAllowed, type RoutedActivity } from '../../clubs/order/routing';
import { isLiveOrder, orderWindows, routedActivities, shortSplit, termsWord } from '../../clubs/orders/orderWindows';
import { appointmentsApi } from '../../../api/appointments';
import type { DayAppointment } from '../../../api/bookingContracts';
import { clubWindowsOf, collidingBookings, isTimeTakenRefusal, type ClubWindow } from './clubConflict';
import { ordersRangesOf, pickedCalendarIds, picksFromRanges } from './pickLogic';
import { pickedLabel, type PickedRange, type PickedTime } from './multiSelect';

const STALE = 60 * 1000;
/* R4 / R17: the owner's override with a reason - the same panel as the booking dialog, loaded only when a refusal needs it */
const ClubConflictStep = lazy(() => import('./ClubConflictStep'));
const WorkerBusyNotice = lazy(() => import('../WorkerBusyNotice').then((m) => ({ default: m.WorkerBusyNotice })));

/** The order's current windows, as picks a fresh `update` call can be built from (same recipe as `usePickOrder.start`). */
function existingPicks(order: ClubOrderView): PickedTime[] {
  let n = 0;
  return editBlockRefs(order).flatMap((b) =>
    picksFromRanges([b.range], b.calendarId, (id) => id).map((p) => ({ ...p, id: `ex-${n++}` })),
  );
}

/** The marked range as one more pick, on top of the order's own. A day range (no calendar of its own) joins every calendar shown. */
function markedPicks(marked: PickedRange, calendars: readonly Calendar[], allowedIds: string[] | null): PickedTime[] {
  const withIds = allowedIds !== null && allowedIds.length > 0 ? { activityIds: allowedIds } : {};
  if (marked.kind === 'time') {
    return [{ id: 'new-0', kind: 'time', columnKey: marked.calendarId, calendarId: marked.calendarId, activityId: null, dayKey: marked.dayKey, range: marked.range, ...withIds }];
  }
  let n = 0;
  return calendars.flatMap((c) =>
    picksFromRanges([{ fromDate: marked.from, toDate: marked.to, ...withIds }], c.id, (id) => id).map((p) => ({ ...p, id: `new-${n++}` })),
  );
}

function OrderRow({ order, onPick }: { order: ClubOrderView; onPick: () => void }) {
  const count = orderWindows(order).length;
  return (
    <ListItemButton onClick={onPick} data-testid="add-to-club-order-row" sx={{ borderRadius: 2, mb: 0.5, minHeight: 56, border: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{`${orderCode(order.id)} · ${order.serviceName}`}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{`${shortSplit(order)} · ${count} ${termsWord(count)}`}</Typography>
      </Box>
    </ListItemButton>
  );
}

/** The toggle chips of the ONE new window: every činnost of the order (all on by default), "Vše" puts everything back. Fewer than two činnosti = no chips, nothing to restrict. */
function ActivityPickChips({ activities, allowed, onToggle, onAll, disabled }: {
  activities: readonly RoutedActivity[];
  allowed: string[] | null;
  onToggle: (activityId: string) => void;
  onAll: () => void;
  disabled: boolean;
}) {
  return (
    <Box data-testid="add-to-club-chips" data-restricted={allowed === null ? 'false' : 'true'} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
      <Chip
        label="Vše"
        size="small"
        clickable
        disabled={disabled}
        data-testid="add-to-club-chip-all"
        aria-pressed={allowed === null}
        color={allowed === null ? 'primary' : 'default'}
        variant={allowed === null ? 'filled' : 'outlined'}
        onClick={onAll}
        sx={{ height: 32, borderRadius: 4, fontWeight: 700 }}
      />
      {activities.map((a) => {
        const on = allowed === null || allowed.includes(a.activityId);
        return (
          <Chip
            key={a.activityId}
            label={firstWord(a.name)}
            title={a.name}
            size="small"
            clickable
            disabled={disabled}
            data-testid="add-to-club-chip"
            data-on={on ? 'true' : 'false'}
            aria-pressed={on}
            color={on ? 'primary' : 'default'}
            variant={on ? 'filled' : 'outlined'}
            onClick={() => onToggle(a.activityId)}
            sx={{ height: 32, borderRadius: 4, opacity: on ? 1 : 0.7 }}
          />
        );
      })}
    </Box>
  );
}

export interface AddToClubOrderDialogProps {
  /** The one range just marked in the plain calendar - the dialog itself never paints anything. */
  marked: PickedRange;
  /** The calendars currently shown - used when `marked` is a day range (it has no calendar of its own). */
  calendars: readonly Calendar[];
  /** The calendar's visible service filter, when it narrows to exactly one služba; null shows every live order. */
  serviceId: string | null;
  today: DateOnly;
  onClose: () => void;
  /** The merge was saved: the caller clears the marked selection, refreshes and closes. */
  onAdded: (order: ClubOrderView) => void;
}

export function AddToClubOrderDialog({ marked, calendars, serviceId, today, onClose, onAdded }: AddToClubOrderDialogProps) {
  const device = useDevice();
  const desktop = device === 'desktop';
  const queryClient = useQueryClient();

  const clubsQuery = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => { const l = await clubsApi.getAll(false); return Array.isArray(l) ? l : []; },
    staleTime: STALE,
  });
  const clubs = useMemo(() => (clubsQuery.data ?? []).filter((c) => c.isActive), [clubsQuery.data]);

  const [club, setClub] = useState<Club | null>(null);
  const ordersQuery = useQuery({
    queryKey: ['club-orders', 'add-to-order', club?.id],
    queryFn: () => clubOrdersApi.list({ clubId: club?.id ?? '' }),
    enabled: club !== null,
    staleTime: 0,
  });
  const liveOrders = useMemo(() => {
    const all = (ordersQuery.data ?? []).filter(isLiveOrder);
    return serviceId !== null ? all.filter((o) => o.serviceId === serviceId) : all;
  }, [ordersQuery.data, serviceId]);

  const [order, setOrder] = useState<ClubOrderView | null>(null);
  const routable = useMemo(() => (order === null ? [] : routedActivities(order)), [order]);
  const [allowedIds, setAllowedIds] = useState<string[] | null>(null);
  const allowed = useMemo(() => normalizeAllowed(allowedIds, routable.map((a) => a.activityId)), [allowedIds, routable]);

  const [failure, setFailure] = useState<{ message: string; conflict: string | null } | null>(null);
  const [affected, setAffected] = useState<{ message: string; list: ClubOrderError['affectedAthletes'] } | null>(null);
  /* R4: the worker is busy in another calendar: the clash is named, and an owner / administrator may go over it with a reason */
  const [busy, setBusy] = useState<{ busy: WorkerBusy; forbidden: boolean } | null>(null);

  /* R24: the refusal was "the time is taken" and patients' bookings are in the way: list them, propose new slots, move, then place the club */
  const [conflict, setConflict] = useState<{ bookings: DayAppointment[]; staying: DayAppointment[]; windows: ClubWindow[] } | null>(null);
  const [moving, setMoving] = useState(false);
  const picks = useMemo(
    () => (order === null ? [] : [...existingPicks(order), ...markedPicks(marked, calendars, allowed)]),
    [order, marked, calendars, allowed],
  );
  const ranges = useMemo(() => ordersRangesOf(picks, today), [picks, today]);
  const calendarIds = useMemo(() => pickedCalendarIds(picks), [picks]);

  const save = useMutation({
    mutationFn: (input: { cancelAffected: boolean; overrideReason?: string }) => {
      if (order === null) throw new ClubOrderError('Vyberte objednávku.');
      return input.overrideReason === undefined
        ? clubOrdersApi.update(order.id, { ranges, calendarIds }, input.cancelAffected)
        : clubOrdersApi.update(order.id, { ranges, calendarIds }, input.cancelAffected, input.overrideReason);
    },
    onSuccess: async (saved) => {
      setBusy(null);
      await invalidateClubWorld(queryClient);
      toast.success(`Přidáno do objednávky ${orderCode(saved.id)}.`);
      onAdded(saved);
    },
    onError: (error) => {
      const refused = workerBusyOf(error);
      if (refused !== null) {
        setFailure(null);
        setAffected(null);
        setBusy({ busy: refused, forbidden: false });
        return;
      }
      if (isOverrideForbidden(error)) {
        setFailure(null);
        setBusy((cur) => (cur ? { ...cur, forbidden: true } : cur));
        return;
      }
      setBusy(null);
      const e = error instanceof ClubOrderError ? error : new ClubOrderError('Nepodařilo se přidat do objednávky.');
      if (e.status === 409 && e.affectedAthletes.length > 0) {
        setFailure(null);
        setAffected({ message: e.message, list: e.affectedAthletes });
        return;
      }
      setAffected(null);
      const index = rowIndexForError(e, ranges.map(rowFromRange));
      const range = index === null ? null : ranges[index];
      setFailure({ message: e.message, conflict: range === null ? null : rangeLine(range) });
      if (isTimeTakenRefusal(e)) void findConflict();
    },
  });

  /* the bookings that really stand in the club's windows (the server's answer names none, the calendar's own list does) */
  async function findConflict() {
    const windows = clubWindowsOf(ranges);
    if (windows.length === 0) return;
    const days = windows.map((w) => w.day).sort();
    try {
      const all = await appointmentsApi.range(days[0]!, days[days.length - 1]!, calendarIds);
      const inWay = collidingBookings(windows, calendarIds, all);
      if (inWay.length === 0) return;
      const ids = new Set(inWay.map((a) => a.id));
      setFailure(null);
      setConflict({ bookings: inWay, staying: all.filter((a) => !ids.has(a.id)), windows });
    } catch {
      /* the list could not be read: the plain refusal stays */
    }
  }

  /* R24 on a server that does not refuse a club over a booking (it answers 200): look BEFORE saving, so nobody is overlapped or moved unasked.
   * Only what the staff just marked is checked (the order's own days hold the club's players), and a club player is never "in the way". */
  async function bookingsInTheMarkedTime(): Promise<boolean> {
    const fresh = markedPicks(marked, calendars, allowed);
    const freshWindows = clubWindowsOf(ordersRangesOf(fresh, today));
    if (freshWindows.length === 0) return false;
    const days = freshWindows.map((w) => w.day).sort();
    try {
      const all = await appointmentsApi.range(days[0]!, days[days.length - 1]!, pickedCalendarIds(fresh));
      const inWay = collidingBookings(freshWindows, pickedCalendarIds(fresh), all).filter((a) => !a.partnerName);
      if (inWay.length === 0) return false;
      const ids = new Set(inWay.map((a) => a.id));
      setFailure(null);
      setConflict({ bookings: inWay, staying: all.filter((a) => !ids.has(a.id)), windows: clubWindowsOf(ranges) });
      return true;
    } catch {
      return false; // the list could not be read: save as before, the server's own refusal still lands in the same step
    }
  }

  async function submit() {
    setMoving(true);
    try {
      if (await bookingsInTheMarkedTime()) return;
    } finally {
      setMoving(false);
    }
    save.mutate({ cancelAffected: affected !== null });
  }

  const pending = save.isPending || moving;

  const chooseClub = (next: Club | null) => {
    setClub(next);
    setOrder(null);
    setAllowedIds(null);
    setFailure(null);
    setAffected(null);
    setBusy(null);
    setConflict(null);
  };
  const chooseOrder = (next: ClubOrderView) => {
    setOrder(next);
    setAllowedIds(null);
    setFailure(null);
    setAffected(null);
    setBusy(null);
  };

  return (
    <Dialog open onClose={pending ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={!desktop} aria-labelledby="add-to-club-order-title" data-testid="add-to-club-order-dialog">
      <DialogTitle id="add-to-club-order-title" sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, pb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>Přidat do objednávky klubu</Typography>
          <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.secondary', fontWeight: 400 }}>{`Přidá ${pickedLabel(marked)} do existující objednávky`}</Typography>
        </Box>
        <IconButton aria-label="Zavřít" onClick={onClose} disabled={pending} sx={{ width: 44, height: 44, flexShrink: 0 }}><Close /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Autocomplete
            options={clubs}
            loading={clubsQuery.isLoading}
            value={club}
            disabled={pending}
            getOptionLabel={(c) => c.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText="Žádný takový klub."
            loadingText="Načítám…"
            onChange={(_e, value) => chooseClub(value)}
            renderInput={(params) => <TextField {...params} label="Klub" autoFocus />}
          />

          {club !== null && order === null ? (
            ordersQuery.isLoading ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Načítám objednávky…</Typography>
            ) : liveOrders.length === 0 ? (
              <Alert severity="info" data-testid="add-to-club-empty">
                Tento klub nemá žádnou otevřenou objednávku. Založte novou přes Klubová objednávka.
              </Alert>
            ) : (
              <List data-testid="add-to-club-order-list" sx={{ py: 0 }}>
                {liveOrders.map((o) => <OrderRow key={o.id} order={o} onPick={() => chooseOrder(o)} />)}
              </List>
            )
          ) : null}

          {order !== null ? (
            <Box sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'divider', p: 1.5 }} data-testid="add-to-club-selected">
              <Typography sx={{ fontWeight: 700 }}>{`${orderCode(order.id)} · ${order.serviceName}`}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{pickedLabel(marked)}</Typography>
              {!desktop ? (
                <Button size="small" onClick={() => setOrder(null)} disabled={pending} sx={{ mt: 0.5, px: 0 }}>Vybrat jinou objednávku</Button>
              ) : null}
              {routable.length > 1 ? (
                <ActivityPickChips
                  activities={routable}
                  allowed={allowed}
                  onToggle={(id) => setAllowedIds((cur) => toggleAllowed(cur, id, routable.map((a) => a.activityId)))}
                  onAll={() => setAllowedIds(null)}
                  disabled={pending}
                />
              ) : null}
            </Box>
          ) : null}

          {affected !== null ? (
            <Alert severity="warning" role="alert" data-testid="add-to-club-affected" sx={{ alignItems: 'flex-start' }}>
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{affected.message}</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>{`Dotčení sportovci (${affected.list.length}):`}</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 200, overflowY: 'auto' }} data-testid="add-to-club-athletes">
                {affected.list.map((a, i) => (
                  <li key={`${a.name}-${i}`}><Typography variant="body2">{[a.name, a.activityName].filter(Boolean).join(' — ')}</Typography></li>
                ))}
              </Box>
            </Alert>
          ) : null}
          {busy !== null ? (
            <Suspense fallback={null}>
              <WorkerBusyNotice
                busy={busy.busy}
                forbidden={busy.forbidden}
                working={pending}
                onOverride={(reason) => save.mutate({ cancelAffected: affected !== null, overrideReason: reason })}
              />
            </Suspense>
          ) : null}
          {conflict !== null ? (
            <Suspense fallback={null}>
              <ClubConflictStep
                bookings={conflict.bookings}
                staying={conflict.staying}
                windows={conflict.windows}
                calendarName={(id) => calendars.find((c) => c.id === id)?.name ?? 'Kalendář'}
                today={today}
                onBusy={setMoving}
                describeError={(error) => (error instanceof Error && error.message ? error.message : 'Přesun se nepodařil.')}
                onMoved={() => {
                  setConflict(null);
                  save.mutate({ cancelAffected: false });
                }}
              />
            </Suspense>
          ) : null}
          {failure !== null ? (
            <Alert severity="error" data-testid="add-to-club-failure">
              {failure.message}
              {failure.conflict !== null ? <Box component="div" sx={{ fontWeight: 700 }}>{`Kolize: ${failure.conflict}`}</Box> : null}
            </Alert>
          ) : null}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.75, gap: 1, flexWrap: 'wrap', justifyContent: desktop ? 'flex-end' : 'stretch' }}>
        <Button variant="outlined" onClick={onClose} disabled={pending} sx={{ minHeight: 44, flex: desktop ? undefined : 1 }}>Zavřít</Button>
        <Button
          variant="contained"
          color={affected !== null ? 'error' : 'primary'}
          onClick={() => void submit()}
          disabled={pending || order === null}
          data-testid="add-to-club-confirm"
          sx={{ minHeight: 44, flex: desktop ? undefined : 2 }}
        >
          {pending ? 'Ukládám…' : affected !== null ? 'Potvrdit a zrušit rezervace' : 'Přidat do objednávky'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddToClubOrderDialog;
