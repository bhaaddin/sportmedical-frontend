// Czech birth-number (rodné číslo) display helper: YYMMDD/XXXX.
// The rule itself lives in the backend `CzechBirthNumber`; the forms mirror it
// in services/patientRegistration/insuranceIdentifier.ts and
// services/publicIntake/validation.ts.

export function formatRodneCislo(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 10);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}/${digits.slice(6)}`;
}
