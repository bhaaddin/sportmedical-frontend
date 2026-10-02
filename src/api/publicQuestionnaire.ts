import axios from 'axios';
import type { Answers, Item, Section } from '../services/publicIntake/healthQuestionnaire';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Deliberately NOT the shared `client`: that one attaches a bearer token and
 * sends a 401 to the staff login. The person filling in a questionnaire has no
 * account.
 */
const publicClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/* ── What the server sends ────────────────────────────────────────── */

interface ServerQuestion {
  key: string;
  kind: 'text' | 'longtext' | 'number' | 'yesno' | 'choice' | 'notice';
  label: string;
  help: string | null;
  placeholder: string | null;
  options: string[];
  minimum: number | null;
  maximum: number | null;
  showWhenAnswered: string | null;
}

interface ServerSection {
  number: string;
  title: string;
  note: string | null;
  femaleOnly: boolean;
  questions: ServerQuestion[];
}

interface ServerQuestionnaire {
  definitionKey: string;
  schemaVersion: number;
  name: string;
  sections: ServerSection[];
}

/** The questionnaire as the form draws it, plus what a submission must name. */
export interface LoadedQuestionnaire {
  definitionKey: string;
  schemaVersion: number;
  /** What the clinic calls it — the title over the form. */
  name: string;
  sections: readonly Section[];
}

/**
 * The questionnaire for this patient's booking.
 *
 * ── Why this exists ──
 *
 * Seventy-seven questions used to be a TypeScript file in this bundle. Adding
 * one, or changing a word, meant a developer and a deploy — and the owner's
 * rule is that anything he may need to change is his to change. They are rows
 * in the database now; this fetches them.
 *
 * ── Which questionnaire ──
 *
 * The one the booked činnost names, or the clinic's default when it names
 * none (or names one the clinic has since switched off) — and the default for
 * somebody who came to the form without booking. The server decides, off the
 * hold token. Until 23. 9. 2026 this asked for one key written into the
 * bundle whatever had been booked, so a činnost could not have a
 * questionnaire of its own however the clinic set it up.
 *
 * A POST although nothing changes: the token is what proves which činnost was
 * booked, and a token in a query string ends up in every access log between
 * the patient and the server.
 *
 * ── The shape is the one the dialog already draws ──
 *
 * The server sends sections of questions with their conditions; this turns
 * them back into the `Section`/`Item` shape the questionnaire dialog has
 * always rendered, closures included. Nothing about the drawing changed, which
 * is the point: a rewrite of a 700-line form was not needed to move where its
 * content lives.
 */
export const loadQuestionnaire = async (
  holdToken: string | null,
): Promise<LoadedQuestionnaire> => {
  const { data } = await publicClient.post<ServerQuestionnaire>(
    '/api/public/questionnaire/for-booking',
    { holdToken },
  );

  return {
    definitionKey: data.definitionKey,
    schemaVersion: data.schemaVersion,
    name: data.name,
    sections: data.sections.map((section, index) => toSection(section, index)),
  };
};

function toSection(section: ServerSection, index: number): Section {
  return {
    // The key the paper's own numbering gives, falling back to the position so
    // two sections can never collide in a React key.
    id: `${section.number || 'sekce'}-${index}`,
    number: section.number,
    title: section.title,
    note: section.note ?? undefined,

    // The one section-level rule the clinic's paper has. `female` comes from
    // the registration above, never from an answer inside the questionnaire —
    // nobody is asked their sex twice.
    when: section.femaleOnly ? ({ female }: { female: boolean }) => female : undefined,

    items: section.questions.map(toItem),
  };
}

function toItem(question: ServerQuestion): Item {
  const shown = question.showWhenAnswered;

  return {
    field: toField(question),

    /*
     * "Pokud ano, uveďte" — rebuilt as the closure the dialog expects.
     *
     * Only ever a yes: that is the one shape the paper uses, and the server
     * stores the key of the question that has to be true rather than an
     * expression. A rule engine here would be a language nobody asked for.
     */
    when: shown === null
      ? undefined
      : (answers: Answers): boolean => answers[shown] === true,
  };
}

function toField(question: ServerQuestion): Item['field'] {
  const common = {
    id: question.key,
    label: question.label,
    help: question.help ?? undefined,
  };

  switch (question.kind) {
    case 'notice':
      // A notice carries its sentence where everything else carries a label.
      return { kind: 'notice', id: question.key, text: question.label };

    case 'choice':
      return { kind: 'choice', id: question.key, label: question.label, options: question.options };

    case 'number':
      return {
        ...common,
        kind: 'number',
        min: question.minimum ?? undefined,
        max: question.maximum ?? undefined,
      };

    case 'longtext':
      return { ...common, kind: 'longtext' };

    case 'yesno':
      return { ...common, kind: 'yesno' };

    default:
      return { ...common, kind: 'text', placeholder: question.placeholder ?? undefined };
  }
}
