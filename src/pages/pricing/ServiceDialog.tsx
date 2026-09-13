/*
 * Adding a service to the price list, or changing one.
 *
 * The screen this sits behind had a button reading "Upravit ceník" wired to
 * nothing at all: eight priced services on display and no way to touch any of
 * them, while the server had create, update and archive the whole time.
 *
 * Everything is checked before it is sent, because the server checks almost
 * nothing - see `serviceForm.ts` for which rule guards what.
 */
import { useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, InputAdornment, Stack, Switch, TextField,
} from '@mui/material';
import { servicesApi } from '../../api/services';
import type { ServiceItem } from '../../api/services';
import {
  categoriesInUse, draftFrom, hasErrors, toRequest, validateService,
} from './serviceForm';
import type { ServiceDraft, ServiceErrors } from './serviceForm';

interface Props {
  open: boolean;
  /** The service being changed, or `null` to add a new one. */
  service: ServiceItem | null;
  /** Everything already in the list - the uniqueness check needs it. */
  existing: ServiceItem[];
  onClose: () => void;
  onSaved: () => void;
}

export default function ServiceDialog({ open, service, existing, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<ServiceDraft>(() => draftFrom(service));
  const [errors, setErrors] = useState<ServiceErrors>({});
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const set = (field: keyof ServiceDraft, value: string | boolean) => {
    setDraft((d) => ({ ...d, [field]: value }));
    /* Clear that one field's complaint as soon as it is being fixed; leave the
       others, so correcting one does not hide the rest. */
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const save = async () => {
    const found = validateService(draft, existing, service?.id ?? null);
    if (hasErrors(found)) {
      setErrors(found);
      return;
    }

    setSaving(true);
    setFailed(null);
    try {
      const body = toRequest(draft);
      if (service === null) await servicesApi.create(body);
      else await servicesApi.update(service.id, body);
      onSaved();
      onClose();
    } catch {
      setFailed('Uložení se nepodařilo. Zkuste to prosím znovu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {service === null ? 'Nová služba' : 'Upravit službu'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {failed !== null && <Alert severity="error">{failed}</Alert>}

          <Stack direction="row" spacing={2}>
            <TextField
              label="Kód"
              value={draft.code}
              onChange={(e) => set('code', e.target.value)}
              error={errors.code !== undefined}
              helperText={errors.code ?? 'Krátká zkratka, např. KP'}
              sx={{ width: 160 }}
            />
            <TextField
              label="Název"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              error={errors.name !== undefined}
              helperText={errors.name}
              fullWidth
            />
          </Stack>

          <Autocomplete
            freeSolo
            options={categoriesInUse(existing)}
            value={draft.category}
            onInputChange={(_, value) => set('category', value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Kategorie"
                error={errors.category !== undefined}
                helperText={errors.category ?? 'Vyberte ze seznamu, nebo napište novou'}
              />
            )}
          />

          <TextField
            label="Popis"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            multiline
            minRows={2}
            fullWidth
            helperText="Co pacient dostane. Ukazuje se na kartě služby."
          />

          <Stack direction="row" spacing={2}>
            <TextField
              label="Trvání"
              value={draft.durationMinutes}
              onChange={(e) => set('durationMinutes', e.target.value)}
              error={errors.durationMinutes !== undefined}
              helperText={errors.durationMinutes}
              slotProps={{ input: {
                endAdornment: <InputAdornment position="end">min</InputAdornment>,
              } }}
              fullWidth
            />
            <TextField
              label="Cena"
              value={draft.priceCzk}
              onChange={(e) => set('priceCzk', e.target.value)}
              error={errors.priceCzk !== undefined}
              helperText={errors.priceCzk}
              slotProps={{ input: {
                endAdornment: <InputAdornment position="end">Kč</InputAdornment>,
              } }}
              fullWidth
            />
          </Stack>

          {/* Only when changing an existing one: a new service is active by
              definition, and the create route has no such field. */}
          {service !== null && (
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.isActive}
                    onChange={(e) => set('isActive', e.target.checked)}
                  />
                }
                label="Aktivní — nabízí se pacientům"
              />
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Zrušit</Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ bgcolor: '#0D7377' }}>
          {saving ? 'Ukládám…' : 'Uložit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
