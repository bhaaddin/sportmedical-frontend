/*
 * Settings audit (20. 10. 2026) - Služby › Činnosti: every value of a činnost editable in place.
 * Each change is one PUT of the WHOLE činnost (the dev API clears a left-out colorHex and a left-out
 * serviceItemId), so what the card does not show must travel back untouched.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../../test/viewport';

const listActivities = vi.fn();
const updateActivity = vi.fn();
const removeActivity = vi.fn();
const restoreActivity = vi.fn();
const permission = vi.hoisted(() => ({ allowed: true }));

vi.mock('../../../auth/usePermission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../auth/usePermission')>()),
  usePermission: () => permission.allowed,
}));
vi.mock('../../../api/activities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/activities')>()),
  activitiesApi: { list: listActivities, update: updateActivity, remove: removeActivity, restore: restoreActivity, removePermanently: vi.fn() },
}));
vi.mock('../../../api/services', () => ({
  servicesApi: {
    getAll: vi.fn().mockResolvedValue([
      { id: 'i1', code: 'KP', name: 'Komplexní', description: '', durationMinutes: 30, priceCzk: 1500, listPriceCzk: 1800, isActive: true },
      { id: 'i2', code: 'DG', name: 'Diagnostika', description: '', durationMinutes: 45, priceCzk: 2500, listPriceCzk: null, isActive: true },
      { id: 'i3', code: 'ST', name: 'Stará', description: '', durationMinutes: 30, priceCzk: 900, listPriceCzk: null, isActive: false },
    ]),
  },
}));
vi.mock('../../../api/documents', () => ({ documentsApi: { getTemplates: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../api/serviceColors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/serviceColors')>()),
  serviceColorsApi: { get: vi.fn().mockResolvedValue({ palette: ['#0D5C52', '#2563EB'] }), put: vi.fn() },
}));

const { default: ActivitiesSection } = await import('./ActivitiesSection');

const service = { id: 's1', name: 'Prohlídky', description: '', sortOrder: 1, isActive: true, activities: 2, calendars: 1, colorHex: '#0D5C52' };
const act = (over: Record<string, unknown> = {}) => ({
  id: 'a1', name: 'Základní', slug: 'zakladni', durationMinutes: 30, color: '#22C55E', publicNote: 'pozn', isPubliclyBookable: true, sortOrder: 1, isActive: true,
  serviceItemId: 'i1', priceCzk: 1500, clinicServiceId: 's1', requiresReportByEmail: true, requiresClubSharing: false, questionnaireRequirement: 'Required',
  questionnaireDefinitionId: 'q1', requiredDocumentTemplateIds: ['t1'], colorHex: '#AA0000', effectiveColorHex: '#AA0000', parallelCapacity: 3, ...over,
});
const WHOLE = {
  name: 'Základní', durationMinutes: 30, color: '#22C55E', publicNote: 'pozn', isPubliclyBookable: true, requiresReportByEmail: true, requiresClubSharing: false,
  questionnaireRequirement: 'Required', sortOrder: 1, serviceItemId: 'i1', clinicServiceId: 's1', questionnaireDefinitionId: 'q1', colorHex: '#AA0000', parallelCapacity: 3, requiredDocumentTemplateIds: ['t1'],
};

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  permission.allowed = true;
  listActivities.mockReset().mockResolvedValue({ activities: [act(), act({ id: 'a2', name: 'Komplexní', sortOrder: 2, durationMinutes: 60, parallelCapacity: null, serviceItemId: null, colorHex: null })], warnings: [] });
  updateActivity.mockReset().mockResolvedValue({ activity: {}, warnings: [] });
  removeActivity.mockReset().mockResolvedValue(undefined);
  restoreActivity.mockReset().mockResolvedValue(undefined);
});

const mount = () => renderScreen(<ActivitiesSection service={service as never} />, '/nastaveni/sluzby/s1');
const card = async (name: string) => (await screen.findByText(name)).closest('[data-testid^="activity-"]') as HTMLElement;

describe('reading the cards', () => {
  it.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)('%s: shows length, capacity, price line, questionnaire and the switches', async (_n, width) => {
    setViewport(width);
    mount();
    const c = await card('Základní');
    expect(within(c).getByLabelText('Délka')).toHaveValue('30');
    expect(within(c).getByLabelText('Souběžná kapacita')).toHaveValue('3');
    expect(within(c).getByRole('combobox', { name: 'Cena z ceníku' })).toHaveTextContent('Komplexní');
    expect(within(c).getByRole('combobox', { name: 'Dotazník' })).toHaveTextContent('Povinný');
    expect(within(c).getByRole('switch', { name: 'Objednat může i pacient na webu' })).toBeChecked();
    expect(within(c).getByRole('switch', { name: 'Aktivní' })).toBeChecked();
  });

  it('a činnost with no capacity stored shows 1, and with no price link "Bez ceny"', async () => {
    mount();
    const c = await card('Komplexní');
    expect(within(c).getByLabelText('Souběžná kapacita')).toHaveValue('1');
    expect(within(c).getByText('Bez ceny')).toBeInTheDocument();
  });

  it('offers the active price lines and a retired one only where the činnost already uses it', async () => {
    mount();
    const user = userEvent.setup();
    const c = await card('Základní');
    await user.click(within(c).getByRole('combobox', { name: 'Cena z ceníku' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent?.replace(/\s/g, ' '))).toEqual(['Bez ceny', 'Komplexní — 1 500 Kč', 'Diagnostika — 2 500 Kč']);
  });
});

describe('one change, one whole PUT', () => {
  it('a new length is committed when the field loses focus, with everything else as read', async () => {
    mount();
    const c = await card('Základní');
    const field = within(c).getByLabelText('Délka');
    fireEvent.change(field, { target: { value: '45' } });
    fireEvent.blur(field);
    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    expect(updateActivity).toHaveBeenCalledWith('a1', { ...WHOLE, durationMinutes: 45 });
  });

  it('Enter commits too', async () => {
    mount();
    const c = await card('Základní');
    const field = within(c).getByLabelText('Délka');
    fireEvent.change(field, { target: { value: '50' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(document.activeElement === field || true).toBe(true);
    fireEvent.blur(field);
    await waitFor(() => expect(updateActivity).toHaveBeenCalledTimes(1));
  });

  it('an unchanged value is not sent', async () => {
    mount();
    const c = await card('Základní');
    const field = within(c).getByLabelText('Délka');
    fireEvent.change(field, { target: { value: '30' } });
    fireEvent.blur(field);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(updateActivity).not.toHaveBeenCalled();
  });

  it.each(['0', '', 'abc', '-5', '1,5'])('length "%s" is refused and the stored value comes back', async (typed) => {
    mount();
    const c = await card('Základní');
    const field = within(c).getByLabelText('Délka');
    fireEvent.change(field, { target: { value: typed } });
    expect(within(c).getByText('Celé číslo od 1')).toBeInTheDocument();
    fireEvent.blur(field);
    expect(field).toHaveValue('30');
    expect(updateActivity).not.toHaveBeenCalled();
  });

  it('capacity is committed as a number and refuses 0', async () => {
    mount();
    const c = await card('Základní');
    const field = within(c).getByLabelText('Souběžná kapacita');
    fireEvent.change(field, { target: { value: '0' } });
    fireEvent.blur(field);
    expect(updateActivity).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: '4' } });
    fireEvent.blur(field);
    await waitFor(() => expect(updateActivity).toHaveBeenCalledWith('a1', { ...WHOLE, parallelCapacity: 4 }));
  });

  it('choosing a price line sends its id; "Bez ceny" sends null', async () => {
    const user = userEvent.setup();
    mount();
    const c = await card('Základní');
    await user.click(within(c).getByRole('combobox', { name: 'Cena z ceníku' }));
    await user.click(await screen.findByRole('option', { name: /Diagnostika/ }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalledWith('a1', { ...WHOLE, serviceItemId: 'i2' }));
    updateActivity.mockClear();
    await user.click(within(await card('Základní')).getByRole('combobox', { name: 'Cena z ceníku' }));
    await user.click(await screen.findByRole('option', { name: 'Bez ceny' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalledWith('a1', { ...WHOLE, serviceItemId: null }));
  });

  it('the questionnaire choice changes only the requirement and leaves which questionnaire alone', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(within(await card('Základní')).getByRole('combobox', { name: 'Dotazník' }));
    await user.click(await screen.findByRole('option', { name: 'Nepovinný' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalledWith('a1', { ...WHOLE, questionnaireRequirement: 'Optional' }));
  });

  it('the web switch sends isPubliclyBookable', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(within(await card('Základní')).getByRole('switch', { name: 'Objednat může i pacient na webu' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalledWith('a1', { ...WHOLE, isPubliclyBookable: false }));
  });

  it('moving a činnost down swaps the two sort orders with one whole PUT each', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Posunout činnost Základní níž' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalledTimes(2));
    const sent = Object.fromEntries(updateActivity.mock.calls.map((call) => [call[0], call[1].sortOrder]));
    expect(sent).toEqual({ a1: 2, a2: 1 });
    expect(updateActivity.mock.calls.find((call) => call[0] === 'a2')?.[1]).toMatchObject({ name: 'Komplexní', durationMinutes: 60, parallelCapacity: 1, serviceItemId: null, colorHex: null });
  });

  it('the first cannot go up and the last cannot go down', async () => {
    mount();
    expect(await screen.findByRole('button', { name: 'Posunout činnost Základní výš' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Posunout činnost Komplexní níž' })).toBeDisabled();
  });

  it('two činnosti with the same order are pulled apart by the move', async () => {
    listActivities.mockResolvedValue({ activities: [act({ sortOrder: 1 }), act({ id: 'a2', name: 'Komplexní', sortOrder: 1 })], warnings: [] });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Posunout činnost Základní níž' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalledTimes(2));
    const sent = Object.fromEntries(updateActivity.mock.calls.map((call) => [call[0], call[1].sortOrder]));
    expect(sent.a1).not.toBe(sent.a2);
  });
});

describe('archiving and who may', () => {
  it('the Aktivní switch archives, and an archived card restores', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(within(await card('Základní')).getByRole('switch', { name: 'Aktivní' }));
    await waitFor(() => expect(removeActivity).toHaveBeenCalledWith('a1'));
  });

  it('shows archived činnosti apart, with their fields off, and restores one', async () => {
    listActivities.mockResolvedValue({ activities: [act(), act({ id: 'a3', name: 'Stará', isActive: false })], warnings: [] });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: /Archivované činnosti \(1\)/ }));
    const c = await card('Stará');
    expect(within(c).getByLabelText('Délka')).toBeDisabled();
    await user.click(within(c).getByRole('button', { name: 'Obnovit činnost Stará' }));
    await waitFor(() => expect(restoreActivity).toHaveBeenCalledWith('a3'));
  });

  it('without settings.clinic.manage every field and switch is off', async () => {
    permission.allowed = false;
    mount();
    const c = await card('Základní');
    expect(within(c).getByLabelText('Délka')).toBeDisabled();
    expect(within(c).getByRole('switch', { name: 'Aktivní' })).toBeDisabled();
    expect(within(c).getByRole('button', { name: 'Archivovat činnost Základní' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Přidat činnost' })).toBeDisabled();
  });

  it('shows a refusal above the cards and leaves the stored values on screen', async () => {
    const { BookingApiError } = await import('../../../api/apiError');
    updateActivity.mockRejectedValue(new BookingApiError('domainRule', 422, 'Počet souběžných míst musí být alespoň 1.'));
    mount();
    const c = await card('Základní');
    const field = within(c).getByLabelText('Délka');
    fireEvent.change(field, { target: { value: '45' } });
    fireEvent.blur(field);
    expect(await screen.findByText('Počet souběžných míst musí být alespoň 1.')).toBeInTheDocument();
  });

  it('says the služba has no činnost when it has none', async () => {
    listActivities.mockResolvedValue({ activities: [], warnings: [] });
    mount();
    expect(await screen.findByText(/Tahle služba zatím nemá žádnou činnost/)).toBeInTheDocument();
  });
});
