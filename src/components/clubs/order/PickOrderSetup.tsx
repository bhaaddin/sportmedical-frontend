/*
 * "Vyplním sám (telefonická objednávka)": the very small form that comes before picking times in the calendar -
 * club, služba, činnosti with Počet. Nothing more is asked here; the terms are painted in the calendar next.
 */
import { useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Radio, RadioGroup, Stack, TextField, Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { clubsApi } from '../../../api/clubs';
import type { Club } from '../../../api/clubs';
import { clinicServicesApi } from '../../../api/clinicServices';
import { fetchBlockableActivities } from '../../../api/clubBlocks';
import { PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import type { PaymentMethod } from '../../../api/clubOrders';
import { useDevice } from '../../../layout/useDevice';
import { SectionLabel } from '../../ui';
import { OrderSeatsSection } from './OrderSeatsSection';
import type { OrderActivityItem } from './OrderSeatsSection';
import { stepSeats, totalSeatsOf } from './orderLogic';
import type { SeatsText } from './orderLogic';
import { parsePlayerCount } from '../blockLogic';
import type { PickParent, PickSession } from './pickSession';
import { orderCode } from './orderFormat';

const STALE = 5 * 60 * 1000;

export function PickOrderSetup({ open, onClose, defaultClubId, parent, onStart }: {
  open: boolean;
  onClose: () => void;
  defaultClubId?: string;
  /** Etapa 5: an addendum to this order - the club and the payment are the parent's and cannot be changed. */
  parent?: PickParent;
  onStart: (session: PickSession) => void;
}) {
  const device = useDevice();
  const fieldSize = device === 'desktop' ? 'small' : 'medium';
  const clubsQuery = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => { const l = await clubsApi.getAll(false); return Array.isArray(l) ? l : []; },
    enabled: open,
    staleTime: STALE,
  });
  const servicesQuery = useQuery({ queryKey: ['club-order-services'], queryFn: () => clinicServicesApi.list(), enabled: open, staleTime: STALE, retry: false });
  const activitiesQuery = useQuery({ queryKey: ['club-block-activities'], queryFn: fetchBlockableActivities, enabled: open, staleTime: STALE });

  const clubs = useMemo(() => (clubsQuery.data ?? []).filter((c) => c.isActive), [clubsQuery.data]);
  const services = useMemo(
    () => [...(servicesQuery.data ?? []).filter((s) => s.isActive)].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs')),
    [servicesQuery.data],
  );

  const [clubId, setClubId] = useState(parent?.clubId ?? defaultClubId ?? '');
  const [serviceState, setServiceState] = useState('');
  const serviceId = serviceState !== '' ? serviceState : services.length === 1 ? services[0].id : '';
  const [ids, setIds] = useState<string[]>([]);
  const [text, setText] = useState<SeatsText>({});
  const [payment, setPayment] = useState<PaymentMethod>(parent?.paymentMethod ?? 'ClubInvoice');
  const paymentLocked = parent !== undefined && parent.paymentMethod !== null;
  const [showErrors, setShowErrors] = useState(false);

  const club: Club | null = clubs.find((c) => c.id === clubId) ?? null;
  const items: OrderActivityItem[] = useMemo(
    () =>
      (activitiesQuery.data ?? [])
        .filter((a) => serviceId !== '' && a.clinicServiceId === serviceId)
        .map((a) => ({ id: a.id, name: a.name, durationMinutes: a.durationMinutes, color: a.colorHex, unitPriceCzk: null, registered: null })),
    [activitiesQuery.data, serviceId],
  );

  if (!open) return null;

  const total = totalSeatsOf(ids, text);
  const seatsOk = ids.length > 0 && ids.every((id) => parsePlayerCount(text[id] ?? '') !== null);
  const ready = clubId !== '' && serviceId !== '' && seatsOk;

  const changeService = (id: string) => {
    setServiceState(id);
    setIds([]);
    setText({});
  };

  const start = () => {
    setShowErrors(true);
    if (!ready || club === null) return;
    const service = services.find((s) => s.id === serviceId);
    const catalogue = activitiesQuery.data ?? [];
    onStart({
      clubId,
      clubName: club.name,
      serviceId,
      serviceName: service?.name ?? '',
      activities: ids.flatMap((id) => {
        const a = catalogue.find((x) => x.id === id);
        const seats = parsePlayerCount(text[id] ?? '');
        return a === undefined || seats === null
          ? []
          : [{ activityId: id, name: a.name, seats, minutesPerSeat: a.durationMinutes, parallelCapacity: Math.max(1, a.parallelCapacity) }];
      }),
      paymentMethod: paymentLocked ? (parent?.paymentMethod ?? payment) : payment,
      note: '',
      ...(parent !== undefined ? { parentOrderId: parent.orderId } : {}),
    });
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={device === 'phone'} aria-labelledby="pick-setup-title">
      <DialogTitle id="pick-setup-title">{parent !== undefined ? 'Dodatek k objednávce' : 'Telefonická objednávka'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }} data-testid="pick-setup">
          {parent !== undefined ? (
            <Alert severity="info" data-testid="pick-setup-parent">
              {`Dodatek k objednávce ${orderCode(parent.orderId)}`}
              {parent.clubName !== '' ? ` (${parent.clubName})` : ''}. Půjde na stejnou fakturu; klub a způsob platby se přebírají z původní objednávky.
            </Alert>
          ) : null}
          <Autocomplete
            options={clubs}
            loading={clubsQuery.isLoading}
            value={club}
            disabled={parent !== undefined}
            getOptionLabel={(c) => c.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText="Žádný takový klub — založte ho v sekci Kluby."
            loadingText="Načítám…"
            onChange={(_e, value) => setClubId(value?.id ?? '')}
            renderInput={(params) => (
              <TextField {...params} size={fieldSize} label="Klub" error={showErrors && clubId === ''} helperText={showErrors && clubId === '' ? 'Vyberte klub.' : undefined} />
            )}
          />
          <TextField
            select size={fieldSize} label="Služba" value={serviceId} onChange={(e) => changeService(e.target.value)}
            error={showErrors && serviceId === ''} helperText={showErrors && serviceId === '' ? 'Vyberte službu.' : undefined}
          >
            {services.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
          <OrderSeatsSection
            serviceChosen={serviceId !== ''}
            items={items}
            checked={ids}
            text={text}
            errors={{}}
            total={total}
            listError={ids.length === 0 ? 'Vyberte aspoň jednu činnost a zadejte počet hráčů.' : !seatsOk ? 'Zadejte počet hráčů (celé číslo od 1) u každé vybrané činnosti.' : undefined}
            showErrors={showErrors}
            fieldSize={fieldSize}
            disabled={false}
            onToggle={(id) => {
              setIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
              setText((t) => (id in t ? t : { ...t, [id]: '' }));
            }}
            onChange={(id, value) => setText((t) => ({ ...t, [id]: value }))}
            onStep={(id, delta) => setText((t) => ({ ...t, [id]: stepSeats(t[id] ?? '', delta) }))}
          />
          <div>
            <SectionLabel>Způsob platby</SectionLabel>
            <RadioGroup row value={paymentLocked ? (parent?.paymentMethod ?? payment) : payment} onChange={(e) => setPayment(e.target.value as PaymentMethod)} aria-label="Způsob platby">
              {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                <FormControlLabel key={m} value={m} control={<Radio />} disabled={paymentLocked} label={PAYMENT_METHOD_LABEL[m]} />
              ))}
            </RadioGroup>
          </div>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Termíny vyberete hned potom přímo v kalendáři — tažením myší přes volný čas.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>Zavřít</Button>
        <Button variant="contained" onClick={start}>Vybrat termíny v kalendáři</Button>
      </DialogActions>
    </Dialog>
  );
}

export default PickOrderSetup;
