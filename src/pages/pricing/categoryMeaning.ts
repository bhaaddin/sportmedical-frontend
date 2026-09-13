/*
 * What a price-list category means, beyond being a label.
 *
 * It used to be decoration - a colour on a card and a word in a table. Since
 * 13. 9. 2026 it decides something: `DocumentRequirementRule` hangs a required
 * document off a category, so a service filed under `Prohlídka` makes the
 * patient bring a výpis and one filed under `Měření` does not.
 *
 * The chain runs `termín → činnost → serviceItemId → služba → kategorie`, and
 * the last link is this word. The field that holds it is free text.
 *
 * That is the hazard this file exists for. The server matches the rule's
 * category against the service's own text with `OrdinalIgnoreCase` and nothing
 * else - so `Prohlídky` is not `Prohlídka`, and a trailing space is not
 * nothing. A plural typed in passing turns off a required medical document for
 * every service in that category, and no screen says a word about it. The
 * owner asked, looking at that very field, "so there's no category here?? but
 * that's where you say what it belongs to?? I don't understand" - and he was
 * right not to understand, because the screen was not saying.
 */

export interface RequirementRuleLike {
  templateName: string;
  serviceCategory: string;
}

export type CategoryMeaning =
  /** Nothing typed yet. */
  | { kind: 'empty' }
  /** Matches a rule: services here make the patient bring these documents. */
  | { kind: 'requires'; documents: string[] }
  /** A category already in use, with no document rule on it. */
  | { kind: 'known-no-rule' }
  /** Not in use anywhere yet - so nothing is required of it, quietly. */
  | { kind: 'new' };

/** The server's comparison, mirrored: case-insensitive, otherwise exact. */
function sameCategory(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('cs') === b.trim().toLocaleLowerCase('cs');
}

/**
 * What the category in the box means right now.
 *
 * `known` is the categories already used by other services - the list the
 * picker offers. Being outside it is not an error; the owner is allowed to
 * invent a category. It is worth saying out loud, because inventing one is
 * indistinguishable on screen from mistyping an existing one, and the two have
 * very different consequences.
 */
export function categoryMeaning(
  category: string,
  rules: readonly RequirementRuleLike[],
  known: readonly string[],
): CategoryMeaning {
  if (category.trim() === '') return { kind: 'empty' };

  const documents = rules
    .filter((r) => sameCategory(r.serviceCategory, category))
    .map((r) => r.templateName);
  if (documents.length > 0) return { kind: 'requires', documents };

  if (known.some((k) => sameCategory(k, category))) return { kind: 'known-no-rule' };
  return { kind: 'new' };
}

/**
 * A category already in use that the typed one is one slip away from.
 *
 * Only ever a suggestion. Typing `Prohlídky` when `Prohlídka` exists is the
 * mistake that costs a required document, and the two differ by one letter -
 * so a screen that notices is worth more than one that waits to be right.
 */
export function nearMiss(category: string, known: readonly string[]): string | null {
  const typed = category.trim().toLocaleLowerCase('cs');
  /* Two letters are not a word yet, whatever they are close to. */
  if (typed.length < 3) return null;

  for (const candidate of known) {
    const other = candidate.trim().toLocaleLowerCase('cs');
    /*
     * A word still being typed is not a mistake.
     *
     * This began as a length floor - "say nothing under four letters" - and
     * that was the wrong rule twice over: it nagged nobody about `Prohlí`,
     * which is six, and it silenced `EKX` against a real `EKG`, which is a
     * genuine typo in a short name. What separates them is not length but
     * whether the typed word is the beginning of the other one. `EK` is;
     * `EKX` is not.
     */
    if (other.startsWith(typed)) return null;

    /* An identical category is distance 0, which `editDistanceAtMostTwo`
       already refuses - there used to be an explicit check here and mutation
       showed it could not change an answer. */
    if (editDistanceAtMostTwo(typed, other)) return candidate;
  }
  return null;
}

/**
 * Whether two words are within two edits of each other.
 *
 * Two rather than one: `Prohlídky` from `Prohlídka` is two (`a`→`y` and
 * `k`↔`y` ordering aside, the plural changes the tail), and that is the exact
 * case worth catching. Full Levenshtein on two short words, because anything
 * cleverer would be harder to be sure about than the thing it guards.
 */
function editDistanceAtMostTwo(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2) return false;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  const distance = previous[b.length];
  return distance > 0 && distance <= 2;
}
