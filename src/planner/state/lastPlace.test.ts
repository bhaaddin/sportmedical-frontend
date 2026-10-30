import { beforeEach, describe, expect, it } from 'vitest';
import { readLastPlace, writeLastPlace } from './lastPlace';

describe('the calendar remembers where the desk was', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('gives back the day and view written today', () => {
    writeLastPlace('2026-11-20', 'day', '2026-11-10');
    expect(readLastPlace('2026-11-10')).toEqual({ day: '2026-11-20', view: 'day' });
  });

  it('forgets it the next day, and when nothing or rubbish was stored', () => {
    writeLastPlace('2026-11-20', 'week', '2026-11-10');
    expect(readLastPlace('2026-11-11')).toBeNull();
    window.sessionStorage.setItem('sm.planner.lastPlace', '{oops');
    expect(readLastPlace('2026-11-10')).toBeNull();
    window.sessionStorage.clear();
    expect(readLastPlace('2026-11-10')).toBeNull();
  });
});
