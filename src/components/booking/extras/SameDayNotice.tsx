import { Alert, Link } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '../../../api/appointments';
import { otherBookingsThatDay, sameDayText } from './sameDay';

/**
 * R15c (c): "the patient already has another booking that day" - a notice, never a block. It reads the day's rows (the calendars the
 * desk may see, no patient data in the URL: the patient is matched in the answer) and links to the patient's card in a new tab so the
 * booking being made is not lost. Silent while loading, on an error, and when there is nothing to say.
 */
export function SameDayNotice({ patientId, date, calendarIds, excludeId }: { patientId: string; date: string; calendarIds: readonly string[]; excludeId?: string }) {
  const rows = useQuery({
    queryKey: ['same-day', date, calendarIds.join(',')],
    queryFn: () => appointmentsApi.range(date, date, [...calendarIds]),
    enabled: patientId !== '' && date !== '' && calendarIds.length > 0,
    staleTime: 30_000,
    retry: false,
  });
  const list = otherBookingsThatDay(rows.data ?? [], patientId, date, excludeId);
  if (list.length === 0) return null;
  return (
    <Alert severity="warning" data-testid="same-day-notice" sx={{ alignItems: 'center' }}>
      {sameDayText(list)}{' '}
      <Link href={`/patients/${encodeURIComponent(patientId)}`} target="_blank" rel="noopener" underline="hover" sx={{ fontWeight: 650 }}>
        Otevřít kartu pacienta
      </Link>
    </Alert>
  );
}

export default SameDayNotice;
