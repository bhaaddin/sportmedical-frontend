/*
 * The motion kit may only ADD to the prerendered public site. This renders every route the way the build does
 * (entry-server) and holds it to design/motion/prerender-baseline.json - the headings and words of the same pages
 * before the kit (claude/clean b7e4405): nothing lost, one <h1> each, and no runtime motion state baked into the HTML.
 * scripts/prerender-check.mjs makes the same comparison on the real dist/ after `npm run build`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareWithBaseline, structureOf } from '../../scripts/prerender-structure-lib.mjs';
import type { BaselineEntry } from '../../scripts/prerender-structure-lib.mjs';
import { EMPTY_BOOTSTRAP } from './data';
import { WEB_ROUTES, render } from './entry-server';

const baseline = JSON.parse(readFileSync(resolve(__dirname, '../../design/motion/prerender-baseline.json'), 'utf8')).pages as Record<string, BaselineEntry>;

describe('the server render of the public site, after the motion kit', () => {
  it('covers exactly the pages of the baseline', () => {
    expect(WEB_ROUTES.map((route) => route.path).sort()).toEqual(Object.keys(baseline).sort());
  });

  it.each(WEB_ROUTES.map((route) => route.path))('%s keeps every heading and word it had, one <h1>, and no motion state', (path) => {
    const { html } = render(path, EMPTY_BOOTSTRAP);
    const wrapped = `<html><head></head><body><div id="root" data-prerendered="1">${html}</div><script>window.__SM_WEB__={}</script></body></html>`;
    expect(compareWithBaseline(path, structureOf(wrapped), baseline[path])).toEqual([]);
  });

  it('the home headline is plain words in masks, in reading order', () => {
    const { html } = render('/', EMPTY_BOOTSTRAP);
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)![1];
    expect(h1.match(/class="sm-kt-i"/g)?.length).toBe(5);
    expect(h1.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')).toMatch(/Sportovní lékařské\s*prohlídky\s*a diagnostika/);
  });

  it('marks the scenes only with static attributes the scene scans for (data-fx / data-sm), never with state', () => {
    const { html } = render('/', EMPTY_BOOTSTRAP);
    for (const effect of ['recede', 'wipe', 'curtain', 'scale', 'pan', 'ticker', 'fan', 'draw', 'iris', 'light']) expect(html).toContain(`data-fx="${effect}"`);
    expect(html).toContain('data-sm="measure"');
    expect(html).not.toMatch(/data-scene=|data-stage=/);
    expect(html).toContain('data-sm-shader="fallback"'); // the shader's CSS fallback is what the server draws
  });

  it("the stage's four devices are all in the HTML, in their own list, without any script", () => {
    const { html } = render('/', EMPTY_BOOTSTRAP);
    for (const device of ['InBody 770', 'ForceDecks', 'HumanTrak', 'Cortex 21']) expect(html).toContain(device);
    expect((html.match(/data-sm="beat"/g) ?? []).length).toBe(4);
  });
});

describe('the structure check itself', () => {
  const good = baseline['/cenik'];
  const page = (inner: string) => `<html><head></head><body><div id="root" data-prerendered="1">${inner}</div><script>window.__SM_WEB__={}</script></body></html>`;

  it('notices a lost heading, a lost word, a second <h1> and a baked-in hidden state', () => {
    expect(compareWithBaseline('/cenik', structureOf(page('<h1>Nic</h1>')), good).join('\n')).toMatch(/headings lost/);
    expect(compareWithBaseline('/cenik', structureOf(page('<h1>Nic</h1><h1>Dvě</h1>')), good).join('\n')).toMatch(/2 <h1>/);
    expect(compareWithBaseline('/cenik', structureOf(page('<h1>X</h1><p style="opacity:0">skryté</p>')), good).join('\n')).toMatch(/hidden start state/);
    expect(compareWithBaseline('/cenik', structureOf(page('<div data-scene="ready"><h1>X</h1></div>')), good).join('\n')).toMatch(/data-scene/);
  });
});
