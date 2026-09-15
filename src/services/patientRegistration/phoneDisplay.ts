/*
 * Showing a telephone number grouped the way its own country groups it.
 *
 * "ze si kod backendu pre seba napise napriklad 777777777 ale frontend proste
 * mi ukaze toto 777 777 777 ... a takto pre kazdy stat sveta". The owner is
 * right that it should work everywhere, and the reason it can is that NOTHING
 * HERE KNOWS HOW ANY COUNTRY GROUPS ITS NUMBERS. The server does, on
 * libphonenumber, for all 245 regions it offers; this module only decides what
 * to do with the answer.
 *
 * That division is the whole point. App wrote a test for this and got the
 * German grouping wrong — expected `0151 47110815`, the numbering plan says
 * `01514 7110815` — and left the mistake in with a note, because it is the
 * argument: anybody grouping by hand writes that same wrong thing. A screen
 * that carried its own rules would carry its own version of that error, 245
 * times over.
 *
 * THE DISTINCTION THAT MATTERS
 *
 *   parses: false             cannot be read as a number at all
 *   isValidForRegion: false   readable, but half-typed or another country's
 *
 * A half-typed number arrives GROUPED and invalid. It gets the grouping and no
 * complaint: a red border on every second keystroke is a red border people
 * learn to ignore, and by the time it means something they have stopped
 * looking.
 */
import type { PhoneInspection } from '../../api/patientRegistry';

export type PhoneDisplayState =
  /** Nothing typed, or nothing asked yet. Say nothing. */
  | 'idle'
  /** Being typed. Show the grouping, complain about nothing. */
  | 'typing'
  /** A complete, valid number for the chosen country. */
  | 'valid'
  /** Readable, complete-looking, and not valid for the country chosen. */
  | 'wrong-region'
  /** Not a telephone number at all. */
  | 'unreadable';

/**
 * `typing` versus `wrong-region` is decided on length, not on the server's
 * verdict — it answers the same `isValidForRegion: false` for both, and the
 * difference is whether somebody is still going.
 *
 * Six digits is the shortest national number in use anywhere, so below it
 * nobody can be finished yet.
 */
const SHORTEST_NATIONAL_NUMBER = 6;

export function phoneDisplayState(
  inspection: PhoneInspection | null,
  typed: string,
): PhoneDisplayState {
  if (typed.trim() === '') return 'idle';
  if (inspection === null) return 'idle';
  if (!inspection.parses) return 'unreadable';
  if (inspection.isValidForRegion) return 'valid';

  const digits = typed.replace(/[^0-9]/g, '');
  return digits.length < SHORTEST_NATIONAL_NUMBER ? 'typing' : 'wrong-region';
}

/**
 * The country this clinic is in.
 *
 * It decides which numbers may be written without a dialling code, and that is
 * a fact about where the reception desk stands rather than about any number.
 * A Prague clinic writes `777 777 777` and `+421 908 123 456`; the same two
 * numbers at a Bratislava desk would be written the other way round.
 */
export const HOME_REGION = 'CZ';

/**
 * The grouping to show — the server's, never invented here.
 *
 * A LOCAL number is written without its dialling code, because everybody
 * reading it knows where they are. Anything else carries its code, because
 * `0908 123 456` on a Czech patient card is a Slovak number written the Slovak
 * way: unreadable at the desk and impossible to dial. The owner caught exactly
 * that — "v karte pacienta to je zle nemas vobec predvolbu".
 */
export function groupedDisplay(
  inspection: PhoneInspection | null,
  regionCode: string,
): string {
  if (inspection === null || !inspection.parses) return '';

  if (regionCode === HOME_REGION && inspection.national !== '') {
    return inspection.national;
  }
  /* International first for anything foreign; `national` only as a fallback
     when the server had no international form to give. */
  return inspection.international !== '' ? inspection.international : inspection.national;
}

/** Only a finished number that belongs somewhere else is worth a complaint. */
export function phoneComplaint(
  state: PhoneDisplayState,
  regionCode: string,
): string {
  if (state === 'unreadable') return 'Tohle nevypadá jako telefonní číslo.';
  if (state === 'wrong-region') {
    return `Tohle číslo neplatí pro zvolenou zemi (${regionCode}). Zkontrolujte předvolbu.`;
  }
  return '';
}

/**
 * Whether the number is far enough along to be worth asking about.
 *
 * Asking on the first keystroke is a request per character for an answer
 * nobody can use yet.
 */
export function worthInspectingPhone(typed: string): boolean {
  return typed.replace(/[^0-9]/g, '').length >= 3;
}

/**
 * A STORED number, shown wherever a patient's record is read back.
 *
 * The registration field knows which country was picked, so it goes by that.
 * A patient's card does not: it has a number out of the database and nothing
 * else, and `regionCode` on the answer says only what the screen happened to
 * ask about. The number's own country is `detectedRegionCode`.
 *
 * The rule is the same one as in the field, and it is the owner's: a local
 * number drops its dialling code because everybody at that desk knows where
 * they are, and anything foreign keeps it because `0908 123 456` on a Czech
 * card cannot be dialled and cannot be placed.
 *
 * `raw` is what the profile already had. It is returned whenever there is no
 * answer to go on, so a card never loses a telephone number it was showing.
 */
export function storedNumberDisplay(
  inspection: PhoneInspection | null,
  raw: string,
): string {
  if (inspection === null || !inspection.parses) return raw;

  if (inspection.detectedRegionCode === HOME_REGION && inspection.national !== '') {
    return inspection.national;
  }
  return inspection.international !== '' ? inspection.international : raw;
}
