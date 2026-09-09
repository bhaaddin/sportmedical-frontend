/* ══════════════════════════════════════════════════════════════
   SERVER FAILURE → FORM

   The registry answers failures as a stable error code plus the
   Domain violation's `field` parameter; it deliberately sends no
   localized message worth showing. This module is the only place that
   turns those codes into Czech text and points them at a field.

   A code that is missing here still surfaces — as the generic banner
   message with its code attached — so an unmapped rule is visible
   rather than silently swallowed.
   ══════════════════════════════════════════════════════════════ */

import { PatientRegistryError } from '../../api/patientRegistry';
import type { RegistrationFormState } from './validation';

type FormField = keyof RegistrationFormState;

/** Domain `field` parameter → the control the operator can actually fix. */
const FIELD_BY_DOMAIN_NAME: Record<string, FormField> = {
  firstName: 'firstName',
  lastName: 'lastName',
  preferredName: 'preferredName',
  dateOfBirth: 'dateOfBirth',
  sex: 'sex',
  birthNumber: 'birthNumber',
  healthInsuranceNumber: 'healthInsuranceNumber',
  healthInsuranceNumberConfirmation: 'healthInsuranceNumberConfirmation',
  healthInsurerCode: 'healthInsurerCode',
  insuranceEvidenceSource: 'insuranceCardInspected',
  insuranceRegistrationKind: 'insuranceRegistrationKind',
  insuranceIdentifierKind: 'healthInsuranceNumber',
  identityDocument: 'identityDocumentType',
  identityDocumentType: 'identityDocumentType',
  identityDocumentIssuingCountryCode: 'identityDocumentIssuingCountryCode',
  identityDocumentNumber: 'identityDocumentNumber',
  ruianAddressPointCode: 'ruianAddressPointCode',
  email: 'email',
  phone: 'phone',
  regionCode: 'phoneRegionCode',
};

const MESSAGE_BY_CODE: Record<string, string> = {
  /* Patient */
  'patients.first_name.required': 'Jméno je povinné.',
  'patients.first_name.too_long': 'Jméno je příliš dlouhé.',
  'patients.first_name.invalid_characters': 'Jméno obsahuje nepovolené znaky.',
  'patients.last_name.required': 'Příjmení je povinné.',
  'patients.last_name.too_long': 'Příjmení je příliš dlouhé.',
  'patients.last_name.invalid_characters': 'Příjmení obsahuje nepovolené znaky.',
  'patients.preferred_name.too_long': 'Oslovení je příliš dlouhé.',
  'patients.preferred_name.invalid_characters': 'Oslovení obsahuje nepovolené znaky.',
  'patients.date_of_birth.required': 'Datum narození je povinné.',
  'patients.date_of_birth.in_future': 'Datum narození nemůže být v budoucnosti.',
  'patients.date_of_birth.after_registration': 'Datum narození je pozdější než datum registrace.',
  'patients.sex.invalid': 'Vyberte pohlaví.',
  'patients.title.unsupported': 'Zvolený titul není podporován.',
  'patients.title.placement_invalid': 'Titul je zařazen na nesprávnou stranu jména.',
  'patients.title.duplicate': 'Stejný titul je zadán dvakrát.',
  'patients.title.count_exceeded': 'Je zadáno příliš mnoho titulů.',
  'patients.title.academic_rank_combination_invalid': 'Tato kombinace titulů není přípustná.',

  /* Administrative profile — birth number */
  'patients.administrative_profile.birth_number_required': 'Rodné číslo je povinné.',
  'patients.administrative_profile.birth_number_format_invalid':
    'Rodné číslo musí mít devět nebo deset číslic.',
  'patients.administrative_profile.birth_number_date_invalid':
    'Rodné číslo obsahuje neplatné datum.',
  'patients.administrative_profile.birth_number_checksum_invalid':
    'Rodné číslo neprošlo kontrolním součtem.',
  'patients.administrative_profile.birth_number_demographics_mismatch':
    'Rodné číslo neodpovídá datu narození nebo pohlaví.',
  'patients.administrative_profile.birth_number_insurance_number_mismatch':
    'Číslo pojištěnce má tvar rodného čísla — obě hodnoty se musí shodovat.',

  /* Administrative profile — insurance */
  'patients.administrative_profile.health_insurance_number_required':
    'Číslo pojištěnce je povinné.',
  'patients.administrative_profile.health_insurance_number_format_invalid':
    'Číslo pojištěnce musí mít devět nebo deset číslic.',
  'patients.administrative_profile.health_insurance_number_confirmation_required':
    'Zadejte číslo pojištěnce ještě jednou.',
  'patients.administrative_profile.health_insurance_number_confirmation_mismatch':
    'Obě zadání čísla pojištěnce se neshodují.',
  'patients.administrative_profile.health_insurer_code_invalid':
    'Vyberte zdravotní pojišťovnu.',
  'patients.administrative_profile.insurance_evidence_source_invalid':
    'Neplatný zdroj ověření pojištění.',
  'patients.administrative_profile.insurance_registration_kind_invalid':
    'Neplatný způsob evidence pojištění.',
  'patients.administrative_profile.insurance_identifier_kind_invalid':
    'Číslo pojištěnce neodpovídá žádnému uznávanému tvaru.',
  'patients.administrative_profile.insurance_identifier_demographics_mismatch':
    'Číslo pojištěnce neodpovídá datu narození nebo pohlaví pacienta.',
  'patients.administrative_profile.insurance_facts_forbidden':
    'Bez českého pojištění nelze evidovat rodné číslo ani číslo pojištěnce.',

  /* Administrative profile — identity document */
  'patients.administrative_profile.identity_document_required':
    'Doklad totožnosti je povinný.',
  'patients.administrative_profile.identity_document_forbidden':
    'U českého pojištění se doklad totožnosti neeviduje.',
  'patients.administrative_profile.identity_document_type_invalid':
    'Neplatný typ dokladu.',
  'patients.administrative_profile.identity_document_country_invalid':
    'Neplatný kód státu vydání (ISO 3166-1, dvě písmena).',
  'patients.administrative_profile.identity_document_number_invalid':
    'Neplatné číslo dokladu.',

  /* Contacts */
  'patients.contact_address.email.invalid': 'E-mail není ve správném tvaru.',
  'patients.contact_address.email.local_part.too_long': 'E-mail je příliš dlouhý.',
  'patients.contact_address.phone.invalid': 'Telefonní číslo není ve správném tvaru.',
  'patients.contact_address.phone.region.required': 'Vyberte zemi telefonního čísla.',
  'patients.contact_address.region_code.invalid': 'Neplatný kód země telefonního čísla.',
  'patients.contact_address.display_value.required': 'Kontakt je povinný.',
  'patients.contact_address.display_value.too_long': 'Kontakt je příliš dlouhý.',
  'patients.contact_address.display_value.invalid_characters':
    'Kontakt obsahuje nepovolené znaky.',

  /* Address catalogue */
  'patients.registration.residence_address_not_found':
    'Zvolená adresa už v registru RÚIAN není. Vyberte ji prosím znovu.',
  'patients.address_catalog.query_required': 'Zadejte hledaný text.',
  'patients.address_catalog.query_too_long': 'Hledaný text je příliš dlouhý.',
  'patients.address_catalog.street_code_required': 'Vyberte ulici.',

  /* Registration pipeline */
  'patients.registration.access_denied': 'Účet nemá oprávnění registrovat pacienty.',
  'patients.registration.authorization_drift':
    'Oprávnění se během registrace změnilo. Přihlaste se znovu a opakujte akci.',
  'patients.registration.existing_patient_conflict':
    'Pacient s tímto identifikátorem už existuje s jinými údaji. Začněte registraci znovu.',
  'patients.registration.receipt_conflict':
    'Tento požadavek už byl zpracován s jinými údaji. Začněte registraci znovu.',
  'patients.registration.candidate_review_stale':
    'Seznam možných shod se mezitím změnil. Zkontrolujte ho prosím znovu.',
  'patients.registration.candidate_review_unexpected':
    'Potvrzení shod už není platné. Odešlete registraci znovu.',
  'patients.registration.concurrency_conflict':
    'Údaje se souběžně změnily. Zkuste registraci odeslat znovu.',

  /* Transport */
  // The registry answers a malformed command from the model binder, before its
  // own error codes exist — a stale fingerprint arrives this way.
  'request.invalid': 'Údaje požadavku už nejsou platné. Načtěte formulář znovu a odešlete ho.',
  'server.error': 'Požadavek se nepodařilo bezpečně dokončit. Zkuste to prosím znovu.',
  'client.network': 'Nepodařilo se spojit se serverem. Zkontrolujte připojení.',
  'http.403': 'Účet nemá oprávnění registrovat pacienty.',
  'http.409': 'Údaje se souběžně změnily. Zkuste registraci odeslat znovu.',
};

export interface ResolvedRegistrationError {
  /** Banner text. */
  message: string;
  /** Field to mark, when the failure names one. */
  field: FormField | null;
  /** Wizard step to jump back to, when the field belongs to one. */
  step: number | null;
  /** True when re-sending the very same command cannot help. */
  requiresRestart: boolean;
  code: string;
  traceId: string | null;
}

const STEP_BY_FIELD: Partial<Record<FormField, number>> = {
  firstName: 0,
  lastName: 0,
  preferredName: 0,
  titlesBeforeName: 0,
  titlesAfterName: 0,
  dateOfBirth: 0,
  sex: 0,
  insuranceRegistrationKind: 1,
  birthNumber: 1,
  healthInsuranceNumber: 1,
  healthInsuranceNumberConfirmation: 1,
  healthInsurerCode: 1,
  insuranceCardInspected: 1,
  identityDocumentType: 1,
  identityDocumentIssuingCountryCode: 1,
  identityDocumentNumber: 1,
  residenceType: 2,
  ruianAddressPointCode: 2,
  email: 3,
  phone: 3,
  phoneRegionCode: 3,
};

const RESTART_CODES = new Set([
  'patients.registration.existing_patient_conflict',
  'patients.registration.receipt_conflict',
]);

export function resolveRegistrationError(error: unknown): ResolvedRegistrationError {
  if (!(error instanceof PatientRegistryError)) {
    return {
      message: 'Registraci se nepodařilo odeslat. Zkuste to prosím znovu.',
      field: null,
      step: null,
      requiresRestart: false,
      code: 'client.unexpected',
      traceId: null,
    };
  }

  const field = error.field === null ? null : (FIELD_BY_DOMAIN_NAME[error.field] ?? null);
  const mapped = MESSAGE_BY_CODE[error.code];

  return {
    message: mapped ?? `${error.message} (${error.code})`,
    field,
    step: field === null ? null : (STEP_BY_FIELD[field] ?? null),
    requiresRestart: RESTART_CODES.has(error.code),
    code: error.code,
    traceId: error.traceId,
  };
}
