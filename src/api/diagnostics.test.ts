/*
 * Diagnostic sessions (contract C-M): the new columns are read tolerantly -
 * null or absent means "not measured" - and written to the right endpoints.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
vi.mock('./client', () => ({ default: { get, post, put }, client: { get, post, put } }));

const { diagnosticsApi, readMeasurements, readSession } = await import('./diagnostics');

const stored = {
  id: 's1', patientId: 'p1', sessionDate: '2026-09-20T08:00:00Z', practitionerName: 'MUDr. Test',
  restingHeartRateBpm: 58, maxHeartRateBpm: 190, vo2MaxMlMinKg: 52.5, anaerobicThresholdBpm: 160,
  systolicBloodPressure: 118, diastolicBloodPressure: 76, bodyFatPercentage: 12, muscleMassKg: 41,
  requiresDoctorReview: false, createdAtUtc: '2026-09-20T08:00:00Z',
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
});

describe('reading the measured columns', () => {
  it('reads every C-M field of a session', () => {
    const s = readSession({
      ...stored,
      measuredOn: '2026-09-18T00:00:00', thresholdPercentVo2Max: 82, maxPowerWatts: 320, weightKg: 78.4, powerPerKg: 4.08,
      device: 'Cortex', protocolType: 'Spiroergometrie',
      trainingZones: [{ name: 'Aerobní', fromBpm: 120, toBpm: 150, note: 'start' }, { name: 'Práh', fromBpm: null, toBpm: 165 }],
    });

    expect(s).toMatchObject({
      id: 's1', vo2MaxMlMinKg: 52.5, measuredOn: '2026-09-18', thresholdPercentVo2Max: 82, maxPowerWatts: 320,
      weightKg: 78.4, powerPerKg: 4.08, device: 'Cortex', protocolType: 'Spiroergometrie',
    });
    expect(s.trainingZones).toEqual([
      { name: 'Aerobní', fromBpm: 120, toBpm: 150, note: 'start' },
      { name: 'Práh', toBpm: 165 },
    ]);
  });

  it('treats null and absent alike: not measured', () => {
    const nulls = readSession({
      ...stored, measuredOn: null, thresholdPercentVo2Max: null, maxPowerWatts: null, weightKg: null, powerPerKg: null,
      trainingZones: null, device: null, protocolType: null,
    });
    const absent = readSession(stored);

    for (const s of [nulls, absent]) {
      expect(s.measuredOn).toBeUndefined();
      expect(s.weightKg).toBeUndefined();
      expect(s.powerPerKg).toBeUndefined();
      expect(s.trainingZones).toBeUndefined();
      expect(s.device).toBeUndefined();
      expect(s.vo2MaxMlMinKg).toBe(52.5);
    }
  });

  it('drops a field of the wrong type instead of failing the others', () => {
    const m = readMeasurements({ weightKg: 'těžký', maxPowerWatts: 300, device: 5, trainingZones: [{ name: 'A' }, 'junk'] });

    expect(m.weightKg).toBeUndefined();
    expect(m.device).toBeUndefined();
    expect(m.maxPowerWatts).toBe(300);
    expect(m.trainingZones).toEqual([{ name: 'A' }]);
  });
});

describe('the endpoints', () => {
  it('creates with POST and returns the session read tolerantly', async () => {
    post.mockResolvedValue({ data: { ...stored, weightKg: 80, device: null } });
    const body = { patientId: 'p1', practitionerName: 'MUDr. Test', restingHeartRateBpm: 58, maxHeartRateBpm: 190, vo2MaxMlMinKg: 52.5, anaerobicThresholdBpm: 160, systolicBloodPressure: 118, diastolicBloodPressure: 76, bodyFatPercentage: 12, muscleMassKg: 41, weightKg: 80 };

    const s = await diagnosticsApi.create(body);

    expect(post).toHaveBeenCalledWith('/api/v1/diagnostics/sessions', body);
    expect(s.weightKg).toBe(80);
    expect(s.device).toBeUndefined();
  });

  it('updates with PUT to the session, without a patient', async () => {
    put.mockResolvedValue({ data: { value: { ...stored, maxPowerWatts: 330 } } });
    const body = { practitionerName: 'MUDr. Test', restingHeartRateBpm: 58, maxHeartRateBpm: 190, vo2MaxMlMinKg: 52.5, anaerobicThresholdBpm: 160, systolicBloodPressure: 118, diastolicBloodPressure: 76, bodyFatPercentage: 12, muscleMassKg: 41, maxPowerWatts: 330 };

    const s = await diagnosticsApi.update('s1', body);

    expect(put).toHaveBeenCalledWith('/api/v1/diagnostics/sessions/s1', body);
    expect(s.maxPowerWatts).toBe(330);
  });

  it('gets one session and a patient\'s list, both with the new fields', async () => {
    get.mockResolvedValueOnce({ data: { ...stored, device: 'Cortex' } });
    expect((await diagnosticsApi.get('s1')).device).toBe('Cortex');
    expect(get).toHaveBeenLastCalledWith('/api/v1/diagnostics/sessions/s1');

    get.mockResolvedValueOnce({ data: [{ ...stored, weightKg: 70 }, { ...stored, id: 's2' }] });
    const list = await diagnosticsApi.getByPatient('p1');
    expect(get).toHaveBeenLastCalledWith('/api/v1/diagnostics/patients/p1/sessions');
    expect(list.map((s) => s.weightKg)).toEqual([70, undefined]);

    get.mockResolvedValueOnce({ data: null });
    expect(await diagnosticsApi.getByPatient('p1')).toEqual([]);
  });
});
