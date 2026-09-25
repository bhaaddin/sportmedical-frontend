/* ══════════════════════════════════════════════════════════════
   ODKAZ K DOKONČENÍ REGISTRACE  (route: /nastaveni/odkaz-registrace)

   When the desk pre-registers a patient with four facts, the patient gets a
   personal link to finish. Two things about that link are the owner's to
   decide: how many hours it lives, and what the e-mail carrying it says. Both
   come from the server, which also refuses a text that would leave a patient
   without a link — this screen keeps no copy of the rules.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { preRegistrationApi } from '../../api/preRegistration';
import type { IntakeLinkSettings } from '../../api/preRegistration';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

const QUERY_KEY = ['settings', 'intake-link'] as const;

export default function IntakeLinkSettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: preRegistrationApi.readSettings });
  /* Unsaved edits over what the server has; null means "nothing changed yet". */
  const [edited, setDraft] = useState<IntakeLinkSettings | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: preRegistrationApi.saveSettings,
    onSuccess: (response) => {
      queryClient.setQueryData(QUERY_KEY, response);
      setDraft(null);
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
    return <Alert severity="error">Nastavení odkazu se nepodařilo načíst.</Alert>;
  }

  const { placeholders, minimumHours, maximumHours, defaults } = query.data;
  const draft = edited ?? query.data.settings;
  const errors = save.isError ? fieldErrorsOf(save.error) : {};
  const set = <K extends keyof IntakeLinkSettings>(key: K, value: IntakeLinkSettings[K]) => {
    setSaved(false);
    setDraft({ ...draft, [key]: value });
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>Odkaz k dokončení registrace</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Když recepce založí pacienta jen se jménem, datem narození a e-mailem (rychlá předregistrace),
          pacient dostane osobní odkaz a doplní adresu, pojištění a dotazník sám. Tady určíte, jak dlouho
          odkaz platí a co stojí v e-mailu, který ho nese.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ maxWidth: 720 }}>
        <CardContent>
          <Stack spacing={2.5}>
            <TextField
              type="number"
              label="Platnost odkazu (hodiny)"
              value={draft.completionDeadlineHours}
              onChange={(event) => set('completionDeadlineHours', Number(event.target.value))}
              error={errors.completionDeadlineHours !== undefined}
              helperText={
                errors.completionDeadlineHours
                ?? `Kolik hodin od vygenerování jde odkaz otevřít; ${minimumHours} až ${maximumHours}. Po vypršení ho recepce vygeneruje znovu z karty pacienta.`
              }
              slotProps={{ htmlInput: { min: minimumHours, max: maximumHours, step: 1 } }}
              sx={{ maxWidth: 320 }}
            />

            <TextField
              label="Předmět e-mailu"
              value={draft.emailSubject}
              onChange={(event) => set('emailSubject', event.target.value)}
              error={errors.emailSubject !== undefined}
              helperText={errors.emailSubject ?? 'Jeden řádek. Smí obsahovat zástupné výrazy uvedené níže.'}
            />

            <TextField
              multiline
              minRows={8}
              label="Text e-mailu"
              value={draft.emailBody}
              onChange={(event) => set('emailBody', event.target.value)}
              error={errors.emailBody !== undefined}
              helperText={
                errors.emailBody
                ?? 'Prostý text; prázdný řádek dělí odstavce. {odkaz} je povinný — bez něj by pacient neměl co otevřít.'
              }
            />

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Zástupné výrazy
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                Do textu je vložte i se složenými závorkami; před odesláním se nahradí skutečnou hodnotou.
              </Typography>
              <Stack spacing={0.5}>
                {placeholders.map((placeholder) => (
                  <Stack key={placeholder.token} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Chip size="small" label={placeholder.token} sx={{ fontFamily: 'monospace' }} />
                    <Typography variant="body2">{placeholder.meaning}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            {save.isError && (
              <Alert severity="error">{problemMessageOf(save.error, 'Nastavení se nepodařilo uložit.')}</Alert>
            )}
            {saved && !save.isPending && (
              <Alert severity="success">Uloženo. Platí pro každý odkaz vygenerovaný od této chvíle.</Alert>
            )}

            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={save.isPending} onClick={() => save.mutate(draft)}>
                Uložit
              </Button>
              <Button
                color="inherit"
                disabled={save.isPending}
                onClick={() => { setSaved(false); setDraft(defaults); }}
              >
                Vrátit výchozí text
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
