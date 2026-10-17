import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { PlannerWriteError } from '../../data/PlannerDataSource';
import { at, drag, giveBoardGeometry, mountPlanner, ownerSource, press, release, term } from './testHarness';

beforeEach(() => setViewport(VIEWPORTS.desktop));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const card = (id: string) => document.querySelector<HTMLElement>(`[data-plan-type="${id}"]`)!;
const board = () => {
  const el = document.getElementById('day-board')!;
  giveBoardGeometry(el);
  return el;
};

async function ready() {
  await screen.findByTestId('planning-carousel');
  await waitFor(() => expect(document.getElementById('day-board')).not.toBeNull());
  return board();
}

describe('placement drag · the file\'s live preview, validated, counted per činnost', () => {
  it('shows the preview, the HUD and the figures of the card, the summary and the hint WHILE dragging', async () => {
    const source = ownerSource();
    mountPlanner(source);
    const b = await ready();
    fireEvent.click(card('k'));
    press(b, at(2, 540)); // Wednesday 18. 11., 09:00
    drag(b, at(2, 700)); // 160 minutes down -> 3 slots of 60 min
    const preview = document.getElementById('drag-preview')!;
    expect(preview).not.toHaveAttribute('hidden');
    expect(preview).toHaveTextContent('+3 slotů');
    expect(preview).toHaveTextContent('09:00 – 12:00');
    const hud = document.getElementById('drag-hud')!;
    expect(hud).not.toHaveAttribute('hidden');
    expect(hud).toHaveTextContent('ŽIVÝ NÁHLED PLÁNOVÁNÍ');
    expect(hud).toHaveTextContent('3 / 20 osob');
    expect(hud).toHaveTextContent('zbývá 17 osob');
    // the card, the summary and the command panel preview the same
    expect(card('k')).toHaveClass('is-previewing');
    expect(card('k').querySelector('.plan-num')).toHaveTextContent('3 / 20');
    expect(card('k').querySelector('.plan-bottom > span')).toHaveTextContent('✦ NÁHLED +3 OSOB');
    expect(card('s').querySelector('.plan-num')).toHaveTextContent('0 / 50');
    expect(document.getElementById('insight-preview')).toHaveTextContent('+3 náhled');
    expect(document.getElementById('adaptive-count')).toHaveTextContent('3 / 70');
    expect(document.getElementById('order-command')).toHaveClass('previewing');
    expect(document.getElementById('active-plan-hint')).toHaveClass('is-dragging');
    expect(document.getElementById('active-plan-hint')).toHaveTextContent('NÁHLED: Komplexní sportovní prohlídka');
    expect(document.getElementById('active-plan-hint')).toHaveTextContent('UPUŠTĚNÍM VYTVOŘÍTE');
    // nothing was written yet
    expect(source.snapshotSessions()).toHaveLength(0);
    // Esc drops the drag
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(preview).toHaveAttribute('hidden');
    expect(card('k')).not.toHaveClass('is-previewing');
  });

  it('with ONE open činnost the drop writes the interval at once (draft) with the undo toast', async () => {
    const source = ownerSource({ demands: [{ categoryId: 'k', requested: 20, baselinePlanned: 0 }], categories: undefined });
    mountPlanner(source);
    const b = await ready();
    fireEvent.click(card('k'));
    press(b, at(1, 480));
    drag(b, at(1, 600));
    release(b, at(1, 600));
    await waitFor(() => expect(source.snapshotSessions()).toHaveLength(1));
    const created = source.snapshotSessions()[0]!;
    expect(created).toMatchObject({ date: '2026-11-17', start: '08:00', end: '10:00', categoryId: 'k', capacity: 2 });
    expect(await screen.findByText('✓ Přidáno 2 slotů pro Komplexní sportovní prohlídka')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '↶ Zpět' })).toBeInTheDocument();
    await waitFor(() => expect(card('k').querySelector('.plan-num')).toHaveTextContent('2 / 20'));
    // Ctrl+Z reverts the draft
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    await waitFor(() => expect(source.snapshotSessions()).toHaveLength(0));
  });

  it('adjacent blocks of the same činnost merge into one term', async () => {
    const source = ownerSource({ demands: [{ categoryId: 'k', requested: 20, baselinePlanned: 0 }], sessions: [term('a', '2026-11-17', '08:00', '10:00', 'k', 2)] });
    mountPlanner(source);
    const b = await ready();
    fireEvent.click(card('k'));
    press(b, at(1, 600));
    drag(b, at(1, 660));
    release(b, at(1, 660));
    await waitFor(() => expect(source.snapshotSessions().find((s) => s.start === '08:00')?.end).toBe('11:00'));
    expect(source.snapshotSessions()).toHaveLength(1);
    expect(await screen.findByText(/spojeno s existujícím termínem/)).toBeInTheDocument();
  });

  it('refuses an overlap with the reason, and writes nothing', async () => {
    const source = ownerSource({ sessions: [term('busy', '2026-11-17', '09:00', '11:00', 's', 1, { origin: 'public' })] });
    mountPlanner(source);
    const b = await ready();
    fireEvent.click(card('k'));
    press(b, at(1, 540));
    drag(b, at(1, 640));
    expect(document.getElementById('drag-preview')).toHaveClass('invalid');
    expect(document.getElementById('drag-hud')).toHaveTextContent('TERMÍN NELZE VYTVOŘIT');
    expect(document.getElementById('drag-hud')).toHaveTextContent('Čas se překrývá s již vytvořeným termínem.');
    release(b, at(1, 640));
    expect(await screen.findByText('Čas se překrývá s již vytvořeným termínem.')).toBeInTheDocument();
    expect(source.snapshotSessions()).toHaveLength(1);
  });

  it('nothing armed: the board asks to pick a činnost first', async () => {
    mountPlanner(ownerSource());
    const b = await ready();
    press(b, at(1, 540));
    expect(await screen.findByText('Nejprve klikněte na činnost ve spodních kartách.')).toBeInTheDocument();
  });

  it('a right click on the board disarms the činnost', async () => {
    mountPlanner(ownerSource());
    const b = await ready();
    fireEvent.click(card('k'));
    fireEvent.contextMenu(b);
    expect(card('k')).not.toHaveClass('is-selected');
  });
});

describe('the činnosti bubble of a dropped window (several činnosti open)', () => {
  it('opens at once with the dropped window; Potvrdit writes it for the armed činnost', async () => {
    const source = ownerSource();
    mountPlanner(source);
    const b = await ready();
    fireEvent.click(card('s'));
    press(b, at(2, 480)); // 08:00
    drag(b, at(2, 780)); // 300 minutes -> 4 slots of 90 min
    release(b, at(2, 780));
    const ask = await screen.findByTestId('pick-ask');
    expect(source.snapshotSessions()).toHaveLength(0); // nothing is written before the desk confirms
    expect(within(ask).getByText('Činnosti termínu')).toBeInTheDocument();
    expect(within(ask).getByText(/Pro které činnosti je tento termín/)).toBeInTheDocument();
    // the window stays drawn under the bubble
    expect(document.querySelector('[data-pick-id="ask"]')).not.toBeNull();
    const ticks = within(ask).getAllByTestId('pick-ask-activity');
    expect(ticks.map((t) => [t.getAttribute('data-activity-id'), t.getAttribute('data-on')])).toEqual([['k', 'false'], ['s', 'true']]);
    fireEvent.click(within(ask).getByTestId('pick-ask-confirm'));
    await waitFor(() => expect(source.snapshotSessions()).toHaveLength(1));
    expect(source.snapshotSessions()[0]).toMatchObject({ date: '2026-11-18', start: '08:00', end: '14:00', categoryId: 's', capacity: 4 });
    await waitFor(() => expect(card('s').querySelector('.plan-num')).toHaveTextContent('4 / 50'));
    expect(screen.queryByTestId('pick-ask')).toBeNull();
  });

  it('"Vše": the window is laid out činnost after činnost in the order\'s order (sequential plan)', async () => {
    const source = ownerSource({
      demands: [{ categoryId: 'k', requested: 2, baselinePlanned: 0 }, { categoryId: 's', requested: 2, baselinePlanned: 0 }],
    });
    mountPlanner(source);
    const b = await ready();
    fireEvent.click(card('s'));
    press(b, at(0, 480));
    drag(b, at(0, 700)); // 2 spiro slots = 180 min (capped by the 2 players) 08:00-11:00
    release(b, at(0, 700));
    const ask = await screen.findByTestId('pick-ask');
    fireEvent.click(within(ask).getByTestId('pick-ask-all'));
    // 2 komplexní (120 min), then 1 spiro slot (60 min do not fit a 90-min slot) -> spiro does not fit whole
    await waitFor(() => expect(within(ask).getByTestId('pick-ask-plan')).toHaveTextContent('Komplexní sportovní prohlídka 08:00–10:00'));
    fireEvent.click(within(ask).getByTestId('pick-ask-confirm'));
    await waitFor(() => expect(source.snapshotSessions().length).toBeGreaterThan(0));
    const [only] = source.snapshotSessions();
    expect(only).toMatchObject({ categoryId: 'k', start: '08:00', end: '10:00', capacity: 2 });
    await waitFor(() => expect(card('k')).toHaveClass('is-complete'));
  });

  it('Rozdělit okno: the window is cut in two parts and both are written', async () => {
    const source = ownerSource();
    mountPlanner(source);
    const b = await ready();
    fireEvent.click(card('k'));
    press(b, at(3, 480));
    drag(b, at(3, 720)); // 4 slots 08:00-12:00
    release(b, at(3, 720));
    const ask = await screen.findByTestId('pick-ask');
    fireEvent.click(within(ask).getByTestId('pick-ask-split'));
    expect(within(ask).getAllByTestId('pick-ask-part')).toHaveLength(2);
    fireEvent.click(within(ask).getByTestId('pick-ask-confirm'));
    // both halves belong to the same činnost and are adjacent: the draft merges them into one term of 4 slots
    await waitFor(() => expect(source.snapshotSessions()).toHaveLength(1));
    expect(source.snapshotSessions()[0]).toMatchObject({ start: '08:00', end: '12:00', capacity: 4, categoryId: 'k' });
  });

  it('Esc on the bubble drops the window only - the činnost stays armed, nothing was created', async () => {
    const source = ownerSource();
    mountPlanner(source);
    const b = await ready();
    fireEvent.click(card('k'));
    press(b, at(3, 480));
    drag(b, at(3, 600));
    release(b, at(3, 600));
    const ask = await screen.findByTestId('pick-ask');
    fireEvent.keyDown(within(ask).getByTestId('pick-ask-confirm'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('pick-ask')).toBeNull());
    expect(card('k')).toHaveClass('is-selected');
    expect(source.snapshotSessions()).toHaveLength(0);
  });

  it('Zrušit drops the window - nothing was created', async () => {
    const source = ownerSource();
    mountPlanner(source);
    const b = await ready();
    fireEvent.click(card('k'));
    press(b, at(3, 480));
    drag(b, at(3, 600));
    release(b, at(3, 600));
    await screen.findByTestId('pick-ask');
    fireEvent.click(screen.getByTestId('pick-ask-cancel'));
    await waitFor(() => expect(screen.queryByTestId('pick-ask')).toBeNull());
    expect(source.snapshotSessions()).toHaveLength(0);
  });
});

describe('the "Hotovo" guard and "Přidat termín navíc"', () => {
  const full = () => [term('f1', '2026-11-16', '07:00', '19:00', 'k', 12), term('f2', '2026-11-17', '07:00', '15:00', 'k', 8)];

  it('once every player of a činnost has a place a drag is refused with the completion callout', async () => {
    mountPlanner(ownerSource({ sessions: full() }));
    const b = await ready();
    fireEvent.click(card('k')); // complete: the callout, nothing armed
    expect(card('k')).not.toHaveClass('is-selected');
    press(b, at(4, 540));
    expect(await screen.findByText('Nejprve klikněte na činnost ve spodních kartách.')).toBeInTheDocument();
  });

  it('"Přidat termín navíc" arms exactly ONE extra drop, which is reported as spare', async () => {
    const source = ownerSource({ sessions: full() });
    mountPlanner(source);
    const b = await ready();
    fireEvent.click(card('k'));
    const callout = await screen.findByTestId('completion-callout');
    fireEvent.click(within(callout).getByRole('button', { name: 'Přidat termín navíc' }));
    expect(card('k')).toHaveClass('is-selected');
    expect(await screen.findByText(/Další termín: označte ho v kalendáři/)).toBeInTheDocument();
    press(b, at(4, 540));
    drag(b, at(4, 600));
    expect(document.getElementById('drag-hud')).toHaveTextContent('Termín navíc nad rámec požadavku');
    release(b, at(4, 600));
    await waitFor(() => expect(source.snapshotSessions()).toHaveLength(3));
    expect(await screen.findByText(/Přidán termín navíc/)).toBeInTheDocument();
    // the guard closes again: nothing armed, a new drag is refused
    expect(card('k')).not.toHaveClass('is-selected');
    press(b, at(4, 700));
    expect(await screen.findAllByText('Nejprve klikněte na činnost ve spodních kartách.')).not.toHaveLength(0);
  });
});

describe('moving a planned term · the confirmation and the registered athletes', () => {
  const one = () => [term('t1', '2026-11-17', '08:00', '10:00', 'k', 2), term('t2', '2026-11-18', '08:00', '09:00', 's', 1)];
  const cardOf = (id: string) => document.querySelector<HTMLElement>(`[data-session-id="${id}"]`)!;

  it('dragging a term shows the ghost and, on release, asks before moving; Potvrdit moves it (one call)', async () => {
    const source = ownerSource({ sessions: one() });
    const moveSpy = vi.spyOn(source, 'moveInterval');
    mountPlanner(source);
    const b = await ready();
    press(cardOf('t1'), at(1, 540)); // grabbed in the middle (09:00)
    drag(b, at(1, 545)); // under the 7 px threshold: nothing yet
    expect(document.getElementById('move-ghost')).toHaveAttribute('hidden');
    drag(b, at(3, 660)); // Thursday, 11:00 under the pointer -> the term starts at 10:00
    const ghost = document.getElementById('move-ghost')!;
    expect(ghost).not.toHaveAttribute('hidden');
    expect(ghost).toHaveTextContent('10:00 – 12:00');
    expect(document.getElementById('move-hud')).toHaveTextContent('NÁHLED PŘESUNU');
    release(b, at(3, 660));
    expect(await screen.findByRole('heading', { name: 'Opravdu přesunout termín?' })).toBeInTheDocument();
    expect(moveSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Potvrdit přesun/ }));
    await waitFor(() => expect(moveSpy).toHaveBeenCalledTimes(1));
    expect(moveSpy.mock.calls[0]![0]).toMatchObject({ id: 't1', date: '2026-11-19', start: '10:00', end: '12:00' });
    expect(moveSpy.mock.calls[0]![0].cancelAffectedAthletes).toBeUndefined();
    await waitFor(() => expect(source.snapshotSessions().find((s) => s.id === 't1')).toMatchObject({ date: '2026-11-19', start: '10:00' }));
    expect(await screen.findByText(/Termín přesunut · 2026-11-19 10:00–12:00/)).toBeInTheDocument();
  });

  it('Esc during the move cancels it with the original term untouched', async () => {
    const source = ownerSource({ sessions: one() });
    mountPlanner(source);
    const b = await ready();
    press(cardOf('t1'), at(1, 540));
    drag(b, at(3, 660));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.getElementById('move-ghost')).toHaveAttribute('hidden');
    expect(await screen.findByText('Přesun zrušen. Původní termín zůstal beze změny.')).toBeInTheDocument();
    release(b, at(3, 660));
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
    expect(source.snapshotSessions().find((s) => s.id === 't1')).toMatchObject({ date: '2026-11-17', start: '08:00' });
  });

  it('a collision is refused with the reason, no dialog', async () => {
    const source = ownerSource({ sessions: one() });
    mountPlanner(source);
    const b = await ready();
    press(cardOf('t1'), at(1, 540));
    drag(b, at(2, 510)); // onto the spiro term of Wednesday (08:00-09:00)
    expect(document.getElementById('move-ghost')).toHaveClass('not-allowed');
    release(b, at(2, 510));
    expect(await screen.findByText(/Kolize: Spiroergometrické vyšetření · 08:00–09:00\./)).toBeInTheDocument();
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
  });

  it('registered athletes (409): they are listed, the move is repeated ONLY after an explicit confirmation', async () => {
    const source = ownerSource({ sessions: one() });
    const original = source.moveInterval.bind(source);
    const spy = vi.spyOn(source, 'moveInterval').mockImplementationOnce(async () => {
      throw new PlannerWriteError('conflict', 'Přesun zruší přihlášky sportovců.', [
        { name: 'Jan Novák', activityName: 'Komplexní sportovní prohlídka' },
        { name: 'Petr Svoboda' },
      ]);
    }).mockImplementation(original);
    mountPlanner(source);
    const b = await ready();
    press(cardOf('t1'), at(1, 540));
    drag(b, at(3, 660));
    release(b, at(3, 660));
    fireEvent.click(await screen.findByRole('button', { name: /Potvrdit přesun/ }));
    const list = await screen.findByTestId('affected-athletes');
    expect(list).toHaveTextContent('Změna zruší přihlášky 2 sportovců');
    expect(list).toHaveTextContent('Jan Novák (Komplexní sportovní prohlídka)');
    expect(list).toHaveTextContent('Petr Svoboda');
    const confirm = screen.getByRole('button', { name: /Potvrdit přesun/ });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(list).getByTestId('athletes-ack'));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy.mock.calls[0]![0].cancelAffectedAthletes).toBeUndefined();
    expect(spy.mock.calls[1]![0].cancelAffectedAthletes).toBe(true);
    await waitFor(() => expect(source.snapshotSessions().find((s) => s.id === 't1')).toMatchObject({ date: '2026-11-19' }));
  });

  it('a term somebody else changed meanwhile is not overwritten (stale)', async () => {
    const source = ownerSource({ sessions: one() });
    vi.spyOn(source, 'moveInterval').mockRejectedValueOnce(new PlannerWriteError('stale', 'Termín se mezitím změnil. Otevřete jej znovu pro aktuální kontrolu.'));
    mountPlanner(source);
    const b = await ready();
    press(cardOf('t1'), at(1, 540));
    drag(b, at(3, 660));
    release(b, at(3, 660));
    fireEvent.click(await screen.findByRole('button', { name: /Potvrdit přesun/ }));
    expect(await screen.findByText('Termín se mezitím změnil. Otevřete jej znovu pro aktuální kontrolu.')).toBeInTheDocument();
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
  });
});

describe('pulling the edge of a term · the confirmation', () => {
  const one = () => [term('t1', '2026-11-17', '08:00', '10:00', 'k', 2)];
  const handle = (edge: 'top' | 'bottom') => document.querySelector<HTMLElement>(`[data-session-id="t1"] .term-resize-handle[data-expand-edge="${edge}"]`)!;
  const px = (minutes: number) => (minutes / 720) * 455;

  it('pull the bottom edge down by two slots, confirm: the term grows by two slots', async () => {
    const source = ownerSource({ sessions: one() });
    const spy = vi.spyOn(source, 'resizeInterval');
    mountPlanner(source);
    const b = await ready();
    const from = at(1, 600);
    press(handle('bottom'), from);
    drag(b, { clientX: from.clientX, clientY: from.clientY + px(120) + 1 });
    expect(document.getElementById('term-resize-hud')).toHaveTextContent('ROZŠÍŘENÍ TERMÍNU');
    expect(document.getElementById('term-resize-hud')).toHaveTextContent('2 → 4 slotů');
    expect(document.getElementById('term-resize-added')).toHaveTextContent('+2 slotů');
    // the card of the činnost previews the two extra places
    expect(card('k').querySelector('.plan-num')).toHaveTextContent('4 / 20');
    release(b, { clientX: from.clientX, clientY: from.clientY + px(120) + 1 });
    expect(await screen.findByRole('heading', { name: 'Opravdu rozšířit termín?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Potvrdit rozšíření/ }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0]![0]).toMatchObject({ id: 't1', edge: 'bottom', start: '08:00', end: '12:00', added: 2 });
    await waitFor(() => expect(source.snapshotSessions()[0]).toMatchObject({ end: '12:00', capacity: 4 }));
    expect(await screen.findByText(/Termín rozšířen o 2 místa|Termín rozšířen o 2 míst/)).toBeInTheDocument();
  });

  it('pulling beyond what the order still needs is refused with the reason', async () => {
    const source = ownerSource({ demands: [{ categoryId: 'k', requested: 3, baselinePlanned: 0 }], sessions: one() });
    mountPlanner(source);
    const b = await ready();
    const from = at(1, 600);
    press(handle('bottom'), from);
    drag(b, { clientX: from.clientX, clientY: from.clientY + px(180) + 1 }); // +3 slots, only 1 left
    expect(document.getElementById('term-resize-hud')).toHaveClass('is-invalid');
    expect(document.getElementById('term-resize-hud')).toHaveTextContent('V objednávce zbývá pouze 1 míst pro tuto činnost.');
    release(b, { clientX: from.clientX, clientY: from.clientY + px(180) + 1 });
    expect(await screen.findAllByText('V objednávce zbývá pouze 1 míst pro tuto činnost.')).not.toHaveLength(0);
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
  });
});
