/* Pure part of scripts/check-prices.mjs: flatten the public price list and compare it with the website's prices. */

/** `Základní  Diagnostika`, `zakladni diagnostika`, `VO₂max` -> comparable text. */
export const fold = (name) =>
  String(name).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** `GET /api/public/price-list` -> [{ name, priceCzk }] (any depth of category > items). */
export function flattenPriceList(body) {
  const out = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      if (typeof node.name === 'string' && 'priceCzk' in node) out.push({ name: node.name, priceCzk: typeof node.priceCzk === 'number' ? node.priceCzk : null });
      for (const key of ['items', 'services', 'data', 'value', 'categories']) if (node[key]) walk(node[key]);
    }
  };
  walk(body);
  return out;
}

/** { ok, mismatches[], missing[], extra[] } - `extra` are items of our list the website does not have (informational). */
export function comparePrices(list, fixture) {
  const byName = new Map(list.map((i) => [fold(i.name), i]));
  const mismatches = [];
  const missing = [];
  /* `ours` is one name or a list of names the same item has in different environments (live and dev differ). */
  const namesOf = (want) => (Array.isArray(want.ours) ? want.ours : [want.ours]);
  for (const want of fixture.items) {
    const have = namesOf(want).map((n) => byName.get(fold(n))).find((i) => i !== undefined);
    if (!have) missing.push(want.website);
    else if (have.priceCzk !== want.priceCzk) mismatches.push({ item: want.website, ours: have.priceCzk, website: want.priceCzk });
  }
  const known = new Set(fixture.items.flatMap((i) => namesOf(i).map(fold)));
  const extra = list.filter((i) => !known.has(fold(i.name))).map((i) => i.name);
  return { ok: mismatches.length === 0 && missing.length === 0, mismatches, missing, extra };
}
