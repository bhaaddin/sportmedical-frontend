import { describe, expect, it } from 'vitest';
import { registrationChip } from './registrationLink';

const status = (state: 'none' | 'pending' | 'expired' | 'completed') => ({
  state,
  referenceNumber: 'ZD-2026-000001',
  issuedAtUtc: '2026-09-25T08:00:00Z',
  expiresAtUtc: '2026-09-26T08:00:00Z',
  completedAtUtc: state === 'completed' ? '2026-09-25T10:00:00Z' : null,
});

describe('the "Předregistrace" chip', () => {
  it('is amber while the link is waiting on the patient', () => {
    expect(registrationChip(status('pending'))).toEqual({ label: 'Předregistrace', color: 'warning' });
  });

  it('turns red and says so when the link expired', () => {
    expect(registrationChip(status('expired'))).toEqual({ label: 'Předregistrace — odkaz vypršel', color: 'error' });
  });

  it('is not drawn for a completed registration, an ordinary patient, or before the answer arrives', () => {
    expect(registrationChip(status('completed'))).toBeNull();
    expect(registrationChip(status('none'))).toBeNull();
    expect(registrationChip(undefined)).toBeNull();
  });
});
