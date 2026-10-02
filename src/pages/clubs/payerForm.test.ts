/*
 * What has to be true before somebody can be sent an invoice.
 *
 * The screen behind this collected a name, an IČO and three contact fields -
 * five of the thirteen the server has always carried, and not one of the ones
 * an invoice needs. There was no edit at all, so a bank account typed wrong
 * was permanent.
 *
 * The two checksums are the point. Eight digits is not an IČO and sixteen
 * characters is not an IBAN; both shapes accept a transposed pair of digits,
 * and a transposed pair in a bank account is money sent to a stranger.
 */
import { describe, it, expect } from 'vitest';
import {
  EMPTY_PAYER, canBeInvoiced, hasPayerErrors, isValidBankCode, isValidDic,
  isValidIban, isValidIco, toPayerRequest, validatePayer,
} from './payerForm';
import type { PayerDraft } from './payerForm';

/* Real Czech IČO check digits, worked out by the documented weighting. */
const GOOD_ICO = '25596641';
const GOOD_IBAN = 'CZ6508000000192000145399';

const draft = (over: Partial<PayerDraft> = {}): PayerDraft => ({
  ...EMPTY_PAYER,
  name: 'SK Slavia',
  ico: GOOD_ICO,
  paymentTermsDays: '14',
  ...over,
});

describe('IČO', () => {
  it('accepts a real one', () => {
    expect(isValidIco(GOOD_ICO)).toBe(true);
  });

  /*
   * The case that makes the check worth writing: eight digits, right shape,
   * wrong number. A length test alone lets this through.
   */
  it('rejects eight digits that are not an IČO', () => {
    expect(isValidIco('12345678')).toBe(false);
  });

  it('rejects a transposed pair of digits', () => {
    const swapped = GOOD_ICO[1] + GOOD_ICO[0] + GOOD_ICO.slice(2);
    expect(swapped).not.toBe(GOOD_ICO);
    expect(isValidIco(swapped)).toBe(false);
  });

  it('rejects the wrong length and anything not a digit', () => {
    expect(isValidIco('2559664')).toBe(false);
    expect(isValidIco('255966411')).toBe(false);
    expect(isValidIco('2559664X')).toBe(false);
  });

  /* People type it off a contract, spaces and all. */
  it('ignores spaces', () => {
    expect(isValidIco('255 966 41')).toBe(true);
  });
});

describe('IBAN', () => {
  it('accepts a real one', () => {
    expect(isValidIban(GOOD_IBAN)).toBe(true);
  });

  it('accepts it written in the spaced form people read aloud', () => {
    expect(isValidIban('CZ65 0800 0000 1920 0014 5399')).toBe(true);
  });

  /* The typo that sends money to a stranger. */
  it('rejects a transposed pair of digits', () => {
    /* Positions 12 and 13, because 10 and 11 are both zeros - swapping those
       changes nothing and the first version of this test proved only that. */
    const swapped = GOOD_IBAN.slice(0, 12) + GOOD_IBAN[13] + GOOD_IBAN[12] + GOOD_IBAN.slice(14);
    expect(swapped).not.toBe(GOOD_IBAN);
    expect(isValidIban(swapped)).toBe(false);
  });

  /*
   * Not a Czech-only rule. Refusing a valid Slovak or Austrian account
   * because the rule was written for `CZ` is a worse fault than a typo - it
   * blocks a payer who is entirely legitimate.
   */
  it('accepts a foreign IBAN', () => {
    expect(isValidIban('SK3112000000198742637541')).toBe(true);
    expect(isValidIban('AT611904300234573201')).toBe(true);
    expect(isValidIban('DE89370400440532013000')).toBe(true);
  });

  it('is optional — an account number alone is enough', () => {
    expect(isValidIban('')).toBe(true);
  });

  it('rejects something that is not an IBAN at all', () => {
    expect(isValidIban('192000145399/0800')).toBe(false);
    expect(isValidIban('CZ')).toBe(false);
  });
});

describe('DIČ and the bank code', () => {
  it('takes a Czech DIČ and lets it be absent', () => {
    expect(isValidDic('CZ25596641')).toBe(true);
    expect(isValidDic('cz25596641')).toBe(true);
    expect(isValidDic('')).toBe(true);
  });

  it('refuses a DIČ without the country or with the wrong digit count', () => {
    expect(isValidDic('25596641')).toBe(false);
    expect(isValidDic('CZ123')).toBe(false);
  });

  it('takes a four-digit bank code and lets it be absent', () => {
    expect(isValidBankCode('0800')).toBe(true);
    expect(isValidBankCode('')).toBe(true);
    expect(isValidBankCode('80')).toBe(false);
    expect(isValidBankCode('08000')).toBe(false);
  });
});

describe('what may be saved', () => {
  it('accepts a filled-in payer', () => {
    expect(validatePayer(draft())).toEqual({});
  });

  it('demands a name and an IČO', () => {
    expect(validatePayer(draft({ name: '  ' })).name).toBeDefined();
    expect(validatePayer(draft({ ico: '' })).ico).toBeDefined();
  });

  it('says an IČO is wrong rather than just missing', () => {
    expect(validatePayer(draft({ ico: '12345678' })).ico).toMatch(/neexistuje/);
  });

  /*
   * Splatnost. The guard is not a rule of law - it is the 140-instead-of-14
   * typo, which turns an unpaid invoice into one nobody chases for months.
   */
  it('takes a whole number of days and refuses a year-long typo', () => {
    expect(validatePayer(draft({ paymentTermsDays: '30' })).paymentTermsDays).toBeUndefined();
    expect(validatePayer(draft({ paymentTermsDays: '0' })).paymentTermsDays).toBeUndefined();
    expect(validatePayer(draft({ paymentTermsDays: '400' })).paymentTermsDays).toBeDefined();
    expect(validatePayer(draft({ paymentTermsDays: '14,5' })).paymentTermsDays).toBeDefined();
    expect(validatePayer(draft({ paymentTermsDays: '' })).paymentTermsDays).toBeDefined();
  });

  it('checks an e-mail only when one was typed', () => {
    expect(validatePayer(draft({ contactEmail: '' })).contactEmail).toBeUndefined();
    expect(validatePayer(draft({ contactEmail: 'klub' })).contactEmail).toBeDefined();
    expect(validatePayer(draft({ contactEmail: 'a@b.cz' })).contactEmail).toBeUndefined();
  });

  it('reports every broken field at once', () => {
    const found = validatePayer(
      draft({ name: '', ico: '', dic: 'X', iban: 'CZ00', paymentTermsDays: '' }),
    );
    expect(Object.keys(found).sort())
      .toEqual(['dic', 'iban', 'ico', 'name', 'paymentTermsDays']);
  });

  it('knows when there is nothing wrong', () => {
    expect(hasPayerErrors({})).toBe(false);
    expect(hasPayerErrors({ ico: 'x' })).toBe(true);
  });
});

describe('turning the form into a request', () => {
  it('strips the spaces people type and uppercases the codes', () => {
    const body = toPayerRequest(draft({
      ico: '255 966 41', dic: 'cz25596641', iban: 'cz65 0800 0000 1920 0014 5399',
      bankAccount: '192000 145399', postalCode: '110 00', name: '  SK Slavia  ',
      paymentTermsDays: '30',
    }));
    expect(body.ico).toBe('25596641');
    expect(body.dic).toBe('CZ25596641');
    expect(body.iban).toBe('CZ6508000000192000145399');
    expect(body.bankAccount).toBe('192000145399');
    expect(body.postalCode).toBe('11000');
    expect(body.name).toBe('SK Slavia');
    /* A number, not the string the field held. */
    expect(body.paymentTermsDays).toBe(30);
  });
});

describe('whether a payer can actually be billed', () => {
  /*
   * Kept apart from validity on purpose. A club with a name and an IČO is a
   * legitimate record - it just cannot be sent a bill, and that is worth
   * saying in the list rather than discovering on the day the invoice is due.
   */
  it('needs somewhere to send it and somewhere to pay to', () => {
    expect(canBeInvoiced({ iban: GOOD_IBAN, address: 'Vinohradská 1' })).toBe(true);
    expect(canBeInvoiced({ bankAccount: '192000145399', address: 'Vinohradská 1' })).toBe(true);
  });

  it('is false with no account, and false with no address', () => {
    expect(canBeInvoiced({ address: 'Vinohradská 1' })).toBe(false);
    expect(canBeInvoiced({ iban: GOOD_IBAN })).toBe(false);
    expect(canBeInvoiced({})).toBe(false);
  });

  it('treats a null from the server the same as a blank', () => {
    expect(canBeInvoiced({ iban: null, bankAccount: null, address: null })).toBe(false);
  });
});
