/*
 * The in-memory stand-in for /api/movement (dev flag only, see ../flags.ts). Loaded lazily by src/api/movement.ts.
 *
 * It answers like MovementController: every staff route returns the ApiResult envelope `{success, data, message}`, and a
 * refusal throws an axios-shaped error whose body carries the stable `code` (`movement.care_consent_missing`, ...). The
 * api module reads these payloads through the same zod schemas as the real ones.
 * Any patient id gets the same three seeded sessions; what is created lives until reload.
 */
import type { ClipResult } from '../../api/movement';
import runningVideo from './running-side.webm?url';
import dropJumpVideo from './dropjump-front.webm?url';

/*
 * The two results are real pipeline output (COCO-WholeBody 133 points, 1920x1080 at 60 fps). They are big, so they are loaded
 * the first time the mock answers - never with the application's own scripts.
 */
let running: ClipResult | null = null;
let dropJump: ClipResult | null = null;
async function loadFixtures(): Promise<void> {
  if (running !== null) return;
  running = (await import('./running_side.result.json')).default as unknown as ClipResult;
  dropJump = (await import('./drop_jump_front.result.json')).default as unknown as ClipResult;
}
const build = (movement: 'running' | 'drop_jump', clipId: string): ClipResult => ({ ...(movement === 'running' ? running! : dropJump!), clipId });

/** A clip whose quality check failed: the result carries only its qa. */
const qaRejected = (): ClipResult['qa'] => ({
  passed: false, usableFrameRatio: 0.42, meanConfidence: 0.38,
  reasons: [{ code: 'low_fps', messageKey: 'movement.qa.low_fps', detail: '30 fps' }, { code: 'too_dark', messageKey: 'movement.qa.too_dark', detail: '31/255' }],
});

const delay = (ms = 120) => new Promise<void>((r) => setTimeout(r, ms));

type Movement = 'running' | 'drop_jump';
type View = 'side' | 'front' | 'back';

interface StoredDecision { id: string; action: string; band: string | null; faultTags: string[]; unsure: boolean; note: string | null; clinicianStaffId: string; decidedAt: string }
interface StoredClip {
  clipId: string; sessionId: string; patientId: string; movement: Movement; view: View;
  startedAt: number | null; uploaded: boolean; shift: number; markerPx: number | null; decisions: StoredDecision[]; createdAt: string;
}
interface StoredSession { sessionId: string; patientId: string; appointmentId: string | null; date: string; serviceItemId: string | null; clipIds: string[] }
interface StoredConsent { kind: 'care' | 'ml'; version: string; grantedAt: string; withdrawnAt: string | null; active: boolean }

const clips = new Map<string, StoredClip>();
const sessions = new Map<string, StoredSession[]>();
const consents = new Map<string, StoredConsent[]>();
let counter = 0;
const id = (p: string) => `${p}-${++counter}-${Math.random().toString(36).slice(2, 7)}`;
const STAFF = '0190a000-0000-7000-8000-00000000a1b2';

const ok = <T,>(data: T) => ({ success: true, message: '', data });

/** An axios-shaped refusal: `error.response.data.code` is what the screens read. */
function refuse(status: number, code: string, message: string): never {
  throw Object.assign(new Error(message), { isAxiosError: true, response: { status, data: { success: false, code, message } } });
}

const statusOf = (c: StoredClip): string => {
  if (c.clipId === 'fx-qa-rejected') return 'rejected';
  if (!c.uploaded) return 'uploading';
  if (c.startedAt === null) return 'uploaded';
  const age = Date.now() - c.startedAt;
  return age < 1500 ? 'queued' : age < 4000 ? 'processing' : 'done';
};

const resultFor = (c: StoredClip): ClipResult => {
  const base = build(c.movement, c.clipId);
  const metrics = c.shift === 0 ? base.metrics : base.metrics.map((m) => ({ ...m, value: Math.round((m.value + c.shift * (m.side === 'L' ? 1 : 0.6)) * 10) / 10 }));
  return { ...base, view: c.view, metrics };
};

const bandOf = (c: StoredClip): string | null => (statusOf(c) === 'done' ? resultFor(c).score.band : null);

const summary = (c: StoredClip) => {
  const status = statusOf(c);
  return {
    clipId: c.clipId, movement: c.movement, view: c.view, status, band: bandOf(c), hasDecision: c.decisions.length > 0,
    failureReason: status === 'rejected' ? 'qa_rejected' : null, createdAt: c.createdAt,
  };
};

function seed(patientId: string): StoredSession[] {
  const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  const out: StoredSession[] = [];
  for (const [i, spec] of ([[60, 4, true], [30, 2, true], [0, 0, false]] as const).entries()) {
    const sessionId = `${patientId}-s${i + 1}`;
    const clipIds: string[] = [];
    for (const [movement, view, k] of [['drop_jump', 'front', 1.5], ['running', 'side', 1]] as const) {
      const clipId = `${sessionId}-${movement}`;
      clips.set(clipId, {
        clipId, sessionId, patientId, movement, view, startedAt: 0, uploaded: true, shift: spec[1] * k, markerPx: null, createdAt: new Date(Date.now() - spec[0] * 86_400_000).toISOString(),
        decisions: spec[2] ? [{ id: id('d'), action: 'accept', band: spec[1] > 2 ? 'red' : 'watch', faultTags: [], unsure: false, note: null, clinicianStaffId: STAFF, decidedAt: new Date(Date.now() - 86_400_000).toISOString() }] : [],
      });
      clipIds.push(clipId);
    }
    out.push({ sessionId, patientId, appointmentId: null, date: day(spec[0]), serviceItemId: null, clipIds });
  }
  return out.reverse();
}

const sessionsOf = (patientId: string): StoredSession[] => {
  if (!sessions.has(patientId)) sessions.set(patientId, seed(patientId));
  return sessions.get(patientId)!;
};

/** Fixed demo clips every screen can open by address: /pohyb/klip/fx-running-side etc. */
function clipOf(clipId: string): StoredClip {
  const demo: Record<string, Movement> = { 'fx-running-side': 'running', 'fx-dropjump-front': 'drop_jump', 'fx-qa-rejected': 'running' };
  if (!clips.has(clipId) && demo[clipId]) {
    clips.set(clipId, {
      clipId, sessionId: 'fx', patientId: 'ZZ-test', movement: demo[clipId], view: clipId === 'fx-dropjump-front' ? 'front' : 'side',
      startedAt: 0, uploaded: true, shift: 0, markerPx: null, decisions: [], createdAt: new Date().toISOString(),
    });
  }
  return clips.get(clipId) ?? refuse(404, 'movement.not_found', 'The clip was not found.');
}

const consentsOf = (patientId: string): StoredConsent[] =>
  consents.get(patientId) ?? [{ kind: 'care', version: '1', grantedAt: new Date(Date.now() - 20 * 86_400_000).toISOString(), withdrawnAt: null, active: true }];

function detail(c: StoredClip) {
  const status = statusOf(c);
  const rejected = status === 'rejected';
  const qa = rejected ? qaRejected() : null;
  return {
    clipId: c.clipId, sessionId: c.sessionId, patientId: c.patientId, movement: c.movement, view: c.view, status,
    failureReason: rejected ? 'qa_rejected' : null, attemptCount: 1, hasVideo: true, qaPassed: rejected ? false : status === 'done' ? true : null,
    qa, markerPx: c.markerPx, pipelineVersion: '0.1.0', rulesVersion: c.movement === 'running' ? 'running.v1' : 'landing.v1', poseModelVersion: 'rtmpose-halpe26',
    /* a rejected clip carries a result with only its qa filled, like the callback */
    result: status === 'done' ? resultFor(c) : rejected ? { schemaVersion: 1, clipId: c.clipId, qa } : null,
    decisions: c.decisions, createdAt: c.createdAt, updatedAt: c.createdAt,
  };
}

type Options = { params?: Record<string, string>; body?: unknown };

/** The router: one entry per row of the controller. Async, like the network. */
export async function handle(verb: string, path: string, options: Options = {}): Promise<unknown> {
  await loadFixtures();
  await delay(verb === 'get' ? 60 : 120);
  const body = (options.body ?? {}) as Record<string, unknown>;
  let m: RegExpExecArray | null;

  if ((m = /^\/patients\/([^/]+)\/consents$/.exec(path)) && verb === 'get') {
    const rows = consentsOf(m[1]);
    return ok({ consents: rows, careActive: rows.some((r) => r.kind === 'care' && r.active), mlTrainingActive: rows.some((r) => r.kind === 'ml' && r.active) });
  }
  if ((m = /^\/patients\/([^/]+)\/consents\/(care|ml)$/.exec(path))) {
    const [, patientId, kind] = m;
    const rows = consentsOf(patientId);
    if (verb === 'post') {
      if (!rows.some((r) => r.kind === kind && r.active)) rows.push({ kind: kind as 'care' | 'ml', version: String(body.version ?? '1'), grantedAt: new Date().toISOString(), withdrawnAt: null, active: true });
    } else {
      const active = rows.find((r) => r.kind === kind && r.active);
      if (!active) refuse(409, 'movement.consent_not_active', 'The consent is not active.');
      active.active = false;
      active.withdrawnAt = new Date().toISOString();
    }
    consents.set(patientId, rows);
    return ok(rows.filter((r) => r.kind === kind).at(-1));
  }
  if (path === '/sessions' && verb === 'post') {
    const patientId = String(body.patientId);
    if (!consentsOf(patientId).some((r) => r.kind === 'care' && r.active)) refuse(409, 'movement.care_consent_missing', 'Care consent is missing.');
    const s: StoredSession = { sessionId: id('s'), patientId, appointmentId: (body.appointmentId as string) ?? null, date: String(body.date), serviceItemId: null, clipIds: [] };
    sessions.set(patientId, [s, ...sessionsOf(patientId)]);
    return ok({ sessionId: s.sessionId, patientId, appointmentId: s.appointmentId, date: s.date, serviceItemId: null, clips: [] });
  }
  if (path === '/sessions' && verb === 'get') {
    const patientId = options.params?.patientId ?? '';
    return ok(sessionsOf(patientId).map((s) => ({ ...s, clipIds: undefined, clips: s.clipIds.map((cid) => summary(clips.get(cid)!)) })));
  }
  if ((m = /^\/sessions\/([^/]+)\/clips$/.exec(path)) && verb === 'post') {
    const owner = [...sessions.entries()].find(([, list]) => list.some((s) => s.sessionId === m![1]));
    if (!owner) refuse(404, 'movement.not_found', 'The session was not found.');
    if (!consentsOf(owner[0]).some((r) => r.kind === 'care' && r.active)) refuse(409, 'movement.care_consent_missing', 'Care consent is missing.');
    const clipId = id('clip');
    clips.set(clipId, {
      clipId, sessionId: m[1], patientId: owner[0], movement: body.movement as Movement, view: body.view as View, startedAt: null, uploaded: false, shift: 0,
      markerPx: (body.markerPx as number) ?? null, decisions: [], createdAt: new Date().toISOString(),
    });
    owner[1].find((s) => s.sessionId === m![1])!.clipIds.push(clipId);
    return ok({ clipId, uploadUrl: `/api/movement/clips/${clipId}/upload` });
  }
  if ((m = /^\/clips\/([^/]+)\/marker$/.exec(path)) && verb === 'put') {
    const c = clipOf(m[1]);
    c.markerPx = (body.markerPx as number | null) ?? null;
    return ok({ clipId: c.clipId, markerPx: c.markerPx });
  }
  if ((m = /^\/clips\/([^/]+)\/(process|retry)$/.exec(path)) && verb === 'post') {
    const c = clipOf(m[1]);
    if (m[2] === 'process' && !c.uploaded) refuse(409, 'movement.no_upload', 'No video was uploaded.');
    c.startedAt = Date.now();
    c.uploaded = true;
    return ok({ clipId: m[1], status: 'queued' });
  }
  if ((m = /^\/clips\/([^/]+)\/anatomy$/.exec(path)) && verb === 'get') {
    const c = clipOf(m[1]);
    return ok(c.movement === 'drop_jump' ? (await import('./drop_jump_front.anatomy.json')).default : (await import('./running_side.anatomy.json')).default);
  }
  if ((m = /^\/clips\/([^/]+)$/.exec(path)) && verb === 'get') return ok(detail(clipOf(m[1])));
  if ((m = /^\/clips\/([^/]+)\/decision$/.exec(path)) && verb === 'post') {
    const c = clipOf(m[1]);
    if (statusOf(c) !== 'done') refuse(409, 'movement.clip_state_invalid', 'Only a finished analysis can be decided on.');
    if (body.action !== 'reject' && !body.band) refuse(400, 'movement.band_required', 'Accept and edit need a band.');
    const d: StoredDecision = {
      id: id('d'), action: String(body.action), band: (body.band as string) ?? null, faultTags: (body.faultTags as string[]) ?? [], unsure: body.unsure === true,
      note: (body.note as string) || null, clinicianStaffId: STAFF, decidedAt: new Date().toISOString(),
    };
    c.decisions = [...c.decisions, d];
    return ok(d);
  }
  if (path === '/admin/stats' && verb === 'get') {
    return ok({
      clipsByStatus: { Done: 109, Rejected: 14, Failed: 5, Queued: 2 },
      qaOutcomes: { passed: 109, failed: 19 },
      failureReasons: { low_fps: 8, too_dark: 5, low_confidence: 4, truncated_body: 2, callback_timeout: 1 },
      resultBands: { green: 41, watch: 48, red: 20 },
      decisionsByAction: { Accept: 61, Edit: 15, Reject: 8 },
      modelVersions: { '0.1.0 / landing.v1 / rtmpose-halpe26': 62, '0.1.0 / running.v1 / rtmpose-halpe26': 47 },
      consents: { care_active: 41, care_withdrawn: 1, ml_active: 27, ml_withdrawn: 3 },
      exports: { Record_Sent: 61, Record_Failed: 2, Delete_Sent: 3 },
    });
  }
  if (path === '/admin/exports/retry-failed' && verb === 'post') return ok({ requeued: 2 });
  return refuse(404, 'movement.not_found', `No mock for ${verb} ${path}`);
}

export async function uploadClipFile(clipId: string, file: Blob, onProgress: (r: number) => void, signal?: AbortSignal): Promise<void> {
  void file;
  for (let i = 1; i <= 10; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await delay(60);
    onProgress(i / 10);
  }
  const c = clips.get(clipId);
  if (c) c.uploaded = true;
}

/* The anatomy of the two fixtures (MyoSim fit of the pipeline): json by import, the binary by URL. */
import runningAnatomyBin from './running_side.anatomy.bin?url';
import dropJumpAnatomyBin from './drop_jump_front.anatomy.bin?url';

export async function anatomyBin(clipId: string): Promise<ArrayBuffer> {
  const url = clipOf(clipId).movement === 'drop_jump' ? dropJumpAnatomyBin : runningAnatomyBin;
  return (await fetch(url)).arrayBuffer();
}

export async function videoUrl(clipId: string): Promise<string> {
  return clipOf(clipId).movement === 'drop_jump' ? dropJumpVideo : runningVideo;
}

/** A tiny but valid one-page PDF. */
export async function reportBlob(clipId: string): Promise<Blob> {
  const c = clipOf(clipId);
  if (c.decisions.length === 0) refuse(409, 'movement.no_decision', 'There is no decision yet.');
  const text = `BT /F1 18 Tf 60 760 Td (Pohybova analyza - zkusebni zprava ${clipId.slice(0, 12)}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}
