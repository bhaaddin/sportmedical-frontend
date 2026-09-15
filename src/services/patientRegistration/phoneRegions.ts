/*
 * Which telephone prefixes come first.
 *
 * The owner asked for it plainly: "u vybere predvolby vzdy ponukaj .. cz a sk
 * a dominantu ako prve ... tie su najcastejsie". A Czech sports clinic books
 * Czech and Slovak patients all day and somebody else once a month, so an
 * alphabetical list makes the receptionist scroll past two hundred countries
 * to reach the two she needs — every single time.
 *
 * The rest keep the server's own order. This does not sort them, invent an
 * order, or hide anything: it lifts two to the top and leaves the list
 * otherwise exactly as it arrived.
 */

export interface RegionOptionLike {
  code: string;
  displayValue: string;
}

/**
 * In this order. Czech first because the clinic is Czech; Slovak second
 * because it is the next most common by a long way.
 */
export const PREFERRED_REGION_CODES = ['CZ', 'SK'] as const;

/**
 * The preferred ones first, everything else untouched behind them.
 *
 * Matched on the code, not the label: `displayValue` is the server's text and
 * may be "Česko (+420)" today and something else tomorrow, while `CZ` is what
 * the contract carries.
 */
export function withPreferredFirst(
  regions: readonly RegionOptionLike[],
): RegionOptionLike[] {
  const preferred: RegionOptionLike[] = [];

  for (const code of PREFERRED_REGION_CODES) {
    const found = regions.find((region) => region.code === code);
    if (found !== undefined) preferred.push(found);
  }

  const rest = regions.filter(
    (region) => !preferred.some((p) => p.code === region.code),
  );

  return [...preferred, ...rest];
}

/**
 * Where the divider goes — after the preferred ones that are actually there.
 *
 * Zero when the server offers neither, which is the case this must not draw a
 * line for: a separator above the first row is a line with nothing above it.
 */
export function preferredCount(regions: readonly RegionOptionLike[]): number {
  return PREFERRED_REGION_CODES.filter(
    (code) => regions.some((region) => region.code === code),
  ).length;
}
