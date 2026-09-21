/*
 * The owner's own example, pinned:
 *
 *   Sportovní prohlídka    → dotazník povinný
 *   Sportovní diagnostika  → dotazník nepovinný
 *
 * and changed in the administration, not in this file. What these check is the
 * part a screenshot cannot show — that "neptáme se" hides the block rather than
 * marking it optional, that an opened-and-closed dialog does not count as a
 * filled questionnaire, and that somebody who never booked is not refused over
 * a setting that does not apply to them.
 */
import { describe, it, expect } from 'vitest';
import {
  questionnaireSatisfied,
  questionnaireStance,
} from './questionnaireRequirement';

describe('what the činnost asks of the questionnaire', () => {
  it('hides it entirely when the clinic does not ask', () => {
    expect(questionnaireStance('NotAsked')).toEqual({ asked: false, required: false });
  });

  it('offers it without insisting', () => {
    expect(questionnaireStance('Optional')).toEqual({ asked: true, required: false });
  });

  it('insists when the clinic said povinný', () => {
    expect(questionnaireStance('Required')).toEqual({ asked: true, required: true });
  });

  it('offers it to somebody who came without booking', () => {
    // No held slot means no činnost, so there is no rule to apply. Refusing
    // them over a setting that is not theirs would be refusing them for
    // nothing.
    expect(questionnaireStance(undefined)).toEqual({ asked: true, required: false });
  });
});

describe('whether the form may be sent', () => {
  it('lets an optional questionnaire go empty', () => {
    expect(questionnaireSatisfied('Optional', 0)).toBe(true);
    expect(questionnaireSatisfied('NotAsked', 0)).toBe(true);
    expect(questionnaireSatisfied(undefined, 0)).toBe(true);
  });

  it('refuses a required one with no answers in it', () => {
    expect(questionnaireSatisfied('Required', 0)).toBe(false);
  });

  it('accepts a required one the moment something is answered', () => {
    expect(questionnaireSatisfied('Required', 1)).toBe(true);
  });
});
