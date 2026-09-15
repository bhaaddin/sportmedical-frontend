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

/* ── Identity inspection ── */

export interface InspectIdentityRequest {
  /** A birth number or an insurance number, digits or formatted. */
  identifier: string;
  /** What the operator has typed, so the server can say whether it agrees. */
  dateOfBirth?: string | null;
  sex?: string | null;
}

/**
 * What the identifier decodes to, and whether it matches what was typed.
 *
 * `dateOfBirthMatchesStated` and `sexMatchesStated` are null when nothing was
 * stated to compare against - which is not the same as "they agree", and the
 * screen must not read it that way.
 */
export interface IdentityInspection {
  parses: boolean;
  insuranceNumber: string | null;
  kind: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  rejectionCode: string | null;
  dateOfBirthMatchesStated: boolean | null;
  sexMatchesStated: boolean | null;
}

/* ── Telephone inspection ── */

export interface InspectPhoneRequest {
  /** Exactly what was typed. The server cleans it; doing that here too would
      make two places decide what a telephone number is. */
  value: string;
  regionCode: string;
}

/**
 * `parses` and `isValidForRegion` are different questions and the screen must
 * not merge them:
 *
 *   parses: false             this cannot be read as a number at all
 *   isValidForRegion: false   it can, but it is half-typed or belongs to
 *                             another country
 *
 * A half-typed number comes back GROUPED with `isValidForRegion: false`, so it
 * gets the grouping and not a red border — a red border on every second
 * keystroke teaches people to ignore red borders.
 */
/**
 * What the server makes of an e-mail address — measured, never guessed here.
 *
 * `canonical` is the key it matches on (`jan@xn--hkov-5nad81a.cz`);
 * `displayValue` is the address as a person reads it back. They differ for an
 * accented domain and for a domain typed in capitals, and the difference is
 * the server's to decide.
 *
 * An empty box comes back `parses: false` rather than a 400 — a field nobody
 * has typed into yet is not an error.
 */
export interface EmailInspection {
  parses: boolean;
  canonical: string;
  displayValue: string;
  /** `patients.contact_address.…`, or `null` when it is fine. */
  rejectionCode: string | null;
}

export interface InspectEmailRequest {
  value: string;
}

export interface PhoneInspection {
  parses: boolean;
  /** Valid anywhere, regardless of the region asked about. */
  isValid: boolean;
  isValidForRegion: boolean;
  e164: string;
  international: string;
  /** `777 777 777` — the country's own grouping, without its dialling code. */
  national: string;
  /** The region ASKED about — whatever was sent in the request. */
  regionCode: string;
  /**
   * The region the number itself belongs to.
   *
   * Measured: `+421 908 123 456` asked about as `CZ` comes back
   * `regionCode: 'CZ'`, `detectedRegionCode: 'SK'`, `isValidForRegion: false`.
   * For a stored number — which always carries its `+` — this is the country,
   * and it is the one a card must go by: `regionCode` there says only what the
   * screen happened to ask.
   */
  detectedRegionCode: string;
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

  /**
   * What an identifier says about the person, without writing anything.
   *
   * `POST /api/v1/patients/identity/inspect` takes a birth number or an
   * insurance number plus whatever the operator has typed, and answers with
   * what the identifier itself decodes to and whether it agrees. Nothing is
   * stored; it is gated on `patients.register` like the registration itself.
   *
   * It exists so a disagreement can be shown while somebody is still looking
   * at the two fields - "the number says 1987, you have 1978" - instead of
   * arriving as one refusal after the save, naming neither value.
   */
  async inspectIdentity(request: InspectIdentityRequest): Promise<IdentityInspection> {
    try {
      const response = await client.post<IdentityInspection>(
        '/api/v1/patients/identity/inspect',
        request,
      );
      return response.data;
    } catch (error) {
      throw toRegistryError(error);
    }
  },

  /**
   * What a telephone number looks like, grouped the way its country groups it.
   *
   * `POST /api/v1/patients/phone/inspect` — nothing is written, gated on
   * `patients.register` like the identity inspection. Send the raw input:
   * spaces, dashes, brackets and a `+420` are all fine, and cleaning it here
   * would make two places decide what a telephone number is.
   *
   * The grouping already existed on the server, for all 245 regions, on the
   * same libphonenumber that canonicalises a contact on save — but that only
   * happens at the save, and the field somebody is typing into has not been
   * saved. This is the same rule, reachable while they type.
   */
  /**
   * Whether an e-mail address is one, decided by the code that stores it.
   *
   * `POST /api/v1/patients/email/inspect` — writes nothing, gated on
   * `patients.register` like the other two inspections.
   *
   * This screen used to hold its own regular expression, and it was wrong in
   * BOTH directions against the server measured on 15. 9. 2026:
   *
   *   jan@localhost         the regex refused it; the server stores it
   *   jan@example..cz       the regex passed it; the server refuses it
   *
   * Sent exactly as typed. Trimming or lower-casing it here would make two
   * places decide what an address is, which is how those two rows happened.
   */
  async inspectEmail(request: InspectEmailRequest): Promise<EmailInspection> {
    try {
      const response = await client.post<EmailInspection>(
        '/api/v1/patients/email/inspect',
        request,
      );
      return response.data;
    } catch (error) {
      throw toRegistryError(error);
    }
  },

  async inspectPhone(request: InspectPhoneRequest): Promise<PhoneInspection> {
    try {
      const response = await client.post<PhoneInspection>(
        '/api/v1/patients/phone/inspect',
        request,
      );
      return response.data;
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
