/*
 * What a rule actually does, in words, and what it may be set to.
 *
 * Until 14. 9. 2026 a rule was only "šablona × služba" and everything it did
 * was fixed in the source. The owner's objection: "to pravidlo musi mat
 * nastavenia ... a nastavit ci vsetky veci ktore su teraz v kode natvrdo".
 *
 * Four settings now, and each needs saying in the words of what happens at the
 * desk rather than the words of the field:
 *
 *     validityMonths   how long the document covers a visit, from its ISSUE
 *                      date, not from when it was uploaded. 0 = never expires
 *     warnDaysBefore   how many days ahead the card goes amber. 0 = never
 *     firstVisitOnly   asked once, or at every visit
 *     blocksBooking    a missing document REFUSES the booking, rather than
 *                      warning the desk
 *
 * The last one is not another switch in a row. It reverses the owner's own
 * rule from plan 2.4 - paperwork always warns, because the patient is on the
 * telephone and needs a slot now - so it is asked about separately and said
 * plainly.
 */

export interface RequirementSettingsLike {
  validityMonths: number;
  warnDaysBefore: number;
  firstVisitOnly: boolean;
  blocksBooking: boolean;
}

/** The server's own defaults, measured off the live contract on 14. 9. 2026. */
export const SERVER_DEFAULTS: RequirementSettingsLike = {
  validityMonths: 12,
  warnDaysBefore: 30,
  firstVisitOnly: false,
  blocksBooking: false,
};

/*
 * Two years is not a rule, it is a guard rail. Nothing in the domain forbids
 * a longer one; this only catches a typed digit too many before it becomes a
 * document that outlives the patient's season by a decade.
 */
export const MAX_VALIDITY_MONTHS = 240;
export const MAX_WARN_DAYS = 365;

export type SettingsProblem =
  | 'validity-negative'
  | 'validity-too-large'
  | 'warn-negative'
  | 'warn-too-large'
  /** Warning further ahead than the document ever lasts means warning always. */
  | 'warn-outlives-validity';

export const SETTINGS_PROBLEM_TEXT: Record<SettingsProblem, string> = {
  'validity-negative': 'Platnost nemůže být záporná. Zadejte 0, pokud nikdy nevyprší.',
  'validity-too-large': `Platnost přes ${MAX_VALIDITY_MONTHS} měsíců je nejspíš překlep. Zadejte 0, pokud nemá vypršet.`,
  'warn-negative': 'Počet dní nemůže být záporný. Zadejte 0, pokud se nemá upozorňovat.',
  'warn-too-large': `Upozorňovat víc než ${MAX_WARN_DAYS} dní dopředu nedává smysl.`,
  'warn-outlives-validity':
    'Upozornění by začalo dřív, než doklad vůbec začne platit — svítilo by pořád.',
};

/**
 * What is wrong with these settings, if anything.
 *
 * The server refuses negatives with a 400; catching them here is not about
 * trusting it less, it is about saying which field and why, at the field,
 * rather than as one red sentence after the save.
 */
export function settingsProblems(
  settings: RequirementSettingsLike,
): SettingsProblem[] {
  const problems: SettingsProblem[] = [];

  if (settings.validityMonths < 0) problems.push('validity-negative');
  else if (settings.validityMonths > MAX_VALIDITY_MONTHS) problems.push('validity-too-large');

  if (settings.warnDaysBefore < 0) problems.push('warn-negative');
  else if (settings.warnDaysBefore > MAX_WARN_DAYS) problems.push('warn-too-large');

  /*
   * Only when the document expires at all. With `validityMonths: 0` it never
   * does, so no warning window can outrun it - and 30 days of amber before a
   * document that never expires simply never happens.
   */
  if (
    problems.length === 0
    && settings.validityMonths > 0
    && settings.warnDaysBefore > settings.validityMonths * 30
  ) {
    problems.push('warn-outlives-validity');
  }

  return problems;
}

export function settingsAreValid(settings: RequirementSettingsLike): boolean {
  return settingsProblems(settings).length === 0;
}

/** "Platí 12 měsíců od vystavení · upozorní 30 dní předem · při každé návštěvě" */
export function settingsSummary(settings: RequirementSettingsLike): string {
  const validity = settings.validityMonths === 0
    ? 'Nevyprší'
    : `Platí ${monthsText(settings.validityMonths)} od vystavení`;

  const warning = settings.warnDaysBefore === 0
    ? 'neupozorňuje předem'
    : `upozorní ${daysText(settings.warnDaysBefore)} předem`;

  const when = settings.firstVisitOnly ? 'jen při první návštěvě' : 'při každé návštěvě';

  const blocking = settings.blocksBooking ? ' · bez něj nejde objednat' : '';

  return `${validity} · ${warning} · ${when}${blocking}`;
}

/* Czech counts one, a few and many differently, and these sentences are read
   at a desk rather than by a machine. */
function monthsText(n: number): string {
  if (n === 1) return '1 měsíc';
  if (n <= 4) return `${n} měsíce`;
  return `${n} měsíců`;
}

function daysText(n: number): string {
  if (n === 1) return '1 den';
  if (n <= 4) return `${n} dny`;
  return `${n} dní`;
}

/*
 * Whether the blocking this rule promises will actually happen.
 *
 * Booking only looks at the výpis when an appointment is made - their query
 * narrows to `template.Type == DocumentType.Vypis`. A rule on any other
 * template refuses nothing, even with the switch on, and the owner has said
 * he is leaving that for later rather than now.
 *
 * So the screen must not promise it. A switch that says "bez něj nejde
 * objednat" while booking never asks is exactly the shape this project keeps
 * deleting: a setting that looks obeyed and is not.
 */
export const VYPIS_TEMPLATE_TYPE = 'Vypis';

export function blockingWillHappen(templateType: string | undefined): boolean {
  return templateType === VYPIS_TEMPLATE_TYPE;
}

export const BLOCKING_IGNORED_TEXT =
  'Objednávání dnes kontroluje jen výpis ze zdravotní dokumentace. U tohohle '
  + 'dokumentu se zákaz neuplatní — pravidlo bude dál jen upozorňovat.';

/** Said before the switch is thrown, not after. */
export const BLOCKING_CONFIRM_TEXT =
  'Zapnutím tohohle pravidla přestane jít objednat pacienta, kterému doklad chybí. '
  + 'Recepce ho nebude moci objednat ani po telefonu — dozví se jen, že doklad chybí. '
  + 'Zatím je to všude vypnuté a podklady se jen připomínají.';
