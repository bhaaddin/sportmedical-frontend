import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { mountPlanner, ownerSource, term } from './testHarness';

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
    // "Jiná činnost" arms the next one that is not complete
    fireEvent.click(within(callout).getByRole('button', { name: 'Jiná činnost' }));
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
