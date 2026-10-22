import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { mountPlanner, ownerSource, term } from '../components/plan/testHarness';
import { HINT_KEY_PREFIX, parseMemory } from './hints';
import { PLANNER_TEXT } from '../text';

const KEY = `${HINT_KEY_PREFIX}anon`;
const card = (id: string) => document.querySelector<HTMLElement>(`[data-plan-type="${id}"]`)!;

const four = [
  { id: 'a', name: 'Činnost A', subtitle: '', iconKey: 'heart', color: '#00f1dc', slotMinutes: 30, parallelCapacity: 1 },
  { id: 'b', name: 'Činnost B', subtitle: '', iconKey: 'run', color: '#0f94ff', slotMinutes: 30, parallelCapacity: 1 },
  { id: 'c', name: 'Činnost C', subtitle: '', iconKey: 'heart', color: '#9157f2', slotMinutes: 30, parallelCapacity: 1 },
  { id: 'd', name: 'Činnost D', subtitle: '', iconKey: 'run', color: '#ffb124', slotMinutes: 30, parallelCapacity: 1 },
];
const fourDemands = four.map((c) => ({ categoryId: c.id, requested: 4, baselinePlanned: 0 }));

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  window.localStorage.clear();
});
afterEach(() => cleanup());

describe('the guide · "what now" pop-out', () => {
  it('(a) an empty order: one calm hint with the real gestures, and it is not a dialog or a panel', async () => {
    mountPlanner(ownerSource());
    const hint = await screen.findByTestId('guide-hint');
    expect(hint).toHaveAttribute('data-hint', 'start');
    expect(hint).toHaveTextContent(PLANNER_TEXT.guide.start.board);
    expect(hint).toHaveTextContent('Vyberte činnost dole a táhněte v kalendáři');
    expect(hint).toHaveTextContent('Klepnutí na den v měsíci vezme celý den');
    expect(screen.getAllByTestId('guide-hint')).toHaveLength(1);
    expect(hint.closest('[role=dialog]')).toBeNull();
  });

  it('it says what to do next once a činnost is armed', async () => {
    mountPlanner(ownerSource());
    await screen.findByTestId('guide-hint');
    fireEvent.click(card('k'));
    await waitFor(() => expect(screen.getByTestId('guide-hint')).toHaveAttribute('data-variant', 'armedBoard'));
    expect(screen.getByTestId('guide-hint')).toHaveTextContent('Teď táhněte v kalendáři');
  });

  it('x closes it and remembers it for this person: it does not come back after a reload', async () => {
    const first = mountPlanner(ownerSource());
    fireEvent.click(await screen.findByRole('button', { name: 'Zavřít nápovědu' }));
    expect(screen.queryByTestId('guide-hint')).toBeNull();
    expect(parseMemory(window.localStorage.getItem(KEY))).toEqual({ seen: { start: true }, muted: false });
    first.unmount();
    mountPlanner(ownerSource());
    await screen.findByTestId('planning-carousel');
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByTestId('guide-hint')).toBeNull();
  });

  it('"Nezobrazovat" silences every hint for this person', async () => {
    mountPlanner(ownerSource({ categories: four, demands: fourDemands }));
    fireEvent.click(await screen.findByRole('button', { name: 'Nezobrazovat' }));
    expect(screen.queryByTestId('guide-hint')).toBeNull();
    expect(parseMemory(window.localStorage.getItem(KEY)).muted).toBe(true);
  });

  it('a hint is per person: another sign-in sees it again', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ seen: { start: true }, muted: false }));
    window.localStorage.setItem('user', JSON.stringify({ id: 'someone-else', firstName: 'Jana', lastName: 'Nová' }));
    mountPlanner(ownerSource());
    expect(await screen.findByTestId('guide-hint')).toHaveAttribute('data-hint', 'start');
  });

  it('junk in the storage does not break the planner: the hint shows as for a new person', async () => {
    window.localStorage.setItem(KEY, '{"seen": [1,2], garbage');
    mountPlanner(ownerSource());
    expect(await screen.findByTestId('guide-hint')).toHaveAttribute('data-hint', 'start');
  });

  it('(f) with 4 or more činnosti the strip gets its own hint, after the start hint and never together', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ seen: { start: true }, muted: false }));
    mountPlanner(ownerSource({ categories: four, demands: fourDemands }));
    const hint = await screen.findByTestId('guide-hint');
    expect(hint).toHaveAttribute('data-hint', 'strip');
    expect(hint).toHaveTextContent('Činností je víc, než se vejde');
    expect(screen.getAllByTestId('guide-hint')).toHaveLength(1);
  });

  it('(f) not for three činnosti', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ seen: { start: true }, muted: false }));
    mountPlanner(ownerSource({ categories: four.slice(0, 3), demands: fourDemands.slice(0, 3) }));
    await screen.findByTestId('planning-carousel');
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByTestId('guide-hint')).toBeNull();
  });

  it('never while the completion card is on screen', async () => {
    const full = [term('f1', '2026-11-16', '07:00', '19:00', 'k', 12), term('f2', '2026-11-17', '07:00', '15:00', 'k', 8)];
    mountPlanner(ownerSource({ sessions: full }));
    await screen.findByTestId('planning-carousel');
    fireEvent.click(card('k'));
    await screen.findByTestId('completion-callout');
    expect(screen.queryByTestId('guide-hint')).toBeNull();
  });
});

describe('the completion card · the next step', () => {
  const kFull = [term('f1', '2026-11-16', '07:00', '19:00', 'k', 12), term('f2', '2026-11-17', '07:00', '15:00', 'k', 8)];

  it('(b) a fulfilled činnost: the next unfulfilled one is the highlighted button and it arms that card', async () => {
    mountPlanner(ownerSource({ sessions: kFull }));
    await screen.findByTestId('planning-carousel');
    fireEvent.click(card('k'));
    const callout = await screen.findByTestId('completion-callout');
    const primary = within(callout).getByRole('button', { name: 'Další: Spiroergometrické vyšetření' });
    expect(primary).toHaveClass('completion-primary');
    expect(callout.querySelector('[data-completion-next]')).toHaveAttribute('data-completion-next', 'next');
    expect(within(callout).queryByRole('button', { name: 'Připravit formulář' })).toBeNull();
    fireEvent.click(primary);
    expect(card('s')).toHaveClass('is-selected');
    expect(screen.getByTestId('completion-callout')).toHaveAttribute('hidden');
  });

  it('(b) the strip slides to the offered card when it is not in view', async () => {
    const some = [term('f1', '2026-11-16', '07:00', '19:00', 'a', 4)];
    mountPlanner(ownerSource({ categories: four, demands: fourDemands, sessions: some }));
    await screen.findByTestId('planning-carousel');
    fireEvent.click(card('a'));
    const callout = await screen.findByTestId('completion-callout');
    fireEvent.click(within(callout).getByRole('button', { name: 'Další: Činnost B' }));
    expect(card('b')).toHaveClass('is-selected');
  });

  it('(c) the whole order complete: "Připravit formulář" is the highlighted action, with one sentence on what happens next', async () => {
    const all = [term('f1', '2026-11-16', '07:00', '19:00', 'k', 12), term('f2', '2026-11-17', '07:00', '15:00', 'k', 8)];
    mountPlanner(ownerSource({ sessions: all, demands: [{ categoryId: 'k', requested: 20, baselinePlanned: 0 }] }));
    await screen.findByTestId('planning-carousel');
    fireEvent.click(card('k'));
    const callout = await screen.findByTestId('completion-callout');
    expect(callout).toHaveTextContent('Celá objednávka naplánována');
    const prepare = within(callout).getByRole('button', { name: 'Připravit formulář' });
    expect(prepare).toHaveClass('completion-primary');
    expect(callout.querySelector('[data-completion-next]')).toHaveTextContent(PLANNER_TEXT.guide.callout.prepareSentence);
    fireEvent.click(prepare);
    const dialog = await screen.findByTestId('planner-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Připravit přihlašovací formulář' })).toBeInTheDocument();
    expect(within(dialog).getByTestId('publish-steps').querySelectorAll('li')).toHaveLength(3);
    expect(within(dialog).getByTestId('publish-steps').querySelector('[aria-current="step"]')).toHaveAttribute('data-step', '1');
  });

  it('(c) the summary card\'s "Připravit formulář" is marked ready only when nothing is left to plan', async () => {
    mountPlanner(ownerSource({ sessions: kFull }));
    await screen.findByTestId('planning-carousel');
    expect(document.querySelector('[data-publish-launch]')).not.toHaveAttribute('data-ready');
    cleanup();
    mountPlanner(ownerSource({ sessions: [term('f1', '2026-11-16', '07:00', '19:00', 'k', 12), term('f2', '2026-11-17', '07:00', '15:00', 'k', 8)], demands: [{ categoryId: 'k', requested: 20, baselinePlanned: 0 }] }));
    await screen.findByTestId('planning-carousel');
    expect(document.querySelector('[data-publish-launch]')).toHaveAttribute('data-ready', 'true');
  });
});
