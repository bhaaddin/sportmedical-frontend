/* ══════════════════════════════════════════════════════════════
   PŘIPOMÍNKY TERMÍNŮ  (route: /nastaveni/pripominky)

   How many hours before a visit the patient gets the reminder e-mail. The
   scheduler reads the same number this screen writes; the bounds and default
   come from the server, so nothing here is a copy of the rule.
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
  REMINDER_SETTINGS_QUERY_KEY,
  readReminderSettings,
  saveReminderSettings,
} from '../../api/reminderSettings';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

export default function RemindersPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: REMINDER_SETTINGS_QUERY_KEY, queryFn: readReminderSettings });
  /* Unsaved edit over what the server has; null means "nothing changed yet". */
  const [edited, setEdited] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (hoursBefore: number) => saveReminderSettings({ hoursBefore }),
    onSuccess: (response) => {
      queryClient.setQueryData(REMINDER_SETTINGS_QUERY_KEY, response);
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
    return <Alert severity="error">Nastavení připomínek se nepodařilo načíst.</Alert>;
  }

  const { settings, defaults, minHours, maxHours } = query.data;
  const draft = edited ?? String(settings.hoursBefore);
  const hours = Number.parseInt(draft, 10);
  const errors = save.isError ? fieldErrorsOf(save.error) : {};
  const problem = save.isError ? problemMessageOf(save.error, 'Nastavení nelze uložit.') : null;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Připomínky termínů</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Kolik hodin před termínem pacientovi odejde připomínka e-mailem. Posílá se jednou,
          jen pacientům z registru a jen u termínů, které stále platí.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ maxWidth: 520 }}>
        <CardContent>
          <Stack spacing={2}>
            {problem !== null && errors.hoursBefore === undefined ? (
              <Alert severity="error">{problem}</Alert>
            ) : null}
            {saved ? <Alert severity="success">Uloženo.</Alert> : null}

            <TextField
              type="number"
              label="Předstih (hodin)"
              value={draft}
              onChange={(event) => {
                setSaved(false);
                setEdited(event.target.value);
              }}
              error={errors.hoursBefore !== undefined}
              helperText={errors.hoursBefore ?? `Od ${minHours} do ${maxHours} hodin. Výchozí: ${defaults.hoursBefore}.`}
              slotProps={{ htmlInput: { min: minHours, max: maxHours, step: 1 } }}
            />

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={() => save.mutate(hours)}
                disabled={save.isPending || edited === null || Number.isNaN(hours)}
              >
                {save.isPending ? 'Ukládám…' : 'Uložit'}
              </Button>
              <Button
                onClick={() => {
                  setSaved(false);
                  setEdited(String(defaults.hoursBefore));
                }}
                disabled={save.isPending}
              >
                Výchozí hodnota
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
