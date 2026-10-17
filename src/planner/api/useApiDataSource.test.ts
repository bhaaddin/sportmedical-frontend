import { describe, expect, it } from 'vitest';
import { parseSeats } from './useApiDataSource';

describe('parseSeats', () => {
  it('reads activityId:seats pairs and drops anything malformed', () => {
    expect(parseSeats('a:3,b:10')).toEqual([{ activityId: 'a', seats: 3 }, { activityId: 'b', seats: 10 }]);
    expect(parseSeats('a:0,b:x,:4,c:2.5,d:7')).toEqual([{ activityId: 'd', seats: 7 }]);
    expect(parseSeats(null)).toEqual([]);
    expect(parseSeats('')).toEqual([]);
  });
});
