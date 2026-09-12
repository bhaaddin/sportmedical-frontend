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
