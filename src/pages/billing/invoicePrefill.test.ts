import { describe, it, expect } from 'vitest';
import { addLine, hasPrefill, linesFromActivities, readNavState } from './invoicePrefill';

describe('readNavState', () => {
  it('keeps only non-empty strings it knows about', () => {
    expect(readNavState({ patientId: 'p1', appointmentId: '', clubId: 3, x: 'y', partnerOrderId: null }))
      .toEqual({ patientId: 'p1' });
    expect(readNavState(null)).toEqual({});
    expect(readNavState('nope')).toEqual({});
  });

  it('knows when there is nothing to act on', () => {
    expect(hasPrefill(readNavState(undefined))).toBe(false);
    expect(hasPrefill(readNavState({ invoiceId: 'i1' }))).toBe(true);
  });
});

describe('lines', () => {
  it('merges the same item into one line', () => {
    expect(addLine(addLine([], 's1', 2), 's1')).toEqual([{ serviceId: 's1', quantity: 3 }]);
    expect(addLine([], 's1', 0)).toEqual([]);
  });

  it("turns činnosti into the price-list items they point at and counts the ones with no price", () => {
    const activities = [
      { id: 'a1', serviceItemId: 's1' },
      { id: 'a2', serviceItemId: 's1' },
      { id: 'a3', serviceItemId: null },
    ];
    expect(linesFromActivities(
      [{ activityId: 'a1', count: 12 }, { activityId: 'a2', count: 2 }, { activityId: 'a3', count: 1 }, { activityId: 'zz', count: 1 }],
      activities,
    )).toEqual({ lines: [{ serviceId: 's1', quantity: 14 }], unpriced: 2 });
  });
});
