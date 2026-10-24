/*
 * Settings audit (20. 10. 2026) - Činnosti (/activities), the full form.
 *
 * Server facts (dev API, PUT /api/activities/{id}):
 *   durationMinutes 0                       -> 422 scheduling.activity.duration_positive
 *   name empty / over 120, note over 500    -> 422 scheduling.activity.name_required / scheduling.text.too_long
 *   clinicServiceId "" or null              -> 400 (a činnost always belongs to a služba)
 *   a PUT that leaves colorHex out clears the činnost's own colour; parallelCapacity
 *   left out is kept; questionnaireRequirement must be sent as 0/1/2 (the wire form).
 * The form carries colorHex, parallelCapacity and the required documents back
 * untouched even though it has no field for them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { refused, renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const listActivities = vi.fn();
const createActivity = vi.fn();
const updateActivity = vi.fn();
const removeActivity = vi.fn();
const restoreActivity = vi.fn();
const listServices = vi.fn();
const listPriceItems = vi.fn();
const listQuestionnaires = vi.fn();

vi.mock('../../api/activities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/activities')>()),
  activitiesApi: { list: listActivities, create: createActivity, update: updateActivity, remove: removeActivity, restore: restoreActivity, removePermanently: vi.fn() },
}));
vi.mock('../../api/services', () => ({ servicesApi: { getAll: listPriceItems } }));
vi.mock('../../api/clinicServices', () => ({ clinicServicesApi: { list: listServices } }));
vi.mock('../../api/questionnaireEditor', () => ({ questionnaireEditorApi: { list: listQuestionnaires } }));
vi.mock('../../api/serviceColors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/serviceColors')>()),
  serviceColorsApi: { get: vi.fn().mockResolvedValue({ palette: ['#0D5C52', '#2563EB', '#D97706', '#7C3AED', '#DC2626', '#0891B2'] }), put: vi.fn() },
}));

const { default: ActivitiesPage } = await import('./ActivitiesPage');

const activity = (over: Record<string, unknown> = {}) => ({
  id: 'a1', name: 'Základní prohlídka', slug: 'zakladni', durationMinutes: 30, color: '#22C55E', publicNote: 'Přijďte nalačno', isPubliclyBookable: true, sortOrder: 2,
  isActive: true, serviceItemId: 'i1', priceCzk: 1500, clinicServiceId: 's1', requiresReportByEmail: true, requiresClubSharing: false,
  questionnaireRequirement: 'Required', questionnaireDefinitionId: 'q1', requiredDocumentTemplateIds: ['t1'], colorHex: '#AA0000', effectiveColorHex: '#AA0000', parallelCapacity: 3, ...over,
});
const service = (id: string, name: string) => ({ id, name, description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1, colorHex: null });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage', 'questionnaires.manage']));
  listActivities.mockReset().mockResolvedValue({ activities: [activity()], warnings: [] });
  createActivity.mockReset().mockResolvedValue({ activity: {}, warnings: [] });
  updateActivity.mockReset().mockResolvedValue({ activity: {}, warnings: [] });
  removeActivity.mockReset().mockResolvedValue(undefined);
  restoreActivity.mockReset().mockResolvedValue(undefined);
  listServices.mockReset().mockResolvedValue([service('s1', 'Prohlídky'), service('s2', 'Diagnostika')]);
  listPriceItems.mockReset().mockResolvedValue([{ id: 'i1', code: 'KP', name: 'Komplexní', description: '', durationMinutes: 30, priceCzk: 1500, isActive: true }]);
  listQuestionnaires.mockReset().mockResolvedValue([{ id: 'q1', displayName: 'Zdravotní dotazník' }, { id: 'q2', displayName: 'Krátký' }]);
});

const edit = async () => {
  const user = userEvent.setup();
  renderScreen(<ActivitiesPage />, '/activities');
  await user.click(await screen.findByRole('button', { name: 'Upravit' }));
  return { user, dialog: await screen.findByRole('dialog') };
};
const create = async () => {
  const user = userEvent.setup();
  renderScreen(<ActivitiesPage />, '/activities');
  await user.click(await screen.findByRole('button', { name: 'Nová činnost' }));
  return { user, dialog: await screen.findByRole('dialog') };
};

describe('the list', () => {
  it('shows the name, the length, the note, the price read through the price list and whether the web may book it', async () => {
    renderScreen(<ActivitiesPage />, '/activities');
    const row = (await screen.findByText('Základní prohlídka')).closest('[data-card="activity"]') as HTMLElement;
    expect(within(row).getByText('30 min')).toBeInTheDocument();
    expect(within(row).getByText('Přijďte nalačno')).toBeInTheDocument();
    expect(within(row).getByText('1500 Kč')).toBeInTheDocument();
    expect(within(row).getByText('Veřejná')).toBeInTheDocument();
  });

  it('writes "bez ceny", never 0 Kč, for a činnost with no price-list link', async () => {
    listActivities.mockResolvedValue({ activities: [activity({ priceCzk: null, serviceItemId: null })], warnings: [] });
    renderScreen(<ActivitiesPage />, '/activities');
    expect(await screen.findByText('bez ceny')).toBeInTheDocument();
  });

  it('orders by sortOrder and keeps the archived ones apart', async () => {
    listActivities.mockResolvedValue({
      activities: [activity({ id: 'b', name: 'Druhá', sortOrder: 5 }), activity({ id: 'a', name: 'První', sortOrder: 1 }), activity({ id: 'c', name: 'Stará', sortOrder: 0, isActive: false })],
      warnings: [],
    });
    renderScreen(<ActivitiesPage />, '/activities');
    await screen.findByText('První');
    const names = Array.from(document.querySelectorAll('[data-card="activity"] h3')).map((h) => h.textContent);
    expect(names).toEqual(['První', 'Druhá']);
    expect(screen.getByRole('button', { name: /Archivované \(1\)/ })).toBeInTheDocument();
  });

  it('shows the warnings the server sent with the list and lets the owner click one away', async () => {
    listActivities.mockResolvedValue({ activities: [activity()], warnings: [{ code: 'price.unlinked', message: 'Činnost nemá cenu.', context: { activityId: 'a1' } }] });
    const user = userEvent.setup();
    renderScreen(<ActivitiesPage />, '/activities');
    expect(await screen.findByText('Činnost nemá cenu.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Close|Zavřít/i }));
    expect(screen.queryByText('Činnost nemá cenu.')).not.toBeInTheDocument();
  });

  it('archives only after asking', async () => {
    const user = userEvent.setup();
    renderScreen(<ActivitiesPage />, '/activities');
    await user.click(await screen.findByRole('button', { name: 'Archivovat — Základní prohlídka' }));
    expect(removeActivity).not.toHaveBeenCalled();
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archivovat' }));
    await waitFor(() => expect(removeActivity).toHaveBeenCalledWith('a1'));
  });

  it('restores an archived činnost with one click', async () => {
    listActivities.mockResolvedValue({ activities: [activity(), activity({ id: 'c', name: 'Stará', isActive: false })], warnings: [] });
    const user = userEvent.setup();
    renderScreen(<ActivitiesPage />, '/activities');
    await user.click(await screen.findByRole('button', { name: /Archivované \(1\)/ }));
    await user.click(await screen.findByRole('button', { name: 'Obnovit — Stará' }));
    await waitFor(() => expect(restoreActivity).toHaveBeenCalledWith('c'));
  });
});

describe('editing a činnost', () => {
  it('loads every stored value into the form', async () => {
    const { dialog } = await edit();
    expect(within(dialog).getByLabelText(/^Název/)).toHaveValue('Základní prohlídka');
    expect(within(dialog).getByLabelText(/^Délka/)).toHaveValue(30);
    expect(within(dialog).getByLabelText('Poznámka pro pacienta')).toHaveValue('Přijďte nalačno');
    expect(within(dialog).getByLabelText('Pořadí')).toHaveValue(2);
    expect(within(dialog).getByRole('combobox', { name: /^Služba/ })).toHaveTextContent('Prohlídky');
    expect(within(dialog).getByRole('combobox', { name: 'Položka ceníku' })).toHaveTextContent('Komplexní');
    expect(within(dialog).getByRole('switch', { name: 'Lze objednat z webu' })).toBeChecked();
    expect(within(dialog).getByRole('switch', { name: 'Lékařská zpráva e-mailem' })).toBeChecked();
    expect(within(dialog).getByRole('switch', { name: 'Sdílení výsledků s klubem' })).not.toBeChecked();
    expect(within(dialog).getByRole('combobox', { name: 'Zdravotní dotazník' })).toHaveTextContent('Povinný');
    expect(within(dialog).getByRole('combobox', { name: 'Který dotazník' })).toHaveTextContent('Zdravotní dotazník');
  });

  it('a rename sends the whole činnost back, including the colour of its own, the capacity and the documents the form has no field for', async () => {
    const { user, dialog } = await edit();
    const name = within(dialog).getByLabelText(/^Název/);
    await user.clear(name);
    await user.type(name, '  Nová prohlídka  ');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    expect(updateActivity).toHaveBeenCalledWith('a1', {
      name: 'Nová prohlídka', durationMinutes: 30, color: '#22C55E', publicNote: 'Přijďte nalačno', isPubliclyBookable: true, requiresReportByEmail: true,
      requiresClubSharing: false, questionnaireRequirement: 'Required', sortOrder: 2, serviceItemId: 'i1', clinicServiceId: 's1', questionnaireDefinitionId: 'q1',
      colorHex: '#AA0000', parallelCapacity: 3, requiredDocumentTemplateIds: ['t1'],
    });
    expect(createActivity).not.toHaveBeenCalled();
  });

  it('a činnost with no capacity stored is sent as 1 (the server refuses 0)', async () => {
    listActivities.mockResolvedValue({ activities: [activity({ parallelCapacity: null })], warnings: [] });
    const { user, dialog } = await edit();
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    expect(updateActivity.mock.calls[0][1].parallelCapacity).toBe(1);
  });

  it('unlinking the price sends serviceItemId null, not undefined', async () => {
    const { user, dialog } = await edit();
    await user.click(within(dialog).getByRole('combobox', { name: 'Položka ceníku' }));
    await user.click(await screen.findByRole('option', { name: '— bez vazby na ceník —' }));
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    expect(updateActivity.mock.calls[0][1].serviceItemId).toBeNull();
  });

  it('keeps a price link whose line has since been archived selectable, so opening and saving does not drop it', async () => {
    listActivities.mockResolvedValue({ activities: [activity({ serviceItemId: 'gone' })], warnings: [] });
    const { user, dialog } = await edit();
    expect(within(dialog).getByRole('combobox', { name: 'Položka ceníku' })).toHaveTextContent('Stávající vazba (položka není v seznamu)');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    expect(updateActivity.mock.calls[0][1].serviceItemId).toBe('gone');
  });

  it('switching the questionnaire off hides the which-one choice but keeps the stored id', async () => {
    const { user, dialog } = await edit();
    await user.click(within(dialog).getByRole('combobox', { name: 'Zdravotní dotazník' }));
    await user.click(await screen.findByRole('option', { name: 'Neptáme se' }));
    expect(within(dialog).queryByRole('combobox', { name: 'Který dotazník' })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    expect(updateActivity.mock.calls[0][1]).toMatchObject({ questionnaireRequirement: 'NotAsked', questionnaireDefinitionId: 'q1' });
  });

  it('choosing the clinic default questionnaire sends null', async () => {
    const { user, dialog } = await edit();
    await user.click(within(dialog).getByRole('combobox', { name: 'Který dotazník' }));
    await user.click(await screen.findByRole('option', { name: 'Výchozí dotazník kliniky' }));
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    expect(updateActivity.mock.calls[0][1].questionnaireDefinitionId).toBeNull();
  });

  it('without questionnaires.manage the which-one choice is locked and the stored one is kept', async () => {
    localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
    const { user, dialog } = await edit();
    expect(within(dialog).getByRole('combobox', { name: 'Který dotazník' })).toHaveAttribute('aria-disabled', 'true');
    expect(listQuestionnaires).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    expect(updateActivity.mock.calls[0][1].questionnaireDefinitionId).toBe('q1');
  });

  it('the consents are shown only for a činnost the web may book', async () => {
    const { user, dialog } = await edit();
    await user.click(within(dialog).getByRole('switch', { name: 'Lze objednat z webu' }));
    expect(within(dialog).queryByRole('switch', { name: 'Lékařská zpráva e-mailem' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('combobox', { name: 'Zdravotní dotazník' })).not.toBeInTheDocument();
  });
});

describe('the rules at the form', () => {
  it.each([
    ['Délka', '0'],
    ['Pořadí', '-1'],
  ])('%s = %s keeps Uložit off', async (label, typed) => {
    const { user, dialog } = await edit();
    const field = within(dialog).getByLabelText(new RegExp(`^${label}`));
    /* A pasted value: a controlled number field turns a typed "-" into 0 on its own. */
    fireEvent.change(field, { target: { value: typed } });
    void user;
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('a name of spaces keeps Uložit off', async () => {
    const { user, dialog } = await edit();
    const name = within(dialog).getByLabelText(/^Název/);
    await user.clear(name);
    await user.type(name, '   ');
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('stops the name at 120 and the note at 500 characters, which is all the server keeps', async () => {
    const { dialog } = await edit();
    expect(within(dialog).getByLabelText(/^Název/)).toHaveAttribute('maxlength', '120');
    expect(within(dialog).getByLabelText('Poznámka pro pacienta')).toHaveAttribute('maxlength', '500');
  });

  it('a new činnost waits for a služba (the server refuses one without)', async () => {
    const { user, dialog } = await create();
    await user.type(within(dialog).getByLabelText(/^Název/), 'Nová');
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
    await user.click(within(dialog).getByRole('combobox', { name: /^Služba/ }));
    await user.click(await screen.findByRole('option', { name: 'Diagnostika' }));
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeEnabled();
  });

  it('a new činnost starts at 30 minutes, internal only, questionnaire not asked, order after the existing', async () => {
    const { user, dialog } = await create();
    expect(within(dialog).getByLabelText(/^Délka/)).toHaveValue(30);
    expect(within(dialog).getByRole('switch', { name: 'Lze objednat z webu' })).not.toBeChecked();
    expect(within(dialog).getByLabelText('Pořadí')).toHaveValue(1);
    await user.type(within(dialog).getByLabelText(/^Název/), 'Nová');
    await user.click(within(dialog).getByRole('combobox', { name: /^Služba/ }));
    await user.click(await screen.findByRole('option', { name: 'Diagnostika' }));
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(createActivity).toHaveBeenCalled());
    expect(createActivity.mock.calls[0][0]).toMatchObject({
      name: 'Nová', durationMinutes: 30, isPubliclyBookable: false, questionnaireRequirement: 'NotAsked', clinicServiceId: 's2', serviceItemId: null, questionnaireDefinitionId: null, sortOrder: 1,
    });
  });

  it('puts the duplicate-name refusal on the name box, not in a banner', async () => {
    const { toNamedError } = await vi.importActual<typeof import('../../api/duplicateName')>('../../api/duplicateName');
    updateActivity.mockRejectedValue(toNamedError(refused(409, { code: 'service.duplicate', message: 'Činnost s tímto názvem už v této službě existuje.' })));
    const { user, dialog } = await edit();
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByText('Činnost s tímto názvem už v této službě existuje.')).toBeInTheDocument();
  });

  it('shows the Czech sentence for a refused rule inside the dialog', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    updateActivity.mockRejectedValue(new BookingApiError('domainRule', 422, 'Text je příliš dlouhý. Zkraťte jej.'));
    const { user, dialog } = await edit();
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByText('Text je příliš dlouhý. Zkraťte jej.')).toBeInTheDocument();
  });

  it('sends one request for a double click', async () => {
    let finish: (value: unknown) => void = () => undefined;
    updateActivity.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { user, dialog } = await edit();
    await user.dblClick(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(updateActivity).toHaveBeenCalledTimes(1);
    finish({ activity: {}, warnings: [] });
  });
});
