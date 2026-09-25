/* ══════════════════════════════════════════════════════════════
   DOCHÁZKA  (route: /nastaveni/dochazka)

   After how many minutes a booking that is still "Objednán" gets the amber
   "asi nepřišel" flag on the calendar and the doctor's workspace. It is a
   flag: nothing changes the status until somebody clicks Nepřišel or
   Přišel. The number was nowhere before (the flag did not exist); the
   owner's rule is that it is his to change.

   The patient's own window - how long before the start they may still
   reschedule or cancel through their link - is shown here so the two rules
   sit together, but it belongs to the booking settings and is read-only on
   this screen.
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
  ATTENDANCE_QUERY_KEY,
  readAttendanceSettings,
  saveAttendanceSettings,
} from '../../api/attendanceSettings';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ATTENDANCE_QUERY_KEY, queryFn: readAttendanceSettings });
  /* Unsaved edit over what the server has; null means "nothing changed yet". */
  const [edited, setEdited] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (minutes: number) => saveAttendanceSettings(minutes),
    onSuccess: (response) => {
      queryClient.setQueryData(ATTENDANCE_QUERY_KEY, response);
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
    return <Alert severity="error">Nastavení docházky se nepodařilo načíst.</Alert>;
  }

  const { settings, minimumNoShowAfterMinutes, maximumNoShowAfterMinutes, defaults } = query.data;
  const draft = edited ?? String(settings.noShowAfterMinutes);
  const errors = save.isError ? fieldErrorsOf(save.error) : {};
  const minutes = Number(draft);
  const outOfBounds =
    !Number.isInteger(minutes) || minutes < minimumNoShowAfterMinutes || minutes > maximumNoShowAfterMinutes;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Docházka</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Kdy kalendář upozorní, že objednaný pacient nejspíš nepřišel. Upozornění samo nic nemění —
          stav se změní až po kliknutí na Nepřišel nebo Přišel.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ maxWidth: 640 }}>
        <CardContent>
          <Stack spacing={2.5}>
            <TextField
              type="number"
              label="Označit „asi nepřišel“ po (minut od začátku termínu)"
              value={draft}
              onChange={(event) => { setSaved(false); setEdited(event.target.value); }}
              error={errors.noShowAfterMinutes !== undefined || (edited !== null && outOfBounds)}
              helperText={
                errors.noShowAfterMinutes
                  ?? `Objednaný termín, který tolik minut po začátku nemá kliknuto Přišel, dostane oranžové upozornění. Povolený rozsah ${minimumNoShowAfterMinutes}–${maximumNoShowAfterMinutes} minut; výchozí ${defaults.noShowAfterMinutes}.`
              }
              slotProps={{ htmlInput: { min: minimumNoShowAfterMinutes, max: maximumNoShowAfterMinutes, step: 5 } }}
            />

            <TextField
              label="Pacient smí sám měnit termín nejpozději (hodin před začátkem)"
              value={settings.patientChangeDeadlineHours}
              slotProps={{ input: { readOnly: true } }}
              helperText="Přes svůj odkaz může pacient přesunout nebo zrušit termín jen do této lhůty; personál smí měnit vždy. Hodnotu nastavuje sekce Rezervace online, tady je jen pro přehled."
            />

            {save.isError && (
              <Alert severity="error">{problemMessageOf(save.error, 'Nastavení se nepodařilo uložit.')}</Alert>
            )}
            {saved && !save.isPending && (
              <Alert severity="success">Uloženo. Upozornění se tak ukazuje všem v ordinaci.</Alert>
            )}

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                disabled={save.isPending || outOfBounds}
                onClick={() => save.mutate(minutes)}
              >
                Uložit
              </Button>
              <Button
                color="inherit"
                disabled={save.isPending}
                onClick={() => { setSaved(false); setEdited(String(defaults.noShowAfterMinutes)); }}
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
