/*
 * The header's count is measured from the validation rules, not typed in.
 * What would have to break for these to fail: Quick asking for as many
 * fields as Standard, or the subtitle counting past its own total.
 */
import { describe, expect, it } from 'vitest';
import { progressSubtitle, requiredFieldCount } from './progress';

describe('requiredFieldCount', () => {
  it('counts the seven fields Rychlá registrace asks for', () => {
    expect(
      requiredFieldCount({
        mode: 'Quick',
        insuranceRegistrationKind: 'CzechPublicHealthInsurance',
        residenceType: 'PermanentResidenceInCzechia',
      }),
    ).toBe(7);
  });

  it('asks for more in Úplná registrace than in Rychlá', () => {
    const quick = requiredFieldCount({
      mode: 'Quick',
      insuranceRegistrationKind: 'CzechPublicHealthInsurance',
      residenceType: 'PermanentResidenceInCzechia',
    });
    const standard = requiredFieldCount({
      mode: 'Standard',
      insuranceRegistrationKind: 'CzechPublicHealthInsurance',
      residenceType: 'PermanentResidenceInCzechia',
    });
    expect(standard).toBeGreaterThan(quick);
  });

  it('changes with the insurance branch', () => {
    const czech = requiredFieldCount({
      mode: 'Standard',
      insuranceRegistrationKind: 'CzechPublicHealthInsurance',
      residenceType: 'PermanentResidenceInCzechia',
    });
    const foreign = requiredFieldCount({
      mode: 'Standard',
      insuranceRegistrationKind: 'NoCzechHealthInsuranceNumber',
      residenceType: 'PermanentResidenceInCzechia',
    });
    expect(foreign).not.toBe(czech);
  });
});

describe('progressSubtitle', () => {
  it('names the mode and the count', () => {
    expect(progressSubtitle('Quick', 3, 7)).toBe('Rychlá registrace — 3 z 7 údajů');
    expect(progressSubtitle('Standard', 0, 12)).toBe('Úplná registrace — 0 z 12 údajů');
  });

  it('never counts past the total or below zero', () => {
    expect(progressSubtitle('Quick', 9, 7)).toBe('Rychlá registrace — 7 z 7 údajů');
    expect(progressSubtitle('Quick', -2, 7)).toBe('Rychlá registrace — 0 z 7 údajů');
  });
});
