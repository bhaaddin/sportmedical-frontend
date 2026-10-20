/*
 * The guard that keeps "every colour choice changes the whole staff app" true. A cyan/aqua/teal literal written bare in
 * a stylesheet or a component is a colour the accent cannot reach; it must be wrapped (`hsl(from <c> var(--sm-hsl, h s l))`,
 * `accentCss`), come from the theme (`palette.primary`, `darkOf(theme)`, `accentLiteral(theme, ...)`), or be on the
 * short list below of values that are DATA or another product's palette, not the staff accent.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unwrappedAccentColors, wrapCssColors } from './accent';

const SRC = join(process.cwd(), 'src');

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__golden__' || entry === 'fixtures') continue;
      yield* walk(full);
    } else yield full;
  }
}

const rel = (file: string) => relative(SRC, file).split('\\').join('/');
const files = [...walk(SRC)].map((f) => ({ file: f, name: rel(f), text: readFileSync(f, 'utf8') }));
const isTest = (name: string) => /\.test\.(ts|tsx)$/.test(name) || name.startsWith('test/');

/*
 * Why each of these may hold a bare cyan-range literal:
 *  - theme.ts / accent.ts: the definitions (`DARK`, the shift's own constants)
 *  - planner demo/test data: činnost colours are the clinic's DATA (a demo činnost is teal), never the accent
 *  - FinishDialog: the "done" tick is a status green
 *  - brand.ts: the public website's own palette
 *  - model/booking.ts: the tone of the "Klub potvrzen" status counter
 */
const DATA_OR_OTHER_PALETTE = new Set([
  'theme.ts',
  'accent.ts',
  'planner/data/demoFixtures.ts',
  'planner/components/plan/testHarness.tsx',
  'planner/api/testSupport.ts',
  'planner/model/booking.ts',
  'planner/components/dialogs/plan/FinishDialog.tsx',
  'components/public/brand.ts',
  /* the printed club schedule: its own ok/no colours */
  'components/booking/ClubScheduleReport.tsx',
  /* the clinic's colour options for a calendar (data it stores), one of them is a teal */
  'utils/calendarPalette.ts',
  /* the default pick itself, and an example colour in a validation message */
  'themePrefs.ts',
  'pages/settings/colors/colorLogic.ts',
]);

/** A `var(--sm-..., <literal>)` fallback is the file's old value by design; the variable is what carries the accent. */
const withoutSmFallbacks = (text: string) => text.replace(/var\(--sm-(?!hsl\b)[a-z-]+,\s*[^()]*\)/g, 'var(--sm-x)');
/** A literal handed to `accentLiteral(theme, '...')` / `accentCss('...')` is moved to the accent at run time. */
const withoutAccentCalls = (text: string) =>
  text
    .replace(/accentLiteral\([^,]+,\s*(['"`])[^'"`]*\1\)/g, 'accentLiteral()')
    .replace(/accentCss\((['"`])[^'"`]*\1\)/g, 'accentCss()');
/** Comments may quote the prototype's values. */
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('stylesheets', () => {
  const css = files.filter((f) => f.name.endsWith('.css'));

  it('finds the stylesheets (the guard is not vacuous)', () => {
    expect(css.length).toBeGreaterThan(15);
    expect(css.some((f) => f.name === 'planner/styles/planner.css')).toBe(true);
    expect(css.some((f) => f.name === 'theme.css')).toBe(true);
  });

  /* The prototype's status variables (--green: #00e5c6 sits in the cyan hue range) are deliberately not the accent. */
  const withoutStatusVars = (text: string) => text.replace(/--(green|blue|purple|amber|red):[^;}]*/g, '');

  it.each(css.map((f) => [f.name, f] as const))('%s has no bare accent-chrome colour', (_name, f) => {
    expect(unwrappedAccentColors(withoutStatusVars(withoutComments(withoutSmFallbacks(f.text))))).toEqual([]);
  });

  it('planner.css draws hundreds of colours through --sm-hsl', () => {
    const planner = files.find((f) => f.name === 'planner/styles/planner.css')!;
    expect(planner.text.split('var(--sm-hsl, h s l)').length - 1).toBeGreaterThan(600);
  });

  it('wrapping the generated planner.css again changes nothing (the generator is idempotent)', () => {
    const planner = files.find((f) => f.name === 'planner/styles/planner.css')!;
    const body = planner.text;
    /* The semantic variables are deliberately left as the prototype has them; everything else is already wrapped. */
    const again = wrapCssColors(body).css.split('\n').filter((_, i) => i > 8);
    const original = body.split('\n').filter((_, i) => i > 8);
    const changed = again.filter((line, i) => line !== original[i]);
    expect(changed.length).toBeLessThanOrEqual(1);
    for (const line of changed) expect(line).toContain('--green:');
  });

  it('keeps the planner status variables unwrapped (--green is a status, not the accent)', () => {
    const planner = files.find((f) => f.name === 'planner/styles/planner.css')!;
    expect(planner.text).toContain('--green:#00e5c6');
    expect(planner.text).toContain('--blue:#118cff');
    expect(planner.text).toContain('--cyan:hsl(from #00e6e4 var(--sm-hsl, h s l))');
    expect(planner.text).toContain('--aqua:hsl(from #23f2e7 var(--sm-hsl, h s l))');
  });

  it('theme.css reaches the accent only through --sm-accent* variables with the old values as fallbacks', () => {
    const theme = files.find((f) => f.name === 'theme.css')!.text;
    expect(theme).toContain('--color-primary: var(--sm-accent, #0D7377);');
    expect(theme).toContain('rgba(var(--sm-accent-rgb, 13, 115, 119), 0.15)');
    expect(theme).not.toMatch(/rgba\(13,\s*115,\s*119,/);
  });
});

describe('components and modules', () => {
  const code = files.filter((f) => /\.(ts|tsx)$/.test(f.name) && !isTest(f.name) && !f.name.endsWith('.d.ts'));

  it('finds the sources (the guard is not vacuous)', () => {
    expect(code.length).toBeGreaterThan(300);
  });

  it('no component writes a prototype cyan literal where the accent cannot reach it', () => {
    const offenders = code
      .filter((f) => !DATA_OR_OTHER_PALETTE.has(f.name))
      .map((f) => ({ name: f.name, bare: unwrappedAccentColors(withoutAccentCalls(withoutComments(f.text))) }))
      .filter((f) => f.bare.length > 0);
    expect(offenders).toEqual([]);
  });

  it.each([...DATA_OR_OTHER_PALETTE])('the allow-list entry %s still exists (a stale entry hides a new offender)', (name) => {
    expect(files.some((f) => f.name === name)).toBe(true);
  });
});

describe('who sets the accent', () => {
  it('only the signed-in staff route mounts AccentRootVars (portals and booking pages keep their own themes)', () => {
    const app = files.find((f) => f.name === 'App.tsx')!.text;
    expect(app.match(/<AccentRootVars \/>/g)).toHaveLength(1);
    const start = app.indexOf('<Route path="/*"');
    const mount = app.indexOf('<AccentRootVars />');
    expect(mount).toBeGreaterThan(start);
    const publicRoutes = app.slice(app.indexOf('<Routes>'), start);
    expect(publicRoutes).not.toContain('AccentRootVars');
  });

  it('the public site bundle never imports the accent or the preferences', () => {
    const web = files.filter((f) => f.name.startsWith('web/') && !isTest(f.name));
    for (const f of web) {
      expect(f.text, f.name).not.toMatch(/from ['"][./]*\/?(accent|themePrefs|ThemePrefsProvider|AccentRootVars)['"]/);
    }
  });

  it('the patient and club portals bring their own themes', () => {
    const portal = files.find((f) => f.name === 'pages/public/PublicLayout.tsx')!.text;
    expect(portal).toContain('ThemeProvider theme={publicTheme}');
    const intake = files.find((f) => f.name === 'pages/public/IntakeQuestionnaire.tsx')!.text;
    expect(intake).toContain('ThemeProvider theme={intakeTheme}');
  });
});
