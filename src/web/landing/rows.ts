/* ══════════════════════════════════════════════════════════════
   WHICH PRICE-LIST ROWS THE LANDING SHOWS UNDER EACH SERVICE

   Rows are chosen by the NAME of the price-list category (the service) in the
   API's answer, in the order the admin keeps them — never by an amount. The
   fallback names are shown, with "—" instead of a price, only while the API has
   not answered (a build made while the server slept, an offline visitor).
   ══════════════════════════════════════════════════════════════ */

import type { RowSpec } from '../../api/priceList';

/** Compared after folding (no diacritics, lower case) — see foldName. */
export const ROW_SPECS = {
  prohlidky: {
    category: /^sportovni lekarske prohlidky|^prohlidky/,
    items: [/^zakladni sportovni prohlidka/, /^komplexni sportovni prohlidka/, /^spiroergometri/],
    limit: 4,
  },
  diagnostika: {
    category: /^sportovni diagnostika|^diagnostika/,
    items: [/^zakladni diagnostika/, /^komplexni diagnostika$/, /^vo2max/],
    limit: 4,
  },
  inbody: {
    category: /^inbody/,
    items: [/^zakladni inbody/, /^inbody komplexni/, /inbody.*balicek|balicek.*inbody/],
    limit: 4,
  },
} satisfies Record<string, RowSpec>;

export const FALLBACK_ROWS = {
  prohlidky: ['Základní sportovní prohlídka', 'Komplexní sportovní prohlídka', 'Spiroergometrické vyšetření'],
  diagnostika: ['Základní diagnostika', 'Komplexní diagnostika', 'VO₂max analýza'],
  inbody: ['Základní InBody měření', 'InBody komplexní měření + odborná konzultace', 'Balíček 5 měření InBody'],
} as const;
