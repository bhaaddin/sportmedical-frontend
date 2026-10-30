/*
 * A diagnostic session saves only values somebody typed in.
 *
 * The wizard used to open with plausible vitals already set (65 bpm, 185 bpm,
 * 120/78 mmHg, 15 % fat...) on sliders that always hold a value, and nothing
 * required them to be touched, so clicking through saved made-up numbers as
 * if they had been measured.
 *
 * What would have to break for these to fail: pre-filling a vital again,
 * letting a step with an empty vital move on, or sending something other than
 * the typed numbers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const create = vi.fn();
vi.mock('../api/diagnostics', () => ({ diagnosticsApi: { create, downloadPdf: vi.fn() } }));
const getById = vi.fn();
vi.mock('../api/patients', () => ({ patientsApi: { getById, search: vi.fn().mockResolvedValue([]) } }));
/* The page lives under the router (its shelves link to the card). */
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { default: DiagnosticForm } = await import('./DiagnosticForm');

beforeEach(() => {
  getById.mockReset().mockResolvedValue({ id: 'p1', firstName: 'Jana', lastName: 'Marková' });
  window.history.replaceState({}, '', '/diagnostics/new?patientId=p1');
  create.mockReset().mockResolvedValue({
    id: 's1', patientId: 'p1', requiresDoctorReview: false, detectedAnomaliesJson: '[]',
    restingHeartRateBpm: 58, maxHeartRateBpm: 190, vo2MaxMlMinKg: 52, anaerobicThresholdBpm: 160,
    systolicBloodPressure: 118, diastolicBloodPressure: 76, bodyFatPercentage: 12, muscleMassKg: 41,
  });
});

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Další' }));

describe('DiagnosticForm', () => {
  it('starts every vital empty and will not move on until they are filled', async () => {
    render(<DiagnosticForm />);

    await screen.findByDisplayValue(/Marková/);
    type(/Jméno praktika/, 'MUDr. Test');
    next();

    const resting = await screen.findByLabelText(/Klidová srdeční frekvence/);
    expect((resting as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(/Maximální srdeční frekvence/) as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'Další' })).toBeDisabled();

    type(/Klidová srdeční frekvence/, '58');
    type(/Maximální srdeční frekvence/, '190');
    type(/Anaerobní práh/, '160');
    expect(screen.getByRole('button', { name: 'Další' })).toBeDisabled();
    type(/VO2 Max/, '52');
    expect(screen.getByRole('button', { name: 'Další' })).toBeEnabled();
  });

  it('sends exactly the typed values', async () => {
    render(<DiagnosticForm />);

    await screen.findByDisplayValue(/Marková/);
    type(/Jméno praktika/, 'MUDr. Test');
    next();

    await screen.findByLabelText(/Klidová srdeční frekvence/);
    type(/Klidová srdeční frekvence/, '58');
    type(/Maximální srdeční frekvence/, '190');
    type(/Anaerobní práh/, '160');
    type(/VO2 Max/, '52');
    next();

    await screen.findByLabelText(/Systolický krevní tlak/);
    expect(screen.getByRole('button', { name: 'Další' })).toBeDisabled();
    type(/Systolický krevní tlak/, '118');
    type(/Diastolický krevní tlak/, '76');
    type(/Podíl tělesného tuku/, '12');
    type(/Svalová hmota/, '41');
    next();

    fireEvent.click(await screen.findByRole('button', { name: 'Odeslat relaci' }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toEqual({
      patientId: 'p1',
      practitionerName: 'MUDr. Test',
      restingHeartRateBpm: 58,
      maxHeartRateBpm: 190,
      anaerobicThresholdBpm: 160,
      vo2MaxMlMinKg: 52,
      systolicBloodPressure: 118,
      diastolicBloodPressure: 76,
      bodyFatPercentage: 12,
      muscleMassKg: 41,
      rawPractitionerNotes: '',
    });
  });
});

/* The shelf page: the patient opened from the card is a chip in the header, and the saved session says where it now lives. */
describe('as a shelf page', () => {
  beforeEach(() => {
    getById.mockReset().mockResolvedValue({ id: 'p1', firstName: 'Jana', lastName: 'Marková' });
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    window.history.replaceState({}, '', '/diagnostics/new?patientId=p1');
  });

  it('names the patient it was opened for, as a link to their card', async () => {
    render(<DiagnosticForm />);
    expect(await screen.findByRole('link', { name: /Jana Marková/ })).toHaveAttribute('href', '/patients/p1');
    expect(screen.getByRole('region', { name: 'Pacient a lékař' })).toBeInTheDocument();
  });

  it('after saving: the metrics as cards and the way to the patient results', async () => {
    render(<DiagnosticForm />);
    type(/Jméno praktika/, 'MUDr. Test');
    next();
    await screen.findByLabelText(/Klidová srdeční frekvence/);
    type(/Klidová srdeční frekvence/, '58');
    type(/Maximální srdeční frekvence/, '190');
    type(/Anaerobní práh/, '160');
    type(/VO2 Max/, '52');
    next();
    await screen.findByLabelText(/Systolický krevní tlak/);
    type(/Systolický krevní tlak/, '118');
    type(/Diastolický krevní tlak/, '76');
    type(/Podíl tělesného tuku/, '12');
    type(/Svalová hmota/, '41');
    next();
    expect(within(await screen.findByRole('region', { name: 'Shrnutí' })).getAllByRole('listitem').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Odeslat relaci' }));

    const after = await screen.findByRole('region', { name: 'Po uložení' });
    expect(within(after).getByRole('link', { name: /Výsledky pacienta/ })).toHaveAttribute('href', '/patients/p1/vysledky');
    expect(within(screen.getByRole('region', { name: 'Metriky relace' })).getAllByRole('listitem')).toHaveLength(7);
  });

  it('keeps the patient when another session is started', async () => {
    render(<DiagnosticForm />);
    type(/Jméno praktika/, 'MUDr. Test');
    next();
    await screen.findByLabelText(/Klidová srdeční frekvence/);
    type(/Klidová srdeční frekvence/, '58');
    type(/Maximální srdeční frekvence/, '190');
    type(/Anaerobní práh/, '160');
    type(/VO2 Max/, '52');
    next();
    await screen.findByLabelText(/Systolický krevní tlak/);
    type(/Systolický krevní tlak/, '118');
    type(/Diastolický krevní tlak/, '76');
    type(/Podíl tělesného tuku/, '12');
    type(/Svalová hmota/, '41');
    next();
    fireEvent.click(await screen.findByRole('button', { name: 'Odeslat relaci' }));
    fireEvent.click(await screen.findByRole('button', { name: /Vytvořit další relaci/ }));
    expect(await screen.findByDisplayValue(/Marková/)).toBeInTheDocument();
  });
});
