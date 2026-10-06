/*
 * Klubová objednávka - Etapa 7: editing an order and processing a club's request. Creating an order is NOT here any
 * more: a new order has one manual flow (the small setup form, then the calendar in pick mode).
 *
 *   edit      `order`: add or remove players, another činnost, the payment, the note
 *   process   `processOrder`: a Requested order from the club's form - adjust it, then confirm
 *
 * The TERMS are never typed here. "Upravit termíny v kalendáři" hands the current numbers to `onEditTerms`, which
 * opens the calendar in pick mode (prefilled with the order's windows when editing, with the club's request as a
 * hint when processing). "Potvrdit podle požadavku" (process) confirms the requested ranges as they are.
 */
import { useMemo, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Radio, RadioGroup, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { calendarsApi } from '../../../api/calendars';
import { fetchBlockableActivities } from '../../../api/clubBlocks';
import { ClubOrderError, clubOrdersApi, PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import type { ClubOrderView, PaymentMethod } from '../../../api/clubOrders';
import { useDevice } from '../../../layout/useDevice';
import { SectionLabel, SoftCard } from '../../ui';
import { parsePlayerCount, todayInPrague } from '../blockLogic';
import { OrderSeatsSection } from './OrderSeatsSection';
import type { OrderActivityItem } from './OrderSeatsSection';
import { OrderSuccess } from './OrderSuccess';
import { editBlockRefs } from './editSession';
import { rangeLine } from './orderFormat';
import { fieldMessage, orderRanges, seatPayload, stepSeats, totalSeatsOf } from './orderLogic';
import type { SeatsText } from './orderLogic';
import type { EditBlockRef, PickSession } from './pickSession';

export interface ClubOrderDialogProps {
  open: boolean;
  onClose: () => void;
  /** Present = edit this order (add/remove players, another činnost, the payment, the note). */
  order?: ClubOrderView;
  /** Present = process this Requested order: adjust it and confirm. */
  processOrder?: ClubOrderView;
  /** "Upravit termíny v kalendáři": the caller opens the calendar in pick mode with this session. */
  onEditTerms?: (session: PickSession) => void;
  onSaved?: (order: ClubOrderView) => void;
}

type Mode = 'edit' | 'process';

const STALE = 5 * 60 * 1000;

export function ClubOrderDialog(props: ClubOrderDialogProps) {
  if (!props.open || (props.order === undefined && props.processOrder === undefined)) return null;
  return <OrderDialogBody {...props} />;
}

function OrderDialogBody({ onClose, order, processOrder, onEditTerms, onSaved }: ClubOrderDialogProps) {
  const device = useDevice();
  const desktop = device === 'desktop';
  const fieldSize = desktop ? 'small' : 'medium';
  const queryClient = useQueryClient();
  const mode: Mode = processOrder !== undefined ? 'process' : 'edit';
  const src = (processOrder ?? order) as ClubOrderView;

  const calendarsQuery = useQuery({ queryKey: ['calendars'], queryFn: calendarsApi.list, staleTime: STALE });
  const activitiesQuery = useQuery({ queryKey: ['club-block-activities'], queryFn: fetchBlockableActivities, staleTime: STALE });
  const allActivities = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);
  const serviceCalendarIds = useMemo(
    () => (calendarsQuery.data ?? []).filter((c) => c.isActive && c.clinicServiceId === src.serviceId).map((c) => c.id),
    [calendarsQuery.data, src.serviceId],
  );

  const [activityIds, setActivityIds] = useState<string[]>(src.activitySeats.map((a) => a.activityId));
  const [seatsText, setSeatsText] = useState<SeatsText>(Object.fromEntries(src.activitySeats.map((a) => [a.activityId, String(a.seats)])));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(src.paymentMethod);
  const [note, setNote] = useState<string>(src.note);

  const [showErrors, setShowErrors] = useState(false);
  const [failure, setFailure] = useState<ClubOrderError | null>(null);
  const [affected, setAffected] = useState<{ message: string; list: ClubOrderError['affectedAthletes'] } | null>(null);
  const [result, setResult] = useState<ClubOrderView | null>(null);

  const activityItems: OrderActivityItem[] = useMemo(() => {
    const items: OrderActivityItem[] = allActivities
      .filter((a) => a.clinicServiceId === src.serviceId)
      .map((a) => {
        const own = src.activitySeats.find((s) => s.activityId === a.id);
        return { id: a.id, name: a.name, durationMinutes: a.durationMinutes, color: a.colorHex, unitPriceCzk: own?.unitPriceCzk ?? null, registered: own?.registered ?? null };
      });
    /* A činnost of the order that the list no longer offers (archived) stays visible so it can be kept or unticked. */
    for (const s of src.activitySeats) {
      if (!items.some((i) => i.id === s.activityId)) {
        items.push({ id: s.activityId, name: s.activityName, durationMinutes: s.durationMinutes, color: null, unitPriceCzk: s.unitPriceCzk, registered: s.registered });
      }
    }
    return items;
  }, [allActivities, src]);

  const toggleActivity = (id: string) => {
    setActivityIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
    setSeatsText((t) => (id in t ? t : { ...t, [id]: '' }));
  };

  const seatNumbers = Object.fromEntries(activityIds.map((id) => [id, parsePlayerCount(seatsText[id] ?? '')]));
  const totalSeats = totalSeatsOf(activityIds, seatsText);
  const seatErrors: Record<string, string> = {};
  if (mode === 'edit') {
    for (const item of activityItems) {
      if (!activityIds.includes(item.id) || item.registered === null) continue;
      const typed = seatNumbers[item.id];
      if (typed !== null && typed !== undefined && typed < item.registered) seatErrors[item.id] = `nejméně ${item.registered}`;
    }
  }
  const seatsListError =
    activityIds.length === 0 ? 'Vyberte aspoň jednu činnost a zadejte počet hráčů.'
      : activityIds.some((id) => seatNumbers[id] === null) ? 'Zadejte počet hráčů (celé číslo od 1) u každé vybrané činnosti.'
        : undefined;
  const paymentError = paymentMethod === null && mode === 'process' ? 'Vyberte způsob platby.' : undefined;
  const invalid = seatsListError !== undefined || Object.keys(seatErrors).length > 0 || paymentError !== undefined;

  const activitySeats = seatPayload(activityIds, seatsText);
  const trimmedNote = note.trim();
  const dirty =
    paymentMethod !== src.paymentMethod || trimmedNote !== src.note.trim()
    || JSON.stringify(activitySeats) !== JSON.stringify(src.activitySeats.map((a) => ({ activityId: a.activityId, seats: a.seats })));

  const clearFailures = () => {
    setFailure(null);
    setAffected(null);
  };

  const save = useMutation({
    mutationFn: async ({ kind, cancelAffected }: { kind: 'save' | 'confirm'; cancelAffected: boolean }): Promise<ClubOrderView> => {
      if (kind === 'save') {
        return clubOrdersApi.update(src.id, { activitySeats, paymentMethod, note: trimmedNote }, cancelAffected);
      }
      if (dirty) await clubOrdersApi.update(src.id, { activitySeats, paymentMethod, note: trimmedNote });
      return clubOrdersApi.confirm(src.id, { calendarIds: serviceCalendarIds, ranges: src.requestedRanges });
    },
    onSuccess: (saved) => {
      for (const key of ['clubs', 'club-orders', 'club-blocks', 'club-summary', 'blocks', 'day-range', 'grid-preview']) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast.success(mode === 'edit' ? 'Objednávka uložena' : 'Objednávka potvrzena');
      onSaved?.(saved);
      if (mode === 'edit') {
        onClose();
        return;
      }
      setResult(saved);
    },
    onError: (error) => {
      const e = error instanceof ClubOrderError
        ? error
        : new ClubOrderError((error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ?? 'Objednávku se nepodařilo uložit.');
      if (mode === 'edit' && e.status === 409 && e.affectedAthletes.length > 0) {
        setFailure(null);
        setAffected({ message: e.message, list: e.affectedAthletes });
        return;
      }
      setAffected(null);
      setFailure(e);
    },
  });

  const submit = (kind: 'save' | 'confirm') => {
    setShowErrors(true);
    clearFailures();
    if (invalid) return;
    save.mutate({ kind, cancelAffected: affected !== null });
  };

  /* The calendar opens in pick mode with these numbers (what the dialog says now, not what was stored). */
  const openCalendar = () => {
    setShowErrors(true);
    if (invalid || onEditTerms === undefined) return;
    const blocks: EditBlockRef[] = mode === 'edit' ? editBlockRefs(src) : [];
    const today = todayInPrague();
    const dates = (mode === 'edit' ? blocks.map((b) => b.range.fromDate) : src.requestedRanges.map((r) => r.fromDate)).filter((d) => d !== '').sort();
    const upcoming = dates.find((d) => d >= today) ?? (mode === 'edit' ? dates[0] : undefined);
    onEditTerms({
      clubId: src.clubId,
      clubName: src.clubName,
      serviceId: src.serviceId ?? '',
      serviceName: src.serviceName,
      activities: activityIds.flatMap((id) => {
        const item = activityItems.find((i) => i.id === id);
        const seats = parsePlayerCount(seatsText[id] ?? '');
        const catalogue = allActivities.find((a) => a.id === id);
        return item === undefined || seats === null
          ? []
          : [{ activityId: id, name: item.name, seats, minutesPerSeat: item.durationMinutes ?? catalogue?.durationMinutes ?? 0, parallelCapacity: Math.max(1, catalogue?.parallelCapacity ?? 1) }];
      }),
      paymentMethod: paymentMethod ?? 'ClubInvoice',
      note: trimmedNote,
      editOrder: {
        mode,
        orderId: src.id,
        dirty,
        requested: mode === 'process' ? src.requestedRanges.map(rangeLine) : [],
        blocks,
        firstDate: upcoming ?? null,
      },
    });
  };

  const serverField = (...keys: string[]) => fieldMessage(failure, ...keys);
  const currentTerms = orderRanges(src, mode === 'process' || src.status !== 'Confirmed');

  const requestCard =
    mode === 'process' ? (
      <SoftCard sx={{ p: 1.75 }} data-testid="order-request">
        <SectionLabel>Požadavek klubu</SectionLabel>
        <Stack spacing={0.5}>
          {src.contact !== null ? (
            <Typography variant="body2" data-testid="request-contact">
              {[src.contact.name, src.contact.phone, src.contact.email].filter((x) => x !== '').join(' · ')}
            </Typography>
          ) : null}
          <Typography variant="body2">{`Počet míst: ${src.totalSeats}`}</Typography>
          <Typography variant="body2">{`Platba: ${src.paymentMethod === null ? 'neuvedeno' : PAYMENT_METHOD_LABEL[src.paymentMethod]}`}</Typography>
          {src.requestedRanges.length > 0 ? (
            <Box component="ul" sx={{ m: 0, pl: 2.25 }} aria-label="Požadované termíny">
              {src.requestedRanges.map((r, i) => (
                <li key={i}><Typography variant="body2">{rangeLine(r)}</Typography></li>
              ))}
            </Box>
          ) : null}
          {src.note !== '' ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>{`Poznámka klubu: ${src.note}`}</Typography> : null}
        </Stack>
      </SoftCard>
    ) : null;

  const paymentSection = (
    <Box data-testid="order-payment">
      <SectionLabel>Způsob platby</SectionLabel>
      <RadioGroup aria-label="Způsob platby" value={paymentMethod ?? ''} onChange={(_e, value) => setPaymentMethod(value as PaymentMethod)}>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ gap: 1 }}>
          {(['ClubInvoice', 'PerPerson'] as const).map((m) => (
            <FormControlLabel
              key={m}
              value={m}
              disabled={save.isPending}
              control={<Radio />}
              label={PAYMENT_METHOD_LABEL[m]}
              sx={{ flex: 1, border: '1px solid', borderColor: paymentMethod === m ? 'primary.main' : 'divider', borderRadius: 2.5, mx: 0, pr: 1.5, minHeight: 52, bgcolor: paymentMethod === m ? 'action.selected' : 'transparent' }}
            />
          ))}
        </Stack>
      </RadioGroup>
      {(showErrors && paymentError) || serverField('paymentMethod') ? (
        <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }}>{paymentError ?? serverField('paymentMethod')}</Typography>
      ) : null}
    </Box>
  );

  const termsSection = (
    <Box data-testid="order-terms">
      <SectionLabel>Termíny</SectionLabel>
      {currentTerms.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Zatím žádné termíny.</Typography>
      ) : (
        <Box component="ul" sx={{ m: 0, pl: 2.25 }} aria-label="Termíny objednávky">
          {currentTerms.map((r, i) => (
            <li key={i}><Typography variant="body2">{rangeLine(r)}</Typography></li>
          ))}
        </Box>
      )}
      {onEditTerms !== undefined ? (
        <Button variant="outlined" onClick={openCalendar} disabled={save.isPending} data-testid="edit-terms" sx={{ mt: 1.25, minHeight: 44 }}>
          Upravit termíny v kalendáři
        </Button>
      ) : null}
      {serverField('ranges') !== undefined ? <Typography variant="caption" sx={{ color: 'error.main', display: 'block', mt: 0.5 }}>{serverField('ranges')}</Typography> : null}
    </Box>
  );

  const title = mode === 'edit' ? 'Upravit objednávku' : 'Zpracovat požadavek klubu';
  const subtitle = result !== null ? 'Hotovo — odkaz pošlete klubu' : `${src.clubName} · ${src.serviceName}`;
  const pending = save.isPending;
  const confirmingAthletes = affected !== null;

  return (
    <Dialog open onClose={pending ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={!desktop} aria-labelledby="club-order-title">
      <DialogTitle id="club-order-title" sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, pb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ display: 'block', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</Typography>
          <Typography component="span" variant="body2" sx={{ display: 'block', color: 'text.secondary', fontWeight: 400 }}>{subtitle}</Typography>
        </Box>
        <IconButton aria-label="Zavřít" onClick={onClose} disabled={pending} sx={{ width: 44, height: 44, flexShrink: 0 }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers data-testid="club-order-form" data-layout={device} data-mode={mode}>
        {result !== null ? (
          <OrderSuccess order={result} />
        ) : (
          <>
            {failure !== null ? <Alert severity="error" sx={{ mb: 2 }} data-testid="order-failure">{failure.message}</Alert> : null}
            {affected !== null ? (
              <Alert severity="warning" role="alert" data-testid="order-affected" sx={{ mb: 2, alignItems: 'flex-start' }}>
                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{affected.message}</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>{`Dotčení sportovci (${affected.list.length}):`}</Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 200, overflowY: 'auto' }}>
                  {affected.list.map((a, i) => (
                    <li key={`${a.name}-${i}`}>
                      <Typography variant="body2">{[a.name, a.activityName].filter(Boolean).join(' — ')}</Typography>
                    </li>
                  ))}
                </Box>
                <Typography variant="body2" sx={{ mt: 1 }}>Pokud změnu potvrdíte, rezervace těchto sportovců se zruší a jejich časy se vrátí do nabídky.</Typography>
              </Alert>
            ) : null}
            <Stack spacing={2.5}>
              {requestCard}
              <OrderSeatsSection
                serviceChosen
                items={activityItems}
                checked={activityIds}
                text={seatsText}
                errors={seatErrors}
                total={totalSeats}
                listError={seatsListError ?? serverField('activitySeats', 'seats')}
                showErrors={showErrors}
                fieldSize={fieldSize}
                disabled={pending}
                onToggle={toggleActivity}
                onChange={(id, value) => setSeatsText((t) => ({ ...t, [id]: value }))}
                onStep={(id, delta) => setSeatsText((t) => ({ ...t, [id]: stepSeats(t[id] ?? '', delta) }))}
              />
              {paymentSection}
              {termsSection}
              <TextField
                size={fieldSize}
                label="Poznámka"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                error={serverField('note') !== undefined}
                helperText={serverField('note')}
                multiline
                minRows={2}
                fullWidth
              />
            </Stack>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.75, gap: 1, flexWrap: 'wrap', justifyContent: desktop ? 'flex-end' : 'stretch' }}>
        {result !== null ? (
          <Button variant="contained" onClick={onClose} sx={{ minHeight: 44, flex: desktop ? undefined : 1 }}>Hotovo</Button>
        ) : (
          <>
            <Button variant="outlined" onClick={onClose} disabled={pending} sx={{ minHeight: 44, flex: desktop ? undefined : 1 }}>Zrušit</Button>
            {mode === 'process' ? (
              <Button variant="contained" onClick={() => submit('confirm')} disabled={pending} sx={{ minHeight: 44, flex: desktop ? undefined : 2 }}>
                {pending ? 'Potvrzuji…' : 'Potvrdit podle požadavku'}
              </Button>
            ) : (
              <Button
                variant="contained"
                color={confirmingAthletes ? 'error' : 'primary'}
                onClick={() => submit('save')}
                disabled={pending || Object.keys(seatErrors).length > 0}
                sx={{ minHeight: 44, flex: desktop ? undefined : 2 }}
              >
                {pending ? 'Ukládám…' : confirmingAthletes ? 'Potvrdit a zrušit rezervace' : 'Uložit změny'}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ClubOrderDialog;
