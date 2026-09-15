/*
 * Which telephone prefixes come first.
 *
 * "u vybere predvolby vzdy ponukaj .. cz a sk a dominantu ako prve ... tie su
 * najcastejsie". A Czech clinic books Czech and Slovak patients all day, and
 * an alphabetical list of two hundred countries makes the receptionist scroll
 * past every one of them to reach the two she needs.
 *
 * What these guard is that it LIFTS rather than sorts: the rest of the list
 * keeps the order the server sent, because that order is the server's decision
 * and not this module's to improve.
 */
import { describe, it, expect } from 'vitest';
import {
  PREFERRED_REGION_CODES, preferredCount, withPreferredFirst,
} from './phoneRegions';
import type { RegionOptionLike } from './phoneRegions';

const region = (code: string, displayValue = code): RegionOptionLike => ({ code, displayValue });

describe('the two that come first', () => {
  it('puts Czech before Slovak, and both above the rest', () => {
    const rows = [region('AT'), region('DE'), region('SK'), region('PL'), region('CZ')];
    expect(withPreferredFirst(rows).map((r) => r.code))
      .toEqual(['CZ', 'SK', 'AT', 'DE', 'PL']);
  });

  /*
   * Lifted, not sorted. The rest arrives in the server's order and leaves in
   * it — reordering them would be this module deciding something nobody asked
   * it to decide.
   */
  it('leaves everything else exactly as it came', () => {
    const rows = [region('PL'), region('AT'), region('CZ'), region('DE')];
    expect(withPreferredFirst(rows).map((r) => r.code))
      .toEqual(['CZ', 'PL', 'AT', 'DE']);
  });

  it('takes whichever of the two is there', () => {
    expect(withPreferredFirst([region('DE'), region('SK')]).map((r) => r.code))
      .toEqual(['SK', 'DE']);
    expect(withPreferredFirst([region('DE'), region('CZ')]).map((r) => r.code))
      .toEqual(['CZ', 'DE']);
  });

  it('changes nothing when neither is offered', () => {
    const rows = [region('DE'), region('AT')];
    expect(withPreferredFirst(rows).map((r) => r.code)).toEqual(['DE', 'AT']);
  });

  it('loses nothing and duplicates nothing', () => {
    const rows = [region('AT'), region('SK'), region('CZ'), region('DE'), region('PL')];
    const out = withPreferredFirst(rows);
    expect(out).toHaveLength(rows.length);
    expect(new Set(out.map((r) => r.code)).size).toBe(rows.length);
  });

  it('copes with an empty list', () => {
    expect(withPreferredFirst([])).toEqual([]);
  });

  /*
   * Matched on the code, never on the label: `displayValue` is the server's
   * text and may read "Česko (+420)" today and something else tomorrow.
   */
  it('finds them by code whatever they are called', () => {
    const rows = [region('DE', 'Německo (+49)'), region('CZ', 'Cokoliv jiného')];
    expect(withPreferredFirst(rows)[0].code).toBe('CZ');
  });
});

describe('where the divider goes', () => {
  it('counts the preferred ones that are actually there', () => {
    expect(preferredCount([region('CZ'), region('SK'), region('DE')])).toBe(2);
    expect(preferredCount([region('CZ'), region('DE')])).toBe(1);
  });

  /* A separator above the first row is a line with nothing above it. */
  it('counts none when neither is offered', () => {
    expect(preferredCount([region('DE'), region('AT')])).toBe(0);
    expect(preferredCount([])).toBe(0);
  });

  it('names the two it prefers, in order', () => {
    expect([...PREFERRED_REGION_CODES]).toEqual(['CZ', 'SK']);
  });
});
