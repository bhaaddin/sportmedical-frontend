import { client } from './client';

/**
 * The clinic's questionnaire, as the administration edits it.
 *
 * ── Why this exists ──
 *
 * Until 21. 9. 2026 the seventy-seven questions a patient answers were a
 * TypeScript file in this bundle. Adding one, or fixing a word, meant a
 * developer and a deploy. They are rows in the database now; these are the
 * endpoints that change them.
 *
 * ── Drafts, not live edits ──
 *
 * Nothing here touches what patients are answering. `startDraft` copies the
 * published version, every other call edits the copy, and `publish` swaps them
 * over and retires the old one. Somebody halfway through the booking page
 * while the clinic rewrites a question keeps the questionnaire they started.
 */

/* ── What the server sends ────────────────────────────────────────── */

export interface EditorOption {
  key: string;
  displayText: string;
  sortOrder: number;
}

export interface EditorQuestion {
  id: string;
  /** `Text`, `LongText`, `Number`, `Boolean`, `SingleChoice`, `Information`… */
  type: string;
  prompt: string;
  helpText: string | null;
  isRequired: boolean;
  sortOrder: number;
  minValue: number | null;
  maxValue: number | null;
  maxTextLength: number | null;
  allowMultipleSelection: boolean;
  options: EditorOption[];
  /** What answers are filed under. Fixed for the life of the question. */
  questionKey: string;
  sectionNumber: string;
  sectionTitle: string;
  sectionNote: string | null;
  placeholder: string | null;
  showWhenAnswered: string | null;
  femaleOnly: boolean;
}

export interface EditorVersion {
  id: string;
  definitionId: string;
  versionNumber: number;
  /** `Draft`, `Published` or `Retired`. The word, never a number. */
  status: string;
  note: string | null;
  createdAtUtc: string;
  questions: EditorQuestion[];
}

export interface EditorDefinition {
  id: string;
  organizationId: string;
  clinicId: string;
  key: string;
  displayName: string;
  createdAtUtc: string;
  versions: EditorVersion[];
}

/* ── What the administration sends back ───────────────────────────── */

export interface NewQuestion {
  type: string;
  prompt: string;
  questionKey: string;
  sectionNumber: string;
  sectionTitle: string;
  sectionNote: string | null;
  helpText: string | null;
  placeholder: string | null;
  isRequired: boolean;
  femaleOnly: boolean;
  minValue: number | null;
  maxValue: number | null;
  maxTextLength: number | null;
  showWhenAnswered: string | null;
  options: EditorOption[] | null;
}

export interface RewordedQuestion {
  prompt: string;
  helpText: string | null;
  placeholder: string | null;
  isRequired: boolean;
  minValue: number | null;
  maxValue: number | null;
  maxTextLength: number | null;
  showWhenAnswered: string | null;
  /** Null leaves the choices alone; an empty list clears them. */
  options: EditorOption[] | null;
}

/* ── The grouped view the editor actually draws ───────────────────── */

export interface EditorSection {
  number: string;
  title: string;
  note: string | null;
  femaleOnly: boolean;
  questions: EditorQuestion[];
}

/**
 * The version's questions, grouped the way the paper groups them.
 *
 * Grouped here rather than by the screen because a question carries its
 * section, so the grouping is a fact about the data. Order inside a group is
 * the order the questions are asked; groups appear in the order their first
 * question does, so moving a question between groups cannot make a section
 * jump somewhere unexpected.
 */
export const sectionsOf = (version: EditorVersion): EditorSection[] => {
  const ordered = [...version.questions].sort((a, b) => a.sortOrder - b.sortOrder);

  const sections: EditorSection[] = [];

  for (const question of ordered) {
    const existing = sections.find(
      (section) => section.number === question.sectionNumber && section.title === question.sectionTitle,
    );

    if (existing) {
      existing.questions.push(question);
      continue;
    }

    sections.push({
      number: question.sectionNumber,
      title: question.sectionTitle,
      note: question.sectionNote,
      femaleOnly: question.femaleOnly,
      questions: [question],
    });
  }

  return sections;
};

/** The one version being edited, or null when there is no open draft. */
export const draftOf = (definition: EditorDefinition): EditorVersion | null =>
  definition.versions.find((version) => version.status === 'Draft') ?? null;

/** The one patients are answering, or null before anything was published. */
export const publishedOf = (definition: EditorDefinition): EditorVersion | null =>
  definition.versions
    .filter((version) => version.status === 'Published')
    .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;

/**
 * The yes/no questions a follow-up may be attached to.
 *
 * Only the ones asked BEFORE the question being edited: a box that opens on a
 * yes given later can never open, and the server refuses it. Offering only
 * what is allowed is cheaper than explaining a refusal.
 */
export const possibleTriggers = (
  version: EditorVersion,
  before: EditorQuestion | null,
): EditorQuestion[] =>
  [...version.questions]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter(
      (question) =>
        question.type === 'Boolean'
        && question.questionKey.length > 0
        && (before === null || question.sortOrder < before.sortOrder),
    );

/* ── The calls ────────────────────────────────────────────────────── */

const root = (definitionId: string) => `/api/questionnaires/definitions/${definitionId}`;

export const questionnaireEditorApi = {
  /** Every questionnaire the clinic has, with all its versions. */
  list: async (): Promise<EditorDefinition[]> => {
    const { data } = await client.get<EditorDefinition[]>('/api/questionnaires/definitions');

    return data ?? [];
  },

  /** Starts the next version as a copy of the published one. */
  startDraft: async (definitionId: string, note: string | null): Promise<void> => {
    await client.post(`${root(definitionId)}/draft`, { note });
  },

  addQuestion: async (
    definitionId: string,
    versionId: string,
    question: NewQuestion,
  ): Promise<void> => {
    await client.post(`${root(definitionId)}/versions/${versionId}/questions`, question);
  },

  editQuestion: async (
    definitionId: string,
    versionId: string,
    questionId: string,
    question: RewordedQuestion,
  ): Promise<void> => {
    await client.put(
      `${root(definitionId)}/versions/${versionId}/questions/${questionId}`,
      question,
    );
  },

  removeQuestion: async (
    definitionId: string,
    versionId: string,
    questionId: string,
  ): Promise<void> => {
    await client.delete(`${root(definitionId)}/versions/${versionId}/questions/${questionId}`);
  },

  /** Moves a question to a position, one-based. */
  moveQuestion: async (
    definitionId: string,
    versionId: string,
    questionId: string,
    position: number,
  ): Promise<void> => {
    await client.put(
      `${root(definitionId)}/versions/${versionId}/questions/${questionId}/position`,
      { position },
    );
  },

  /** Renames a whole group at once — every question in it moves together. */
  renameSection: async (
    definitionId: string,
    versionId: string,
    section: {
      sectionNumber: string;
      newNumber: string;
      newTitle: string;
      newNote: string | null;
      femaleOnly: boolean;
    },
  ): Promise<void> => {
    await client.put(`${root(definitionId)}/versions/${versionId}/sections`, section);
  },

  /** Puts the draft in front of patients and retires the one it replaces. */
  publish: async (definitionId: string, versionId: string): Promise<void> => {
    await client.post(`${root(definitionId)}/versions/${versionId}/publish`, {});
  },

  discardDraft: async (definitionId: string, versionId: string): Promise<void> => {
    await client.delete(`${root(definitionId)}/versions/${versionId}`);
  },
};

/**
 * What the server refused, in the words it used.
 *
 * The domain writes these refusals for a person to read — "a question can only
 * be shown after a question this version asks" — and they are the whole value
 * of the module: they catch the mistake that is invisible on the form. Losing
 * them to a generic "něco se nepovedlo" would leave somebody with a follow-up
 * that never appears and no idea why.
 */
export const refusalText = (error: unknown): string => {
  const body = (error as { response?: { data?: { message?: string; code?: string } } })?.response
    ?.data;

  return body?.message ?? 'Změnu se nepodařilo uložit. Zkuste to prosím znovu.';
};

/**
 * One choice per line, keyed by position.
 *
 * The key is the question's key and the choice's place, not a slug of the
 * Czech: a key has to be ASCII, and slugging the wording would change the key
 * the moment somebody fixes a typo — leaving every answer filed under the old
 * one matching nothing.
 */
export const toOptions = (
  questionKey: string,
  text: string,
): Array<{ key: string; displayText: string; sortOrder: number }> =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((displayText, index) => ({
      key: `${questionKey || 'volba'}_${index + 1}`,
      displayText,
      sortOrder: index + 1,
    }));
