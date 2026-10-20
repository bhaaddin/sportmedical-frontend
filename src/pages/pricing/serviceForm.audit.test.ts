/*
 * Settings audit (20. 10. 2026) - Ceník (/nastaveni/cenik): the rules the price
 * list holds in front of a server that checks nothing (dev API, /api/services):
 *   priceCzk -5, 1234.567, 99999999999 and an empty name or code all return 200;
 *   a duplicate code returns 200 too (two identical-looking rows);
 *   name over 200, code over 30 or description over 1000 characters -> 400
 *   "An error occurred while saving the entity changes…" (an EF text);
 *   an omitted listPriceCzk keeps the stored one, an explicit null clears it.
 */
import { describe, expect, it } from 'vitest';
import type { ServiceItem } from '../../api/services';
import { draftFrom, hasAtMostTwoDecimals, hasErrors, parseCzechNumber, toRequest, validateService, type ServiceDraft } from './serviceForm';

const item = (over: Partial<ServiceItem> = {}): ServiceItem => ({
  id: 'i1', code: 'KP', name: 'Komplexní prohlídka', description: 'Popis', durationMinutes: 30, priceCzk: 1500, listPriceCzk: null, isActive: true, ...over,
});
const draft = (over: Partial<ServiceDraft> = {}): ServiceDraft => ({ ...draftFrom(null), code: 'NEW', name: 'Nová položka', priceCzk: '1000', ...over });

describe('parseCzechNumber', () => {
  it.each([
    ['1 500', 1500],
    ['1 500', 1500],
    ['1500,50', 1500.5],
    ['1500.50', 1500.5],
    ['1.500', 1500],
    ['12.345', 12345],
    ['1.500.000', 1500000],
    ['1.500,50', 1500.5],
    ['0.5', 0.5],
    ['0,5', 0.5],
    ['.5', 0.5],
    ['2.5', 2.5],
    ['-15', -15],
    ['0', 0],
  ])('%s -> %s', (text, expected) => {
    expect(parseCzechNumber(text)).toBe(expected);
  });

  it.each(['', '   ', 'zdarma', '800 Kč', '1,2,3', '1..5', '--5', '1e3'])('"%s" is not a number', (text) => {
    expect(parseCzechNumber(text)).toBeNull();
  });
});

describe('hasAtMostTwoDecimals', () => {
  it.each([[1500, true], [1500.5, true], [1500.55, true], [0.1 + 0.2, true], [1234.567, false], [0.001, false]])('%s -> %s', (value, expected) => {
    expect(hasAtMostTwoDecimals(value)).toBe(expected);
  });
});

describe('validateService', () => {
  it('has nothing to say about a good draft, nor about opening a saved item and pressing save', () => {
    expect(validateService(draft(), [], null)).toEqual({});
    const existing = item();
    expect(hasErrors(validateService(draftFrom(existing), [existing], existing.id))).toBe(false);
  });

  it.each([
    ['code', draft({ code: '  ' }), 'Kód je povinný.'],
    ['code', draft({ code: 'KP' }), 'Tenhle kód už jedna položka má.'],
    ['code', draft({ code: 'kp' }), 'Tenhle kód už jedna položka má.'],
    ['code', draft({ code: 'K'.repeat(31) }), 'Kód může mít nejvýše 30 znaků.'],
    ['name', draft({ name: '' }), 'Název je povinný.'],
    ['name', draft({ name: 'N'.repeat(201) }), 'Název může mít nejvýše 200 znaků.'],
    ['description', draft({ description: 'D'.repeat(1001) }), 'Popis může mít nejvýše 1000 znaků.'],
    ['priceCzk', draft({ priceCzk: '' }), 'Zadejte cenu v Kč.'],
    ['priceCzk', draft({ priceCzk: 'zdarma' }), 'Zadejte cenu v Kč.'],
    ['priceCzk', draft({ priceCzk: '-5' }), 'Cena nemůže být záporná.'],
    ['priceCzk', draft({ priceCzk: '1234,567' }), 'Cena může mít nejvýše dvě desetinná místa.'],
    ['listPriceCzk', draft({ listPriceCzk: 'abc' }), 'Zadejte původní cenu v Kč, nebo pole nechte prázdné.'],
    ['listPriceCzk', draft({ listPriceCzk: '1000' }), 'Původní cena musí být vyšší než cena.'],
    ['listPriceCzk', draft({ listPriceCzk: '900' }), 'Původní cena musí být vyšší než cena.'],
    ['listPriceCzk', draft({ listPriceCzk: '0' }), 'Původní cena musí být vyšší než cena.'],
    ['listPriceCzk', draft({ listPriceCzk: '1200,999' }), 'Původní cena může mít nejvýše dvě desetinná místa.'],
  ] as const)('%s: %#', (field, input, sentence) => {
    expect(validateService(input, [item()], null)[field]).toBe(sentence);
  });

  it('a price of 0 is a price (the owner may give something away)', () => {
    expect(validateService(draft({ priceCzk: '0' }), [], null).priceCzk).toBeUndefined();
  });

  it('a name of exactly 200 and a code of exactly 30 characters pass', () => {
    expect(validateService(draft({ name: 'N'.repeat(200), code: 'K'.repeat(30) }), [], null)).toEqual({});
  });

  it('the item being edited does not clash with its own code, another item still does', () => {
    const others = [item({ id: 'i1', code: 'KP' }), item({ id: 'i2', code: 'DG' })];
    expect(validateService(draft({ code: 'KP' }), others, 'i1').code).toBeUndefined();
    expect(validateService(draft({ code: 'DG' }), others, 'i1').code).toBe('Tenhle kód už jedna položka má.');
  });
});

describe('what is sent', () => {
  it('trims the texts and parses the Czech price', () => {
    expect(toRequest(draft({ code: ' ZZ ', name: ' Název ', description: ' Popis ', priceCzk: '1 500,50' }))).toEqual({
      code: 'ZZ', name: 'Název', description: 'Popis', durationMinutes: 30, priceCzk: 1500.5, listPriceCzk: null, isActive: true,
    });
  });

  it('an empty list price is sent as null, which clears a stored one (omitted would keep it)', () => {
    expect(toRequest(draft({ listPriceCzk: '' })).listPriceCzk).toBeNull();
    expect(toRequest(draft({ listPriceCzk: '   ' })).listPriceCzk).toBeNull();
    expect(toRequest(draft({ listPriceCzk: '1.800' })).listPriceCzk).toBe(1800);
  });

  it('carries the duration nobody types any more, so a save does not blank it', () => {
    expect(toRequest(draftFrom(item({ durationMinutes: 45 }))).durationMinutes).toBe(45);
  });

  it('carries the active flag', () => {
    expect(toRequest(draftFrom(item({ isActive: false }))).isActive).toBe(false);
  });

  it('opens an item with its list price, and without one when the stored one is 0 or null', () => {
    expect(draftFrom(item({ listPriceCzk: 1800 })).listPriceCzk).toBe('1800');
    expect(draftFrom(item({ listPriceCzk: 0 })).listPriceCzk).toBe('');
    expect(draftFrom(item({ listPriceCzk: null })).listPriceCzk).toBe('');
  });
});
