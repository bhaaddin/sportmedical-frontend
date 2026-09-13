/*
 * Two categories one slip apart.
 *
 * A price-list category is a label: it groups the list and colours it. It was
 * briefly more than that - a required document hung off it - and this file
 * carried the machinery for saying so. That machinery is gone with the link:
 * on 13. 9. 2026 the requirement moved onto a clinic service, and the chain is
 * `termín -> činnost -> služba -> pravidlo` with the price list outside it.
 *
 * What is worth keeping is smaller and still true. "Prohlídka" and "Prohlídky"
 * side by side in one price list are two names for one thing, and nobody meant
 * to create the second.
 *
 * The claim is deliberately smaller than it was. This used to warn that a
 * mistyped category turned off a required medical document, and that warning
 * was correct, well built, and guarding a list of categories nobody had asked
 * for - they were seed data. The better the guard looked, the more convincing
 * the invented list looked with it.
 */



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
