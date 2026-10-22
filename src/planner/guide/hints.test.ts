import { describe, expect, it } from 'vitest';
import {
  EMPTY_MEMORY, HINT_GAP_MS, HINT_KEY_PREFIX, chooseHint, hintKeyOf, loadMemory, markSeen, mute, parseMemory, saveMemory, startVariant, wants,
  NO_CLOCK, type HintInput, type HintMemory,
} from './hints';

const base: HintInput = {
  active: true, activities: 2, planned: 0, armed: false, view: 'week', layout: 'desktop', hiddenCards: 0, stripUsed: false, dialogOpen: false, calloutOpen: false,
};
const many: HintInput = { ...base, activities: 6, hiddenCards: 3 };

describe('the hint state function · triggers', () => {
  it('start: an empty order with činnosti, nothing planned yet', () => {
    expect(chooseHint(base, EMPTY_MEMORY, 0).hint).toBe('start');
    expect(chooseHint({ ...base, planned: 3 }, EMPTY_MEMORY, 0).hint).toBeNull();
    expect(chooseHint({ ...base, activities: 0 }, EMPTY_MEMORY, 0).hint).toBeNull();
    expect(chooseHint({ ...base, active: false }, EMPTY_MEMORY, 0).hint).toBeNull();
  });

  it('start says the gestures that exist on this view and layout', () => {
    expect(startVariant({ view: 'week', layout: 'desktop', armed: false })).toBe('board');
    expect(startVariant({ view: 'day', layout: 'tablet', armed: true })).toBe('armedBoard');
    expect(startVariant({ view: 'month', layout: 'desktop', armed: false })).toBe('month');
    expect(startVariant({ view: 'month', layout: 'desktop', armed: true })).toBe('armedMonth');
    expect(startVariant({ view: 'week', layout: 'phone', armed: true })).toBe('phone');
  });

  it('strip: only with 4 or more činnosti and cards that do not fit, until the strip was used', () => {
    const planned = { ...many, planned: 5 };
    expect(chooseHint(planned, EMPTY_MEMORY, 0).hint).toBe('strip');
    expect(chooseHint({ ...planned, activities: 3, hiddenCards: 1 }, EMPTY_MEMORY, 0).hint).toBeNull();
    expect(chooseHint({ ...planned, hiddenCards: 0 }, EMPTY_MEMORY, 0).hint).toBeNull();
    expect(chooseHint({ ...planned, stripUsed: true }, EMPTY_MEMORY, 0).hint).toBeNull();
  });

  it('never while a dialog or the completion card is open', () => {
    expect(chooseHint({ ...base, dialogOpen: true }, EMPTY_MEMORY, 0).hint).toBeNull();
    expect(chooseHint({ ...base, calloutOpen: true }, EMPTY_MEMORY, 0).hint).toBeNull();
    expect(wants('start', { ...base, dialogOpen: true })).toBe(false);
  });
});

describe('the hint state function · ordering and the 20 s gap', () => {
  it('one at a time: start first, then strip', () => {
    expect(chooseHint(many, EMPTY_MEMORY, 0).hint).toBe('start');
    expect(chooseHint(many, markSeen(EMPTY_MEMORY, 'start'), 0).hint).toBe('strip');
  });

  it('a different hint waits for the gap and says how long', () => {
    const memory = markSeen(EMPTY_MEMORY, 'start');
    const clock = { shown: null, lastId: 'start' as const, lastAt: 1000 };
    const early = chooseHint(many, memory, 1000 + 5000, clock);
    expect(early.hint).toBeNull();
    expect(early.waitMs).toBe(HINT_GAP_MS - 5000);
    expect(chooseHint(many, memory, 1000 + HINT_GAP_MS, clock)).toMatchObject({ hint: 'strip', waitMs: null });
  });

  it('the hint on screen is never removed by the gap, and the same hint returning after a dialog is not new', () => {
    const shown = { shown: 'start' as const, lastId: 'start' as const, lastAt: 0 };
    expect(chooseHint(base, EMPTY_MEMORY, 3000, shown).hint).toBe('start');
    const back = { shown: null, lastId: 'start' as const, lastAt: 0 };
    expect(chooseHint(base, EMPTY_MEMORY, 3000, back).hint).toBe('start');
  });

  it('never more than one per 20 seconds over a whole session', () => {
    let memory: HintMemory = EMPTY_MEMORY;
    let clock = NO_CLOCK;
    const appeared: number[] = [];
    for (let t = 0; t <= 90_000; t += 1000) {
      const c = chooseHint(many, memory, t, clock);
      if (c.hint && c.hint !== clock.shown) {
        appeared.push(t);
        clock = { shown: c.hint, lastId: c.hint, lastAt: t };
        memory = markSeen(memory, c.hint); // the person closes each one at once
      } else {
        clock = { ...clock, shown: c.hint };
      }
    }
    expect(appeared).toHaveLength(2);
    expect(appeared[1]! - appeared[0]!).toBeGreaterThanOrEqual(HINT_GAP_MS);
  });
});

describe('the hint state function · dismissal and memory', () => {
  it('x remembers the hint as seen; "Nezobrazovat" silences all of them', () => {
    expect(chooseHint(base, markSeen(EMPTY_MEMORY, 'start'), 0).hint).toBeNull();
    expect(chooseHint(many, mute(EMPTY_MEMORY), 0).hint).toBeNull();
    expect(markSeen(EMPTY_MEMORY, 'start')).toEqual({ seen: { start: true }, muted: false });
  });

  it('round trips through a storage, per person', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    const matko = hintKeyOf(JSON.stringify({ id: 'u-1', displayName: 'Matko' }));
    const jana = hintKeyOf(JSON.stringify({ email: 'Jana@Klinika.cz' }));
    expect(matko).toBe(`${HINT_KEY_PREFIX}u-1`);
    expect(jana).toBe(`${HINT_KEY_PREFIX}jana@klinika.cz`);
    expect(saveMemory(storage, matko, mute(markSeen(EMPTY_MEMORY, 'strip')))).toBe(true);
    expect(loadMemory(storage, matko)).toEqual({ seen: { strip: true }, muted: true });
    expect(loadMemory(storage, jana)).toEqual(EMPTY_MEMORY);
  });

  it('junk in the storage is an empty memory, never an error', () => {
    for (const junk of ['', 'not json', '{', 'null', '[]', '42', '"x"', '{"seen":5,"muted":"yes"}', '{"seen":{"start":"true","nope":true},"muted":1}']) {
      expect(parseMemory(junk), junk).toEqual(EMPTY_MEMORY);
    }
    expect(parseMemory('{"seen":{"start":true,"unknown":true},"muted":true}')).toEqual({ seen: { start: true }, muted: true });
    expect(hintKeyOf('not json')).toBe(`${HINT_KEY_PREFIX}anon`);
    expect(hintKeyOf(null)).toBe(`${HINT_KEY_PREFIX}anon`);
    expect(hintKeyOf('{"id":42}')).toBe(`${HINT_KEY_PREFIX}anon`);
  });

  it('a storage that throws (private window, blocked) is survived on read and write', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
    expect(loadMemory(broken, 'k')).toEqual(EMPTY_MEMORY);
    expect(saveMemory(broken, 'k', EMPTY_MEMORY)).toBe(false);
    expect(loadMemory(null, 'k')).toEqual(EMPTY_MEMORY);
    expect(saveMemory(null, 'k', EMPTY_MEMORY)).toBe(false);
  });
});
