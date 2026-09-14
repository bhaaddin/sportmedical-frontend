/*
 * The kinds of document the clinic keeps, and what may be done to them.
 *
 * The owner opened the rule screen and asked why documents he had deleted were
 * back. They were not back - they had never gone. All four share one creation
 * timestamp, 8. 9. 2026 at 22:58:27, and the API has no DELETE for a template
 * at all. Nothing he could have clicked could have removed one.
 *
 * What he wanted was a list holding only the výpis. Since 14. 9. 2026 that is
 * possible: `PUT /api/documents/templates/{id}` arrived with the merge, and
 * every picker in the application already hides an inactive template. Turning
 * the other three off empties them out of every dropdown without destroying
 * anything a filed document still points at.
 *
 * WHY OFF AND NOT DELETED
 *
 * A `PatientDocument` carries its `templateId` for as long as it exists. Delete
 * the template and every document filed under it loses its name - years of
 * paperwork reading "Neznámý dokument". Off is reversible, keeps the history
 * readable, and is the whole of what he actually asked for.
 */

export interface TemplateLike {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface TemplateDraft {
  name: string;
  description: string;
  isActive: boolean;
}

export type TemplateProblem = 'name-empty';

export const TEMPLATE_PROBLEM_TEXT: Record<TemplateProblem, string> = {
  'name-empty': 'Název je to jediné, podle čeho se dokument pozná. Nesmí zůstat prázdný.',
};

export function templateProblems(draft: TemplateDraft): TemplateProblem[] {
  return draft.name.trim() === '' ? ['name-empty'] : [];
}

export function templateIsValid(draft: TemplateDraft): boolean {
  return templateProblems(draft).length === 0;
}

/**
 * Whether anything would change by saving.
 *
 * `PUT` sends all three whatever moved, but a save that changes nothing is
 * still a write in the log and a row somebody has to wonder about later.
 */
export function templateChanged(before: TemplateLike, draft: TemplateDraft): boolean {
  return before.name !== draft.name
    || before.description !== draft.description
    || before.isActive !== draft.isActive;
}

/*
 * The wrong sentence, still live on the server.
 *
 * The seeded výpis describes itself as "(vyžaduje se při první návštěvě)" -
 * a rule the owner cancelled on 13. 9. 2026, because sportspeople come every
 * year and bring a new one. Nothing could correct it until this screen
 * existed: `/api/documents/templates` was `GET` only.
 *
 * Pointed at rather than corrected automatically. The text is the clinic's to
 * write, and a screen that silently rewrote it would be making the same kind
 * of decision on his behalf that put the sentence there in the first place.
 */
export const STALE_FIRST_VISIT_PHRASE = 'vyžaduje se při první návštěvě';

export function describesACancelledRule(description: string): boolean {
  return description.toLowerCase().includes(STALE_FIRST_VISIT_PHRASE.toLowerCase());
}

export const STALE_FIRST_VISIT_TEXT =
  'Tenhle popis ještě říká, že se doklad vyžaduje jen při první návštěvě. '
  + 'To pravidlo už neplatí — kdy se doklad žádá, se nastavuje na pravidle, '
  + 'ne tady. Text je potřeba přepsat.';

/**
 * What turning a template off will and will not do.
 *
 * Said before the switch, because the consequence reaches two other screens:
 * it disappears from every picker, and any rule pointing at it keeps existing
 * while having nothing left to ask for.
 */
export function switchingOffText(rulesPointingAtIt: number): string {
  /*
   * Reversible again, and this sentence has now said both things in one day.
   *
   * It first promised "kdykoli zpátky", which was false: the list endpoint
   * answered with the ACTIVE templates only, so one switched off left the
   * screen and took its row with it. Measured after shipping it - the list
   * came back holding one template out of four - and corrected to the
   * unpleasant truth the same hour rather than waiting for the endpoint.
   *
   * `?includeInactive=true` landed shortly after, on this screen only: every
   * other caller of that list is a picker, and a picker holding a document
   * the owner put away is a picker offering a mistake. So the promise is true
   * again, and this time it was measured before it was written.
   */
  const base =
    'Vypnutý dokument zmizí ze všech nabídek a nepůjde ho nahrát. '
    + 'Už nahrané dokumenty zůstanou i se jménem a v tomhle seznamu ho '
    + 'uvidíte dál, takže ho lze kdykoli zapnout zpátky.';

  if (rulesPointingAtIt === 0) return base;

  const rules = rulesPointingAtIt === 1
    ? 'Jedno pravidlo na něj ukazuje'
    : `${rulesPointingAtIt} pravidla na něj ukazují`;

  return `${base} ${rules} — zůstane v seznamu, ale nebude si už mít co vyžádat.`;
}
