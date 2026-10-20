/*
 * Settings audit (20. 10. 2026): the scheduling API refuses a value with
 * `422 { message: "scheduling.<rule>" }` - a code, not a sentence. Measured on
 * the dev API for calendars, working hours, exceptions, činnosti, služby,
 * blocks, absences and partner orders. A person must read Czech, never the code.
 */
import { describe, expect, it } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { KNOWN_SCHEDULING_CODES, isMessageCode, wordedServerMessage } from './schedulingMessages';
import { toBookingError } from './apiError';

const refusal = (status: number, data: unknown): AxiosError => {
  const response = { status, data, statusText: '', headers: {}, config: {} } as AxiosResponse;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, response);
};

describe('what counts as a code', () => {
  it.each([
    ['scheduling.working_hours.end_before_start', true],
    ['scheduling.sort_order_negative', true],
    ['service.duplicate', true],
    ['Tento čas už je obsazený.', false],
    ['Služba s tímto názvem už existuje.', false],
    ['Nastavení nelze uložit: Paleta musí mít 6 až 24 barev.', false],
    ['', false],
  ])('%s -> %s', (text, expected) => {
    expect(isMessageCode(text)).toBe(expected);
  });
});

describe('wordedServerMessage', () => {
  it('shows a sentence the server wrote exactly as it is', () => {
    expect(wordedServerMessage('Na tento den už výjimka existuje.')).toBe('Na tento den už výjimka existuje.');
  });

  it('words the codes the dev API really answered with', () => {
    expect(wordedServerMessage('scheduling.calendar.name_required')).toBe('Vyplňte název.');
    expect(wordedServerMessage('scheduling.calendar.display_step_positive')).toBe('Krok zobrazení musí být aspoň 1 minuta.');
    expect(wordedServerMessage('scheduling.working_hours.end_before_start')).toBe('Konec pracovní doby musí být později než začátek.');
    expect(wordedServerMessage('scheduling.exception.hours_required')).toBe('Jiné hodiny potřebují začátek i konec.');
    expect(wordedServerMessage('scheduling.exception.end_before_start')).toBe('Konec musí být později než začátek.');
    expect(wordedServerMessage('scheduling.text.too_long')).toBe('Text je příliš dlouhý. Zkraťte jej.');
  });

  it('words scheduling.sort_order_negative without naming the wrong field (the server uses it for horizons and holds too)', () => {
    const text = wordedServerMessage('scheduling.sort_order_negative');
    expect(text).toMatch(/Pořadí nesmí být záporné/);
    expect(text).toMatch(/aspoň 1/);
  });

  it('says nothing for a code it does not know, so the fixed sentence of the failure kind is used', () => {
    expect(wordedServerMessage('scheduling.something.new_next_year')).toBeUndefined();
  });

  it('says nothing for an empty message', () => {
    expect(wordedServerMessage('   ')).toBeUndefined();
    expect(wordedServerMessage(undefined)).toBeUndefined();
  });

  it('has a Czech sentence for every code in the table, none of them a code', () => {
    expect(KNOWN_SCHEDULING_CODES.length).toBeGreaterThanOrEqual(80);
    for (const code of KNOWN_SCHEDULING_CODES) {
      const text = wordedServerMessage(code);
      expect(text, code).toBeDefined();
      expect(isMessageCode(text as string), code).toBe(false);
      expect(text as string, code).toMatch(/[.]$/);
      expect(text as string, code).not.toMatch(/scheduling|_/);
    }
  });
});

describe('what a screen gets from a refused request', () => {
  it('a 422 carrying a code shows the Czech sentence', () => {
    const error = toBookingError(refusal(422, { success: false, message: 'scheduling.working_hours.break_outside', data: null }));
    expect(error.kind).toBe('domainRule');
    expect(error.serverMessage).toBe('Pauza musí ležet uvnitř pracovní doby.');
  });

  it('a 422 with an unknown code falls back to no server message (the fixed domain-rule sentence)', () => {
    const error = toBookingError(refusal(422, { success: false, message: 'scheduling.brand_new_rule', data: null }));
    expect(error.serverMessage).toBeUndefined();
    expect(error.i18nKey).toBe('booking.errors.domainRule');
  });

  it('a 409 keeps the server sentence (the count in "obsahuje 12 termínů" is the whole message)', () => {
    const error = toBookingError(refusal(409, { success: false, message: 'Kalendář nelze smazat: váže se k němu 1 objednávek partnera.' }));
    expect(error.kind).toBe('conflict');
    expect(error.serverMessage).toBe('Kalendář nelze smazat: váže se k němu 1 objednávek partnera.');
  });

  it('a 400 with the generic validation body keeps its sentence', () => {
    const error = toBookingError(refusal(400, { code: 'request.validation_failed', message: 'Požadavek obsahuje neplatné nebo chybějící údaje.' }));
    expect(error.serverMessage).toBe('Požadavek obsahuje neplatné nebo chybějící údaje.');
  });

  it('a 500 never shows a server message', () => {
    const error = toBookingError(refusal(500, { code: 'server.error', message: 'Požadavek se nepodařilo bezpečně dokončit.' }));
    expect(error.serverMessage).toBeUndefined();
  });
});
