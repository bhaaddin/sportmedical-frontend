/*
 * The planner's tint (R15d: "the fixed blue colour of the calendar I do not like, I want to change it in Settings").
 *
 * The planner stage - its frame, the lit borders, the selected tab, the primary button, the rings - is drawn in ONE tint. It used to
 * be the prototype's cyan, fixed; now it follows the colour of the application (Nastavení -> Osobní -> Vzhled) until somebody picks
 * one of its own here. The pick is checked the way the accent is (`sanitizeAccent`: it must stand out as a button on a white page,
 * 3:1), and the preview shows the tint in BOTH modes - the dark glass and the light page - before it is applied.
 *
 *   paleta        the six colours of the application + the clinic's palette;
 *   vlastní barva any #RRGGBB, typed or picked, checked as it is typed;
 *   náhled        live: a mini planner header in dark and in light with the tint as its primary button, tab and ring;
 *   výchozí       "Sledovat barvu aplikace": no tint of its own.
 *
 * The clinic's, saved in the calendar display settings (`plannerTintColor`), when the server keeps it and the person may change clinic
 * settings; otherwise remembered in this browser (like the accent). A browser's own tint wins over the clinic's.
 */
import { useMemo, useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { AA, DEFAULT_ACCENT_HEX, accentInk, contrastRatio, deriveShift, normalizeHex, onAccentText, sanitizeAccent, shiftColor, CYAN, ON_ACCENT_INK } from '../../../accent';
import { DARK_SURFACE, LIGHT_SURFACE } from '../../../colors/activityColor';
import { TYPE, settingsLine } from '../../../components/settings/settingsStyle';
import { THEME_ACCENTS } from '../../../theme';
import { FIELD_EDGE } from '../../../theme';

export const TINT_TEXT = {
  title: 'Barva plánovače',
  help: 'Rámečky, vybraná záložka, hlavní tlačítko a prstence plánovače. Dokud nevyberete vlastní, plánovač sleduje barvu aplikace.',
  palette: 'Barvy plánovače',
  custom: 'Jiná barva (#RRGGBB)',
  customHelp: 'Zadejte #RRGGBB, například #2563EB.',
  apply: 'Použít tuto barvu',
  follow: 'Sledovat barvu aplikace',
  followHint: 'Plánovač se vrátí k barvě aplikace',
  preview: 'Náhled',
  previewDark: 'Tmavý režim',
  previewLight: 'Světlý režim',
  tooPale: 'Příliš světlá: na bílé stránce by tlačítko nebylo vidět. Zvolte tmavší barvu.',
  notHex: 'Zadejte barvu jako #RRGGBB, například #2563EB.',
  followsNow: 'Plánovač sleduje barvu aplikace',
  ownNow: 'Plánovač má vlastní barvu',
  scopeClinic: 'Platí pro celou kliniku, na všech počítačích.',
  scopeBrowser: 'Platí jen v tomto prohlížeči.',
  scopeBrowserNoRight: 'Platí jen v tomto prohlížeči. Barvu pro celou kliniku mění správce nastavení.',
  browserOwn: (hex: string) => `Tento prohlížeč má vlastní barvu plánovače (${hex}), která má přednost před barvou kliniky.`,
  useClinic: 'Použít barvu kliniky',
  savedClinic: 'Barva plánovače uložena pro celou kliniku.',
  saveFailed: 'Barvu plánovače se nepodařilo uložit. Zkuste to prosím znovu.',
} as const;

const fmt = (n: number): string => n.toFixed(1).replace('.', ',');

/** Whether `input` can be the tint, and the normalised colour. The rule is the accent's: >= 3:1 against white. */
export function guardTint(input: string): { ok: boolean; hex: string | null; problem: string | null } {
  const v = input.trim();
  const withHash = v.startsWith('#') ? v : `#${v}`;
  const hex = /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : null;
  if (hex === null) return { ok: false, hex: null, problem: TINT_TEXT.notHex };
  if (sanitizeAccent(hex) !== hex) return { ok: false, hex, problem: TINT_TEXT.tooPale };
  return { ok: true, hex, problem: null };
}

/** A mini planner header drawn in the tint, in one mode: the primary button, the selected tab and a ring. */
function MiniPlanner({ tint, mode, label }: { tint: string; mode: 'dark' | 'light'; label: string }) {
  const dark = mode === 'dark';
  const accent = dark ? shiftColor(CYAN, deriveShift(tint)) : tint;
  const ink = dark ? ON_ACCENT_INK : onAccentText(tint);
  const text = dark ? '#F4FAFF' : '#1A1D21';
  const ringText = dark ? accent : accentInk(tint);
  return (
    <Box
      data-testid={`tint-preview-${mode}`}
      aria-label={label}
      role="group"
      sx={{ flex: '1 1 150px', minWidth: 0, p: 1, borderRadius: 1.5, bgcolor: dark ? DARK_SURFACE : LIGHT_SURFACE, border: '1px solid', borderColor: dark ? accent : settingsLine }}
    >
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: dark ? '#A3B9CE' : '#5A636D', mb: 0.5 }}>{label}</Typography>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
        <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: '6px', bgcolor: accent, color: ink, fontSize: 11, fontWeight: 700 }}>Objednávka</Box>
        <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: '6px', border: '1px solid', borderColor: accent, color: text, fontSize: 11, fontWeight: 600 }}>Týden</Box>
        <Box component="span" sx={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid', borderColor: accent, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: ringText }}>22</Box>
      </Stack>
    </Box>
  );
}

export function PlannerTintEditor({
  value,
  followed,
  palette,
  onChange,
}: {
  /** The tint the planner is drawn in now (its own, else the application's accent). */
  value: string;
  /** The tint was picked here (true) or is the application's accent (false). */
  followed: boolean;
  /** The clinic's palette, offered after the six colours of the application. */
  palette: readonly string[];
  /** `null` = follow the application's colour. */
  onChange: (hex: string | null) => void;
}) {
  const own = followed ? null : normalizeHex(value);
  const [draft, setDraft] = useState(own ?? '');
  const guard = useMemo(() => guardTint(draft), [draft]);
  const typed = draft.trim() !== '';
  const shown = guard.ok && guard.hex !== null ? guard.hex : sanitizeAccent(value);
  const swatches = useMemo(() => {
    const seen = new Set<string>();
    return [...THEME_ACCENTS.map((a) => a.color), ...palette]
      .map((c) => normalizeHex(c))
      .filter((c): c is string => c !== null && sanitizeAccent(c) === c && !seen.has(c) && (seen.add(c), true));
  }, [palette]);
  const canApply = guard.ok && guard.hex !== null && guard.hex !== own;
  const onWhite = contrastRatio(shown, LIGHT_SURFACE);
  const inkOn = contrastRatio(onAccentText(shown), shown);

  return (
    <Stack spacing={2} data-testid="planner-tint-editor" sx={{ minWidth: 0 }}>
      <Typography sx={TYPE.caption}>{TINT_TEXT.help}</Typography>
      <Box role="group" aria-label={TINT_TEXT.palette} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {swatches.map((hex) => {
          const selected = own === hex;
          return (
            <Box
              key={hex}
              component="button"
              type="button"
              aria-label={`Barva plánovače ${hex}`}
              aria-pressed={selected}
              onClick={() => { setDraft(hex); onChange(hex); }}
              sx={{
                width: 44, height: 44, borderRadius: 2, bgcolor: hex, cursor: 'pointer', display: 'grid', placeItems: 'center',
                color: onAccentText(hex), border: '2px solid', borderColor: selected ? 'text.primary' : 'transparent',
                outlineOffset: 2, '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main' },
              }}
            >
              {selected ? <CheckIcon fontSize="small" /> : null}
            </Box>
          );
        })}
      </Box>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          size="small"
          label={TINT_TEXT.custom}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          error={typed && !guard.ok}
          helperText={typed && !guard.ok ? guard.problem : TINT_TEXT.customHelp}
          slotProps={{ htmlInput: { 'aria-label': TINT_TEXT.custom, maxLength: 9, spellCheck: false, 'data-testid': 'tint-hex-input' } }}
          sx={{ flex: 1, minWidth: 0 }}
        />
        <Box
          component="input"
          type="color"
          aria-label="Výběr barvy plánovače"
          value={shown.toLowerCase()}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value.toUpperCase())}
          sx={{ width: 44, height: 44, p: 0, border: '1px solid', borderColor: (t) => FIELD_EDGE[t.palette.mode], borderRadius: 1, bgcolor: 'transparent', cursor: 'pointer' }}
        />
      </Stack>

      <Box data-testid="tint-preview" role="group" aria-label={TINT_TEXT.preview} sx={{ display: 'grid', gap: 1, p: 1.5, borderRadius: 2, border: '1px solid', borderColor: settingsLine }}>
        <Typography sx={TYPE.label}>{TINT_TEXT.preview}</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <MiniPlanner tint={shown} mode="dark" label={TINT_TEXT.previewDark} />
          <MiniPlanner tint={shown} mode="light" label={TINT_TEXT.previewLight} />
        </Box>
        <Typography data-testid="tint-contrast" sx={TYPE.caption}>
          {`Text na tlačítku: ${fmt(inkOn)} : 1 (${inkOn >= AA ? 'splňuje AA' : 'pod AA'}) · na bílé ${fmt(onWhite)} : 1`}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button variant="contained" disabled={!canApply} onClick={() => { if (guard.hex !== null) onChange(guard.hex); }} sx={{ minHeight: 44, fontWeight: 700 }} data-testid="tint-apply">
          {TINT_TEXT.apply}
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          disabled={followed}
          title={TINT_TEXT.followHint}
          onClick={() => { setDraft(''); onChange(null); }}
          sx={{ minHeight: 44, fontWeight: 600 }}
          data-testid="tint-follow"
        >
          {TINT_TEXT.follow}
        </Button>
      </Stack>
      <Typography sx={TYPE.caption} data-testid="tint-state">{followed ? TINT_TEXT.followsNow : TINT_TEXT.ownNow}</Typography>
    </Stack>
  );
}

export { DEFAULT_ACCENT_HEX };
export default PlannerTintEditor;
