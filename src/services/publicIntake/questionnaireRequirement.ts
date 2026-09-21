/*
 * What the held činnost asks of the health questionnaire.
 *
 * Pulled out of the page so it can be exercised without rendering 1900 lines
 * of form. The page reads one boolean pair from here and renders it; the rules
 * themselves are three lines and worth pinning, because they are the owner's
 * own example — "Sportovní prohlídka → dotazník povinný, Sportovní diagnostika
 * → nepovinný" — and the server refuses on the same basis.
 */

/** The three answers a činnost can give, as the server names them. */
export type QuestionnaireRequirement = 'NotAsked' | 'Optional' | 'Required';

export interface QuestionnaireStance {
  /** Whether to show the questionnaire block at all. */
  asked: boolean;
  /** Whether the form refuses to submit without answers. */
  required: boolean;
}

/**
 * @param requirement
 * What the held činnost says, or `undefined` for somebody who came straight to
 * the form without booking. They are offered it as before — optional — because
 * there is no činnost to take the rule from, and refusing them over a setting
 * that does not apply to them would be refusing them for nothing.
 */
export function questionnaireStance(
  requirement: QuestionnaireRequirement | undefined,
): QuestionnaireStance {
  const effective: QuestionnaireRequirement = requirement ?? 'Optional';

  return {
    asked: effective !== 'NotAsked',
    required: effective === 'Required',
  };
}

/**
 * Whether the form may be submitted as far as the questionnaire is concerned.
 *
 * "Answered nothing" is the same as "did not open it": somebody who opened the
 * dialog and closed it again has not filled in a questionnaire, which is what a
 * clinic means when it marks one povinný. The server checks the same thing off
 * the held token.
 */
export function questionnaireSatisfied(
  requirement: QuestionnaireRequirement | undefined,
  answersGiven: number,
): boolean {
  return !questionnaireStance(requirement).required || answersGiven > 0;
}
