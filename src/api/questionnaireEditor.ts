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

export interface QuestionnaireSummary {
  id: string;
  key: string;
  displayName: string;
  isActive: boolean;
}

export interface DefaultQuestionnaire {
  /** What the clinic chose, or null when it never chose. */
  configuredDefinitionId: string | null;
  /** What patients whose činnost names none get now; null when nothing is switched on. */
  effectiveDefinitionId: string | null;
}

/**
 * Switched on: patients are being asked it. The server's rule — a published
 * version exists — read off the same versions, not a flag of its own.
 */
export const isActive = (definition: EditorDefinition): boolean =>
  definition.versions.some((version) => version.status === 'Published');

/** The newest version of any kind — what a switched-off questionnaire last asked. */
export const latestOf = (definition: EditorDefinition): EditorVersion | null =>
  [...definition.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;

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

  /* ── The questionnaire as a whole ── */

  /**
   * A new, empty questionnaire with its first draft open. The server makes the
   * key from the name; patients are not asked it until the draft is published.
   */
  create: async (displayName: string): Promise<QuestionnaireSummary> => {
    const { data } = await client.post<QuestionnaireSummary>('/api/questionnaires/definitions', {
      displayName,
    });
    return data;
  },

  /** What it is called on screen. The key — what answers are filed under — never changes. */
  rename: async (definitionId: string, displayName: string): Promise<void> => {
    await client.put(`${root(definitionId)}/name`, { displayName });
  },

  /** Back on, with the questions it last had (a new version). */
  activate: async (definitionId: string): Promise<void> => {
    await client.post(`${root(definitionId)}/activate`, {});
  },

  /** Off: nobody is asked it any more. Answers already given stay readable. */
  deactivate: async (definitionId: string): Promise<void> => {
    await client.post(`${root(definitionId)}/deactivate`, {});
  },

  /** Which questionnaire a činnost without its own gets — chosen, and in effect. */
  readDefault: async (): Promise<DefaultQuestionnaire> => {
    const { data } = await client.get<DefaultQuestionnaire>('/api/questionnaires/default');
    return data;
  },

  setDefault: async (definitionId: string): Promise<DefaultQuestionnaire> => {
    const { data } = await client.put<DefaultQuestionnaire>('/api/questionnaires/default', {
      definitionId,
    });
    return data;
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
 * One choice per line.
 *
 * The key is the question's key and a number, not a slug of the Czech: a key
 * has to be ASCII, and slugging the wording would change the key the moment
 * somebody fixes a typo - leaving every answer filed under the old one
 * matching nothing.
 *
 * With nothing to compare against (a new question) the number is the place.
 * With the options the question already has (`existing`), a choice KEEPS its
 * key when it is rewritten: found by its exact wording, or - a typo fixed -
 * by standing in the same place as an option nobody else claimed. Only a
 * genuinely new choice gets a new number, the smallest one not yet used. Without
 * this, removing the first choice renumbered all the others and answers already
 * given silently pointed at the wrong wording.
 */
export const toOptions = (
  questionKey: string,
  text: string,
  existing: ReadonlyArray<{ key: string; displayText: string }> = [],
): Array<{ key: string; displayText: string; sortOrder: number }> => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const base = questionKey || 'volba';

  if (existing.length === 0) {
    return lines.map((displayText, index) => ({ key: `${base}_${index + 1}`, displayText, sortOrder: index + 1 }));
  }

  const keys: Array<string | null> = lines.map(() => null);
  const claimed = new Set<string>();

  lines.forEach((line, index) => {
    const same = existing.find((option) => option.displayText.trim() === line && !claimed.has(option.key));
    if (same !== undefined) {
      keys[index] = same.key;
      claimed.add(same.key);
    }
  });
  lines.forEach((_, index) => {
    const there = existing[index];
    if (keys[index] === null && there !== undefined && !claimed.has(there.key)) {
      keys[index] = there.key;
      claimed.add(there.key);
    }
  });

  const used = new Set<string>([...claimed, ...existing.map((option) => option.key)]);
  let next = 1;
  return lines.map((displayText, index) => {
    let key = keys[index];
    if (key === null) {
      while (used.has(`${base}_${next}`)) next += 1;
      key = `${base}_${next}`;
      used.add(key);
    }
    return { key, displayText, sortOrder: index + 1 };
  });
};

/**
 * A key the server files answers under and a condition names: ASCII, lower case, digits and
 * underscores, starting with a letter or digit. Every key in the shipped questionnaire has this
 * shape; the server itself accepted "" and "Špatný klíč" (measured) and then filed answers under them.
 */
export const QUESTION_KEY_PATTERN = /^[a-z0-9][a-z0-9_]*$/;

export const isValidQuestionKey = (key: string): boolean => QUESTION_KEY_PATTERN.test(key);
