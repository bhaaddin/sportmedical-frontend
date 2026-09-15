/*
 * Picking one address out of 3 021 203, and the four ways that goes wrong.
 *
 * Registration stores a residence as a single RÚIAN address-point code - the
 * Domain refuses anything but a positive one - so this control never lets
 * anybody invent an address. That makes the catalogue load-bearing, and every
 * rule below exists because something in it is not as tidy as a form would
 * like. All four were measured against the live catalogue on 15. 9. 2026, not
 * reasoned about.
 *
 *   the catalogue is not loaded    registration cannot be completed AT ALL
 *   a village has no street        the street step, if required, hides it
 *   results are capped at 25       a short query shows a slice, silently
 *   three villages share a name    `Bohuslavice — Bohuslavice`, three times
 */

export interface LocalityLike {
  streetCode: number | null;
  streetName: string | null;
  municipalityPartCode: number;
  municipalityPartName: string;
  municipalityCode: number;
  municipalityName: string;
  displayValue: string;
}

export interface CatalogueStatusLike {
  loaded: boolean;
  addressPointCount: number;
  datasetDate?: string | null;
}

/* ── 1 · the catalogue itself ── */

export type CatalogueState =
  /** Loaded and usable. */
  | 'ready'
  /** Answered, and there is nothing in it. Registration cannot finish. */
  | 'empty'
  /** No answer yet, or the request failed. Not the same as empty. */
  | 'unknown';

export function catalogueState(status: CatalogueStatusLike | null | undefined): CatalogueState {
  if (status === null || status === undefined) return 'unknown';
  return status.loaded && status.addressPointCount > 0 ? 'ready' : 'empty';
}

/**
 * Whether the screen must stop somebody before they start typing.
 *
 * Only on `empty` - a measured, answered "there is nothing here". `unknown` is
 * a request that has not come back, and refusing to let somebody work because
 * a status call was slow would be worse than the failure it prevents.
 */
export function catalogueBlocksRegistration(state: CatalogueState): boolean {
  return state === 'empty';
}

export const CATALOGUE_EMPTY_TEXT =
  'Registr adres RÚIAN není načtený, takže pacienta teď nejde zaregistrovat — '
  + 'adresa se zapisuje jeho kódem a ten se nedá vypsat ručně. Řekněte to '
  + 'správci; katalog se nahrává jednou a pak drží.';

/** "3 021 203 adres · dataset z 31. 8. 2026" */
export function catalogueSummary(status: CatalogueStatusLike): string {
  const count = status.addressPointCount.toLocaleString('cs-CZ');
  if (status.datasetDate === null || status.datasetDate === undefined || status.datasetDate === '') {
    return `${count} adres`;
  }
  const [y, m, d] = status.datasetDate.split('-');
  return `${count} adres · dataset z ${Number(d)}. ${Number(m)}. ${y}`;
}

/* ── 2 · a village has no street ── */

/**
 * A locality with no street of its own.
 *
 * `Bohuslavice — Bohuslavice` comes back with `streetCode: null` and
 * `streetName: null`, and its buildings are numbered off the municipality part.
 * Treating the street as a required step is what hides every address outside a
 * town - the single most expensive mistake available here.
 */
export function hasNoStreet(locality: LocalityLike): boolean {
  return locality.streetCode === null;
}

export const NO_STREET_HINT =
  'Tahle obec ulice nemá — čísla se zadávají rovnou k ní.';

/* ── 3 · the list is a slice, not the answer ── */

/**
 * The server caps results at 25 whatever is asked for - `limit=100` answers
 * with 25, measured. So a full page is never "all of them", and a screen that
 * does not say so teaches people that their street is not in the catalogue.
 */
export const RESULT_LIMIT = 25;

export function resultsAreCapped(count: number): boolean {
  return count >= RESULT_LIMIT;
}

export const CAPPED_HINT =
  'Zobrazeno prvních 25. Přidejte obec — „Americká Vinohrady“ najde jednu, '
  + 'samotné „Americká“ dvacet pět.';

/* ── 4 · two places with the same name ── */

/**
 * Which rows cannot be told apart by what they show.
 *
 * Three different Bohuslavice come back with the identical `displayValue`, and
 * the only thing separating them in the locality answer is a code no human
 * knows. Their postal codes differ - 588 56, 549 06, 798 56 - but the locality
 * endpoint does not carry one, so the screen has to go and fetch a sample
 * building for each. That is three extra calls in a rare case, which is the
 * right trade against picking the wrong village.
 */
export function ambiguousDisplayValues(localities: readonly LocalityLike[]): string[] {
  const seen = new Map<string, number>();
  for (const locality of localities) {
    seen.set(locality.displayValue, (seen.get(locality.displayValue) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([value]) => value);
}

export function isAmbiguous(locality: LocalityLike, ambiguous: readonly string[]): boolean {
  return ambiguous.includes(locality.displayValue);
}

/** "588 56" → "588 56"; a five-digit code is printed the Czech way. */
export function formatPostalCode(postalCode: string): string {
  const digits = postalCode.replace(/\s/g, '');
  return digits.length === 5 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : postalCode;
}

/* ── what the second box asks for ── */

/**
 * The house-number box is useless until a locality is chosen, and the server
 * refuses an empty `q` with a 400 - so an empty box asks nothing rather than
 * asking wrongly.
 */
export function canSearchPoints(
  locality: LocalityLike | null,
  houseNumber: string,
): boolean {
  return locality !== null && houseNumber.trim().length > 0;
}

export function houseNumberLabel(locality: LocalityLike | null): string {
  if (locality === null) return 'Číslo popisné';
  return hasNoStreet(locality) ? 'Číslo popisné nebo evidenční' : 'Číslo popisné / orientační';
}
