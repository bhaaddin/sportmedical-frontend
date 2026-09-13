/*
 * The rules the price list keeps on its own.
 *
 * Every one of these guards something the server does not. `POST` and `PUT
 * /api/services` were read before these were written: they take the body, set
 * the fields and save. No unique code, no non-negative price, no non-zero
 * duration. So each test here stands between a desk and a row of data nothing
 * else would have stopped.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DURATION_MINUTES, categoriesInUse, draftFrom, hasErrors, parseCzechNumber,
  toRequest, validateService,
} from './serviceForm';
import type { ServiceItem } from '../../api/services';

const service = (over: Partial<ServiceItem> = {}): ServiceItem => ({
  id: 's1',
  code: 'KP',
  name: 'Komplexní prohlídka',
  description: 'Vše dohromady',
  category: 'Prohlídka',
  durationMinutes: 60,
  priceCzk: 3000,
  isActive: true,
  ...over,
});

const draft = (over: Record<string, string | boolean> = {}) => ({
  code: 'IB',
  name: 'InBody 770',
  description: '',
  category: 'Měření',
  durationMinutes: '15',
  priceCzk: '800',
  isActive: true,
  ...over,
}) as Parameters<typeof validateService>[0];

describe('numbers as somebody at a desk writes them', () => {
  it('reads a plain number', () => {
    expect(parseCzechNumber('800')).toBe(800);
  });

  /* What `toLocaleString('cs-CZ')` prints back into the field when a price is
     re-opened for editing. If this were not handled, opening a service and
     pressing save would refuse it. */
  it('reads a thousands space, including the non-breaking one', () => {
    expect(parseCzechNumber('1 500')).toBe(1500);
    expect(parseCzechNumber('1\u00A0500')).toBe(1500);
    expect(parseCzechNumber('1\u202F500')).toBe(1500);
  });

  it('reads a Czech decimal comma, and a dot from the numeric pad', () => {
    expect(parseCzechNumber('1500,50')).toBe(1500.5);
    expect(parseCzechNumber('1500.50')).toBe(1500.5);
  });

  it('refuses what is not a number at all rather than calling it zero', () => {
    expect(parseCzechNumber('zdarma')).toBeNull();
    expect(parseCzechNumber('800 Kč')).toBeNull();
    expect(parseCzechNumber('')).toBeNull();
  });

  /* An empty field is not a price of nothing. Anything that returns 0 here
     would let a blank save as free. */
  it('tells an empty field apart from a zero', () => {
    expect(parseCzechNumber('')).toBeNull();
    expect(parseCzechNumber('0')).toBe(0);
  });
});

describe('what may be saved', () => {
  it('accepts a filled-in service', () => {
    expect(validateService(draft(), [service()], null)).toEqual({});
  });

  it('demands a code and a name', () => {
    expect(validateService(draft({ code: '   ' }), [], null).code).toBeDefined();
    expect(validateService(draft({ name: '' }), [], null).name).toBeDefined();
  });

  it('demands a category', () => {
    expect(validateService(draft({ category: '' }), [], null).category).toBeDefined();
  });

  /*
   * Two services with one code are indistinguishable in every list that shows
   * the code - which is the card, the table and the search. The server allows
   * it.
   */
  it('refuses a code another service already has', () => {
    const clash = validateService(draft({ code: 'KP' }), [service()], null);
    expect(clash.code).toBeDefined();
  });

  it('refuses it however it is capitalised or spaced', () => {
    expect(validateService(draft({ code: ' kp ' }), [service()], null).code).toBeDefined();
  });

  /* Without this, opening a service and pressing save is an error: its own
     code clashes with itself. */
  it('lets a service keep its own code while being edited', () => {
    expect(validateService(draft({ code: 'KP' }), [service()], 's1').code).toBeUndefined();
  });

  /*
   * The duration rules were here and are gone with the field that fed them.
   *
   * Length is a fact about the činnost - the time it takes in a calendar -
   * and booking measured that the price-list copy was read in one place in
   * the whole system, a comparison against the činnost's own. That comparison
   * and its `price.duration_drift` warning were deleted, so the dialog
   * stopped asking. Rules guarding a field nobody can type are the same dead
   * weight as a check that cannot fail.
   */
  it('no longer complains about a duration, since nobody types one', () => {
    expect(validateService(draft({ durationMinutes: '0' }), [], null).durationMinutes)
      .toBeUndefined();
    expect(validateService(draft({ durationMinutes: '' }), [], null).durationMinutes)
      .toBeUndefined();
  });

  /* The column is still there, so a new row must not send a blank. */
  it('falls back to a default duration rather than sending nothing', () => {
    expect(toRequest(draft({ durationMinutes: '' })).durationMinutes)
      .toBe(DEFAULT_DURATION_MINUTES);
  });

  it('keeps an existing duration untouched', () => {
    expect(toRequest(draft({ durationMinutes: '90' })).durationMinutes).toBe(90);
  });

  it('refuses a negative price but allows a free service', () => {
    expect(validateService(draft({ priceCzk: '-100' }), [], null).priceCzk).toBeDefined();
    expect(validateService(draft({ priceCzk: '0' }), [], null).priceCzk).toBeUndefined();
  });

  it('refuses a blank price rather than saving it as free', () => {
    expect(validateService(draft({ priceCzk: '' }), [], null).priceCzk).toBeDefined();
  });

  it('reports every broken field at once, not just the first', () => {
    const found = validateService(
      draft({ code: '', name: '', category: '', priceCzk: 'nic' }),
      [],
      null,
    );
    expect(Object.keys(found).sort()).toEqual(['category', 'code', 'name', 'priceCzk']);
  });

  it('knows when there is nothing wrong', () => {
    expect(hasErrors({})).toBe(false);
    expect(hasErrors({ code: 'Kód je povinný.' })).toBe(true);
  });
});

describe('turning the form into a request', () => {
  it('parses the numbers and trims the text', () => {
    expect(toRequest(draft({ code: ' IB ', name: ' InBody ', priceCzk: '1 500,50' })))
      .toEqual({
        code: 'IB',
        name: 'InBody',
        description: '',
        category: 'Měření',
        durationMinutes: 15,
        priceCzk: 1500.5,
        isActive: true,
      });
  });
});

describe('the form a service opens into', () => {
  it('is empty for a new service, and active', () => {
    const blank = draftFrom(null);
    expect(blank.code).toBe('');
    expect(blank.priceCzk).toBe('');
    expect(blank.isActive).toBe(true);
  });

  /* Round trip: what is loaded must validate, or editing an existing service
     starts with errors on a form nobody has touched. */
  it('loads an existing service and that draft is immediately valid', () => {
    const loaded = draftFrom(service());
    expect(loaded.priceCzk).toBe('3000');
    expect(validateService(loaded, [service()], 's1')).toEqual({});
  });
});

describe('the categories already in use', () => {
  it('lists each once, sorted, with blanks left out', () => {
    expect(
      categoriesInUse([
        service({ id: 'a', category: 'Měření' }),
        service({ id: 'b', category: 'Diagnostika' }),
        service({ id: 'c', category: 'Měření' }),
        service({ id: 'd', category: '' }),
      ]),
    ).toEqual(['Diagnostika', 'Měření']);
  });
});
