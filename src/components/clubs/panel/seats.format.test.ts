import { describe, expect, it } from 'vitest';
import { formatPlayersTotal, formatSeats, formatSeatsWithTotal } from './seats';

describe('formatSeats', () => {
  it('shows 10 and 10 as two činnosti, never one 20', () => {
    const lines = [{ activityName: 'Základní', seats: 10 }, { activityName: 'Komplexní', seats: 10 }];
    expect(formatSeats(lines)).toBe('Základní 10 · Komplexní 10');
    expect(formatPlayersTotal(lines)).toBe('20 hráčů');
    expect(formatSeatsWithTotal(lines)).toBe('Základní 10 · Komplexní 10 (20 hráčů)');
  });
  it('adds registered / total where known', () => {
    expect(formatSeats([{ activityName: 'Základní', seats: 10, registered: 4 }, { activityName: 'Komplexní', seats: 10, registered: 0 }])).toBe('Základní 4/10 · Komplexní 0/10');
  });
  it('leaves out činnosti without places and reads empty as a dash', () => {
    expect(formatSeats([{ activityName: 'Základní', seats: 0 }])).toBe('—');
    expect(formatSeats([])).toBe('—');
    expect(formatSeatsWithTotal([])).toBe('—');
  });
  it('declines the player word', () => {
    expect(formatPlayersTotal([{ seats: 1 }])).toBe('1 hráč');
    expect(formatPlayersTotal([{ seats: 3 }])).toBe('3 hráči');
    expect(formatPlayersTotal([{ seats: 5 }])).toBe('5 hráčů');
  });
});
