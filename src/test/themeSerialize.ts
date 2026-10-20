import type { Theme } from '@mui/material/styles';

/*
 * A stable, comparable picture of a built theme: the palette, the typography and every component override, with
 * the override functions (Paper's `root: ({ ownerState }) => ...`) called for a fixed set of owner states.
 * The default-look tests compare it with a committed picture of the theme as it was before accents reached
 * dark mode, so "the default renders exactly as before" is a diff, not an opinion.
 */
const OWNER_STATES = [
  { elevation: 0 },
  { elevation: 1 },
  { elevation: 8 },
  { elevation: 16 },
  { variant: 'outlined' },
  { variant: 'elevation', elevation: 2 },
];

function plain(value: unknown, depth = 0): unknown {
  if (depth > 12) return '[deep]';
  if (typeof value === 'function') {
    const calls: Record<string, unknown> = {};
    OWNER_STATES.forEach((ownerState, i) => {
      try {
        calls[String(i)] = plain((value as (arg: unknown) => unknown)({ ownerState, theme: {} }), depth + 1);
      } catch {
        calls[String(i)] = '[throws]';
      }
    });
    return { __fn: calls };
  }
  if (Array.isArray(value)) return value.map((v) => plain(v, depth + 1));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) out[key] = plain((value as Record<string, unknown>)[key], depth + 1);
    return out;
  }
  return value;
}

export function themePicture(theme: Theme): unknown {
  return plain({
    palette: theme.palette,
    typography: Object.fromEntries(Object.entries(theme.typography).filter(([, v]) => typeof v !== 'function')),
    shape: theme.shape,
    components: theme.components,
  });
}
