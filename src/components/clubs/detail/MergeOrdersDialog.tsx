/*
 * "Sloučit do jedné objednávky" (Etapa 12, Matko: "THIS whole thing must be ONE order"). The club's live root orders
 * are listed; the desk picks the main one ("Hlavní objednávka", by default the oldest Confirmed) and ticks the others.
 * One call - `POST /club-orders/{root}/merge` - makes the ticked orders addenda of the main one: they keep their
 * windows, players and links and are billed on the one invoice. The server's refusal (409: already invoiced, another
 * club, a different payment) is shown in Czech, next to the order it names when it names one.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, Stack, Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ClubOrderError, clubOrdersApi, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { useDevice } from '../../../layout/useDevice';
import { StatusChip } from '../../ui';
import { invalidateClubWorld } from '../clubWorld';
import { formatCzk, orderCode } from '../order/orderFormat';
import { STATUS_TONE } from '../orders/orderLogic';
import { orderWindows, termsWord } from '../orders/orderWindows';
import { formatPlayersTotal } from '../panel/seats';
import { defaultMainOrder } from './orderGroups';

const paymentText = (o: ClubOrderView): string => (o.paymentMethod === null ? 'platba zatím neurčena' : PAYMENT_METHOD_LABEL[o.paymentMethod]);

/** "KO-FB9C0686 · Sportovní lékařské prohlídky · 27 hráčů · 4 termíny · Platí klub (jedna faktura)" */
export function mergeRowText(o: ClubOrderView): string {
  const n = orderWindows(o).length;
  const players = o.activitySeats.length > 0 ? formatPlayersTotal(o.activitySeats) : `${o.totalSeats} hráčů`;
  return [orderCode(o.id), o.serviceName || 'Služba nevybrána', players, `${n} ${termsWord(n)}`, paymentText(o)].join(' · ');
}

export function MergeOrdersDialog({ orders, onClose, onMerged }: {
  /** The club's live root orders (two or more). */
  orders: readonly ClubOrderView[];
  onClose: () => void;
  /** The merge went through: the caller reloads. */
  onMerged: () => void;
}) {
  const device = useDevice();
  const phone = device === 'phone';
  const queryClient = useQueryClient();
  const [mainId, setMainId] = useState<string>(() => defaultMainOrder(orders)?.id ?? orders[0]?.id ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  const [failure, setFailure] = useState<{ message: string; orderId: string | null } | null>(null);

  const others = orders.filter((o) => o.id !== mainId);
  const chosen = picked.filter((id) => id !== mainId && orders.some((o) => o.id === id));
  const main = orders.find((o) => o.id === mainId);
  const total = [main, ...orders.filter((o) => chosen.includes(o.id))].reduce((sum, o) => sum + (o?.priceQuote?.totalCzk ?? 0), 0);

  const merge = useMutation({
    mutationFn: () => clubOrdersApi.merge(mainId, chosen),
    onSuccess: () => {
      void invalidateClubWorld(queryClient);
      toast.success('Objednávky sloučeny do jedné');
      onMerged();
    },
    onError: (e) => {
      const named = e instanceof ClubOrderError && e.orderId !== null && orders.some((o) => o.id === e.orderId) ? e.orderId : null;
      setFailure({ message: e instanceof Error && e.message.trim() !== '' ? e.message : 'Objednávky se nepodařilo sloučit.', orderId: named });
    },
  });

  const choose = (id: string, on: boolean) => {
    setFailure(null);
    setPicked((p) => (on ? [...new Set([...p, id])] : p.filter((x) => x !== id)));
  };
  const chooseMain = (id: string) => {
    setFailure(null);
    setMainId(id);
    setPicked((p) => p.filter((x) => x !== id));
  };

  return (
    <Dialog open onClose={merge.isPending ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={phone} aria-labelledby="merge-orders-title">
      <DialogTitle id="merge-orders-title">Sloučit do jedné objednávky</DialogTitle>
      <DialogContent data-testid="merge-orders-dialog" data-layout={device}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Vybrané objednávky se stanou dodatky hlavní objednávky: zůstanou jim termíny, hráči i odkazy a klub dostane jednu fakturu.
        </Typography>
        {failure !== null && failure.orderId === null ? <Alert severity="error" sx={{ mb: 1.5 }} data-testid="merge-error">{failure.message}</Alert> : null}

        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>Hlavní objednávka</Typography>
        <Stack component="ul" role="radiogroup" aria-label="Hlavní objednávka" sx={{ m: 0, p: 0, listStyle: 'none' }} data-testid="merge-main-list">
          {orders.map((o) => (
            <Box key={o.id} component="li" data-testid="merge-main-row" data-order-id={o.id}>
              <FormControlLabel
                sx={{ minHeight: 44, m: 0, alignItems: 'flex-start', width: '100%' }}
                control={<Radio checked={mainId === o.id} onChange={() => chooseMain(o.id)} disabled={merge.isPending} sx={{ p: 1 }} slotProps={{ input: { 'aria-label': `Hlavní objednávka ${orderCode(o.id)}` } }} />}
                label={(
                  <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', py: 1 }}>
                    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{mergeRowText(o)}</Typography>
                    <StatusChip tone={STATUS_TONE[o.status]} size="sm">{ORDER_STATUS_LABEL[o.status]}</StatusChip>
                  </Stack>
                )}
              />
            </Box>
          ))}
        </Stack>

        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mt: 2, mb: 0.5 }}>Sloučit do ní</Typography>
        <Stack component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }} data-testid="merge-pick-list">
          {others.map((o) => {
            const on = chosen.includes(o.id);
            const rowError = failure !== null && failure.orderId === o.id ? failure.message : null;
            return (
              <Box key={o.id} component="li" data-testid="merge-pick-row" data-order-id={o.id} data-picked={on ? 'true' : 'false'}>
                <FormControlLabel
                  sx={{ minHeight: 44, m: 0, alignItems: 'flex-start', width: '100%' }}
                  control={<Checkbox checked={on} onChange={(e) => choose(o.id, e.target.checked)} disabled={merge.isPending} sx={{ p: 1 }} slotProps={{ input: { 'aria-label': `Sloučit ${orderCode(o.id)}` } }} />}
                  label={(
                    <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', py: 1 }}>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{mergeRowText(o)}</Typography>
                      <StatusChip tone={STATUS_TONE[o.status]} size="sm">{ORDER_STATUS_LABEL[o.status]}</StatusChip>
                    </Stack>
                  )}
                />
                {rowError !== null ? <Alert severity="error" sx={{ ml: 5, mb: 1 }} data-testid="merge-row-error">{rowError}</Alert> : null}
              </Box>
            );
          })}
        </Stack>

        {main !== undefined && chosen.length > 0 ? (
          <Typography variant="body2" sx={{ mt: 2 }} data-testid="merge-summary">
            {`Po sloučení: Objednávka ${orderCode(main.id)} + ${chosen.length} ${chosen.length === 1 ? 'dodatek' : chosen.length < 5 ? 'dodatky' : 'dodatků'}${total > 0 ? ` · ${formatCzk(total)}` : ''}`}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={onClose} disabled={merge.isPending} sx={{ minHeight: 44 }}>Zpět</Button>
        <Button variant="contained" onClick={() => merge.mutate()} disabled={merge.isPending || chosen.length === 0 || main === undefined} sx={{ minHeight: 44 }} data-testid="merge-confirm">
          {merge.isPending ? 'Slučuji…' : 'Sloučit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MergeOrdersDialog;
