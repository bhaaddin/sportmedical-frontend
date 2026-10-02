/*
 * What a submission says about the answers it carries.
 *
 * Nothing here is clinical; it is about a record being honest about itself.
 * A stored answer names the questionnaire and the revision it answered, and
 * those two facts come from the server with the questions. They were
 * constants in the source until 23. 9. 2026, so every row claimed to answer
 * "version 1" of the one questionnaire whatever had actually been asked.
 */
import { describe, it, expect } from 'vitest';
import { answersForSubmission } from './healthQuestionnaire';

const loaded = { definitionKey: 'dotaznik-pro-plavce', schemaVersion: 2 };

describe('answersForSubmission', () => {
  it('files the answers under the questionnaire that was loaded for the booking, and its revision', () => {
    const sent = answersForSubmission({ kardio_bolest: true, vyska: ' 180 ' }, loaded);

    expect(sent).toEqual({
      definitionKey: 'dotaznik-pro-plavce',
      schemaVersion: 2,
      answers: [
        { questionId: 'kardio_bolest', yesNo: true },
        { questionId: 'vyska', text: '180' },
      ],
    });
  });

  it('sends nothing when the questionnaire never arrived — old answers are not filed under a guess', () => {
    expect(answersForSubmission({ kardio_bolest: true }, null)).toBeUndefined();
  });

  it('sends nothing when nothing was answered, so the field stays off the request', () => {
    expect(answersForSubmission({ a: null, b: '   ', c: [] }, loaded)).toBeUndefined();
  });

  it('keeps a "ne" — it is an answer, not an omission', () => {
    expect(answersForSubmission({ kardio_bolest: false }, loaded)?.answers).toEqual([
      { questionId: 'kardio_bolest', yesNo: false },
    ]);
  });

  it('keeps which relatives were ticked', () => {
    expect(answersForSubmission({ rodina_infarkt: ['Matka', 'Otec'] }, loaded)?.answers).toEqual([
      { questionId: 'rodina_infarkt', choices: ['Matka', 'Otec'] },
    ]);
  });
});
