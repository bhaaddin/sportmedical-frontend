/*
 * The club's older bulk reservation (partner order): the athletes' registration link, how many places are
 * taken, who took them, the money and its actions (add places, invoice, print). Moved out of the old right
 * panel so nothing is lost when the detail becomes a presentation page.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Skeleton, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { appointmentsApi } from '../../../api/appointments';
import { partnerOrdersApi } from '../../../api/partnerOrders';
import type { PartnerOrderDetail } from '../../../api/partnerOrders';
import { clubRegistrationLink } from '../../../api/publicClub';
import type { Club } from '../../../api/clubs';
import { useDevice } from '../../../layout/useDevice';
import { formatPragueDate } from '../../../utils/time';
import { ClubScheduleReport } from '../../booking/ClubScheduleReport';
import { SectionLabel, SoftCard, StatusChip } from '../../ui';
import type { ChipTone } from '../../ui';
import { formatCzk, formatShortRange, orderDateRange, orderTotal, seatRows } from '../../../pages/clubs/clubOrders';
import type { SeatState } from '../../../pages/clubs/clubOrders';

const SEAT_CHIP: Record<SeatState, { tone: ChipTone; label: string }> = {
  registered: { tone: 'green', label: 'Registrován' },
  missingQuestionnaire: { tone: 'beige', label: 'Chybí dotazník' },
  waiting: { tone: 'grey', label: 'Čeká na sportovce' },
};

export function LegacyReservation({
  club, order, percent, priceOf, pricesReady, onInvoice, onReload,
}: {
  club: Club;
  order: PartnerOrderDetail;
  percent: number | null;
  priceOf: (activityId: string) => number | null;
  pricesReady: boolean;
  onInvoice: () => void;
  onReload: () => void;
}) {
  const phone = useDevice() === 'phone';
  const [reportOpen, setReportOpen] = useState(false);
  const [addingSeats, setAddingSeats] = useState(false);
  const range = orderDateRange(order);
  const link = order.token ? clubRegistrationLink(order.token) : null;
  const booked = order.bookedCount ?? 0;
  const requested = order.requestedCount ?? 0;
  const freePlaces = Math.max(0, requested - booked);

  const appointmentsQuery = useQuery({
    queryKey: ['partner-order-seats', order.id, range?.from, range?.to],
    queryFn: () => appointmentsApi.range(range!.from, range!.to, [order.calendarId]),
    enabled: range !== null,
  });
  const seats = seatRows(order, appointmentsQuery.data ?? []);
  const money = orderTotal(order, priceOf, percent);

  const copy = async () => {
    if (link === null) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Odkaz zkopírován');
    } catch {
      toast.error('Odkaz se nepodařilo zkopírovat');
    }
  };

  const email = club.contactEmail || order.contactEmail || '';
  const mailto = link !== null && email !== ''
    ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Registrace sportovců — ${club.name}`)}&body=${encodeURIComponent(
        `Dobrý den,\n\nsportovci klubu ${club.name} se na prohlídku registrují tímto odkazem:\n${link}\n\n` +
          (order.expiresAt ? `Odkaz platí do ${formatPragueDate(order.expiresAt)}.\n\n` : '') + 'S pozdravem',
      )}`
    : null;

  return (
    <Stack spacing={2.5} data-testid="legacy-reservation" sx={{ minWidth: 0 }}>
      <SoftCard>
        <SectionLabel>Registrační odkaz pro sportovce</SectionLabel>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'center' } }}>
          <Box
            data-testid="club-link"
            sx={{
              flex: 1, minWidth: 0, px: 1.75, py: 1.25, borderRadius: 2.5, border: '1px solid', borderColor: 'divider',
              bgcolor: 'background.default', fontFamily: '"JetBrains Mono", Consolas, monospace', fontSize: 13,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: link === null ? 'text.secondary' : 'text.primary',
            }}
          >
            {order.isRevoked ? 'Odkaz byl zrušen.' : (link ?? 'Odkaz zatím není k dispozici — server ho nevrací.')}
          </Box>
          <Button variant="contained" startIcon={<ContentCopy sx={{ fontSize: 16 }} />} disabled={link === null || order.isRevoked} onClick={() => void copy()} sx={{ minHeight: 44 }}>
            Kopírovat
          </Button>
          <Button variant="outlined" component="a" href={mailto ?? undefined} disabled={mailto === null || order.isRevoked} sx={{ minHeight: 44 }}>
            Poslat klubu
          </Button>
        </Stack>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mt: 2.5, mb: 0.75 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Obsazeno {booked} z {requested} míst</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{freePlaces} volných</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={requested > 0 ? Math.min(100, (booked / requested) * 100) : 0} aria-label="Obsazenost míst" />
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
          {order.isRevoked
            ? 'Odkaz byl zrušen — nové registrace přes něj už nejdou. Kdo má termín, ten mu zůstává.'
            : order.expiresAt
              ? `Odkaz platí do ${formatPragueDate(order.expiresAt)}. Každý sportovec si vybere jeden z rezervovaných časů.`
              : 'Každý sportovec si vybere jeden z rezervovaných časů.'}
        </Typography>
      </SoftCard>

      <SoftCard>
        <SectionLabel>Rezervovaná místa</SectionLabel>
        {appointmentsQuery.isError ? (
          <Alert severity="warning" sx={{ mb: 1.5 }} action={<Button color="inherit" size="small" onClick={() => void appointmentsQuery.refetch()}>Zkusit znovu</Button>}>
            Registrované sportovce se nepodařilo načíst.
          </Alert>
        ) : null}
        {appointmentsQuery.isLoading ? (
          <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={44} />)}</Stack>
        ) : seats.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Objednávka zatím nemá žádná místa — přidejte je tlačítkem Přidat místa.</Typography>
        ) : phone ? (
          <Stack spacing={1} role="list" aria-label="Rezervovaná místa">
            {seats.map((seat) => (
              <Box key={seat.key} role="listitem" sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, p: 1.5 }}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{seat.name ?? '—'}</Typography>
                  <StatusChip tone={SEAT_CHIP[seat.state].tone} size="sm">{SEAT_CHIP[seat.state].label}</StatusChip>
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {[seat.name === null ? 'volné místo' : seat.activityName, seat.when || null].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <TableContainer sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Table size="small" aria-label="Rezervovaná místa">
              <TableHead>
                <TableRow><TableCell>Sportovec</TableCell><TableCell>Činnost</TableCell><TableCell>Termín</TableCell><TableCell>Stav</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {seats.map((seat) => (
                  <TableRow key={seat.key} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{seat.name ?? '—'}</TableCell>
                    <TableCell sx={{ color: seat.name === null ? 'text.secondary' : 'text.primary' }}>{seat.name === null ? 'volné místo' : seat.activityName}</TableCell>
                    <TableCell>{seat.when || '—'}</TableCell>
                    <TableCell><StatusChip tone={SEAT_CHIP[seat.state].tone}>{SEAT_CHIP[seat.state].label}</StatusChip></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SoftCard>

      <SoftCard>
        <SectionLabel>Objednávka</SectionLabel>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          {money.seats} míst
          {order.items.length > 0 ? ` · ${order.items.map((i) => i.activityName).join(', ')}` : ''}
          {range !== null ? ` · ${formatShortRange(range.from, range.to)}` : ''}
        </Typography>
        <Typography sx={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
          {money.total === null ? (pricesReady ? '—' : '…') : formatCzk(money.total)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, mb: 2 }}>{money.explain}</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" onClick={() => setAddingSeats(true)} disabled={order.isRevoked} sx={{ minHeight: 44 }}>Přidat místa</Button>
          <Button variant="outlined" onClick={onInvoice} sx={{ minHeight: 44 }}>Vystavit fakturu</Button>
          <Button variant="text" size="small" onClick={() => setReportOpen(true)} sx={{ minHeight: 44 }}>Rozpis / tisk</Button>
        </Stack>
        <ClubScheduleReport order={order} open={reportOpen} onClose={() => setReportOpen(false)} />
        {addingSeats ? <AddSeatsDialog order={order} onClose={() => setAddingSeats(false)} onSaved={onReload} /> : null}
      </SoftCard>
    </Stack>
  );
}

function AddSeatsDialog({ order, onClose, onSaved }: { order: PartnerOrderDetail; onClose: () => void; onSaved: () => void }) {
  const [activityId, setActivityId] = useState(order.items[0]?.activityId ?? '');
  const [count, setCount] = useState('1');
  const n = Number.parseInt(count, 10);
  const valid = activityId !== '' && Number.isInteger(n) && n > 0;

  const save = useMutation({
    mutationFn: () =>
      partnerOrdersApi.setItems(
        order.calendarId,
        order.id,
        order.items.map((i) => ({ activityId: i.activityId, requestedCount: i.activityId === activityId ? i.requestedCount + n : i.requestedCount })),
      ),
    onSuccess: () => {
      toast.success(`Přidáno ${n} míst`);
      onSaved();
      onClose();
    },
  });

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Přidat místa</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {order.items.length === 0 ? (
            <Alert severity="info">Objednávka zatím nemá žádnou činnost — doplňte ji ve Vyhrazení pro kluby.</Alert>
          ) : (
            <TextField select size="small" label="Činnost" value={activityId} onChange={(e) => setActivityId(e.target.value)}>
              {order.items.map((i) => (
                <MenuItem key={i.activityId} value={i.activityId}>{i.activityName} · nyní {i.requestedCount} míst</MenuItem>
              ))}
            </TextField>
          )}
          <TextField size="small" type="number" label="Kolik míst přidat" value={count} onChange={(e) => setCount(e.target.value)} slotProps={{ htmlInput: { min: 1 } }} />
          {save.isError ? <Alert severity="error">Místa se nepodařilo přidat.</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={save.isPending}>Zrušit</Button>
        <Button variant="contained" disabled={!valid || save.isPending} onClick={() => save.mutate()}>Přidat</Button>
      </DialogActions>
    </Dialog>
  );
}
