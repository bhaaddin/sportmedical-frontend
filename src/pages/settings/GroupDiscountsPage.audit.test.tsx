/*
 * Settings audit (20. 10. 2026) - Doporučené hladiny slev (/nastaveni/skupinove-slevy), the older tiers-only screen.
 *
 * Server facts (dev API, /api/v1/settings/group-discounts - an alias over the SAME tiers as /nastaveni/slevy):
 *   bands 3-5 -> 4 %, 6+ -> 9 % read back as the tiers {3,4} and {6,9} on /settings/discounts and on /api/public/discount-tiers
 *   overlapping bands -> 400 { errors: { tiers: ["Pásma se nesmí překrývat."] } }
 *   a gap between bands is filled by the server with a 0 % band (3-4, 8+ -> 3-4 / 5-7 0 % / 8+)
 *   maxTiers 20, defaults { tiers: [] }
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invalidSettings, renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const { readGroupDiscounts, saveGroupDiscounts, listActivities } = vi.hoisted(() => ({ readGroupDiscounts: vi.fn(), saveGroupDiscounts: vi.fn(), listActivities: vi.fn() }));

vi.mock('../../api/groupDiscounts', () => ({ GROUP_DISCOUNTS_QUERY_KEY: ['settings', 'group-discounts'], readGroupDiscounts, saveGroupDiscounts }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../components/settings/changesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/settings/changesApi')>()),
  fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

const { default: GroupDiscountsPage } = await import('./GroupDiscountsPage');

const SERVER = {
  settings: { tiers: [{ minHeadcount: 4, maxHeadcount: 5, percent: 5 }, { minHeadcount: 6, maxHeadcount: 9, percent: 10 }, { minHeadcount: 10, maxHeadcount: null, percent: 15 }] },
  defaults: { tiers: [] as unknown[] },
  maxTiers: 20,
};

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  readGroupDiscounts.mockReset().mockResolvedValue(structuredClone(SERVER));
  saveGroupDiscounts.mockReset().mockImplementation(async (settings) => ({ ...structuredClone(SERVER), settings }));
  listActivities.mockReset().mockResolvedValue({ activities: [{ id: 'a', name: 'Základní', priceCzk: 1000, isActive: true }], warnings: [] });
});

describe('reading the bands', () => {
  it('shows the from, to and percent of each band, and an open band with an empty "Do"', async () => {
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    expect(await screen.findByLabelText('Hladina 1 od')).toHaveValue(4);
    expect(screen.getByLabelText('Hladina 1 do')).toHaveValue(5);
    expect(screen.getByLabelText('Hladina 1 sleva')).toHaveValue(5);
    expect(screen.getByLabelText('Hladina 3 od')).toHaveValue(10);
    expect(screen.getByLabelText('Hladina 3 do')).toHaveValue(null);
    expect(screen.getByLabelText('Hladina 3 do')).toHaveAttribute('placeholder', '∞');
  });

  it('says there is no band when there is none, and what that means', async () => {
    readGroupDiscounts.mockResolvedValue({ ...structuredClone(SERVER), settings: { tiers: [] } });
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    expect(await screen.findByText('Zatím žádná hladina — každá skupina platí plnou cenu.')).toBeInTheDocument();
  });

  it('says it could not read them', async () => {
    readGroupDiscounts.mockRejectedValue(new Error('down'));
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    expect(await screen.findByText('Skupinové slevy se nepodařilo načíst.')).toBeInTheDocument();
  });
});

describe('saving', () => {
  it('keeps Uložit and Zahodit off until a band changes', async () => {
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    await screen.findByLabelText('Hladina 1 od');
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zahodit' })).toBeDisabled();
  });

  it('sends whole numbers for the heads, null for an open band and the percent as typed', async () => {
    const user = userEvent.setup();
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    const percent = await screen.findByLabelText('Hladina 1 sleva');
    await user.clear(percent);
    await user.type(percent, '7.5');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(saveGroupDiscounts).toHaveBeenCalled());
    expect(saveGroupDiscounts).toHaveBeenCalledWith({ tiers: [
      { minHeadcount: 4, maxHeadcount: 5, percent: 7.5 }, { minHeadcount: 6, maxHeadcount: 9, percent: 10 }, { minHeadcount: 10, maxHeadcount: null, percent: 15 },
    ] });
  });

  it('clearing "Do" makes the band open-ended', async () => {
    const user = userEvent.setup();
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    await user.clear(await screen.findByLabelText('Hladina 2 do'));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(saveGroupDiscounts).toHaveBeenCalled());
    expect(saveGroupDiscounts.mock.calls[0][0].tiers[1]).toEqual({ minHeadcount: 6, maxHeadcount: null, percent: 10 });
  });

  it('a new band is sent with what is typed; a half-typed one goes as 0 and the server answers for it', async () => {
    saveGroupDiscounts.mockRejectedValue(invalidSettings({ tiers: ['Počet osob v pásmu musí být alespoň 1.'] }));
    const user = userEvent.setup();
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    await user.click(await screen.findByRole('button', { name: 'Přidat hladinu' }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(saveGroupDiscounts).toHaveBeenCalled());
    expect(saveGroupDiscounts.mock.calls[0][0].tiers[3]).toEqual({ minHeadcount: 0, maxHeadcount: null, percent: 0 });
    expect(await screen.findByText('Počet osob v pásmu musí být alespoň 1.')).toBeInTheDocument();
  });

  it('shows the server’s "bands overlap" sentence and keeps the rows on screen', async () => {
    saveGroupDiscounts.mockRejectedValue(invalidSettings({ tiers: ['Pásma se nesmí překrývat.'] }, 'Nastavení nelze uložit: Pásma se nesmí překrývat.'));
    const user = userEvent.setup();
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    const to = await screen.findByLabelText('Hladina 1 do');
    await user.clear(to);
    await user.type(to, '8');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Pásma se nesmí překrývat.')).toBeInTheDocument();
    expect(screen.getByLabelText('Hladina 1 do')).toHaveValue(8);
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
  });

  it('shows "Uloženo." and the stored rows after a save, with Uložit off again', async () => {
    saveGroupDiscounts.mockImplementation(async () => ({ ...structuredClone(SERVER), settings: { tiers: [{ minHeadcount: 4, maxHeadcount: 5, percent: 6 }, { minHeadcount: 6, maxHeadcount: null, percent: 10 }] } }));
    const user = userEvent.setup();
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    const percent = await screen.findByLabelText('Hladina 1 sleva');
    await user.clear(percent);
    await user.type(percent, '6');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText('Uloženo.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Hladina 3 od')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('sends one request for a double click', async () => {
    let finish: (value: unknown) => void = () => undefined;
    saveGroupDiscounts.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    const percent = await screen.findByLabelText('Hladina 1 sleva');
    await user.clear(percent);
    await user.type(percent, '6');
    await user.dblClick(screen.getByRole('button', { name: /Uložit|Ukládám/ }));
    expect(saveGroupDiscounts).toHaveBeenCalledTimes(1);
    finish(SERVER);
  });
});

describe('Poslední změny', () => {
  it('shares the history of the tiers it edits ("pricing")', async () => {
    const { fetchSettingChanges } = await import('../../components/settings/changesApi');
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    await screen.findByLabelText('Hladina 1 od');
    await waitFor(() => expect(fetchSettingChanges).toHaveBeenCalledWith('pricing', 5));
  });
});

describe('the other controls', () => {
  it('stops offering "Přidat hladinu" at the number of bands the server allows, and says so', async () => {
    readGroupDiscounts.mockResolvedValue({ ...structuredClone(SERVER), maxTiers: 3 });
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    expect(await screen.findByRole('button', { name: 'Přidat hladinu' })).toBeDisabled();
    expect(screen.getByText('Nejvýše 3 hladin.')).toBeInTheDocument();
  });

  it('"Obnovit výchozí hladiny" loads the server’s defaults into the table and still needs Uložit', async () => {
    readGroupDiscounts.mockResolvedValue({ ...structuredClone(SERVER), defaults: { tiers: [{ minHeadcount: 5, maxHeadcount: null, percent: 3 }] } });
    const user = userEvent.setup();
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    await user.click(await screen.findByRole('button', { name: 'Obnovit výchozí hladiny' }));
    expect(screen.getByLabelText('Hladina 1 od')).toHaveValue(5);
    expect(screen.queryByLabelText('Hladina 2 od')).not.toBeInTheDocument();
    expect(saveGroupDiscounts).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Uložit' })).toBeEnabled();
  });

  it('removing every band is saveable (everybody then pays the full price)', async () => {
    const user = userEvent.setup();
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    for (let i = 0; i < 3; i += 1) await user.click((await screen.findAllByRole('button', { name: 'Odebrat' }))[0]);
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(saveGroupDiscounts).toHaveBeenCalledWith({ tiers: [] }));
  });

  it('the example prices the dearest činnost and follows an unsaved edit', async () => {
    const user = userEvent.setup();
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    const percent = await screen.findByLabelText('Hladina 2 sleva');
    await user.clear(percent);
    await user.type(percent, '50');
    const card = screen.getByText('Příklad').closest('div') as HTMLElement;
    expect(within(card.parentElement as HTMLElement).getByText(/× Základní/)).toBeInTheDocument();
  });

  it('says so when no činnost has a price yet, instead of inventing one', async () => {
    listActivities.mockResolvedValue({ activities: [{ id: 'a', name: 'Bez ceny', priceCzk: null, isActive: true }], warnings: [] });
    renderScreen(<GroupDiscountsPage />, '/nastaveni/skupinove-slevy');
    expect(await screen.findByText(/Žádná činnost zatím nemá cenu v ceníku/)).toBeInTheDocument();
  });
});
