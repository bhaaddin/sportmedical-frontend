/* ══════════════════════════════════════════════════════════════
   PATIENT REGISTRY API (staff, governed)

   Wraps the /api/v1 registry surface owned by
   Api/Controllers/PatientRegistryController.cs and
   Api/Controllers/PatientRegistrationOptionsController.cs.

   This is NOT the legacy /api/patients CRUD used by PatientForm.tsx.
   Registration here goes through the Application-layer
   PatientRegistrationService: identity, replay, candidate review and
   audit are decided server-side. The client sends a well-formed command
   and round-trips the fingerprints it gets back.
   ══════════════════════════════════════════════════════════════ */

import axios from 'axios';
import client from './client';

/* ── Options ── */

export interface RegistrationOption {
  code: string;
  displayValue: string;
}

export interface PatientRegistrationOptions {
  titlesBeforeName: RegistrationOption[];
  titlesAfterName: RegistrationOption[];
  insuranceRegistrationKinds: RegistrationOption[];
  czechHealthInsurers: RegistrationOption[];
  identityDocumentTypes: RegistrationOption[];
  phoneRegions: RegistrationOption[];
}

/* ── Address (RÚIAN) ── */

export interface AddressLocality {
  streetCode: number | null;
  streetName: string | null;
  municipalityPartCode: number;
  municipalityPartName: string;
  municipalityCode: number;
  municipalityName: string;
  displayValue: string;
}

export interface AddressDatasetStatus {
  loaded: boolean;
  addressPointCount: number;
  datasetDate?: string;
}

export interface AddressPoint {
  addressPointCode: number;
  formattedAddress: string;
  municipalityCode: number;
  municipalityName: string;
  municipalityPartCode: number;
  municipalityPartName: string;
  streetCode: number | null;
  streetName: string | null;
  buildingNumberType: string;
  buildingNumber: number;
  orientationNumber: number | null;
  orientationNumberSuffix: string | null;
  postalCode: string;
}

/* ── Command ── */

export type RegistrationMode = 'Standard' | 'Quick';

export type RegistrationSource =
  | 'ClinicOperator'
  | 'PatientOnlineQuestionnaire'
  | 'LegalRepresentativeOnlineQuestionnaire';

export type ResidenceType = 'PermanentResidenceInCzechia' | 'ReportedResidenceInCzechia';

export type InsuranceRegistrationKind =
  | 'CzechPublicHealthInsurance'
  | 'NoCzechHealthInsuranceNumber';

export type SexValue = 'Male' | 'Female' | 'NotSpecified' | 'Unknown';

export interface ContactRequest {
  contactPointId: string;
  value: string;
  regionCode?: string | null;
}

export interface AddressRequest {
  patientAddressId: string;
  residenceType: ResidenceType;
  ruianAddressPointCode: number;
}

export interface AdministrativeProfileRequest {
  profileId: string;
  insuranceRegistrationKind: InsuranceRegistrationKind;
  birthNumber: string | null;
  healthInsuranceNumber: string | null;
  healthInsuranceNumberConfirmation: string | null;
  healthInsurerCode: string | null;
  insuranceEvidenceSource: string | null;
  identityDocumentType: string | null;
  identityDocumentIssuingCountryCode: string | null;
  identityDocumentNumber: string | null;
}

export interface RegistrationCandidate {
  patientId: string;
  fullName?: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  dateOfBirth: string;
  sex: string;
  status: string;
  revision: number;
  governedFactsFingerprint: string;
}

export interface RegistrationConfirmation {
  registrationFingerprint: string;
  authorizationScopeFingerprint: string;
  candidateSetFingerprint: string;
  candidates: RegistrationCandidate[];
}

export interface RegisterPatientRequest {
  patientId: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  titlesBeforeName: string[];
  titlesAfterName: string[];
  /** ISO yyyy-MM-dd. */
  dateOfBirth: string;
  sex: SexValue;
  mode: RegistrationMode;
  source: RegistrationSource;
  email: ContactRequest;
  phone: ContactRequest;
  address: AddressRequest;
  administrativeProfile: AdministrativeProfileRequest;
  confirmation?: RegistrationConfirmation | null;
}

/* ── Result ── */

export type RegistrationOutcome = 'Created' | 'Existing' | 'CandidateReviewRequired';

export interface PatientRegistrationResult {
  outcome: RegistrationOutcome;
  patientId: string;
  registrationFingerprint: string;
  authorizationScopeFingerprint: string | null;
  candidateSetFingerprint: string | null;
  candidates: RegistrationCandidate[];
}

export interface PatientSearchResult {
  patientId: string;
  fullName: string;
  dateOfBirth: string;
  sex: string;
  status: string;
  revision: number;
}

/* ── Errors ── */

/**
 * The registry answers failures as ApiProblemResponse. Its `errors` map
 * carries the Domain violation parameters, so the offending field arrives
 * as `errors.field[0]` rather than as a key of its own.
 */
export class PatientRegistryError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field: string | null;
  readonly traceId: string | null;

  constructor(
    message: string,
    status: number,
    code: string,
    field: string | null,
    traceId: string | null,
  ) {
    super(message);
    this.name = 'PatientRegistryError';
    this.status = status;
    this.code = code;
    this.field = field;
    this.traceId = traceId;
  }
}

function toRegistryError(error: unknown): PatientRegistryError {
  if (!axios.isAxiosError(error)) {
    return new PatientRegistryError('Neočekávaná chyba.', 0, 'client.unexpected', null, null);
  }

  const status = error.response?.status ?? 0;

  if (status === 0) {
    return new PatientRegistryError(
      'Nepodařilo se spojit se serverem. Zkontrolujte připojení.',
      status,
      'client.network',
      null,
      null,
    );
  }

  const payload = error.response?.data as
    | { code?: string; message?: string; errors?: Record<string, string[]>; traceId?: string }
    | undefined;

  return new PatientRegistryError(
    payload?.message ?? 'Požadavek se nezdařil.',
    status,
    payload?.code ?? 'http.' + String(status),
    payload?.errors?.field?.[0] ?? null,
    payload?.traceId ?? null,
  );
}

/* ── Calls ── */

export const patientRegistryApi = {
  async getOptions(): Promise<PatientRegistrationOptions> {
    try {
      const response = await client.get<PatientRegistrationOptions>(
        '/api/v1/patient-registration/options',
      );
      return response.data;
    } catch (error) {
      throw toRegistryError(error);
    }
  },

  /**
   * Whether the RÚIAN dataset is actually imported. Registration cannot be
   * completed without an address-point code, so an empty catalogue has to be
   * said out loud rather than shown as "nic nenalezeno".
   */
  async getAddressDatasetStatus(): Promise<AddressDatasetStatus> {
    try {
      const response = await client.get<AddressDatasetStatus>('/api/address-lookup/status');
      return response.data;
    } catch (error) {
      throw toRegistryError(error);
    }
  },

  async searchLocalities(query: string, maximumResults = 20): Promise<AddressLocality[]> {
    try {
      const response = await client.get<AddressLocality[]>('/api/v1/addresses/localities', {
        params: { query, maximumResults },
      });
      return response.data ?? [];
    } catch (error) {
      throw toRegistryError(error);
    }
  },

  async searchAddressPoints(criteria: {
    streetCode: number | null;
    municipalityPartCode: number;
    number: string;
    maximumResults?: number;
  }): Promise<AddressPoint[]> {
    try {
      const response = await client.get<AddressPoint[]>('/api/v1/addresses/points', {
        params: {
          streetCode: criteria.streetCode ?? undefined,
          municipalityPartCode: criteria.municipalityPartCode,
          number: criteria.number,
          maximumResults: criteria.maximumResults ?? 20,
        },
      });
      return response.data ?? [];
    } catch (error) {
      throw toRegistryError(error);
    }
  },

  async searchPatients(criteria: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    status?: string;
    maximumResults?: number;
  }): Promise<PatientSearchResult[]> {
    try {
      const response = await client.get<PatientSearchResult[]>('/api/v1/patients', {
        params: {
          firstName: criteria.firstName || undefined,
          lastName: criteria.lastName || undefined,
          dateOfBirth: criteria.dateOfBirth || undefined,
          status: criteria.status || undefined,
          maximumResults: criteria.maximumResults ?? 20,
        },
      });
      return response.data ?? [];
    } catch (error) {
      throw toRegistryError(error);
    }
  },

  async register(request: RegisterPatientRequest): Promise<PatientRegistrationResult> {
    try {
      const response = await client.post<PatientRegistrationResult>('/api/v1/patients', request);
      return response.data;
    } catch (error) {
      throw toRegistryError(error);
    }
  },
};

export default patientRegistryApi;
