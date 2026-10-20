/*
 * Settings audit (20. 10. 2026) - Slevy (/nastaveni/slevy) and Skupinové slevy (/nastaveni/skupinove-slevy).
 *
 * Server facts (dev API):
 *   GET /api/v1/settings/discounts -> roleLimits [{role:"Staff",maxManualPercent:10,label:"Recepce"},{role:"Administrator",…,label:"Admin"}]
 *     - the real roles are Staff and Administrator; the screen called Staff "Personál" while the server's own word is "Recepce"
 *   a tier at 2.5 % is accepted, 0 persons / 101 % / a repeated boundary are 400 with the row named (tiers[1].minPersons …)
 *   a role other than Staff/Administrator -> 400 "Neznámá role. Platné jsou: Staff, Administrator."
 *   PUT without a label is fine; PUT with the roles missing keeps them
 *   /api/v1/settings/group-discounts is a thin alias over the SAME tiers: saving one screen rewrites the other
 *     (bands 3-5 -> 4 %, 6+ -> 9 % read back as tiers {3,4}, {6,9}; /api/public/discount-tiers follows).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invalidSettings, renderScreen } from '../../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { normalizeDiscountSettings } from '../../../api/discounts';
import {
  dearestPriced, exampleLine, formatKc, formatPercent, headcountSentence, initialHeadcount, isOwnerRole, parsePercent, parseWhole, persons, placeServerErrors,
  rangeFor, rangeText, roleLabel, roleName, signature, tierRanges, toDraft, toPayload, validateDraft, type DiscountDraft,
} from './discountLogic';

const { getSettings, putSettings, listActivities } = vi.hoisted(() => ({ getSettings: vi.fn(), putSettings: vi.fn(), listActivities: vi.fn() }));

vi.mock('../../../api/discounts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/discounts')>()),
  discountSettingsApi: { get: getSettings, put: putSettings },
}));
vi.mock('../../../api/activities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/activities')>();
  return { ...actual, activitiesApi: { ...actual.activitiesApi, list: listActivities } };
});
vi.mock('../../../components/settings/changesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../components/settings/changesApi')>()),
  fetchSettingChanges: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));

const { default: DiscountsPage } = await import('../DiscountsPage');

/* The answer of the dev API, as it is. */
const SERVER = {
  tiers: [{ minPersons: 4, percent: 5 }, { minPersons: 6, percent: 10 }, { minPersons: 10, percent: 15 }],
  packageDiscounts: [] as { activityId: string; percent: number }[],
  roleLimits: [{ role: 'Staff', maxManualPercent: 10, label: 'Recepce' }, { role: 'Administrator', maxManualPercent: 30, label: 'Admin' }],
};

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  getSettings.mockReset().mockResolvedValue(normalizeDiscountSettings(SERVER));
  putSettings.mockReset().mockImplementation(async (settings) => settings);
  listActivities.mockReset().mockResolvedValue({ activities: [{ id: 'a1', name: 'Základní', priceCzk: 1000, isActive: true }, { id: 'a2', name: 'Komplexní', priceCzk: 2000, isActive: true }], warnings: [] });
});

describe('the answer of the server, read', () => {
  it('keeps the label the server sent for a role', () => {
    expect(normalizeDiscountSettings(SERVER).roleLimits).toEqual([
      { role: 'Staff', maxManualPercent: 10, label: 'Recepce' }, { role: 'Administrator', maxManualPercent: 30, label: 'Admin' },
    ]);
  });

  it('reads a role without a label as before', () => {
    expect(normalizeDiscountSettings({ roleLimits: [{ role: 'Staff', maxManualPercent: 10 }] }).roleLimits).toEqual([{ role: 'Staff', maxManualPercent: 10 }]);
  });

  it('ignores a blank label', () => {
    expect(normalizeDiscountSettings({ roleLimits: [{ role: 'Staff', maxManualPercent: 10, label: '  ' }] }).roleLimits[0]).not.toHaveProperty('label');
  });

  it('sorts the tiers ascending, whatever the order they came in', () => {
    expect(normalizeDiscountSettings({ tiers: [{ minPersons: 10, percent: 15 }, { minPersons: 4, percent: 5 }] }).tiers.map((t) => t.minPersons)).toEqual([4, 10]);
  });

  it('reads the settings from inside a "settings" wrapper too', () => {
    expect(normalizeDiscountSettings({ settings: SERVER }).tiers).toHaveLength(3);
  });

  it('reads nothing as empty lists, not as a crash', () => {
    expect(normalizeDiscountSettings(null)).toEqual({ tiers: [], packageDiscounts: [], roleLimits: [] });
    expect(normalizeDiscountSettings({ tiers: 'x', roleLimits: [null, 5] })).toEqual({ tiers: [], packageDiscounts: [], roleLimits: [] });
  });

  it('turns a value that is not a number into 0 rather than NaN', () => {
    expect(normalizeDiscountSettings({ tiers: [{ minPersons: 'a', percent: null }] }).tiers).toEqual([{ minPersons: 0, percent: 0 }]);
  });
});

describe('role names', () => {
  it('the server’s word wins over the screen’s own (Staff is "Recepce" at the clinic, not "Personál")', () => {
    expect(roleName({ role: 'Staff', label: 'Recepce' })).toBe('Recepce');
    expect(roleLabel('Staff')).toBe('Personál');
  });

  it.each([['Administrator', 'Admin'], ['owner', 'Vlastník'], ['Doctor', 'Lékař'], ['Unknown', 'Unknown']])('without a server word %s is called %s', (role, expected) => {
    expect(roleName({ role })).toBe(expected);
  });

  it('knows the owner, who is unlimited by rule and never edited', () => {
    expect(isOwnerRole('Owner')).toBe(true);
    expect(isOwnerRole('Administrator')).toBe(false);
  });
});

describe('numbers as a person types them', () => {
  it.each([['10', 10], ['12,5', 12.5], ['12.5', 12.5], ['7 %', 7], [' 1 0 ', 10], ['0', 0], ['100', 100]])('parsePercent(%j) = %s', (text, expected) => {
    expect(parsePercent(text)).toBe(expected);
  });

  it.each(['', 'abc', '1,234', '-5', '1e2', '.5'])('parsePercent(%j) is not a percentage', (text) => {
    expect(parsePercent(text)).toBeNull();
  });

  it.each([['6', 6], [' 1 000 ', 1000], ['0', 0]])('parseWhole(%j) = %s', (text, expected) => {
    expect(parseWhole(text)).toBe(expected);
  });

  it.each(['', '1,5', '-1', 'x', '99999999999999999999'])('parseWhole(%j) is not a whole number', (text) => {
    expect(parseWhole(text)).toBeNull();
  });

  it('writes money and percent with a non-breaking space, Czech decimals', () => {
    expect(formatPercent(12.5)).toBe('12,5 %');
    expect(formatKc(2200)).toBe('2 200 Kč');
  });

  it.each([[1, 'osobu'], [2, 'osoby'], [4, 'osoby'], [5, 'osob'], [11, 'osob']])('persons(%i) ends in %s', (n, word) => {
    expect(persons(n)).toBe(`${n} ${word}`);
  });
});

describe('validateDraft and toPayload', () => {
  const draftOf = (over: Partial<DiscountDraft> = {}): DiscountDraft => ({ ...toDraft(normalizeDiscountSettings(SERVER)), ...over });
  const errorsOf = (d: DiscountDraft) => validateDraft(d);

  it('has nothing to say about what the server sent', () => {
    const errors = errorsOf(draftOf());
    expect(errors.general).toEqual([]);
    expect(Object.keys(errors.tiers)).toHaveLength(0);
  });

  it('sends the tiers ascending and the roles WITHOUT the label (the server does not take it back)', () => {
    const { settings } = toPayload(draftOf({ tiers: [{ key: 'b', min: '10', percent: '15' }, { key: 'a', min: '4', percent: '5' }] }));
    expect(settings.tiers).toEqual([{ minPersons: 4, percent: 5 }, { minPersons: 10, percent: 15 }]);
    expect(settings.roleLimits).toEqual([{ role: 'Staff', maxManualPercent: 10 }, { role: 'Administrator', maxManualPercent: 30 }]);
  });

  it('sends a comma percent as a number with a dot', () => {
    expect(toPayload(draftOf({ roles: [{ key: 'r', role: 'Staff', percent: '12,5' }] })).settings.roleLimits[0].maxManualPercent).toBe(12.5);
  });

  it('a tier at 0 persons, a boundary used twice, 101 % and a third decimal are refused per row', () => {
    const errors = errorsOf(draftOf({ tiers: [
      { key: 'a', min: '0', percent: '5' }, { key: 'b', min: '4', percent: '101' }, { key: 'c', min: '4', percent: '5' }, { key: 'd', min: '8', percent: '5,555' },
    ] }));
    expect(errors.tiers.a.min).toBe('Hladina začíná nejméně od 1 osoby.');
    expect(errors.tiers.b.percent).toBe('Procento je od 0 do 100.');
    expect(errors.tiers.c.min).toBe('Tuto hranici už má jiná hladina.');
    expect(errors.tiers.d.percent).toBe('Nejvýše dvě desetinná místa.');
  });

  it('a package row without a činnost or with a repeated one is refused', () => {
    const errors = errorsOf(draftOf({ packages: [{ key: 'a', activityId: '', percent: '5' }, { key: 'b', activityId: 'a1', percent: '5' }, { key: 'c', activityId: 'a1', percent: '6' }] }));
    expect(errors.packages.a.activity).toBe('Vyberte činnost.');
    expect(errors.packages.c.activity).toBe('Tato činnost už slevu má.');
  });

  it('a role limit over 100 % or empty is refused', () => {
    const errors = errorsOf(draftOf({ roles: [{ key: 'a', role: 'Staff', percent: '150' }, { key: 'b', role: 'Administrator', percent: '' }] }));
    expect(errors.roles.a.percent).toBe('Procento je od 0 do 100.');
    expect(errors.roles.b.percent).toBe('Zadejte procento.');
  });

  it('a signature does not change when only the row keys change', () => {
    expect(signature(toDraft(normalizeDiscountSettings(SERVER)))).toBe(signature(toDraft(normalizeDiscountSettings(SERVER))));
  });
});

describe('where a refusal lands (the keys the server really sends)', () => {
  const keys = { tiers: ['t0', 't1'], packages: ['p0'], roles: ['r0', 'r1'] };

  it.each([
    ['tiers[1].minPersons', 'Hranice se opakuje.', (e: ReturnType<typeof placeServerErrors>) => e.tiers.t1.min],
    ['tiers[0].percent', 'Sleva musí být mezi 0 a 100 %.', (e: ReturnType<typeof placeServerErrors>) => e.tiers.t0.percent],
    ['roleLimits[0].role', 'Neznámá role.', (e: ReturnType<typeof placeServerErrors>) => e.roles.r0.row],
    ['roleLimits[1].maxManualPercent', 'Limit musí být mezi 0 a 100 %.', (e: ReturnType<typeof placeServerErrors>) => e.roles.r1.percent],
    ['packageDiscounts[0].activityId', 'Činnost neexistuje.', (e: ReturnType<typeof placeServerErrors>) => e.packages.p0.activity],
  ])('%s', (field, message, pick) => {
    expect(pick(placeServerErrors({ [field]: message }, keys))).toBe(message);
  });

  it('a field that names no row, or a row that is not there, is a general sentence', () => {
    const errors = placeServerErrors({ tiers: 'Pásma se nesmí překrývat.', 'tiers[9].percent': 'Chyba.' }, keys);
    expect(errors.general).toEqual(['Pásma se nesmí překrývat.', 'Chyba.']);
  });
});

describe('the preview', () => {
  const ranges = tierRanges(toDraft(normalizeDiscountSettings(SERVER)));

  it('turns the tiers into ranges of heads', () => {
    expect(ranges).toEqual([{ from: 4, to: 5, percent: 5 }, { from: 6, to: 9, percent: 10 }, { from: 10, to: null, percent: 15 }]);
    expect(ranges.map(rangeText).map((text) => text.replace(/ /g, ' '))).toEqual(['4–5 osob', '6–9 osob', 'od 10 osob']);
  });

  it.each([[1, null], [3, null], [4, 5], [5, 5], [6, 10], [9, 10], [10, 15], [200, 15]])('a group of %i falls into the %s % tier', (heads, percent) => {
    expect(rangeFor(ranges, heads)?.percent ?? null).toBe(percent);
  });

  it('says what a group below the first tier gets', () => {
    expect(headcountSentence(ranges, 2)).toBe('Pro 2 osoby se sleva podle počtu osob neuplatní — první hladina začíná od 4 osob.');
    expect(headcountSentence([], 5)).toBe('Bez hladin se skupinová sleva podle počtu osob neuplatní.');
    expect(headcountSentence(ranges, 6)).toBe('Pro 6 osob platí 10 %.');
  });

  it('opens on the second tier’s start, the first when there is only one, nothing when none', () => {
    expect(initialHeadcount(ranges)).toBe('6');
    expect(initialHeadcount(ranges.slice(0, 1))).toBe('4');
    expect(initialHeadcount([])).toBe('');
  });

  it('the example rounds the discount to whole crowns', () => {
    expect(exampleLine({ from: 4, to: null, percent: 12.5 }, 3, 1001)).toEqual({ subtotal: 3003, discount: 375, total: 2628 });
    expect(exampleLine(null, 3, 1000)).toEqual({ subtotal: 3000, discount: 0, total: 3000 });
  });

  it('the dearest priced činnost is the one on offer, never an archived or unpriced one', () => {
    expect(dearestPriced([{ name: 'A', priceCzk: 100, isActive: true }, { name: 'B', priceCzk: 900, isActive: false }, { name: 'C', priceCzk: null, isActive: true }, { name: 'D', priceCzk: 300, isActive: true }])?.name).toBe('D');
    expect(dearestPriced([])).toBeNull();
  });
});

describe('Poslední změny', () => {
  it('asks the history under "pricing", where the server files the discounts', async () => {
    const { fetchSettingChanges } = await import('../../../components/settings/changesApi');
    renderScreen(<DiscountsPage />, '/nastaveni/slevy');
    await screen.findByRole('textbox', { name: 'Sleva hladiny 1 v procentech' });
    await waitFor(() => expect(fetchSettingChanges).toHaveBeenCalledWith('pricing', 5));
  });
});

describe('the screen with the roles the server really has', () => {
  it('names the roles by the server’s words and does not list the owner (there is none)', async () => {
    renderScreen(<DiscountsPage />, '/nastaveni/slevy');
    expect(await screen.findByRole('textbox', { name: 'Nejvyšší ruční sleva — Recepce' })).toHaveValue('10');
    expect(screen.getByRole('textbox', { name: 'Nejvyšší ruční sleva — Admin' })).toHaveValue('30');
    expect(screen.queryByText('Personál')).not.toBeInTheDocument();
  });

  it('saves a changed limit with the role as the server names it and no label', async () => {
    const user = userEvent.setup();
    renderScreen(<DiscountsPage />, '/nastaveni/slevy');
    const field = await screen.findByRole('textbox', { name: 'Nejvyšší ruční sleva — Recepce' });
    await user.clear(field);
    await user.type(field, '12,5');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(putSettings).toHaveBeenCalled());
    expect(putSettings).toHaveBeenCalledWith({
      tiers: SERVER.tiers, packageDiscounts: [], roleLimits: [{ role: 'Staff', maxManualPercent: 12.5 }, { role: 'Administrator', maxManualPercent: 30 }],
    });
  });

  it('shows the 2,5 % the server accepts as typed', async () => {
    getSettings.mockResolvedValue(normalizeDiscountSettings({ ...SERVER, tiers: [{ minPersons: 3, percent: 2.5 }] }));
    renderScreen(<DiscountsPage />, '/nastaveni/slevy');
    expect(await screen.findByRole('textbox', { name: 'Sleva hladiny 1 v procentech' })).toHaveValue('2,5');
  });

  it('can save an empty list of tiers (the server takes it)', async () => {
    getSettings.mockResolvedValue(normalizeDiscountSettings(SERVER));
    const user = userEvent.setup();
    renderScreen(<DiscountsPage />, '/nastaveni/slevy');
    for (const n of [3, 2, 1]) await user.click(await screen.findByRole('button', { name: `Odebrat hladinu ${n}` }));
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(putSettings).toHaveBeenCalled());
    expect(putSettings.mock.calls[0][0].tiers).toEqual([]);
  });

  it('shows the server sentence at the tier it names', async () => {
    putSettings.mockRejectedValue(invalidSettings({ 'tiers[1].minPersons': ['Hranice se opakuje — dvě hladiny by platily pro stejný počet osob.'] }));
    const user = userEvent.setup();
    renderScreen(<DiscountsPage />, '/nastaveni/slevy');
    const field = await screen.findByRole('textbox', { name: 'Od kolika osob — hladina 2' });
    await user.clear(field);
    await user.type(field, '7');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    expect(await screen.findByText(/Hranice se opakuje/)).toBeInTheDocument();
  });

  it('after a save the form shows what the server stored and Uložit is off', async () => {
    const user = userEvent.setup();
    renderScreen(<DiscountsPage />, '/nastaveni/slevy');
    const field = await screen.findByRole('textbox', { name: 'Sleva hladiny 1 v procentech' });
    await user.clear(field);
    await user.type(field, '6');
    await user.click(screen.getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Uložit' })).toBeDisabled());
    expect(screen.getByRole('textbox', { name: 'Sleva hladiny 1 v procentech' })).toHaveValue('6');
  });

  it('sends one request for a double click', async () => {
    let finish: (value: unknown) => void = () => undefined;
    putSettings.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderScreen(<DiscountsPage />, '/nastaveni/slevy');
    const field = await screen.findByRole('textbox', { name: 'Sleva hladiny 1 v procentech' });
    await user.clear(field);
    await user.type(field, '6');
    await user.dblClick(screen.getByRole('button', { name: /Uložit|Ukládám/ }));
    expect(putSettings).toHaveBeenCalledTimes(1);
    finish(SERVER);
    void within;
  });
});
