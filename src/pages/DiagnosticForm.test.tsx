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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const create = vi.fn();
vi.mock('../api/diagnostics', () => ({ diagnosticsApi: { create } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { default: DiagnosticForm } = await import('./DiagnosticForm');

beforeEach(() => {
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

    type(/ID pacienta/, 'p1');
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

    type(/ID pacienta/, 'p1');
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
