/* ══════════════════════════════════════════════════════════════
   CLIENT-SIDE MIRROR OF THE REGISTRATION RULES

   The Domain is the validation authority — nothing here is a second
   copy of a rule that decides anything. These checks exist only so the
   operator sees the problem next to the field instead of after a round
   trip; every rule below has its counterpart in
   Domain/Patients/PatientAdministrativeProfile.cs and
   Domain/Patients/CzechBirthNumber.cs, and the server still refuses
   whatever this file lets through.
   ══════════════════════════════════════════════════════════════ */

import { classifyInsuranceNumber, parseBirthNumber } from './insuranceIdentifier';
import type { InsuranceRegistrationKind, SexValue } from '../../api/patientRegistry';

export const NAME_MAX_LENGTH = 100; // PatientConstraints.NameMaxLength

export interface RegistrationFormState {
  /* Identity */
  firstName: string;
  lastName: string;
  preferredName: string;
  titlesBeforeName: string[];
  titlesAfterName: string[];
  dateOfBirth: string;
  sex: SexValue | '';

  /* Insurance branch */
  insuranceRegistrationKind: InsuranceRegistrationKind;
  birthNumber: string;
  healthInsuranceNumber: string;
  healthInsuranceNumberConfirmation: string;
  healthInsurerCode: string;
  insuranceCardInspected: boolean;
  identityDocumentType: string;
  identityDocumentIssuingCountryCode: string;
  identityDocumentNumber: string;

  /* Residence */
  residenceType: 'PermanentResidenceInCzechia' | 'ReportedResidenceInCzechia';
  ruianAddressPointCode: number | null;
  addressDisplay: string;

  /* Contact */
  email: string;
  phone: string;
  phoneRegionCode: string;

  /* Registration metadata */
  mode: 'Standard' | 'Quick';
}

export type FieldErrors = Partial<Record<keyof RegistrationFormState, string>>;

export const REGISTRATION_STEPS = ['Totožnost', 'Pojištění', 'Bydliště', 'Kontakt', 'Shrnutí'] as const;

export type RegistrationStep = 0 | 1 | 2 | 3 | 4;

/** Digits only — what the Domain canonicalises to. */
export function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

/**
 * True when a health-insurance number is itself a birth number. The Domain
 * then demands the stored birth number be that same value
 * (BirthNumberInsuranceNumberMismatch), so the form fills it in.
 */
export function isBirthNumberShaped(insuranceNumber: string): boolean {
  return classifyInsuranceNumber(insuranceNumber).kind === 'CzechBirthNumber';
}

/** Only an insurer-assigned number nobody can decode is typed twice. */
export function requiresInsuranceConfirmation(insuranceNumber: string): boolean {
  return classifyInsuranceNumber(insuranceNumber).requiresConfirmation;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function isPhone(value: string): boolean {
  const compact = value.replace(/[\s()-]/g, '');
  return /^\+?[0-9]{6,15}$/.test(compact);
}

function validateIdentity(form: RegistrationFormState, errors: FieldErrors): void {
  if (form.firstName.trim().length === 0) {
    errors.firstName = 'Jméno je povinné.';
  } else if (form.firstName.trim().length > NAME_MAX_LENGTH) {
    errors.firstName = `Jméno může mít nejvýše ${NAME_MAX_LENGTH} znaků.`;
  }

  if (form.lastName.trim().length === 0) {
    errors.lastName = 'Příjmení je povinné.';
  } else if (form.lastName.trim().length > NAME_MAX_LENGTH) {
    errors.lastName = `Příjmení může mít nejvýše ${NAME_MAX_LENGTH} znaků.`;
  }

  if (form.preferredName.trim().length > NAME_MAX_LENGTH) {
    errors.preferredName = `Oslovení může mít nejvýše ${NAME_MAX_LENGTH} znaků.`;
  }

  if (form.dateOfBirth.length === 0) {
    errors.dateOfBirth = 'Datum narození je povinné.';
  } else if (form.dateOfBirth > new Date().toISOString().slice(0, 10)) {
    errors.dateOfBirth = 'Datum narození nemůže být v budoucnosti.';
  }

  // Registration accepts male or female only — PatientRegistrationService
  // refuses anything else once nothing could be derived from the identifier.
  if (form.sex !== 'Male' && form.sex !== 'Female') {
    errors.sex = 'Vyberte pohlaví (muž nebo žena).';
  }
}

function validateInsurance(form: RegistrationFormState, errors: FieldErrors): void {
  if (form.insuranceRegistrationKind === 'CzechPublicHealthInsurance') {
    const insuranceNumber = digitsOnly(form.healthInsuranceNumber);

    if (insuranceNumber.length === 0) {
      errors.healthInsuranceNumber = 'Číslo pojištěnce je povinné.';
    } else if (insuranceNumber.length !== 9 && insuranceNumber.length !== 10) {
      errors.healthInsuranceNumber = 'Číslo pojištěnce má devět nebo deset číslic.';
    }

    // The registry demands the second entry only for an insurer-assigned
    // number, whose shape it cannot check against anything else.
    if (requiresInsuranceConfirmation(insuranceNumber)) {
      if (digitsOnly(form.healthInsuranceNumberConfirmation).length === 0) {
        errors.healthInsuranceNumberConfirmation = 'Zadejte číslo pojištěnce ještě jednou.';
      } else if (digitsOnly(form.healthInsuranceNumberConfirmation) !== insuranceNumber) {
        errors.healthInsuranceNumberConfirmation = 'Obě zadání se neshodují.';
      }
    }

    if (form.healthInsurerCode.length === 0) {
      errors.healthInsurerCode = 'Zdravotní pojišťovna je povinná.';
    }

    const birthNumber = digitsOnly(form.birthNumber);

    if (birthNumber.length > 0) {
      const parsed = parseBirthNumber(birthNumber);
      if (parsed === null) {
        errors.birthNumber = 'Rodné číslo není platné.';
      } else if (form.dateOfBirth.length > 0 && parsed.dateOfBirth !== form.dateOfBirth) {
        errors.birthNumber = 'Rodné číslo neodpovídá datu narození.';
      } else if (form.sex !== '' && parsed.sex !== form.sex) {
        errors.birthNumber = 'Rodné číslo neodpovídá pohlaví.';
      }
    }

    if (isBirthNumberShaped(insuranceNumber) && birthNumber !== insuranceNumber) {
      errors.birthNumber = 'Číslo pojištěnce má tvar rodného čísla — rodné číslo musí být stejné.';
    }

    return;
  }

  if (form.identityDocumentType.length === 0) {
    errors.identityDocumentType = 'Typ dokladu je povinný.';
  }

  const country = form.identityDocumentIssuingCountryCode.trim().toUpperCase();
  if (country.length === 0) {
    errors.identityDocumentIssuingCountryCode = 'Stát vydání je povinný.';
  } else if (!/^[A-Z]{2}$/.test(country)) {
    errors.identityDocumentIssuingCountryCode = 'Zadejte dvoupísmenný kód státu (ISO 3166-1, např. SK).';
  }

  if (form.identityDocumentNumber.trim().length === 0) {
    errors.identityDocumentNumber = 'Číslo dokladu je povinné.';
  }
}

function validateResidence(form: RegistrationFormState, errors: FieldErrors): void {
  if (form.ruianAddressPointCode === null || form.ruianAddressPointCode <= 0) {
    errors.ruianAddressPointCode = 'Vyberte adresu z registru RÚIAN.';
  }
}

function validateContact(form: RegistrationFormState, errors: FieldErrors): void {
  if (form.email.trim().length === 0) {
    errors.email = 'E-mail je povinný.';
  } else if (!isEmail(form.email)) {
    errors.email = 'E-mail není ve správném tvaru.';
  }

  if (form.phone.trim().length === 0) {
    errors.phone = 'Telefon je povinný.';
  } else if (!isPhone(form.phone)) {
    errors.phone = 'Telefon není ve správném tvaru.';
  }

  if (form.phoneRegionCode.length === 0) {
    errors.phoneRegionCode = 'Vyberte zemi telefonního čísla.';
  }
}

/** Validates one step of the wizard. */
export function validateStep(step: RegistrationStep, form: RegistrationFormState): FieldErrors {
  const errors: FieldErrors = {};

  if (step === 0) validateIdentity(form, errors);
  if (step === 1) validateInsurance(form, errors);
  if (step === 2) validateResidence(form, errors);
  if (step === 3) validateContact(form, errors);

  return errors;
}

/** Validates everything — the gate in front of the POST. */
export function validateAll(form: RegistrationFormState): FieldErrors {
  const errors: FieldErrors = {};

  validateIdentity(form, errors);
  validateInsurance(form, errors);
  validateResidence(form, errors);
  validateContact(form, errors);

  return errors;
}

export function createEmptyForm(): RegistrationFormState {
  return {
    firstName: '',
    lastName: '',
    preferredName: '',
    titlesBeforeName: [],
    titlesAfterName: [],
    dateOfBirth: '',
    sex: '',
    insuranceRegistrationKind: 'CzechPublicHealthInsurance',
    birthNumber: '',
    healthInsuranceNumber: '',
    healthInsuranceNumberConfirmation: '',
    healthInsurerCode: '',
    insuranceCardInspected: false,
    identityDocumentType: '',
    identityDocumentIssuingCountryCode: '',
    identityDocumentNumber: '',
    residenceType: 'PermanentResidenceInCzechia',
    ruianAddressPointCode: null,
    addressDisplay: '',
    email: '',
    phone: '',
    phoneRegionCode: 'CZ',
    mode: 'Standard',
  };
}
