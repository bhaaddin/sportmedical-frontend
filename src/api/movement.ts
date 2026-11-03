/* ══════════════════════════════════════════════════════════════
   Pohybová analýza - the client of /api/movement (contract: sportmedical-movement/docs/CONTRACT.md, sections 3, 4, 6).

   The real shapes are those of MovementController.cs (sportmedical-api, docs/engineering/movement-analysis.md), which is
   authoritative. Staff routes answer in the ApiResult envelope ({success, data, code}); every answer is read through a zod
   schema, so a backend that drifts fails here with a clear message and not three components later.

   While `movementMock()` is on, src/movement/fixtures/mockApi.ts answers with the same wrapped payloads instead of the
   network (never in production unless somebody sets the dev flag).
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

/** [x, y, confidence]; x and y are null when the point is unknown. */
const keypointSchema = z.tuple([z.number().nullable(), z.number().nullable(), z.number()]);

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
    /** `wholebody133` (body 17, feet 6, face 68, hands 2x21) or `halpe26`. */
    keypointSet: z.string(),
    analysisKeypointSet: z.string().optional(),
    names: z.array(z.string()),
    edges: z.array(z.tuple([z.number().int(), z.number().int()])),
    /** Half-open index ranges per region; absent for halpe26. */
    groups: z.record(z.string(), z.tuple([z.number().int(), z.number().int()])).optional(),
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
    /** The pipeline's own name of the metric, in both languages. */
    label: z.object({ cs: z.string(), en: z.string() }).nullish(),
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
  /** The MyoSim musculoskeletal fit (CONTRACT 3b): when `available`, the API serves anatomy.json and anatomy.bin. */
  anatomy: z.object({ available: z.boolean(), model: z.string().optional(), bodies: z.number().optional(), muscles: z.number().optional(), reason: z.string().nullish() }).passthrough().nullish(),
  score: z.object({ band: z.enum(['green', 'watch', 'red', 'needs_review']), errorCount: z.number().int().nullish(), watchCount: z.number().int().nullish(), redCount: z.number().int().nullish(), reasonKey: z.string().nullish() }),
});
export type ClipResult = z.infer<typeof clipResultSchema>;
export type Flag = ClipResult['flags'][number];
export type Metric = ClipResult['metrics'][number];
export type MoveEvent = ClipResult['events'][number];
export type ScoreBand = ClipResult['score']['band'];

/* ───────────── decision (section 4, MovementController.Decide) ───────────── */

/**
 * What is sent. A band is required for accept and edit (`movement.band_required`); a rejection may carry none, and then
 * sends none - the reject is the clinician saying "the machine's draft is wrong", not a rating.
 */
export const decisionInputSchema = z
  .object({
    action: z.enum(['accept', 'edit', 'reject']),
    band: bandSchema.nullish(),
    faultTags: z.array(faultTagSchema),
    unsure: z.boolean(),
    note: z.string().max(4000),
  })
  .refine((d) => d.action === 'reject' || (d.band !== null && d.band !== undefined), { path: ['band'], message: 'band required' });
export type DecisionInput = z.infer<typeof decisionInputSchema>;

/** A stored decision as the API sends it; the author is a staff id (there is no name in the answer). */
export const decisionSchema = z
  .object({
    id: z.string(),
    action: z.enum(['accept', 'edit', 'reject']),
    band: bandSchema.nullish(),
    faultTags: z.array(z.string()).default([]),
    unsure: z.boolean().default(false),
    note: z.string().nullish(),
    clinicianStaffId: z.string(),
    decidedAt: z.string(),
  })
  .transform((d) => ({
    id: d.id,
    action: d.action,
    band: d.band ?? null,
    faultTags: d.faultTags as FaultTag[],
    unsure: d.unsure,
    note: d.note ?? '',
    decidedBy: d.clinicianStaffId,
    decidedAt: d.decidedAt,
  }));
export type Decision = z.output<typeof decisionSchema>;

/* ───────────── GET /clips/{id} ───────────── */

/** `rejected` is a clip the quality check refused; the screens treat it as a failure with the code `qa_rejected`. */
export const WIRE_STATUSES = ['uploading', 'uploaded', 'queued', 'processing', 'done', 'failed', 'rejected'] as const;
export const CLIP_STATUSES = ['uploading', 'uploaded', 'queued', 'processing', 'done', 'failed'] as const;
export type ClipStatus = (typeof CLIP_STATUSES)[number];
const wireStatusSchema = z.enum(WIRE_STATUSES);
const toStatus = (s: z.infer<typeof wireStatusSchema>): ClipStatus => (s === 'rejected' ? 'failed' : s);

const qaSummarySchema = z
  .object({ reasons: z.array(z.object({ code: z.string(), messageKey: z.string().optional(), detail: z.string().nullish() })).default([]) })
  .passthrough();

export type QaReason = { code: string; messageKey?: string; detail?: string | null };

export const clipDetailSchema = z
  .object({
    clipId: z.string(),
    sessionId: z.string().nullish(),
    patientId: z.string().nullish(),
    movement: movementSchema,
    view: viewSchema,
    status: wireStatusSchema,
    failureReason: z.string().nullish(),
    attemptCount: z.number().int().optional(),
    hasVideo: z.boolean().optional(),
    qaPassed: z.boolean().nullish(),
    qa: z.unknown().optional(),
    markerPx: z.number().nullish(),
    pipelineVersion: z.string().nullish(),
    rulesVersion: z.string().nullish(),
    poseModelVersion: z.string().nullish(),
    /** The ClipResult once the clip is done; for a rejected clip only its `qa` part, so it is read strictly only when done. */
    result: z.unknown().optional(),
    decisions: z.array(decisionSchema).default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .transform((c, ctx) => {
    const wireRejected = c.status === 'rejected';
    const qa = qaSummarySchema.safeParse(c.qa ?? (c.result as { qa?: unknown } | null | undefined)?.qa);
    const reasons: QaReason[] = qa.success ? qa.data.reasons : [];
    let result: ClipResult | null = null;
    if (c.status === 'done' && c.result !== null && c.result !== undefined) {
      const parsed = clipResultSchema.safeParse(c.result);
      if (parsed.success) result = parsed.data;
      else ctx.addIssue({ code: 'custom', message: `ClipResult: ${parsed.error.issues[0]?.message ?? 'invalid'}` });
    }
    const code = c.failureReason ?? (wireRejected ? 'qa_rejected' : null);
    return {
      clipId: c.clipId,
      sessionId: c.sessionId ?? null,
      patientId: c.patientId ?? null,
      movement: c.movement,
      view: c.view,
      status: toStatus(c.status),
      error: code === null ? null : { code, message: code },
      qaReasons: reasons,
      markerPx: c.markerPx ?? null,
      result,
      decisions: c.decisions,
    };
  });
export type ClipDetail = z.output<typeof clipDetailSchema>;

/* ───────────── sessions ───────────── */

/** One clip on the timeline: the machine's band (a draft) and whether a clinician has decided. */
export const clipSummarySchema = z
  .object({
    clipId: z.string(),
    movement: movementSchema,
    view: viewSchema,
    status: wireStatusSchema,
    band: z.enum(['green', 'watch', 'red', 'needs_review']).nullish(),
    hasDecision: z.boolean().default(false),
    failureReason: z.string().nullish(),
    createdAt: z.string().optional(),
  })
  .transform((c) => ({ ...c, status: toStatus(c.status), band: c.band ?? null }));
export type ClipSummary = z.output<typeof clipSummarySchema>;

export const sessionSchema = z
  .object({
    sessionId: z.string(),
    patientId: z.string(),
    appointmentId: z.string().nullish(),
    date: z.string(),
    serviceItemId: z.string().nullish(),
    clips: z.array(clipSummarySchema).default([]),
  })
  .transform((s) => ({ id: s.sessionId, patientId: s.patientId, appointmentId: s.appointmentId ?? null, date: s.date, clips: s.clips }));
export type MovementSession = z.output<typeof sessionSchema>;

export const newClipSchema = z.object({ clipId: z.string(), uploadUrl: z.string() });
export type NewClip = z.infer<typeof newClipSchema>;

/* ───────────── consent ───────────── */

export const CONSENT_TYPES = ['care', 'ml'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** The row of one consent as the API sends it. */
const consentRowSchema = z.object({
  kind: z.enum(CONSENT_TYPES),
  version: z.string(),
  grantedAt: z.string(),
  withdrawnAt: z.string().nullish(),
  active: z.boolean(),
});
const consentStatusSchema = z.object({ consents: z.array(consentRowSchema).default([]), careActive: z.boolean(), mlTrainingActive: z.boolean() });

/** What the screens read: one line per kind - the active grant, else nothing. */
export interface MovementConsent { type: ConsentType; version: string; given: boolean; at: string | null }

export function consentsOf(payload: unknown): MovementConsent[] {
  const status = consentStatusSchema.parse(unwrap(payload));
  return CONSENT_TYPES.map((type) => {
    const active = status.consents.find((c) => c.kind === type && c.active);
    const last = [...status.consents].filter((c) => c.kind === type).sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))[0];
    return active
      ? { type, version: active.version, given: true, at: active.grantedAt }
      : { type, version: last?.version ?? '', given: false, at: last?.withdrawnAt ?? null };
  });
}

/* ───────────── admin stats: counts only ───────────── */

const counts = z.record(z.string(), z.number().int()).default({});
export const adminStatsSchema = z.object({
  clipsByStatus: counts,
  qaOutcomes: counts,
  failureReasons: counts,
  resultBands: counts,
  decisionsByAction: counts,
  modelVersions: counts,
  consents: counts,
  exports: counts,
});
export type AdminStats = z.infer<typeof adminStatsSchema>;

/* ───────────── transport ───────────── */

const BASE = '/api/movement';

/**
 * Staff routes answer in the usual ApiResult envelope. `client.ts` already unwraps `{success, data}`; this reads a payload
 * that may or may not have been unwrapped yet (the same rule as `unwrapApiResult` in bookingContracts).
 */
function unwrap(body: unknown): unknown {
  if (body !== null && typeof body === 'object' && !Array.isArray(body) && 'success' in body && 'data' in body) return (body as { data: unknown }).data;
  return body;
}

/** The stable `code` of a refusal (`movement.care_consent_missing`, ...), or null. */
export function movementErrorCode(error: unknown): string | null {
  const code = (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code;
  return typeof code === 'string' ? code : null;
}

async function mock() {
  return import('../movement/fixtures/mockApi');
}

type Verb = 'get' | 'post' | 'put' | 'delete';

/** One call: the network, or (dev flag) the fixtures answering with the same wrapped payloads. Returns the unwrapped data. */
async function call(verb: Verb, path: string, options: { params?: Record<string, string>; body?: unknown } = {}): Promise<unknown> {
  if (movementMock()) return unwrap(await (await mock()).handle(verb, path, options));
  const res = await client.request({ method: verb, url: `${BASE}${path}`, params: options.params, data: options.body });
  return unwrap(res.data);
}

export async function createSession(input: { patientId: string; appointmentId?: string; date: string }): Promise<MovementSession> {
  const data = (await call('post', '/sessions', { body: input })) as { sessionId?: string; id?: string; clips?: unknown } & Record<string, unknown>;
  /* The creation answer is the session; it may carry no clips yet. */
  return sessionSchema.parse({ clips: [], ...data, sessionId: data.sessionId ?? data.id });
}

export async function listSessions(patientId: string): Promise<MovementSession[]> {
  return z.array(sessionSchema).parse(await call('get', '/sessions', { params: { patientId } }));
}

export async function createClip(sessionId: string, input: { movement: Movement; view: View; markerPx?: number }): Promise<NewClip> {
  return newClipSchema.parse(await call('post', `/sessions/${encodeURIComponent(sessionId)}/clips`, { body: input }));
}

/** True for an address on this API (relative, or the configured API origin): only those may receive our bearer token. */
export function isOwnApiUrl(url: string): boolean {
  if (url.startsWith('/')) return true;
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  return base !== '' && url.startsWith(base);
}

/** PUT the raw file (Content-Type video/*) to the upload target, reporting 0..1. A foreign signed link gets no Authorization header. */
export async function uploadClipFile(clipId: string, uploadUrl: string, file: Blob, onProgress: (ratio: number) => void, signal?: AbortSignal): Promise<void> {
  if (movementMock()) return (await mock()).uploadClipFile(clipId, file, onProgress, signal);
  const options = {
    headers: { 'Content-Type': file.type.startsWith('video/') ? file.type : 'video/mp4' },
    timeout: 0,
    signal,
    onUploadProgress: (e: { loaded: number; total?: number }) => onProgress(e.total ? Math.min(1, e.loaded / e.total) : 0),
  };
  if (isOwnApiUrl(uploadUrl)) await client.put(uploadUrl, file, options);
  else await axios.put(uploadUrl, file, options);
  onProgress(1);
}

/** The staff-entered length of the 1 m marker in native pixels; null clears it. */
export async function setClipMarker(clipId: string, markerPx: number | null): Promise<void> {
  await call('put', `/clips/${encodeURIComponent(clipId)}/marker`, { body: { markerPx } });
}

export async function processClip(clipId: string): Promise<void> {
  await call('post', `/clips/${encodeURIComponent(clipId)}/process`);
}

/** Starts a failed or rejected clip over. */
export async function retryClip(clipId: string): Promise<void> {
  await call('post', `/clips/${encodeURIComponent(clipId)}/retry`);
}

export async function getClip(clipId: string): Promise<ClipDetail> {
  return clipDetailSchema.parse(await call('get', `/clips/${encodeURIComponent(clipId)}`));
}

/** The video needs the bearer token, which a <video src> cannot send: fetch it as a blob and play an object URL. */
export async function getClipVideo(clipId: string): Promise<Blob | string> {
  if (movementMock()) return (await mock()).videoUrl(clipId);
  const res = await client.get(`${BASE}/clips/${encodeURIComponent(clipId)}/video`, { responseType: 'blob', timeout: 0 });
  return res.data as Blob;
}

/** The anatomy description of a clip (anatomy.json): the API serves the stored file as it is, NOT in the ApiResult envelope. */
export async function getAnatomyJson(clipId: string): Promise<unknown> {
  return call('get', `/clips/${encodeURIComponent(clipId)}/anatomy`);
}

/** The anatomy numbers of a clip (anatomy.bin, application/octet-stream), fetched with the bearer token. */
export async function getAnatomyBin(clipId: string): Promise<ArrayBuffer> {
  if (movementMock()) return (await mock()).anatomyBin(clipId);
  const res = await client.get(`${BASE}/clips/${encodeURIComponent(clipId)}/anatomy.bin`, { responseType: 'arraybuffer', timeout: 60_000 });
  return res.data as ArrayBuffer;
}

export async function postDecision(clipId: string, input: DecisionInput): Promise<Decision> {
  const parsed = decisionInputSchema.parse(input);
  const body = { ...parsed, band: parsed.band ?? undefined };
  return decisionSchema.parse(await call('post', `/clips/${encodeURIComponent(clipId)}/decision`, { body }));
}

/** The athlete PDF (needs `movement.view` and `exports.download`; the server audits the download). */
export async function getReportBlob(clipId: string): Promise<Blob> {
  if (movementMock()) return (await mock()).reportBlob(clipId);
  const res = await client.get(`${BASE}/clips/${encodeURIComponent(clipId)}/report`, { responseType: 'blob', timeout: 60_000 });
  return res.data as Blob;
}

export async function getAdminStats(): Promise<AdminStats> {
  return adminStatsSchema.parse(await call('get', '/admin/stats'));
}

/** Puts failed ML-store exports back on the queue; answers how many. */
export async function retryFailedExports(): Promise<number> {
  const data = z.object({ requeued: z.number().int() }).parse(await call('post', '/admin/exports/retry-failed'));
  return data.requeued;
}

export async function getConsents(patientId: string): Promise<MovementConsent[]> {
  return consentsOf(await call('get', `/patients/${encodeURIComponent(patientId)}/consents`));
}

/** Grant (POST, with the version) or withdraw (DELETE) one consent, then read them all again. */
export async function setConsent(patientId: string, type: ConsentType, given: boolean): Promise<MovementConsent[]> {
  const path = `/patients/${encodeURIComponent(patientId)}/consents/${type}`;
  if (given) await call('post', path, { body: { version: CONSENT_VERSION } });
  else await call('delete', path);
  return getConsents(patientId);
}

/** The consent text version the screens grant; the server defaults to its own when none is sent. */
export const CONSENT_VERSION = '1';

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
      return status === 'queued' || status === 'processing' || status === 'uploading' || status === 'uploaded' ? CLIP_POLL_MS : false;
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

/** Retry a failed clip, or start an uploaded one that was never queued. */
export function useRetryProcess(clipId: string, kind: 'retry' | 'process' = 'retry') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => (kind === 'retry' ? retryClip(clipId) : processClip(clipId)),
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

export function useRetryFailedExports() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: retryFailedExports, onSuccess: () => qc.invalidateQueries({ queryKey: movementKeys.admin }) });
}
