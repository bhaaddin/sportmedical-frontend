/*
 * What holds an absence back before it is sent. The server refuses the same
 * things; saying so on the form keeps it filled in and names the field.
 */
import { describe, it, expect } from 'vitest';
import { absenceDraftProblem } from './employeeAbsences';

const draft = (over: Partial<{ userId: string; fromDate: string; toDate: string }> = {}) => ({
  userId: 'u1',
  fromDate: '2026-10-12',
  toDate: '2026-10-16',
  ...over,
});

describe('an absence draft', () => {
  it('is fine with a worker and a range in order', () => {
    expect(absenceDraftProblem(draft())).toBeNull();
  });

  it('may be a single day', () => {
    expect(absenceDraftProblem(draft({ toDate: '2026-10-12' }))).toBeNull();
  });

  it('needs a worker', () => {
    expect(absenceDraftProblem(draft({ userId: '' }))).toBe('worker');
  });

  it('needs both dates', () => {
    expect(absenceDraftProblem(draft({ toDate: '' }))).toBe('dates');
  });

  it('cannot end before it starts', () => {
    expect(absenceDraftProblem(draft({ toDate: '2026-10-11' }))).toBe('order');
  });
});
