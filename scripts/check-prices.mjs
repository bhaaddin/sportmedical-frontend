/*
 * Compares the public price list of a running API with the website's prices (tests/fixtures/website-prices.json).
 * Needs nothing but Node: node scripts/check-prices.mjs <base url>   e.g. http://localhost:5092 or https://sportmedical-api.onrender.com
 * Exit code 0 = every website price is the same in our list; 1 = a difference or a missing item; 2 = the list could not be read.
 */
import { readFileSync } from 'node:fs';
import { comparePrices, flattenPriceList } from './check-prices-lib.mjs';

const base = (process.argv[2] ?? process.env.PRICES_BASE_URL ?? '').replace(/\/+$/, '');
if (base === '') {
  console.error('Usage: node scripts/check-prices.mjs <base url>');
  process.exit(2);
}
const fixture = JSON.parse(readFileSync(new URL('../tests/fixtures/website-prices.json', import.meta.url), 'utf8'));
const controller = new AbortController();
let body;
const timer = setTimeout(() => controller.abort(), 90_000);
try {
  const res = await fetch(`${base}/api/public/price-list`, { signal: controller.signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  body = await res.json();
} catch (e) {
  clearTimeout(timer);
  console.error(`Cannot read ${base}/api/public/price-list: ${e.message}`);
  process.exit(2);
}
clearTimeout(timer);
const list = flattenPriceList(body);
const result = comparePrices(list, fixture);
console.log(`${list.length} items in our list, ${fixture.items.length} on the website (${fixture.checkedOn}).`);
for (const m of result.mismatches) console.log(`DIFFERENT  ${m.item}: ours ${m.ours} Kč, website ${m.website} Kč`);
for (const name of result.missing) console.log(`MISSING    ${name}`);
if (result.extra.length) console.log(`Not on the website (ignored): ${result.extra.join('; ')}`);
console.log(result.ok ? 'OK - every website price is the same in our list.' : 'FAIL');
process.exitCode = result.ok ? 0 : 1;
