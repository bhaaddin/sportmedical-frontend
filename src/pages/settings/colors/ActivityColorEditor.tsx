/*
 * ActivityColorEditor - the colour of ONE činnost (reviewer 2.6), the same editor wherever a činnost is coloured (Nastavení ->
 * Barvy služeb a činností, and the činnost's own dialog in Ceník):
 *
 *   paleta         the clinic's own palette (Nastavení), one 44 px swatch per colour - no second palette;
 *   vlastní barva  any #RRGGBB, typed or picked, checked as it is typed;
 *   náhled         live, before anything is saved: the činnost as a pill with the text that reads on it (and how well), as a card
 *                  on the dark calendar, and as a dot on the light page - the three places it is drawn;
 *   obnovit        back to the default: the činnost's own distinct default colour (src/colors/defaultActivityColors.ts; the own colour is cleared).
 *
 * The same editor colours a služba or a kalendář (`subject`): same palette, same guard, same live preview, a reset to that subject's default.
 *
 * The guard (`guardActivityColor`) refuses what could not be seen on the dark calendar or the light page; the text colour on the
 * fill is chosen to read at AA, so a colour never makes its own label illegible. `onChange(hex)` is called when a colour is
 * applied, `onChange(null)` on "Obnovit výchozí".
 */
import { useMemo, useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { AA } from '../../../accent';
import { DARK_SURFACE, GUARD_TEXT, LIGHT_SURFACE, NEUTRAL_ACTIVITY_COLOR, cleanHex, guardActivityColor, textOnColor, typedHex } from '../../../colors/activityColor';
import { TYPE, settingsLine } from '../../../components/settings/settingsStyle';
import { FIELD_EDGE } from '../../../theme';

export const COLOR_EDITOR_TEXT = {
  palette: 'Paleta barev',
  paletteLabel: 'Barva',
  custom: 'Jiná barva (#RRGGBB)',
  customHelp: 'Zadejte #RRGGBB, například #E9C46A.',
  apply: 'Použít tuto barvu',
  reset: 'Použít výchozí barvu',
  resetHint: 'Obnoví výchozí barvu: každá činnost má svůj vlastní výrazný odstín, který se nemění',
  preview: 'Náhled',
  previewPill: 'Štítek činnosti',
  previewBoard: 'Na tmavém kalendáři',
  previewLight: 'Na světlé stránce',
  contrast: (ratio: number) => `Text na barvě: ${ratio.toFixed(1).replace('.', ',')} : 1 (${ratio >= AA ? 'splňuje AA' : 'pod AA'})`,
  inherited: 'Výchozí barva',
  own: 'Vlastní barva',
  disabledSwatch: 'Tato barva by nebyla vidět',
} as const;

const SUBJECT_TITLE = { 'činnost': 'Barva činnosti', 'služba': 'Barva služby', 'kalendář': 'Barva kalendáře' } as const;

const fmt = (ratio: number): string => ratio.toFixed(1).replace('.', ',');

export function ActivityColorEditor({
  activityName,
  palette,
  value,
  fallback,
  onChange,
  busy = false,
  groupLabel = COLOR_EDITOR_TEXT.palette,
  subject = 'činnost',
  resetHint = COLOR_EDITOR_TEXT.resetHint,
}: {
  /** The name shown in the title and the preview (the činnost's, the služba's, the kalendář's). */
  activityName: string;
  /** What is being coloured; only the title and the reset's hint change. */
  subject?: 'činnost' | 'služba' | 'kalendář';
  resetHint?: string;
  /** The clinic's palette (#RRGGBB each). */
  palette: readonly string[];
  /** The činnost's own colour, or null when it takes its služba's shade. */
  value: string | null;
  /** The colour it is drawn in without an own colour (its default): what "Použít výchozí barvu" gives back. */
  fallback: string | null;
  onChange: (hex: string | null) => void;
  busy?: boolean;
  /** The accessible name of the palette (the činnost dialog of Ceník calls it "Barva činnosti"). */
  groupLabel?: string;
}) {
  const current = typedHex(value);
  const [draft, setDraft] = useState(current ?? '');
  const guard = useMemo(() => guardActivityColor(draft), [draft]);
  const typed = draft.trim() !== '';
  /* What the preview shows: the colour being typed while it is a colour, else what the činnost is drawn in now. */
  const shown = guard.hex ?? current ?? typedHex(fallback) ?? NEUTRAL_ACTIVITY_COLOR;
  const text = textOnColor(shown);
  const canApply = !busy && guard.ok && guard.hex !== null && guard.hex !== current;

  return (
    <Stack spacing={2} data-testid="activity-color-editor" sx={{ minWidth: 0 }}>
      <Typography sx={TYPE.itemName}>{`${SUBJECT_TITLE[subject]} ${activityName}`}</Typography>

      <Box role="group" aria-label={groupLabel} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {palette.map((entry) => {
          const hex = typedHex(entry);
          if (hex === null) return null;
          const swatchGuard = guardActivityColor(hex);
          const selected = current === hex;
          return (
            <Box
              key={hex}
              component="button"
              type="button"
              aria-label={`${COLOR_EDITOR_TEXT.paletteLabel} ${hex}`}
              aria-pressed={selected}
              disabled={busy || !swatchGuard.ok}
              title={swatchGuard.ok ? hex : COLOR_EDITOR_TEXT.disabledSwatch}
              onClick={() => { setDraft(hex); onChange(hex); }}
              sx={{
                width: 44, height: 44, borderRadius: 2, bgcolor: hex, cursor: swatchGuard.ok ? 'pointer' : 'not-allowed', display: 'grid', placeItems: 'center',
                color: swatchGuard.text?.color ?? '#FFFFFF', border: '2px solid', borderColor: selected ? 'text.primary' : 'transparent', opacity: swatchGuard.ok ? 1 : 0.35,
                outlineOffset: 2, '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' },
              }}
            >
              {selected ? <CheckIcon fontSize="small" /> : null}
            </Box>
          );
        })}
        {palette.length === 0 ? <Typography sx={TYPE.caption}>Paleta je prázdná.</Typography> : null}
      </Box>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          size="small"
          label={COLOR_EDITOR_TEXT.custom}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          error={typed && !guard.ok}
          helperText={typed && !guard.ok ? guard.problems[0] : COLOR_EDITOR_TEXT.customHelp}
          slotProps={{ htmlInput: { 'aria-label': COLOR_EDITOR_TEXT.custom, maxLength: 9, spellCheck: false, 'data-testid': 'color-hex-input' } }}
          sx={{ flex: 1, minWidth: 0 }}
          disabled={busy}
        />
        <Box
          component="input"
          type="color"
          aria-label="Výběr barvy"
          value={(guard.hex ?? current ?? typedHex(fallback) ?? NEUTRAL_ACTIVITY_COLOR).toLowerCase()}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value.toUpperCase())}
          disabled={busy}
          sx={{ width: 44, height: 40, p: 0, border: '1px solid', borderColor: (t) => FIELD_EDGE[t.palette.mode], borderRadius: 1, bgcolor: 'transparent', cursor: 'pointer' }}
        />
      </Stack>

      {/* the live preview: before anything is saved, in the three places the colour is drawn */}
      <Box data-testid="color-preview" aria-label={COLOR_EDITOR_TEXT.preview} role="group" sx={{ display: 'grid', gap: 1, p: 1.5, borderRadius: 2, border: '1px solid', borderColor: settingsLine }}>
        <Typography sx={TYPE.label}>{COLOR_EDITOR_TEXT.preview}</Typography>
        <Box
          data-testid="color-preview-pill"
          sx={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', px: 1.5, minHeight: 32, borderRadius: 999, bgcolor: shown, color: text.color, fontSize: 14, fontWeight: 650 }}
          title={COLOR_EDITOR_TEXT.previewPill}
        >
          {activityName}
        </Box>
        <Typography data-testid="color-contrast" sx={TYPE.caption}>{COLOR_EDITOR_TEXT.contrast(text.ratio)}</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Box data-testid="color-preview-board" aria-label={COLOR_EDITOR_TEXT.previewBoard} sx={{ flex: '1 1 140px', minWidth: 0, p: 1, borderRadius: 1.5, bgcolor: DARK_SURFACE }}>
            <Box sx={{ borderLeft: '4px solid', borderColor: shown, bgcolor: `color-mix(in srgb, ${shown} 24%, ${DARK_SURFACE})`, color: '#F4FAFF', px: 1, py: 0.75, borderRadius: '4px', fontSize: 12, fontWeight: 650, boxShadow: `0 0 8px color-mix(in srgb, ${shown} 45%, transparent)` }}>
              {activityName}
              <Box component="span" sx={{ display: 'block', fontWeight: 500, opacity: 0.85 }}>08:00 – 08:40</Box>
            </Box>
          </Box>
          <Box data-testid="color-preview-light" aria-label={COLOR_EDITOR_TEXT.previewLight} sx={{ flex: '1 1 140px', minWidth: 0, p: 1, borderRadius: 1.5, bgcolor: LIGHT_SURFACE, border: '1px solid', borderColor: settingsLine, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box aria-hidden component="span" sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: shown, flexShrink: 0 }} />
            <Typography component="span" sx={{ fontSize: 12.5, color: '#1A1D21', fontWeight: 600 }}>{activityName}</Typography>
          </Box>
        </Box>
        {guard.hex !== null ? (
          <Typography sx={TYPE.caption} data-testid="color-visibility">
            {`Na tmavém ${fmt(guard.onDark ?? 0)} : 1 · na světlém ${fmt(guard.onLight ?? 0)} : 1`}
          </Typography>
        ) : null}
      </Box>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button variant="contained" disabled={!canApply} onClick={() => { if (guard.hex !== null) onChange(guard.hex); }} sx={{ minHeight: 44, fontWeight: 700 }} data-testid="color-apply">
          {COLOR_EDITOR_TEXT.apply}
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          disabled={busy || current === null}
          title={resetHint}
          onClick={() => { setDraft(''); onChange(null); }}
          sx={{ minHeight: 44, fontWeight: 600 }}
          data-testid="color-reset"
        >
          {COLOR_EDITOR_TEXT.reset}
        </Button>
      </Stack>
      <Typography sx={TYPE.caption} data-testid="color-state">{current === null ? COLOR_EDITOR_TEXT.inherited : COLOR_EDITOR_TEXT.own}</Typography>
    </Stack>
  );
}

export { GUARD_TEXT };
export default ActivityColorEditor;
