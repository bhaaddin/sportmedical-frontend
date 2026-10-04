/* The screen after a save: what was booked, what it costs, and the athletes' link with "Kopírovat". */
import { Box, Stack, Typography } from '@mui/material';
import type { ClubOrderView } from '../../../api/clubOrders';
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import { clubRegistrationLink } from '../../../api/publicClub';
import { SoftCard } from '../../ui';
import { LinkCopyRow } from '../orders/LinkCopyRow';
import { PriceLines } from './OrderAnalysisCard';
import { rangeLine } from './orderFormat';
import { orderRanges } from './orderLogic';

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
          <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
            {order.activitySeats.map((a) => (
              <li key={a.activityId}><Typography variant="body2">{`${a.activityName} × ${a.seats}`}</Typography></li>
            ))}
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{`Celkem ${order.totalSeats} míst`}</Typography>
          {ranges.length > 0 ? (
            <Box component="ul" sx={{ m: 0, pl: 2.25 }} aria-label="Termíny">
              {ranges.map((r, i) => (
                <li key={i}><Typography variant="body2">{rangeLine(r)}</Typography></li>
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
