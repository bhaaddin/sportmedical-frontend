/**
 * Fixed colour palette for calendars and activities.
 *
 * Contract 5.2 rules out a free colour wheel — two near-identical colours make
 * a calendar unreadable — and 7.1 requires at least 4.5:1 contrast for the text
 * sitting on a coloured chip. Every entry below is checked, not guessed:
 * `assertPaletteContrast` recomputes the ratios from the hex values.
 */

export interface PaletteEntry {
  /** Stable key stored on the server, so a palette re-order never repaints data. */
  id: string;
  /** Chip / column background. */
  hex: string;
  /** Text colour that reaches 4.5:1 on `hex`. */
  onHex: string;
  /** i18n key for the colour name, so the picker is usable without sight of it. */
  labelKey: string;
}

export const CALENDAR_PALETTE: readonly PaletteEntry[] = [
  { id: 'blue', hex: '#1565C0', onHex: '#FFFFFF', labelKey: 'booking.colors.blue' },
  { id: 'indigo', hex: '#283593', onHex: '#FFFFFF', labelKey: 'booking.colors.indigo' },
  { id: 'teal', hex: '#00695C', onHex: '#FFFFFF', labelKey: 'booking.colors.teal' },
  { id: 'green', hex: '#2E7D32', onHex: '#FFFFFF', labelKey: 'booking.colors.green' },
  { id: 'olive', hex: '#5D6B00', onHex: '#FFFFFF', labelKey: 'booking.colors.olive' },
  { id: 'amber', hex: '#FFC107', onHex: '#000000', labelKey: 'booking.colors.amber' },
  { id: 'orange', hex: '#BF360C', onHex: '#FFFFFF', labelKey: 'booking.colors.orange' },
  { id: 'red', hex: '#C62828', onHex: '#FFFFFF', labelKey: 'booking.colors.red' },
  { id: 'pink', hex: '#AD1457', onHex: '#FFFFFF', labelKey: 'booking.colors.pink' },
  { id: 'purple', hex: '#6A1B9A', onHex: '#FFFFFF', labelKey: 'booking.colors.purple' },
  { id: 'brown', hex: '#4E342E', onHex: '#FFFFFF', labelKey: 'booking.colors.brown' },
  { id: 'slate', hex: '#37474F', onHex: '#FFFFFF', labelKey: 'booking.colors.slate' },
];

export const DEFAULT_PALETTE_ENTRY = CALENDAR_PALETTE[0];

/** Looks a stored colour up, tolerating a value the palette no longer contains. */
export function paletteEntryFor(hex: string | undefined): PaletteEntry {
  const normalised = (hex ?? '').toUpperCase();
  return (
    CALENDAR_PALETTE.find((entry) => entry.hex.toUpperCase() === normalised) ??
    DEFAULT_PALETTE_ENTRY
  );
}

/** Text colour guaranteed to be readable on a stored colour. */
export function readableTextOn(hex: string | undefined): string {
  return paletteEntryFor(hex).onHex;
}

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (
    0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
  );
}

/** WCAG 2.1 contrast ratio between two hex colours, 1 to 21. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export const MIN_CONTRAST = 4.5;

/** Returns the palette entries that fail 7.1. Empty means the palette is sound. */
export function paletteContrastFailures(): { id: string; ratio: number }[] {
  return CALENDAR_PALETTE.map((entry) => ({
    id: entry.id,
    ratio: contrastRatio(entry.onHex, entry.hex),
  })).filter((result) => result.ratio < MIN_CONTRAST);
}
