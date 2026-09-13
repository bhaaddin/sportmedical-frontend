/*
 * What a required document says about itself, and in what colour.
 *
 * Two rules the owner agreed to:
 *
 *   show the date, not a verdict     "Výpis z 3. 5. 2026", not "Hotovo"
 *   keep the alarm for the alarm     red only when something must be done
 *
 * The green tick went with the second. A card carrying twenty green ticks
 * teaches its reader to stop looking at that column, and the twenty-first time
 * it is red nobody sees it - green is the most expensive colour on a screen
 * because it is spent on the case that needs nothing done.
 */
import { describe, it, expect } from 'vitest';
import { requiredRowState } from './requiredDocumentRow';
import type { DocumentTemplate, PatientDocument } from '../../api/documents';

const template = (over: Partial<DocumentTemplate> = {}): DocumentTemplate =>
  ({ id: 't1', name: 'Výpis', type: 'Vypis', firstVisitOnly: true, ...over }) as DocumentTemplate;

const TODAY = new Date(2026, 8, 13); // 13. 9. 2026

const doc = (over: Partial<PatientDocument> = {}): PatientDocument =>
  ({ id: 'd1', reportDate: '2026-05-03', uploadedAt: '2026-09-13T10:00:00Z', ...over }) as PatientDocument;

describe('a document that is on file', () => {
  /* The date the other doctor issued it - the one fact that decides whether
     it is still any use. */
  it('says when it was issued, not that it is done', () => {
    const row = requiredRowState(template(), doc(), TODAY);
    expect(row.tone).toBe('on-file');
    expect(row.text).toMatch(/3\. 5\. 2026/);
    expect(row.text).not.toMatch(/hotovo/i);
  });

  /*
   * `reportDate` is optional today. The upload date is less useful and still
   * a date - and still more than "Hotovo", which is not information.
   */
  it('falls back to when it was uploaded, rather than to a verdict', () => {
    const row = requiredRowState(template(), doc({ reportDate: null }), TODAY);
    expect(row.tone).toBe('on-file');
    expect(row.text).toMatch(/nahráno/);
    expect(row.text).toMatch(/13\. 9\. 2026/);
  });

  it('says something even with no date at all', () => {
    const row = requiredRowState(template(), doc({ reportDate: null, uploadedAt: undefined as never }), TODAY);
    expect(row.text.trim()).not.toBe('');
  });

  /* Grey, not green. This is the rule, not a preference. */
  it('is never the alarming tone while it is in date', () => {
    for (const t of [template(), template({ firstVisitOnly: false })]) {
      expect(requiredRowState(t, doc(), TODAY).tone).toBe('on-file');
    }
  });
});

describe('a document that is not on file', () => {
  /*
   * Red only when something must be done. Measured against the server: a
   * returning patient with no výpis has nothing missing at all, so red on a
   * first-visit document would be the screen raising an alarm the server
   * does not.
   */
  it('is informational when only a first visit needs it', () => {
    const row = requiredRowState(template({ firstVisitOnly: true }), undefined, TODAY);
    expect(row.tone).toBe('first-visit');
    expect(row.text).toMatch(/1\. návštěvě/);
  });

  it('is the alarm when every visit needs it', () => {
    const row = requiredRowState(template({ firstVisitOnly: false }), undefined, TODAY);
    expect(row.tone).toBe('missing');
    expect(row.text).toBe('Chybí');
  });

  /* The three tones are distinct - collapsing any two would put the alarm
     somewhere it does not belong, or take it from where it does. */
  it('gives a different answer to each of the three cases', () => {
    const tones = [
      requiredRowState(template(), doc(), TODAY).tone,
      requiredRowState(template({ firstVisitOnly: true }), undefined, TODAY).tone,
      requiredRowState(template({ firstVisitOnly: false }), undefined, TODAY).tone,
    ];
    expect(new Set(tones).size).toBe(3);
  });
});

/*
 * How long the výpis still stands.
 *
 * A year from the day it was issued - the owner's rule. The card works it out
 * from `reportDate` because the server's own answer hangs off an appointment
 * and the card has none; see `validUntilFromIssued`, which is marked for
 * deletion the day that value arrives.
 */
describe('the výpis and its year', () => {
  const issued = (date: string) => doc({ reportDate: date });

  it('says until when, not only from when', () => {
    const row = requiredRowState(template(), issued('2026-05-03'), TODAY);
    expect(row.text).toMatch(/z 3\. 5\. 2026/);
    expect(row.text).toMatch(/platí do 3\. 5\. 2027/);
  });

  it('stays quiet while there is plenty of it left', () => {
    expect(requiredRowState(template(), issued('2026-05-03'), TODAY).tone).toBe('on-file');
  });

  /*
   * The whole point of showing a date. A výpis running out in three weeks can
   * be asked for at this visit; without the warning the first anybody hears of
   * it is the day somebody is sent home.
   */
  it('turns amber a month before the end', () => {
    const row = requiredRowState(template(), issued('2025-10-01'), TODAY);
    expect(row.tone).toBe('expiring');
    expect(row.detail).toMatch(/platí ještě/);
  });

  /*
   * One sentence for both reasons, as the owner asked: "keď platnosť uplynie,
   * hláška je jedna a jednoduchá, rovnaká ako keď výpis nikdy nebol".
   */
  it('is simply missing once it has run out, with the same word', () => {
    const expired = requiredRowState(template(), issued('2024-05-03'), TODAY);
    const never = requiredRowState(template({ firstVisitOnly: false }), undefined, TODAY);
    expect(expired.tone).toBe('missing');
    expect(expired.text).toBe(never.text);
    expect(expired.detail).toMatch(/platnost skončila/);
  });

  /* The last day counts, as booking confirmed: `appointmentDay <= until`. */
  it('still counts on the very last day', () => {
    expect(requiredRowState(template(), issued('2025-09-13'), TODAY).tone).not.toBe('missing');
    expect(requiredRowState(template(), issued('2025-09-12'), TODAY).tone).toBe('missing');
  });

  /* A výpis with no issue date has no year to count, and must not be called
     expired for it - that would turn a missing field into a missing document. */
  it('says nothing about validity when the issue date is blank', () => {
    const row = requiredRowState(template(), doc({ reportDate: null }), TODAY);
    expect(row.tone).toBe('on-file');
    expect(row.text).not.toMatch(/platí do/);
  });

  /* Only the výpis has a year. Inventing one for a consent form would be a
     deadline nobody set. */
  it('gives no other document an expiry', () => {
    const row = requiredRowState(
      template({ type: 'InformovanySouhlas' }), issued('2020-01-01'), TODAY,
    );
    expect(row.tone).toBe('on-file');
    expect(row.text).not.toMatch(/platí do/);
  });
});
