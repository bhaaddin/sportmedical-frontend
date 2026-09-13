/*
 * The settings catalogue, checked against the router.
 *
 * The complaint this work answers was twenty icons in a sidebar. The obvious
 * way to get that wrong is to tidy them into categories and quietly offer a
 * screen that does nothing - which is the same complaint again with better
 * spacing, and harder to spot because it now looks deliberate.
 *
 * So every destination is held against `App.tsx`, and anything that cannot
 * work has to say so rather than simply be listed.
 */
import { describe, it, expect } from 'vitest';
import appRaw from '../../App.tsx?raw';
import {
  SETTINGS_SECTIONS,
  visibleSections,
  allDestinations,
  settingsItemAt,
} from './catalogue';

/* Vite hands us the file's text; `node:fs` would need Node types this project
   does not carry, and the point is the routes, not the reading. */
const appSource = appRaw as string;
const routes = new Set(
  [...appSource.matchAll(/path="(\/[a-z0-9/:-]*)"/g)].map((m) => m[1]),
);

describe('every settings destination', () => {
  it.each(allDestinations())('%s is a route the application has', (to) => {
    expect(routes.has(to)).toBe(true);
  });

  it('is listed exactly once across the whole catalogue', () => {
    const all = allDestinations();
    expect(new Set(all).size).toBe(all.length);
  });

  it('has a unique id, so the open/closed memory cannot collide', () => {
    const ids = SETTINGS_SECTIONS.flatMap((s) => s.items.map((i) => `${s.id}/${i.id}`));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(SETTINGS_SECTIONS.map((s) => s.id)).size).toBe(SETTINGS_SECTIONS.length);
  });

  /* The description is what saves the click. An item without one is an icon
     with a word next to it, which is what we are getting rid of. */
  it('says what is inside, in more than a couple of words', () => {
    for (const section of SETTINGS_SECTIONS) {
      expect(section.description.length).toBeGreaterThan(10);
      for (const item of section.items) {
        expect(item.description.length).toBeGreaterThan(15);
      }
    }
  });

  /* Anything that cannot work says when it will. Hidden, somebody rebuilds it
     from scratch; labelled, they know it is coming. */
  it('gives a reason for anything it lists but cannot open', () => {
    for (const section of SETTINGS_SECTIONS) {
      for (const item of section.items) {
        if (item.unavailable !== undefined) {
          expect(item.unavailable.length).toBeGreaterThan(20);
        }
      }
    }
  });
});

describe('what each person sees', () => {
  it('shows an administrator everything', () => {
    const admin = visibleSections(true);
    const count = admin.reduce((n, s) => n + s.items.length, 0);
    expect(count).toBe(allDestinations().length);
  });

  it('hides the administrator-only rows from everybody else', () => {
    const plain = visibleSections(false);
    const ids = plain.flatMap((s) => s.items.map((i) => i.id));
    expect(ids).not.toContain('tym');
    expect(ids).not.toContain('audit');
    expect(ids).not.toContain('kalendare');
  });

  /* A receptionist still has something to open - an empty settings screen
     would be worse than the sidebar she had before. */
  it('leaves a receptionist rows she can actually use', () => {
    const plain = visibleSections(false);
    const ids = plain.flatMap((s) => s.items.map((i) => i.id));
    expect(ids).toContain('blokovany-cas');
    expect(ids).toContain('muj-rozvrh');
    expect(plain.length).toBeGreaterThan(1);
  });

  it('drops a section entirely once nothing in it is hers', () => {
    const plain = visibleSections(false);
    expect(plain.map((s) => s.id)).not.toContain('system');
  });
});

/*
 * The way back out.
 *
 * On 13. 9. 2026 all fourteen destinations here were opened and not one had a
 * back control, a breadcrumb, or anything else - the gear in a collapsed icon
 * sidebar was the only route out of any of them. It is drawn once by the
 * layout now, off this lookup.
 *
 * The first test below walks the same list the lookup walks, so it cannot
 * fail for a row someone adds - it guards the matching, not the catalogue. A
 * row pointing at a route that does not exist is caught further up, by the
 * test that holds every destination against App.tsx.
 */
describe('finding the way back', () => {
  it('recognises every destination in the catalogue', () => {
    for (const section of SETTINGS_SECTIONS) {
      for (const item of section.items) {
        const found = settingsItemAt(item.to);
        expect(found, `no way back from ${item.to}`).not.toBeNull();
        expect(found?.item.id).toBe(item.id);
        expect(found?.section.id).toBe(section.id);
      }
    }
  });

  /* A detail view under a settings screen is still that screen. */
  it('recognises a sub-path as the screen it sits under', () => {
    expect(settingsItemAt('/working-hours/period-3')?.item.id).toBe('pracovni-doba');
  });

  /*
   * The opposite failure, and the easier one to ship: a breadcrumb on every
   * screen in the application. Settings itself is not a settings sub-screen.
   */
  it('says nothing about screens that are not settings', () => {
    for (const path of ['/settings', '/planovani', '/patients', '/dnes', '/']) {
      expect(settingsItemAt(path), `${path} should have no crumb`).toBeNull();
    }
  });

  /* `/calendar` is the old moved-calendar page; `/calendars` is the settings
     one. A prefix match instead of a segment match would confuse them. */
  it('does not mistake a shorter neighbouring route for a settings one', () => {
    expect(settingsItemAt('/calendar')).toBeNull();
    expect(settingsItemAt('/cenikovy-prehled')).toBeNull();
  });
});

/*
 * Money under one heading.
 *
 * The price list has moved twice, and both moves were mine guessing at a model
 * the owner had not been asked for. First "Ordinace", on the reasoning that
 * what a practice charges is a fact about the practice. Then beside "Činnosti",
 * because an činnost takes its price from it - which is true, and still not
 * how he thinks about it.
 *
 * His is simpler and he said it in one line: platby are their own heading, and
 * the price list and the payers both sit under it. This test exists because I
 * wrote the previous arrangement into a test too, and confidently.
 */
describe('the payments section', () => {
  const platby = () => SETTINGS_SECTIONS.find((s) => s.id === 'platby');

  it('holds both the price list and the payers', () => {
    const ids = platby()?.items.map((i) => i.id) ?? [];
    expect(ids).toContain('cenik');
    expect(ids).toContain('platci');
  });

  /* Not left behind in the section it used to be in. */
  it('is the only section either of them is in', () => {
    for (const id of ['cenik', 'platci']) {
      const sections = SETTINGS_SECTIONS.filter((s) => s.items.some((i) => i.id === id));
      expect(sections.map((s) => s.id)).toEqual(['platby']);
    }
  });

  /*
   * A receptionist takes payments and needs to see what things cost and who
   * gets the invoice, so neither row may be admin-only - which would empty the
   * whole section off her screen.
   */
  it('is open to a receptionist, not just an administrator', () => {
    const hers = visibleSections(false).find((s) => s.id === 'platby');
    expect(hers?.items.map((i) => i.id).sort()).toEqual(['cenik', 'platci']);
  });

  /* One name for the payers, in the menu and here - this screen has been
     called both "Kluby" and "Plátci" in the same application. */
  it('calls the payers what the sidebar calls them', () => {
    const row = platby()?.items.find((i) => i.id === 'platci');
    expect(row?.label).toBe('Plátci');
    expect(appSource).toContain("text: 'Plátci'");
  });
});
