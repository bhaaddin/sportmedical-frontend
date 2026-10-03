import { describe, it, expect } from 'vitest';
import { linkErrorText } from './linkErrorText';

const GENERIC = 'Odkaz se nepodařilo vygenerovat. Zkuste to prosím znovu.';
const failure = (status: number, data: unknown) => ({ response: { status, data } });

describe('linkErrorText', () => {
  it('shows the sentence the server wrote for a refusal the desk can act on', () => {
    const message = 'Registrace tohoto pacienta je úplná (má adresu i pojištění), odkaz k dokončení není potřeba.';
    expect(linkErrorText(failure(409, { code: 'intake.link.registration_complete', message }))).toBe(message);
    expect(linkErrorText(failure(409, { message: 'Pacient nemá v kartě e-mail. Doplňte ho a odkaz vygenerujte znovu.' })))
      .toContain('nemá v kartě e-mail');
    expect(linkErrorText(failure(404, { message: 'Pacient nebyl nalezen.' }))).toBe('Pacient nebyl nalezen.');
  });

  it('falls back to the generic sentence for a server error, a network failure or a strange body', () => {
    expect(linkErrorText(failure(500, { message: 'boom' }))).toBe(GENERIC);
    expect(linkErrorText(new Error('Network Error'))).toBe(GENERIC);
    expect(linkErrorText(failure(409, { message: 42 }))).toBe(GENERIC);
    expect(linkErrorText(failure(409, { message: '   ' }))).toBe(GENERIC);
    expect(linkErrorText(failure(409, { message: 'x'.repeat(400) }))).toBe(GENERIC);
    expect(linkErrorText(undefined)).toBe(GENERIC);
  });
});
