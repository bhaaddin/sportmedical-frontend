/*
 * "Změnit činnost" on an open booking (NET-13).
 *
 * Služba first, then its činnosti (never a flat list of a thousand). The server does the real work and says no when it
 * must: the length follows the činnost, a činnost of another služba may move the booking to another calendar, and with
 * "Ponechat čas" a start that is not free is refused with the server's own sentence, which is shown as it is. The price
 * and the document requirements are read from the new činnost by the server and by the detail's own queries after the
 * change - nothing is computed here.
 */
import { useMemo, useState } from 'react';
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { appointmentsApi } from '../../api/appointments';
import { clinicServicesApi } from '../../api/clinicServices';
import type { Activity, Appointment } from '../../api/bookingContracts';
import { serviceChoices } from '../../pages/billing/invoicePrefill';
import { errorText } from './errorText';

const czk = (value: number | null): string => (value === null ? 'bez ceny' : `${value.toLocaleString('cs-CZ')} Kč`);

export function ChangeActivityDialog({
  calendarId, appointment, activities, onClose, onChanged,
}: {
  calendarId: string;
  appointment: Appointment;
  activities: Activity[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const current = activities.find((a) => a.id === appointment.activityId) ?? null;

  const servicesQuery = useQuery({ queryKey: ['clinic-services'], queryFn: () => clinicServicesApi.list(), staleTime: 5 * 60 * 1000 });
  const services = useMemo(() => serviceChoices(servicesQuery.data ?? [], activities.filter((a) => a.isActive)), [servicesQuery.data, activities]);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [activityId, setActivityId] = useState('');
  const [keepTime, setKeepTime] = useState(true);

  /* Starts on the služba the booking is in; with one služba there is nothing to choose. */
  const effectiveService = serviceId ?? current?.clinicServiceId ?? services[0]?.id ?? '';
  const options = useMemo(
    () => activities
      .filter((a) => a.isActive && a.id !== appointment.activityId && (services.length <= 1 || a.clinicServiceId === effectiveService))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs')),
    [activities, appointment.activityId, effectiveService, services.length],
  );
  const chosen = options.find((a) => a.id === activityId) ?? null;

  const change = useMutation({
    mutationFn: () => appointmentsApi.changeActivity(calendarId, appointment.id, activityId, keepTime),
    onSuccess: async () => {
      /* The price and the paperwork of the new činnost: read again, not guessed. */
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appointment'] }),
        queryClient.invalidateQueries({ queryKey: ['appointment-history'] }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
      ]);
      onChanged();
    },
  });

  return (
    <Dialog open onClose={change.isPending ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Změnit činnost</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Nyní: {appointment.activityName || current?.name || '—'}. Délka, cena a požadované doklady se řídí novou činností.
          </Typography>
          {services.length > 1 ? (
            <TextField
              select
              fullWidth
              label="Služba"
              value={effectiveService}
              onChange={(event) => { setServiceId(event.target.value); setActivityId(''); }}
            >
              {services.map((service) => <MenuItem key={service.id} value={service.id}>{service.name}</MenuItem>)}
            </TextField>
          ) : null}
          <TextField
            select
            fullWidth
            required
            label="Nová činnost"
            value={activityId}
            onChange={(event) => setActivityId(event.target.value)}
            helperText={options.length === 0 ? 'V této službě není jiná činnost.' : undefined}
          >
            {options.map((activity) => (
              <MenuItem key={activity.id} value={activity.id}>{activity.name} · {activity.durationMinutes} min</MenuItem>
            ))}
          </TextField>
          {chosen !== null ? (
            <Typography variant="body2">
              Cena podle ceníku: <strong>{czk(chosen.priceCzk)}</strong> · {chosen.durationMinutes} min
              {chosen.clinicServiceId !== current?.clinicServiceId ? ' · jiná služba, termín se může přesunout do jiného kalendáře' : ''}
            </Typography>
          ) : null}
          <FormControlLabel
            control={<Checkbox checked={keepTime} onChange={(event) => setKeepTime(event.target.checked)} />}
            label="Ponechat čas začátku (jinak se vezme nejbližší volný)"
            sx={{ minHeight: 44 }}
          />
          {change.error ? <Alert severity="error">{errorText(change.error, t)}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={change.isPending} sx={{ minHeight: 44 }}>Zrušit</Button>
        <Button variant="contained" disabled={chosen === null || change.isPending} onClick={() => change.mutate()} sx={{ minHeight: 44 }}>
          Změnit činnost
        </Button>
      </DialogActions>
    </Dialog>
  );
}
