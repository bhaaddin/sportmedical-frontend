/* The screen after a save: what was booked, what it costs, and the athletes' link with "Kopírovat". */
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';
import toast from 'react-hot-toast';
import type { ClubOrderView } from '../../../api/clubOrders';
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from '../../../api/clubOrders';
import { clubRegistrationLink } from '../../../api/publicClub';
import { SectionLabel, SoftCard } from '../../ui';
import { PriceLines } from './OrderAnalysisCard';
import { rangeLine } from './orderFormat';
import { orderRanges } from './orderLogic';

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} zkopírován`);
  } catch {
    toast.error('Zkopírování se nepodařilo — označte odkaz a zkopírujte ho ručně.');
  }
}

function LinkRow({ label, url, testId }: { label: string; url: string; testId: string }) {
  return (
    <Box>
      <SectionLabel>{label}</SectionLabel>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <TextField size="small" value={url} fullWidth slotProps={{ htmlInput: { readOnly: true, 'aria-label': label, 'data-testid': testId } }} />
        <Button variant="outlined" startIcon={<ContentCopy />} onClick={() => void copy(url, 'Odkaz')} aria-label={`Kopírovat: ${label}`} sx={{ minHeight: 44, flexShrink: 0 }}>
          Kopírovat
        </Button>
      </Stack>
    </Box>
  );
}

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
      {registrationUrl !== '' ? <LinkRow label="Odkaz pro sportovce (registrace)" url={registrationUrl} testId="registration-url" /> : null}
      {showForm ? <LinkRow label="Odkaz na formulář objednávky" url={order.formUrl} testId="form-url" /> : null}
    </Stack>
  );
}
