/*
 * The rules of the fit-the-window work, kept as source guards because jsdom has no layout engine:
 *
 *   - a DATA page (a table, a list, a board, a card grid) has no fixed narrow `maxWidth` on its root: it takes the width
 *     that is there. A form or reading page may be centred, but then with a fluid width (`clamp(...)`/`min(...)`) so the
 *     gutters are equal on both sides.
 *   - the page is as tall as the window: no `100vh` on a staff screen (a phone's address bar makes vh taller than the
 *     screen) - `100dvh`.
 *   - the document never scrolls: the Layout's region is the one scroller.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(__dirname, '../..', rel), 'utf8');

/** The pages that were re-laid out to fill the width; each had `maxWidth: 1000..1240` on its root. */
const DATA_PAGES = [
  'pages/booking/DayOverviewPage.tsx',
  'pages/booking/ServiceOverviewPage.tsx',
  'pages/booking/PartnerOrdersPage.tsx',
  'pages/booking/BlockedTimePage.tsx',
  'pages/Settings.tsx',
  'pages/PatientRegistration.tsx',
  'pages/PatientForm.tsx',
  'pages/patients/PatientLayout.tsx',
  'pages/Billing.tsx',
  'pages/PatientList.tsx',
  'pages/Dashboard.tsx',
];

describe('data pages take the width that is there', () => {
  it.each(DATA_PAGES)('%s has no fixed narrow maxWidth of 900 - 1400 px on a container', (file) => {
    const source = read(file);
    const fixed = source.match(/maxWidth:\s*["']?(9\d\d|1[0-4]\d\d)["']?\s*[,}]/g) ?? [];
    expect(fixed).toEqual([]);
  });

  it('the settings frame is capped only by a width that leaves equal gutters, and a wide-table page not at all', () => {
    const style = read('components/settings/settingsStyle.ts');
    expect(style).toMatch(/SETTINGS_MAX_WIDTH = 2400/);
    const frame = read('pages/settings/SettingsFrame.tsx');
    /* `aside: false` (the table that wants every pixel) gets no maxWidth, and the others are centred. */
    expect(frame).toMatch(/const maxWidth = wide \? undefined : /);
    expect(frame).toMatch(/mx: 'auto'/);
  });
});

describe('the page is as tall as the window, never taller', () => {
  it('the Layout is 100dvh with one scroll region, and the planner keeps its own sizing', () => {
    const app = read('App.tsx') + read('StaffApp.tsx');
    expect(app).toMatch(/height: '100dvh'/);
    expect(app).toMatch(/id="fit-region"/);
    expect(app).toMatch(/isPlannerRoute\(location\.pathname\)/);
  });

  it.each(['pages/Login.tsx', 'components/GlobalErrorBoundary.tsx', 'pages/settings/SettingsFrame.tsx', 'App.tsx', 'StaffApp.tsx'])(
    '%s uses dvh where it means "the window"',
    (file) => {
      const source = read(file);
      /* The staff Layout keeps `minHeight: '100vh'` for the planner's untouched branch only. */
      const vh = (source.match(/['"]100vh['"]/g) ?? []).length;
      expect(vh).toBeLessThanOrEqual(file === 'StaffApp.tsx' ? 2 : 0);
    },
  );
});
