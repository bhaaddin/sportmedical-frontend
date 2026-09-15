/*
 * Picking one address out of 3 021 203.
 *
 * Every rule here exists because the live catalogue is not as tidy as a form
 * would like, and all four were measured on 15. 9. 2026 rather than reasoned
 * about. The village rule is the expensive one: treating the street as a
 * required step hides every address outside a town, and that is exactly what
 * this module's predecessor did — `searchPoints` took `streetCode` as a
 * required argument, so no village address could be found at all, in
 * registration or in the public questionnaire.
 */
import { describe, it, expect } from 'vitest';
import {
  CATALOGUE_EMPTY_TEXT, CAPPED_HINT, NO_STREET_HINT, RESULT_LIMIT,
  ambiguousDisplayValues, canSearchPoints, catalogueBlocksRegistration,
  catalogueState, catalogueSummary, formatPostalCode, hasNoStreet,
  houseNumberLabel, isAmbiguous, resultsAreCapped,
} from './addressPicking';
import type { CatalogueStatusLike, LocalityLike } from './addressPicking';

const street = (over: Partial<LocalityLike> = {}): LocalityLike => ({
  streetCode: 21300,
  streetName: 'Bělohorská',
  municipalityPartCode: 490415,
  municipalityPartName: 'Židenice',
  municipalityCode: 582786,
  municipalityName: 'Brno',
  displayValue: 'Bělohorská — Židenice, Brno',
  ...over,
});

/* Measured: `Bohuslavice — Bohuslavice`, streetCode and streetName both null. */
const village = (over: Partial<LocalityLike> = {}): LocalityLike => street({
  streetCode: null,
  streetName: null,
  municipalityPartCode: 6483,
  municipalityPartName: 'Bohuslavice',
  municipalityCode: 6483,
  municipalityName: 'Bohuslavice',
  displayValue: 'Bohuslavice — Bohuslavice',
  ...over,
});

const status = (over: Partial<CatalogueStatusLike> = {}): CatalogueStatusLike => ({
  loaded: true,
  addressPointCount: 3021203,
  datasetDate: '2026-08-31',
  ...over,
});

describe('whether the catalogue can be used at all', () => {
  it('is ready when it is loaded and holds something', () => {
    expect(catalogueState(status())).toBe('ready');
  });

  it('is empty when it answers with nothing', () => {
    expect(catalogueState(status({ loaded: false }))).toBe('empty');
    expect(catalogueState(status({ addressPointCount: 0 }))).toBe('empty');
  });

  /*
   * An unanswered request is not an empty catalogue. Refusing to let somebody
   * work because a status call was slow is worse than the failure it prevents.
   */
  it('is unknown before the answer arrives, and that is not empty', () => {
    expect(catalogueState(null)).toBe('unknown');
    expect(catalogueState(undefined)).toBe('unknown');
  });

  /*
   * The whole point of asking first: the request carries a RÚIAN code and the
   * Domain refuses anything but a positive one, so without a catalogue the
   * save cannot succeed. Thirty fields typed and then a failure is the thing
   * this prevents.
   */
  it('stops registration only on a measured empty', () => {
    expect(catalogueBlocksRegistration('empty')).toBe(true);
    expect(catalogueBlocksRegistration('ready')).toBe(false);
    expect(catalogueBlocksRegistration('unknown')).toBe(false);
  });

  it('says why, and who can fix it', () => {
    expect(CATALOGUE_EMPTY_TEXT).toMatch(/nejde zaregistrovat/);
    expect(CATALOGUE_EMPTY_TEXT).toMatch(/správci/);
  });

  it('says how big it is and how old', () => {
    expect(catalogueSummary(status())).toContain('adres');
    expect(catalogueSummary(status())).toContain('31. 8. 2026');
  });

  it('says the size even with no dataset date', () => {
    const text = catalogueSummary(status({ datasetDate: null }));
    expect(text).toContain('adres');
    expect(text).not.toContain('dataset');
  });
});

describe('a village with no street', () => {
  /* The expensive one. A required street step hides every address outside a
     town, and 3 021 203 points include a great many villages. */
  it('is recognised by a null street code', () => {
    expect(hasNoStreet(village())).toBe(true);
    expect(hasNoStreet(street())).toBe(false);
  });

  it('says so, so nobody hunts for a street that does not exist', () => {
    expect(NO_STREET_HINT).toMatch(/ulice nemá/);
  });

  /* A village numbers buildings off the municipality part, and they may be
     `č.p.` or `č.ev.` - the label says which box this is. */
  it('asks for the number the place actually uses', () => {
    expect(houseNumberLabel(village())).toMatch(/evidenční/);
    expect(houseNumberLabel(street())).toMatch(/orientační/);
  });

  it('asks for something sensible before anything is chosen', () => {
    expect(houseNumberLabel(null).trim()).not.toBe('');
  });
});

describe('the list is a slice, not the answer', () => {
  /* Measured: `limit=100` comes back with 25. A full page is never "all of
     them", and silence teaches people their street is not in the catalogue. */
  it('notices a full page', () => {
    expect(resultsAreCapped(RESULT_LIMIT)).toBe(true);
    expect(resultsAreCapped(RESULT_LIMIT - 1)).toBe(false);
  });

  it('says how to narrow it, with an example', () => {
    expect(CAPPED_HINT).toMatch(/25/);
    expect(CAPPED_HINT).toMatch(/Vinohrady/);
  });
});

describe('two places with the same name', () => {
  /*
   * Three different Bohuslavice come back with the identical display value and
   * differ only by a code no human knows. Picking the wrong one puts a patient
   * in the wrong village, quietly.
   */
  it('finds the rows that cannot be told apart', () => {
    const rows = [
      village({ municipalityPartCode: 6483 }),
      village({ municipalityPartCode: 6467 }),
      village({ municipalityPartCode: 6491 }),
      street(),
    ];
    expect(ambiguousDisplayValues(rows)).toEqual(['Bohuslavice — Bohuslavice']);
  });

  it('says nothing when every row is distinct', () => {
    expect(ambiguousDisplayValues([street(), village()])).toEqual([]);
  });

  it('marks the rows that need telling apart', () => {
    const ambiguous = ['Bohuslavice — Bohuslavice'];
    expect(isAmbiguous(village(), ambiguous)).toBe(true);
    expect(isAmbiguous(street(), ambiguous)).toBe(false);
  });

  /* Their postal codes are what separates them: 588 56, 549 06, 798 56. */
  it('prints a postal code the Czech way', () => {
    expect(formatPostalCode('58856')).toBe('588 56');
    expect(formatPostalCode('549 06')).toBe('549 06');
  });

  it('leaves anything that is not five digits alone', () => {
    expect(formatPostalCode('')).toBe('');
    expect(formatPostalCode('1234')).toBe('1234');
  });
});

describe('when the house-number box may ask', () => {
  /* The server refuses an empty `q` with a 400, so an empty box asks nothing
     rather than asking wrongly. */
  it('waits for a locality and a number', () => {
    expect(canSearchPoints(null, '12')).toBe(false);
    expect(canSearchPoints(street(), '')).toBe(false);
    expect(canSearchPoints(street(), '   ')).toBe(false);
    expect(canSearchPoints(street(), '12')).toBe(true);
  });

  /* A village can be asked without a street - that is the whole fix. */
  it('asks for a village the same as for a street', () => {
    expect(canSearchPoints(village(), '1')).toBe(true);
  });
});
