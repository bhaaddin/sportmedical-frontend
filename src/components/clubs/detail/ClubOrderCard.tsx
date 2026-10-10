/*
 * ONE club order on the club's page (Etapa 10): status, služba, the činnosti with registered/total, payment and
 * price, and under it "Termíny" - the order's windows as read-only pills. One button row for the whole order:
 * Přidat hráče / rozšířit, Odebrat hráče, Upravit termíny, Zrušit objednávku, Otevřít. The windows are never separate cards with their own
 * cancel - an order that holds several windows is still one thing.
 *
 * Etapa 12: a group (the root and its `addenda`) is ONE card too - "Objednávka {root}", one line per služba of the
 * group, the payment with the group's total, and the windows of all its orders in one date-ordered list. The button
 * row acts on the root (cancelling it asks about the live addenda); an addendum never gets a card of its own.
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
import { rangeText, STATUS_TONE } from '../orders/orderLogic';
import { formatPlayersTotal } from '../panel/seats';
import { groupWindows, termsWord } from '../orders/orderWindows';
import { discountText, formatPricedSeats, orderTotalCzk, priceText, sumMoney } from '../orders/orderMoney';
import { WindowPills } from '../orders/WindowPills';
import { UncoveredNotice } from '../orders/UncoveredNotice';
import type { CoverageActivity } from '../order/coverage';

/** The group's price: the sum of the orders' quotes; null when no order has one. */
export const groupPriceCzk = (orders: readonly Pick<ClubOrderView, 'priceQuote'>[]): number | null => sumMoney(orders)?.totalCzk ?? null;

/** "Základní 0/9 · 1 600 Kč · Komplexní 0/7 · 2 400 Kč (16 hráčů) · 14 400 Kč" - the činnosti with their unit price, the head count and the order's total. */
export function pricedSeatsLine(order: ClubOrderView): string {
  if (order.activitySeats.length === 0) return `— · ${priceText(orderTotalCzk(order))}`;
  return `${formatPricedSeats(order.activitySeats)} (${formatPlayersTotal(order.activitySeats)}) · ${priceText(orderTotalCzk(order))}`;
}

/** "Sportovní diagnostika · Základní 0/9 · 1 600 Kč · Komplexní 0/7 · 2 400 Kč (16 hráčů) · 14 400 Kč" - one služba line of a group card. */
export function serviceLine(order: ClubOrderView): string {
  return `${order.serviceName || 'Služba nevybrána'} · ${pricedSeatsLine(order)}`;
}

/** "Platba: Platí klub (jedna faktura) · Celkem 54 400 Kč · ceník 60 000 Kč · sleva 5 600 Kč" - the discount part only when one applies. */
export function paymentLine(order: ClubOrderView, group: readonly ClubOrderView[]): string {
  const money = sumMoney(group);
  const payment = `Platba: ${order.paymentMethod === null ? 'zatím neurčena' : PAYMENT_METHOD_LABEL[order.paymentMethod]}`;
  if (money === null) return `${payment} · ${priceText(null)}`;
  const discount = discountText(money);
  return `${payment} · Celkem ${formatCzk(money.totalCzk)}${discount !== '' ? ` · ${discount}` : ''}`;
}

export function ClubOrderCard({ order, addenda = [], today, onOpen, onChanged }: {
  order: ClubOrderView;
  /** Etapa 12: the live addenda of this (root) order; the card then shows the whole group as one order. */
  addenda?: readonly ClubOrderView[];
  /** yyyy-MM-dd. */
  today: string;
  onOpen: (orderId: string) => void;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<'add' | 'remove' | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const activitiesQuery = useQuery({ queryKey: ['club-block-activities'], queryFn: fetchBlockableActivities, staleTime: 5 * 60 * 1000 });

  const group = [order, ...addenda];
  const grouped = addenda.length > 0;
  const windows = groupWindows(group);
  const live = order.status === 'Requested' || order.status === 'Confirmed';
  const editTerms = (activities?: CoverageActivity[]) => {
    setPlayers(null);
    navigate('/planovani', { state: { pickOrder: { start: editSessionFor(order, activitiesQuery.data ?? [], todayInPrague(), activities) } } });
  };
  const btn = { size: 'small', sx: { minHeight: 44 } } as const;

  return (
    <Box
      data-testid="club-order-card"
      data-order-id={order.id}
      data-status={order.status}
      data-addenda={addenda.length}
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 1.75, opacity: order.status === 'Cancelled' ? 0.7 : 1, minWidth: 0 }}
    >
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
          {`Objednávka ${orderCode(order.id)}`}
          {grouped ? null : (
            <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 400 }}>{` · ${order.serviceName || 'Služba nevybrána'}`}</Typography>
          )}
        </Typography>
        <StatusChip tone={STATUS_TONE[order.status]} size="sm">{ORDER_STATUS_LABEL[order.status]}</StatusChip>
      </Stack>

      <Stack spacing={0.25} sx={{ mt: 0.75 }}>
        {grouped ? (
          group.map((o) => (
            <Typography key={o.id} variant="body2" data-testid="order-card-service" data-order-id={o.id} sx={{ overflowWrap: 'anywhere' }}>
              {serviceLine(o)}
            </Typography>
          ))
        ) : (
          <Typography variant="body2" data-testid="order-card-seats" sx={{ overflowWrap: 'anywhere' }}>
            {pricedSeatsLine(order)}
          </Typography>
        )}
        <Typography variant="body2" data-testid="order-card-payment" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
          {paymentLine(order, group)}
        </Typography>
      </Stack>

      <Box sx={{ mt: 1.25 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
          {windows.length > 0 ? `Termíny (${windows.length} ${termsWord(windows.length)})` : 'Termíny'}
        </Typography>
        {windows.length > 0 ? (
          <WindowPills order={order} addenda={addenda} today={today} testId="order-card-windows" />
        ) : order.requestedRanges.length > 0 ? (
          <Typography variant="body2" data-testid="order-card-requested">{`Požadováno: ${order.requestedRanges.map((r) => rangeText(r, order)).join(' · ')}`}</Typography>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Zatím žádný termín.</Typography>
        )}
        {group.map((o) => <UncoveredNotice key={o.id} order={o} compact />)}
      </Box>

      <Stack direction="row" data-testid="order-card-actions" sx={{ gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
        {live ? <Button variant="outlined" onClick={() => setPlayers('add')} data-testid="order-card-add-players" {...btn}>Přidat hráče / rozšířit</Button> : null}
        {live ? <Button variant="outlined" onClick={() => setPlayers('remove')} data-testid="order-card-remove-players" {...btn}>Odebrat hráče</Button> : null}
        {order.status === 'Confirmed' ? <Button variant="outlined" onClick={() => editTerms()} disabled={activitiesQuery.isLoading} {...btn}>Upravit termíny</Button> : null}
        {order.status !== 'Cancelled' && order.status !== 'Completed' ? (
          <Button variant="outlined" color="error" onClick={() => setCancelling(true)} {...btn}>Zrušit objednávku</Button>
        ) : null}
        <Button variant="contained" onClick={() => onOpen(order.id)} data-testid="club-order-link" {...btn}>Otevřít</Button>
      </Stack>

      {players !== null ? (
        <ChangePlayersDialog
          order={order}
          intent={players}
          onClose={() => setPlayers(null)}
          onSaved={() => { setPlayers(null); onChanged(); }}
          onEditTerms={order.status === 'Confirmed' ? editTerms : undefined}
        />
      ) : null}
      {cancelling ? <CancelOrderDialog order={order} onClose={() => setCancelling(false)} onCancelled={() => { setCancelling(false); onChanged(); }} /> : null}
    </Box>
  );
}

export default ClubOrderCard;
