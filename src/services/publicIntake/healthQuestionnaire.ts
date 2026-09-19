/* ══════════════════════════════════════════════════════════════
   ZDRAVOTNÍ DOTAZNÍK — question definition

   Transcribed from the clinic's own PDF:
   cdn.shopify.com/s/files/1/0913/0799/9614/files/zdravotni_dotaznik.pdf
   downloaded and text-extracted on 18. 9. 2026. 9 sections, ~76 answers.

   ── THIS FILE IS IN THE WRONG PLACE AND EVERYONE KNOWS IT ──

   Questions about a patient's health belong in the domain, next to the rules
   that read them, not in a browser. `CzechQuestionnaireCatalog` is where they
   go, and the API that serves them is `/api/questionnaires/*`.

   They are here because that model cannot yet express this form. It has no
   sections — `CzechQuestionnaireCatalog.cs:157` smuggles them into the prompt
   as `[01] Title: question`, which a patient would read literally. It has no
   rule for showing a question only when another was answered "ano", which this
   form needs thirteen times. It has no grouped or repeating answers, which the
   family table needs. And none of it is reachable without a login.

   The owner was told all of that and said, in as many words:

     "for know creat it as it is later befor preduction we wil fix it
      its not a big deal"

   So it is built here, working, and the wording is right — which is the part
   that is expensive to get right and cheap to move. When the domain can carry
   the form, this file is deleted and the renderer is pointed at the API. That
   is a real migration and it is not free, and it is worth writing down that it
   was chosen deliberately rather than arrived at by accident.

   ── While it lives here ──

   Nothing in this file decides anything clinical. It is wording and shape: what
   is asked, in what order, and what follows from a yes. No rule reads it.
   ══════════════════════════════════════════════════════════════ */

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

/** Answered yes — the trigger for every "→ Pokud ano" follow-up. */
const yes = (id: string) => (answers: Answers): boolean => answers[id] === true;

/** A yes/no question and the box that opens under it when the answer is yes. */
const asked = (id: string, label: string, followUp: string, help?: string): Item[] => [
  { field: { kind: 'yesno', id, label, help } },
  { field: { kind: 'longtext', id: `${id}_detail`, label: followUp }, when: yes(id) },
];

/** A plain yes/no with nothing following it. */
const plain = (id: string, label: string): Item => ({ field: { kind: 'yesno', id, label } });

export const HEALTH_QUESTIONNAIRE: readonly Section[] = [
  {
    id: 'lekar',
    number: '1',
    title: 'Váš praktický lékař',
    note: 'Zbytek osobních údajů už máme z registrace výše — znovu je nevyplňujete.',
    items: [
      {
        field: {
          kind: 'text',
          id: 'prakticky_lekar',
          label: 'Jméno a adresa praktického lékaře',
          placeholder: 'MUDr. Jan Novák, Vinohradská 12, Praha 2',
        },
      },
    ],
  },

  {
    id: 'sport',
    number: '2',
    title: 'Sportovní anamnéza',
    items: [
      { field: { kind: 'text', id: 'sport_hlavni', label: 'Hlavní sport' } },
      { field: { kind: 'text', id: 'sport_klub', label: 'Sportovní klub' } },
      { field: { kind: 'text', id: 'sport_trener', label: 'Jméno trenéra' } },
      {
        field: {
          kind: 'text',
          id: 'sport_treninky',
          label: 'Počet tréninků a hodin týdně',
          placeholder: 'například 5 tréninků / 8 hodin',
        },
      },
      {
        field: {
          kind: 'choice',
          id: 'sport_uroven',
          label: 'Soutěžní úroveň',
          options: ['Rekreační', 'Amatérská', 'Profesionální'],
        },
      },
    ],
  },

  {
    id: 'rodina',
    number: '3',
    title: 'Rodinná anamnéza',
    note: 'Údaje o rodinných příslušnících a o zdravotních obtížích v rodině.',
    items: [
      {
        field: {
          kind: 'notice',
          id: 'rodina_notice',
          text: 'U každého příbuzného uveďte věk. Pokud zemřel, uveďte prosím i příčinu úmrtí.',
        },
      },
      ...RELATIVES.flatMap((relative): Item[] => [
        {
          field: {
            kind: 'number',
            id: `rodina_${relative.toLowerCase()}_vek`,
            label: `${relative} — věk`,
            min: 0,
            max: 120,
          },
        },
        {
          field: {
            kind: 'text',
            id: `rodina_${relative.toLowerCase()}_umrti`,
            label: `${relative} — příčina úmrtí`,
            help: 'Nechte prázdné, pokud žije.',
          },
        },
      ]),
      {
        field: {
          kind: 'notice',
          id: 'rodina_nemoci_notice',
          text: 'U každého onemocnění označte, kterého příbuzného se týká. Můžete označit více osob, nebo žádnou.',
        },
      },
      ...([
        'Rakovina',
        'Cukrovka (diabetes)',
        'Chudokrevnost (anémie)',
        'Onemocnění krve',
        'Srdeční onemocnění',
        'Infarkt myokardu',
        'Vysoký krevní tlak',
        'Onemocnění ledvin',
        'Cévní mozková příhoda',
      ] as const).map((nemoc, index): Item => ({
        field: { kind: 'relatives', id: `rodina_nemoc_${index}`, label: nemoc },
      })),
    ],
  },

  {
    id: 'zakladni',
    number: '4',
    title: 'Osobní anamnéza — základní informace',
    items: [
      ...asked(
        'oa_odbornik',
        'Navštěvujete pravidelně nějakého odborného lékaře? Jste dlouhodobě sledován?',
        'Uveďte obor',
      ),
      {
        field: {
          kind: 'notice',
          id: 'oa_odbornik_zprava',
          // Verbatim from the PDF, exclamation mark and all. It is the sentence
          // that connects this form to the výpis the clinic cannot do without.
          text: 'Nutné přinést lékařskou zprávu!',
        },
        when: yes('oa_odbornik'),
      },
      ...asked('oa_prohlidka', 'Absolvoval/a jste někdy sportovní lékařskou prohlídku?', 'Kde a kdy'),
      ...asked('oa_zakaz', 'Byl vám někdy zakázán sport ze zdravotních důvodů?', 'Kdy a proč'),
      ...asked('oa_hospitalizace', 'Byl/a jste někdy hospitalizován/a (ležel/la v nemocnici)?', 'Uveďte důvod'),
      ...asked('oa_leky', 'Užíváte v současnosti nějaké léky – ať už na předpis nebo volně prodejné?', 'Jaké'),
      ...asked(
        'oa_doplnky',
        'Užíval/a jste někdy doplňky stravy, vitamíny nebo přípravky na hubnutí či zlepšení sportovního výkonu?',
        'Jaké',
      ),
    ],
  },

  {
    id: 'operace',
    number: '5',
    title: 'Operace a úrazy',
    items: [
      ...asked('ou_operace', 'Podstoupil/a jste někdy chirurgický zákrok nebo operaci?', 'Uveďte typ a rok'),
      ...asked(
        'ou_zlomenina',
        'Měl/a jste někdy úraz, při kterém došlo ke zlomenině nebo vykloubení?',
        'Uveďte podrobnosti (část těla, rok)',
      ),
      ...asked('ou_hlava', 'Měl/a jste úraz hlavy nebo otřes mozku?', 'Kdy a za jakých okolností'),
    ],
  },

  {
    id: 'alergie',
    number: '6',
    title: 'Alergie a kožní reakce',
    items: [
      ...asked('al_alergie', 'Máte diagnostikovanou alergii na léky, potraviny nebo jiné látky?', 'Specifikujte'),
      plain('al_ekzem', 'Trpíte ekzémem, vyrážkou, svěděním, puchýři nebo jinými kožními problémy?'),
      plain('al_zatez', 'Objevují se u vás kožní reakce po fyzické zátěži (např. zarudnutí, vyrážka)?'),
    ],
  },

  {
    id: 'gynekologie',
    number: '7',
    title: 'Gynekologická anamnéza',
    note: 'Vyplňují pouze ženy.',
    // Taken from the sex already given in registration — which the birth number
    // usually filled in — so nobody is asked twice and no man sees this section.
    when: ({ female }) => female,
    items: [
      { field: { kind: 'number', id: 'gyn_menarche', label: 'V kolika letech začala menstruace?', min: 6, max: 25 } },
      plain('gyn_bolestiva', 'Míváte bolestivou menstruaci?'),
      ...asked('gyn_potize', 'Gynekologické potíže nebo operace?', 'Upřesněte'),
      plain('gyn_pravidelny', 'Je cyklus pravidelný?'),
      plain('gyn_antikoncepce', 'Užíváte hormonální antikoncepci?'),
    ],
  },

  {
    id: 'infekcni',
    number: '8',
    title: 'Infekční onemocnění',
    note: 'Prodělal/a jste některé z těchto onemocnění?',
    items: ([
      'Mononukleóza',
      'Infekční žloutenka',
      'Spála',
      'Opakované angíny',
      'Zarděnky',
      'COVID-19',
      'Zánět mozkových blan',
      'Plané neštovice',
    ] as const).map((nemoc, index) => plain(`inf_${index}`, nemoc)),
  },

  {
    id: 'kardio',
    number: '9',
    title: 'Kardiovaskulární onemocnění',
    // The six that stop an examination. Whatever else gets shortened, this block
    // stays complete and stays legible.
    items: ([
      'Vrozená srdeční vada',
      'Vysoký krevní tlak',
      'Mdloby nebo závratě při námaze',
      'Pocity bušení srdce',
      'Pocity vynechávání rytmu',
      'Bolesti na hrudi při zátěži',
    ] as const).map((nemoc, index) => plain(`kv_${index}`, nemoc)),
  },

  {
    id: 'dychani',
    number: '10',
    title: 'Dýchací potíže',
    items: ([
      'Astma',
      'Astma – záchvat',
      'Dušnost nebo sípot při zátěži',
      'Kašel nebo stažené dýchání po zátěži',
    ] as const).map((nemoc, index) => plain(`dy_${index}`, nemoc)),
  },

  {
    id: 'neuro',
    number: '11',
    title: 'Neurologické stavy',
    items: ([
      'Epilepsie nebo křečové stavy',
      'Omdlévání, bezvědomí',
      'Časté nebo silné bolesti hlavy',
    ] as const).map((stav, index) => plain(`ne_${index}`, stav)),
  },

  {
    id: 'metabolicke',
    number: '12',
    title: 'Metabolické, endokrinní a jiné',
    items: ([
      'Cukrovka (diabetes)',
      'Poruchy štítné žlázy',
    ] as const).map((stav, index) => plain(`me_${index}`, stav)),
  },
];

/**
 * The closing paragraph, verbatim from the PDF. Shown whole and never
 * summarised: it is what the patient is affirming, and a paraphrase of a
 * declaration is a different declaration.
 */
export const DECLARATION =
  'Údaje uvedené v tomto dotazníku slouží výhradně pro účely posouzení zdravotní '
  + 'způsobilosti ke sportovní činnosti. Jsou zpracovávány v souladu s nařízením '
  + '(EU) 2016/679 (GDPR) a zákonem č. 372/2011 Sb., o zdravotních službách. '
  + 'Prohlašuji, že všechny uvedené informace jsou pravdivé a úplné, a že jsem si '
  + 'vědom/a důsledků uvedení nepravdivých nebo neúplných údajů. Současně si '
  + 'uvědomuji, že sportovní zátěž může být spojena s určitými zdravotními riziky. '
  + 'Svým podpisem uděluji souhlas se zpracováním poskytnutých údajů za výše '
  + 'uvedeným účelem.';

/** Sections that apply, given what registration already knows. */
export const sectionsFor = (female: boolean): readonly Section[] =>
  HEALTH_QUESTIONNAIRE.filter((section) => section.when === undefined || section.when({ female }));

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
 * Which set of questions these answers belong to, and which revision of it.
 *
 * Stored with every submission so a row read in two years can still be matched
 * to the questions it answered. Bump `SCHEMA_VERSION` whenever a question is
 * added, removed or reworded — not when the layout changes.
 */
export const DEFINITION_KEY = 'sportmedical-cz-zdravotni-dotaznik';
export const SCHEMA_VERSION = 1;

/**
 * The answers, in the shape the API takes.
 *
 * Only what was actually answered: an untouched question is absent rather than
 * sent as null, because a form where nobody answered anything should arrive as
 * nothing at all and not as 76 empty rows. Returns `undefined` for that case,
 * which is what keeps the field off the request entirely.
 */
/** One answer as the API takes it: whichever of the three kinds it is. */
export interface SubmittedAnswer {
  questionId: string;
  text?: string | null;
  yesNo?: boolean | null;
  choices?: string[] | null;
}

export const answersForSubmission = (
  answers: Answers,
): { definitionKey: string; schemaVersion: number; answers: SubmittedAnswer[] } | undefined => {
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
    : { definitionKey: DEFINITION_KEY, schemaVersion: SCHEMA_VERSION, answers: given };
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
