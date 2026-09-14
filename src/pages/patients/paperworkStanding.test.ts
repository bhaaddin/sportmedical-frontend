/*
 * What the patient has to bring, after the rule moved off the template.
 *
 * On 14. 9. 2026 the server stopped sending `requiredForVisit` and
 * `firstVisitOnly` on a template - both moved onto the rule, where they
 * belong. The card's `.filter(t => t.isActive && t.requiredForVisit)` then
 * matched nothing, the whole paperwork section vanished on every patient, and
 * nothing anywhere said so. A patient with no výpis read exactly like a
 * patient whose papers were in order.
 *
 * These guard the replacement, and one thing in particular: that the screen
 * does not go back to asking every patient for every document, which is the
 * bug the owner had removed two days before.
 */
import { describe, it, expect } from 'vitest';
import {
  NOTHING_REQUIRED_TEXT, anyBlocks, expiringSoon, requirementLine,
  requirementState, stillMissing, validityText,
} from './paperworkStanding';
import type { AppointmentRequirement } from './paperworkStanding';

const VYPIS = 'tmpl-vypis';

const need = (over: Partial<AppointmentRequirement> = {}): AppointmentRequirement => ({
  templateId: VYPIS,
  templateName: 'Výpis ze zdravotní dokumentace',
  serviceName: 'Sportovní lékařské prohlídky',
  appointmentId: 'a1',
  startUtc: '2026-09-24T08:00:00Z',
  standing: 'Valid',
  ...over,
});

describe('reading the server’s verdict', () => {
  it('takes Valid as covered', () => {
    expect(requirementState(need({ standing: 'Valid' }))).toBe('on-file');
  });

  /*
   * Not a failure. The document still covers that appointment - the server
   * keeps `allRequiredPresent` true - so calling it missing would turn a
   * reminder into an alarm, and a false alarm is the one people learn to
   * ignore. It is also the only state somebody can still act on cheaply,
   * which is why there are more than two.
   */
  it('keeps ExpiringSoon apart from missing', () => {
    expect(requirementState(need({ standing: 'ExpiringSoon' }))).toBe('expiring');
    expect(stillMissing([need({ standing: 'ExpiringSoon' })])).toEqual([]);
    expect(expiringSoon([need({ standing: 'ExpiringSoon' })])).toHaveLength(1);
  });

  it('takes Missing and Expired as needing action', () => {
    expect(requirementState(need({ standing: 'Missing' }))).toBe('missing');
    expect(requirementState(need({ standing: 'Expired' }))).toBe('missing');
  });

  /*
   * A name this screen has not met is a name somebody added. Clearing a
   * patient on it would be the quiet failure this whole module replaced -
   * better a needless row than a missed visit.
   */
  it('treats a value it does not know as needing attention', () => {
    expect(requirementState(need({ standing: 'SomethingNew' }))).toBe('missing');
    expect(requirementState(need({ standing: '' }))).toBe('missing');
  });
});

describe('what is still missing', () => {
  it('keeps only what has to be acted on', () => {
    const requirements = [
      need({ standing: 'Valid' }),
      need({ templateId: 'souhlas', appointmentId: 'a2', standing: 'Missing' }),
    ];
    expect(stillMissing(requirements).map((r) => r.templateId)).toEqual(['souhlas']);
  });

  /*
   * No appointment asks for anything: the commonest state there is, and for
   * three days it was the same silence as "everything is in order".
   */
  it('is empty when nothing is asked for at all', () => {
    expect(stillMissing([])).toEqual([]);
    expect(NOTHING_REQUIRED_TEXT).toMatch(/termín/);
  });
});

describe('whether missing paperwork stops the booking', () => {
  /* The owner's rule from plan 2.4 is that paperwork warns. A rule can now
     reverse that for itself, and the desk has to know which it is looking at
     before picking up the telephone. */
  it('says so when one of them refuses', () => {
    expect(anyBlocks([need(), need({ appointmentId: 'a2', blocksBooking: true })])).toBe(true);
  });

  it('says no when they all only warn', () => {
    expect(anyBlocks([need(), need({ appointmentId: 'a2', blocksBooking: false })])).toBe(false);
  });

  it('says no for nothing at all', () => {
    expect(anyBlocks([])).toBe(false);
  });
});

describe('saying it on a row', () => {
  const plain = (iso: string) => iso.slice(0, 10);

  /*
   * Which appointment, and why. "Chybí: Výpis" was the old sentence, and it is
   * the one that sent somebody booked for a blood draw looking for a medical
   * record nobody had asked them for.
   */
  it('names the service and the day, not just the document', () => {
    const line = requirementLine(need(), plain);
    expect(line).toContain('Sportovní lékařské prohlídky');
    expect(line).toContain('2026-09-24');
    expect(line).toContain('Výpis ze zdravotní dokumentace');
  });

  /* A rule whose service has been deleted leaves an empty name behind. */
  it('does not leave a gap where a nameless service was', () => {
    expect(requirementLine(need({ serviceName: '' }), plain)).toContain('termín');
  });
});

describe('how long what they hold still stands', () => {
  /*
   * Counted by the server now. This screen carried its own copy of "a výpis
   * lasts a year", booking carried a second, and the column meant for it was
   * never written - three answers to one question. The only job left is
   * reading it out.
   */
  it('reads out the date the server gave', () => {
    expect(validityText(need({ validUntil: '2027-03-04' }), (d) => d))
      .toBe('platí do 2027-03-04');
  });

  /* Silence, not an invented date. */
  it('says nothing when the server gave none', () => {
    expect(validityText(need({ validUntil: null }), (d) => d)).toBeNull();
    expect(validityText(need(), (d) => d)).toBeNull();
  });
});
