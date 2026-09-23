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

/*
 * ── What changed on 22. 9. 2026 ──
 *
 * These read `visibleSections(true)` and `visibleSections(false)` — a ROLE.
 * The owner sets permissions per employee, in three states, and a role check
 * could see none of it: an administrator whose `settings.clinic.manage` was
 * revoked still saw every screen, and a member of staff who was granted
 * `questionnaires.manage` saw none. The menu now takes the effective list the
 * server sends, so these say what somebody HOLDS.
 */
const EVERYTHING = [
  'patients.view',
  'patients.register',
  'patients.edit',
  'patients.sensitive_identity.view',
  'reports.view',
  'settings.appearance.manage',
  'settings.clinic.manage',
  'users.manage',
  'roles.manage',
  'bookings.create',
  'bookings.edit',
  'bookings.cancel',
  'questionnaires.manage',
];

/** What a receptionist gets by default from the server's Staff role. */
const RECEPTIONIST = [
  'patients.view',
  'patients.register',
  'patients.edit',
  'reports.view',
  'bookings.create',
  'bookings.edit',
  'bookings.cancel',
];

describe('what each person sees', () => {
  it('shows somebody who holds everything every row', () => {
    const admin = visibleSections(EVERYTHING);
    const count = admin.reduce((n, s) => n + s.items.length, 0);
    expect(count).toBe(allDestinations().length);
  });

  it('hides the rows a receptionist has no permission for', () => {
    const ids = visibleSections(RECEPTIONIST).flatMap((s) => s.items.map((i) => i.id));
    expect(ids).not.toContain('tym');
    expect(ids).not.toContain('audit');
    expect(ids).not.toContain('kalendare');
  });

  /* A receptionist still has something to open - an empty settings screen
     would be worse than the sidebar she had before. */
  it('leaves a receptionist rows she can actually use', () => {
    const plain = visibleSections(RECEPTIONIST);
    const ids = plain.flatMap((s) => s.items.map((i) => i.id));
    expect(ids).toContain('blokovany-cas');
    expect(ids).toContain('muj-rozvrh');
    expect(plain.length).toBeGreaterThan(1);
  });

  it('drops a section entirely once nothing in it is hers', () => {
    expect(visibleSections(RECEPTIONIST).map((s) => s.id)).not.toContain('system');
  });

  /*
   * The point of the whole change: ONE permission, granted to one person,
   * and the row appears. A role check could not express this, and the
   * administration has been writing it to the database all along.
   */
  it('shows one extra row to somebody granted one extra permission', () => {
    const before = visibleSections(RECEPTIONIST).flatMap((s) => s.items.map((i) => i.id));
    const after = visibleSections([...RECEPTIONIST, 'questionnaires.manage'])
      .flatMap((s) => s.items.map((i) => i.id));

    expect(before).not.toContain('zdravotni-dotaznik');
    expect(after).toContain('zdravotni-dotaznik');
    expect(after.length).toBe(before.length + 1);
  });

  /* And the reverse: taking one away from an administrator takes the row. */
  it('hides a row from somebody who had the permission revoked', () => {
    const without = EVERYTHING.filter((p) => p !== 'settings.clinic.manage');
    const ids = visibleSections(without).flatMap((s) => s.items.map((i) => i.id));

    expect(ids).not.toContain('kalendare');
    expect(ids).not.toContain('sluzby');

    // Their other permissions are untouched.
    expect(ids).toContain('tym');
    expect(ids).toContain('barvy-upozorneni');
  });

  it('shows nothing but the open rows to somebody with no permissions at all', () => {
    const ids = visibleSections([]).flatMap((s) => s.items.map((i) => i.id));

    // Empty is the safe direction to be wrong in: a session that predates
    // this, or one that never stored a list, hides everything guarded.
    expect(ids).toContain('muj-rozvrh');
    expect(ids).not.toContain('tym');
  });

  /*
   * Every guarded row names a permission the SERVER defines. A name that is
   * not on the server's list is a row nobody can ever see.
   */
  it('names only permissions the server has', () => {
    for (const section of visibleSections(EVERYTHING)) {
      for (const item of section.items) {
        if (item.requires !== undefined) {
          expect(EVERYTHING).toContain(item.requires);
        }
      }
    }
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

  /* `/calendar` is one letter short of `/calendars`, the settings one. A
     prefix match instead of a segment match would confuse them. */
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
    const hers = visibleSections(RECEPTIONIST).find((s) => s.id === 'platby');
    expect(hers?.items.map((i) => i.id).sort()).toEqual(['cenik', 'platci']);
  });

  /*
   * One name for the price list too. It has been "Ceník služeb", then "Ceník
   * činností", and the screen's own heading is "Ceník" - three names for one
   * thing, and "činností" was wrong besides: the list holds položky, and a
   * činnost is the other half of the pair.
   */
  it('calls the price list what its own screen calls itself', () => {
    const row = platby()?.items.find((i) => i.id === 'cenik');
    expect(row?.label).toBe('Ceník');
    expect(row?.label).not.toMatch(/činnost|služ/i);
  });

  /* One name for this screen: the page heading and this row. It has been
     called both "Kluby" and "Plátci" in the same application. */
  it('calls the payers what the screen calls itself', () => {
    const row = platby()?.items.find((i) => i.id === 'platci');
    expect(row?.label).toBe('Plátci');
  });
});

/*
 * One place per screen.
 *
 * The sidebar is the work of the day; Nastavení is configuration. A screen in
 * both is the shape this project keeps turning up, and this time I put it
 * there myself - "Plátci" went into Nastavení and stayed in the sidebar too,
 * so the owner saw it twice on one screenshot. "Můj rozvrh" had been doubled
 * the same way for longer.
 *
 * The rule is checked against App.tsx's own text rather than a list kept
 * beside it, because a list kept beside it is a third place to forget.
 */
describe('the sidebar and the settings do not overlap', () => {
  /* Every `{ text: …, icon: …, path: '/…' }` in the sidebar's menu groups. */
  const sidebarPaths = [...appSource.matchAll(/\{ text: '[^']+', icon: <\w+ \/>, path: '([^']+)'/g)]
    .map((m) => m[1]);

  it('finds the sidebar in App.tsx at all', () => {
    /* Guards the regex: if it silently matched nothing, the test below would
       pass for the wrong reason and go on passing forever. */
    expect(sidebarPaths.length).toBeGreaterThan(5);
    expect(sidebarPaths).toContain('/patients');
  });

  it('offers no settings screen from the sidebar as well', () => {
    const destinations = allDestinations();
    /* Both sides asserted to exist first. An empty catalogue overlaps nothing
       either, and this is the test somebody would be handed as the proof. */
    expect(destinations.length).toBeGreaterThan(5);
    expect(destinations).toContain('/cenik');

    const both = destinations.filter((to) => sidebarPaths.includes(to));
    expect(both, `v liště i v nastavení: ${both.join(', ')}`).toEqual([]);
  });

  /* Nastavení itself is the one entry that belongs in the sidebar and is not
     a row inside Nastavení. */
  it('keeps the way into the settings in the sidebar', () => {
    expect(sidebarPaths).toContain('/settings');
    expect(allDestinations()).not.toContain('/settings');
  });
});
