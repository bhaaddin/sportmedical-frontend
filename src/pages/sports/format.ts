/*
 * Czech typography for the numbers these screens print: a figure and its unit
 * never part at a line break (brief, rule 9), so the unit follows a
 * non-breaking space.
 */
const NBSP = ' ';

/** "2 200 Kč" with the space before the unit unbreakable. */
export const kc = (amount: number): string =>
  `${(Number.isFinite(amount) ? amount : 0).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}${NBSP}Kč`;

/** "45 min". */
export const min = (value: number): string => `${value}${NBSP}min`;

/** "62 %". */
export const pct = (value: number): string => `${value}${NBSP}%`;

/** "26. 10. 2026" - the same date the rest of the app prints. */
export const dateCz = (iso: string): string => new Date(iso).toLocaleDateString('cs-CZ');
