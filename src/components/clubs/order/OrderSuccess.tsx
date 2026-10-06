/* The screen after a save: what was booked, what it costs, and the athletes' link with "Kopírovat". */
import { Box, Stack, Typography } from '@mui/material';
import type { ClubOrderView, OrderPriceQuote } from '../../../api/clubOrders';
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import { clubRegistrationLink } from '../../../api/publicClub';
import { SoftCard } from '../../ui';
import { LinkCopyRow } from '../orders/LinkCopyRow';
import { formatCzk, rangeLine } from './orderFormat';
import { orderRanges } from './orderLogic';
import { routedActivities, type RoutedOrder } from '../orders/orderWindows';
import { allowedNames } from './routing';

/** "5. 11. 2026, 08:00–10:15 · Spiroergometrie" - the činnosti only when the window allows just some of them. */
function withActivities(line: string, range: { activityIds?: string[] | null }, order: RoutedOrder): string {
  const only = allowedNames(range.activityIds, routedActivities(order));
  return only === null ? line : `${line} · ${only}`;
}
import { formatPlayersTotal, formatSeats } from '../panel/seats';

export function OrderSuccess({ order }: { order: ClubOrderView }) {
  const registrationUrl = order.registrationUrl !== '' ? order.registrationUrl : order.registrationToken !== '' ? clubRegistrationLink(order.registrationToken) : '';
  const ranges = orderRanges(order, order.status !== 'Confirmed');
  const showForm = order.formUrl !== '' && (order.status === 'Invited' || order.status === 'Requested');
  return (
    <Stack spacing={2.5} data-testid="order-success">
      <Box>
        <Typography sx={{ fontSize: 18, fontWeight: 700 }}>
          {order.status === 'Confirmed' ? 'Rezervace je v kalendáři' : 'Objednávka je uložena'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>{ORDER_STATUS_LABEL[order.status]}</Typography>
      </Box>
      <SoftCard sx={{ p: 2 }} data-testid="order-summary">
        <Stack spacing={0.75}>
          <Typography sx={{ fontWeight: 700 }}>{order.clubName}</Typography>
          <Typography variant="body2">{`Služba: ${order.serviceName}`}</Typography>
          <Typography variant="body2" data-testid="order-seats-line">{formatSeats(order.activitySeats)}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{`Celkem ${formatPlayersTotal(order.activitySeats)}`}</Typography>
          {ranges.length > 0 ? (
            <Box component="ul" sx={{ m: 0, pl: 2.25 }} aria-label="Termíny">
              {ranges.map((r, i) => (
                <li key={i}><Typography variant="body2">{withActivities(rangeLine(r), r, order)}</Typography></li>
              ))}
            </Box>
          ) : null}
          <Typography variant="body2">{`Platba: ${order.paymentMethod === null ? 'zatím nevybráno' : PAYMENT_METHOD_LABEL[order.paymentMethod]}`}</Typography>
          {order.priceQuote !== null ? <PriceLines quote={order.priceQuote} /> : null}
        </Stack>
      </SoftCard>
      {registrationUrl !== '' ? <LinkCopyRow label="Odkaz pro sportovce (registrace)" path={registrationUrl} testId="registration-url" /> : null}
      {showForm ? <LinkCopyRow label="Odkaz na formulář objednávky" path={order.formUrl} testId="form-url" /> : null}
    </Stack>
  );
}

export function PriceLines({ quote }: { quote: OrderPriceQuote }) {
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2">{`Ceník: ${formatCzk(quote.listTotalCzk)}`}</Typography>
      {quote.discounts.map((d, i) => (
        <Typography key={`${d.kind}-${i}`} variant="body2" sx={{ color: 'text.secondary' }}>
          {`${d.label}${d.percent ? ` (${d.percent} %)` : ''}: −${formatCzk(Math.abs(d.amountCzk))}`}
        </Typography>
      ))}
      <Typography sx={{ fontSize: 15, fontWeight: 700 }} data-testid="quote-total">{`Celkem: ${formatCzk(quote.totalCzk)}`}</Typography>
    </Stack>
  );
}
