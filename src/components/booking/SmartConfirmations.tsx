/* ══════════════════════════════════════════════════════════════
   SMART CONFIRMATIONS — one click each, on the booking itself

   What a doctor or a receptionist does with a booking during the day, in
   the order it happens, with nothing to open first:

     Přišel        one click (bookings.edit)
     Zaplaceno     once arrived: the till, pre-filled with the patient, the
                   service and its price; recorded against the booking
                   (billing.manage, and the activity has a price-list item)
     asi nepřišel  an amber flag after `attendance.noShowAfterMinutes`,
                   with Nepřišel / Přišel beside it - the flag never changes
                   anything by itself
     may change    "pacient může termín sám změnit do …", from
                   `booking.patientChangeDeadlineHours`

   Everything the screen writes goes through the same transition table the
   detail uses (`canChangeStatus`), so a button the server would refuse is
   never offered. Permissions hide; the server refuses.
   ══════════════════════════════════════════════════════════════ */
import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { appointmentsApi } from '../../api/appointments';
import { BookingApiError } from '../../api/apiError';
import { canChangeStatus, isLateStatus, type Activity } from '../../api/bookingContracts';
import { useAttendanceSettings } from '../../api/attendanceSettings';
import { cashierApi, PaymentMethod, type CashierTransaction } from '../../services/cashierApi';
import { usePermission } from '../../auth/usePermission';
import { formatPragueTime } from '../../utils/time';
import { errorText } from './errorText';
import { METHOD_LABELS, SMART_TEXT } from './smartText';
import { formatDeadline, patientChangeSentence, probablyAbsent } from './attendance';

const SCHEDULED = 0;
const CHECKED_IN = 2;
const COMPLETED = 3;
const NO_SHOW = 5;

const czk = (n: number) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(n ?? 0);

/** What the row needs to know about the booking. The day row has all of it. */
export interface SmartBooking {
  id: string;
  calendarId: string | null;
  patientId: string;
  activityId: string;
  startUtc: string;
  status: number;
}

interface SmartConfirmationsProps {
  booking: SmartBooking;
  /** The activity, when known - it carries the price-list item and the price. */
  activity?: Pick<Activity, 'serviceItemId' | 'priceCzk' | 'name'> | null;
  now: Date;
  /** The list this sits in reloads itself after a write. */
  onChanged: () => void;
  /** `row` puts everything on one line; `stack` gives the detail's layout. */
  layout?: 'row' | 'stack';
}

export function SmartConfirmations({ booking, activity, now, onChanged, layout = 'row' }: SmartConfirmationsProps) {
  const { t } = useTranslation();
  const mayEdit = usePermission('bookings.edit');
  const mayBill = usePermission('billing.manage');
  const { settings } = useAttendanceSettings();
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const flagged = probablyAbsent(booking.startUtc, booking.status, settings.noShowAfterMinutes, now);
  const changeSentence = patientChangeSentence(
    booking.startUtc,
    booking.status,
    settings.patientChangeDeadlineHours,
    now,
    formatDeadline,
  );

  const afterWrite = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ['day-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['day-range'] });
    void queryClient.invalidateQueries({ queryKey: ['appointment', booking.calendarId, booking.id] });
    void queryClient.invalidateQueries({ queryKey: ['appointment-history', booking.calendarId, booking.id] });
    onChanged();
  };

  const status = useMutation({
    mutationFn: (to: number) =>
      appointmentsApi.setStatus(booking.calendarId ?? '', booking.id, String(to)),
    onSuccess: afterWrite,
    onError: (e) => {
      setError(e);
      if (e instanceof BookingApiError && e.isConflict) afterWrite();
    },
  });

  /* The till's own record for this booking, read only when it can be acted on. */
  const paymentsWanted = mayBill && (booking.status === CHECKED_IN || booking.status === COMPLETED);
  const payments = useQuery({
    queryKey: ['appointment-payments', booking.id],
    queryFn: () => cashierApi.getByAppointment(booking.id),
    enabled: paymentsWanted,
    staleTime: 60 * 1000,
  });
  const settled = useMemo(
    () => (payments.data ?? []).filter((t) => t.status === 'Completed' || t.status === 'Pending'),
    [payments.data],
  );

  const busy = status.isPending;
  const canArrive = mayEdit && booking.calendarId !== null && canChangeStatus(booking.status, CHECKED_IN);
  const canNoShow = mayEdit && booking.calendarId !== null && canChangeStatus(booking.status, NO_SHOW);
  const canUndo = mayEdit && booking.calendarId !== null && booking.status === NO_SHOW && canChangeStatus(booking.status, SCHEDULED);

  const direction = layout === 'row' ? 'row' : 'column';

  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      <Stack direction={direction} sx={{ flexWrap: 'wrap', gap: 1, alignItems: layout === 'row' ? 'center' : 'flex-start' }}>
        {flagged ? (
          <Tooltip title={SMART_TEXT.probablyAbsentWhy(settings.noShowAfterMinutes)}>
            <Chip size="small" color="warning" label={SMART_TEXT.probablyAbsent} data-testid="probably-absent" />
          </Tooltip>
        ) : null}

        {canArrive ? (
          <Button size="small" variant={flagged ? 'outlined' : 'contained'} disabled={busy} onClick={() => status.mutate(CHECKED_IN)}>
            {SMART_TEXT.arrived}
          </Button>
        ) : null}
        {/* Nepřišel is one click only once the flag is up (or the patient is
            plainly late); before that it is a question for the detail. */}
        {canNoShow && isLateStatus(booking.status) && flagged ? (
          <Button size="small" variant="outlined" color="warning" disabled={busy} onClick={() => status.mutate(NO_SHOW)}>
            {SMART_TEXT.noShow}
          </Button>
        ) : null}
        {canUndo ? (
          <Button size="small" variant="text" disabled={busy} onClick={() => status.mutate(SCHEDULED)}>
            {SMART_TEXT.undo}
          </Button>
        ) : null}

        {paymentsWanted ? (
          settled.length > 0 ? (
            settled.map((t) => <PaymentChip key={t.id} transaction={t} />)
          ) : (
            <Tooltip title={activity && !activity.serviceItemId ? SMART_TEXT.noPrice : SMART_TEXT.payHelp}>
              <Box component="span">
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  disabled={!activity?.serviceItemId || payments.isLoading}
                  onClick={() => setPaying((was) => !was)}
                >
                  {SMART_TEXT.payNow}
                </Button>
              </Box>
            </Tooltip>
          )
        ) : null}
      </Stack>

      {changeSentence ? (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {changeSentence}
        </Typography>
      ) : null}

      {error ? (
        <Alert severity={error instanceof BookingApiError && error.isConflict ? 'info' : 'error'} onClose={() => setError(null)}>
          {errorText(error, t)}
        </Alert>
      ) : null}

      {paying && activity?.serviceItemId ? (
        <PaymentPanel
          booking={booking}
          serviceItemId={activity.serviceItemId}
          priceCzk={activity.priceCzk ?? 0}
          onDone={() => {
            setPaying(false);
            void queryClient.invalidateQueries({ queryKey: ['appointment-payments', booking.id] });
            onChanged();
          }}
          onClose={() => setPaying(false)}
        />
      ) : null}
    </Stack>
  );
}

function PaymentChip({ transaction }: { transaction: CashierTransaction }) {
  const method = METHOD_LABELS[transaction.paymentMethod] ?? String(transaction.paymentMethod);
  const amount = czk(transaction.finalPrice);
  const completed = transaction.status === 'Completed';
  return (
    <Chip
      size="small"
      color={completed ? 'success' : 'default'}
      variant={completed ? 'filled' : 'outlined'}
      label={
        completed
          ? SMART_TEXT.paidLine(amount, method, formatPragueTime(transaction.completedAt ?? transaction.createdAt))
          : SMART_TEXT.openLine(amount, method)
      }
      data-testid="payment-chip"
    />
  );
}

/**
 * The till, on the booking. Pre-filled from the activity's price-list item
 * and price; the receptionist chooses the method and, if any, the discount.
 */
function PaymentPanel({
  booking,
  serviceItemId,
  priceCzk,
  onDone,
  onClose,
}: {
  booking: SmartBooking;
  serviceItemId: string;
  priceCzk: number;
  onDone: () => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
  const [discount, setDiscount] = useState<string>('0');
  const [reason, setReason] = useState('');

  const discountValue = Math.max(0, Number(discount) || 0);
  const discountTooBig = discountValue > priceCzk;
  const reasonMissing = discountValue > 0 && reason.trim().length === 0;

  const record = useMutation({
    mutationFn: () =>
      cashierApi.createTransaction({
        serviceId: serviceItemId,
        patientId: booking.patientId,
        originalPrice: priceCzk,
        paymentMethod: method,
        discountAmount: discountValue,
        discountReason: discountValue > 0 ? reason.trim() : undefined,
        appointmentId: booking.id,
      }),
    onSuccess: onDone,
  });

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }} data-testid="payment-panel">
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {SMART_TEXT.payTitle}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
        {SMART_TEXT.payHelp}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <TextField size="small" label={SMART_TEXT.price} value={czk(priceCzk)} slotProps={{ input: { readOnly: true } }} sx={{ minWidth: 140 }} />
        <TextField
          select
          size="small"
          label={SMART_TEXT.method}
          value={method}
          onChange={(e) => setMethod(Number(e.target.value) as PaymentMethod)}
          sx={{ minWidth: 150 }}
        >
          {Object.entries(METHOD_LABELS).map(([value, label]) => (
            <MenuItem key={value} value={Number(value)}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          type="number"
          label={SMART_TEXT.discount}
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          error={discountTooBig}
          helperText={discountTooBig ? 'Sleva nesmí být vyšší než cena.' : undefined}
          sx={{ width: 120 }}
        />
        {discountValue > 0 ? (
          <TextField
            size="small"
            label={SMART_TEXT.discountReason}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={reasonMissing}
            sx={{ minWidth: 180 }}
          />
        ) : null}
      </Stack>
      {record.error ? (
        <Alert severity="error" sx={{ mt: 1 }}>
          {SMART_TEXT.failed}
        </Alert>
      ) : null}
      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
        <Button
          size="small"
          variant="contained"
          disabled={record.isPending || discountTooBig || reasonMissing}
          onClick={() => record.mutate()}
        >
          {record.isPending ? SMART_TEXT.recording : SMART_TEXT.record}
        </Button>
        <Button size="small" onClick={onClose}>
          {SMART_TEXT.close}
        </Button>
      </Stack>
    </Box>
  );
}

export default SmartConfirmations;
