/*
 * The desk's quick path, as rules with no screen around them.
 *
 * Exactly the facts the owner named: jméno, příjmení, e-mail, telefon
 * volitelně — plus datum narození, which the registry cannot do without (the
 * minor-consent rule and the calendar read it, and the record refuses to
 * exist without one). Nothing here is a second copy of a server rule: the
 * server validates the e-mail and the telephone properly and refuses what
 * it cannot use; this only stops an empty box being sent.
 */

export interface QuickPreRegistrationDraft {
  firstName: string;
  lastName: string;
  /** ISO yyyy-MM-dd. */
  dateOfBirth: string;
  email: string;
  phone: string;
}

export type QuickField = keyof QuickPreRegistrationDraft;

export const EMPTY_QUICK_DRAFT: QuickPreRegistrationDraft = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  email: '',
  phone: '',
};

/**
 * A first guess at the name from what was typed into the search box, so the
 * desk does not type "Jan Novák" twice. Two words: first and last; one word:
 * the surname, because that is what the desk searches by.
 */
export function guessNameFromSearch(typed: string): Pick<QuickPreRegistrationDraft, 'firstName' | 'lastName'> {
  const words = typed.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: '', lastName: '' };
  if (words.length === 1) return { firstName: '', lastName: words[0] };
  return { firstName: words[0], lastName: words.slice(1).join(' ') };
}

/** What is missing or plainly wrong, per field, in Czech. Empty when nothing is. */
export function validateQuickDraft(
  draft: QuickPreRegistrationDraft,
  today: string,
): Partial<Record<QuickField, string>> {
  const errors: Partial<Record<QuickField, string>> = {};

  if (draft.firstName.trim() === '') errors.firstName = 'Zadejte jméno.';
  if (draft.lastName.trim() === '') errors.lastName = 'Zadejte příjmení.';

  if (draft.dateOfBirth.trim() === '') {
    errors.dateOfBirth = 'Zadejte datum narození — bez něj nelze pacienta založit.';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dateOfBirth)) {
    errors.dateOfBirth = 'Datum narození není ve správném tvaru.';
  } else if (draft.dateOfBirth > today) {
    errors.dateOfBirth = 'Datum narození nemůže být v budoucnosti.';
  }

  const email = draft.email.trim();
  if (email === '') {
    errors.email = 'Zadejte e-mail — na něj pošleme odkaz k dokončení registrace.';
  } else if (!email.includes('@') || email.startsWith('@') || email.endsWith('@')) {
    errors.email = 'E-mail musí obsahovat @ a doménu.';
  }

  return errors;
}

/** How the candidates a review returns are said to the desk. */
export function candidateLine(candidate: { fullName?: string; firstName: string; lastName: string; dateOfBirth: string }, formatDate: (iso: string) => string): string {
  const name = candidate.fullName?.trim() || `${candidate.firstName} ${candidate.lastName}`.trim();
  return `${name} · nar. ${formatDate(candidate.dateOfBirth)}`;
}
