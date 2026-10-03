/*
 * The Výsledky tab reads the measured values from the columns and lets a user
 * who may edit open a session in the form. At 390 / 834 / 1440.
 *
 * What would have to break for these to fail: a value parsed out of the notes
 * again, a missing value drawn as 0 instead of "—", an edit button for a user
 * who may not edit, an edit that saves as a new session.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';

const getByPatient = vi.fn();
const createSession = vi.fn();
const updateSession = vi.fn();
const listActivities = vi.fn();

vi.mock('../../../api/patients', () => ({ patientsApi: { search: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../api/diagnostics', async () => {
  const actual = await vi.importActual<typeof import('../../../api/diagnostics')>('../../../api/diagnostics');
  return { ...actual, diagnosticsApi: { getByPatient, create: createSession, update: updateSession, downloadPdf: vi.fn() } };
});
vi.mock('../../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { default: PatientResultsPage } = await import('../PatientResultsPage');

const session = (over: Record<string, unknown> = {}) => ({
  id: 's1', patientId: 'p1', sessionDate: '2026-09-20T08:00:00Z', practitionerName: 'MUDr. Test',
  restingHeartRateBpm: 58, maxHeartRateBpm: 190, vo2MaxMlMinKg: 52.5, anaerobicThresholdBpm: 160,
  systolicBloodPressure: 118, diastolicBloodPressure: 76, bodyFatPercentage: 12, muscleMassKg: 41,
  requiresDoctorReview: false, createdAtUtc: '2026-09-20T08:00:00Z', ...over,
});

const FULL = {
  measuredOn: '2026-09-18', thresholdPercentVo2Max: 82, maxPowerWatts: 320, weightKg: 78.4, powerPerKg: 4.08,
  device: 'Cortex MetaMax', protocolType: 'Spiroergometrie',
  trainingZones: [{ name: 'Aerobní', fromBpm: 120, toBpm: 150, note: 'rozcvičení' }, { name: 'Práh', toBpm: 165 }],
};

const renderResults = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter initialEntries={['/patients/p1/vysledky']}>
        <Routes>
          <Route path="/patients/:id/vysledky" element={<PatientResultsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const read = (scope: HTMLElement, label: string) => within(scope).getByText(label).nextElementSibling?.textContent;

beforeEach(() => {
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'patients.edit']));
  localStorage.setItem('user', JSON.stringify({ firstName: 'Jana', lastName: 'Lékařová' }));
  getByPatient.mockReset().mockResolvedValue([session(FULL)]);
  createSession.mockReset().mockResolvedValue(session());
  updateSession.mockReset().mockResolvedValue(session());
  listActivities.mockReset().mockResolvedValue({ activities: [] });
});

describe.each([
  ['phone', VIEWPORTS.phone],
  ['iPad', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
])('on a %s', (name, width) => {
  beforeEach(() => setViewport(width));

  it('shows every measured value from the columns, in a card on the phone and a table otherwise', async () => {
    const { container } = renderResults();
    const values = await screen.findByTestId('session-values');

    expect(read(values, 'VO₂max')).toBe('52,5 ml/kg/min');
    expect(read(values, 'Klidový tep')).toBe('58 bpm');
    expect(read(values, 'Max. tep')).toBe('190 bpm');
    expect(read(values, 'Tep prahu')).toBe('160 bpm');
    expect(read(values, 'Práh v % VO₂max')).toBe('82 %');
    expect(read(values, 'Max. výkon')).toBe('320 W');
    expect(read(values, 'Výkon na kg')).toBe('4,08 W/kg');
    expect(read(values, 'Hmotnost')).toBe('78,4 kg');
    expect(read(values, 'Tělesný tuk')).toBe('12 %');
    expect(read(values, 'Svalová hmota')).toBe('41 kg');
    expect(read(values, 'Krevní tlak')).toBe('118/76 mmHg');
    expect(read(values, 'Protokol')).toBe('Spiroergometrie');
    expect(read(values, 'Přístroj')).toBe('Cortex MetaMax');
    const zones = within(values).getByRole('list', { name: 'Tréninkové zóny' });
    expect(within(zones).getByText('120–150 bpm · rozcvičení')).toBeInTheDocument();
    expect(within(zones).getByText('do 165 bpm')).toBeInTheDocument();
    expect(screen.getByText('18. 9. 2026')).toBeInTheDocument();
    expect(container.querySelector('table') !== null).toBe(name !== 'phone');
  });

  it('draws "—" for what was not measured and never a 0', async () => {
    getByPatient.mockResolvedValue([session({ weightKg: null, maxPowerWatts: null, thresholdPercentVo2Max: null, powerPerKg: null, device: null, protocolType: null, trainingZones: null })]);
    renderResults();
    const values = await screen.findByTestId('session-values');

    for (const label of ['Práh v % VO₂max', 'Max. výkon', 'Výkon na kg', 'Hmotnost', 'Přístroj', 'Protokol']) {
      expect(read(values, label), label).toBe('—');
    }
    expect(within(values).queryByRole('list', { name: 'Tréninkové zóny' })).not.toBeInTheDocument();
    /* the values it does carry are still there */
    expect(read(values, 'VO₂max')).toBe('52,5 ml/kg/min');
  });

  it('shows nothing from the notes, even if they hold the old block', async () => {
    getByPatient.mockResolvedValue([session({ rawPractitionerNotes: 'Nalačno.\n\n[Ruční zápis]\nPřístroj: Starý\nMax. výkon: 999 W' })]);
    renderResults();
    const values = await screen.findByTestId('session-values');

    expect(read(values, 'Přístroj')).toBe('—');
    expect(read(values, 'Max. výkon')).toBe('—');
    expect(screen.queryByText(/999/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ruční zápis/)).not.toBeInTheDocument();
  });

  it('opens the session in the form, prefilled, and saves it with PUT', async () => {
    const user = userEvent.setup();
    renderResults();
    await screen.findByTestId('session-values');

    await user.click(screen.getByRole('button', { name: 'Upravit měření 18. 9. 2026' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Upravit naměřené hodnoty')).toBeInTheDocument();
    expect((within(dialog).getByLabelText(/^Max\. výkon/) as HTMLInputElement).value).toBe('320');
    fireEvent.change(within(dialog).getByLabelText(/^Hmotnost/), { target: { value: '80' } });
    await user.click(within(dialog).getByRole('button', { name: 'Uložit změny' }));

    await waitFor(() => expect(updateSession).toHaveBeenCalledTimes(1));
    expect(updateSession.mock.calls[0][0]).toBe('s1');
    expect(updateSession.mock.calls[0][1]).toMatchObject({ weightKg: 80, maxPowerWatts: 320 });
    expect(createSession).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    /* the list is read again after the save */
    await waitFor(() => expect(getByPatient.mock.calls.length).toBeGreaterThan(1));
  });

  it('offers no edit to a user who may not edit', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    renderResults();
    await screen.findByTestId('session-values');

    expect(screen.queryByRole('button', { name: /^Upravit měření/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Otevřít zprávu' })).toBeInTheDocument();
  });
});

describe('the list', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('puts the newest measurement first, by the day it was taken', async () => {
    getByPatient.mockResolvedValue([
      session({ id: 'old', measuredOn: '2026-03-01', sessionDate: '2026-10-01T08:00:00Z' }),
      session({ id: 'new', measuredOn: '2026-09-18', sessionDate: '2026-09-20T08:00:00Z' }),
    ]);
    renderResults();
    await screen.findAllByTestId('session-values');

    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(rows[1]).getByText('18. 9. 2026')).toBeInTheDocument();
    expect(within(rows[2]).getByText('1. 3. 2026')).toBeInTheDocument();
  });

  it('falls back to the day the session was recorded for an older session', async () => {
    getByPatient.mockResolvedValue([session()]);
    renderResults();
    await screen.findByTestId('session-values');

    expect(screen.getByText('20. 9. 2026')).toBeInTheDocument();
  });

  it('says there are none when there are none', async () => {
    getByPatient.mockResolvedValue([]);
    renderResults();

    expect(await screen.findByText('Zatím tu žádný výsledek není.')).toBeInTheDocument();
  });
});
