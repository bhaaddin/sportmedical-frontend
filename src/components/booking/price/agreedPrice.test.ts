import { describe, expect, it } from 'vitest';
import { amountText, parseCzk, priceLine, priceView, priceWord } from './agreedPrice';

/* Prices are grouped with a no-break space; the tests read them as plain words. */
const plain = (s: string) => s.replace(/ /g, ' ');

describe('parseCzk', () => {
  it('reads whole crowns, two decimals, a comma, and spaces inside', () => {
    expect(parseCzk('1600')).toBe(1600);
    expect(parseCzk('1 600')).toBe(1600);
    expect(parseCzk('1200.50')).toBe(1200.5);
    expect(parseCzk('1200,5')).toBe(1200.5);
    expect(parseCzk('0')).toBe(0);
  });

  it('refuses a negative, three decimals, text and an empty box', () => {
    expect(parseCzk('-5')).toBeNull();
    expect(parseCzk('1.234')).toBeNull();
    expect(parseCzk('tisíc')).toBeNull();
    expect(parseCzk('')).toBeNull();
    expect(parseCzk('10%')).toBeNull();
  });
});

describe('amountText and priceWord', () => {
  it('writes the list price into the box without grouping, and names a missing price', () => {
    expect(amountText(1600)).toBe('1600');
    expect(amountText(1200.5)).toBe('1200.5');
    expect(amountText(null)).toBe('');
    expect(plain(priceWord(1600))).toBe('1 600 Kč');
    expect(priceWord(null)).toBe('bez ceny');
  });
});

describe('priceView', () => {
  it('untouched: the list price stands and nothing is sent', () => {
    const v = priceView({ listPriceCzk: 1600, typed: null });
    expect(v).toMatchObject({ effectiveCzk: 1600, agreedPriceCzk: null, adjusted: false, invalid: false, caption: 'podle ceníku' });
  });

  it('typed the same figure: sent as a number, still "podle ceníku"', () => {
    const v = priceView({ listPriceCzk: 1600, typed: '1600' });
    expect(v).toMatchObject({ effectiveCzk: 1600, agreedPriceCzk: 1600, adjusted: false, caption: 'podle ceníku' });
  });

  it('typed another figure: adjusted, and the caption names the list price', () => {
    const v = priceView({ listPriceCzk: 1600, typed: '1200' });
    expect(v.agreedPriceCzk).toBe(1200);
    expect(v.adjusted).toBe(true);
    expect(plain(v.caption)).toBe('upraveno (ceník 1 600 Kč)');
  });

  it('typed nonsense: invalid, nothing to send, nothing to total', () => {
    const v = priceView({ listPriceCzk: 1600, typed: 'abc' });
    expect(v).toMatchObject({ effectiveCzk: null, agreedPriceCzk: null, invalid: true });
  });

  it('no list price: says so, and any typed amount counts as adjusted', () => {
    expect(priceView({ listPriceCzk: null, typed: null }).caption).toBe('ceník cenu neuvádí');
    const v = priceView({ listPriceCzk: null, typed: '900' });
    expect(v.adjusted).toBe(true);
    expect(v.caption).toBe('upraveno (ceník bez ceny)');
  });
});

describe('priceLine', () => {
  it('reads the two ways the detail says it', () => {
    expect(plain(priceLine(null, 1600))).toBe('1 600 Kč (ceník)');
    expect(plain(priceLine(1600, 1600))).toBe('1 600 Kč (ceník)');
    expect(plain(priceLine(1200, 1600))).toBe('1 200 Kč (upraveno, ceník 1 600 Kč)');
    expect(priceLine(null, null)).toBe('bez ceny');
    expect(plain(priceLine(900, null))).toBe('900 Kč (upraveno, ceník bez ceny)');
  });
});
