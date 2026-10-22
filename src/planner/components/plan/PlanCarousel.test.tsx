import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMotionStoreForTests, setMotionPreference } from '../../../motion/preference';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { komplexni, mountPlanner, ownerSource, spiro, term } from './testHarness';

beforeEach(() => setViewport(VIEWPORTS.desktop));
afterEach(() => cleanup());

/** The owner's case: a 360-min spiro window (4 slots of 90 min) and a komplexní window of one 60-min slot. */
const sessions = () => [
  term('w1', '2026-11-18', '08:00', '14:00', 's', 4),
  term('w2', '2026-11-18', '14:30', '15:30', 'k', 1),
];

const card = (id: string) => document.querySelector<HTMLElement>(`[data-plan-type="${id}"]`)!;

describe('PlanningCarousel · paging', () => {
  const six = [
    { id: 'a', name: 'Činnost A', iconKey: 'heart', color: '#00f1dc', slotMinutes: 30, parallelCapacity: 1 },
    { id: 'b', name: 'Činnost B', iconKey: 'run', color: '#0f94ff', slotMinutes: 30, parallelCapacity: 1 },
    { id: 'c', name: 'Činnost C', iconKey: 'heart', color: '#9157f2', slotMinutes: 30, parallelCapacity: 1 },
    { id: 'd', name: 'Činnost D', iconKey: 'run', color: '#ffb124', slotMinutes: 30, parallelCapacity: 1 },
  ];
  const demands = six.map((c) => ({ categoryId: c.id, requested: 4, baselinePlanned: 0 }));

  it('four cards: two at a time, the arrows page, a page change ends the selection', async () => {
    mountPlanner(ownerSource({ categories: six, demands }));
    await screen.findByTestId('planning-carousel');
    expect(document.querySelector('.adaptive-deck')).toHaveClass('mode-scroll');
    expect(document.getElementById('adaptive-page')).toHaveTextContent('1–2 / 4');
    expect(document.querySelector('[data-deck-nav="-1"]')).toBeDisabled();
    fireEvent.click(card('a'));
    expect(card('a')).toHaveClass('is-selected');
    fireEvent.click(document.querySelector('[data-deck-nav="1"]')!);
    expect(document.getElementById('adaptive-page')).toHaveTextContent('2–3 / 4');
    expect(card('a')).not.toHaveClass('is-selected');
    expect(document.querySelectorAll('.nav-dots i.is-in-view')).toHaveLength(2);
  });

  it('arming a činnost from the order overview turns the deck to its card first', async () => {
    mountPlanner(ownerSource({ categories: six, demands }));
    await screen.findByTestId('planning-carousel');
    fireEvent.click(document.querySelector('.oc-overview')!);
    const dialog = await screen.findByTestId('planner-dialog');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Plánovat →' })[3]!);
    expect(card('d')).toHaveClass('is-selected');
    expect(document.getElementById('adaptive-page')).toHaveTextContent('3–4 / 4');
  });
});

describe('PlanningCarousel · every činnost reachable (owner, 21. 10. 2026: Spiroergometrické could not be picked)', () => {
  const zakladni = { id: 'z', name: 'Základní sportovní prohlídka', iconKey: 'heart', color: '#00f1dc', slotMinutes: 40, parallelCapacity: 1 };
  const three = [zakladni, { ...komplexni }, { ...spiro }];
  const threeDemands = [
    { categoryId: 'z', requested: 7, baselinePlanned: 0 },
    { categoryId: 'k', requested: 5, baselinePlanned: 0 },
    { categoryId: 's', requested: 4, baselinePlanned: 0 },
  ];
  const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({ id, name: `Činnost ${id.toUpperCase()}`, iconKey: 'heart', color: ['#00f1dc', '#0f94ff', '#9157f2', '#ffb124', '#ff5d8f', '#7bd88f'][i]!, slotMinutes: 30, parallelCapacity: 1 }));
  const sixDemands = six.map((c) => ({ categoryId: c.id, requested: 4, baselinePlanned: 0 }));
  const page = () => document.getElementById('adaptive-page')!.textContent;
  const live = () => document.getElementById('deck-live')!.textContent;
  const more = (side: 'before' | 'after') => document.querySelector<HTMLButtonElement>(`[data-deck-more="${side}"]`);

  afterEach(() => { setMotionPreference(null); resetMotionStoreForTests(); });

  it('three činnosti, two in view: the hidden one is counted on its side, said aloud and marked NOVÁ', async () => {
    mountPlanner(ownerSource({ categories: three, demands: threeDemands }));
    await screen.findByTestId('planning-carousel');
    expect(page()).toBe('1–2 / 3');
    const viewport = document.getElementById('adaptive-viewport')!;
    expect(viewport).toHaveAttribute('data-more-after', 'true');
    expect(viewport).not.toHaveAttribute('data-more-before');
    expect(viewport).toHaveAttribute('role', 'group');
    expect(live()).toBe('Vidíte činnosti 1–2, celkem 3. Vpravo ještě 1.');
    expect(document.getElementById('deck-live')).toHaveAttribute('aria-live', 'polite');
    // the stage's arrow carries the count; the compact strip's edge button says the same
    const next = document.querySelector<HTMLButtonElement>('[data-deck-nav="1"]')!;
    expect(next).toBeEnabled();
    expect(next).toHaveAccessibleName('Další činnosti, ještě 1, z toho 1 nová');
    expect(next.querySelector('.deck-count')).toHaveTextContent('ještě 1');
    expect(more('after')).toHaveTextContent('ještě 1');
    expect(more('before')).toBeNull();
    // every card is new until clicked
    for (const id of ['z', 'k', 's']) expect(card(id).querySelector('.plan-new')).toHaveTextContent('NOVÁ');
  });

  it('the escalator: arming Komplexní slides Spiroergometrické in, Komplexní stays armed; Spiro is then selectable', async () => {
    mountPlanner(ownerSource({ categories: three, demands: threeDemands }));
    await screen.findByTestId('planning-carousel');
    fireEvent.click(card('z'));
    expect(page()).toBe('1–2 / 3'); // Komplexní, the next one, is already beside it
    expect(card('z').querySelector('.plan-new')).toBeNull();
    fireEvent.click(card('k'));
    expect(card('k')).toHaveClass('is-selected');
    expect(page()).toBe('2–3 / 3');
    expect(card('k')).toHaveClass('is-selected'); // the strip's own move keeps the armed činnost
    expect(live()).toBe('Vidíte činnosti 2–3, celkem 3. Vlevo ještě 1.');
    expect(card('s')).toHaveAttribute('data-fresh', 'true');
    fireEvent.click(card('s'));
    expect(card('s')).toHaveClass('is-selected');
    expect(card('s')).toHaveAttribute('aria-pressed', 'true');
    expect(card('s').querySelector('.plan-new')).toBeNull();
    expect(document.getElementById('active-plan-hint')).toHaveTextContent('Právě plánujete: Spiroergometrické vyšetření');
  });

  it('six činnosti: each armed card brings the next one in; the edge buttons page by what is hidden', async () => {
    mountPlanner(ownerSource({ categories: six, demands: sixDemands }));
    await screen.findByTestId('planning-carousel');
    expect(more('after')).toHaveAccessibleName('Další činnosti, ještě 4, z toho 4 nové');
    fireEvent.click(card('a'));
    expect(page()).toBe('1–2 / 6');
    fireEvent.click(card('b'));
    expect(page()).toBe('2–3 / 6');
    fireEvent.click(card('c'));
    expect(page()).toBe('3–4 / 6');
    expect(card('c')).toHaveClass('is-selected');
    expect(more('before')).toHaveTextContent('ještě 2');
    expect(more('after')).toHaveTextContent('ještě 2');
    // the user pages: like the arrows, it ends the armed činnost
    fireEvent.click(more('after')!);
    expect(page()).toBe('5–6 / 6');
    expect(card('c')).not.toHaveClass('is-selected');
    expect(more('after')).toBeNull();
    fireEvent.click(more('before')!);
    expect(page()).toBe('3–4 / 6');
  });

  it('keyboard: arrows, Home and End walk the cards; the focused card scrolls in and the armed one stays armed', async () => {
    mountPlanner(ownerSource({ categories: six, demands: sixDemands }));
    await screen.findByTestId('planning-carousel');
    fireEvent.click(card('a'));
    card('a').focus();
    fireEvent.keyDown(card('a'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(card('b'));
    fireEvent.keyDown(card('b'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(card('c'));
    expect(page()).toBe('2–3 / 6');
    fireEvent.keyDown(card('c'), { key: 'End' });
    expect(document.activeElement).toBe(card('f'));
    expect(page()).toBe('5–6 / 6');
    expect(card('a')).toHaveClass('is-selected');
    fireEvent.keyDown(card('f'), { key: 'Home' });
    expect(document.activeElement).toBe(card('a'));
    expect(page()).toBe('1–2 / 6');
    fireEvent.keyDown(card('a'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(card('a'));
    // every card is a button in the tab order
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) expect(card(id).tagName).toBe('BUTTON');
  });

  it('a fulfilled card stays in the strip, done, never NOVÁ, and is not armed again', async () => {
    mountPlanner(ownerSource({ categories: three, demands: threeDemands, sessions: [term('full', '2026-11-18', '08:00', '11:20', 'z', 7)] }));
    await screen.findByTestId('planning-carousel');
    expect(card('z')).toHaveClass('is-complete');
    expect(card('z').querySelector('.plan-new')).toBeNull();
    fireEvent.click(card('z'));
    expect(card('z')).not.toHaveClass('is-selected');
    expect(await screen.findByTestId('completion-callout')).toHaveTextContent('Požadavek naplněn');
  });

  /** jsdom has no layout: give the cards the file's width so the strip can compute its step and scroll. */
  const giveCardWidths = () => {
    document.querySelector<HTMLElement>('.adaptive-card-track')!.style.gap = '9px';
    document.querySelectorAll<HTMLElement>('.plan-card').forEach((c) => { c.style.width = '300px'; });
    const viewport = document.getElementById('adaptive-viewport')!;
    const scrollTo = vi.fn();
    (viewport as HTMLElement & { scrollTo: unknown }).scrollTo = scrollTo;
    return scrollTo;
  };

  it.each([
    ['plné', 'smooth'],
    ['omezené', 'instant'],
    ['vypnuto', 'instant'],
  ] as const)('the motion setting %s: the strip moves %s', async (mode, behavior) => {
    setMotionPreference(mode);
    mountPlanner(ownerSource({ categories: three, demands: threeDemands }));
    await screen.findByTestId('planning-carousel');
    const scrollTo = giveCardWidths();
    fireEvent.click(card('z'));
    fireEvent.click(card('k'));
    expect(page()).toBe('2–3 / 3');
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 309, behavior });
  });
});

describe('PlanningCarousel · the owner\'s case, counted per činnost', () => {
  it('shows each činnost with its own whole slots - never a pool of minutes', async () => {
    mountPlanner(ownerSource({ sessions: sessions() }));
    await screen.findByTestId('planning-carousel');
    const k = card('k');
    const s = card('s');
    expect(within(k).getByText('Komplexní sportovní prohlídka')).toBeInTheDocument();
    expect(k.querySelector('.plan-num')).toHaveTextContent('1 / 20');
    expect(k.querySelector('.plan-remaining')).toHaveTextContent('Zbývá 19 osob');
    expect(k.querySelector('.plan-duration')).toHaveTextContent('60 min / osoba · 19 h');
    expect(k.querySelector('.plan-ring b')).toHaveTextContent('5%');
    expect(s.querySelector('.plan-num')).toHaveTextContent('4 / 50');
    expect(s.querySelector('.plan-remaining')).toHaveTextContent('Zbývá 46 osob');
    expect(s.querySelector('.plan-duration')).toHaveTextContent('90 min / osoba · 69 h');
    expect(s.querySelector('.plan-ring b')).toHaveTextContent('8%');
    // the summary card: 5 of 70, 65 missing, 19 x 60 + 46 x 90 = 88 h
    expect(document.getElementById('adaptive-count')).toHaveTextContent('5 / 70');
    expect(document.getElementById('adaptive-percent')).toHaveTextContent('7%');
    expect(document.getElementById('adaptive-remaining')).toHaveTextContent('65');
    expect(document.getElementById('adaptive-hours')).toHaveTextContent('88 h');
    expect(document.getElementById('insight-detail-line')).toHaveTextContent('2 termínů');
    // the same numbers in the (hidden in live mode) command panel
    expect(document.getElementById('oc-total')).toHaveTextContent('5 / 70');
    expect(document.getElementById('oc-terms')).toHaveTextContent('2');
  });

  it('two cards: a static deck without arrows, mode-2', async () => {
    mountPlanner(ownerSource({ sessions: sessions() }));
    await screen.findByTestId('planning-carousel');
    expect(document.querySelector('.adaptive-deck')).toHaveClass('mode-2');
    expect(document.querySelector('.adaptive-nav-row')).toHaveClass('is-static');
    expect(document.getElementById('adaptive-page')).toHaveTextContent('1–2 / 2');
    expect(document.querySelectorAll('.precision-bracket')).toHaveLength(2);
    expect(document.querySelector('[data-deck-nav="1"]')).toBeDisabled();
  });

  it('the cards share the deck: --deck-n is the number of cards when fewer than fit, two otherwise', async () => {
    mountPlanner(ownerSource({ sessions: sessions() }));
    const deck = await screen.findByTestId('planning-carousel');
    expect(deck.style.getPropertyValue('--deck-n')).toBe('2');
    cleanup();
    mountPlanner(ownerSource({ categories: [{ id: 's', name: 'Spiro', iconKey: 'heart', color: '#00f1dc', slotMinutes: 90, parallelCapacity: 1 }], demands: [{ categoryId: 's', requested: 4, baselinePlanned: 0 }] }));
    const one = await screen.findByTestId('planning-carousel');
    expect(document.querySelectorAll('#planning-cards .plan-card')).toHaveLength(1);
    expect(one.style.getPropertyValue('--deck-n')).toBe('1');
    expect(document.querySelector('.adaptive-card-stage')).toHaveClass('without-navigation');
  });

  it('clicking a card arms the činnost; clicking it again disarms; the hint follows', async () => {
    mountPlanner(ownerSource({ sessions: sessions() }));
    await screen.findByTestId('planning-carousel');
    const hint = document.getElementById('active-plan-hint')!;
    expect(hint).toHaveTextContent('Vyberte činnost');
    fireEvent.click(card('s'));
    expect(card('s')).toHaveAttribute('aria-pressed', 'true');
    expect(card('s')).toHaveClass('is-selected');
    expect(card('s').querySelector('.plan-active-label')).toHaveTextContent('AKTIVNÍ');
    expect(card('s').querySelector('.plan-bottom > span')).toHaveTextContent('VYBRÁNO PRO PLÁNOVÁNÍ');
    expect(hint).toHaveClass('active');
    expect(hint).toHaveTextContent('Právě plánujete: Spiroergometrické vyšetření');
    expect(hint).toHaveTextContent('90 min / osoba · zbývá 46 osob');
    expect(await screen.findByText('Aktivní: Spiroergometrické vyšetření. Táhněte myší v kalendáři.')).toBeInTheDocument();
    fireEvent.click(card('s'));
    expect(card('s')).toHaveAttribute('aria-pressed', 'false');
    expect(hint).not.toHaveClass('active');
    expect(await screen.findByText('Výběr činnosti zrušen')).toBeInTheDocument();
  });

  it('Esc ends the selection', async () => {
    mountPlanner(ownerSource({ sessions: sessions() }));
    await screen.findByTestId('planning-carousel');
    fireEvent.click(card('k'));
    expect(card('k')).toHaveClass('is-selected');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(card('k')).not.toHaveClass('is-selected');
  });

  it('a complete činnost says so instead of arming: the "Hotovo" card', async () => {
    mountPlanner(ownerSource({ sessions: [term('all', '2026-11-18', '07:00', '19:00', 'k', 12), term('all2', '2026-11-19', '07:00', '15:00', 'k', 8)] }));
    await screen.findByTestId('planning-carousel');
    expect(card('k')).toHaveClass('is-complete');
    expect(card('k').querySelector('.plan-bottom > span')).toHaveTextContent('HOTOVO');
    expect(card('k').querySelector('.plan-remaining')).toHaveTextContent('✓ Požadavek splněn');
    fireEvent.click(card('k'));
    expect(card('k')).not.toHaveClass('is-selected');
    const callout = await screen.findByTestId('completion-callout');
    await waitFor(() => expect(callout).not.toHaveAttribute('hidden'));
    expect(callout).toHaveTextContent('Požadavek naplněn');
    expect(callout).toHaveTextContent('20 / 20 osob');
    // the highlighted button names the next činnost that is not complete and arms it
    fireEvent.click(within(callout).getByRole('button', { name: /Další: Spiroergometrické vyšetření/ }));
    expect(card('s')).toHaveClass('is-selected');
  });

  it('the summary card opens the command centre with the real numbers, Zpět the order overview', async () => {
    mountPlanner(ownerSource({ sessions: sessions() }));
    await screen.findByTestId('planning-carousel');
    fireEvent.click(screen.getByTestId('summary-card'));
    const layer = screen.getByTestId('summary-layer');
    expect(layer).not.toHaveAttribute('hidden');
    expect(layer.querySelector('.s41-ring-percent')).toHaveTextContent('7%');
    expect(layer.querySelector('.s41-count-primary')).toHaveTextContent('5');
    expect(layer.querySelector('.s41-count-total')).toHaveTextContent('/ 70');
    expect(layer.querySelector('.s41-remaining')).toHaveTextContent('Zbývá 65 osob · 88 h');
    expect(layer.querySelector('.s41-badge')).toHaveTextContent('V PRŮBĚHU');
    // the price list: 20 x 1 600 + 50 x 900 = 77 000 Kč
    expect(screen.getByTestId('order-money')).toHaveTextContent('77');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(layer).toHaveAttribute('hidden');
    act(() => { fireEvent.click(document.querySelector('[data-summary-back]')!); });
    expect(await screen.findByRole('heading', { name: 'Přehled existující objednávky' })).toBeInTheDocument();
    expect(screen.getByText('4 / 50', { exact: false })).toBeInTheDocument();
  });
});
