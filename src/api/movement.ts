/* ══════════════════════════════════════════════════════════════
   Pohybová analýza - the client of /api/movement (contract: sportmedical-movement/docs/CONTRACT.md, sections 3, 4, 6).

   Every answer is read through a zod schema, so a backend that drifts fails here with a clear message and not three
   components later. Parts the contract does not spell out (the shape of GET /clips/{id}, the session list, the consents,
   the admin stats) are the ASSUMPTIONS marked below - this file is the one place to adjust them.

   While `movementMock()` is on, the fixtures of src/movement/fixtures answer instead of the network (never in production
   unless somebody sets the dev flag).
   ══════════════════════════════════════════════════════════════ */
import axios from 'axios';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import client from './client';
import { movementMock } from '../movement/flags';

/* ───────────── enums ───────────── */

export const MOVEMENTS = ['running', 'drop_jump'] as const;
export const VIEWS = ['side', 'front', 'back'] as const;
export const BANDS = ['green', 'watch', 'red'] as const;
/** Fault tag list v1 (contract section 4, `faultTags.v1`). */
export const FAULT_TAGS = [
  'stiff_landing', 'knee_valgus', 'trunk_upright', 'lateral_trunk_lean', 'stance_width', 'foot_rotation',
  'asymmetric_landing', 'overstride', 'pelvic_drop', 'crossover', 'heel_strike_overstride', 'trunk_lean_running',
] as const;

export const movementSchema = z.enum(MOVEMENTS);
export const viewSchema = z.enum(VIEWS);
export const bandSchema = z.enum(BANDS);
export const faultTagSchema = z.enum(FAULT_TAGS);
export const sideSchema = z.enum(['L', 'R']);

export type Movement = z.infer<typeof movementSchema>;
export type View = z.infer<typeof viewSchema>;
export type Band = z.infer<typeof bandSchema>;
export type FaultTag = z.infer<typeof faultTagSchema>;
export type Side = z.infer<typeof sideSchema>;

/* ───────────── ClipResult (section 3) ───────────── */

const keypointSchema = z.tuple([z.number(), z.number(), z.number()]);

export const clipResultSchema = z.object({
  schemaVersion: z.literal(1),
  clipId: z.string(),
  movement: movementSchema,
  view: viewSchema,
  video: z.object({ fps: z.number(), frameCount: z.number().int(), width: z.number(), height: z.number(), durationS: z.number() }),
  versions: z.object({ pipeline: z.string(), rules: z.string(), poseModel: z.string() }),
  qa: z.object({
    passed: z.boolean(),
    usableFrameRatio: z.number(),
    meanConfidence: z.number(),
    reasons: z.array(z.object({ code: z.string(), messageKey: z.string().optional(), detail: z.string().nullish() })),
  }),
  skeleton: z.object({
    keypointSet: z.string(),
    names: z.array(z.string()),
    edges: z.array(z.tuple([z.number().int(), z.number().int()])),
    times: z.array(z.number()),
    frames: z.array(z.array(keypointSchema)),
  }),
  scale: z.object({ metersPerPixel: z.number().nullable(), source: z.enum(['marker', 'height', 'none']), disagreementPct: z.number().nullish() }),
  events: z.array(z.object({
    type: z.enum(['foot_strike', 'toe_off', 'initial_contact', 'peak_knee_flexion']),
    side: sideSchema.nullable(),
    frame: z.number().int(),
    t: z.number(),
  })),
  curves: z.record(z.string(), z.array(z.number().nullable())),
  metrics: z.array(z.object({
    id: z.string(),
    side: sideSchema.nullable(),
    value: z.number(),
    unit: z.string(),
    event: z.string().nullish(),
    frame: z.number().int().nullish(),
    normBand: z.tuple([z.number(), z.number()]).nullish(),
    asymmetryPct: z.number().nullish(),
  })),
  flags: z.array(z.object({
    id: z.string(),
    ruleId: z.string(),
    region: z.string(),
    side: sideSchema.nullable(),
    severity: z.enum(['info', 'watch', 'red']),
    evidence: z.object({
      frame: z.number().int(),
      value: z.number().nullish(),
      unit: z.string().nullish(),
      threshold: z.number().nullish(),
      normBand: z.tuple([z.number(), z.number()]).nullish(),
    }),
    sentence: z.object({ cs: z.string(), en: z.string() }),
    ruleVersion: z.string(),
  })),
  score: z.object({ band: z.enum(['green', 'watch', 'red', 'needs_review']), errorCount: z.number().int(), reasonKey: z.string().nullish() }),
});
export type ClipResult = z.infer<typeof clipResultSchema>;
export type Flag = ClipResult['flags'][number];
export type Metric = ClipResult['metrics'][number];
export type MoveEvent = ClipResult['events'][number];
export type ScoreBand = ClipResult['score']['band'];

/* ───────────── decision (section 4) ───────────── */

export const decisionInputSchema = z.object({
  action: z.enum(['accept', 'edit', 'reject']),
  band: bandSchema,
  faultTags: z.array(faultTagSchema),
  unsure: z.boolean(),
  note: z.string().max(4000),
});
export type DecisionInput = z.infer<typeof decisionInputSchema>;

/** ASSUMPTION: a stored decision adds who and when (the API appends, never edits). */
export const decisionSchema = decisionInputSchema.extend({
  id: z.string(),
  decidedBy: z.string(),
  decidedAt: z.string(),
});
export type Decision = z.infer<typeof decisionSchema>;

/* ───────────── GET /clips/{id}: status + ClipResult + decisions ───────────── */

export const CLIP_STATUSES = ['uploading', 'queued', 'processing', 'done', 'failed'] as const;
export const clipStatusSchema = z.enum(CLIP_STATUSES);
export type ClipStatus = z.infer<typeof clipStatusSchema>;

export const clipDetailSchema = z.object({
  clipId: z.string(),
  sessionId: z.string().nullish(),
  patientId: z.string().nullish(),
  movement: movementSchema,
  view: viewSchema,
  status: clipStatusSchema,
  error: z.object({ code: z.string(), message: z.string() }).nullish(),
  result: clipResultSchema.nullish(),
  decisions: z.array(decisionSchema).default([]),
});
export type ClipDetail = z.infer<typeof clipDetailSchema>;

/* ───────────── sessions ───────────── */

/** ASSUMPTION: the timeline row of a clip carries the draft score, the last decision's band and the headline metrics. */
export const clipSummarySchema = z.object({
  clipId: z.string(),
  movement: movementSchema,
  view: viewSchema,
  status: clipStatusSchema,
  score: z.object({ band: z.enum(['green', 'watch', 'red', 'needs_review']), errorCount: z.number().int() }).nullish(),
  decisionBand: bandSchema.nullish(),
  keyMetrics: z.array(z.object({ id: z.string(), side: sideSchema.nullable(), value: z.number(), unit: z.string() })).default([]),
});
export type ClipSummary = z.infer<typeof clipSummarySchema>;

export const sessionSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  date: z.string(),
  appointmentId: z.string().nullish(),
  clips: z.array(clipSummarySchema).default([]),
});
export type MovementSession = z.infer<typeof sessionSchema>;

export const newClipSchema = z.object({ clipId: z.string(), uploadUrl: z.string() });
export type NewClip = z.infer<typeof newClipSchema>;

/* ───────────── consent ───────────── */

export const CONSENT_TYPES = ['care', 'ml'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];
export const CONSENT_VERSION = '1';

/** ASSUMPTION: GET /patients/{id}/consents -> the latest state of each type; POST {type, version, given}. */
export const consentSchema = z.object({
  type: z.enum(CONSENT_TYPES),
  version: z.string(),
  given: z.boolean(),
  at: z.string().nullish(),
});
export type MovementConsent = z.infer<typeof consentSchema>;

/* ───────────── admin stats (no names) ───────────── */

/** ASSUMPTION: aggregate numbers only. */
export const adminStatsSchema = z.object({
  qa: z.object({
    total: z.number().int(),
    passed: z.number().int(),
    rejected: z.number().int(),
    reasons: z.array(z.object({ code: z.string(), count: z.number().int() })),
  }),
  consents: z.object({
    care: z.object({ given: z.number().int(), withdrawn: z.number().int() }),
    ml: z.object({ given: z.number().int(), withdrawn: z.number().int() }),
  }),
  dataset: z.object({ clips: z.number().int(), athletes: z.number().int(), labelled: z.number().int(), exported: z.number().int().optional() }),
  versions: z.object({ pipeline: z.array(z.string()), rules: z.array(z.string()), model: z.array(z.string()) }),
});
export type AdminStats = z.infer<typeof adminStatsSchema>;

/* ───────────── transport ───────────── */

const BASE = '/api/movement';

/** The API may wrap an answer as {success, data}; the contract shows it bare. Both are read. */
function unwrap(body: unknown): unknown {
  if (body !== null && typeof body === 'object' && 'success' in body && 'data' in body) return (body as { data: unknown }).data;
  return body;
}

async function mock() {
  return import('../movement/fixtures/mockApi');
}

export async function createSession(input: { patientId: string; appointmentId?: string; date: string }): Promise<MovementSession> {
  if (movementMock()) return (await mock()).createSession(input);
  const res = await client.post(`${BASE}/sessions`, input);
  return sessionSchema.parse(unwrap(res.data));
}

export async function listSessions(patientId: string): Promise<MovementSession[]> {
  if (movementMock()) return (await mock()).listSessions(patientId);
  const res = await client.get(`${BASE}/sessions`, { params: { patientId } });
  return z.array(sessionSchema).parse(unwrap(res.data));
}

export async function createClip(sessionId: string, input: { movement: Movement; view: View; markerPx?: number }): Promise<NewClip> {
  if (movementMock()) return (await mock()).createClip(sessionId, input);
  const res = await client.post(`${BASE}/sessions/${encodeURIComponent(sessionId)}/clips`, input);
  return newClipSchema.parse(unwrap(res.data));
}

/** True for an address on this API (relative, or the configured API origin): only those may receive our bearer token. */
export function isOwnApiUrl(url: string): boolean {
  if (url.startsWith('/')) return true;
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  return base !== '' && url.startsWith(base);
}

/** PUT the file to the upload target, reporting 0..1. A signed storage link gets no Authorization header. */
export async function uploadClipFile(clipId: string, uploadUrl: string, file: Blob, onProgress: (ratio: number) => void, signal?: AbortSignal): Promise<void> {
  if (movementMock()) return (await mock()).uploadClipFile(clipId, file, onProgress, signal);
  const options = {
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    timeout: 0,
    signal,
    onUploadProgress: (e: { loaded: number; total?: number }) => onProgress(e.total ? Math.min(1, e.loaded / e.total) : 0),
  };
  if (isOwnApiUrl(uploadUrl)) await client.put(uploadUrl, file, options);
  else await axios.put(uploadUrl, file, options);
  onProgress(1);
}

export async function processClip(clipId: string): Promise<void> {
  if (movementMock()) return (await mock()).processClip(clipId);
  await client.post(`${BASE}/clips/${encodeURIComponent(clipId)}/process`);
}

export async function getClip(clipId: string): Promise<ClipDetail> {
  if (movementMock()) return (await mock()).getClip(clipId);
  const res = await client.get(`${BASE}/clips/${encodeURIComponent(clipId)}`);
  return clipDetailSchema.parse(unwrap(res.data));
}

/** The video needs the bearer token, which a <video src> cannot send: fetch it as a blob and play an object URL. */
export async function getClipVideo(clipId: string): Promise<Blob | string> {
  if (movementMock()) return (await mock()).videoUrl(clipId);
  const res = await client.get(`${BASE}/clips/${encodeURIComponent(clipId)}/video`, { responseType: 'blob', timeout: 0 });
  return res.data as Blob;
}

export async function postDecision(clipId: string, input: DecisionInput): Promise<Decision> {
  const body = decisionInputSchema.parse(input);
  if (movementMock()) return (await mock()).postDecision(clipId, body);
  const res = await client.post(`${BASE}/clips/${encodeURIComponent(clipId)}/decision`, body);
  return decisionSchema.parse(unwrap(res.data));
}

export async function getReportBlob(clipId: string): Promise<Blob> {
  if (movementMock()) return (await mock()).reportBlob(clipId);
  const res = await client.get(`${BASE}/clips/${encodeURIComponent(clipId)}/report`, { responseType: 'blob', timeout: 60_000 });
  return res.data as Blob;
}

export async function getAdminStats(): Promise<AdminStats> {
  if (movementMock()) return (await mock()).adminStats();
  const res = await client.get(`${BASE}/admin/stats`);
  return adminStatsSchema.parse(unwrap(res.data));
}

export async function getConsents(patientId: string): Promise<MovementConsent[]> {
  if (movementMock()) return (await mock()).getConsents(patientId);
  const res = await client.get(`${BASE}/patients/${encodeURIComponent(patientId)}/consents`);
  return z.array(consentSchema).parse(unwrap(res.data));
}

export async function setConsent(patientId: string, type: ConsentType, given: boolean): Promise<MovementConsent[]> {
  const body = { type, version: CONSENT_VERSION, given };
  if (movementMock()) return (await mock()).setConsent(patientId, body);
  await client.post(`${BASE}/patients/${encodeURIComponent(patientId)}/consents`, body);
  return getConsents(patientId);
}

/* ───────────── react-query ───────────── */

export const movementKeys = {
  clip: (id: string) => ['movement', 'clip', id] as const,
  sessions: (patientId: string) => ['movement', 'sessions', patientId] as const,
  consents: (patientId: string) => ['movement', 'consents', patientId] as const,
  admin: ['movement', 'admin'] as const,
};

/** How often the status is asked while a clip is not finished. */
export const CLIP_POLL_MS = 2500;

/** A clip, polled while it is waiting for or in the pipeline. */
export function useClip(clipId: string | undefined) {
  return useQuery({
    queryKey: movementKeys.clip(clipId ?? ''),
    queryFn: () => getClip(clipId!),
    enabled: clipId !== undefined && clipId !== '',
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'processing' || status === 'uploading' ? CLIP_POLL_MS : false;
    },
  });
}

export function useMovementSessions(patientId: string | undefined) {
  return useQuery({
    queryKey: movementKeys.sessions(patientId ?? ''),
    queryFn: () => listSessions(patientId!),
    enabled: patientId !== undefined && patientId !== '',
  });
}

export function useMovementConsents(patientId: string | undefined) {
  return useQuery({
    queryKey: movementKeys.consents(patientId ?? ''),
    queryFn: () => getConsents(patientId!),
    enabled: patientId !== undefined && patientId !== '',
  });
}

export function useSetConsent(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { type: ConsentType; given: boolean }) => setConsent(patientId, v.type, v.given),
    onSuccess: (rows) => qc.setQueryData(movementKeys.consents(patientId), rows),
  });
}

export function useRetryProcess(clipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => processClip(clipId),
    onSuccess: () => qc.invalidateQueries({ queryKey: movementKeys.clip(clipId) }),
  });
}

export function useDecision(clipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DecisionInput) => postDecision(clipId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: movementKeys.clip(clipId) }),
  });
}

export function useAdminStats(enabled = true) {
  return useQuery({ queryKey: movementKeys.admin, queryFn: getAdminStats, enabled });
}
