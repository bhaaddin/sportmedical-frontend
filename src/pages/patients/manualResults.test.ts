/*
 * The manual entry of a measurement: what it refuses, and what it sends.
 *
 * What would have to break for these to fail: the form accepting an empty
 * value the server would refuse (a made-up zero saved as measured), losing a
 * value that has no column (it must survive in the notes and read back), or
 * sending anything but the typed numbers.
 */
import { describe, it, expect } from 'vitest';
import {
  buildExtrasBlock, buildNotes, emptyManualDraft, parseManualExtras, parseNumber, toSessionRequest,
  validateManual,
} from './manualResults';
import type { ManualDraft } from './manualResults';

const filled = (over: Partial<ManualDraft> = {}): ManualDraft => ({
  ...emptyManualDraft('p1', 'MUDr. Test', '2026-10-03'),
  restingHeartRateBpm: '58',
  maxHeartRateBpm: '190',
  vo2MaxMlMinKg: '52,5',
  anaerobicThresholdBpm: '160',
  systolicBloodPressure: '118',
  diastolicBloodPressure: '76',
  bodyFatPercentage: '12',
  muscleMassKg: '41',
  ...over,
});

describe('numbers as a doctor types them', () => {
  it('reads a decimal comma and a decimal point alike', () => {
    expect(parseNumber('52,5')).toBe(52.5);
    expect(parseNumber('52.5')).toBe(52.5);
    expect(parseNumber('  ')).toBeNull();
    expect(parseNumber('abc')).toBeNaN();
  });
});

describe('validation', () => {
  it('asks for every value the server insists on, and invents none', () => {
    const errors = validateManual(emptyManualDraft('p1', 'MUDr. Test'));

    for (const key of [
      'restingHeartRateBpm', 'maxHeartRateBpm', 'vo2MaxMlMinKg', 'anaerobicThresholdBpm',
      'systolicBloodPressure', 'diastolicBloodPressure', 'bodyFatPercentage', 'muscleMassKg',
    ]) {
      expect(errors[key], key).toBe('Zadejte naměřenou hodnotu.');
    }
  });

  it('wants the patient and the doctor', () => {
    const errors = validateManual(filled({ patientId: '', practitionerName: ' ' }));

    expect(errors.patientId).toBe('Vyberte pacienta.');
    expect(errors.practitionerName).toBe('Zadejte jméno lékaře.');
  });

  it('refuses a value outside what the server accepts', () => {
    const errors = validateManual(filled({ restingHeartRateBpm: '0', bodyFatPercentage: '140', vo2MaxMlMinKg: '101' }));

    expect(errors.restingHeartRateBpm).toMatch(/větší než 0/);
    expect(errors.bodyFatPercentage).toMatch(/od 0 do 100/);
    expect(errors.vo2MaxMlMinKg).toMatch(/od 0 do 100/);
  });

  it('refuses a diastolic pressure at or above the systolic, and a max pulse under the resting one', () => {
    const errors = validateManual(filled({ diastolicBloodPressure: '120', maxHeartRateBpm: '50' }));

    expect(errors.diastolicBloodPressure).toMatch(/nižší než systolický/);
    expect(errors.maxHeartRateBpm).toMatch(/nižší než klidový/);
  });

  it('checks the optional values only when something is typed', () => {
    expect(validateManual(filled())).toEqual({});
    const errors = validateManual(filled({ thresholdPercentVo2: '140', maxPowerW: 'x', weightKg: '10' }));

    expect(errors.thresholdPercentVo2).toBeDefined();
    expect(errors.maxPowerW).toBe('Zadejte číslo.');
    expect(errors.weightKg).toBeDefined();
  });

  it('wants a zone to have a name and a start below its end', () => {
    const errors = validateManual(filled({ zones: [{ name: '', fromBpm: '150', toBpm: '120' }] }));

    expect(errors['zone.0.name']).toBe('Pojmenujte zónu.');
    expect(errors['zone.0.range']).toMatch(/nižší než konec/);
  });
});

describe('what is sent', () => {
  it('sends exactly the typed numbers and the practitioner', () => {
    const result = toSessionRequest(filled());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request).toEqual({
      patientId: 'p1',
      practitionerName: 'MUDr. Test',
      restingHeartRateBpm: 58,
      maxHeartRateBpm: 190,
      vo2MaxMlMinKg: 52.5,
      anaerobicThresholdBpm: 160,
      systolicBloodPressure: 118,
      diastolicBloodPressure: 76,
      bodyFatPercentage: 12,
      muscleMassKg: 41,
      /* the date of the measurement is the only extra that is always there */
      rawPractitionerNotes: '[Ruční zápis]\nDatum měření: 2026-10-03',
    });
  });

  it('does not send a request while anything is wrong', () => {
    const result = toSessionRequest(filled({ vo2MaxMlMinKg: '' }));

    expect(result.ok).toBe(false);
  });
});

describe('the values that have no column', () => {
  const extras = filled({
    protocol: 'Spiroergometrie',
    device: 'Cortex MetaMax',
    weightKg: '78,4',
    thresholdPercentVo2: '82',
    maxPowerW: '320',
    powerPerKg: '4,1',
    zones: [
      { name: 'Aerobní', fromBpm: '120', toBpm: '150' },
      { name: 'Práh', fromBpm: '150', toBpm: '165' },
    ],
    notes: 'Měřeno nalačno.',
  });

  it('travel in the notes, after what the doctor wrote', () => {
    const notes = buildNotes(extras);

    expect(notes.startsWith('Měřeno nalačno.')).toBe(true);
    expect(notes).toContain('Protokol: Spiroergometrie');
    expect(notes).toContain('Přístroj: Cortex MetaMax');
    expect(notes).toContain('Max. výkon: 320 W');
    expect(notes).toContain('Zóna 1: Aerobní | 120–150 bpm');
  });

  it('read back from the notes of a stored session', () => {
    const read = parseManualExtras(buildNotes(extras));

    expect(read.freeText).toBe('Měřeno nalačno.');
    expect(Object.fromEntries(read.facts)).toMatchObject({
      'Datum měření': '2026-10-03',
      Protokol: 'Spiroergometrie',
      Hmotnost: '78,4 kg',
      Práh: '82 % VO₂max',
      'Výkon na kg': '4,1 W/kg',
      'Zóna 2': 'Práh | 150–165 bpm',
    });
  });

  it('leave a plain note alone', () => {
    expect(parseManualExtras('Jen poznámka')).toEqual({ facts: [], freeText: 'Jen poznámka' });
    expect(parseManualExtras(undefined)).toEqual({ facts: [], freeText: '' });
    expect(buildExtrasBlock(emptyManualDraft())).toBe('');
  });
});
