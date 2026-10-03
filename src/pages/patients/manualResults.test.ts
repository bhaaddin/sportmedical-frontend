/*
 * The manual entry of a measurement: what it refuses, and what it sends.
 *
 * What would have to break for these to fail: the form accepting an empty
 * value the server would refuse (a made-up zero saved as measured), writing
 * anything into the doctor's notes, sending the computed W/kg, or a PUT that
 * leaves a cleared value in place instead of clearing it.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_TRAINING_ZONES, draftFromSession, draftKeyOfServerField, emptyManualDraft, parseNumber,
  powerPerKgHint, serverFieldErrors, toSessionRequest, toUpdateRequest, validateManual,
} from './manualResults';
import type { ManualDraft } from './manualResults';
import type { DiagnosticSession } from '../../api/diagnostics';

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

  it('checks the optional values only when something is typed, with the bounds of the contract', () => {
    expect(validateManual(filled())).toEqual({});
    const errors = validateManual(filled({ thresholdPercentVo2: '140', maxPowerW: 'x', weightKg: '0' }));

    expect(errors.thresholdPercentVo2).toMatch(/od 0 do 100/);
    expect(errors.maxPowerW).toBe('Zadejte číslo.');
    expect(errors.weightKg).toMatch(/větší než 0/);
    expect(validateManual(filled({ maxPowerW: '320,5' })).maxPowerW).toBe('Zadejte celé číslo.');
    /* no invented ceiling: a heavy athlete is not refused by the client */
    expect(validateManual(filled({ weightKg: '210' }))).toEqual({});
  });

  it('wants a zone to have a name and a start below its end', () => {
    const errors = validateManual(filled({ zones: [{ name: '', fromBpm: '150', toBpm: '120', note: '' }] }));

    expect(errors['zone.0.name']).toBe('Pojmenujte zónu.');
    expect(errors['zone.0.range']).toMatch(/nižší než konec/);
  });

  it('keeps to the text limits and the number of zones of the contract', () => {
    const long = 'x'.repeat(201);
    const errors = validateManual(filled({
      device: 'x'.repeat(101),
      protocol: 'y'.repeat(101),
      zones: [{ name: 'z'.repeat(61), fromBpm: '', toBpm: '', note: long }],
    }));
    expect(errors.device).toBeDefined();
    expect(errors.protocol).toBeDefined();
    expect(errors['zone.0.name']).toMatch(/60/);
    expect(errors['zone.0.note']).toMatch(/200/);

    const many = Array.from({ length: MAX_TRAINING_ZONES + 1 }, (_, i) => ({ name: `Z${i}`, fromBpm: '', toBpm: '', note: '' }));
    expect(validateManual(filled({ zones: many })).zones).toMatch(/10/);
    expect(validateManual(filled({ zones: many.slice(0, MAX_TRAINING_ZONES) })).zones).toBeUndefined();
  });
});

describe('what is sent on create', () => {
  it('sends the typed numbers and the date, and no notes when none were written', () => {
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
      measuredOn: '2026-10-03',
    });
  });

  it('sends every extra value as its own field, and the notes only as the doctor wrote them', () => {
    const result = toSessionRequest(filled({
      protocol: 'Spiroergometrie',
      device: 'Cortex MetaMax',
      weightKg: '78,4',
      thresholdPercentVo2: '82',
      maxPowerW: '320',
      zones: [
        { name: 'Aerobní', fromBpm: '120', toBpm: '150', note: 'rozcvičení' },
        { name: 'Práh', fromBpm: '150', toBpm: '', note: '' },
      ],
      notes: '  Měřeno nalačno.  ',
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request).toMatchObject({
      protocolType: 'Spiroergometrie',
      device: 'Cortex MetaMax',
      weightKg: 78.4,
      thresholdPercentVo2Max: 82,
      maxPowerWatts: 320,
      trainingZones: [
        { name: 'Aerobní', fromBpm: 120, toBpm: 150, note: 'rozcvičení' },
        { name: 'Práh', fromBpm: 150 },
      ],
      rawPractitionerNotes: 'Měřeno nalačno.',
    });
    expect(result.request).not.toHaveProperty('powerPerKg');
    expect(JSON.stringify(result.request)).not.toContain('[Ruční zápis]');
  });

  it('omits what was not typed instead of sending a made-up zero', () => {
    const result = toSessionRequest(filled({ measuredOn: '' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const key of ['measuredOn', 'thresholdPercentVo2Max', 'maxPowerWatts', 'weightKg', 'trainingZones', 'device', 'protocolType', 'rawPractitionerNotes']) {
      expect(result.request, key).not.toHaveProperty(key);
    }
  });

  it('does not send a request while anything is wrong', () => {
    expect(toSessionRequest(filled({ vo2MaxMlMinKg: '' })).ok).toBe(false);
  });
});

describe('what is sent on update', () => {
  it('replaces the editable fields, with a cleared value as an explicit null, and no patient', () => {
    const result = toUpdateRequest(filled({ patientId: '', device: '', weightKg: '', notes: '' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request).not.toHaveProperty('patientId');
    expect(result.request).toMatchObject({
      practitionerName: 'MUDr. Test',
      measuredOn: '2026-10-03',
      device: null,
      weightKg: null,
      maxPowerWatts: null,
      thresholdPercentVo2Max: null,
      protocolType: null,
      trainingZones: [],
      rawPractitionerNotes: '',
    });
    expect(result.request).not.toHaveProperty('powerPerKg');
  });

  it('refuses the same things create refuses', () => {
    expect(toUpdateRequest(filled({ bodyFatPercentage: '' })).ok).toBe(false);
  });
});

describe('opening a stored session to edit it', () => {
  const stored = {
    id: 's1', patientId: 'p1', sessionDate: '2026-09-20T08:00:00Z', practitionerName: 'MUDr. Test',
    restingHeartRateBpm: 58, maxHeartRateBpm: 190, vo2MaxMlMinKg: 52.5, anaerobicThresholdBpm: 160,
    systolicBloodPressure: 118, diastolicBloodPressure: 76, bodyFatPercentage: 12, muscleMassKg: 41,
    requiresDoctorReview: false, createdAtUtc: '2026-09-20T08:00:00Z',
    measuredOn: '2026-09-18', thresholdPercentVo2Max: 82, maxPowerWatts: 320, weightKg: 78.4, powerPerKg: 4.08,
    device: 'Cortex', protocolType: 'Spiroergometrie', rawPractitionerNotes: 'Nalačno.',
    trainingZones: [{ name: 'Aerobní', fromBpm: 120, toBpm: 150, note: 'start' }],
  } as DiagnosticSession;

  it('prefills every field from the columns, and round-trips to the same values', () => {
    const draft = draftFromSession(stored);

    expect(draft).toMatchObject({
      patientId: 'p1', measuredOn: '2026-09-18', vo2MaxMlMinKg: '52,5', maxPowerW: '320', weightKg: '78,4',
      thresholdPercentVo2: '82', device: 'Cortex', protocol: 'Spiroergometrie', notes: 'Nalačno.',
      zones: [{ name: 'Aerobní', fromBpm: '120', toBpm: '150', note: 'start' }],
    });
    const back = toUpdateRequest(draft);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.request).toMatchObject({ vo2MaxMlMinKg: 52.5, weightKg: 78.4, maxPowerWatts: 320 });
  });

  it('leaves the fields of a session without the new columns empty', () => {
    const draft = draftFromSession({ ...stored, measuredOn: undefined, weightKg: undefined, trainingZones: undefined, device: undefined });

    expect(draft.weightKg).toBe('');
    expect(draft.measuredOn).toBe('');
    expect(draft.device).toBe('');
    expect(draft.zones).toEqual([]);
  });
});

describe('power per kg is a hint, never an input', () => {
  it('is computed from power and weight to two decimals, and absent until both are typed', () => {
    expect(powerPerKgHint('320', '78,4')).toBe(4.08);
    expect(powerPerKgHint('320', '')).toBeNull();
    expect(powerPerKgHint('', '78')).toBeNull();
    expect(powerPerKgHint('320', '0')).toBeNull();
    expect(powerPerKgHint('x', '78')).toBeNull();
  });
});

describe('a refusal of the server, shown at the field', () => {
  const refused = (data: unknown) => ({ response: { data } });

  it('maps ASP.NET validation errors onto the draft fields and the zone rows', () => {
    const { errors, message } = serverFieldErrors(refused({
      errors: {
        ThresholdPercentVo2Max: ['Práh musí být 0-100.'],
        'TrainingZones[1].Name': ['Název zóny je moc dlouhý.'],
        'trainingZones[0].fromBpm': ['Tep zóny je neplatný.'],
        WeightKg: ['Hmotnost musí být kladná.'],
      },
    }));

    expect(errors).toEqual({
      thresholdPercentVo2: 'Práh musí být 0-100.',
      'zone.1.name': 'Název zóny je moc dlouhý.',
      'zone.0.range': 'Tep zóny je neplatný.',
      weightKg: 'Hmotnost musí být kladná.',
    });
    expect(message).toBeNull();
  });

  it('reads a list of field/message pairs', () => {
    const { errors } = serverFieldErrors(refused({ errors: [{ field: 'device', message: 'Moc dlouhé.' }] }));

    expect(errors).toEqual({ device: 'Moc dlouhé.' });
  });

  it('keeps a message that belongs to no field as the message of the whole request', () => {
    expect(serverFieldErrors(refused({ message: 'Pacient nenalezen.' }))).toEqual({ errors: {}, message: 'Pacient nenalezen.' });
    expect(serverFieldErrors(refused({ errors: { Unknown: ['Divná chyba.'] } }))).toEqual({ errors: {}, message: 'Divná chyba.' });
    expect(serverFieldErrors(new Error('network'))).toEqual({ errors: {}, message: null });
  });

  it('knows where a server field lives in the draft', () => {
    expect(draftKeyOfServerField('MaxPowerWatts')).toBe('maxPowerW');
    expect(draftKeyOfServerField('protocolType')).toBe('protocol');
    expect(draftKeyOfServerField('request.rawPractitionerNotes')).toBe('notes');
    expect(draftKeyOfServerField('trainingZones[3].note')).toBe('zone.3.note');
    expect(draftKeyOfServerField('nothing')).toBeNull();
  });
});

describe('no notes block anywhere', () => {
  it('no request body of any draft contains the old "[Ruční zápis]" block', () => {
    const rich = filled({
      protocol: 'P', device: 'D', weightKg: '80', thresholdPercentVo2: '80', maxPowerW: '300', notes: 'volný text',
      zones: [{ name: 'A', fromBpm: '100', toBpm: '120', note: 'n' }],
    });
    const create = toSessionRequest(rich);
    const update = toUpdateRequest(rich);

    expect(JSON.stringify(create)).not.toMatch(/Ruční zápis/);
    expect(JSON.stringify(update)).not.toMatch(/Ruční zápis/);
    if (create.ok) expect(create.request.rawPractitionerNotes).toBe('volný text');
  });
});
