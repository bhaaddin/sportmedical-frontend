/*
 * What a činnost needs besides its price: the documents it makes the patient
 * deliver, the colour it is drawn in, and how many people it serves at once.
 *
 *   Dokumenty            any number of the clinic's document templates; none by default.
 *                        Legal consents (GDPR, consent to the procedure) are not here -
 *                        they are always required.
 *   Barva                a colour of its own from the palette, or the shade of its služba
 *   Souběžně obslouženo  whole number >= 1; club-block planning divides by it
 *
 * Saved with `PUT /api/activities/{id}`, which is the whole činnost, so the rest
 * travels back exactly as it was read (`activityToInput`). Full screen on a
 * phone, a dialog from a tablet up; every row is at least 44 px.
 */
import { useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  InputAdornment, Stack, TextField, Typography,
} from '@mui/material';
import { activitiesApi, activityToInput } from '../../api/activities';
import type { Activity } from '../../api/bookingContracts';
import { BookingApiError } from '../../api/apiError';
import type { DocumentTemplate } from '../../api/documents';
import { useIsPhone } from '../../layout/useDevice';
import { TYPE, settingsLine } from '../../components/settings/settingsStyle';
import { PaletteChoice } from '../settings/colors/PaletteChoice';
import { normalizeHex } from '../settings/colors/colorLogic';

const whole = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

export default function ActivityExtrasDialog({
  activity, serviceColor, templates, templatesFailed, palette, onClose, onSaved,
}: {
  activity: Activity;
  /** The služba's colour the činnost's shade comes from; null when it has none. */
  serviceColor: string | null;
  templates: DocumentTemplate[];
  templatesFailed: boolean;
  palette: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const phone = useIsPhone();
  const [documents, setDocuments] = useState<string[]>(activity.requiredDocumentTemplateIds);
  const [color, setColor] = useState<string | null>(activity.colorHex ?? null);
  const [capacity, setCapacity] = useState(String(activity.parallelCapacity ?? 1));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const parsed = whole(capacity);
  const capacityError = parsed === null || parsed < 1 ? 'Souběžně obslouženo je celé číslo od 1.' : undefined;

  const original = {
    docs: [...activity.requiredDocumentTemplateIds].sort().join(','),
    color: activity.colorHex ?? null,
    capacity: String(activity.parallelCapacity ?? 1),
  };
  const dirty = [...documents].sort().join(',') !== original.docs || color !== original.color || capacity.trim() !== original.capacity;

  const toggle = (id: string) => setDocuments((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  /* A template put away since it was ticked stays visible, so the owner can untick it. */
  const knownIds = new Set(templates.map((t) => t.id));
  const orphans = documents.filter((id) => !knownIds.has(id));

  const save = async () => {
    setAttempted(true);
    if (capacityError !== undefined || parsed === null) return;
    setSaving(true);
    setFailed(null);
    try {
      await activitiesApi.update(activity.id, activityToInput(activity, {
        requiredDocumentTemplateIds: documents,
        colorHex: color,
        parallelCapacity: parsed,
      }));
      onSaved();
      onClose();
    } catch (error) {
      setFailed(error instanceof BookingApiError && error.serverMessage !== undefined ? error.serverMessage : 'Činnost se nepodařilo uložit. Zkuste to prosím znovu.');
    } finally {
      setSaving(false);
    }
  };

  const shown = color ?? activity.effectiveColorHex ?? serviceColor;

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullScreen={phone} maxWidth="sm" fullWidth aria-labelledby="cinnost-nastaveni-title">
      <DialogTitle id="cinnost-nastaveni-title" sx={{ fontSize: 18, fontWeight: 700 }}>
        Činnost: {activity.name}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {failed !== null && <Alert severity="error">{failed}</Alert>}

          <Box component="section" aria-labelledby="cinnost-dokumenty">
            <Typography id="cinnost-dokumenty" component="h3" sx={TYPE.label}>Požadované dokumenty</Typography>
            <Typography sx={[TYPE.caption, { mt: 0.5, mb: 1 }]}>
              Co musí pacient k této činnosti doručit. Ve výchozím stavu nic; zákonné souhlasy (GDPR, souhlas s výkonem) se vyžadují vždy.
            </Typography>
            {templatesFailed ? (
              <Alert severity="warning">Šablony dokumentů se nepodařilo načíst, výběr teď nejde změnit.</Alert>
            ) : templates.length === 0 && orphans.length === 0 ? (
              <Typography sx={TYPE.caption}>Zatím nejsou žádné šablony dokumentů. Založíte je v Nastavení › Dokumenty.</Typography>
            ) : (
              <Box role="group" aria-label="Požadované dokumenty" sx={{ border: '1px solid', borderColor: settingsLine, borderRadius: 2, maxHeight: 240, overflowY: 'auto' }}>
                {templates.map((t) => (
                  <FormControlLabel
                    key={t.id}
                    sx={{ display: 'flex', m: 0, px: 1.5, minHeight: 44, borderBottom: '1px solid', borderColor: settingsLine, '&:last-of-type': { borderBottom: 0 } }}
                    control={<Checkbox checked={documents.includes(t.id)} onChange={() => toggle(t.id)} />}
                    label={t.name}
                  />
                ))}
                {orphans.map((id) => (
                  <FormControlLabel
                    key={id}
                    sx={{ display: 'flex', m: 0, px: 1.5, minHeight: 44 }}
                    control={<Checkbox checked onChange={() => toggle(id)} />}
                    label="Šablona, která už není v nabídce"
                  />
                ))}
              </Box>
            )}
          </Box>

          <Box component="section" aria-labelledby="cinnost-barva">
            <Typography id="cinnost-barva" component="h3" sx={TYPE.label}>Barva</Typography>
            <Typography sx={[TYPE.caption, { mt: 0.5, mb: 1 }]}>
              Bez vlastní barvy se činnost kreslí v odstínu své služby. Barvu si můžete vybrat z palety.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
              <Box role="img" aria-label={`Teď: ${shown === null ? 'bez barvy' : normalizeHex(shown)}`} sx={{ width: 24, height: 24, borderRadius: '6px', border: '1px solid', borderColor: settingsLine, bgcolor: shown ?? 'transparent' }} />
              <Typography sx={TYPE.itemName}>{color === null ? 'Odstín služby' : 'Vlastní barva'}</Typography>
            </Stack>
            <PaletteChoice palette={palette} value={color} onPick={setColor} onClear={color === null ? undefined : () => setColor(null)} ariaLabel="Barva činnosti" />
          </Box>

          <Box>
            <TextField
              label="Souběžně obslouženo"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              error={attempted && capacityError !== undefined}
              helperText={attempted && capacityError !== undefined ? capacityError : 'Kolik lidí nebo stanovišť zvládne tuto činnost naráz. Podle toho plánovač klubových bloků počítá, kolik hráčů projde za den.'}
              size={phone ? 'medium' : 'small'}
              fullWidth
              slotProps={{ htmlInput: { inputMode: 'numeric' }, input: { endAdornment: <InputAdornment position="end">naráz</InputAdornment> } }}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, gap: 1, '& > button': { minHeight: 44 } }}>
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={saving}>Zrušit</Button>
        <Button variant="contained" onClick={() => void save()} disabled={!dirty || saving} sx={{ fontWeight: 700 }}>
          {saving ? 'Ukládám…' : 'Uložit činnost'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
