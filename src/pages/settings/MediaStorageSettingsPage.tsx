/* ══════════════════════════════════════════════════════════════
   ÚLOŽIŠTĚ MÉDIÍ  (route: /nastaveni/uloziste-medii)

   Where the photos and videos of the public website are kept (Cloudinary, behind
   IMediaStore). The credentials live here, not in code:

     GET/PUT /api/v1/settings/media-storage
       enabled · cloudName · apiKey · apiSecret (write-only) · uploadPreset

   The secret is never shown or prefilled. When one is stored the screen says
   "Uloženo ✓" and a button "Změnit" opens an empty masked field; a PUT carries
   `apiSecret` only when somebody typed one. The contract has no "test the
   connection" endpoint, so none is called: the status "Nastaveno / Nenastaveno"
   is worked out from what is saved.
   ══════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { Alert, Box, Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { DESIGN } from '../../theme';
import { SectionLabel, SoftCard, StatusChip } from '../../components/ui';
import { TYPE } from '../../components/settings/settingsStyle';
import { useDevice } from '../../layout/useDevice';
import {
  MEDIA_STORAGE_QUERY_KEY, mediaStorageApi, type MediaStorageSettings, type MediaStorageUpdate,
} from '../../api/mediaStorageSettings';
import { SettingsScreen } from './SettingsFrame';
import { fieldErrorsOf, problemMessageOf } from './settingsProblem';
import { StatusPanel } from './mediaStorage/StatusPanel';

interface Draft {
  enabled: boolean;
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
}

const toDraft = (saved: MediaStorageSettings): Draft => ({
  enabled: saved.enabled,
  cloudName: saved.cloudName,
  apiKey: saved.apiKey,
  uploadPreset: saved.uploadPreset,
});

type Problems = Partial<Record<'cloudName' | 'apiKey' | 'apiSecret', string>>;

/** What stops a save before the round trip. Nothing is required while the storage is switched off. */
export function validateMediaStorage(draft: Draft, hasSecret: boolean, secret: string): Problems {
  const problems: Problems = {};
  if (!draft.enabled) return problems;
  if (draft.cloudName.trim() === '') problems.cloudName = 'Vyplňte cloud name (najdete ho v Cloudinary na hlavní stránce účtu).';
  if (draft.apiKey.trim() === '') problems.apiKey = 'Vyplňte API key.';
  if (!hasSecret && secret.trim() === '') problems.apiSecret = 'Vyplňte API secret, jinak nejde nic nahrát.';
  return problems;
}

export default function MediaStorageSettingsPage() {
  const device = useDevice();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: MEDIA_STORAGE_QUERY_KEY, queryFn: mediaStorageApi.get, retry: false });
  const saved: MediaStorageSettings | undefined = query.data;

  const [edits, setEdits] = useState<Draft | null>(null);
  const [changingSecret, setChangingSecret] = useState(false);
  const [secret, setSecret] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const draft: Draft | null = edits ?? (saved !== undefined ? toDraft(saved) : null);
  const secretOpen = saved !== undefined && (!saved.hasSecret || changingSecret);

  const dirty = saved !== undefined && (
    (edits !== null && JSON.stringify(edits) !== JSON.stringify(toDraft(saved))) || secret !== ''
  );
  const problems = draft !== null && saved !== undefined ? validateMediaStorage(draft, saved.hasSecret, secret) : {};

  const save = useMutation({
    mutationFn: (body: MediaStorageUpdate) => mediaStorageApi.put(body),
    onSuccess: (next) => {
      queryClient.setQueryData(MEDIA_STORAGE_QUERY_KEY, next);
      setEdits(null);
      setSecret('');
      setChangingSecret(false);
      setAttempted(false);
      setFailure(null);
      setServerErrors({});
      toast.success('Úložiště médií uloženo');
    },
    onError: (error) => {
      setServerErrors(fieldErrorsOf(error));
      setFailure(problemMessageOf(error, 'Nastavení se nepodařilo uložit. Zkuste to prosím znovu.'));
    },
  });

  const submit = () => {
    setAttempted(true);
    if (draft === null || saved === undefined || Object.keys(problems).length > 0) return;
    save.mutate({
      provider: 'cloudinary',
      enabled: draft.enabled,
      cloudName: draft.cloudName.trim(),
      apiKey: draft.apiKey.trim(),
      uploadPreset: draft.uploadPreset.trim(),
      ...(secret.trim() !== '' ? { apiSecret: secret.trim() } : {}),
    });
  };

  const discard = () => {
    setEdits(null);
    setSecret('');
    setChangingSecret(false);
    setAttempted(false);
    setFailure(null);
    setServerErrors({});
  };

  const edit = (patch: Partial<Draft>) => {
    if (draft === null) return;
    setEdits({ ...draft, ...patch });
    setServerErrors({});
  };

  const shown = (field: 'cloudName' | 'apiKey' | 'apiSecret'): string | undefined =>
    serverErrors[field] ?? serverErrors[field.charAt(0).toUpperCase() + field.slice(1)] ?? (attempted ? problems[field] : undefined);

  const form = draft === null || saved === undefined ? null : (
    <Stack spacing={2.5} component="form" noValidate onSubmit={(event) => { event.preventDefault(); submit(); }}>
      {failure !== null && <Alert severity="error">{failure}</Alert>}

      <SoftCard>
        <SectionLabel>Cloudinary</SectionLabel>
        <FormControlLabel
          control={<Switch checked={draft.enabled} onChange={(event) => edit({ enabled: event.target.checked })} slotProps={{ input: { 'aria-label': 'Úložiště médií zapnuto' } }} />}
          label={draft.enabled ? 'Úložiště je zapnuté' : 'Úložiště je vypnuté'}
          sx={{ minHeight: 44, mb: 1 }}
        />
        <Stack spacing={2}>
          <TextField
            label="Cloud name" value={draft.cloudName} onChange={(e) => edit({ cloudName: e.target.value })} fullWidth
            error={shown('cloudName') !== undefined} helperText={shown('cloudName') ?? 'Název vašeho účtu v Cloudinary.'}
            slotProps={{ htmlInput: { autoComplete: 'off' }, input: { sx: { minHeight: 44 } } }}
          />
          <TextField
            label="API key" value={draft.apiKey} onChange={(e) => edit({ apiKey: e.target.value })} fullWidth
            error={shown('apiKey') !== undefined} helperText={shown('apiKey') ?? 'Veřejný klíč účtu.'}
            slotProps={{ htmlInput: { autoComplete: 'off' }, input: { sx: { minHeight: 44 } } }}
          />

          <Box>
            {!secretOpen && saved.hasSecret ? (
              <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography sx={TYPE.label}>API secret</Typography>
                <StatusChip tone="green">Uloženo ✓</StatusChip>
                <Button color="inherit" onClick={() => setChangingSecret(true)} sx={{ minHeight: 44, color: 'primary.main', fontWeight: 700 }}>
                  Změnit
                </Button>
              </Stack>
            ) : (
              <>
                <TextField
                  label="API secret" type="password" value={secret} onChange={(e) => { setSecret(e.target.value); setServerErrors({}); }} fullWidth
                  error={shown('apiSecret') !== undefined}
                  helperText={shown('apiSecret') ?? (saved.hasSecret ? 'Napište nový secret. Uložený se nezobrazuje.' : 'Secret se jen zapisuje; po uložení se už nezobrazí.')}
                  slotProps={{ htmlInput: { autoComplete: 'new-password', spellCheck: false }, input: { sx: { minHeight: 44 } } }}
                />
                {saved.hasSecret && (
                  <Button color="inherit" onClick={() => { setChangingSecret(false); setSecret(''); }} sx={{ minHeight: 44, color: 'text.primary', mt: 0.5 }}>
                    Ponechat uložený secret
                  </Button>
                )}
              </>
            )}
          </Box>

          <TextField
            label="Upload preset (nepovinné)" value={draft.uploadPreset} onChange={(e) => edit({ uploadPreset: e.target.value })} fullWidth
            helperText="Pojmenované nastavení nahrávání v Cloudinary. Když ho nepoužíváte, nechte prázdné."
            slotProps={{ htmlInput: { autoComplete: 'off' }, input: { sx: { minHeight: 44 } } }}
          />
        </Stack>
      </SoftCard>

      <Typography sx={[TYPE.caption, { color: DESIGN.muted }]}>
        Zapnutím úložiště se nic nenahrává — soubory se posílají, až když je na obrazovce Média a texty nahrajete.
      </Typography>
    </Stack>
  );

  const panel = saved === undefined ? null : <StatusPanel saved={saved} />;

  return (
    <SettingsScreen
      title="Úložiště médií"
      subtitle="Kam se ukládají fotky a videa veřejného webu. Přihlašovací údaje se ukládají zašifrované."
      scope="media-storage"
      aside={device === 'desktop' ? panel : false}
      asideTitle="Stav a vysvětlení"
      related={false}
      save={{ dirty, saving: save.isPending, onSave: submit, onDiscard: discard }}
      loading={saved === undefined && !query.isError}
      error={query.isError ? 'Nastavení úložiště médií se nepodařilo načíst.' : undefined}
      onRetry={() => void query.refetch()}
    >
      {form === null ? null : device === 'desktop' ? <Box data-layout="desktop">{form}</Box> : device === 'tablet' ? (
        <Box data-layout="tablet" sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
          {form}
          <SoftCard tone="muted">{panel}</SoftCard>
        </Box>
      ) : (
        <Stack data-layout="phone" spacing={2}>
          <SoftCard tone="muted">{panel}</SoftCard>
          {form}
        </Stack>
      )}
    </SettingsScreen>
  );
}
