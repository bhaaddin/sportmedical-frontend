import { describe, it, expect } from 'vitest';
import { formatRodneCislo } from './rodneCislo';

describe('formatRodneCislo', () => {
  it('adds the slash once there are more than six digits, and never a stray one', () => {
    expect(formatRodneCislo('900515')).toBe('900515');
    expect(formatRodneCislo('9005150000')).toBe('900515/0000');
    expect(formatRodneCislo('900515/0000')).toBe('900515/0000');
  });

  it('stops at ten digits instead of letting the field grow', () => {
    expect(formatRodneCislo('90051500001234')).toBe('900515/0000');
  });
});
