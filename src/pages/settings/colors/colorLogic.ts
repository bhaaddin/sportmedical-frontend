/*
 * Colours of the services, away from the screen: how a typed colour is read,
 * what makes a palette wrong, and which colour a činnost is drawn in.
 */
import { HEX_COLOR, MIN_PALETTE_SIZE } from '../../../api/serviceColors';

/** "0d5c52", "#0d5c52" -> "#0D5C52"; anything that is not six hex digits comes back unchanged (trimmed). */
export function normalizeHex(text: string): string {
  const t = text.trim();
  const withHash = t.startsWith('#') ? t : `#${t}`;
  return HEX_COLOR.test(withHash) ? withHash.toUpperCase() : t;
}

export const isHex = (text: string): boolean => HEX_COLOR.test(text.trim());

export interface PaletteRow { key: string; hex: string }

let seq = 0;
export const nextColorKey = (): string => `c${(seq += 1)}`;

export const toRows = (palette: readonly string[]): PaletteRow[] => palette.map((hex) => ({ key: nextColorKey(), hex: normalizeHex(hex) }));

/** What would change by saving: the colours, normalised, in order. */
export const paletteSignature = (rows: readonly PaletteRow[]): string => JSON.stringify(rows.map((r) => normalizeHex(r.hex)));

export interface PaletteErrors { rows: Record<string, string>; general: string | null }

export function validatePalette(rows: readonly PaletteRow[]): PaletteErrors {
  const errors: PaletteErrors = { rows: {}, general: null };
  const seen = new Set<string>();
  for (const row of rows) {
    const hex = normalizeHex(row.hex);
    if (!isHex(hex)) errors.rows[row.key] = 'Zadejte barvu jako #RRGGBB, např. #0D5C52.';
    else if (seen.has(hex)) errors.rows[row.key] = 'Tuto barvu paleta už má.';
    else seen.add(hex);
  }
  if (rows.length < MIN_PALETTE_SIZE) errors.general = `Paleta musí mít aspoň ${MIN_PALETTE_SIZE} barev, aby se nové služby nezačaly opakovat hned.`;
  return errors;
}

export const hasPaletteErrors = (e: PaletteErrors): boolean => e.general !== null || Object.keys(e.rows).length > 0;

/** The colour a činnost is drawn in: the server's computed one, else its own, else its služba's. */
export function drawnColor(
  activity: { effectiveColorHex?: string | null; colorHex?: string | null },
  serviceColor: string | null,
  fallback: string,
): string {
  return activity.effectiveColorHex ?? activity.colorHex ?? serviceColor ?? fallback;
}
