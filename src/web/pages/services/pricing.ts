/* Picking price-list rows for the service pages. Rows are chosen by the NAME of the category or
   of the item (folded: no diacritics, lower case) — never by an amount. An item that is not in the
   list is `null`, and the page shows "—". */

import { foldName } from '../../../api/priceList';
import type { PriceCategory, PriceItem } from '../../../api/priceList';
import { ROW_SPECS } from '../../landing/rows';

/** The category that belongs to a service, by its name. Empty when the list does not have it. */
export function categoryItems(categories: PriceCategory[], category: RegExp): PriceItem[] {
  return categories.find((group) => category.test(foldName(group.category)))?.items ?? [];
}

/** The category's own name as the API spells it, or null. */
export function categoryName(categories: PriceCategory[], category: RegExp): string | null {
  return categories.find((group) => category.test(foldName(group.category)))?.category ?? null;
}

/**
 * One item by its name. Names that join two services with "+" ("Komplexní prohlídka + Základní
 * diagnostika") are packages of their own and never match a single-service pattern.
 */
export function findItem(categories: PriceCategory[], pattern: RegExp): PriceItem | null {
  for (const group of categories) {
    for (const item of group.items) {
      const folded = foldName(item.name);
      if (!folded.includes('+') && pattern.test(folded)) return item;
    }
  }
  return null;
}

export const CATEGORY = {
  prohlidky: ROW_SPECS.prohlidky.category,
  diagnostika: ROW_SPECS.diagnostika.category,
  inbody: ROW_SPECS.inbody.category,
  /** "Zvýhodněné balíčky – prohlídka + diagnostika". */
  balicky: /^zvyhodnene balicky|^balicky/,
} as const;

export const ITEM = {
  zakladni: /^zakladni sportovni prohlidka/,
  komplexni: /^komplexni sportovni prohlidka/,
  spiro: /^spiroergometricke vysetreni/,
  vo2max: /^vo2max/,
  kompenzacniPlan: /kompenza\w* plan/,
  zakladniDiagnostika: /^zakladni diagnostika/,
  komplexniDiagnostika: /^komplexni diagnostika/,
  inbodyZakladni: /^zakladni inbody/,
  inbodyKomplexni: /^inbody komplexni/,
  inbodyVyziva: /vyzivov\w* plan/,
  inbodyBalicek: /balicek 5 mereni/,
} as const;

/** "Sportovní diagnostika" → "sportovni-diagnostika": the anchor of a price-list category. */
export function categorySlug(category: string): string {
  return foldName(category).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** The categories of the price list as the page shows them while the API has said nothing. */
export const FALLBACK_CATEGORIES: { category: string; names: readonly string[] }[] = [
  { category: 'Sportovní lékařské prohlídky', names: ['Základní sportovní prohlídka', 'Komplexní sportovní prohlídka', 'Spiroergometrické vyšetření'] },
  { category: 'Sportovní diagnostika', names: ['Základní diagnostika', 'Komplexní diagnostika', 'VO₂max analýza'] },
  { category: 'InBody 770 – tělesná analýza', names: ['Základní InBody měření', 'InBody komplexní měření + odborná konzultace', 'Balíček 5 měření InBody'] },
];

/**
 * A combined package by the two services it joins ("Komplexní prohlídka + Základní diagnostika"),
 * whichever order the admin wrote them in. Both halves are matched against the folded part of the
 * name on either side of a "+".
 */
export function findCombo(categories: PriceCategory[], first: RegExp, second: RegExp): PriceItem | null {
  for (const group of categories) {
    for (const item of group.items) {
      const parts = foldName(item.name).split('+').map((part) => part.trim());
      if (parts.length < 2) continue;
      const a = parts.findIndex((part) => first.test(part));
      if (a < 0) continue;
      if (parts.some((part, index) => index !== a && second.test(part))) return item;
    }
  }
  return null;
}

/** How a card finds its row: one service by name, or a package by the two services it joins. */
/** `single`: one service (a "+" name is never taken for it); `any`: one item by name, "+" names included; `combo`: a package of two services. */
export type PriceMatch = { single: RegExp } | { any: RegExp } | { combo: readonly [RegExp, RegExp] };

export function matchItem(categories: PriceCategory[], match: PriceMatch): PriceItem | null {
  if ('single' in match) return findItem(categories, match.single);
  if ('any' in match) return findAny(categories, match.any);
  return findCombo(categories, match.combo[0], match.combo[1]);
}

export { PART } from './content/cards';


/** One item by name, "+" names included ("InBody komplexní měření + odborná konzultace"). */
export function findAny(categories: PriceCategory[], pattern: RegExp): PriceItem | null {
  for (const group of categories) {
    for (const item of group.items) {
      if (pattern.test(foldName(item.name))) return item;
    }
  }
  return null;
}
