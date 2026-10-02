/*
 * What the header of "Nový pacient" counts: "Rychlá registrace — 3 z 7 údajů".
 *
 * The total is not a number anybody typed in. It is measured by validating an
 * EMPTY form in the chosen mode and branch, so Rychlá registrace shows its
 * own short total and a switch to the foreign-document branch changes it
 * without anybody remembering to update a constant.
 */
import { createEmptyForm, validateAll, type RegistrationFormState } from './validation';

export type RegistrationMode = RegistrationFormState['mode'];

export const MODE_LABEL: Record<RegistrationMode, string> = {
  Quick: 'Rychlá registrace',
  Standard: 'Úplná registrace',
};

/** How many fields this mode and branch require, counted from the rules. */
export function requiredFieldCount(
  shape: Pick<RegistrationFormState, 'mode' | 'insuranceRegistrationKind' | 'residenceType'>,
): number {
  const probe: RegistrationFormState = {
    ...createEmptyForm(),
    mode: shape.mode,
    insuranceRegistrationKind: shape.insuranceRegistrationKind,
    residenceType: shape.residenceType,
  };
  return Object.keys(validateAll(probe)).length;
}

/** "Rychlá registrace — 3 z 7 údajů". Never counts below zero or above the total. */
export function progressSubtitle(mode: RegistrationMode, done: number, total: number): string {
  const clamped = Math.min(total, Math.max(0, done));
  return `${MODE_LABEL[mode]} — ${clamped} z ${total} údajů`;
}
