/*
 * Dumps the health questionnaire that lives in the source into JSON, so it can
 * be loaded into the database and edited in the administration.
 *
 * ── Why a script rather than retyping it ──
 *
 * Thirty-seven questions across twelve sections, taken from the clinic's own
 * PDF. Retyping them into a seed file is thirty-seven chances to change a word
 * the clinic chose, and nobody would notice until a patient answered the wrong
 * question.
 *
 * ── How the conditions are recovered ──
 *
 * An item that only appears after a "yes" carries `when`, a closure this script
 * cannot read. So it ASKS it: for every yes/no question in the definition, try
 * an answer sheet where only that one is true and see whether `when` says yes.
 * The key that flips it is the dependency. Deterministic, and it cannot quietly
 * pick the wrong one — if more or fewer than one key matches, this fails rather
 * than guessing.
 *
 * Run with:  npx tsx scripts/dumpQuestionnaire.ts > questionnaire.json
 */

import {
  HEALTH_QUESTIONNAIRE,
  DEFINITION_KEY,
  SCHEMA_VERSION,
} from '../src/services/publicIntake/healthQuestionnaire';
import type { Answers, Field, Item, Section } from '../src/services/publicIntake/healthQuestionnaire';

/** Every yes/no key in the definition — the only things a condition can read. */
const yesNoKeys: string[] = HEALTH_QUESTIONNAIRE.flatMap((section: Section) =>
  section.items
    .map((item: Item) => item.field)
    .filter((field: Field) => field.kind === 'yesno')
    .map((field: Field) => field.id),
);

function dependencyOf(item: Item): string | null {
  if (item.when === undefined) return null;

  const matches = yesNoKeys.filter((key) => {
    const sheet: Answers = {};
    sheet[key] = true;

    return item.when!(sheet);
  });

  if (matches.length !== 1) {
    throw new Error(
      `Could not tell what "${item.field.id}" depends on: ${matches.length} keys matched. ` +
        'Recover it by hand rather than letting this guess.',
    );
  }

  return matches[0];
}

/** Whether the section is only asked of women — the one section-level rule. */
function femaleOnly(section: Section): boolean {
  if (section.when === undefined) return false;

  const forWomen = section.when({ female: true });
  const forMen = section.when({ female: false });

  if (!(forWomen && !forMen)) {
    throw new Error(
      `Section "${section.id}" has a condition this script does not model. ` +
        'Add it to the schema rather than dropping it.',
    );
  }

  return true;
}

const dump = {
  key: DEFINITION_KEY,
  schemaVersion: SCHEMA_VERSION,
  name: 'Zdravotní dotazník',
  sections: HEALTH_QUESTIONNAIRE.map((section: Section, sectionIndex: number) => ({
    key: section.id,
    number: section.number,
    title: section.title,
    note: section.note ?? null,
    femaleOnly: femaleOnly(section),
    sortOrder: sectionIndex,
    questions: section.items.map((item: Item, questionIndex: number) => {
      const field = item.field;

      return {
        key: field.id,
        kind: field.kind,
        label: 'label' in field ? field.label : null,
        text: 'text' in field ? field.text : null,
        help: 'help' in field ? (field.help ?? null) : null,
        placeholder: 'placeholder' in field ? (field.placeholder ?? null) : null,
        options: 'options' in field ? [...field.options] : null,
        min: 'min' in field ? (field.min ?? null) : null,
        max: 'max' in field ? (field.max ?? null) : null,
        showWhenAnswered: dependencyOf(item),
        sortOrder: questionIndex,
      };
    }),
  })),
};

process.stdout.write(JSON.stringify(dump, null, 2));
