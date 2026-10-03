/* ══════════════════════════════════════════════════════════════
   ONE SLOT = ONE CARD

   A text slot: the editor, the default text under it, "Vrátit výchozí".
   A media slot: a preview (the file, or a grey placeholder that says what
   belongs there and at what size), "Nahrát / Nahradit", "Odstranit", an alt
   text for a photo. Both show who changed it last and when, and link to the
   public page the slot appears on.
   ══════════════════════════════════════════════════════════════ */

import { memo } from 'react';
import { Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { OpenInNew as OpenIcon } from '@mui/icons-material';
import { StatusChip } from '../../../components/ui';
import { DESIGN } from '../../../theme';
import { TYPE, settingsLine } from '../../../components/settings/settingsStyle';
import { cloudinaryWidth } from '../../../site/cloudinary';
import type { SlotDef } from '../../../site/slotTypes';
import type { AdminSlot } from '../../../api/siteContentAdmin';
import type { MediaAsset } from '../../../api/media';
import { ALT_LIMIT, TEXT_LIMIT, changedLine, draftChanges, effectiveText, isFilled, isMediaSlot, isMultiline, placeholderSentence, type SlotDraft } from './model';
import { MediaUpload } from './MediaUpload';

export interface SlotCardProps {
  def: SlotDef;
  value: AdminSlot | undefined;
  draft: SlotDraft | undefined;
  /** Why the last save of this slot failed. */
  error?: string;
  saving: boolean;
  /** Search results span several pages: say which one. */
  pageLabel?: string;
  publicPath?: string;
  onDraft: (key: string, patch: SlotDraft) => void;
  onSave: (key: string) => void;
  onDiscard: (key: string) => void;
  onUploaded: (def: SlotDef, asset: MediaAsset) => Promise<void>;
  /** "Odstranit" / "Vrátit výchozí" — the page asks for confirmation. */
  onReset: (def: SlotDef) => void;
}

function Preview({ def, value }: { def: SlotDef; value: AdminSlot | undefined }) {
  const filled = isFilled(def, value);
  const aspect = def.aspect ?? '16 / 9';
  const frame = {
    position: 'relative' as const,
    width: '100%',
    aspectRatio: aspect,
    maxHeight: 280,
    overflow: 'hidden',
    borderRadius: 2,
    border: '1px solid',
    borderColor: settingsLine,
  };

  if (filled && value?.mediaUrl !== undefined) {
    const isVideo = (value.kind ?? def.kind) === 'video';
    const picture = isVideo ? value.posterUrl : value.mediaUrl;
    return (
      <Box data-slot-preview="file" sx={{ ...frame, bgcolor: '#16191E' }}>
        {picture !== undefined ? (
          <Box
            component="img"
            src={cloudinaryWidth(picture, 800)}
            alt={isVideo ? `Náhled videa: ${def.label}` : value.alt !== undefined && value.alt !== '' ? value.alt : def.label}
            sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
            Video je nahrané
          </Box>
        )}
        {isVideo && (
          <Box sx={{ position: 'absolute', left: 8, bottom: 8 }}>
            <StatusChip tone="grey" size="sm">VIDEO</StatusChip>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box
      data-slot-preview="placeholder"
      sx={{
        ...frame,
        minHeight: 140,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        p: 2,
        textAlign: 'center',
        bgcolor: DESIGN.tone.grey.bg,
        border: '1px dashed',
        borderColor: DESIGN.hatch.closedLine,
      }}
    >
      <Typography sx={[TYPE.itemName, { color: DESIGN.tone.grey.fg }]}>{placeholderSentence(def)}</Typography>
      {def.caption !== undefined && def.caption !== '' && (
        <Typography sx={TYPE.caption}>Na webu: {def.caption}</Typography>
      )}
    </Box>
  );
}

function FileFacts({ value }: { value: AdminSlot | undefined }) {
  if (value?.mediaUrl === undefined) return null;
  const size = value.width !== undefined && value.height !== undefined ? `${value.width} × ${value.height} px` : '';
  return size !== '' ? <Typography sx={TYPE.caption}>Nahráno: {size}</Typography> : null;
}

export const SlotCard = memo(function SlotCard({
  def, value, draft, error, saving, pageLabel, publicPath, onDraft, onSave, onDiscard, onUploaded, onReset,
}: SlotCardProps) {
  const media = isMediaSlot(def);
  const filled = isFilled(def, value);
  const changes = draftChanges(def, value, draft);
  const dirty = Object.keys(changes).length > 0;
  const changed = changedLine(value);
  const headingId = `slot-${def.key}`;

  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      data-slot-card={def.key}
      sx={{ border: '1px solid', borderColor: settingsLine, borderRadius: 3, bgcolor: 'background.paper', p: 2, minWidth: 0 }}
    >
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          {pageLabel !== undefined && <Typography sx={TYPE.label}>{pageLabel}</Typography>}
          <Typography id={headingId} component="h4" sx={TYPE.itemName}>{def.label}</Typography>
        </Box>
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {dirty && <StatusChip tone="beige">Neuloženo</StatusChip>}
          {filled
            ? <StatusChip tone="green">{media ? 'Nahráno' : 'Upraveno'}</StatusChip>
            : <StatusChip tone="grey">{media ? 'Čeká na soubor' : 'Výchozí'}</StatusChip>}
        </Stack>
      </Stack>

      {media ? (
        <Stack spacing={1.5}>
          <Preview def={def} value={value} />
          {def.recommended !== undefined && <Typography sx={TYPE.caption}>Doporučená velikost: {def.recommended}</Typography>}
          <FileFacts value={value} />
          {filled && (value?.kind ?? def.kind) === 'image' && (
            <TextField
              size="small"
              fullWidth
              label="Popis fotky (alt)"
              value={draft?.alt ?? value?.alt ?? ''}
              onChange={(event) => onDraft(def.key, { alt: event.target.value })}
              helperText="Čte ho čtečka obrazovky pro nevidomé a vyhledávače. Napište, co je na fotce."
              slotProps={{ htmlInput: { maxLength: ALT_LIMIT, style: { minHeight: 24 } } }}
              sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
            />
          )}
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <MediaUpload
              kind={def.kind === 'video' ? 'video' : 'image'}
              slotKey={def.key}
              forLabel={def.label}
              buttonLabel={filled ? 'Nahradit' : 'Nahrát'}
              variant={filled ? 'outlined' : 'contained'}
              disabled={saving}
              onUploaded={(asset) => onUploaded(def, asset)}
            />
            {filled && (
              <Button color="inherit" onClick={() => onReset(def)} disabled={saving} sx={{ minHeight: 44, color: DESIGN.danger, fontWeight: 600 }}>
                Odstranit
              </Button>
            )}
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={1.25}>
          <TextField
            fullWidth
            multiline={isMultiline(def)}
            minRows={isMultiline(def) ? 3 : undefined}
            maxRows={14}
            value={draft?.text ?? effectiveText(def, value)}
            onChange={(event) => onDraft(def.key, { text: event.target.value })}
            error={error !== undefined}
            slotProps={{ htmlInput: { 'aria-label': def.label, maxLength: TEXT_LIMIT + 200 }, input: { sx: { minHeight: 44, alignItems: 'flex-start' } } }}
          />
          <Box>
            <Typography sx={TYPE.label}>Výchozí text</Typography>
            <Typography sx={[TYPE.caption, { whiteSpace: 'pre-line', overflowWrap: 'anywhere' }]}>{def.defaultText}</Typography>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {dirty && (
              <>
                <Button variant="contained" onClick={() => onSave(def.key)} disabled={saving} sx={{ minHeight: 44, fontWeight: 700 }}>
                  {saving ? 'Ukládám…' : 'Uložit text'}
                </Button>
                <Button color="inherit" onClick={() => onDiscard(def.key)} disabled={saving} sx={{ minHeight: 44, color: 'text.primary' }}>
                  Zrušit změnu
                </Button>
              </>
            )}
            <Button color="inherit" onClick={() => onReset(def)} disabled={saving || !filled} sx={{ minHeight: 44, color: filled ? DESIGN.danger : undefined, fontWeight: 600 }}>
              Vrátit výchozí
            </Button>
          </Stack>
        </Stack>
      )}

      {media && dirty && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1.25 }}>
          <Button variant="contained" onClick={() => onSave(def.key)} disabled={saving} sx={{ minHeight: 44, fontWeight: 700 }}>
            {saving ? 'Ukládám…' : 'Uložit popis'}
          </Button>
          <Button color="inherit" onClick={() => onDiscard(def.key)} disabled={saving} sx={{ minHeight: 44, color: 'text.primary' }}>
            Zrušit změnu
          </Button>
        </Stack>
      )}

      {error !== undefined && (
        <Typography role="alert" sx={{ mt: 1, fontSize: 14, fontWeight: 600, color: DESIGN.danger }}>{error}</Typography>
      )}

      <Stack direction="row" spacing={1.5} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={TYPE.caption}>{changed !== '' ? changed : 'Zatím beze změny'}</Typography>
        {publicPath !== undefined && (
          <Link
            href={publicPath}
            target="_blank"
            rel="noopener"
            aria-label={`Zobrazit na webu: ${def.label}`}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minHeight: 44, fontWeight: 600, fontSize: 14 }}
          >
            Zobrazit na webu <OpenIcon sx={{ fontSize: 16 }} />
          </Link>
        )}
      </Stack>
    </Box>
  );
});
