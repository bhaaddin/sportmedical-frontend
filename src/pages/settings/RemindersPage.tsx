/* ══════════════════════════════════════════════════════════════
   PŘIPOMÍNKY  (route: /nastaveni/pripominky)

   How many hours before a visit the patient gets the reminder e-mail. The
   scheduler reads the same number this screen writes; the bounds and default
   come from the server, so nothing here is a copy of the rule.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
import { SectionLabel, SoftCard } from '../../components/ui';
import { SettingsScreen } from './SettingsFrame';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

/** "24 hodin" as "1 den", "30 hodin" as "1 den a 6 hodin" - how far ahead a reminder is, said plainly. */
function reminderLead(hours: number): string {
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const hoursText = `${rest} ${rest === 1 ? 'hodinu' : rest >= 2 && rest <= 4 ? 'hodiny' : 'hodin'}`;
  const daysText = `${days} ${days === 1 ? 'den' : days >= 2 && days <= 4 ? 'dny' : 'dní'}`;
  if (days === 0) return hoursText;
  return rest === 0 ? daysText : `${daysText} a ${hoursText}`;
}

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
    <SettingsScreen
      title="Připomínky"
      subtitle="Kolik hodin před termínem pacientovi odejde připomínka"
      save={{
        dirty: edited !== null && !Number.isNaN(hours),
        saving: save.isPending,
        onSave: () => save.mutate(hours),
        onDiscard: () => { setSaved(false); setEdited(null); },
      }}
      aside={
        <Typography sx={{ fontSize: 14, color: 'text.primary' }}>
          {Number.isNaN(hours)
            ? 'Zadejte počet hodin a uvidíte, kdy se připomínka připraví.'
            : `Pacient s termínem v 10:00 dostane připomínku ${reminderLead(hours)} před termínem.`}
        </Typography>
      }
    >
      <SoftCard>
        <Stack spacing={2}>
          <SectionLabel sx={{ mb: 0 }}>Předstih</SectionLabel>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Připomínka se připraví jednou, jen pacientům z registru a jen u termínů, které stále platí. Odesílání zpráv zatím není zapnuté.
          </Typography>

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
            sx={{ maxWidth: 260 }}
          />

          <Box>
            <Button
              size="small"
              sx={{ color: 'text.secondary' }}
              onClick={() => {
                setSaved(false);
                setEdited(String(defaults.hoursBefore));
              }}
              disabled={save.isPending}
            >
              Vrátit výchozí hodnotu
            </Button>
          </Box>
        </Stack>
      </SoftCard>
    </SettingsScreen>
  );
}
