const NBSP = String.fromCharCode(0xa0);

/** "2 200 Kč" with non-breaking spaces. */
export const kc = (amount: number): string =>
  `${(Number.isFinite(amount) ? amount : 0)
    .toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    .replace(/\s/g, NBSP)}${NBSP}Kč`;

/** Czech weekday names, 0 = Sunday as the API sends it. */
export const DAY_NAMES = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'] as const;
/** Monday first, for display. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
