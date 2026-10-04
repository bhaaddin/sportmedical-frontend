/*
 * Colour arithmetic for cards tinted with a činnost's colour.
 *
 * The owner picks colours as `#RRGGBB` (contract C1). A card needs an opaque
 * background (it may sit on a hatched closed day), a darker one for a patient
 * who has arrived, and readable ink; all three are derived from that one
 * colour by mixing it with the surface it lies on.
 */

function parse(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex.trim());
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");

/** `amount` of `color` over `base`, as an opaque `#RRGGBB`; `base` when `color` is not a hex. */
export function mixOver(color: string, base: string, amount: number): string {
  const c = parse(color);
  const b = parse(base);
  if (!c || !b) return base;
  return `#${toHex(b[0] + (c[0] - b[0]) * amount)}${toHex(b[1] + (c[1] - b[1]) * amount)}${toHex(b[2] + (c[2] - b[2]) * amount)}`;
}

export interface CardTones {
  /** The card's fill. */
  bg: string;
  /** The darker fill of a patient who is here or being seen. */
  bgActive: string;
  /** The 3 px left edge: the colour itself. */
  edge: string;
}

/** The three colours of an appointment card for one činnost colour on a surface. */
export function cardTones(colorHex: string, surface: string): CardTones {
  return {
    bg: mixOver(colorHex, surface, 0.13),
    bgActive: mixOver(colorHex, surface, 0.26),
    edge: colorHex,
  };
}
