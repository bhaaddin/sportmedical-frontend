/*
 * The query keys the peek and the palette share with the screens that already read the same list (so a peek is often free).
 * Kept apart from `peek.ts` so a screen can name a key without loading the peek's api modules: the peek is fetched only when
 * somebody rests on a chip.
 */
export const PEEK_KEYS = {
  invoices: ['billing', 'invoices'] as const,
  activities: ['activities', 'list'] as const,
  services: ['shelf', 'clinic-services'] as const,
};
