/* ════════════════════════════════════════════════════════════
   ZDRAVOTNÍ DOTAZNÍK — the shapes the form draws

   ── The questions are NOT here ──

   They used to be: seventy-seven of them, transcribed from the clinic's PDF
   into this file, which meant a clinic that wanted to add one — or fix a
   word — needed a developer and a deploy. They are rows in the database now,
   edited in the administration, served by
   `POST /api/public/questionnaire/for-booking` (the questionnaire of the
   booked činnost, or the clinic's default) and fetched by
   `api/publicQuestionnaire.ts`.

   That move happened on 21. 9. 2026 and it removed the second copy: there had
   been two hardcoded questionnaires, fifty-two questions in the C# domain and
   seventy-seven here, disagreeing with each other, and the patient only ever
   saw these. The domain's model carries sections, conditions, notes and
   placeholders now, so there is one questionnaire and the clinic owns it.

   ── What stays ──

   Everything that is not content: the field shapes the renderer switches on,
   the declaration the patient signs, and the helpers that decide which
   sections and items apply and how far along somebody is. None of it decides
   anything clinical.
   ════════════════════════════════════════════════════════════ */

export type Answer = string | boolean | string[] | null;
export type Answers = Record<string, Answer>;

export type Field =
  | { kind: 'text'; id: string; label: string; help?: string; placeholder?: string }
  | { kind: 'longtext'; id: string; label: string; help?: string }
  | { kind: 'number'; id: string; label: string; help?: string; min?: number; max?: number }
  | { kind: 'yesno'; id: string; label: string; help?: string }
  | { kind: 'choice'; id: string; label: string; options: readonly string[] }
  | { kind: 'relatives'; id: string; label: string }
  | { kind: 'notice'; id: string; text: string };

/** A field, plus what has to be true for it to be on screen at all. */
export interface Item {
  field: Field;
  /** Shown only when this returns true. Absent means always. */
  when?: (answers: Answers) => boolean;
}

export interface Section {
  id: string;
  number: string;
  title: string;
  note?: string;
  /** Whole section hidden unless this returns true. `female` comes from the
      registration form above, not from anything asked in here. */
  when?: (context: { female: boolean }) => boolean;
  items: Item[];
}

/** The four relatives the family table asks about, in the PDF's own order. */
export const RELATIVES = ['Matka', 'Otec', 'Bratr', 'Sestra'] as const;


export const DECLARATION =
  'Údaje uvedené v tomto dotazníku slouží výhradně pro účely posouzení zdravotní '
  + 'způsobilosti ke sportovní činnosti. Jsou zpracovávány v souladu s nařízením '
  + '(EU) 2016/679 (GDPR) a zákonem č. 372/2011 Sb., o zdravotních službách. '
  + 'Prohlašuji, že všechny uvedené informace jsou pravdivé a úplné, a že jsem si '
  + 'vědom/a důsledků uvedení nepravdivých nebo neúplných údajů. Současně si '
  + 'uvědomuji, že sportovní zátěž může být spojena s určitými zdravotními riziky. '
  + 'Svým podpisem uděluji souhlas se zpracováním poskytnutých údajů za výše '
  + 'uvedeným účelem.';

/**
 * Sections that apply, given what registration already knows.
 *
 * Takes the questionnaire rather than reading one from this file: the content
 * lives in the database now and is fetched, so a helper that closed over a
 * constant here would be the second copy the whole move was meant to remove.
 */
export const sectionsFor = (
  all: readonly Section[],
  female: boolean,
): readonly Section[] =>
  all.filter((section) => section.when === undefined || section.when({ female }));

/** Items of a section that apply, given what has been answered so far. */
export const itemsFor = (section: Section, answers: Answers): readonly Item[] =>
  section.items.filter((item) => item.when === undefined || item.when(answers));

/**
 * How many of a section's visible questions have an answer.
 *
 * Notices are not questions and a `false` is an answer — "ne" is information,
 * and counting it as unanswered would tell somebody who filled the form in
 * honestly that they had not.
 */
export const progressOf = (
  section: Section,
  answers: Answers,
): { answered: number; total: number } => {
  const asking = itemsFor(section, answers).filter((item) => item.field.kind !== 'notice');
  const answered = asking.filter((item) => {
    const value = answers[item.field.id];
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
  return { answered: answered.length, total: asking.length };
};

/**
 * Which set of questions a submission's answers belong to, and which revision
 * of it.
 *
 * Stored with every submission so a row read in two years can still be matched
 * to the questions it answered. Both come from the server together with the
 * questions (`api/publicQuestionnaire.ts`). They were constants in this file
 * until 23. 9. 2026 — one key and "version 1" — so every submission claimed to
 * answer the first revision of the one questionnaire, however many times the
 * clinic had changed it since and whichever questionnaire the booked činnost
 * actually asked.
 */
export interface QuestionnaireIdentity {
  definitionKey: string;
  schemaVersion: number;
}

/** One answer as the API takes it: whichever of the three kinds it is. */
export interface SubmittedAnswer {
  questionId: string;
  text?: string | null;
  yesNo?: boolean | null;
  choices?: string[] | null;
}

/**
 * The answers, in the shape the API takes.
 *
 * Only what was actually answered: an untouched question is absent rather than
 * sent as null, because a form where nobody answered anything should arrive as
 * nothing at all and not as 76 empty rows. Returns `undefined` for that case,
 * which is what keeps the field off the request entirely.
 *
 * Also `undefined` when the questionnaire never arrived: answers left in the
 * browser by an earlier visit belong to whatever was asked then, and filing
 * them under a questionnaire this booking did not load would be a guess
 * dressed up as a record.
 */
export const answersForSubmission = (
  answers: Answers,
  questionnaire: QuestionnaireIdentity | null,
): { definitionKey: string; schemaVersion: number; answers: SubmittedAnswer[] } | undefined => {
  if (questionnaire === null) return undefined;

  /*
   * One shape, not three.
   *
   * The branches used to return three different object literals, which left
   * `flatMap` inferring from the first one and quietly typing the result as
   * yes/no answers only. It compiled because nothing type-checked this project
   * -- `tsc -p tsconfig.json` checks an empty file list here; `tsc -b` is the
   * one that reads the source.
   */
  const given: SubmittedAnswer[] = Object.entries(answers).flatMap(
    ([questionId, value]): SubmittedAnswer[] => {
      if (value === null || value === undefined) return [];
      if (typeof value === 'boolean') return [{ questionId, yesNo: value }];
      if (Array.isArray(value)) return value.length === 0 ? [] : [{ questionId, choices: value }];

      return value.trim().length === 0 ? [] : [{ questionId, text: value.trim() }];
    });

  return given.length === 0
    ? undefined
    : {
        definitionKey: questionnaire.definitionKey,
        schemaVersion: questionnaire.schemaVersion,
        answers: given,
      };
};

/** The draft as the page last left it. Same key the form writes. */
export const DRAFT_KEY = 'smd.health-questionnaire.draft.v1';

export const readDraft = (): Answers => {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw === null ? {} : (JSON.parse(raw) as Answers);
  } catch {
    /* No storage, or nothing readable in it. An empty draft is a real answer:
       the patient simply did not fill the questionnaire in. */
    return {};
  }
};
