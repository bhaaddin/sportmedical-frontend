/*
 * The činnost strip at the bottom of club planning (owner, 21. 10. 2026: "visible = 2" and Spiroergometrické vyšetření
 * could not be picked). Pure, property-style tables over 1..8 činnosti x the widths the strip really gets:
 *   - every card is reachable (some page shows it wholly) and nothing is hidden without a count on its side;
 *   - the indicators ("ještě 2", the live text) agree with the page;
 *   - the escalator: arming / completing a card moves the strip so the next open card slides in, by the smallest move.
 */
import { describe, expect, it } from 'vitest';
import { DECK_CARD_GAP, DECK_CARD_WIDTH, deckVisibleCount } from '../components/PlannerMetrics';
import {
  cardsThatFit,
  carouselModel,
  clampCarouselIndex,
  deckIndicators,
  escalatorIndex,
  nextOpenCard,
  revealIndex,
  type DeckCardState,
} from './order';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const inView = (index: number, visible: number, card: number) => card >= index && card <= index + visible - 1;

/*
 * The widths: the desktop stage (cards keep the file's 309.7 px, as many as fit: `deckVisibleCount`) and the compact strip
 * (phone / tablet: every card is half the strip, 8 px gap, so the real card width is measured: `cardsThatFit`).
 */
const desktopContents = [628.4, 700, 980, 1290, 1600, 1950];
const compactContents = [346, 756, 1136];
const WIDTHS: { name: string; visible: number }[] = [
  ...desktopContents.map((w) => ({ name: `desktop ${w}`, visible: deckVisibleCount(w) })),
  ...compactContents.map((w) => ({ name: `compact ${w}`, visible: cardsThatFit(w, (w - 2 - 8) / 2, 8) })),
  { name: 'one at a time', visible: 1 },
];
const QUANTITIES = range(8).map((i) => i + 1);

describe('cardsThatFit: whole cards in the strip, from the measured card', () => {
  it.each([
    [346, (346 - 10) / 2, 8, 2],
    [756, (756 - 10) / 2, 8, 2],
    [1136, (1136 - 10) / 2, 8, 2],
    [628.4, DECK_CARD_WIDTH, DECK_CARD_GAP, 2],
    [1000, DECK_CARD_WIDTH, DECK_CARD_GAP, 3],
    [300, DECK_CARD_WIDTH, DECK_CARD_GAP, 1],
    [0, 300, 8, 0],
    [500, 0, 8, 0],
  ])('content %s, card %s, gap %s -> %s', (content, card, gap, expected) => {
    expect(cardsThatFit(content, card, gap)).toBe(expected);
  });

  it('the compact strip shows two whole cards at every width (the 1200 px tablet once claimed four)', () => {
    for (const w of [320, 346, 500, 756, 1000, 1136, 1250]) expect(cardsThatFit(w, (w - 2 - 8) / 2, 8)).toBe(2);
    // the bug: the desktop formula on a compact strip
    expect(deckVisibleCount(1136)).toBeGreaterThan(2);
  });
});

describe('carouselModel: hidden counts on both sides, for 1..8 činnosti x every width', () => {
  for (const { name, visible } of WIDTHS) {
    for (const q of QUANTITIES) {
      it(`${q} činnost(i) · ${name} (visible ${visible})`, () => {
        const right = Math.max(0, q - visible);
        for (const raw of range(q + 2)) {
          const m = carouselModel(q, raw, visible);
          const shown = Math.min(q, visible);
          // nothing is lost: what is in view plus what is hidden on each side is every card
          expect(m.hiddenBefore + shown + m.hiddenAfter).toBe(q);
          expect(m.hiddenBefore).toBe(q > visible ? m.index : 0);
          // an arrow is enabled exactly when there is something on its side
          expect(m.prevDisabled).toBe(m.hiddenBefore === 0);
          expect(m.nextDisabled).toBe(m.hiddenAfter === 0);
          expect(m.dots.filter(Boolean)).toHaveLength(shown);
          expect(m.index).toBeLessThanOrEqual(right);
        }
        // every card is reachable: some page shows it, and revealIndex finds that page from anywhere
        for (const card of range(q)) {
          expect(range(right + 1).some((i) => inView(i, visible, card))).toBe(true);
          for (const from of range(right + 1)) expect(inView(revealIndex(q, visible, from, card), visible, card)).toBe(true);
        }
        // paging by the arrows from the first page reaches the last one
        let at = 0;
        for (let step = 0; step < q; step++) at = clampCarouselIndex(q, at + 1, visible);
        expect(at).toBe(right);
      });
    }
  }

  it('keeps the prototype answers at two', () => {
    expect(carouselModel(6, 0)).toMatchObject({ pageLabel: '1–2 / 6', hiddenBefore: 0, hiddenAfter: 4 });
    expect(carouselModel(3, 0)).toMatchObject({ pageLabel: '1–2 / 3', hiddenBefore: 0, hiddenAfter: 1, nextDisabled: false });
    expect(carouselModel(3, 1)).toMatchObject({ pageLabel: '2–3 / 3', hiddenBefore: 1, hiddenAfter: 0, nextDisabled: true });
    expect(carouselModel(2, 0)).toMatchObject({ hiddenBefore: 0, hiddenAfter: 0, showCarousel: false });
  });
});

const states = (pattern: string): DeckCardState[] =>
  [...pattern].map((c) => ({ done: c === 'D', fresh: c === 'N' })); // D done, N new (not clicked yet), o open, clicked before

describe('deckIndicators: what the edges and the live region say', () => {
  it.each([
    // pattern, index, visible, before, after, live
    ['NNN', 0, 2, '', 'ještě 1', 'Vidíte činnosti 1–2, celkem 3. Vpravo ještě 1.'],
    ['NNN', 1, 2, 'ještě 1', '', 'Vidíte činnosti 2–3, celkem 3. Vlevo ještě 1.'],
    ['NNNNNN', 2, 2, 'ještě 2', 'ještě 2', 'Vidíte činnosti 3–4, celkem 6. Vlevo ještě 2. Vpravo ještě 2.'],
    ['NN', 0, 2, '', '', 'Vidíte činnosti 1–2, celkem 2.'],
    ['N', 0, 2, '', '', 'Vidíte činnost 1, celkem 1.'],
  ])('%s at %s (visible %s)', (pattern, index, visible, before, after, live) => {
    const d = deckIndicators(carouselModel(pattern.length, index, visible), states(pattern));
    expect(d.before.label).toBe(before);
    expect(d.after.label).toBe(after);
    expect(d.live).toBe(live);
  });

  it('counts the new (never clicked) cards hidden on each side, so the edge can show a dot', () => {
    const d = deckIndicators(carouselModel(6, 2, 2), states('NoDoNN'));
    expect(d.before).toMatchObject({ count: 2, fresh: 1 });
    expect(d.after).toMatchObject({ count: 2, fresh: 2 });
    expect(d.after.aria).toBe('Další činnosti, ještě 2, z toho 2 nové');
    expect(d.before.aria).toBe('Předchozí činnosti, ještě 2, z toho 1 nová');
    expect(deckIndicators(carouselModel(8, 0, 2), states('NNNNNNNN')).after.aria).toBe('Další činnosti, ještě 6, z toho 6 nových');
    expect(deckIndicators(carouselModel(3, 0, 2), states('ooo')).after.aria).toBe('Další činnosti, ještě 1');
  });

  it('every width and quantity: the counts are the hidden cards, the labels say so', () => {
    for (const { visible } of WIDTHS) {
      for (const q of QUANTITIES) {
        for (const index of range(q)) {
          const m = carouselModel(q, index, visible);
          const d = deckIndicators(m, states('N'.repeat(q)));
          expect(d.before.count).toBe(m.hiddenBefore);
          expect(d.after.count).toBe(m.hiddenAfter);
          expect(d.before.label).toBe(m.hiddenBefore ? `ještě ${m.hiddenBefore}` : '');
          expect(d.after.label).toBe(m.hiddenAfter ? `ještě ${m.hiddenAfter}` : '');
          expect(d.after.fresh).toBe(m.hiddenAfter);
        }
      }
    }
  });
});

describe('nextOpenCard: the next card the escalator brings in', () => {
  it.each([
    ['NNN', 1, 2],
    ['NNN', 2, 0], // wraps to the start
    ['oNo', 0, 1],
    ['ooN', 0, 2], // a never clicked card wins over a nearer open one
    ['ooo', 0, 1], // all clicked once: the next open one
    ['oDo', 0, 2], // a done card is skipped
    ['DDo', 2, null], // nothing else is open
    ['DDD', 0, null],
    ['NNN', -1, 0], // no focus: the first open card
    ['DNN', -1, 1],
  ])('%s from %s -> %s', (pattern, from, expected) => {
    expect(nextOpenCard(states(pattern), from)).toBe(expected);
  });
});

describe('escalatorIndex', () => {
  it('the owner\'s order: arming Komplexní slides Spiroergometrické (not clicked yet) into view', () => {
    // Základní (clicked), Komplexní (being armed), Spiro (new); two cards fit
    expect(escalatorIndex({ cards: states('ooN'), visible: 2, index: 0, focus: 1, reason: 'select' })).toBe(1);
    // arming Základní: Komplexní is the next one and already beside it - the strip stays
    expect(escalatorIndex({ cards: states('oNN'), visible: 2, index: 0, focus: 0, reason: 'select' })).toBe(0);
    // Základní fulfilled: the next card not clicked yet (Spiro) comes into view, Komplexní stays beside it
    expect(escalatorIndex({ cards: states('DoN'), visible: 2, index: 0, focus: 0, reason: 'complete' })).toBe(1);
    expect(escalatorIndex({ cards: states('Doo'), visible: 2, index: 0, focus: 0, reason: 'complete' })).toBe(0);
    expect(escalatorIndex({ cards: states('DDN'), visible: 2, index: 0, focus: 1, reason: 'complete' })).toBe(1);
  });

  it('six činnosti, two in view: each arm reveals the next one beside it', () => {
    expect(escalatorIndex({ cards: states('oNNNNN'), visible: 2, index: 0, focus: 0, reason: 'select' })).toBe(0);
    expect(escalatorIndex({ cards: states('ooNNNN'), visible: 2, index: 0, focus: 1, reason: 'select' })).toBe(1);
    expect(escalatorIndex({ cards: states('oooNNN'), visible: 2, index: 1, focus: 2, reason: 'select' })).toBe(2);
    // the last card: the next new one is back at the start, too far to show both - the armed one stays in view
    expect(escalatorIndex({ cards: states('Nooooo'), visible: 2, index: 4, focus: 5, reason: 'select' })).toBe(4);
    // completing the fourth with the second still new: the strip goes back for it
    expect(escalatorIndex({ cards: states('oNoDoo'), visible: 2, index: 2, focus: 3, reason: 'complete' })).toBe(1);
  });

  it('nothing to scroll when every card fits', () => {
    expect(escalatorIndex({ cards: states('NNN'), visible: 3, index: 0, focus: 2, reason: 'select' })).toBe(0);
    expect(escalatorIndex({ cards: states('NN'), visible: 2, index: 5, focus: 1, reason: 'complete' })).toBe(0);
  });

  /* Deterministic pseudo-random card states: D / o / N per card. */
  function* patterns(q: number, count: number): Generator<string> {
    let seed = 1234567 + q * 7919;
    for (let n = 0; n < count; n++) {
      let s = '';
      for (let i = 0; i < q; i++) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        s += 'DoN'[seed % 3];
      }
      yield s;
    }
  }

  it('properties for 1..8 činnosti x every width x every focus and page', () => {
    let checked = 0;
    for (const { visible } of WIDTHS) {
      for (const q of QUANTITIES) {
        const right = Math.max(0, q - visible);
        for (const pattern of patterns(q, 24)) {
          const cards = states(pattern);
          for (const focus of range(q)) {
            for (const index of range(right + 1)) {
              const next = nextOpenCard(cards, focus);
              const sel = escalatorIndex({ cards, visible, index, focus, reason: 'select' });
              const done = escalatorIndex({ cards, visible, index, focus, reason: 'complete' });
              expect(sel).toBeGreaterThanOrEqual(0);
              expect(sel).toBeLessThanOrEqual(right);
              if (q <= visible) {
                expect(sel).toBe(0);
                expect(done).toBe(0);
                continue;
              }
              // the armed card is always in view
              expect(inView(sel, visible, focus)).toBe(true);
              // the next open card is in view beside it whenever both fit, by the smallest move
              if (next !== null && Math.abs(next - focus) < visible) {
                expect(inView(sel, visible, next)).toBe(true);
                const candidates = range(right + 1).filter((i) => inView(i, visible, focus) && inView(i, visible, next));
                const best = Math.min(...candidates.map((i) => Math.abs(i - index)));
                expect(Math.abs(sel - index)).toBe(best);
              }
              // completing: the next open card comes into view (the smallest move); none open - the card itself
              const target = next ?? focus;
              expect(inView(done, visible, target)).toBe(true);
              expect(done).toBe(revealIndex(q, visible, index, target));
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });
});
