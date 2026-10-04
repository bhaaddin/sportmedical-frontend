/*
 * Wording of the term calendar and the success screen's calendar line. Each one is a slot in
 * Média a texty → Formuláře (club-registration section); until the registry lists them (or the
 * clinic edits them) these Czech defaults are shown.
 */
export const CAL_DEFAULTS = {
  'formulare.club-reg.cal.hint': 'Dny s volnými termíny jsou zvýrazněné. Klepněte na den a pak vyberte čas.',
  'formulare.club-reg.cal.free.1': '{n} volný',
  'formulare.club-reg.cal.free.2': '{n} volné',
  'formulare.club-reg.cal.free.5': '{n} volných',
  'formulare.club-reg.cal.busy': 'obsazeno',
  'formulare.club-reg.cal.today': 'dnes',
  'formulare.club-reg.cal.pickday': 'Vyberte den v kalendáři.',
  'formulare.club-reg.cal.times': 'Volné časy — {day}',
  'formulare.club-reg.cal.reserved': 'Klub rezervoval: {days}',
  'formulare.club-reg.done.calendar': 'Váš termín uvidí i ordinace v kalendáři.',
  'formulare.club-reg.done.ics': 'Přidat do kalendáře',
} as const;

export const CAL_KEYS = Object.keys(CAL_DEFAULTS) as (keyof typeof CAL_DEFAULTS)[];
export type CalTexts = Record<keyof typeof CAL_DEFAULTS, string>;

/** The slot text when there is one, else the default above. */
export function withCalDefaults(texts: Partial<Record<string, string>>): CalTexts {
  const out = {} as CalTexts;
  for (const key of CAL_KEYS) out[key] = (texts[key] ?? '').trim() !== '' ? (texts[key] as string) : CAL_DEFAULTS[key];
  return out;
}

/** "1 volný", "3 volné", "12 volných". */
export function freeText(n: number, t: CalTexts): string {
  const pattern = n === 1 ? t['formulare.club-reg.cal.free.1'] : n >= 2 && n <= 4 ? t['formulare.club-reg.cal.free.2'] : t['formulare.club-reg.cal.free.5'];
  return pattern.replace('{n}', String(n));
}
