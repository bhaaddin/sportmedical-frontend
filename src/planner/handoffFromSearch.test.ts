import { describe, expect, it } from 'vitest';
import { handoffFromSearch } from './handoffFromSearch';

describe('handoffFromSearch', () => {
  it('turns ?patient=ID&new=1 into the state hand-over', () => {
    const h = handoffFromSearch('?patient=p-1&new=1', null, 'k1');
    expect(h).toMatchObject({ patientId: 'p-1' });
    expect(typeof h?.newAppointment).toBe('number');
  });
  it('is stable per history entry and differs between entries', () => {
    const a = handoffFromSearch('?new=1', null, 'k1')?.newAppointment;
    expect(handoffFromSearch('?new=1', null, 'k1')?.newAppointment).toBe(a);
    expect(handoffFromSearch('?new=1', null, 'k2')?.newAppointment).not.toBe(a);
  });
  it('lets router state win and keeps the state path as the fallback', () => {
    expect(handoffFromSearch('?patient=a', { patientId: 'b' }, 'k')?.patientId).toBe('b');
    expect(handoffFromSearch('', { newAppointment: 5, patientId: 'x' }, 'k')).toEqual({ newAppointment: 5, patientId: 'x' });
    expect(handoffFromSearch('', null, 'k')).toBeNull();
  });
  it('ignores rubbish (a name, a long value, a bad date)', () => {
    expect(handoffFromSearch('?patient=Jan%20Novak&date=2026-13&activity=' + 'x'.repeat(80), null, 'k')).toBeNull();
    expect(handoffFromSearch('?date=2026-11-02', null, 'k')).toEqual({ date: '2026-11-02' });
  });
});
