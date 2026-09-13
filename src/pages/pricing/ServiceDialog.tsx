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
import { useQuery } from '@tanstack/react-query';
import { Shield } from '@mui/icons-material';
import { servicesApi } from '../../api/services';
import { documentsApi } from '../../api/documents';
import { categoryMeaning, nearMiss } from './categoryMeaning';
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

  /*
   * What the category actually decides. It stopped being a label on
   * 13. 9. 2026: a required document hangs off it, so a služba filed under
   * `Prohlídka` makes the patient bring a výpis and one under `Měření` does
   * not. The field is free text and the server matches it exactly, so the
   * screen has to say which of those is happening.
   */
  const rules = useQuery({
    queryKey: ['document-requirement-rules'],
    queryFn: documentsApi.requirementRules,
    staleTime: 5 * 60 * 1000,
  });
  const known = categoriesInUse(existing);
  const meaning = categoryMeaning(draft.category, rules.data ?? [], known);
  const slip = meaning.kind === 'new' ? nearMiss(draft.category, known) : null;

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

          <Autocomplete
            freeSolo
            options={known}
            value={draft.category}
            onInputChange={(_, value) => set('category', value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Kategorie"
                error={errors.category !== undefined}
                helperText={
                  errors.category ??
                  'Podle kategorie systém pozná, co musí pacient doložit'
                }
              />
            )}
          />

          {/* Said where it is chosen, not in a manual. */}
          {meaning.kind === 'requires' && (
            <Alert severity="info" icon={<Shield fontSize="small" />}>
              Pacient objednaný na položku v kategorii „{draft.category.trim()}“ musí
              doložit: <strong>{meaning.documents.join(', ')}</strong>.
            </Alert>
          )}

          {meaning.kind === 'known-no-rule' && (
            <Alert severity="info" variant="outlined">
              Ke kategorii „{draft.category.trim()}“ se nepojí žádný povinný dokument —
              pacient nemusí nic dokládat.
            </Alert>
          )}

          {/*
            * A new category is allowed. It is worth saying anyway, because on
            * screen it looks exactly like a mistyped existing one - and the
            * two differ by whether a required medical document is asked for.
            */}
          {meaning.kind === 'new' && (
            <Alert severity="warning">
              „{draft.category.trim()}“ je nová kategorie — zatím ji nemá žádná jiná
              položka a nepojí se k ní žádný povinný dokument.
              {slip !== null && (
                <>
                  {' '}Nemysleli jste <strong>{slip}</strong>?{' '}
                  <Button
                    size="small"
                    onClick={() => set('category', slip)}
                    sx={{ textTransform: 'none', p: 0, minWidth: 0, verticalAlign: 'baseline' }}
                  >
                    Použít
                  </Button>
                </>
              )}
            </Alert>
          )}

          <TextField
            label="Popis"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            multiline
            minRows={2}
            fullWidth
            helperText="Co pacient dostane. Ukazuje se na kartě v ceníku."
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
