import { z } from 'zod';
import client from './client';

/*
 * Diagnostic sessions (contract C-M, Etapa 3).
 *
 * The measured values a doctor types by hand live in real columns of the
 * session: the date of the measurement, the threshold as a share of VO₂max,
 * maximal power, weight, training zones, the device and the protocol type.
 * `powerPerKg` is computed by the server (power / weight) and is read-only -
 * it is never sent. `rawPractitionerNotes` is the doctor's plain free text;
 * nothing is written into it on the doctor's behalf.
 *
 * Reading is tolerant: a null or absent field means "not measured" and is
 * handed on as `undefined`; a field of the wrong type is dropped rather than
 * crashing the page that shows the other values.
 */

export interface TrainingZone {
  name: string;
  fromBpm?: number | null;
  toBpm?: number | null;
  note?: string | null;
}

/** The C-M fields, as read from the server. Every one may be absent. */
export interface SessionMeasurements {
  /** yyyy-MM-dd - the day of the measurement. */
  measuredOn?: string | null;
  thresholdPercentVo2Max?: number | null;
  maxPowerWatts?: number | null;
  weightKg?: number | null;
  /** Read-only, computed by the server; null unless power and weight are both there. */
  powerPerKg?: number | null;
  trainingZones?: TrainingZone[] | null;
  device?: string | null;
  protocolType?: string | null;
}

export interface DiagnosticSession extends SessionMeasurements {
  id: string;
  patientId: string;
  sessionDate: string;
  practitionerName: string;
  restingHeartRateBpm: number;
  maxHeartRateBpm: number;
  vo2MaxMlMinKg: number;
  anaerobicThresholdBpm: number;
  systolicBloodPressure: number;
  diastolicBloodPressure: number;
  bodyFatPercentage: number;
  muscleMassKg: number;
  rawPractitionerNotes?: string;
  detectedAnomaliesJson?: string;
  requiresDoctorReview: boolean;
  createdAtUtc: string;
}

/** What the doctor may write on a session (everything but the patient). */
export interface UpdateSessionRequest {
  practitionerName: string;
  restingHeartRateBpm: number;
  maxHeartRateBpm: number;
  vo2MaxMlMinKg: number;
  anaerobicThresholdBpm: number;
  systolicBloodPressure: number;
  diastolicBloodPressure: number;
  bodyFatPercentage: number;
  muscleMassKg: number;
  /** The doctor's own free text. Never a generated block. */
  rawPractitionerNotes?: string;
  /** Omitted on create = the day of saving. */
  measuredOn?: string | null;
  thresholdPercentVo2Max?: number | null;
  maxPowerWatts?: number | null;
  weightKg?: number | null;
  trainingZones?: TrainingZone[] | null;
  device?: string | null;
  protocolType?: string | null;
}

export interface CreateSessionRequest extends UpdateSessionRequest {
  patientId: string;
}

/* ── tolerant reading ── */

/** A value of the right type, else "not measured". */
const optional = <T extends z.ZodType>(schema: T) => schema.nullish().catch(undefined);

const zoneSchema = z.object({
  name: z.string().catch(''),
  fromBpm: optional(z.number()),
  toBpm: optional(z.number()),
  note: optional(z.string()),
});

const measurementFieldsSchema = z.object({
  measuredOn: optional(z.string()),
  thresholdPercentVo2Max: optional(z.number()),
  maxPowerWatts: optional(z.number()),
  weightKg: optional(z.number()),
  powerPerKg: optional(z.number()),
  trainingZones: z.array(z.unknown()).nullish().catch(undefined),
  device: optional(z.string()),
  protocolType: optional(z.string()),
});

/** "2026-09-20T00:00:00" and "2026-09-20" both mean the day 2026-09-20. */
function dayOnly(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m === null ? undefined : m[1];
}

/** The C-M fields of any session-shaped payload, nulls turned into "absent". */
export function readMeasurements(raw: unknown): SessionMeasurements {
  const parsed = measurementFieldsSchema.safeParse(raw ?? {});
  if (!parsed.success) return {};
  const p = parsed.data;
  const zones = (p.trainingZones ?? [])
    .map((z) => zoneSchema.safeParse(z))
    .flatMap((r) => (r.success ? [r.data] : []))
    .map((z) => ({
      name: z.name,
      ...(z.fromBpm != null ? { fromBpm: z.fromBpm } : {}),
      ...(z.toBpm != null ? { toBpm: z.toBpm } : {}),
      ...(z.note != null && z.note !== '' ? { note: z.note } : {}),
    }));
  const out: SessionMeasurements = {};
  const day = dayOnly(p.measuredOn);
  if (day !== undefined) out.measuredOn = day;
  if (p.thresholdPercentVo2Max != null) out.thresholdPercentVo2Max = p.thresholdPercentVo2Max;
  if (p.maxPowerWatts != null) out.maxPowerWatts = p.maxPowerWatts;
  if (p.weightKg != null) out.weightKg = p.weightKg;
  if (p.powerPerKg != null) out.powerPerKg = p.powerPerKg;
  if (zones.length > 0) out.trainingZones = zones;
  if (p.device != null && p.device.trim() !== '') out.device = p.device;
  if (p.protocolType != null && p.protocolType.trim() !== '') out.protocolType = p.protocolType;
  return out;
}

/** A session as the server sent it, with the C-M fields read tolerantly. */
export function readSession(raw: unknown): DiagnosticSession {
  const base = (raw ?? {}) as DiagnosticSession;
  // The old fields stay as sent; the C-M ones are replaced by their tolerant reading.
  return {
    ...base,
    measuredOn: undefined,
    thresholdPercentVo2Max: undefined,
    maxPowerWatts: undefined,
    weightKg: undefined,
    powerPerKg: undefined,
    trainingZones: undefined,
    device: undefined,
    protocolType: undefined,
    ...readMeasurements(raw),
  };
}

const unwrap = (data: unknown): unknown => {
  const d = data as { value?: unknown } | null | undefined;
  return d?.value ?? d;
};

export const diagnosticsApi = {
  create: async (data: CreateSessionRequest): Promise<DiagnosticSession> => {
    const res = await client.post('/api/v1/diagnostics/sessions', data);
    return readSession(unwrap(res.data));
  },

  /** Replaces the editable fields of a session (`PUT`, 404 when it is unknown). */
  update: async (id: string, data: UpdateSessionRequest): Promise<DiagnosticSession> => {
    const res = await client.put(`/api/v1/diagnostics/sessions/${encodeURIComponent(id)}`, data);
    return readSession(unwrap(res.data));
  },

  get: async (id: string): Promise<DiagnosticSession> => {
    const res = await client.get(`/api/v1/diagnostics/sessions/${encodeURIComponent(id)}`);
    return readSession(unwrap(res.data));
  },

  getByPatient: async (patientId: string): Promise<DiagnosticSession[]> => {
    const res = await client.get(`/api/v1/diagnostics/patients/${patientId}/sessions`);
    const list = unwrap(res.data);
    return Array.isArray(list) ? list.map(readSession) : [];
  },

  downloadPdf: async (sessionId: string): Promise<void> => {
    const res = await client.get(`/api/pdf/diagnostic-session/${sessionId}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `diagnosticka-zprava_${sessionId.slice(0, 8)}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};
