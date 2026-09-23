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
  Alert, Box, Button, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, InputAdornment, Stack, Switch, TextField,
} from '@mui/material';
import { servicesApi } from '../../api/services';
import type { ServiceItem } from '../../api/services';
import {
  draftFrom, hasErrors, toRequest, validateService,
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
        {service === null ? 'Nová položka ceníku' : 'Upravit položku ceníku'}
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

          <TextField
            label="Popis"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            multiline
            minRows={2}
            fullWidth
            helperText="Co pacient dostane. Ukazuje se na kartě v ceníku."
          />

          {/*
            * No "Trvání" here.
            *
            * How long something takes is a fact about the činnost - it is the
            * time it occupies in a calendar - and a doklad or a faktura has no
            * use for it. Booking measured it: the price-list duration was read
            * in exactly one place in the whole system, a comparison against the
            * činnost's own, and that comparison is gone along with the
            * `price.duration_drift` warning it raised. It sent people to
            * correct the number that did not matter.
            *
            * The value is still sent, untouched on an edit and a default on a
            * new row, because the column is still there and nobody reads it.
            */}
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
                label="Aktivní — ještě se prodává"
              />
              {/* Not "nabízí se pacientům": this is the price list and no
                  patient sees it. Whether a patient can pick something when
                  booking is `isPubliclyBookable`, and that lives on the
                  činnost. */}
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
