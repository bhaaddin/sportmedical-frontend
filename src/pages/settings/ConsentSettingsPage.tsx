/* ══════════════════════════════════════════════════════════════
   SOUHLASY  (route: /nastaveni/souhlasy)

   The marketing consent on the online booking form: whether it is shown, and
   how it reads. It is the one consent that is the clinic's own — never
   required (a consent forced to book is not freely given), and pointless for
   a clinic that sends no newsletters.

   The consent to the treatment itself is required by law and worded for the
   činnost booked; the report-by-e-mail and club-sharing consents are decided
   per činnost. None of those is here, because a screen cannot switch off a
   legal duty or a činnost's own rule.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CONSENT_SETTINGS_QUERY_KEY,
  readConsentSettings,
  saveConsentSettings,
} from '../../api/consentSettings';
import type { ConsentSettings } from '../../api/consentSettings';
import { SectionLabel, SoftCard } from '../../components/ui';
import { SettingsScreen } from './SettingsFrame';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';

export default function ConsentSettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: CONSENT_SETTINGS_QUERY_KEY, queryFn: readConsentSettings });
  /* Unsaved edits over what the server has; null means "nothing changed yet". */
  const [edited, setDraft] = useState<ConsentSettings | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: saveConsentSettings,
    onSuccess: (response) => {
      queryClient.setQueryData(CONSENT_SETTINGS_QUERY_KEY, response);
      setDraft(null);
      setSaved(true);
    },
    onError: () => setSaved(false),
  });

  const title = 'Souhlasy a GDPR';
  const sentence = 'Marketingový souhlas na objednávkovém formuláři — zda se pacientovi ukáže a jak zní';

  if (query.isPending) {
    return <SettingsScreen title={title} subtitle={sentence} loading>{null}</SettingsScreen>;
  }

  if (query.isError || !query.data) {
    return (
      <SettingsScreen title={title} subtitle={sentence} error="Nastavení souhlasů se nepodařilo načíst." onRetry={() => { void query.refetch(); }}>
        {null}
      </SettingsScreen>
    );
  }

  const draft = edited ?? query.data;
  const errors = save.isError ? fieldErrorsOf(save.error) : {};
  const set = <K extends keyof ConsentSettings>(key: K, value: ConsentSettings[K]) => {
    setSaved(false);
    setDraft({ ...draft, [key]: value });
  };

  return (
    <SettingsScreen
      title={title}
      subtitle={sentence}
      save={{
        dirty: edited !== null,
        saving: save.isPending,
        onSave: () => save.mutate(draft),
        onDiscard: () => { setSaved(false); setDraft(null); },
      }}
      aside={
        draft.communicationVisible ? (
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 0.5 }}>{draft.communicationTitle || '—'}</Typography>
            <Typography sx={{ fontSize: 14, color: 'text.primary' }}>{draft.communicationDetail || '—'}</Typography>
          </Box>
        ) : (
          <Typography sx={{ fontSize: 14, color: 'text.primary' }}>
            Marketingový souhlas se na formuláři neukazuje. Zákonné souhlasy zůstávají vždy zapnuté.
          </Typography>
        )
      }
      asideTitle="Tak to uvidí pacient"
    >
      <SoftCard>
        <Stack spacing={2.5}>
          <Box>
            <SectionLabel>Marketingový souhlas</SectionLabel>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Souhlas s poskytnutím zdravotní služby a souhlasy vázané na činnost se řídí zákonem a
              nastavením činnosti, proto tu nejsou.
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={draft.communicationVisible}
                onChange={(event) => set('communicationVisible', event.target.checked)}
              />
            }
            label="Zobrazit marketingový souhlas na formuláři"
          />

          <TextField
            label="Nadpis"
            value={draft.communicationTitle}
            onChange={(event) => set('communicationTitle', event.target.value)}
            disabled={!draft.communicationVisible}
            error={Boolean(errors.communicationTitle)}
            helperText={errors.communicationTitle}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />

          <TextField
            label="Text souhlasu"
            value={draft.communicationDetail}
            onChange={(event) => set('communicationDetail', event.target.value)}
            disabled={!draft.communicationVisible}
            error={Boolean(errors.communicationDetail)}
            helperText={
              errors.communicationDetail
              ?? 'Co pacient odsouhlasí. Netýká se potvrzení a připomínek k termínu.'
            }
            fullWidth
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />

          {save.isError && !Object.keys(errors).length && (
            <Alert severity="error">
              {problemMessageOf(save.error, 'Nastavení se nepodařilo uložit.')}
            </Alert>
          )}
          {saved && <Alert severity="success">Uloženo.</Alert>}
        </Stack>
      </SoftCard>
    </SettingsScreen>
  );
}
