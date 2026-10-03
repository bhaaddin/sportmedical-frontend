/*
 * Manual entry of a measurement - what a doctor types when the device did not
 * hand the numbers over.
 *
 * Every value is a real field of the session (contract C-M): the numbers the
 * server insists on, and the optional ones - date of the measurement, the
 * threshold as a share of VO₂max, maximal power, weight, training zones, the
 * device and the protocol type. Nothing is written into the doctor's notes:
 * `rawPractitionerNotes` carries only what the doctor typed in the notes box.
 * Power per kg is computed by the server and is only shown here as a hint
 * (`powerPerKgHint`), never sent.
 *
 * `POST /api/v1/diagnostics/sessions` creates, `PUT .../{id}` replaces the
 * editable fields; both bodies are built here, and `serverFieldErrors` maps a
 * server refusal back onto the draft's fields.
 */
import type {
  CreateSessionRequest, DiagnosticSession, TrainingZone as ApiTrainingZone, UpdateSessionRequest,
} from '../../api/diagnostics';
import { readApiProblem } from './results/apiProblem';

/** How many training zones a session may hold (contract C-M). */
export const MAX_TRAINING_ZONES = 10;

/** Text limits of contract C-M. */
export const LIMITS = { zoneName: 60, zoneNote: 200, device: 100, protocol: 100 } as const;

export interface TrainingZone {
  name: string;
  /** Heart rate bounds in bpm; either may be blank. */
  fromBpm: string;
  toBpm: string;
  note: string;
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
  weightKg: '',
  bodyFatPercentage: '',
  muscleMassKg: '',
  systolicBloodPressure: '',
  diastolicBloodPressure: '',
  zones: [],
  notes: '',
});

const czech = (n: number) => String(n).replace('.', ',');
const asText = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? czech(n) : '');

/** The form prefilled from a stored session, to edit it. */
export function draftFromSession(session: DiagnosticSession): ManualDraft {
  return {
    patientId: session.patientId,
    practitionerName: session.practitionerName ?? '',
    measuredOn: session.measuredOn ?? '',
    protocol: session.protocolType ?? '',
    device: session.device ?? '',
    restingHeartRateBpm: asText(session.restingHeartRateBpm),
    maxHeartRateBpm: asText(session.maxHeartRateBpm),
    vo2MaxMlMinKg: asText(session.vo2MaxMlMinKg),
    anaerobicThresholdBpm: asText(session.anaerobicThresholdBpm),
    thresholdPercentVo2: asText(session.thresholdPercentVo2Max),
    maxPowerW: asText(session.maxPowerWatts),
    weightKg: asText(session.weightKg),
    bodyFatPercentage: asText(session.bodyFatPercentage),
    muscleMassKg: asText(session.muscleMassKg),
    systolicBloodPressure: asText(session.systolicBloodPressure),
    diastolicBloodPressure: asText(session.diastolicBloodPressure),
    zones: (session.trainingZones ?? []).map((z) => ({
      name: z.name,
      fromBpm: asText(z.fromBpm),
      toBpm: asText(z.toBpm),
      note: z.note ?? '',
    })),
    notes: session.rawPractitionerNotes ?? '',
  };
}

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

/** Optional numbers, with the bounds of contract C-M (and nothing stricter). */
export const OPTIONAL_NUMBERS: ReadonlyArray<{
  key: keyof ManualDraft;
  label: string;
  min: number;
  max: number;
  minExclusive?: boolean;
  integer?: boolean;
}> = [
  { key: 'thresholdPercentVo2', label: 'Práh v % VO₂max', min: 0, max: 100 },
  { key: 'maxPowerW', label: 'Max. výkon', min: 0, max: Number.POSITIVE_INFINITY, integer: true },
  { key: 'weightKg', label: 'Hmotnost', min: 0, max: Number.POSITIVE_INFINITY, minExclusive: true },
];

/** "52,5" and "52.5" both mean 52.5; anything else is not a number. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return Number.NaN;
  return Number(t);
}

/** Watts per kilo as the server computes it (2 decimals), or null while either is missing. */
export function powerPerKgHint(maxPowerW: string, weightKg: string): number | null {
  const w = parseNumber(maxPowerW);
  const kg = parseNumber(weightKg);
  if (w === null || kg === null || Number.isNaN(w) || Number.isNaN(kg) || kg <= 0 || w < 0) return null;
  return Math.round((w / kg) * 100) / 100;
}

export type ManualErrors = Partial<Record<string, string>>;

export function validateManual(draft: ManualDraft, opts: { needPatient?: boolean } = {}): ManualErrors {
  const errors: ManualErrors = {};

  if (opts.needPatient !== false && draft.patientId.trim() === '') errors.patientId = 'Vyberte pacienta.';
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
    else if (f.integer === true && !Number.isInteger(n)) errors[f.key] = 'Zadejte celé číslo.';
    else if (f.minExclusive === true && n <= f.min) errors[f.key] = `Hodnota musí být větší než ${f.min}.`;
    else if (n < f.min || n > f.max) {
      errors[f.key] = Number.isFinite(f.max) ? `Hodnota musí být od ${f.min} do ${f.max}.` : `Hodnota nesmí být menší než ${f.min}.`;
    }
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
  if (draft.device.trim().length > LIMITS.device) errors.device = `Nejvýše ${LIMITS.device} znaků.`;
  if (draft.protocol.trim().length > LIMITS.protocol) errors.protocol = `Nejvýše ${LIMITS.protocol} znaků.`;

  if (draft.zones.length > MAX_TRAINING_ZONES) errors.zones = `Nejvýše ${MAX_TRAINING_ZONES} zón.`;
  draft.zones.forEach((zone, i) => {
    const from = parseNumber(zone.fromBpm);
    const to = parseNumber(zone.toBpm);
    if (zone.name.trim() === '') errors[`zone.${i}.name`] = 'Pojmenujte zónu.';
    else if (zone.name.trim().length > LIMITS.zoneName) errors[`zone.${i}.name`] = `Nejvýše ${LIMITS.zoneName} znaků.`;
    if ((from !== null && Number.isNaN(from)) || (to !== null && Number.isNaN(to))) {
      errors[`zone.${i}.range`] = 'Zadejte čísla.';
    } else if ((from !== null && from < 0) || (to !== null && to < 0)) {
      errors[`zone.${i}.range`] = 'Tep nesmí být záporný.';
    } else if (from !== null && to !== null && from >= to) {
      errors[`zone.${i}.range`] = 'Začátek zóny musí být nižší než konec.';
    }
    if (zone.note.trim().length > LIMITS.zoneNote) errors[`zone.${i}.note`] = `Nejvýše ${LIMITS.zoneNote} znaků.`;
  });

  return errors;
}

/* ── the request bodies ── */

type Built<T> = { ok: true; request: T } | { ok: false; errors: ManualErrors };

const n = (text: string) => parseNumber(text) as number;
const numberOrNull = (text: string): number | null => {
  const v = parseNumber(text);
  return v === null || Number.isNaN(v) ? null : v;
};
const textOrNull = (text: string): string | null => (text.trim() === '' ? null : text.trim());

function zonesOf(draft: ManualDraft): ApiTrainingZone[] {
  return draft.zones.map((z) => {
    const from = numberOrNull(z.fromBpm);
    const to = numberOrNull(z.toBpm);
    const note = textOrNull(z.note);
    return {
      name: z.name.trim(),
      ...(from !== null ? { fromBpm: from } : {}),
      ...(to !== null ? { toBpm: to } : {}),
      ...(note !== null ? { note } : {}),
    };
  });
}

/** The numbers and text both bodies share. */
function commonBody(draft: ManualDraft): UpdateSessionRequest {
  return {
    practitionerName: draft.practitionerName.trim(),
    restingHeartRateBpm: n(draft.restingHeartRateBpm),
    maxHeartRateBpm: n(draft.maxHeartRateBpm),
    vo2MaxMlMinKg: n(draft.vo2MaxMlMinKg),
    anaerobicThresholdBpm: n(draft.anaerobicThresholdBpm),
    systolicBloodPressure: n(draft.systolicBloodPressure),
    diastolicBloodPressure: n(draft.diastolicBloodPressure),
    bodyFatPercentage: n(draft.bodyFatPercentage),
    muscleMassKg: n(draft.muscleMassKg),
  };
}

/**
 * `POST` body: the typed values as real fields. Optional values that were not
 * typed are left out (the date then defaults to the day of saving on the
 * server). `rawPractitionerNotes` is only the doctor's own text.
 */
export function toSessionRequest(draft: ManualDraft): Built<CreateSessionRequest> {
  const errors = validateManual(draft);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const threshold = numberOrNull(draft.thresholdPercentVo2);
  const power = numberOrNull(draft.maxPowerW);
  const weight = numberOrNull(draft.weightKg);
  const device = textOrNull(draft.device);
  const protocol = textOrNull(draft.protocol);
  const notes = draft.notes.trim();
  return {
    ok: true,
    request: {
      patientId: draft.patientId,
      ...commonBody(draft),
      ...(draft.measuredOn !== '' ? { measuredOn: draft.measuredOn } : {}),
      ...(threshold !== null ? { thresholdPercentVo2Max: threshold } : {}),
      ...(power !== null ? { maxPowerWatts: power } : {}),
      ...(weight !== null ? { weightKg: weight } : {}),
      ...(draft.zones.length > 0 ? { trainingZones: zonesOf(draft) } : {}),
      ...(device !== null ? { device } : {}),
      ...(protocol !== null ? { protocolType: protocol } : {}),
      ...(notes === '' ? {} : { rawPractitionerNotes: notes }),
    },
  };
}

/**
 * `PUT` body: replaces the editable fields, so a value the doctor cleared is
 * sent as an explicit `null` (or an empty zone list) instead of being left out.
 */
export function toUpdateRequest(draft: ManualDraft): Built<UpdateSessionRequest> {
  const errors = validateManual(draft, { needPatient: false });
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    request: {
      ...commonBody(draft),
      measuredOn: draft.measuredOn === '' ? null : draft.measuredOn,
      thresholdPercentVo2Max: numberOrNull(draft.thresholdPercentVo2),
      maxPowerWatts: numberOrNull(draft.maxPowerW),
      weightKg: numberOrNull(draft.weightKg),
      trainingZones: zonesOf(draft),
      device: textOrNull(draft.device),
      protocolType: textOrNull(draft.protocol),
      rawPractitionerNotes: draft.notes.trim(),
    },
  };
}

/* ── what the server says back ── */

const SERVER_FIELDS: Record<string, string> = {
  patientid: 'patientId',
  practitionername: 'practitionerName',
  measuredon: 'measuredOn',
  protocoltype: 'protocol',
  device: 'device',
  restingheartratebpm: 'restingHeartRateBpm',
  maxheartratebpm: 'maxHeartRateBpm',
  vo2maxmlminkg: 'vo2MaxMlMinKg',
  anaerobicthresholdbpm: 'anaerobicThresholdBpm',
  thresholdpercentvo2max: 'thresholdPercentVo2',
  maxpowerwatts: 'maxPowerW',
  weightkg: 'weightKg',
  bodyfatpercentage: 'bodyFatPercentage',
  musclemasskg: 'muscleMassKg',
  systolicbloodpressure: 'systolicBloodPressure',
  diastolicbloodpressure: 'diastolicBloodPressure',
  rawpractitionernotes: 'notes',
  trainingzones: 'zones',
};

/** The draft key a server field path points at, or null when it is none of ours. */
export function draftKeyOfServerField(path: string): string | null {
  const clean = path.replace(/^\$\.?/, '').replace(/^(request|dto|body)\./i, '');
  const zone = /^trainingzones\[(\d+)\]\.?(\w*)$/i.exec(clean);
  if (zone !== null) {
    const part = zone[2].toLowerCase();
    if (part === 'name') return `zone.${zone[1]}.name`;
    if (part === 'note') return `zone.${zone[1]}.note`;
    if (part === 'frombpm' || part === 'tobpm') return `zone.${zone[1]}.range`;
    return `zone.${zone[1]}.name`;
  }
  return SERVER_FIELDS[clean.toLowerCase()] ?? null;
}

/**
 * A refusal of the server as errors at the draft's fields. What cannot be tied
 * to a field (and the request-level message) comes back as `message`.
 */
export function serverFieldErrors(error: unknown): { errors: ManualErrors; message: string | null } {
  const problem = readApiProblem(error);
  const errors: ManualErrors = {};
  const loose: string[] = [];
  for (const [path, text] of Object.entries(problem.fields)) {
    const key = draftKeyOfServerField(path);
    if (key === null) loose.push(text);
    else if (errors[key] === undefined) errors[key] = text;
  }
  const message = Object.keys(errors).length === 0
    ? problem.message ?? loose[0] ?? null
    : loose[0] ?? null;
  return { errors, message };
}
