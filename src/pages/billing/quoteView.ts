/*
 * How the discount breakdown of a quote (and of an issued invoice) reads - no
 * React, so each rule can be broken in a test.
 *
 * The rule itself (decision 3) is the server's: the tier discount (by
 * headcount) and the club's own discount do not add, the higher one applies;
 * a package discount belongs to the lines of its package; a manual discount is
 * added on top. This screen only has to tell the desk which row counted, so a
 * lower tier or club row is drawn struck through with "nepoužito — vyšší sleva".
 */
import type { DiscountKind, InvoiceDiscount } from '../../api/billing';

/** What a kind of discount is called next to its label. */
export const DISCOUNT_KIND_LABEL: Record<DiscountKind, string> = {
  tier: 'Cenová hladina',
  club: 'Sleva klubu',
  package: 'Balíček',
  manual: 'Ruční sleva',
};

const KIND_ORDER: DiscountKind[] = ['tier', 'club', 'package', 'manual'];

export const UNUSED_NOTE = 'nepoužito — vyšší sleva';

export interface DiscountRowView {
  discount: InvoiceDiscount;
  /** A tier or club row that lost to the higher of the two. */
  unused: boolean;
}

/**
 * The rows in the order the panel draws them, each marked used or not.
 *
 * A tier or club row is "unused" when the server says nothing was taken off by
 * it (percent shown, amount 0) or when both are present and the other one is
 * higher. A server that only sends the winner gives no row to strike through.
 */
export function discountRows(discounts: readonly InvoiceDiscount[] | null | undefined): DiscountRowView[] {
  const rows = [...(discounts ?? [])].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
  const tier = rows.find((r) => r.kind === 'tier');
  const club = rows.find((r) => r.kind === 'club');
  const bothPresent = tier !== undefined && club !== undefined;

  return rows.map((discount) => {
    const isGroupKind = discount.kind === 'tier' || discount.kind === 'club';
    if (!isGroupKind) return { discount, unused: false };
    const zeroed = discount.percent > 0 && discount.amountCzk === 0;
    const other = discount.kind === 'tier' ? club : tier;
    const loses = bothPresent && other !== undefined && discount.percent < other.percent;
    return { discount, unused: zeroed || loses };
  });
}

/** True when anything was actually taken off. */
export function hasAppliedDiscount(discounts: readonly InvoiceDiscount[] | null | undefined): boolean {
  return discountRows(discounts).some((r) => !r.unused && r.discount.amountCzk > 0);
}
