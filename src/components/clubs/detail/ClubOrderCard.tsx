/*
 * ONE club order on the club's page (Etapa 10): status, služba, the činnosti with registered/total, payment and
 * price, and under it "Termíny" - the order's windows as read-only pills. One button row for the whole order:
 * Změnit hráče, Upravit termíny, Zrušit objednávku, Otevřít. The windows are never separate cards with their own
 * cancel - an order that holds several windows is still one thing.
 */
import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchBlockableActivities } from '../../../api/clubBlocks';
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { StatusChip } from '../../ui';
import { todayInPrague } from '../blockLogic';
import { editSessionFor } from '../order/editSession';
import { formatCzk, orderCode } from '../order/orderFormat';
import { CancelOrderDialog } from '../orders/CancelOrderDialog';
import { ChangePlayersDialog } from '../orders/ChangePlayersDialog';
import { rangeText, registeredLine, STATUS_TONE } from '../orders/orderLogic';
import { formatPlayersTotal } from '../panel/seats';
import { orderWindows, termsWord } from '../orders/orderWindows';
import { WindowPills } from '../orders/WindowPills';
import type { CoverageActivity } from '../order/coverage';

export function ClubOrderCard({ order, today, onOpen, onChanged }: {
  order: ClubOrderView;
  /** yyyy-MM-dd. */
  today: string;
  onOpen: (orderId: string) => void;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [players, setPlayers] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const activitiesQuery = useQuery({ queryKey: ['club-block-activities'], queryFn: fetchBlockableActivities, staleTime: 5 * 60 * 1000 });

  const windows = orderWindows(order);
  const live = order.status === 'Requested' || order.status === 'Confirmed';
  const editTerms = (activities?: CoverageActivity[]) => {
    setPlayers(false);
    navigate('/planovani', { state: { pickOrder: { start: editSessionFor(order, activitiesQuery.data ?? [], todayInPrague(), activities) } } });
  };
  const btn = { size: 'small', sx: { minHeight: 44 } } as const;
  const split = order.activitySeats.length > 0 ? registeredLine(order) : '—';

  return (
    <Box
      data-testid="club-order-card"
      data-order-id={order.id}
      data-status={order.status}
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 1.75, opacity: order.status === 'Cancelled' ? 0.7 : 1, minWidth: 0 }}
    >
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
          {`Objednávka ${orderCode(order.id)}`}
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 400 }}>{` · ${order.serviceName || 'Služba nevybrána'}`}</Typography>
        </Typography>
        <StatusChip tone={STATUS_TONE[order.status]} size="sm">{ORDER_STATUS_LABEL[order.status]}</StatusChip>
      </Stack>

      <Stack spacing={0.25} sx={{ mt: 0.75 }}>
        <Typography variant="body2" data-testid="order-card-seats" sx={{ overflowWrap: 'anywhere' }}>
          {split}{order.activitySeats.length > 0 ? ` (${formatPlayersTotal(order.activitySeats)})` : ''}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {`Platba: ${order.paymentMethod === null ? 'zatím neurčena' : PAYMENT_METHOD_LABEL[order.paymentMethod]}`}
          {order.priceQuote !== null ? ` · ${formatCzk(order.priceQuote.totalCzk)}` : ''}
        </Typography>
      </Stack>

      <Box sx={{ mt: 1.25 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
          {windows.length > 0 ? `Termíny (${windows.length} ${termsWord(windows.length)})` : 'Termíny'}
        </Typography>
        {windows.length > 0 ? (
          <WindowPills order={order} today={today} testId="order-card-windows" />
        ) : order.requestedRanges.length > 0 ? (
          <Typography variant="body2" data-testid="order-card-requested">{`Požadováno: ${order.requestedRanges.map(rangeText).join(' · ')}`}</Typography>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Zatím žádný termín.</Typography>
        )}
      </Box>

      <Stack direction="row" data-testid="order-card-actions" sx={{ gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
        {live ? <Button variant="outlined" onClick={() => setPlayers(true)} {...btn}>Změnit hráče</Button> : null}
        {order.status === 'Confirmed' ? <Button variant="outlined" onClick={() => editTerms()} disabled={activitiesQuery.isLoading} {...btn}>Upravit termíny</Button> : null}
        {order.status !== 'Cancelled' && order.status !== 'Completed' ? (
          <Button variant="outlined" color="error" onClick={() => setCancelling(true)} {...btn}>Zrušit objednávku</Button>
        ) : null}
        <Button variant="contained" onClick={() => onOpen(order.id)} data-testid="club-order-link" {...btn}>Otevřít</Button>
      </Stack>

      {players ? (
        <ChangePlayersDialog
          order={order}
          onClose={() => setPlayers(false)}
          onSaved={() => { setPlayers(false); onChanged(); }}
          onEditTerms={order.status === 'Confirmed' ? editTerms : undefined}
        />
      ) : null}
      {cancelling ? <CancelOrderDialog order={order} onClose={() => setCancelling(false)} onCancelled={() => { setCancelling(false); onChanged(); }} /> : null}
    </Box>
  );
}

export default ClubOrderCard;
