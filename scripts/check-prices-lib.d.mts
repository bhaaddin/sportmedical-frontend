export const fold: (name: string) => string;
export function flattenPriceList(body: unknown): { name: string; priceCzk: number | null }[];
export function comparePrices(
  list: { name: string; priceCzk: number | null }[],
  fixture: { items: { website: string; ours: string; priceCzk: number }[] },
): { ok: boolean; mismatches: { item: string; ours: number | null; website: number }[]; missing: string[]; extra: string[] };
