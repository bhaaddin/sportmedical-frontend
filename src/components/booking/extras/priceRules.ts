/*
 * R15c (a): the one price rule the booking dialog itself needs, apart from the preset maths (`discountPresets.ts`, loaded lazily with the
 * chips) so the dialog's first load does not carry the presets.
 */

/** A price of 0 Kč is a gift: it books only with a reason (whether it came from the preset or was typed). */
export const freeNeedsReason = (agreedPriceCzk: number | null, reason: string): boolean => agreedPriceCzk === 0 && reason.trim() === '';
