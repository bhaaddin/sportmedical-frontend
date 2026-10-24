/*
 * The colour a činnost has when nobody chose one (Nastavení -> Barvy).
 *
 * Before (R12): the server drew a činnost in a SHADE of its služba's hue, so the three prohlídky were three greens, the
 * diagnostika ones three blues, and on the dark board some of them were nearly invisible (#09423B) - "they do not light up".
 *
 * Now every činnost without its own colour gets a clearly DISTINCT hue:
 *   - the hue comes from the činnost's position in the list of ALL činnosti ordered by id (ids are time-ordered, so a new
 *     činnost is appended and no existing colour ever moves; the order does not depend on the session, the služba or
 *     the person looking), spread over the hue circle by a base-2 van der Corput sequence: 0, 180, 90, 270, 45, ... so any
 *     run of consecutive činnosti - the three of one služba - is as far apart on the circle as it can be, and the first 8
 *     are at least 45 degrees apart;
 *   - lightness is solved per hue to ONE relative luminance (`TARGET_LUMINANCE`), chosen so the colour stands out by >= 3:1
 *     both on the dark stage (#001421) and on the white page, and white text on it reads >= 4.5:1 - the same swatch is
 *     AA-safe in both modes.
 * Until the list is known (a test, a screen that renders before /api/activities answered) the hue comes from a hash of the
 * id alone, so the colour is still the same one every time.
 */
import { hslToRgb, relativeLuminance, toHex } from '../accent';

/** Relative luminance every default colour is solved to. */
export const TARGET_LUMINANCE = 0.17;
const SATURATION = 78;

/** Base-2 van der Corput radical inverse of n, in [0, 1). */
export function vanDerCorput(n: number): number {
  let value = 0;
  let denominator = 1;
  for (let i = n; i > 0; i = Math.floor(i / 2)) {
    denominator *= 2;
    value += (i % 2) / denominator;
  }
  return value;
}

/** A stable hue (0..359) from an id alone. */
export function hashHue(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 360;
}

const hueCache = new Map<number, string>();

/** The `#RRGGBB` of a hue at the target luminance (bisection on lightness; luminance rises monotonically with it). Memoised: the board asks per card. */
export function colorForHue(hue: number): string {
  const cached = hueCache.get(hue);
  if (cached !== undefined) return cached;
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const lum = relativeLuminance({ ...hslToRgb({ h: hue, s: SATURATION, l: mid }), a: 1 });
    if (lum < TARGET_LUMINANCE) lo = mid;
    else hi = mid;
  }
  const hex = toHex(hslToRgb({ h: hue, s: SATURATION, l: (lo + hi) / 2 }));
  hueCache.set(hue, hex);
  return hex;
}

/** The hues of n consecutive činnosti, as the sequence gives them. */
export const huesOfFirst = (n: number): number[] => Array.from({ length: n }, (_, i) => Math.round(vanDerCorput(i) * 360) % 360);

let order: ReadonlyMap<string, number> = new Map();

/** Tells the palette which činnosti exist (every read of /api/activities calls this). Idempotent; the known set only ever grows. */
export function registerActivityIds(ids: readonly string[]): void {
  const sorted = [...new Set(ids.filter((id) => id !== ''))].sort();
  const same = sorted.length === order.size && sorted.every((id, i) => order.get(id) === i);
  if (same) return;
  /* a list that only ever grows by appending keeps every earlier index; never shrink the known set on a partial read */
  const merged = new Set([...order.keys(), ...sorted]);
  const next = [...merged].sort();
  if (next.length === order.size && next.every((id, i) => order.get(id) === i)) return;
  order = new Map(next.map((id, i) => [id, i]));
}

/** For tests: forget the known činnosti. */
export function resetActivityIds(): void {
  order = new Map();
}

/** The default colour of one činnost. */
export function defaultActivityColor(id: string): string {
  const index = order.get(id);
  return colorForHue(index === undefined ? hashHue(id) : Math.round(vanDerCorput(index) * 360) % 360);
}
