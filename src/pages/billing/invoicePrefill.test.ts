import { describe, it, expect } from 'vitest';
import {
  addLine, hasPrefill, linesFromActivities, readNavState, recipientTypeFromState, wantsNewInvoice,
} from './invoicePrefill';

describe('readNavState', () => {
  it('keeps only non-empty strings it knows about', () => {
    expect(readNavState({ patientId: 'p1', appointmentId: '', clubId: 3, x: 'y', partnerOrderId: null }))
      .toEqual({ patientId: 'p1' });
    expect(readNavState(null)).toEqual({});
    expect(readNavState('nope')).toEqual({});
  });

  it('reads the club page state: club, block and a positive whole headcount', () => {
    expect(readNavState({ clubId: 'c1', clubBlockId: 'b1', headcount: 12 }))
      .toEqual({ clubId: 'c1', clubBlockId: 'b1', headcount: 12 });
    expect(readNavState({ headcount: '8' })).toEqual({ headcount: 8 });
    expect(readNavState({ headcount: 0 })).toEqual({});
    expect(readNavState({ headcount: 2.5 })).toEqual({});
    expect(readNavState({ headcount: '' })).toEqual({});
    expect(readNavState({ headcount: null })).toEqual({});
  });

  it('knows when there is nothing to act on', () => {
    expect(hasPrefill(readNavState(undefined))).toBe(false);
    expect(hasPrefill(readNavState({ invoiceId: 'i1' }))).toBe(true);
    expect(wantsNewInvoice(readNavState({ invoiceId: 'i1' }))).toBe(false);
    expect(wantsNewInvoice(readNavState({ clubBlockId: 'b1' }))).toBe(true);
  });

  it('makes a team of anything that came from a club and a person of a visit', () => {
    expect(recipientTypeFromState({ clubId: 'c1' })).toBe('Team');
    expect(recipientTypeFromState({ clubBlockId: 'b1' })).toBe('Team');
    expect(recipientTypeFromState({ partnerOrderId: 'o1' })).toBe('Team');
    expect(recipientTypeFromState({ patientId: 'p1', appointmentId: 'a1' })).toBe('Person');
  });
});

describe('lines', () => {
  it('merges the same činnost into one line', () => {
    expect(addLine(addLine([], 'a1', 2), 'a1')).toEqual([{ activityId: 'a1', quantity: 3 }]);
    expect(addLine([], 'a1', 0)).toEqual([]);
  });

  it('keeps the činnosti that have a price and counts the ones with none', () => {
    const activities = [
      { id: 'a1', priceCzk: 2200 },
      { id: 'a2', priceCzk: 1600 },
      { id: 'a3', priceCzk: null },
    ];
    expect(linesFromActivities(
      [{ activityId: 'a1', count: 12 }, { activityId: 'a2', count: 2 }, { activityId: 'a3', count: 1 }, { activityId: 'zz', count: 1 }],
      activities,
    )).toEqual({
      lines: [{ activityId: 'a1', quantity: 12 }, { activityId: 'a2', quantity: 2 }],
      unpriced: 2,
    });
  });
});
