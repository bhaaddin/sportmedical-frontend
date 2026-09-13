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
  ({ id: 't1', name: 'Výpis', firstVisitOnly: true, ...over }) as DocumentTemplate;

const doc = (over: Partial<PatientDocument> = {}): PatientDocument =>
  ({ id: 'd1', reportDate: '2026-05-03', uploadedAt: '2026-09-13T10:00:00Z', ...over }) as PatientDocument;

describe('a document that is on file', () => {
  /* The date the other doctor issued it - the one fact that decides whether
     it is still any use. */
  it('says when it was issued, not that it is done', () => {
    const row = requiredRowState(template(), doc());
    expect(row.tone).toBe('on-file');
    expect(row.text).toMatch(/3\. 5\. 2026/);
    expect(row.text).not.toMatch(/hotovo/i);
  });

  /*
   * `reportDate` is optional today. The upload date is less useful and still
   * a date - and still more than "Hotovo", which is not information.
   */
  it('falls back to when it was uploaded, rather than to a verdict', () => {
    const row = requiredRowState(template(), doc({ reportDate: null }));
    expect(row.tone).toBe('on-file');
    expect(row.text).toMatch(/nahráno/);
    expect(row.text).toMatch(/13\. 9\. 2026/);
  });

  it('says something even with no date at all', () => {
    const row = requiredRowState(template(), doc({ reportDate: null, uploadedAt: undefined as never }));
    expect(row.text.trim()).not.toBe('');
  });

  /* Grey, not green. This is the rule, not a preference. */
  it('is never the alarming tone', () => {
    for (const t of [template(), template({ firstVisitOnly: false })]) {
      expect(requiredRowState(t, doc()).tone).toBe('on-file');
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
    const row = requiredRowState(template({ firstVisitOnly: true }), undefined);
    expect(row.tone).toBe('first-visit');
    expect(row.text).toMatch(/1\. návštěvě/);
  });

  it('is the alarm when every visit needs it', () => {
    const row = requiredRowState(template({ firstVisitOnly: false }), undefined);
    expect(row.tone).toBe('missing');
    expect(row.text).toBe('Chybí');
  });

  /* The three tones are distinct - collapsing any two would put the alarm
     somewhere it does not belong, or take it from where it does. */
  it('gives a different answer to each of the three cases', () => {
    const tones = [
      requiredRowState(template(), doc()).tone,
      requiredRowState(template({ firstVisitOnly: true }), undefined).tone,
      requiredRowState(template({ firstVisitOnly: false }), undefined).tone,
    ];
    expect(new Set(tones).size).toBe(3);
  });
});
