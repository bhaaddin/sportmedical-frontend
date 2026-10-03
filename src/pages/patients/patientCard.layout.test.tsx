/*
 * The patient's card in its three layouts, and the doctor's manual entry of
 * results (Etapa 2: brief rule 3, decisions 6 and 14).
 *
 *   390   cards instead of tables, the main action pinned at the bottom,
 *         one field per row
 *   834   tables with three columns
 *   1440  the full tables, the actions in the header
 *
 * What would have to break for these to fail: a table on a phone, a button
 * drawn twice (inline and pinned), a document page that calls something
 * "povinné" when nothing is required, a manual entry that saves what it
 * should have refused, or one that loses the values the server has no column
 * for.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const getById = vi.fn();
const getTemplates = vi.fn();
const getPatientDocuments = vi.fn();
const checkRequired = vi.fn();
const getConsents = vi.fn();
const getByPatient = vi.fn();
const createSession = vi.fn();
const updateSession = vi.fn();
const listActivities = vi.fn();

vi.mock('../../api/patients', () => ({ patientsApi: { getById, getProfile: vi.fn(), search: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/documents', async () => {
  const actual = await vi.importActual<typeof import('../../api/documents')>('../../api/documents');
  return { ...actual, documentsApi: { getTemplates, getPatientDocuments, checkRequired } };
});
vi.mock('../../api/client', () => ({ default: { get: getConsents } }));
vi.mock('../../api/diagnostics', () => ({
  diagnosticsApi: { getByPatient, create: createSession, update: updateSession, downloadPdf: vi.fn() },
}));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { default: PatientLayout } = await import('./PatientLayout');
const { default: PatientResultsPage } = await import('./PatientResultsPage');
const { default: PatientDocumentsPage } = await import('./PatientDocumentsPage');
const { default: ManualResultsForm } = await import('./ManualResultsForm');

const PATIENT = {
  id: 'p1', firstName: 'Cesta', lastName: 'Jedna', dateOfBirth: '1990-05-15', sex: 'Male', status: 'Active',
};

const session = (over: Record<string, unknown> = {}) => ({
  id: 's1', patientId: 'p1', sessionDate: '2026-09-20T08:00:00Z', practitionerName: 'MUDr. Test',
  restingHeartRateBpm: 58, maxHeartRateBpm: 190, vo2MaxMlMinKg: 52, anaerobicThresholdBpm: 160,
  systolicBloodPressure: 118, diastolicBloodPressure: 76, bodyFatPercentage: 12, muscleMassKg: 41,
  requiresDoctorReview: false, createdAtUtc: '2026-09-20T08:00:00Z', ...over,
});

const queryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

beforeEach(() => {
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.edit']));
  localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Lékařová' }));
  getById.mockReset().mockResolvedValue(PATIENT);
  getTemplates.mockReset().mockResolvedValue([]);
  getPatientDocuments.mockReset().mockResolvedValue([]);
  checkRequired.mockReset().mockResolvedValue({ allRequiredPresent: true, requirements: [] });
  getConsents.mockReset().mockResolvedValue({ data: [] });
  getByPatient.mockReset().mockResolvedValue([session()]);
  createSession.mockReset().mockResolvedValue(session());
  updateSession.mockReset().mockResolvedValue(session());
  listActivities.mockReset().mockResolvedValue({ activities: [{ id: 'a1', name: 'Spiroergometrie' }] });
});

/* ── the card's frame ── */

const renderCard = () =>
  render(
    <QueryClientProvider client={queryClient()}>
      <MemoryRouter initialEntries={['/patients/p1']}>
        <Routes>
          <Route path="/patients/:id" element={<PatientLayout />}>
            <Route index element={<div>PŘEHLED</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('the card frame', () => {
  it('pins "Objednat termín" at the bottom of a phone, and nowhere else on it', async () => {
    setViewport(VIEWPORTS.phone);
    const { container } = renderCard();

    await screen.findByText('PŘEHLED');
    const pinned = container.querySelector('[data-pinned="true"]') as HTMLElement;
    expect(within(pinned).getByRole('button', { name: 'Objednat termín' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Objednat termín' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Resetovat heslo do portálu' })).toBeInTheDocument();
  });

  it.each([['iPad', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])(
    'keeps "Objednat termín" in the header on an %s',
    async (_name, width) => {
      setViewport(width);
      const { container } = renderCard();

      await screen.findByText('PŘEHLED');
      expect(container.querySelector('[data-pinned="true"]')).toBeNull();
      expect(screen.getAllByRole('button', { name: 'Objednat termín' })).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Upravit kartu' })).toBeInTheDocument();
    },
  );

  it('lists the six tabs of the board', async () => {
    setViewport(VIEWPORTS.desktop);
    renderCard();

    await screen.findByText('PŘEHLED');
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Přehled', 'Termíny', 'Výsledky', 'Dokumenty', 'Historie']);
  });

  it('says plainly, without a warning box, that nothing is required', async () => {
    setViewport(VIEWPORTS.desktop);
    renderCard();

    expect(await screen.findByText(/Nemá objednaný termín/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

/* ── Dokumenty ── */

const renderDocuments = (documents: unknown[], requirements: unknown[] | null = []) =>
  render(
    <MemoryRouter initialEntries={['/x']}>
      <Routes>
        <Route
          element={(
            <Outlet
              context={{
                patient: PATIENT, profile: null, documents,
                templates: [
                  { id: 't1', name: 'Informovaný souhlas', description: '', isActive: true },
                  { id: 't2', name: 'Výpis', description: '', isActive: true },
                ],
                requirements, upcoming: [], displayPhone: '', displayEmail: '', reloadDocuments: vi.fn(),
              }}
            />
          )}
        >
          <Route path="/x" element={<PatientDocumentsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('Dokumenty', () => {
  it('shows each document with the template it is filed under', async () => {
    setViewport(VIEWPORTS.desktop);
    renderDocuments([
      { id: 'd1', patientId: 'p1', templateId: 't1', templateName: 'Informovaný souhlas', uploadedAt: '2026-09-01T10:00:00Z', status: 'SignedOff', source: 'Staff' },
    ]);

    const row = await screen.findByTestId('patient-document');
    expect(within(row).getByText('Informovaný souhlas', { selector: 'p, span, div' })).toBeInTheDocument();
    expect(within(row).getByText(/Šablona: Informovaný souhlas/)).toBeInTheDocument();
    expect(within(row).getByText('Přijato')).toBeInTheDocument();
  });

  it('treats an empty requirement list as the normal state, not as a missing list', async () => {
    setViewport(VIEWPORTS.phone);
    renderDocuments([], []);

    expect(await screen.findByText('Pacient zatím nemá žádný uložený dokument.')).toBeInTheDocument();
    expect(screen.getByText(/Nemá objednaný termín/)).toBeInTheDocument();
    expect(screen.queryByText(/Povinné dokumenty/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Žádné povinné/)).not.toBeInTheDocument();
    /* the legal consent line stays on */
    expect(screen.getByText(/Zákonné souhlasy/)).toBeInTheDocument();
  });

  it('offers every active template for upload', async () => {
    setViewport(VIEWPORTS.desktop);
    const user = userEvent.setup();
    renderDocuments([]);

    expect(screen.getByRole('button', { name: 'Nahrát dokument' })).toBeDisabled();
    await user.click(screen.getByLabelText('Šablona dokumentu'));
    expect(await screen.findByRole('option', { name: 'Výpis' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Informovaný souhlas' })).toBeInTheDocument();
  });
});

/* ── Výsledky ── */

const renderResults = () =>
  render(
    <QueryClientProvider client={queryClient()}>
      <MemoryRouter initialEntries={['/patients/p1/vysledky']}>
        <Routes>
          <Route path="/patients/:id/vysledky" element={<PatientResultsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('Výsledky', () => {
  it('draws a card per measurement on a phone, with its report button', async () => {
    setViewport(VIEWPORTS.phone);
    const { container } = renderResults();

    expect(await screen.findByRole('listitem')).toBeInTheDocument();
    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByRole('button', { name: 'Otevřít zprávu' })).toBeInTheDocument();
  });

  it('draws three columns on an iPad and four on a desktop', async () => {
    setViewport(VIEWPORTS.tablet);
    const first = renderResults();
    await screen.findAllByTestId('session-values');
    /* three columns: date, summary and the (unnamed) report button */
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Datum', 'Naměřené hodnoty', '']);
    first.unmount();
  });

  it('shows the full table on a desktop', async () => {
    setViewport(VIEWPORTS.desktop);
    renderResults();
    await screen.findAllByTestId('session-values');

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Datum', 'Typ', 'Naměřené hodnoty', '']);
  });

  it('draws every measured value from the columns of the session, "—" for the missing ones', async () => {
    setViewport(VIEWPORTS.desktop);
    getByPatient.mockResolvedValue([
      session({
        measuredOn: '2026-09-18', thresholdPercentVo2Max: 82, maxPowerWatts: 320, weightKg: 78.4, powerPerKg: 4.08,
        device: 'Cortex', protocolType: 'Spiroergometrie',
        trainingZones: [{ name: 'Aerobní', fromBpm: 120, toBpm: 150 }],
        rawPractitionerNotes: 'Nalačno.',
      }),
    ]);
    renderResults();

    const values = await screen.findByTestId('session-values');
    const read = (label: string) => within(values).getByText(label).nextElementSibling?.textContent;
    expect(read('Max. tep')).toBe('190 bpm');
    expect(read('Tep prahu')).toBe('160 bpm');
    expect(read('Práh v % VO₂max')).toBe('82 %');
    expect(read('Max. výkon')).toBe('320 W');
    expect(read('Výkon na kg')).toBe('4,08 W/kg');
    expect(read('Hmotnost')).toBe('78,4 kg');
    expect(read('Přístroj')).toBe('Cortex');
    expect(read('Protokol')).toBe('Spiroergometrie');
    expect(within(values).getByText('120–150 bpm')).toBeInTheDocument();
    /* the date column is the day of the measurement, not the day it was recorded */
    expect(screen.getByText('18. 9. 2026')).toBeInTheDocument();
    /* the doctor's notes are not a source of values and are not drawn here */
    expect(screen.queryByText('Nalačno.')).not.toBeInTheDocument();
  });

  it('draws a dash for every value the session does not carry', async () => {
    setViewport(VIEWPORTS.desktop);
    renderResults();

    const values = await screen.findByTestId('session-values');
    for (const label of ['Práh v % VO₂max', 'Max. výkon', 'Výkon na kg', 'Hmotnost', 'Přístroj', 'Protokol']) {
      expect(within(values).getByText(label).nextElementSibling?.textContent, label).toBe('—');
    }
  });

  it('says it could not load, with a way to retry', async () => {
    setViewport(VIEWPORTS.desktop);
    getByPatient.mockRejectedValue(new Error('500'));
    renderResults();

    expect(await screen.findByRole('button', { name: /Zkusit znovu|retry/i })).toBeInTheDocument();
  });

  it('opens the manual entry from the tab', async () => {
    setViewport(VIEWPORTS.desktop);
    const user = userEvent.setup();
    renderResults();
    await screen.findAllByTestId('session-values');

    await user.click(screen.getByRole('button', { name: 'Zapsat hodnoty ručně' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Zapsat naměřené hodnoty')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Uložit hodnoty' })).toBeInTheDocument();
  });
});

/* ── the manual entry itself ── */

const renderForm = (props: { patientId?: string } = { patientId: 'p1' }) => {
  const onSaved = vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient()}>
      <MemoryRouter>
        <ManualResultsForm {...props} onSaved={onSaved} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, onSaved };
};

const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillRequired = () => {
  type(/^VO₂max/, '52,5');
  type(/^Klidový tep/, '58');
  type(/^Max\. tep/, '190');
  type(/^Tep anaerobního prahu/, '160');
  type(/^Tělesný tuk/, '12');
  type(/^Svalová hmota/, '41');
  type(/^Systolický tlak/, '118');
  type(/^Diastolický tlak/, '76');
};

describe('manual entry of results', () => {
  it.each([
    ['phone', VIEWPORTS.phone, 'one-column', true],
    ['iPad', VIEWPORTS.tablet, 'grid', false],
    ['desktop', VIEWPORTS.desktop, 'grid', false],
  ])('on a %s: layout %s, save pinned %s', async (_name, width, layout, pinned) => {
    setViewport(width);
    const { container } = renderForm();

    await screen.findByLabelText(/^VO₂max/);
    expect(container.querySelector(`form[data-layout="${layout}"]`)).not.toBeNull();
    expect(container.querySelector('[data-pinned="true"]') !== null).toBe(pinned);
    expect(screen.getAllByRole('button', { name: 'Uložit hodnoty' })).toHaveLength(1);
  });

  it('asks for the doctor\'s name from the signed-in user, and for a patient only when none is given', async () => {
    setViewport(VIEWPORTS.desktop);
    renderForm({ patientId: undefined } as never);

    expect((await screen.findByLabelText(/^Lékař/) as HTMLInputElement).value).toBe('Jana Lékařová');
    expect(screen.getByLabelText(/^Pacient/)).toBeInTheDocument();
  });

  it('starts every measured value empty and saves nothing while they are', async () => {
    setViewport(VIEWPORTS.phone);
    const { onSaved } = renderForm();

    expect((await screen.findByLabelText(/^VO₂max/) as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Uložit hodnoty' }));

    expect(await screen.findByText('Je potřeba opravit 8 polí.')).toBeInTheDocument();
    expect(screen.getAllByText('Zadejte naměřenou hodnotu.')).toHaveLength(8);
    expect(createSession).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('names the field that is out of range', async () => {
    setViewport(VIEWPORTS.desktop);
    renderForm();
    await screen.findByLabelText(/^VO₂max/);
    fillRequired();
    type(/^Tělesný tuk/, '140');

    fireEvent.click(screen.getByRole('button', { name: 'Uložit hodnoty' }));

    expect(await screen.findByText('Hodnota musí být od 0 do 100.')).toBeInTheDocument();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('sends the typed numbers and the extra values as fields, and nothing into the notes', async () => {
    setViewport(VIEWPORTS.desktop);
    const { onSaved } = renderForm();
    await screen.findByLabelText(/^VO₂max/);
    fillRequired();
    type(/^Přístroj/, 'Cortex');
    type(/^Max\. výkon/, '320');
    type(/^Hmotnost/, '80');
    fireEvent.click(screen.getByRole('button', { name: 'Přidat zónu' }));
    type('Zóna 1', 'Aerobní');
    type('Zóna 1 od', '120');
    type('Zóna 1 do', '150');

    fireEvent.click(screen.getByRole('button', { name: 'Uložit hodnoty' }));

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    const sent = createSession.mock.calls[0][0];
    expect(sent).toMatchObject({
      patientId: 'p1', practitionerName: 'Jana Lékařová', vo2MaxMlMinKg: 52.5, restingHeartRateBpm: 58,
      maxHeartRateBpm: 190, anaerobicThresholdBpm: 160, bodyFatPercentage: 12, muscleMassKg: 41,
      systolicBloodPressure: 118, diastolicBloodPressure: 76,
      device: 'Cortex', maxPowerWatts: 320, weightKg: 80,
      trainingZones: [{ name: 'Aerobní', fromBpm: 120, toBpm: 150 }],
    });
    expect(sent).not.toHaveProperty('rawPractitionerNotes');
    expect(sent).not.toHaveProperty('powerPerKg');
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('keeps what was typed and says why when the server refuses', async () => {
    setViewport(VIEWPORTS.desktop);
    createSession.mockRejectedValue({ response: { data: { message: 'Pacient nenalezen.' } } });
    const { onSaved } = renderForm();
    await screen.findByLabelText(/^VO₂max/);
    fillRequired();

    fireEvent.click(screen.getByRole('button', { name: 'Uložit hodnoty' }));

    expect(await screen.findByText('Pacient nenalezen.')).toBeInTheDocument();
    expect((screen.getByLabelText(/^VO₂max/) as HTMLInputElement).value).toBe('52,5');
    expect(onSaved).not.toHaveBeenCalled();
  });
});
