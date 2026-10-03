/*
 * Slevy a cenové hladiny (/nastaveni/slevy). What the screen has to get right:
 * one layout per device, tiers that can be edited but never sent wrong, a live
 * preview in the clinic's own numbers, the server's refusals at the row they
 * name, and a failed load that says so and tries again.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import DiscountsPage from '../DiscountsPage';

const { getSettings, putSettings, listActivities } = vi.hoisted(() => ({ getSettings: vi.fn(), putSettings: vi.fn(), listActivities: vi.fn() }));

vi.mock('../../../api/discounts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/discounts')>();
  return { ...actual, discountSettingsApi: { get: getSettings, put: putSettings } };
});
vi.mock('../../../api/activities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/activities')>();
  return { ...actual, activitiesApi: { ...actual.activitiesApi, list: listActivities } };
});
vi.mock('../../../components/settings/changesApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../components/settings/changesApi')>();
  return { ...actual, fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
});

const SAVED = {
  tiers: [{ minPersons: 4, percent: 5 }, { minPersons: 6, percent: 10 }, { minPersons: 10, percent: 15 }],
  packageDiscounts: [{ activityId: 'a-1', percent: 8 }],
  roleLimits: [
    { role: 'Reception', maxManualPercent: 5 },
    { role: 'Doctor', maxManualPercent: 10 },
    { role: 'Administrator', maxManualPercent: 20 },
    { role: 'Owner', maxManualPercent: 100 },
  ],
};
const ACTIVITIES = {
  activities: [
    { id: 'a-1', name: 'Základní činnost', priceCzk: 1000, isActive: true },
    { id: 'a-2', name: 'Dražší činnost', priceCzk: 2000, isActive: true },
    { id: 'a-3', name: 'Vypnutá činnost', priceCzk: 500, isActive: false },
  ],
  warnings: [],
};

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/nastaveni/slevy']}>
        <DiscountsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const refused = (status: number, data: unknown) => new AxiosError('x', 'ERR', undefined, undefined, { status, data } as never);

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getSettings.mockReset().mockResolvedValue(SAVED);
  putSettings.mockReset().mockImplementation(async (s) => s);
  listActivities.mockReset().mockResolvedValue(ACTIVITIES);
});

describe.each(Object.entries(VIEWPORTS))('Slevy at %s (%i px)', (name, width) => {
  beforeEach(() => setViewport(width));

  it('draws the three sections, the preview and one Uložit in this device\'s layout', async () => {
    const { container } = renderPage();
    expect(await screen.findByRole('heading', { level: 2, name: 'Skupinové slevy podle počtu osob' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Balíčkové slevy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Ruční sleva — limit podle role' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Náhled' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Uložit' })).toHaveLength(1);

    const layout = name === 'phone' ? 'cards' : name === 'tablet' ? 'table-3' : 'table';
    expect(container.querySelectorAll(`[data-layout="${layout}"]`).length).toBeGreaterThanOrEqual(3);
    // the other two layouts are not drawn at the same time
    for (const other of ['cards', 'table-3', 'table'].filter((l) => l !== layout)) {
      expect(container.querySelector(`[data-layout="${other}"]`)).toBeNull();
    }

    expect(screen.getByLabelText('Od kolika osob — hladina 2')).toHaveValue('6');
    expect(screen.getByLabelText('Sleva hladiny 2 v procentech')).toHaveValue('10');
  });

  it('keeps every button a touch target of at least 44 px', async () => {
    renderPage();
    await screen.findByLabelText('Od kolika osob — hladina 1');
    for (const label of ['Odebrat hladinu 1', 'Přidat hladinu', 'Přidat balíčkovou slevu']) {
      const button = screen.getByRole('button', { name: label });
      // MUI sets the minimum height through a class; the rule shows in the computed style
      expect(parseFloat(getComputedStyle(button).minHeight || '0')).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('DiscountsPage', () => {
  it('says what the preview comes to for the typed headcount, and that the discounts do not add', async () => {
    const user = userEvent.setup();
    renderPage();
    const heads = await screen.findByLabelText('Vyzkoušet počet osob');
    expect(heads).toHaveValue('6');
    expect(screen.getByRole('status')).toHaveTextContent(/Pro\s6\sosob\splatí\s10\s%\./);
    expect(screen.getByText(/6 × Dražší činnost/)).toHaveTextContent(/12\s000\sKč, sleva −1\s200\sKč, celkem 10\s800\sKč/);
    expect(screen.getByText(/Sleva týmu a sleva podle počtu se nesčítají — platí vyšší\./)).toBeInTheDocument();

    await user.clear(heads);
    await user.type(heads, '2');
    expect(screen.getByRole('status')).toHaveTextContent(/Pro\s2\sosoby se sleva podle počtu osob neuplatní/);
    await user.clear(heads);
    await user.type(heads, '12');
    expect(screen.getByRole('status')).toHaveTextContent(/Pro\s12\sosob\splatí\s15\s%\./);
  });

  it('follows the table: a tier typed into a row appears in the preview at once', async () => {
    const user = userEvent.setup();
    renderPage();
    const percent = await screen.findByLabelText('Sleva hladiny 2 v procentech');
    await user.clear(percent);
    await user.type(percent, '12,5');
    const list = screen.getByRole('list', { name: 'Hladiny podle počtu osob' });
    expect(within(list).getByText(/12,5\s%/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/platí\s12,5\s%/);
  });

  it('shows Uložit and Zahodit off until something changes, and Zahodit puts the saved values back', async () => {
    const user = userEvent.setup();
    renderPage();
    const percent = await screen.findByLabelText('Sleva hladiny 1 v procentech');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    await user.clear(percent);
    await user.type(percent, '7');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Zahodit' }));
    expect(screen.getByLabelText('Sleva hladiny 1 v procentech')).toHaveValue('5');
    expect(putSettings).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('sends numbers, tiers ascending, and every role back - the owner untouched', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Sleva hladiny 1 v procentech');

    await user.click(screen.getByRole('button', { name: 'Přidat hladinu' }));
    await user.type(screen.getByLabelText('Od kolika osob — hladina 4'), '2');
    await user.type(screen.getByLabelText('Sleva hladiny 4 v procentech'), '2,5');

    await user.selectOptions(screen.getByLabelText('Činnost balíčku 1'), 'a-1');
    await user.clear(screen.getByLabelText('Sleva balíčku 1 v procentech'));
    await user.type(screen.getByLabelText('Sleva balíčku 1 v procentech'), '9');
    await user.clear(screen.getByLabelText('Nejvyšší ruční sleva — Recepce'));
    await user.type(screen.getByLabelText('Nejvyšší ruční sleva — Recepce'), '3');

    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(putSettings).toHaveBeenCalledTimes(1));
    expect(putSettings).toHaveBeenCalledWith({
      tiers: [{ minPersons: 2, percent: 2.5 }, { minPersons: 4, percent: 5 }, { minPersons: 6, percent: 10 }, { minPersons: 10, percent: 15 }],
      packageDiscounts: [{ activityId: 'a-1', percent: 9 }],
      roleLimits: [
        { role: 'Reception', maxManualPercent: 3 },
        { role: 'Doctor', maxManualPercent: 10 },
        { role: 'Administrator', maxManualPercent: 20 },
        { role: 'Owner', maxManualPercent: 100 },
      ],
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled());
  });

  it('refuses duplicate boundaries, a percentage over 100 and a third decimal, without a request', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Sleva hladiny 1 v procentech');
    await user.click(screen.getByRole('button', { name: 'Přidat hladinu' }));
    await user.type(screen.getByLabelText('Od kolika osob — hladina 4'), '6');
    await user.type(screen.getByLabelText('Sleva hladiny 4 v procentech'), '101');
    const first = screen.getByLabelText('Sleva hladiny 1 v procentech');
    await user.clear(first);
    await user.type(first, '1,234');

    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Tuto hranici už má jiná hladina.')).toBeInTheDocument();
    expect(screen.getByText('Procento je od 0 do 100.')).toBeInTheDocument();
    expect(screen.getByText('Nejvýše dvě desetinná místa.')).toBeInTheDocument();
    expect(putSettings).not.toHaveBeenCalled();
  });

  it('refuses a package row left without a činnost, and never offers an inactive or used one', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('Činnost balíčku 1');
    await user.click(screen.getByRole('button', { name: 'Přidat balíčkovou slevu' }));
    await user.type(screen.getByLabelText('Sleva balíčku 2 v procentech'), '4');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Vyberte činnost.')).toBeInTheDocument();
    expect(putSettings).not.toHaveBeenCalled();
    // an inactive činnost is never offered, and the one already used is not offered again
    const options = within(screen.getByLabelText('Činnost balíčku 2')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Vyberte činnost', 'Dražší činnost']);
  });

  it('puts the server\'s refusal at the row it names', async () => {
    const user = userEvent.setup();
    putSettings.mockRejectedValue(refused(400, { message: 'Slevy se nepodařilo uložit.', errors: { 'tiers[1].minPersons': ['Hranice se překrývá s předchozí hladinou.'] } }));
    renderPage();
    const percent = await screen.findByLabelText('Sleva hladiny 3 v procentech');
    await user.clear(percent);
    await user.type(percent, '16');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(await screen.findByText('Hranice se překrývá s předchozí hladinou.')).toBeInTheDocument();
    expect(screen.getByText('Slevy se nepodařilo uložit.')).toBeInTheDocument();
    // the sentence sits under the row of the 2nd tier (6 osob), not somewhere else
    const row = screen.getByLabelText('Od kolika osob — hladina 2').closest('tr') as HTMLElement;
    expect(within(row).getByText('Hranice se překrývá s předchozí hladinou.')).toBeInTheDocument();
  });

  it('says what the role limit means and that the owner has none', async () => {
    renderPage();
    await screen.findByLabelText('Nejvyšší ruční sleva — Recepce');
    expect(screen.getByLabelText('Nejvyšší ruční sleva — Lékař')).toHaveValue('10');
    expect(screen.getByLabelText('Nejvyšší ruční sleva — Admin')).toHaveValue('20');
    expect(screen.queryByLabelText('Nejvyšší ruční sleva — Vlastník')).not.toBeInTheDocument();
    expect(screen.getByText(/Vlastník/, { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText(/Čeká na schválení/)).toBeInTheDocument();
  });

  it('keeps the frame and offers Zkusit znovu when the load fails, then shows the data', async () => {
    const user = userEvent.setup();
    getSettings.mockRejectedValueOnce(refused(500, {}));
    renderPage();
    expect(await screen.findByText('Slevy se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Slevy a cenové hladiny' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Zkusit znovu/ }));
    expect(await screen.findByLabelText('Od kolika osob — hladina 1')).toHaveValue('4');
  });

  it('still edits tiers when the činnosti cannot be loaded, and says so under the packages', async () => {
    listActivities.mockRejectedValue(refused(500, {}));
    renderPage();
    expect(await screen.findByText('Činnosti se nepodařilo načíst, nelze z nich vybírat.')).toBeInTheDocument();
    expect(screen.getByLabelText('Od kolika osob — hladina 1')).toHaveValue('4');
  });
});
