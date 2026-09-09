import client from './client';
import type {
  AdministrativeProfileRequest,
  InsuranceRegistrationKind,
  ResidenceType,
} from './patientRegistry';

/**
 * The two routes that may change a patient's identity - `app` lane contract,
 * `docs/engineering/patient-identity-write-contract.md`.
 *
 * The patient's birth number, insurance number, insurer and address used to be
 * writable through `PUT /api/patients/{id}/profile`, which stored them as plain
 * text in a table of its own: no validation, no author, no reason, and invisible
 * to the registry. The clinic had two answers to "what is this patient's birth
 * number" and the one on screen was the ungoverned one.
 *
 * These two routes are the governed ones. Both demand a reason, both run the
 * checks registration runs, and both record who made the change.
 */

/** Both routes answer with this. `changed: false` means the request restated what was already on file. */
export interface IdentityWriteResult {
  changed: boolean;
  profileId?: string;
  patientAddressId?: string;
}

export interface AdministrativeProfileChange {
  profileId: string;
  insuranceRegistrationKind: InsuranceRegistrationKind;
  birthNumber: string | null;
  healthInsuranceNumber: string | null;
  /** Typed a second time on purpose: a mistyped insurance number is silent. */
  healthInsuranceNumberConfirmation: string | null;
  healthInsurerCode: string | null;
  insuranceEvidenceSource: string | null;
  identityDocumentType?: string | null;
  identityDocumentIssuingCountryCode?: string | null;
  identityDocumentNumber?: string | null;
}

export interface ResidenceAddressChange {
  patientAddressId: string;
  residenceType: ResidenceType;
  /** A RÚIAN address point, never free text - picked from the address search. */
  ruianAddressPointCode: number;
}

function newGuid(): string {
  return crypto.randomUUID();
}

/**
 * A reason is not optional and not defaulted. The server refuses a blank one;
 * refusing it here too means the operator is never told "saved" for a request
 * that was never going to be accepted.
 */
function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed === '') {
    throw new Error('Důvod změny je povinný.');
  }
  return trimmed;
}

export const patientIdentityApi = {
  /** Birth number, insurance number and insurer - contract route 3. */
  updateAdministrativeProfile: async (
    patientId: string,
    profile: Omit<AdministrativeProfileChange, 'profileId'>,
    changeReason: string,
  ): Promise<IdentityWriteResult> => {
    const reason = requireReason(changeReason);
    const res = await client.put(`/api/v1/patients/${patientId}/administrative-profile`, {
      profile: { profileId: newGuid(), ...profile } satisfies AdministrativeProfileChange,
      changeReason: reason,
    });
    return res.data as IdentityWriteResult;
  },

  /** The residence address - contract route 4. */
  updateResidenceAddress: async (
    patientId: string,
    residenceType: ResidenceType,
    ruianAddressPointCode: number,
    changeReason: string,
  ): Promise<IdentityWriteResult> => {
    const reason = requireReason(changeReason);
    const res = await client.put(`/api/v1/patients/${patientId}/residence-address`, {
      patientAddressId: newGuid(),
      residenceType,
      ruianAddressPointCode,
      changeReason: reason,
    });
    return res.data as IdentityWriteResult;
  },
};

export type { AdministrativeProfileRequest };
export default patientIdentityApi;
