/* Nastavení -> Pohybová analýza (movement.admin): which services are movement services, how long the videos are kept, the training export,
   the report language - and the owner's switch of the module itself in this browser (there is no server-side feature flag). */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import { SettingsScreen } from '../../pages/settings/SettingsFrame';
import { servicesApi } from '../../api/services';
import { RETENTION_DAYS_MAX, RETENTION_DAYS_MIN, movementErrorCode, useMovementSettings, useSaveMovementSettings, type MovementSettings } from '../../api/movement';
import { movementEnabled, setMovementFlag, movementMock } from '../flags';
import { useMoveT } from '../i18n';

/** The retention days as the field holds them: valid only as a whole number in the allowed range. */
export function retentionError(text: string): boolean {
  const n = Number(text);
  return !Number.isInteger(n) || n < RETENTION_DAYS_MIN || n > RETENTION_DAYS_MAX;
}

export default function MovementSettingsPage() {
  const { t } = useMoveT();
  const settings = useMovementSettings();
  const services = useQuery({ queryKey: ['movement', 'price-list'], queryFn: () => servicesApi.getAll(), staleTime: 60_000 });
  const save = useSaveMovementSettings();
  const [draft, setDraft] = useState<MovementSettings | null>(null);
  const [days, setDays] = useState('365');
  const [on, setOn] = useState(movementEnabled());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.data) { setDraft(settings.data); setDays(String(settings.data.videoRetentionDays)); }
  }, [settings.data]);

  const dirty = useMemo(() => draft !== null && settings.data !== undefined && (JSON.stringify({ ...draft, videoRetentionDays: Number(days) }) !== JSON.stringify(settings.data)), [draft, days, settings.data]);
  const badDays = retentionError(days);

  const toggleService = (id: string) => draft && setDraft({ ...draft, serviceItemIds: draft.serviceItemIds.includes(id) ? draft.serviceItemIds.filter((x) => x !== id) : [...draft.serviceItemIds, id] });
  const submit = () => {
    if (draft === null || badDays) return;
    setSaved(false);
    save.mutate({ ...draft, videoRetentionDays: Number(days) }, { onSuccess: () => setSaved(true) });
  };

  return (
    <SettingsScreen title={t('title')} subtitle={t('settings.subtitle')} scope={false} related={false} aside={false}>
      <Stack spacing={3} data-testid="movement-settings">
        <Box>
          <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700 }}>{t('settings.module')}</Typography>
          <FormControlLabel
            sx={{ minHeight: 44 }}
            control={<Switch checked={on} onChange={(e) => { setOn(e.target.checked); setMovementFlag(e.target.checked, movementMock()); }} />}
            label={on ? t('settings.module.on') : t('settings.module.off')}
          />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('settings.module.hint')}</Typography>
        </Box>

        {settings.isError && <Alert severity="warning" role="alert" action={<Button color="inherit" onClick={() => void settings.refetch()} sx={{ minHeight: 44 }}>{t('action.retry')}</Button>}>{t('settings.load_error')}</Alert>}

        {draft && (
          <>
            <Box>
              <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700 }}>{t('settings.services')}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>{t('settings.services.hint')}</Typography>
              <Stack data-testid="movement-services" sx={{ maxHeight: 280, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 2, px: 1 }}>
                {(services.data ?? []).filter((s) => s.isActive).map((s) => (
                  <FormControlLabel
                    key={s.id}
                    sx={{ minHeight: 44, m: 0 }}
                    control={<Checkbox checked={draft.serviceItemIds.includes(s.id)} onChange={() => toggleService(s.id)} sx={{ p: 1.25 }} />}
                    label={s.name}
                  />
                ))}
                {services.isSuccess && services.data.length === 0 && <Typography variant="body2" sx={{ p: 1.5, color: 'text.secondary' }}>{t('settings.services.empty')}</Typography>}
              </Stack>
            </Box>

            <TextField
              label={t('settings.retention')}
              helperText={badDays ? t('settings.retention.error', { min: RETENTION_DAYS_MIN, max: RETENTION_DAYS_MAX }) : t('settings.retention.hint')}
              error={badDays}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': t('settings.retention') } }}
              sx={{ maxWidth: 280 }}
            />

            <Box>
              <FormControlLabel
                sx={{ minHeight: 44 }}
                control={<Switch checked={draft.mlExportEnabled} onChange={(e) => setDraft({ ...draft, mlExportEnabled: e.target.checked })} />}
                label={t('settings.ml')}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('settings.ml.hint')}</Typography>
            </Box>

            <TextField select label={t('settings.language')} helperText={t('settings.language.hint')} value={draft.reportLanguage} onChange={(e) => setDraft({ ...draft, reportLanguage: e.target.value as 'cs' | 'en' })} sx={{ maxWidth: 280 }}>
              <MenuItem value="cs" sx={{ minHeight: 44 }}>Čeština</MenuItem>
              <MenuItem value="en" sx={{ minHeight: 44 }}>English</MenuItem>
            </TextField>

            {save.isError && <Alert severity="error" role="alert">{movementErrorCode(save.error) === 'movement.settings_invalid' ? t('settings.invalid') : t('settings.save_error')}</Alert>}
            {saved && !dirty && <Alert severity="success" role="status">{t('settings.saved')}</Alert>}
            <Box><Button variant="contained" onClick={submit} disabled={!dirty || badDays || save.isPending} sx={{ minHeight: 44 }}>{t('settings.save')}</Button></Box>
          </>
        )}
      </Stack>
    </SettingsScreen>
  );
}
