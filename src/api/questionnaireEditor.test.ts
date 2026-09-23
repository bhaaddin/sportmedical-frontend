/*
 * The pure parts of the questionnaire editor.
 *
 * ── What is worth testing here and what is not ──
 *
 * The calls themselves are one line each and the server decides everything
 * they mean, so asserting that a PUT goes to a PUT proves nothing. What is
 * worth pinning down is the reasoning this file does on its own, because each
 * piece of it prevents a mistake that LOOKS FINE on screen:
 *
 *   * `possibleTriggers` offers only yes/no questions asked earlier. Offer a
 *     later one and the clinic builds a follow-up that can never open — no
 *     error, no gap, just a question nobody is ever asked.
 *   * `sectionsOf` groups by what a question carries. Group it wrong and a
 *     section silently splits in two, or two different sections merge.
 *   * `draftOf` / `publishedOf` decide whether the screen lets somebody edit.
 *     Get it wrong and either the live questionnaire looks editable or a draft
 *     looks untouchable.
 *   * `refusalText` carries the server's own sentence through. The domain
 *     writes those refusals for a person, and they are the only explanation
 *     the clinic gets for the invisible mistakes above.
 */
import { describe, it, expect } from 'vitest';
import {
  draftOf,
  possibleTriggers,
  publishedOf,
  refusalText,
  sectionsOf,
  toOptions,
} from './questionnaireEditor';
import type { EditorDefinition, EditorQuestion, EditorVersion } from './questionnaireEditor';

const question = (over: Partial<EditorQuestion> = {}): EditorQuestion => ({
  id: over.id ?? `id-${over.questionKey ?? 'x'}`,
  type: 'Boolean',
  prompt: 'Otázka?',
  helpText: null,
  isRequired: false,
  sortOrder: 1,
  minValue: null,
  maxValue: null,
  maxTextLength: null,
  allowMultipleSelection: false,
  options: [],
  questionKey: 'otazka',
  sectionNumber: '1',
  sectionTitle: 'Sekce',
  sectionNote: null,
  placeholder: null,
  showWhenAnswered: null,
  femaleOnly: false,
  ...over,
});

const version = (questions: EditorQuestion[], over: Partial<EditorVersion> = {}): EditorVersion => ({
  id: 'version-1',
  definitionId: 'definition-1',
  versionNumber: 1,
  status: 'Draft',
  note: null,
  createdAtUtc: '2026-09-21T10:00:00Z',
  questions,
  ...over,
});

describe('grouping the questions the way the paper groups them', () => {
  it('keeps a section together and in the order it is asked', () => {
    const sections = sectionsOf(
      version([
        question({ questionKey: 'b', sortOrder: 2, sectionNumber: '9', sectionTitle: 'Srdce' }),
        question({ questionKey: 'a', sortOrder: 1, sectionNumber: '9', sectionTitle: 'Srdce' }),
      ]),
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].questions.map((q) => q.questionKey)).toEqual(['a', 'b']);
  });

  it('carries the note and the women-only flag up to the section', () => {
    const sections = sectionsOf(
      version([
        question({
          questionKey: 'a',
          sectionNumber: '7',
          sectionTitle: 'Gynekologická anamnéza',
          sectionNote: 'Vyplňují pouze ženy.',
          femaleOnly: true,
        }),
      ]),
    );

    expect(sections[0].note).toBe('Vyplňují pouze ženy.');
    expect(sections[0].femaleOnly).toBe(true);
  });

  it('does not merge two sections that merely share a number', () => {
    const sections = sectionsOf(
      version([
        question({ questionKey: 'a', sortOrder: 1, sectionNumber: '4', sectionTitle: 'Osobní' }),
        question({ questionKey: 'b', sortOrder: 2, sectionNumber: '4', sectionTitle: 'Operace' }),
      ]),
    );

    expect(sections.map((section) => section.title)).toEqual(['Osobní', 'Operace']);
  });

  it('orders sections by where their first question is asked', () => {
    const sections = sectionsOf(
      version([
        question({ questionKey: 'c', sortOrder: 3, sectionNumber: '1', sectionTitle: 'Lékař' }),
        question({ questionKey: 'a', sortOrder: 1, sectionNumber: '9', sectionTitle: 'Srdce' }),
      ]),
    );

    expect(sections.map((section) => section.title)).toEqual(['Srdce', 'Lékař']);
  });
});

describe('what a follow-up may be attached to', () => {
  const asked = version([
    question({ questionKey: 'prvni_ano', sortOrder: 1, type: 'Boolean' }),
    question({ questionKey: 'sport', sortOrder: 2, type: 'Text' }),
    question({ questionKey: 'druhe_ano', sortOrder: 3, type: 'Boolean' }),
    question({ questionKey: 'tretie_ano', sortOrder: 4, type: 'Boolean' }),
  ]);

  it('offers only yes/no questions', () => {
    expect(possibleTriggers(asked, null).map((q) => q.questionKey)).toEqual([
      'prvni_ano',
      'druhe_ano',
      'tretie_ano',
    ]);
  });

  it('offers only the ones asked before the question being edited', () => {
    const editing = asked.questions.find((q) => q.questionKey === 'druhe_ano')!;

    // 'tretie_ano' is asked after it: a box waiting on that yes could never
    // open, and the server refuses it.
    expect(possibleTriggers(asked, editing).map((q) => q.questionKey)).toEqual(['prvni_ano']);
  });

  it('never offers a question its own key', () => {
    const editing = asked.questions.find((q) => q.questionKey === 'prvni_ano')!;

    expect(possibleTriggers(asked, editing)).toHaveLength(0);
  });

  it('skips a question with no key — nothing can point at it', () => {
    const legacy = version([question({ questionKey: '', sortOrder: 1, type: 'Boolean' })]);

    expect(possibleTriggers(legacy, null)).toHaveLength(0);
  });
});

describe('which version the screen is looking at', () => {
  const definition = (versions: EditorVersion[]): EditorDefinition => ({
    id: 'definition-1',
    organizationId: 'org',
    clinicId: 'clinic',
    key: 'sportmedical-cz-zdravotni-dotaznik',
    displayName: 'Zdravotní dotazník',
    createdAtUtc: '2026-09-21T10:00:00Z',
    versions,
  });

  it('finds the open draft and the live version side by side', () => {
    const subject = definition([
      version([], { id: 'v1', versionNumber: 1, status: 'Published' }),
      version([], { id: 'v2', versionNumber: 2, status: 'Draft' }),
    ]);

    expect(draftOf(subject)?.id).toBe('v2');
    expect(publishedOf(subject)?.id).toBe('v1');
  });

  it('has no draft when nothing is open', () => {
    const subject = definition([version([], { status: 'Published' })]);

    expect(draftOf(subject)).toBeNull();
  });

  it('ignores retired versions when asked what is live', () => {
    const subject = definition([
      version([], { id: 'v1', versionNumber: 1, status: 'Retired' }),
      version([], { id: 'v2', versionNumber: 2, status: 'Published' }),
    ]);

    expect(publishedOf(subject)?.id).toBe('v2');
  });

  it('is null before anything was ever published', () => {
    expect(publishedOf(definition([version([], { status: 'Draft' })]))).toBeNull();
  });
});

describe('the choices of a choice question', () => {
  it('keys them by position, not by the Czech wording', () => {
    // Slugging the wording would change the key the moment somebody fixes a
    // typo, leaving every answer filed under the old one matching nothing.
    expect(toOptions('cukrovka', 'Ne\nAno – 1. typu\nAno – 2. typu')).toEqual([
      { key: 'cukrovka_1', displayText: 'Ne', sortOrder: 1 },
      { key: 'cukrovka_2', displayText: 'Ano – 1. typu', sortOrder: 2 },
      { key: 'cukrovka_3', displayText: 'Ano – 2. typu', sortOrder: 3 },
    ]);
  });

  it('drops blank lines rather than making an empty choice out of one', () => {
    expect(toOptions('k', 'Ne\n\n   \nAno')).toHaveLength(2);
  });
});

describe('what the server refused', () => {
  it('passes the domain sentence through, because it is written for a person', () => {
    const refused = {
      response: {
        data: {
          code: 'questionnaires.question.order.invalid',
          message: 'A question can only be shown after a question this version asks.',
        },
      },
    };

    expect(refusalText(refused)).toBe(
      'A question can only be shown after a question this version asks.',
    );
  });

  it('falls back to something readable when there is no body at all', () => {
    expect(refusalText(new Error('Network Error'))).toBe(
      'Změnu se nepodařilo uložit. Zkuste to prosím znovu.',
    );
  });
});
