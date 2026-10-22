/*
 * "The default accent renders exactly the prototype look": the picture of the theme as it was before accents reached
 * dark mode (committed in src/test/fixtures, taken from the code at 5a7d11a) is compared with the theme built now.
 *
 * Deliberate changes since (stage 3b, R5): the --sm-pop-* / --sm-tone-* custom properties, outlined/filled Alert and SnackbarContent
 * overrides (they were invisible / unreadable), the field border 3:1 (FIELD_EDGE) and muted text #5A636D (4.5:1 on a selected item).
 * Every other value is the prototype's, as before.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTheme, THEME_ACCENTS } from './theme';
import { themePicture } from './test/themeSerialize';

const fixture = (mode: 'dark' | 'light') =>
  JSON.parse(readFileSync(join(process.cwd(), 'src', 'test', 'fixtures', `theme-default-${mode}.json`), 'utf8')) as unknown;
const picture = (accent: string, mode: 'dark' | 'light') => JSON.parse(JSON.stringify(themePicture(buildTheme(accent, mode)))) as unknown;

describe('the default accent is the prototype look, unchanged', () => {
  it.each(['dark', 'light'] as const)('the %s theme built for the default accent equals the committed picture', (mode) => {
    expect(picture(THEME_ACCENTS[0].color, mode)).toEqual(fixture(mode));
  });
  it.each(['dark', 'light'] as const)('a lower-case default accent builds the same %s theme', (mode) => {
    expect(picture(THEME_ACCENTS[0].color.toLowerCase(), mode)).toEqual(fixture(mode));
  });
  it.each(['dark', 'light'] as const)('a stored value that is not a colour builds the default %s theme', (mode) => {
    for (const junk of ['', 'red', 'undefined', '#ZZZZZZ', 'rgb(1,2,3)', '#12345', '#FFFFFF', '#fff']) {
      expect(picture(junk, mode)).toEqual(fixture(mode));
    }
  });
});
