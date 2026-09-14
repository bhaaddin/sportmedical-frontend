/*
 * Choosing the three colours, and the one rule that outranks the choosing.
 *
 * NEVER COLOUR ALONE
 *
 * These paint a state that is already said in words and dated. That was true
 * before the colours could be chosen and it is why choosing them is safe: a
 * green nobody can read is still a sentence somebody can. The owner's own
 * card had a coloured chip and no date once, and it was removed for exactly
 * this reason.
 *
 * So this screen's job is narrow - three colours, valid ones, and a preview
 * that shows them the way they will actually appear: with the sentence.
 */
import type { AlertColours } from '../../api/alertColours';

/** What each colour is for, in the words of the state it paints. */
export interface ColourSlot {
  key: keyof AlertColours;
  label: string;
  detail: string;
  /** The sentence it will sit next to, so the preview is honest. */
  sample: string;
}

export const COLOUR_SLOTS: ColourSlot[] = [
  {
    key: 'valid',
    label: 'Doklad platí',
    detail: 'Pokrývá termín s rezervou.',
    sample: 'Výpis ze zdravotní dokumentace — platí do 4. 3. 2027',
  },
  {
    key: 'expiringSoon',
    label: 'Brzy skončí platnost',
    detail: 'Termín ještě pokrývá, ale končí dřív, než pravidlo dovolí.',
    sample: 'Výpis ze zdravotní dokumentace — platí do 4. 10. 2026',
  },
  {
    key: 'notCovered',
    label: 'Chybí nebo prošlo',
    detail: 'Na termín to nestačí — pacient musí doklad doložit.',
    sample: 'Výpis ze zdravotní dokumentace — chybí',
  },
];

/*
 * `#rgb` or `#rrggbb`, which is what the server takes. Checked here so the
 * field says which one is wrong; the server checks too and refuses all three
 * when one is bad, and that refusal is the one that counts.
 */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function colourIsValid(value: string): boolean {
  return HEX.test(value.trim());
}

export const COLOUR_PROBLEM_TEXT =
  'Barva musí být ve tvaru #rrggbb, třeba #2e7d32.';

/** Which of the three are not colours. Empty means the save may go. */
export function badColours(colours: AlertColours): (keyof AlertColours)[] {
  return COLOUR_SLOTS
    .map((slot) => slot.key)
    .filter((key) => !colourIsValid(colours[key]));
}

export function coloursAreValid(colours: AlertColours): boolean {
  return badColours(colours).length === 0;
}

/**
 * Whether saving would change anything.
 *
 * Lower-cased on both sides, because the server stores them that way - so
 * `#2E7D32` typed over `#2e7d32` is the same colour, not an edit, and the
 * save should not light up for it.
 */
export function coloursChanged(before: AlertColours, draft: AlertColours): boolean {
  return COLOUR_SLOTS.some(
    (slot) => before[slot.key].toLowerCase() !== draft[slot.key].trim().toLowerCase(),
  );
}

/** Trimmed and lower-cased, the way the server keeps them. */
export function normalise(colours: AlertColours): AlertColours {
  return {
    valid: colours.valid.trim().toLowerCase(),
    expiringSoon: colours.expiringSoon.trim().toLowerCase(),
    notCovered: colours.notCovered.trim().toLowerCase(),
  };
}
