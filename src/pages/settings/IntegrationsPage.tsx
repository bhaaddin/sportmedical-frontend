/*
 * Integrace - what the clinic is wired to.
 *
 * ADAM: enabled, address, user and password. Stored only; nothing calls ADAM
 * from here (Etapa 2, decision 15), so the screen is honest about it: the
 * state reads "Nepřipojeno" and says the connection is not tested.
 * MEDISTAR is being abandoned: shown as "ukončeno", no fields.
 *
 * The password is write-only. After a save the field is empty again and the
 * screen says "uloženo"; typing in it replaces the stored one.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, Skeleton, Stack, Switch, TextField, Typography } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { SettingsScreen } from './SettingsFrame';
import { StatusChip } from '../../components/ui';
import { TYPE, settingsLine } from '../../components/settings/settingsStyle';
import { integrationsApi, integrationsErrorText, type IntegrationsSettings } from './integrationsApi';

interface Draft {
  enabled: boolean;
  baseUrl: string;
  username: string;
  password: string;
}

const draftOf = (loaded: IntegrationsSettings): Draft => ({
  enabled: loaded.adam.enabled,
  baseUrl: loaded.adam.baseUrl,
  username: loaded.adam.username,
  password: '',
});

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Typography component="div" sx={[TYPE.label, { mb: 0.75 }]}>{children}</Typography>;
}

function validUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export default function IntegrationsPage() {
  const [loaded, setLoaded] = useState<IntegrationsSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoaded(null);
    try {
      const result = await integrationsApi.get();
      setLoaded(result);
      setDraft(draftOf(result));
    } catch (error) {
      setLoadError(integrationsErrorText(error, 'Nastavení integrací se nepodařilo načíst.'));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dirty = loaded !== null && draft !== null && (
    draft.enabled !== loaded.adam.enabled ||
    draft.baseUrl !== loaded.adam.baseUrl ||
    draft.username !== loaded.adam.username ||
    draft.password !== ''
  );

  const urlProblem = draft !== null && draft.enabled && draft.baseUrl.trim() !== '' && !validUrl(draft.baseUrl)
    ? 'Zadejte celou adresu včetně https://'
    : null;
  const missing = draft !== null && draft.enabled && (draft.baseUrl.trim() === '' || draft.username.trim() === '');

  const save = async () => {
    if (draft === null || loaded === null) return;
    if (urlProblem !== null || missing) {
      setSaveError(urlProblem ?? 'Zapnuté napojení potřebuje adresu a uživatelské jméno.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const result = await integrationsApi.save({
        enabled: draft.enabled,
        baseUrl: draft.baseUrl.trim(),
        username: draft.username.trim(),
        ...(draft.password !== '' ? { password: draft.password } : {}),
      });
      setLoaded(result);
      setDraft(draftOf(result));
      setSaved(true);
    } catch (error) {
      setSaveError(integrationsErrorText(error, 'Uložení se nepovedlo. Zkuste to znovu.'));
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (loaded !== null) setDraft(draftOf(loaded));
    setSaveError(null);
    setSaved(false);
  };

  const complete = loaded !== null && loaded.adam.enabled && loaded.adam.baseUrl !== '' && loaded.adam.username !== '' && loaded.adam.hasPassword;

  const aside = (
    <Stack spacing={1.5}>
      <Box>
        <Typography sx={TYPE.itemName}>ADAM</Typography>
        <Typography sx={TYPE.caption}>
          {complete
            ? 'Údaje jsou uložené. Spojení se zatím neověřuje.'
            : 'Nepřipojeno. Vyplňte údaje a uložte je.'}
        </Typography>
      </Box>
      <Box>
        <Typography sx={TYPE.itemName}>MEDISTAR</Typography>
        <Typography sx={TYPE.caption}>Ukončeno — už se nepoužívá.</Typography>
      </Box>
    </Stack>
  );

  return (
    <SettingsScreen
      title="Integrace"
      subtitle="Napojení na ADAM — adresa, uživatel a heslo. Údaje se jen ukládají, spojení se zatím neověřuje."
      save={{ dirty, saving, onSave: () => { void save(); }, onDiscard: discard }}
      aside={aside}
      asideTitle="Stav napojení"
    >
      {loadError !== null ? (
        <Alert
          severity="error"
          action={<Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => { void load(); }} sx={{ minHeight: 44 }}>Zkusit znovu</Button>}
        >
          {loadError}
        </Alert>
      ) : draft === null || loaded === null ? (
        <Box aria-busy="true" aria-label="Načítám integrace">
          <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3, mb: 2 }} />
          <Skeleton variant="rounded" height={96} sx={{ borderRadius: 3 }} />
        </Box>
      ) : (
        <Stack spacing={3}>
          {saved && <Alert severity="success">Uloženo.</Alert>}
          {saveError !== null && <Alert severity="error">{saveError}</Alert>}

          {/* ADAM */}
          <Box component="section" aria-label="ADAM" sx={{ border: '1px solid', borderColor: settingsLine, borderRadius: 3, bgcolor: 'background.paper', p: 3 }}>
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
              <Typography component="h2" sx={TYPE.sectionTitle}>ADAM</Typography>
              <StatusChip tone="grey">Nepřipojeno</StatusChip>
              {complete && <StatusChip tone="blue">Údaje uloženy</StatusChip>}
            </Stack>
            <Typography sx={[TYPE.caption, { mb: 2.5 }]}>
              Přístup do systému ADAM. Zatím se jen ukládá — nic se z ordinace do ADAM neodesílá.
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={draft.enabled}
                  onChange={(e) => { setDraft({ ...draft, enabled: e.target.checked }); setSaved(false); }}
                  slotProps={{ input: { 'aria-label': 'Napojení na ADAM zapnuto' } }}
                />
              }
              label={<Typography sx={TYPE.itemName}>Napojení zapnuto</Typography>}
              sx={{ mb: 2.5, minHeight: 44 }}
            />

            <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <Box>
                <FieldLabel>Adresa serveru</FieldLabel>
                <TextField
                  fullWidth
                  value={draft.baseUrl}
                  onChange={(e) => { setDraft({ ...draft, baseUrl: e.target.value }); setSaved(false); }}
                  placeholder="https://"
                  error={urlProblem !== null}
                  helperText={urlProblem ?? ' '}
                  slotProps={{ htmlInput: { 'aria-label': 'Adresa serveru ADAM', inputMode: 'url', autoComplete: 'off' } }}
                />
              </Box>
              <Box>
                <FieldLabel>Uživatelské jméno</FieldLabel>
                <TextField
                  fullWidth
                  value={draft.username}
                  onChange={(e) => { setDraft({ ...draft, username: e.target.value }); setSaved(false); }}
                  slotProps={{ htmlInput: { 'aria-label': 'Uživatelské jméno ADAM', autoComplete: 'off' } }}
                />
              </Box>
              <Box>
                <FieldLabel>Heslo</FieldLabel>
                <TextField
                  fullWidth
                  type="password"
                  value={draft.password}
                  onChange={(e) => { setDraft({ ...draft, password: e.target.value }); setSaved(false); }}
                  placeholder={loaded.adam.hasPassword ? 'uloženo' : ''}
                  helperText={
                    loaded.adam.hasPassword
                      ? 'Heslo je uloženo a už se nezobrazuje. Napište nové, jen když ho chcete změnit.'
                      : 'Heslo se jen zapisuje; po uložení se už nezobrazí.'
                  }
                  slotProps={{ htmlInput: { 'aria-label': 'Heslo ADAM', autoComplete: 'new-password' } }}
                />
                {loaded.adam.hasPassword && draft.password === '' && (
                  <Box sx={{ mt: 1 }}><StatusChip tone="green">uloženo</StatusChip></Box>
                )}
              </Box>
            </Box>
          </Box>

          {/* MEDISTAR */}
          <Box component="section" aria-label="MEDISTAR" sx={{ border: '1px solid', borderColor: settingsLine, borderRadius: 3, bgcolor: 'background.paper', p: 3 }}>
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
              <Typography component="h2" sx={TYPE.sectionTitle}>MEDISTAR</Typography>
              <StatusChip tone="beige">Ukončeno</StatusChip>
            </Stack>
            <Typography sx={TYPE.caption}>
              MEDISTAR se přestává používat, proto tu nejsou žádná pole. Rezervace a pacienti žijí v tomto systému.
            </Typography>
          </Box>
        </Stack>
      )}
    </SettingsScreen>
  );
}
