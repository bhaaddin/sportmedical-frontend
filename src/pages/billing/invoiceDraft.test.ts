/*
 * What it takes to send a new document, and the bodies it sends. Osoba needs a
 * patient; Skupina a name and a headcount; Tým a club and a headcount.
 */
import { describe, it, expect } from 'vitest';
import {
  EMPTY_DRAFT, EMPTY_GROUP, buildCreateRequest, buildQuoteRequest, draftProblems, groupErrors,
  parseHeadcount, parseManualPercent,
} from './invoiceDraft';
import type { InvoiceDraft } from './invoiceDraft';

const draft = (over: Partial<InvoiceDraft>): InvoiceDraft => ({
  ...EMPTY_DRAFT, lines: [{ activityId: 'a1', quantity: 2 }], ...over,
});

describe('parsing', () => {
  it('reads a headcount as a whole number of 1 or more', () => {
    expect(parseHeadcount('12')).toBe(12);
    expect(parseHeadcount(' 3 ')).toBe(3);
    for (const bad of ['', '0', '-2', '2.5', 'abc', '1e3']) expect(parseHeadcount(bad)).toBeNull();
  });

  it('reads a manual percent: empty is none, 0–100 with two decimals at most', () => {
    expect(parseManualPercent('')).toBe(0);
    expect(parseManualPercent('12,5')).toBe(12.5);
    expect(parseManualPercent('100')).toBe(100);
    for (const bad of ['101', '-1', 'x', '1.234', '5 %']) expect(parseManualPercent(bad)).toBeNull();
  });
});

describe('draftProblems', () => {
  it('asks for the recipient type first', () => {
    expect(draftProblems(EMPTY_DRAFT, false)).toEqual(['Vyberte, komu doklad vystavujete.']);
  });

  it('Osoba needs a patient and a line - and no headcount', () => {
    expect(draftProblems(draft({ type: 'Person' }), false)).toEqual(['Vyberte pacienta.']);
    expect(draftProblems(draft({ type: 'Person' }), true)).toEqual([]);
    expect(draftProblems(draft({ type: 'Person', lines: [] }), true)).toEqual(['Vyberte alespoň jednu činnost z ceníku.']);
  });

  it('Skupina needs a name and a headcount - no patient', () => {
    expect(draftProblems(draft({ type: 'Group' }), false)).toEqual(['Zadejte název skupiny.', 'Zadejte počet osob.']);
    expect(draftProblems(draft({ type: 'Group', group: { ...EMPTY_GROUP, name: 'ČEZ' }, headcount: '8' }), false)).toEqual([]);
    expect(draftProblems(
      draft({ type: 'Group', group: { ...EMPTY_GROUP, name: 'ČEZ', ico: '12' }, headcount: '8' }), false,
    )).toEqual(['Opravte údaje skupiny.']);
  });

  it('Tým needs a club and a headcount - no patient', () => {
    expect(draftProblems(draft({ type: 'Team' }), false)).toEqual(['Vyberte klub.', 'Zadejte počet osob.']);
    expect(draftProblems(draft({ type: 'Team', club: { id: 'c1', name: 'FK' }, headcount: '12' }), false)).toEqual([]);
  });

  it('refuses a manual percent outside 0–100', () => {
    expect(draftProblems(draft({ type: 'Person', manualPercent: '120' }), true)).toEqual(['Ruční sleva musí být 0–100 %.']);
  });
});

describe('groupErrors', () => {
  it('wants a name, an eight-digit IČO if there is one, and a plausible e-mail', () => {
    expect(groupErrors(EMPTY_GROUP)).toEqual({ name: 'Zadejte název skupiny nebo firmy.' });
    expect(groupErrors({ ...EMPTY_GROUP, name: 'x', ico: '1234 5678', contactEmail: 'a@b.cz' })).toEqual({});
    expect(Object.keys(groupErrors({ ...EMPTY_GROUP, name: 'x', ico: '12', contactEmail: 'a@' }))).toEqual(['ico', 'contactEmail']);
  });
});

describe('buildQuoteRequest', () => {
  it('has nothing to price without a type or lines, or a team without a club', () => {
    expect(buildQuoteRequest(EMPTY_DRAFT)).toBeNull();
    expect(buildQuoteRequest(draft({ type: 'Person', lines: [] }))).toBeNull();
    expect(buildQuoteRequest(draft({ type: 'Team' }))).toBeNull();
    expect(buildQuoteRequest(draft({ type: 'Person', manualPercent: '200' }))).toBeNull();
  });

  it('sends the recipient, what the type needs, the lines and the manual discount', () => {
    expect(buildQuoteRequest(draft({ type: 'Person', manualPercent: '5' }))).toEqual({
      recipientType: 'Person', lines: [{ activityId: 'a1', quantity: 2 }], manualDiscountPercent: 5,
    });
    expect(buildQuoteRequest(draft({ type: 'Team', club: { id: 'c1', name: 'FK' }, headcount: '12' }))).toEqual({
      recipientType: 'Team', clubId: 'c1', headcount: 12, lines: [{ activityId: 'a1', quantity: 2 }],
    });
    expect(buildQuoteRequest(draft({ type: 'Group', headcount: '8' }))).toEqual({
      recipientType: 'Group', headcount: 8, lines: [{ activityId: 'a1', quantity: 2 }],
    });
  });

  it('never sends a headcount for a person, whatever is left in the field', () => {
    expect(buildQuoteRequest(draft({ type: 'Person', headcount: '9' }))).toEqual({
      recipientType: 'Person', lines: [{ activityId: 'a1', quantity: 2 }],
    });
  });
});

describe('buildCreateRequest', () => {
  it('Osoba: the patient and the visit, no group and no club', () => {
    expect(buildCreateRequest(draft({
      type: 'Person', patientId: 'p1', appointmentId: 'ap1', club: { id: 'c1', name: 'FK' }, headcount: '5', notes: ' pozn ',
    }))).toEqual({
      recipientType: 'Person', patientId: 'p1', appointmentId: 'ap1', notes: 'pozn',
      lines: [{ activityId: 'a1', quantity: 2 }],
    });
  });

  it('Skupina: the trimmed group, only what was filled in, and the headcount - no patient', () => {
    expect(buildCreateRequest(draft({
      type: 'Group', patientId: 'p1', headcount: '8',
      group: { ...EMPTY_GROUP, name: ' ČEZ ', ico: '1234 5678', address: ' Praha ' },
    }))).toEqual({
      recipientType: 'Group', group: { name: 'ČEZ', ico: '12345678', address: 'Praha' }, headcount: 8,
      lines: [{ activityId: 'a1', quantity: 2 }],
    });
  });

  it('Tým: the club id and the headcount - no patient', () => {
    expect(buildCreateRequest(draft({
      type: 'Team', patientId: 'p1', club: { id: 'c1', name: 'FK' }, headcount: '12',
    }))).toEqual({
      recipientType: 'Team', clubId: 'c1', headcount: 12, lines: [{ activityId: 'a1', quantity: 2 }],
    });
  });

  it('carries the manual discount, and its reason only when there is a discount', () => {
    const base = draft({ type: 'Person', patientId: 'p1', manualReason: ' věrnost ' });
    expect(buildCreateRequest({ ...base, manualPercent: '15' })).toMatchObject({
      manualDiscountPercent: 15, manualDiscountReason: 'věrnost',
    });
    const none = buildCreateRequest({ ...base, manualPercent: '' });
    expect(none).not.toHaveProperty('manualDiscountPercent');
    expect(none).not.toHaveProperty('manualDiscountReason');
  });
});
