/* ══════════════════════════════════════════════════════════════
   INSURANCE-IDENTIFIER CLASSIFICATION (client mirror)

   The registry classifies a Czech health-insurance number into one of
   three kinds and behaves differently for each — so the form has to
   know the same three, or it asks for the wrong things:

     • birth number (RČ)      → date of birth and sex are derived, and
                                the stored birth number IS this value
     • evidence number (EČP)  → date of birth and sex are derived
                                (+40 day offset), birth number stays empty
     • insurer-assigned       → nothing is derivable, so the operator
                                types the number a second time

   Mirrors Domain/Patients/CzechBirthNumber.cs,
   CzechEvidenceInsuranceNumber.cs and
   CzechHealthInsuranceIdentifierClassification.cs. The server still
   decides; this only shapes what the form asks for.
   ══════════════════════════════════════════════════════════════ */

export type InsuranceIdentifierKind =
  | 'CzechBirthNumber'
  | 'CzechEvidenceNumber'
  | 'InsurerAssigned'
  | 'Unknown';

export interface IdentifierClassification {
  kind: InsuranceIdentifierKind;
  /** ISO yyyy-MM-dd, when the identifier encodes one. */
  dateOfBirth: string | null;
  sex: 'Male' | 'Female' | null;
  /** Only an unrecognized number is typed twice. */
  requiresConfirmation: boolean;
}

const UNKNOWN: IdentifierClassification = {
  kind: 'Unknown',
  dateOfBirth: null,
  sex: null,
  requiresConfirmation: false,
};

function twoDigits(value: string, index: number): number {
  return Number(value.slice(index, index + 2));
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function resolveYear(yearPart: number, length: number): number {
  if (length === 9) return yearPart > 53 ? 1800 + yearPart : 1900 + yearPart;
  return yearPart > 53 ? 1900 + yearPart : 2000 + yearPart;
}

/** CzechBirthNumber.DecodeMonth — the ±20 / ±50 / ±70 encodings. */
function decodeBirthNumberMonth(encoded: number): { month: number; sex: 'Male' | 'Female' } | null {
  if (encoded >= 1 && encoded <= 12) return { month: encoded, sex: 'Male' };
  if (encoded >= 21 && encoded <= 32) return { month: encoded - 20, sex: 'Male' };
  if (encoded >= 51 && encoded <= 62) return { month: encoded - 50, sex: 'Female' };
  if (encoded >= 71 && encoded <= 82) return { month: encoded - 70, sex: 'Female' };
  return null;
}

/** CzechEvidenceInsuranceNumber.TryDecodeMonth — no foreigner variants. */
function decodeEvidenceMonth(encoded: number): { month: number; sex: 'Male' | 'Female' } | null {
  if (encoded >= 1 && encoded <= 12) return { month: encoded, sex: 'Male' };
  if (encoded >= 51 && encoded <= 62) return { month: encoded - 50, sex: 'Female' };
  return null;
}

export interface ParsedIdentifier {
  dateOfBirth: string;
  sex: 'Male' | 'Female';
}

export function parseBirthNumber(digits: string): ParsedIdentifier | null {
  if (!/^[0-9]{9,10}$/.test(digits)) return null;

  const decoded = decodeBirthNumberMonth(twoDigits(digits, 2));
  if (decoded === null) return null;

  const dateOfBirth = toIsoDate(
    resolveYear(twoDigits(digits, 0), digits.length),
    decoded.month,
    twoDigits(digits, 4),
  );
  if (dateOfBirth === null) return null;

  if (digits.length === 9) {
    if (digits.slice(6) === '000') return null;
  } else if (Number(digits) % 11 !== 0) {
    return null;
  }

  return { dateOfBirth, sex: decoded.sex };
}

export function parseEvidenceNumber(digits: string): ParsedIdentifier | null {
  if (!/^[0-9]{9,10}$/.test(digits)) return null;

  const decoded = decodeEvidenceMonth(twoDigits(digits, 2));
  if (decoded === null) return null;

  const encodedDay = twoDigits(digits, 4);
  if (encodedDay < 41 || encodedDay > 71) return null;

  const dateOfBirth = toIsoDate(
    resolveYear(twoDigits(digits, 0), digits.length),
    decoded.month,
    encodedDay - 40,
  );
  if (dateOfBirth === null) return null;

  const suffix = Number(digits.slice(6));
  if (digits.length === 9 && suffix < 600) return null;
  if (digits.length === 10 && (suffix < 6000 || Number(digits) % 11 !== 0)) return null;

  return { dateOfBirth, sex: decoded.sex };
}

export function classifyInsuranceNumber(value: string): IdentifierClassification {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length !== 9 && digits.length !== 10) return UNKNOWN;

  const birthNumber = parseBirthNumber(digits);
  if (birthNumber !== null) {
    return {
      kind: 'CzechBirthNumber',
      dateOfBirth: birthNumber.dateOfBirth,
      sex: birthNumber.sex,
      requiresConfirmation: false,
    };
  }

  const evidenceNumber = parseEvidenceNumber(digits);
  if (evidenceNumber !== null) {
    return {
      kind: 'CzechEvidenceNumber',
      dateOfBirth: evidenceNumber.dateOfBirth,
      sex: evidenceNumber.sex,
      requiresConfirmation: false,
    };
  }

  return {
    kind: 'InsurerAssigned',
    dateOfBirth: null,
    sex: null,
    requiresConfirmation: true,
  };
}

export const IDENTIFIER_KIND_LABEL: Record<InsuranceIdentifierKind, string> = {
  CzechBirthNumber: 'rozpoznané jako rodné číslo',
  CzechEvidenceNumber: 'rozpoznané jako evidenční číslo pojištěnce',
  InsurerAssigned: 'číslo přidělené pojišťovnou',
  Unknown: '',
};
