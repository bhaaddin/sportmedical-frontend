/* ══════════════════════════════════════════════════════════════
   ZMĚNY REZERVACÍ PACIENTEM  (route: /nastaveni/zmeny-rezervaci)

   How long before an appointment a patient may still move or cancel it
   through their own link. It was a constant of twenty-four hours in the
   server; the owner's rule is that it is his to change, so it is a setting
   with the old number as its default.

   Staff are never held to it: the deadline is the patient's. The clinic
   changes anything at any time from the calendar.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BOOKING_CHANGES_QUERY_KEY,
  readBookingChanges,
  saveBookingChanges,
} from '../../api/bookingChangeSettings';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

export default function BookingChangesPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: BOOKING_CHANGES_QUERY_KEY, queryFn: readBookingChanges });
  /* Unsaved edit over what the server has; null means "nothing changed yet". */
  const [edited, setEdited] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: saveBookingChanges,
    onSuccess: (response) => {
      queryClient.setQueryData(BOOKING_CHANGES_QUERY_KEY, response);
      setEdited(null);
      setSaved(true);
    },
    onError: () => setSaved(false),
  });

  if (query.isPending) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (query.isError || !query.data) {
    return <Alert severity="error">Nastavení lhůty se nepodařilo načíst.</Alert>;
  }

  const { settings, defaults, minHours, maxHours } = query.data;
  const draft = edited ?? String(settings.patientChangeDeadlineHours);
  const hours = Number(draft);
  const errors = save.isError ? fieldErrorsOf(save.error) : {};

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Změny rezervací pacientem</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Pacient dostane v e-mailu odkaz na svou rezervaci. Přes něj si může termín sám přesunout
          na jiný volný čas nebo ho zrušit — ale jen do lhůty nastavené tady. Potom musí zavolat.
          Ordinace sama může měnit cokoli kdykoli z kalendáře; lhůta platí jen pro pacienta.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ maxWidth: 640 }}>
        <CardContent>
          <Stack spacing={2.5}>
            <TextField
              label="Lhůta pro změnu pacientem (hodin před začátkem)"
              type="number"
              value={draft}
              onChange={(event) => { setSaved(false); setEdited(event.target.value); }}
              error={errors.patientChangeDeadlineHours !== undefined}
              helperText={
                errors.patientChangeDeadlineHours
                ?? `Termín lze přes odkaz měnit jen tehdy, když do jeho začátku zbývá aspoň tolik hodin. Povoleno ${minHours} až ${maxHours}; výchozí ${defaults.patientChangeDeadlineHours}.`
              }
              slotProps={{ htmlInput: { min: minHours, max: maxHours, step: 1 } }}
            />

            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Příklad: při {Number.isFinite(hours) && hours > 0 ? hours : settings.patientChangeDeadlineHours} hodinách
              si pacient s termínem ve čtvrtek 9:00 může termín změnit nejpozději
              {' '}{exampleUntil(Number.isFinite(hours) && hours > 0 ? hours : settings.patientChangeDeadlineHours)}.
              Kalendář, který má vlastní lhůtu pro online zrušení, se řídí tou svou.
            </Alert>

            {save.isError && (
              <Alert severity="error">{problemMessageOf(save.error, 'Nastavení se nepodařilo uložit.')}</Alert>
            )}
            {saved && !save.isPending && (
              <Alert severity="success">Uloženo. Odkazy pacientů se od teď řídí touto lhůtou.</Alert>
            )}

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={save.isPending || !Number.isInteger(hours)}
                onClick={() => save.mutate({ patientChangeDeadlineHours: hours })}
              >
                Uložit
              </Button>
              <Button
                color="inherit"
                disabled={save.isPending}
                onClick={() => { setSaved(false); setEdited(String(defaults.patientChangeDeadlineHours)); }}
              >
                Vrátit výchozí hodnotu
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

/**
 * "ve středu 9:00" for 24 hours, "v pondělí 9:00" for 72 — the example under
 * the field, worked from a fixed Thursday so the sentence is stable.
 */
export function exampleUntil(hours: number): string {
  /* Thursday 24. 9. 2026 09:00 Prague = 07:00 UTC (summer time). */
  const thursdayNine = Date.UTC(2026, 8, 24, 7, 0, 0);
  const until = new Date(thursdayNine - hours * 3_600_000);
  const day = until.toLocaleDateString('cs-CZ', { weekday: 'long', timeZone: 'Europe/Prague' });
  const time = until.toLocaleTimeString('cs-CZ', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Prague' });
  const preposition = /^[sz]/i.test(day) || /^st/i.test(day) ? 've' : 'v';
  return `${preposition} ${day} ${time}`;
}
