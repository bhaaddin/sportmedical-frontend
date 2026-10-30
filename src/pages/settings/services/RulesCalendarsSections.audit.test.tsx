/*
 * Settings audit (20. 10. 2026) - Služby › Pravidla a dokumenty, Kalendáře.
 *
 * Rules: the consents and the questionnaire of each činnost, each change one whole PUT (the dev API clears a left-out colorHex).
 * Kalendáře: the weekdays a calendar works are READ from its current period's rows (a row existing makes the day work; the
 * server does not send isActive), and changed on the working-hours screen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../../test/viewport';

const listActivities = vi.fn();
const updateActivity = vi.fn();
const listRules = vi.fn();
const listCalendars = vi.fn();
const listPeriods = vi.fn();
const listWorkingHours = vi.fn();
const permission = vi.hoisted(() => ({ allowed: true }));

vi.mock('../../../auth/usePermission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../auth/usePermission')>()),
  usePermission: () => permission.allowed,
}));
vi.mock('../../../api/activities', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/activities')>()),
  activitiesApi: { list: listActivities, update: updateActivity },
}));
vi.mock('../../../api/documentRequirements', () => ({ documentRequirementsApi: { list: listRules } }));
vi.mock('../../../api/documents', () => ({ documentsApi: { getTemplates: vi.fn().mockResolvedValue([{ id: 't1', name: 'Výpis z karty', isActive: true }]) } }));
vi.mock('../../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../../api/workingHours', () => ({ workingHoursApi: { listPeriods, listWorkingHours } }));

const { default: RulesSection } = await import('./RulesSection');
const { default: CalendarsSection } = await import('./CalendarsSection');

const service = { id: 's1', name: 'Prohlídky', description: '', sortOrder: 1, isActive: true, activities: 2, calendars: 1, colorHex: '#0D5C52' };
const act = (over: Record<string, unknown> = {}) => ({
  id: 'a1', name: 'Základní', slug: 'x', durationMinutes: 30, color: '#22C55E', publicNote: '', isPubliclyBookable: true, sortOrder: 1, isActive: true, serviceItemId: 'i1', priceCzk: 1500,
  clinicServiceId: 's1', requiresReportByEmail: false, requiresClubSharing: false, questionnaireRequirement: 'NotAsked', questionnaireDefinitionId: null, requiredDocumentTemplateIds: ['t1'],
  colorHex: '#AA0000', effectiveColorHex: '#AA0000', parallelCapacity: 2, ...over,
});
const calendar = (over: Record<string, unknown> = {}) => ({
  id: 'c1', name: 'Ordinace A', color: '#0D7377', location: 'Praha', displayStepMinutes: 15, isActive: true, sortOrder: 1, clinicServiceId: 's1', ...over,
});

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  permission.allowed = true;
  listActivities.mockReset().mockResolvedValue({ activities: [act(), act({ id: 'a2', name: 'Komplexní', sortOrder: 2 }), act({ id: 'a3', name: 'Archiv', isActive: false })], warnings: [] });
  updateActivity.mockReset().mockResolvedValue({ activity: {}, warnings: [] });
  listRules.mockReset().mockResolvedValue([
    { id: 'r1', templateId: 't1', templateName: 'Výpis z karty', clinicServiceId: 's1', validityMonths: 12, firstVisitOnly: true, blocksBooking: true },
    { id: 'r2', templateId: 't2', templateName: 'Cizí pravidlo', clinicServiceId: 'other', validityMonths: 0, firstVisitOnly: false, blocksBooking: false },
  ]);
  listCalendars.mockReset().mockResolvedValue([calendar(), calendar({ id: 'c2', name: 'Ordinace B', sortOrder: 2 }), calendar({ id: 'c3', name: 'Jiná služba', clinicServiceId: 'other' }), calendar({ id: 'c4', name: 'Vypnutá', isActive: false, sortOrder: 3 })]);
  listPeriods.mockReset().mockResolvedValue([{ id: 'p1', name: 'Rok', validFrom: '2020-01-01', validTo: null }]);
  listWorkingHours.mockReset().mockResolvedValue([{ id: 'w1', dayOfWeek: 1, isActive: true }, { id: 'w2', dayOfWeek: 3, isActive: true }]);
});

describe('Pravidla a dokumenty', () => {
  const mount = () => renderScreen(<RulesSection service={service as never} />, '/nastaveni/sluzby/s1');

  it('lists the document rules of THIS služba with their conditions, and not another’s', async () => {
    mount();
    expect((await screen.findAllByText('Výpis z karty')).length).toBeGreaterThan(0);
    expect(screen.getByText('platí 12 měsíců')).toBeInTheDocument();
    expect(screen.getByText('jen při první návštěvě')).toBeInTheDocument();
    expect(screen.getByText('chybějící dokument zablokuje objednání')).toBeInTheDocument();
    expect(screen.queryByText('Cizí pravidlo')).not.toBeInTheDocument();
  });

  it('words a rule without a validity limit and one that only warns', async () => {
    listRules.mockResolvedValue([{ id: 'r1', templateId: 't1', templateName: 'Souhlas', clinicServiceId: 's1', validityMonths: 0, firstVisitOnly: false, blocksBooking: false }]);
    mount();
    expect(await screen.findByText('bez omezení platnosti')).toBeInTheDocument();
    expect(screen.getByText('při každé návštěvě')).toBeInTheDocument();
    expect(screen.getByText('chybějící dokument jen upozorní')).toBeInTheDocument();
  });

  it('says the patient brings nothing when there is no rule', async () => {
    listRules.mockResolvedValue([]);
    mount();
    expect(await screen.findByText('Pro tuhle službu pacient žádný dokument přinášet nemusí.')).toBeInTheDocument();
  });

  it('shows one card per ACTIVE činnost', async () => {
    mount();
    expect(await screen.findByTestId('rules-a1')).toBeInTheDocument();
    expect(screen.getByTestId('rules-a2')).toBeInTheDocument();
    expect(screen.queryByTestId('rules-a3')).not.toBeInTheDocument();
  });

  it('the questionnaire choice sends the whole činnost with only the requirement changed', async () => {
    const user = userEvent.setup();
    mount();
    const card = await screen.findByTestId('rules-a1');
    await user.click(within(card).getByRole('combobox', { name: 'Dotazník — Základní' }));
    await user.click(await screen.findByRole('option', { name: 'Povinný' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    expect(updateActivity).toHaveBeenCalledWith('a1', expect.objectContaining({
      questionnaireRequirement: 'Required', colorHex: '#AA0000', parallelCapacity: 2, requiredDocumentTemplateIds: ['t1'], serviceItemId: 'i1', clinicServiceId: 's1',
    }));
  });

  it('the two consent switches each change just their own field', async () => {
    const user = userEvent.setup();
    mount();
    const card = await screen.findByTestId('rules-a1');
    await user.click(within(card).getByRole('switch', { name: 'Souhlas se zasláním zprávy e-mailem — Základní' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalledTimes(1));
    expect(updateActivity.mock.calls[0][1]).toMatchObject({ requiresReportByEmail: true, requiresClubSharing: false });
    updateActivity.mockClear();
    await user.click(within(await screen.findByTestId('rules-a1')).getByRole('switch', { name: 'Souhlas se sdílením s klubem — Základní' }));
    await waitFor(() => expect(updateActivity).toHaveBeenCalledTimes(1));
    expect(updateActivity.mock.calls[0][1]).toMatchObject({ requiresClubSharing: true, requiresReportByEmail: false });
  });

  it('names the documents a činnost asks for, and says where they are chosen', async () => {
    listActivities.mockResolvedValue({ activities: [act(), act({ id: 'a2', name: 'Komplexní', requiredDocumentTemplateIds: [] })], warnings: [] });
    mount();
    const first = await screen.findByTestId('rules-a1');
    expect(await within(first).findByText('Výpis z karty')).toBeInTheDocument();
    expect(within(screen.getByTestId('rules-a2')).getByText(/Vybírají se v „Barva a dokumenty“/)).toBeInTheDocument();
  });

  it('without settings.clinic.manage everything is off', async () => {
    permission.allowed = false;
    mount();
    const card = await screen.findByTestId('rules-a1');
    expect(within(card).getByRole('combobox', { name: 'Dotazník — Základní' })).toHaveAttribute('aria-disabled', 'true');
    expect(within(card).getByRole('switch', { name: 'Souhlas se sdílením s klubem — Základní' })).toBeDisabled();
  });

  it('says the rules could not be read, and the činnosti stay editable', async () => {
    listRules.mockRejectedValue(new Error('down'));
    mount();
    expect(await screen.findByText('Pravidla dokumentů se nepodařilo načíst.')).toBeInTheDocument();
    expect(await screen.findByTestId('rules-a1')).toBeInTheDocument();
  });

  it('shows the refusal of a change above the cards', async () => {
    const { BookingApiError } = await import('../../../api/apiError');
    updateActivity.mockRejectedValue(new BookingApiError('domainRule', 422, 'Vybraný dotazník už neexistuje. Vyberte jiný.'));
    const user = userEvent.setup();
    mount();
    await user.click(within(await screen.findByTestId('rules-a1')).getByRole('switch', { name: 'Souhlas se sdílením s klubem — Základní' }));
    expect(await screen.findByText('Vybraný dotazník už neexistuje. Vyberte jiný.')).toBeInTheDocument();
  });
});

describe('Kalendáře of a služba', () => {
  const mount = () => renderScreen(<CalendarsSection service={service as never} />, '/nastaveni/sluzby/s1');

  it('lists the calendars that run this služba, in their order, and not another’s', async () => {
    mount();
    expect(await screen.findByText('Ordinace A')).toBeInTheDocument();
    expect(screen.getByText('Ordinace B')).toBeInTheDocument();
    expect(screen.queryByText('Jiná služba')).not.toBeInTheDocument();
  });

  it('opens Pracovní doba on the služba own calendar', async () => {
    const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom');
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
    const { render } = await import('@testing-library/react');
    const Where = () => <span data-testid="state">{JSON.stringify((useLocation().state as unknown) ?? null)}</span>;
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/nastaveni/sluzby/s1']}>
          <Routes>
            <Route path="/working-hours" element={<Where />} />
            <Route path="*" element={<CalendarsSection service={service as never} />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('Ordinace A');
    await userEvent.click(screen.getByRole('button', { name: 'Pracovní doba' }));
    expect(JSON.parse((await screen.findByTestId('state')).textContent ?? 'null')).toEqual({ calendarId: 'c1' });
  });

  it('marks the weekdays the current period works, and no other', async () => {
    mount();
    const card = await screen.findByTestId('calendar-c1');
    const days = await within(card).findByLabelText('Pracovní dny');
    const chips = Array.from(days.querySelectorAll('.MuiChip-root')) as HTMLElement[];
    const filled = chips.filter((chip) => chip.className.includes('MuiChip-filled')).map((chip) => chip.textContent);
    expect(filled).toEqual(['Po', 'St']);
    expect(chips).toHaveLength(7);
  });

  it('asks for the period in force today, else the latest one', async () => {
    listPeriods.mockResolvedValue([
      { id: 'old', name: 'Stará', validFrom: '2019-01-01', validTo: '2019-12-31' },
      { id: 'newest', name: 'Nová', validFrom: '2018-01-01', validTo: '2018-06-30' },
    ]);
    mount();
    await waitFor(() => expect(listWorkingHours).toHaveBeenCalledWith('c1', 'old'));
  });

  it('says so when the calendar has no timetable yet', async () => {
    listPeriods.mockResolvedValue([]);
    mount();
    await waitFor(() => expect(screen.getAllByText('Pracovní doba není nastavená.')).toHaveLength(2));
  });

  it('says an inactive calendar does not offer the služba', async () => {
    listCalendars.mockResolvedValue([calendar({ isActive: false })]);
    mount();
    expect(await screen.findByText('Neaktivní kalendář službu nenabízí.')).toBeInTheDocument();
  });

  it('says nothing runs the služba, and what to do', async () => {
    listCalendars.mockResolvedValue([calendar({ clinicServiceId: 'other' })]);
    mount();
    expect(await screen.findByText(/neprovozuje žádný kalendář/)).toBeInTheDocument();
  });

  it('says the working days could not be read, per calendar', async () => {
    listPeriods.mockRejectedValue(new Error('down'));
    mount();
    await waitFor(() => expect(screen.getAllByText('Pracovní dny se nepodařilo načíst.')).toHaveLength(2));
  });
});
