/*
 * Manual entry of a measurement - what a doctor types when the device did not
 * hand the numbers over.
 *
 * WHAT THE SERVER STORES (`POST /api/v1/diagnostics/sessions`, the only write
 * there is - there is no update route): practitioner, resting and maximal
 * heart rate, VO₂max, the anaerobic-threshold heart rate, blood pressure, body
 * fat, muscle mass and free notes. The session date is the moment it is saved.
 *
 * WHAT THE PORTAL ALSO SHOWS and no column holds: the threshold as a share of
 * VO₂max, maximal power (W and W/kg), training zones, weight, the device, the
 * protocol type and the date of the measurement. Nothing is invented on the
 * server for them. They travel in the session's notes as a small labelled
 * block, one fact per line, so nothing the doctor typed is lost and a person
 * reading the notes can read them. `parseManualExtras` reads the block back,
 * and that is what the Výsledky tab draws. When the backend grows columns for
 * these values, only `buildNotes` / `parseManualExtras` change.
 */
import type { CreateSessionRequest } from '../../api/diagnostics';

export interface TrainingZone {
  name: string;
  /** Heart rate bounds in bpm; either may be blank. */
  fromBpm: string;
  toBpm: string;
}

/** Everything the form holds, as the text that was typed. */
export interface ManualDraft {
  patientId: string;
  practitionerName: string;
  /** yyyy-MM-dd, the day of the measurement. */
  measuredOn: string;
  protocol: string;
  device: string;
  restingHeartRateBpm: string;
  maxHeartRateBpm: string;
  vo2MaxMlMinKg: string;
  anaerobicThresholdBpm: string;
  thresholdPercentVo2: string;
  maxPowerW: string;
  powerPerKg: string;
  weightKg: string;
  bodyFatPercentage: string;
  muscleMassKg: string;
  systolicBloodPressure: string;
  diastolicBloodPressure: string;
  zones: TrainingZone[];
  notes: string;
}

export const emptyManualDraft = (patientId = '', practitionerName = '', today = ''): ManualDraft => ({
  patientId,
  practitionerName,
  measuredOn: today,
  protocol: '',
  device: '',
  restingHeartRateBpm: '',
  maxHeartRateBpm: '',
  vo2MaxMlMinKg: '',
  anaerobicThresholdBpm: '',
  thresholdPercentVo2: '',
  maxPowerW: '',
  powerPerKg: '',
  weightKg: '',
  bodyFatPercentage: '',
  muscleMassKg: '',
  systolicBloodPressure: '',
  diastolicBloodPressure: '',
  zones: [],
  notes: '',
});

/** The numbers the server insists on, with the bounds its domain enforces. */
export const REQUIRED_NUMBERS: ReadonlyArray<{
  key: keyof ManualDraft;
  label: string;
  min: number;
  max: number;
  minExclusive?: boolean;
}> = [
  { key: 'restingHeartRateBpm', label: 'Klidový tep', min: 0, max: 300, minExclusive: true },
  { key: 'maxHeartRateBpm', label: 'Max. tep', min: 0, max: 300, minExclusive: true },
  { key: 'vo2MaxMlMinKg', label: 'VO₂max', min: 0, max: 100 },
  { key: 'anaerobicThresholdBpm', label: 'Tep anaerobního prahu', min: 0, max: 300, minExclusive: true },
  { key: 'systolicBloodPressure', label: 'Systolický tlak', min: 0, max: 300, minExclusive: true },
  { key: 'diastolicBloodPressure', label: 'Diastolický tlak', min: 0, max: 200, minExclusive: true },
  { key: 'bodyFatPercentage', label: 'Tělesný tuk', min: 0, max: 100 },
  { key: 'muscleMassKg', label: 'Svalová hmota', min: 0, max: 200 },
];

/** Optional numbers: kept in the notes, so only a sane range is checked. */
export const OPTIONAL_NUMBERS: ReadonlyArray<{ key: keyof ManualDraft; label: string; min: number; max: number }> = [
  { key: 'thresholdPercentVo2', label: 'Práh v % VO₂max', min: 1, max: 100 },
  { key: 'maxPowerW', label: 'Max. výkon', min: 1, max: 3000 },
  { key: 'powerPerKg', label: 'Výkon na kg', min: 0.1, max: 10 },
  { key: 'weightKg', label: 'Hmotnost', min: 20, max: 300 },
];

/** "52,5" and "52.5" both mean 52.5; anything else is not a number. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return Number.NaN;
  return Number(t);
}

export type ManualErrors = Partial<Record<string, string>>;

export function validateManual(draft: ManualDraft): ManualErrors {
  const errors: ManualErrors = {};

  if (draft.patientId.trim() === '') errors.patientId = 'Vyberte pacienta.';
  if (draft.practitionerName.trim() === '') errors.practitionerName = 'Zadejte jméno lékaře.';

  for (const f of REQUIRED_NUMBERS) {
    const n = parseNumber(String(draft[f.key]));
    if (n === null) errors[f.key] = 'Zadejte naměřenou hodnotu.';
    else if (Number.isNaN(n)) errors[f.key] = 'Zadejte číslo.';
    else if (n < f.min || n > f.max || (f.minExclusive === true && n === f.min)) {
      errors[f.key] = f.minExclusive === true
        ? `Hodnota musí být větší než ${f.min} a nejvýše ${f.max}.`
        : `Hodnota musí být od ${f.min} do ${f.max}.`;
    }
  }

  for (const f of OPTIONAL_NUMBERS) {
    const n = parseNumber(String(draft[f.key]));
    if (n === null) continue;
    if (Number.isNaN(n)) errors[f.key] = 'Zadejte číslo.';
    else if (n < f.min || n > f.max) errors[f.key] = `Hodnota musí být od ${f.min} do ${f.max}.`;
  }

  const sys = parseNumber(draft.systolicBloodPressure);
  const dia = parseNumber(draft.diastolicBloodPressure);
  if (sys !== null && dia !== null && !Number.isNaN(sys) && !Number.isNaN(dia) && dia >= sys && errors.diastolicBloodPressure === undefined) {
    errors.diastolicBloodPressure = 'Diastolický tlak musí být nižší než systolický.';
  }
  const rest = parseNumber(draft.restingHeartRateBpm);
  const max = parseNumber(draft.maxHeartRateBpm);
  if (rest !== null && max !== null && !Number.isNaN(rest) && !Number.isNaN(max) && max < rest && errors.maxHeartRateBpm === undefined) {
    errors.maxHeartRateBpm = 'Max. tep nemůže být nižší než klidový.';
  }

  if (draft.measuredOn !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(draft.measuredOn)) {
    errors.measuredOn = 'Zadejte datum.';
  }

  draft.zones.forEach((zone, i) => {
    const from = parseNumber(zone.fromBpm);
    const to = parseNumber(zone.toBpm);
    if (zone.name.trim() === '') errors[`zone.${i}.name`] = 'Pojmenujte zónu.';
    if ((from !== null && Number.isNaN(from)) || (to !== null && Number.isNaN(to))) {
      errors[`zone.${i}.range`] = 'Zadejte čísla.';
    } else if (from !== null && to !== null && from >= to) {
      errors[`zone.${i}.range`] = 'Začátek zóny musí být nižší než konec.';
    }
  });

  return errors;
}

/* ── the block in the notes ── */

export const MANUAL_BLOCK_START = '[Ruční zápis]';

const czech = (n: number) => String(n).replace('.', ',');

/** The labelled block, or '' when none of the extra values was typed. */
export function buildExtrasBlock(draft: ManualDraft): string {
  const lines: string[] = [];
  const add = (label: string, value: string) => {
    if (value.trim() !== '') lines.push(`${label}: ${value.trim()}`);
  };
  const num = (text: string, unit: string) => {
    const n = parseNumber(text);
    return n === null || Number.isNaN(n) ? '' : `${czech(n)} ${unit}`;
  };

  add('Datum měření', draft.measuredOn);
  add('Protokol', draft.protocol);
  add('Přístroj', draft.device);
  add('Hmotnost', num(draft.weightKg, 'kg'));
  add('Práh', num(draft.thresholdPercentVo2, '% VO₂max'));
  add('Max. výkon', num(draft.maxPowerW, 'W'));
  add('Výkon na kg', num(draft.powerPerKg, 'W/kg'));
  draft.zones.forEach((zone, i) => {
    const from = parseNumber(zone.fromBpm);
    const to = parseNumber(zone.toBpm);
    const range = [from, to].every((v) => v !== null && !Number.isNaN(v))
      ? `${czech(from as number)}–${czech(to as number)} bpm`
      : from !== null && !Number.isNaN(from) ? `od ${czech(from)} bpm`
        : to !== null && !Number.isNaN(to) ? `do ${czech(to)} bpm` : '';
    add(`Zóna ${i + 1}`, `${zone.name.trim()}${range === '' ? '' : ` | ${range}`}`);
  });

  return lines.length === 0 ? '' : `${MANUAL_BLOCK_START}\n${lines.join('\n')}`;
}

/** What the doctor wrote, then the block. */
export function buildNotes(draft: ManualDraft): string {
  const block = buildExtrasBlock(draft);
  const free = draft.notes.trim();
  return [free, block].filter((part) => part !== '').join('\n\n');
}

/** The request for the one write there is, or the errors that stop it. */
export function toSessionRequest(
  draft: ManualDraft,
): { ok: true; request: CreateSessionRequest } | { ok: false; errors: ManualErrors } {
  const errors = validateManual(draft);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const n = (text: string) => parseNumber(text) as number;
  const notes = buildNotes(draft);
  return {
    ok: true,
    request: {
      patientId: draft.patientId,
      practitionerName: draft.practitionerName.trim(),
      restingHeartRateBpm: n(draft.restingHeartRateBpm),
      maxHeartRateBpm: n(draft.maxHeartRateBpm),
      vo2MaxMlMinKg: n(draft.vo2MaxMlMinKg),
      anaerobicThresholdBpm: n(draft.anaerobicThresholdBpm),
      systolicBloodPressure: n(draft.systolicBloodPressure),
      diastolicBloodPressure: n(draft.diastolicBloodPressure),
      bodyFatPercentage: n(draft.bodyFatPercentage),
      muscleMassKg: n(draft.muscleMassKg),
      ...(notes === '' ? {} : { rawPractitionerNotes: notes }),
    },
  };
}

/** The extra values of a stored session, read back from its notes. */
export interface ManualExtras {
  /** [label, value] pairs in the order they were written. */
  facts: Array<[string, string]>;
  /** The notes without the block. */
  freeText: string;
}

export function parseManualExtras(notes: string | null | undefined): ManualExtras {
  const text = notes ?? '';
  const at = text.indexOf(MANUAL_BLOCK_START);
  if (at < 0) return { facts: [], freeText: text.trim() };
  const before = text.slice(0, at).trim();
  const block = text.slice(at + MANUAL_BLOCK_START.length).split('\n');
  const facts: Array<[string, string]> = [];
  for (const line of block) {
    const cut = line.indexOf(': ');
    if (cut <= 0) continue;
    facts.push([line.slice(0, cut).trim(), line.slice(cut + 2).trim()]);
  }
  return { facts, freeText: before };
}
