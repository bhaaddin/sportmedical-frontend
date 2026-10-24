import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { PlannerWriteError } from '../../data/PlannerDataSource';
import type { DialogState } from '../../model';
import { usePlannerActions } from '../../state/PlannerStoreProvider';
import { PlannerGate } from '../PlannerGate';
import { PlannerProviders } from '../PlannerProviders';
import { PlannerLayers } from '../PlannerShell';
import { PlannerStage } from '../PlannerStage';
import type { PickSession } from '../../../components/clubs/order/pickSession';
import { clubPlanningFromState, useClubPlanningContext } from './useClubPlanningContext';
import { TODAY, WEEK_DATE, mountPlanner, ownerSource, term } from './testHarness';
import type { DemoDataSource } from '../../data/DemoDataSource';

const clipboard = { writeText: vi.fn<(text: string) => Promise<void>>() };

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  clipboard.writeText.mockReset();
  clipboard.writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const card = (id: string) => document.querySelector<HTMLElement>(`[data-plan-type="${id}"]`)!;
const owner = () => [term('w1', '2026-11-18', '08:00', '14:00', 's', 4), term('w2', '2026-11-18', '14:30', '15:30', 'k', 1)];
const kOnly = [{ categoryId: 'k', requested: 20, baselinePlanned: 0 }];

/** The finish check is reached from the completion callout's "Prohlédnout plán". */
async function openFinish() {
  await screen.findByTestId('planning-carousel');
  // a complete činnost shows the callout; if none is complete the summary's route is used by the caller
  fireEvent.click(card('k'));
  const callout = await screen.findByTestId('completion-callout');
  fireEvent.click(within(callout).getByRole('button', { name: /Prohlédnout plán/ }));
  return screen.findByTestId('planner-dialog');
}

/** Mount the layers with a button that opens an arbitrary dialog (no UI path of this slice leads to some). */
function Opener({ dialog }: { dialog: DialogState }) {
  const act = usePlannerActions();
  return <button type="button" data-testid="open-dialog" onClick={() => act.openDialog(dialog)}>open</button>;
}
function mountWithDialog(source: DemoDataSource, dialog: DialogState) {
  return render(
    <MemoryRouter>
      <PlannerProviders source={source} today={TODAY} initialDate={WEEK_DATE}>
        <PlannerStage>
          <PlannerGate>
            <PlannerLayers />
            <Opener dialog={dialog} />
          </PlannerGate>
        </PlannerStage>
      </PlannerProviders>
    </MemoryRouter>,
  );
}

describe('finish · the shortfall confirm and the one real write', () => {
  const partial = () => [term('f1', '2026-11-16', '07:00', '19:00', 'k', 12), term('f2', '2026-11-17', '07:00', '15:00', 'k', 8), term('x', '2026-11-18', '08:00', '14:00', 's', 4)];

  it('players without a slot: "Uložit i tak" asks first; "Vytvořit i tak" writes the order once and opens the summary', async () => {
    const source = ownerSource({ sessions: partial() });
    const spy = vi.spyOn(source, 'finishPlan');
    mountPlanner(source);
    const dialog = await openFinish();
    expect(within(dialog).getByRole('heading', { name: 'Kontrola rozpracovaného plánu' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('24 / 70');
    expect(dialog).toHaveTextContent('Zbývá naplánovat 46 osob');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Uložit i tak' }));
    const bubble = await screen.findByTestId('pick-shortfall-dialog');
    expect(bubble).toHaveTextContent('Chybí termíny');
    expect(bubble).toHaveTextContent('Chybí termíny pro 46 hráčů: Spiroergometrické 46');
    expect(spy).not.toHaveBeenCalled(); // nothing is written before the desk decides
    fireEvent.click(within(bubble).getByTestId('pick-shortfall-create'));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Plán byl uložen, objednávka zatím není kompletní/)).toBeInTheDocument();
    const layer = screen.getByTestId('summary-layer');
    await waitFor(() => expect(layer).not.toHaveAttribute('hidden'));
    expect(layer.querySelector('.s41-badge')).toHaveTextContent('V PRŮBĚHU');
  });

  it('"Doplnit termíny" closes the check and arms the činnost that is still short', async () => {
    const source = ownerSource({ sessions: partial() });
    const spy = vi.spyOn(source, 'finishPlan');
    mountPlanner(source);
    const dialog = await openFinish();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Uložit i tak' }));
    fireEvent.click(await screen.findByTestId('pick-shortfall-fill'));
    await waitFor(() => expect(screen.queryByTestId('planner-dialog')).toBeNull());
    expect(card('s')).toHaveClass('is-selected');
    expect(spy).not.toHaveBeenCalled();
  });

  it('places beyond the players: the bubble shows the money lost, "Zkrátit na potřebu" trims, then the plan is ready', async () => {
    const source = ownerSource({
      demands: kOnly,
      sessions: [term('a', '2026-11-16', '07:00', '19:00', 'k', 12), term('b', '2026-11-17', '08:00', '17:00', 'k', 9)],
    });
    const update = vi.spyOn(source, 'updateInterval');
    const finish = vi.spyOn(source, 'finishPlan');
    mountPlanner(source);
    const dialog = await openFinish();
    expect(within(dialog).getByRole('heading', { name: 'Dokončení plánování' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /označit plán jako připravený/i }));
    const bubble = await screen.findByTestId('pick-shortfall-dialog');
    expect(bubble).toHaveTextContent('Termíny navíc');
    expect(within(bubble).getByTestId('pick-shortfall-spare')).toHaveTextContent('1 600');
    expect(finish).not.toHaveBeenCalled();
    fireEvent.click(within(bubble).getByTestId('pick-shortfall-trim'));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0]![0]).toMatchObject({ id: 'b', end: '16:00', capacity: 8 });
    await waitFor(() => expect(source.snapshotSessions().find((s) => s.id === 'b')).toMatchObject({ end: '16:00', capacity: 8 }));
    expect(finish).not.toHaveBeenCalled(); // trimming is not saving
    // now nothing is spare: the plan is marked ready and the summary opens with PŘIPRAVENO
    await waitFor(() => expect(screen.queryByTestId('pick-shortfall-dialog')).toBeNull());
    fireEvent.click(await screen.findByRole('button', { name: 'Označit plán jako připravený' }));
    await waitFor(() => expect(finish).toHaveBeenCalledTimes(1));
    const layer = screen.getByTestId('summary-layer');
    await waitFor(() => expect(layer).not.toHaveAttribute('hidden'));
    expect(layer.querySelector('.s41-badge')).toHaveTextContent('PŘIPRAVENO');
    expect(source.isPlanCompleted).toBe(true);
  });

  it('registered athletes (409) of the saved order: listed, saved only after the explicit confirmation', async () => {
    const source = ownerSource({ demands: kOnly, sessions: [term('a', '2026-11-16', '07:00', '19:00', 'k', 12), term('b', '2026-11-17', '08:00', '16:00', 'k', 8)] });
    const original = source.finishPlan.bind(source);
    const spy = vi
      .spyOn(source, 'finishPlan')
      .mockRejectedValueOnce(new PlannerWriteError('conflict', 'Uložení zruší přihlášky.', [{ name: 'Eva Dvořáková', activityName: 'Komplexní' }]))
      .mockImplementation(original);
    mountPlanner(source);
    const dialog = await openFinish();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Označit plán jako připravený' }));
    const list = await screen.findByTestId('affected-athletes');
    expect(list).toHaveTextContent('Eva Dvořáková (Komplexní)');
    const go = screen.getByTestId('athletes-cancel-confirm');
    expect(go).toBeDisabled();
    fireEvent.click(screen.getByTestId('athletes-ack'));
    fireEvent.click(go);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect((spy.mock.calls as unknown[][])[0]![0]).toEqual({});
    expect((spy.mock.calls as unknown[][])[1]![0]).toEqual({ cancelAffectedAthletes: true });
  });

  it('a club that already holds a live order is told so; a separate order only on the desk\'s word', async () => {
    const source = ownerSource({ demands: kOnly, sessions: [term('a', '2026-11-16', '07:00', '19:00', 'k', 12), term('b', '2026-11-17', '08:00', '16:00', 'k', 8)] });
    const duplicate = Object.assign(new PlannerWriteError('conflict', 'Klub už má živou objednávku.'), {
      liveOrders: [{ id: 'o9', code: 'KO-1234ABCD', serviceName: 'Sportovní prohlídky', status: 'Confirmed', sameService: true }],
    });
    const original = source.finishPlan.bind(source);
    const spy = vi.spyOn(source, 'finishPlan').mockRejectedValueOnce(duplicate).mockImplementation(original);
    mountPlanner(source);
    const dialog = await openFinish();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Označit plán jako připravený' }));
    const panel = await screen.findByTestId('duplicate-orders');
    expect(panel).toHaveTextContent('KO-1234ABCD');
    fireEvent.click(screen.getByTestId('duplicate-separate'));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect((spy.mock.calls as unknown[][])[1]![0]).toEqual({ skipDuplicateCheck: true });
  });

  it('a missing contact sends the desk to the club data instead of saving', async () => {
    const source = ownerSource({ demands: kOnly, contact: false, sessions: [term('a', '2026-11-16', '07:00', '19:00', 'k', 12), term('b', '2026-11-17', '08:00', '16:00', 'k', 8)] });
    const spy = vi.spyOn(source, 'finishPlan');
    mountPlanner(source);
    const dialog = await openFinish();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Doplnit kontakt klubu' }));
    expect(spy).not.toHaveBeenCalled();
    await waitFor(() => expect(document.querySelector('[data-dialog="clubEdit"]')).not.toBeNull());
  });
});

describe('publish · the real invitation, the e-mail draft on the clipboard, nothing sent', () => {
  it('copies the e-mail text with the order\'s numbers; generates and copies the link', async () => {
    const source = ownerSource({ sessions: owner() });
    const publish = vi.spyOn(source, 'publishForm').mockResolvedValue({ url: 'https://klub.test/objednavka/abc', generated: true });
    mountPlanner(source);
    await screen.findByTestId('planning-carousel');
    fireEvent.click(document.querySelector('[data-publish-launch]')!);
    const dialog = await screen.findByTestId('planner-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Připravit přihlašovací formulář' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('5 / 70 osob');
    expect(dialog).toHaveTextContent('Zbývá naplánovat 65 osob (88 h)');
    expect(dialog).toHaveTextContent('Příjemce: jan@dukla.cz');
    expect(dialog).toHaveTextContent('NIC SE NEODESÍLÁ');
    expect(screen.getByTestId('publish-link')).toHaveTextContent('Odkaz zatím nevygenerován');
    expect(within(dialog).getByRole('button', { name: 'Kopírovat odkaz' })).toBeDisabled();

    // the later steps wait for the earlier ones, and each says why
    expect(within(dialog).getByRole('button', { name: 'Náhled e-mailu' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Kopírovat text e-mailu' })).toBeDisabled();
    expect(screen.getByTestId('publish-why-2')).toHaveTextContent('Nejdřív vygenerujte odkaz');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Vygenerovat odkaz' }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('publish-link')).toHaveTextContent('https://klub.test/objednavka/abc'));
    expect(within(dialog).getByRole('button', { name: 'Obnovit odkaz' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Kopírovat odkaz' })).toBeDisabled();
    expect(screen.getByTestId('publish-why-3')).toHaveTextContent('Nejdřív si prohlédněte e-mail');

    // the e-mail preview now carries the link
    fireEvent.click(within(dialog).getByRole('button', { name: 'Náhled e-mailu' }));
    const mail = await screen.findByTestId('email-draft');
    expect(mail).toHaveTextContent('https://klub.test/objednavka/abc');
    fireEvent.click(screen.getByRole('button', { name: 'Kopírovat text e-mailu' }));
    await waitFor(() => expect(clipboard.writeText).toHaveBeenLastCalledWith(expect.stringContaining('https://klub.test/objednavka/abc')));
    const draft = clipboard.writeText.mock.calls[0]![0];
    expect(draft).toContain('připravili jsme pro SK Dukla termíny sportovních vyšetření');
    expect(draft).toContain('Počet požadovaných osob: 70');
    expect(draft).toContain('Aktuálně naplánováno: 5');

    // back in the dialog the third step is open
    fireEvent.click(screen.getByRole('button', { name: /Zpět k publikaci/ }));
    const again = await screen.findByTestId('planner-dialog');
    await waitFor(() => expect(within(again).getByRole('button', { name: 'Kopírovat odkaz' })).toBeEnabled());
    fireEvent.click(within(again).getByRole('button', { name: 'Kopírovat odkaz' }));
    await waitFor(() => expect(clipboard.writeText).toHaveBeenLastCalledWith('https://klub.test/objednavka/abc'));
    // the form preview lists the club's terms of the order
    fireEvent.click(await screen.findByRole('button', { name: 'Náhled formuláře' }));
    expect(await screen.findAllByRole('button', { name: 'Vybrat termín' })).toHaveLength(2);
    expect(screen.getByText(/Na klubovou objednávku|Vyberte si požadované vyšetření/)).toBeInTheDocument();
  });

  it('R11 - a bare path from the server is shown, copied and mailed as the FULL address, with a copy button beside it', async () => {
    const source = ownerSource({ sessions: owner() });
    vi.spyOn(source, 'publishForm').mockResolvedValue({ url: '/klub-objednavka/tok-123', generated: true });
    mountPlanner(source);
    await screen.findByTestId('planning-carousel');
    fireEvent.click(document.querySelector('[data-publish-launch]')!);
    const dialog = await screen.findByTestId('planner-dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vygenerovat odkaz' }));
    const full = `${window.location.origin}/klub-objednavka/tok-123`;
    await waitFor(() => expect(screen.getByTestId('publish-link')).toHaveTextContent(full));
    // the copy button beside the link copies the full address and says so for two seconds
    const beside = screen.getByTestId('publish-link-copy');
    fireEvent.click(beside);
    await waitFor(() => expect(clipboard.writeText).toHaveBeenLastCalledWith(full));
    await waitFor(() => expect(beside).toHaveTextContent('Zkopírováno'));
    // the e-mail preview holds the full link, and so does the copied text
    fireEvent.click(within(dialog).getByRole('button', { name: 'Náhled e-mailu' }));
    expect(await screen.findByTestId('email-draft')).toHaveTextContent(full);
    expect(screen.getByTestId('email-link')).toHaveTextContent(full);
    fireEvent.click(screen.getByRole('button', { name: 'Kopírovat text e-mailu' }));
    await waitFor(() => expect(clipboard.writeText).toHaveBeenLastCalledWith(expect.stringContaining(full)));
    // "Kopírovat odkaz" (step 3, open after the preview) copies the same full address
    fireEvent.click(screen.getByRole('button', { name: /Zpět k publikaci/ }));
    const again = await screen.findByTestId('planner-dialog');
    await waitFor(() => expect(within(again).getByRole('button', { name: 'Kopírovat odkaz' })).toBeEnabled());
    fireEvent.click(within(again).getByRole('button', { name: 'Kopírovat odkaz' }));
    await waitFor(() => expect(clipboard.writeText).toHaveBeenLastCalledWith(full));
  });

  it('a failed link says why and keeps the dialog', async () => {
    const source = ownerSource({ sessions: owner() });
    vi.spyOn(source, 'publishForm').mockRejectedValue(new PlannerWriteError('network', 'Odkaz pro klub se nepodařilo vytvořit.'));
    mountPlanner(source);
    await screen.findByTestId('planning-carousel');
    fireEvent.click(document.querySelector('[data-publish-launch]')!);
    const dialog = await screen.findByTestId('planner-dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vygenerovat odkaz' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Odkaz pro klub se nepodařilo vytvořit.');
  });
});

describe('order overview', () => {
  it('"Plánovat →" arms the činnost; a complete one says Hotovo', async () => {
    mountPlanner(ownerSource({ sessions: [...owner(), term('f1', '2026-11-16', '07:00', '19:00', 'k', 12), term('f2', '2026-11-17', '07:00', '15:00', 'k', 8)] }));
    await screen.findByTestId('planning-carousel');
    fireEvent.click(document.querySelector('.oc-overview')!);
    const dialog = await screen.findByTestId('planner-dialog');
    expect(dialog).toHaveTextContent('24 / 70');
    const rows = dialog.querySelectorAll('.activity-detail-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByRole('button', { name: 'Hotovo' })).toBeDisabled();
    fireEvent.click(within(rows[1] as HTMLElement).getByRole('button', { name: 'Plánovat →' }));
    expect(screen.queryByTestId('planner-dialog')).toBeNull();
    expect(card('s')).toHaveClass('is-selected');
  });
});

describe('smart editor of a term', () => {
  const t1 = () => [term('t1', '2026-11-17', '08:00', '10:00', 'k', 2)];

  it('plus slot: the end follows, the review confirms, one updateInterval with the term\'s version', async () => {
    const source = ownerSource({ demands: kOnly, sessions: t1() });
    const spy = vi.spyOn(source, 'updateInterval');
    mountWithDialog(source, { kind: 'smartEdit', id: 't1' });
    await screen.findByTestId('planning-carousel');
    fireEvent.click(screen.getByTestId('open-dialog'));
    const dialog = await screen.findByTestId('planner-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Inteligentní úprava termínu' })).toBeInTheDocument();
    expect(document.getElementById('se-continue')).toBeDisabled();
    expect(document.getElementById('se-validation')).toHaveTextContent('Nejprve proveďte změnu.');
    fireEvent.click(document.getElementById('se-plus')!);
    expect((document.getElementById('se-end') as HTMLInputElement).value).toBe('11:00');
    expect(document.getElementById('se-count')).toHaveTextContent('3');
    expect(document.getElementById('se-validation')).toHaveTextContent('Vše sedí');
    fireEvent.click(document.getElementById('se-continue')!);
    expect(await screen.findByRole('heading', { name: 'Potvrdit úpravu termínu?' })).toBeInTheDocument();
    fireEvent.click(document.getElementById('se-confirm-save')!);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0]![0]).toMatchObject({ id: 't1', date: '2026-11-17', start: '08:00', end: '11:00', capacity: 3, categoryId: 'k' });
    await waitFor(() => expect(source.snapshotSessions()[0]).toMatchObject({ end: '11:00', capacity: 3 }));
    expect(await screen.findByText('Klubový termín byl aktualizován.')).toBeInTheDocument();
  });

  it('more slots than the order still needs are refused with the reason', async () => {
    const source = ownerSource({ demands: [{ categoryId: 'k', requested: 3, baselinePlanned: 0 }], sessions: t1() });
    mountWithDialog(source, { kind: 'smartEdit', id: 't1' });
    await screen.findByTestId('planning-carousel');
    fireEvent.click(screen.getByTestId('open-dialog'));
    await screen.findByTestId('planner-dialog');
    fireEvent.click(document.getElementById('se-plus')!);
    fireEvent.click(document.getElementById('se-plus')!);
    expect(document.getElementById('se-validation')).toHaveTextContent('Objednávka klubu: pro Komplexní sportovní prohlídka zbývá 3 slotů.');
    expect(document.getElementById('se-continue')).toBeDisabled();
  });
});

describe('useClubPlanningContext · how club planning starts and ends', () => {
  const session: PickSession = {
    clubId: 'c1', clubName: 'SK Dukla', serviceId: 'svc', serviceName: 'Prohlídky',
    activities: [{ activityId: 'k', name: 'Komplexní', seats: 20, minutesPerSeat: 60, parallelCapacity: 1 }],
    paymentMethod: 'ClubInvoice', note: '',
  };

  it('reads the router hand-overs of today\'s entry points', () => {
    expect(clubPlanningFromState(null)).toEqual({ mode: 'standard', session: null, needsSetup: null });
    expect(clubPlanningFromState({ openClubOrder: true }).mode).toBe('standard');
    expect(clubPlanningFromState({ pickOrder: true })).toEqual({ mode: 'club', session: null, needsSetup: {} });
    expect(clubPlanningFromState({ pickOrder: { clubId: 'c1' } })).toEqual({ mode: 'club', session: null, needsSetup: { clubId: 'c1' } });
    const edit = clubPlanningFromState({ pickOrder: { start: session } });
    expect(edit).toMatchObject({ mode: 'club', needsSetup: null });
    expect(edit.session?.clubName).toBe('SK Dukla');
  });

  it('setup form -> start(session) -> club mode with the session; end() -> standard again', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={[{ pathname: '/planovani', state: { pickOrder: { clubId: 'c1' } } }]}>{children}</MemoryRouter>
    );
    const { result } = renderHook(() => useClubPlanningContext(), { wrapper });
    expect(result.current.mode).toBe('club');
    expect(result.current.needsSetup).toEqual({ clubId: 'c1' });
    act(() => result.current.start(session));
    expect(result.current.session?.clubId).toBe('c1');
    expect(result.current.needsSetup).toBeNull();
    act(() => result.current.end());
    expect(result.current.mode).toBe('standard');
    expect(result.current.session).toBeNull();
  });

  it('without a router it is standard, or forced', () => {
    const { result } = renderHook(() => useClubPlanningContext());
    expect(result.current.mode).toBe('standard');
    const forced = renderHook(() => useClubPlanningContext({ forced: session }));
    expect(forced.result.current).toMatchObject({ mode: 'club', needsSetup: null });
  });
});

describe('finish · the figures and the save agree (owner bug 21. 10. 2026)', () => {
  const kOnly5 = [{ categoryId: 'k', requested: 5, baselinePlanned: 0 }];
  const finishDialogOf = async (source: DemoDataSource) => {
    mountWithDialog(source, { kind: 'finish' });
    await screen.findByTestId('planning-carousel');
    fireEvent.click(screen.getByTestId('open-dialog'));
    return screen.findByTestId('planner-dialog');
  };

  it('terms that lie in the past and were never saved do not count: 0 / 5, no ticks, no 100 %', async () => {
    // TODAY is 2026-11-10; these were "planned" on 2. and 3. 11.
    const source = ownerSource({ demands: kOnly5, sessions: [term('p1', '2026-11-02', '08:00', '11:00', 'k', 3), term('p2', '2026-11-03', '08:00', '10:00', 'k', 2)] });
    const dialog = await finishDialogOf(source);
    expect(dialog).toHaveTextContent('0 / 5');
    expect(dialog).not.toHaveTextContent('100%');
    expect(within(dialog).getByRole('heading', { name: 'Kontrola rozpracovaného plánu' })).toBeInTheDocument();
  });

  it('nothing to save: the save button is disabled and says why - the red box never comes after a green 100 %', async () => {
    const source = ownerSource({ demands: kOnly5, sessions: [term('p1', '2026-11-02', '08:00', '13:00', 'k', 5)] });
    const spy = vi.spyOn(source, 'finishPlan');
    const dialog = await finishDialogOf(source);
    const save = within(dialog).getByRole('button', { name: 'Uložit i tak' });
    expect(save).toBeDisabled();
    expect(dialog).toHaveTextContent('Není co uložit');
    expect(dialog).toHaveTextContent('1 termín v minulosti');
    fireEvent.click(save);
    expect(spy).not.toHaveBeenCalled();
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('everything planned and already saved (windows of the past the server holds): positive, no save button, no error', async () => {
    const saved = (id: string, date: string, slots: number) => term(id, date, '08:00', `${8 + slots}:00`.padStart(5, '0'), 'k', slots, { clubBlockId: `blk-${id}` });
    const source = ownerSource({ demands: kOnly5, sessions: [saved('h1', '2026-11-02', 3), saved('h2', '2026-11-03', 2)] });
    const spy = vi.spyOn(source, 'finishPlan');
    const dialog = await finishDialogOf(source);
    expect(dialog).toHaveTextContent('5 / 5');
    expect(dialog).toHaveTextContent('100%');
    expect(dialog).toHaveTextContent('Vše je naplánováno a uloženo');
    expect(within(dialog).queryByRole('button', { name: /označit plán|Uložit i tak/i })).toBeNull();
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('future terms covering the need: 5 / 5 and an enabled save button (unchanged behaviour)', async () => {
    const source = ownerSource({ demands: kOnly5, sessions: [term('f1', '2026-11-17', '08:00', '13:00', 'k', 5)] });
    const dialog = await finishDialogOf(source);
    expect(dialog).toHaveTextContent('5 / 5');
    expect(within(dialog).getByRole('button', { name: /označit plán jako připravený/i })).toBeEnabled();
  });
});
