import { describe, it, expect } from 'vitest';
import { lastSuccessText, providerName, testProblemText, validAddress, OLD_SERVER_TEXT } from './emailStatusModel';
import { problemOf } from './emailStatusApi';

describe('emailStatusModel', () => {
  it('accepts plain addresses and refuses everything else', () => {
    expect(validAddress('jan@example.cz')).toBe(true);
    expect(validAddress(' jan@example.cz ')).toBe(true);
    for (const bad of ['', 'jan', 'jan@', 'jan@example', 'a b@example.cz', 'Jan <jan@example.cz>', 'a@b.cz, c@d.cz']) {
      expect(validAddress(bad), bad).toBe(false);
    }
  });

  it('words every problem code in Czech', () => {
    const codes = ['email.not_configured', 'email.provider_rejected', 'email.timeout', 'email.provider_unavailable', 'email.invalid_address'];
    const texts = codes.map((code) => testProblemText({ code, status: 502 }));
    expect(new Set(texts).size).toBe(codes.length);
    texts.forEach((t) => expect(t).not.toMatch(/email\./));
  });

  it('words transport failures', () => {
    expect(testProblemText({ code: 'unknown', status: 404 })).toBe(OLD_SERVER_TEXT);
    expect(testProblemText({ code: 'unknown', status: 429 })).toMatch(/třikrát za hodinu/);
    expect(testProblemText({ code: 'offline', status: undefined })).toMatch(/Server neodpovídá/);
    expect(testProblemText({ code: 'unknown', status: 500 })).toMatch(/nepodařilo/);
  });

  it('reads the problem code out of an error body', () => {
    expect(problemOf({ response: { status: 409, data: { code: 'email.not_configured' } } })).toEqual({ code: 'email.not_configured', status: 409 });
    expect(problemOf(new Error('x'))).toEqual({ code: 'offline', status: undefined });
  });

  it('names providers and the last success', () => {
    expect(providerName('brevo')).toMatch(/Brevo/);
    expect(providerName('other')).toBe('other');
    expect(lastSuccessText(null)).toBe('Zatím nic neodešlo');
    expect(lastSuccessText('2026-10-24T08:30:00Z')).toMatch(/2026/);
  });
});
