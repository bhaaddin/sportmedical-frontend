import { GRID_TEXT } from './gridText';

/*
 * The club on a booking, said the board's way: "Klub · FK Slaný · −10 %".
 * The server names the partner and the discount it applied (`partnerName`,
 * `clubDiscountPercent` on the day row, `discountPercent` on the club); this
 * only joins the words. No discount on the wire, no percent on screen - a
 * "−0 %" would claim a rule nobody set.
 */

/** `−10 %`, or null when the server sent no discount. */
export function discountLabel(percent: number | null | undefined): string | null {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return null;
  return `−${percent} %`;
}

/** `Klub · FK Slaný · −10 %`; null for a booking with no partner behind it. */
export function clubLine(
  partnerName: string | null | undefined,
  discountPercent: number | null | undefined,
): string | null {
  const name = partnerName?.trim();
  if (!name) return null;
  return [GRID_TEXT.clubLine, name, discountLabel(discountPercent)]
    .filter((part): part is string => part !== null)
    .join(' · ');
}
