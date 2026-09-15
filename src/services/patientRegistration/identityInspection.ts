/*
 * What a birth number or an insurance number says about the person, checked
 * against what the operator typed, while they are still looking at both.
 *
 * The form already derives a date and a sex from an identifier it can parse -
 * that is how they get filled in. What it could not do until now is say
 * anything useful when the two DISAGREE: the operator types a date, types a
 * number that decodes to another date, and learns about it as one refusal
 * after the save, naming neither value.
 *
 * `POST /api/v1/patients/identity/inspect` answers with both halves, so the
 * disagreement can be shown at the field with both dates in it. Nothing is
 * written; it is gated on the same permission as registration.
 *
 * WHAT THIS MODULE REFUSES TO DO
 *
 * It never overwrites what somebody typed. An identifier that disagrees with a
 * hand-typed date is a question - a mistyped digit, or a date from a passport
 * that the number contradicts - and answering it by silently replacing one of
 * them is how a patient ends up with a birthday nobody chose. The form fills
 * an EMPTY field from an identifier; a full one it only queries.
 */
import type { IdentityInspection } from '../../api/patientRegistry';

export type InspectionVerdict =
  /** Nothing to say: no identifier, or nothing typed to compare against. */
  | 'silent'
  /** The identifier decodes and agrees with everything stated. */
  | 'agrees'
  /** It decodes, and contradicts the date, the sex, or both. */
  | 'disagrees'
  /** It does not decode at all. */
  | 'unreadable';

export interface StatedFacts {
  dateOfBirth: string;
  sex: string;
}

export function verdictOf(
  inspection: IdentityInspection | null,
  stated: StatedFacts,
): InspectionVerdict {
  if (inspection === null) return 'silent';
  if (!inspection.parses) return 'unreadable';

  /*
   * `null` means nothing was stated to compare against - deliberately not read
   * as agreement. An empty date field is not a matching date field.
   */
  const dateDisagrees =
    stated.dateOfBirth !== '' && inspection.dateOfBirthMatchesStated === false;
  const sexDisagrees = stated.sex !== '' && inspection.sexMatchesStated === false;

  if (dateDisagrees || sexDisagrees) return 'disagrees';
  return 'agrees';
}

/** "1. 4. 1987" from "1987-04-01"; the identifier's own reading, to show beside the typed one. */
export function readableDate(iso: string | null): string {
  if (iso === null || iso === '') return '—';
  const [y, m, d] = iso.split('-');
  return `${Number(d)}. ${Number(m)}. ${y}`;
}

export function readableSex(sex: string | null): string {
  if (sex === 'Male') return 'muž';
  if (sex === 'Female') return 'žena';
  return '—';
}

/**
 * The sentence for a disagreement - with BOTH values in it.
 *
 * "Rodné číslo neodpovídá datu narození" tells somebody that two things they
 * can see disagree, which they could have worked out. Which one is wrong is
 * the question, and it cannot be answered without showing both.
 */
export function disagreementText(
  inspection: IdentityInspection,
  stated: StatedFacts,
): string {
  const parts: string[] = [];

  if (stated.dateOfBirth !== '' && inspection.dateOfBirthMatchesStated === false) {
    parts.push(
      `datum narození ${readableDate(inspection.dateOfBirth)}, `
      + `vy máte ${readableDate(stated.dateOfBirth)}`,
    );
  }

  if (stated.sex !== '' && inspection.sexMatchesStated === false) {
    parts.push(
      `pohlaví ${readableSex(inspection.sex)}, vy máte ${readableSex(stated.sex)}`,
    );
  }

  if (parts.length === 0) return '';
  return `Číslo říká ${parts.join(' a ')}. Opravte to, co je špatně — server to jinak odmítne.`;
}

/** What the identifier turned out to be, when it reads. */
export function kindText(kind: string | null): string {
  if (kind === 'CzechBirthNumber') return 'rodné číslo';
  if (kind === 'InsuranceEvidenceNumber') return 'evidenční číslo pojišťovny';
  if (kind === 'InsurerAssignedNumber') return 'číslo přidělené pojišťovnou';
  return 'číslo pojištěnce';
}

export const AGREES_TEXT = 'Číslo sedí s datem narození i pohlavím.';

/**
 * Whether an identifier is worth asking the server about at all.
 *
 * Nine digits is the shortest thing that can decode, so anything shorter is
 * somebody mid-typing and asking about it would light the field red while they
 * are still holding the card.
 */
export function worthInspecting(identifierDigits: string): boolean {
  return identifierDigits.length >= 9;
}
