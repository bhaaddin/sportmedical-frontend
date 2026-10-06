/*
 * "Přidat hráče / rozšířit" and "Odebrat hráče" (the same dialog, `intent` only changes the words): add or remove players of a club order without touching anything else. Per činnost a - number +
 * stepper (a činnost of the same služba can be added or taken off), the live total, and what it means for TIME: the
 * order's windows against the new need. When the new numbers need more time than the windows hold, "Pokračovat" does NOT
 * save yet: it opens the calendar in pick mode (all windows painted, the panel showing only the ADDITIONAL need) and the
 * numbers and the new windows are saved together in ONE update there. When fewer players leave the windows clearly too
 * long, the saved dialog says so with a one-click "Upravit termíny". Lowering a činnost below the athletes already registered is refused by the
 * server (409 with the athletes); the desk then confirms explicitly that those reservations are cancelled.
 */
import { useMemo, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { fetchBlockableActivities } from '../../../api/clubBlocks';
import { ClubOrderError, clubOrdersApi } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { useDevice } from '../../../layout/useDevice';
import { parsePlayerCount, plural } from '../blockLogic';
import { invalidateClubWorld } from '../clubWorld';
import { computeCoverage } from '../order/coverage';
import type { CoverageActivity } from '../order/coverage';
import { coverageActivity } from '../order/editSession';
import { OrderSeatsSection } from '../order/OrderSeatsSection';
import type { OrderActivityItem } from '../order/OrderSeatsSection';
import { seatPayload, stepSeats, totalSeatsOf } from '../order/orderLogic';
import type { SeatsText } from '../order/orderLogic';
import { allowsActivity } from '../order/routing';
import { heldMinutes, orderWindows, windowActivityIds } from './orderWindows';

const STALE = 5 * 60 * 1000;
const min = (n: number): string => `${Math.round(n).toLocaleString('cs-CZ')} min`;
const slotsWord = (n: number): string => plural(n, ['slot', 'sloty', 'slotů']);

export function ChangePlayersDialog({ order, intent = 'add', onClose, onSaved, onEditTerms }: {
  order: ClubOrderView;
  /** Only the words differ: 'add' = "Přidat hráče / rozšířit", 'remove' = "Odebrat hráče". */
  intent?: 'add' | 'remove';
  onClose: () => void;
  onSaved: (order: ClubOrderView) => void;
  /** "Upravit termíny" from inside this dialog: the calendar opens with these (not yet saved) numbers. */
  onEditTerms?: (activities: CoverageActivity[]) => void;
}) {
  const device = useDevice();
  const desktop = device === 'desktop';
  const fieldSize = desktop ? 'small' : 'medium';
  const queryClient = useQueryClient();
  const activitiesQuery = useQuery({ queryKey: ['club-block-activities'], queryFn: fetchBlockableActivities, staleTime: STALE });
  const catalogue = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);

  const [ids, setIds] = useState<string[]>(order.activitySeats.map((a) => a.activityId));
  const [text, setText] = useState<SeatsText>(Object.fromEntries(order.activitySeats.map((a) => [a.activityId, String(a.seats)])));
  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [affected, setAffected] = useState<{ message: string; list: ClubOrderError['affectedAthletes'] } | null>(null);
  /** Saved with windows that now hold clearly more than needed: the dialog says so before it closes. */
  const [surplus, setSurplus] = useState<{ order: ClubOrderView; slots: number; minutes: number } | null>(null);

  const items: OrderActivityItem[] = useMemo(() => {
    const list: OrderActivityItem[] = catalogue
      .filter((a) => a.clinicServiceId === order.serviceId)
      .map((a) => {
        const own = order.activitySeats.find((s) => s.activityId === a.id);
        return { id: a.id, name: a.name, durationMinutes: a.durationMinutes, color: a.colorHex, unitPriceCzk: own?.unitPriceCzk ?? null, registered: own?.registered ?? null };
      });
    /* A činnost of the order that the list no longer offers (archived) stays visible so it can be kept or unticked. */
    for (const s of order.activitySeats) {
      if (!list.some((i) => i.id === s.activityId)) {
        list.push({ id: s.activityId, name: s.activityName, durationMinutes: s.durationMinutes, color: null, unitPriceCzk: s.unitPriceCzk, registered: s.registered });
      }
    }
    return list;
  }, [catalogue, order]);

  const total = totalSeatsOf(ids, text);
  const activitySeats = seatPayload(ids, text);
  const listError = ids.length === 0
    ? 'Vyberte aspoň jednu činnost a zadejte počet hráčů.'
    : ids.some((id) => parsePlayerCount(text[id] ?? '') === null)
      ? 'Zadejte počet hráčů (celé číslo od 1) u každé vybrané činnosti.'
      : undefined;
  /* Below the registered athletes: allowed, but it costs reservations - said at once, confirmed after the server answers. */
  const belowRegistered: Record<string, string> = {};
  for (const item of items) {
    const typed = parsePlayerCount(text[item.id] ?? '');
    if (ids.includes(item.id) && item.registered !== null && typed !== null && typed < item.registered) {
      belowRegistered[item.id] = `zruší se ${item.registered - typed} z ${item.registered} zapsaných`;
    }
  }
  const changed = JSON.stringify(activitySeats) !== JSON.stringify(order.activitySeats.map((a) => ({ activityId: a.activityId, seats: a.seats })));

  /* What it means for time: the need before and after, and whether the windows still hold it. */
  const oldActivities = order.activitySeats.map((s) => coverageActivity(s, catalogue));
  const newActivities: CoverageActivity[] = ids.flatMap((id) => {
    const seats = parsePlayerCount(text[id] ?? '');
    const item = items.find((i) => i.id === id);
    if (seats === null || item === undefined) return [];
    const known = order.activitySeats.find((s) => s.activityId === id);
    return [coverageActivity({ activityId: id, activityName: item.name, durationMinutes: item.durationMinutes ?? known?.durationMinutes ?? 0, seats }, catalogue)];
  });
  const needBefore = computeCoverage(oldActivities, 0).neededMinutes;
  const needAfter = computeCoverage(newActivities, 0).neededMinutes;
  /* Etapa 10: a činnost that is new or has other numbers and that no window of the order allows. */
  const windows = orderWindows(order);
  const noWindow = windows.length === 0
    ? []
    : newActivities.filter((a) => {
        const own = order.activitySeats.find((s) => s.activityId === a.activityId);
        const touched = own === undefined || own.seats !== a.seats;
        return touched && a.seats > 0 && !windows.some((w) => allowsActivity(windowActivityIds(w, order), a.activityId));
      });
  const held = heldMinutes(order);
  const shortOf = held === null ? null : computeCoverage(newActivities, held);

  const save = useMutation({
    mutationFn: (cancelAffected: boolean) => clubOrdersApi.update(order.id, { activitySeats }, cancelAffected),
    onSuccess: (saved) => {
      void invalidateClubWorld(queryClient);
      toast.success('Hráči objednávky změněni');
      /* Fewer players: when the windows hold at least one whole slot more than needed, say so (not forced). */
      const shortest = Math.min(...newActivities.filter((a) => a.seats > 0 && a.minutesPerSeat > 0).map((a) => a.minutesPerSeat));
      const extra = held === null ? 0 : held - needAfter;
      if (onEditTerms !== undefined && Number.isFinite(shortest) && extra >= shortest) {
        setSurplus({ order: saved, slots: Math.floor(extra / shortest), minutes: extra });
        return;
      }
      onSaved(saved);
    },
    onError: (error) => {
      const e = error instanceof ClubOrderError ? error : new ClubOrderError('Hráče se nepodařilo změnit.');
      if (e.status === 409 && e.affectedAthletes.length > 0) {
        setFailure(null);
        setAffected({ message: e.message, list: e.affectedAthletes });
        return;
      }
      setAffected(null);
      setFailure(e.message);
    },
  });

  const edit = (fn: () => void) => {
    setAffected(null);
    setFailure(null);
    fn();
  };

  /* More players than the windows hold: go on to pick the extra time; everything is saved there in one call. */
  const enlarge = changed && onEditTerms !== undefined && held !== null && shortOf !== null && shortOf.remainingSlots > 0 && needAfter > needBefore;

  const submit = () => {
    setShowErrors(true);
    if (listError !== undefined || !changed) return;
    if (enlarge) {
      onEditTerms(newActivities);
      return;
    }
    save.mutate(affected !== null);
  };
  const pending = save.isPending;

  return (
    <Dialog open onClose={pending ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={!desktop} aria-labelledby="change-players-title" data-testid="change-players-dialog">
      <DialogTitle id="change-players-title" sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, pb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>{intent === 'remove' ? 'Odebrat hráče' : 'Přidat hráče / rozšířit'}</Typography>
          <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.secondary', fontWeight: 400 }}>{`${order.clubName} · ${order.serviceName}`}</Typography>
        </Box>
        <IconButton aria-label="Zavřít" onClick={onClose} disabled={pending} sx={{ width: 44, height: 44, flexShrink: 0 }}><Close /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {surplus !== null ? (
          <Stack spacing={1.5} data-testid="change-players-surplus">
            <Alert severity="success">Hráči jsou uložení.</Alert>
            <Typography variant="body2" data-testid="change-players-surplus-text">
              {`Navíc ${surplus.slots} ${slotsWord(surplus.slots)} — termíny objednávky drží o ${min(surplus.minutes)} víc, než je potřeba. Termíny můžete zkrátit, nemusíte.`}
            </Typography>
          </Stack>
        ) : (
        <Stack spacing={2}>
          {failure !== null ? <Alert severity="error" data-testid="change-players-failure">{failure}</Alert> : null}
          {affected !== null ? (
            <Alert severity="warning" role="alert" data-testid="change-players-affected" sx={{ alignItems: 'flex-start' }}>
              <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{affected.message}</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>{`Dotčení sportovci (${affected.list.length}):`}</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 200, overflowY: 'auto' }} data-testid="change-players-athletes">
                {affected.list.map((a, i) => (
                  <li key={`${a.name}-${i}`}><Typography variant="body2">{[a.name, a.activityName].filter(Boolean).join(' — ')}</Typography></li>
                ))}
              </Box>
              <Typography variant="body2" sx={{ mt: 1 }}>Pokud počet snížíte, rezervace těchto hráčů se zruší a jejich časy se vrátí do nabídky.</Typography>
            </Alert>
          ) : null}

          <OrderSeatsSection
            serviceChosen
            items={items}
            checked={ids}
            text={text}
            errors={belowRegistered}
            total={total}
            listError={listError}
            showErrors={showErrors}
            fieldSize={fieldSize}
            disabled={pending}
            onToggle={(id) => edit(() => {
              setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
              setText((t) => (id in t ? t : { ...t, [id]: '' }));
            })}
            onChange={(id, value) => edit(() => setText((t) => ({ ...t, [id]: value })))}
            onStep={(id, delta) => edit(() => setText((t) => ({ ...t, [id]: stepSeats(t[id] ?? '', delta) })))}
          />

          <Box data-testid="change-players-summary" sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'divider', p: 1.5 }}>
            <Typography data-testid="change-players-total" sx={{ fontWeight: 700 }}>
              {`Celkem ${total.toLocaleString('cs-CZ')} ${plural(total, ['hráč', 'hráči', 'hráčů'])}`}
              <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 400 }}>{` (dosud ${order.totalSeats})`}</Typography>
            </Typography>
            <Typography variant="body2" data-testid="change-players-time" sx={{ mt: 0.5 }}>
              {needBefore === needAfter
                ? `Potřeba času se nemění (${min(needAfter)}).`
                : `Potřeba času se změní z ${min(needBefore)} na ${min(needAfter)}.`}
            </Typography>
            {noWindow.length > 0 ? (
              <Box data-testid="change-players-no-window" sx={{ mt: 0.75 }}>
                {noWindow.map((a) => (
                  <Typography key={a.activityId} variant="body2" sx={{ color: 'warning.main', fontWeight: 600 }}>
                    {`Pro ${a.name} zatím není žádný termín — povolte ji v některém termínu (Upravit termíny).`}
                  </Typography>
                ))}
              </Box>
            ) : null}
            {held !== null && shortOf !== null ? (
              shortOf.remainingSlots > 0 ? (
                <Box data-testid="change-players-short" sx={{ mt: 0.75 }}>
                  <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 600 }}>
                    {`Termíny objednávky drží ${min(held)} — chybí ještě ${shortOf.remainingSlots} ${slotsWord(shortOf.remainingSlots)}. Přidejte je v kalendáři.`}
                  </Typography>
                  {onEditTerms !== undefined && !enlarge ? (
                    <Button variant="outlined" size="small" disabled={listError !== undefined || pending} onClick={() => onEditTerms(newActivities)} sx={{ mt: 0.75, minHeight: 44 }}>
                      Upravit termíny
                    </Button>
                  ) : null}
                  {enlarge ? (
                    <Typography variant="body2" data-testid="change-players-enlarge" sx={{ mt: 0.5, color: 'text.secondary' }}>
                      Pokračujte na výběr času navíc v kalendáři — hráči i nové termíny se uloží najednou.
                    </Typography>
                  ) : null}
                </Box>
              ) : (
                <Typography variant="body2" data-testid="change-players-enough" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  {`Termíny objednávky stačí (drží ${min(held)}).`}
                </Typography>
              )
            ) : null}
          </Box>
        </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.75, gap: 1, flexWrap: 'wrap', justifyContent: desktop ? 'flex-end' : 'stretch' }}>
        {surplus !== null ? (
          <>
            <Button variant="outlined" onClick={() => onSaved(surplus.order)} sx={{ minHeight: 44, flex: desktop ? undefined : 1 }}>Hotovo</Button>
            <Button variant="contained" data-testid="change-players-edit-terms" onClick={() => onEditTerms?.(newActivities)} sx={{ minHeight: 44, flex: desktop ? undefined : 2 }}>Upravit termíny</Button>
          </>
        ) : (
        <>
        <Button variant="outlined" onClick={onClose} disabled={pending} sx={{ minHeight: 44, flex: desktop ? undefined : 1 }}>Zavřít</Button>
        <Button
          variant="contained"
          color={affected !== null ? 'error' : 'primary'}
          onClick={submit}
          disabled={pending || !changed}
          sx={{ minHeight: 44, flex: desktop ? undefined : 2 }}
        >
          {pending ? 'Ukládám…' : affected !== null ? 'Zrušit rezervace těchto hráčů a snížit' : enlarge ? 'Pokračovat: vybrat termíny' : 'Uložit'}
        </Button>
        </>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ChangePlayersDialog;
