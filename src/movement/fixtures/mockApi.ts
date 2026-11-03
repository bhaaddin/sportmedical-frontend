/*
 * The in-memory stand-in for /api/movement (dev flag only, see ../flags.ts). Loaded lazily by src/api/movement.ts.
 * Any patient id gets the same three seeded sessions; new sessions, clips, decisions and consents live until reload.
 */
import type {
  AdminStats, ClipDetail, ClipResult, ClipSummary, ConsentType, Decision, DecisionInput, Movement, MovementConsent, MovementSession, NewClip, View,
} from '../../api/movement';
import { buildDropJumpFrontResult, buildQaRejectedResult, buildRunningSideResult } from './synth';
import runningVideo from './running-side.webm?url';
import dropJumpVideo from './dropjump-front.webm?url';

const delay = (ms = 120) => new Promise<void>((r) => setTimeout(r, ms));

interface StoredClip {
  clipId: string;
  sessionId: string;
  patientId: string;
  movement: Movement;
  view: View;
  startedAt: number | null;
  failed: boolean;
  decisions: Decision[];
  markerPx?: number;
}

const clips = new Map<string, StoredClip>();
const sessions = new Map<string, MovementSession[]>();
const consents = new Map<string, MovementConsent[]>();
let counter = 0;
const id = (p: string) => `${p}-${++counter}-${Math.random().toString(36).slice(2, 7)}`;

const resultFor = (clip: StoredClip): ClipResult => {
  if (clip.clipId === 'fx-qa-rejected') return buildQaRejectedResult(clip.clipId);
  const base = clip.movement === 'running' ? buildRunningSideResult(clip.clipId) : buildDropJumpFrontResult(clip.clipId);
  return { ...base, view: clip.view };
};

function seed(patientId: string): MovementSession[] {
  const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  const mk = (sid: string, movement: Movement, view: View, shift: number, decided: boolean): [ClipSummary, StoredClip] => {
    const clipId = `${sid}-${movement}`;
    const full = movement === 'running' ? buildRunningSideResult(clipId) : buildDropJumpFrontResult(clipId);
    const key = full.metrics.filter((m) => m.side !== null).slice(0, 6).map((m) => ({ id: m.id, side: m.side, value: Math.round((m.value + shift * (m.side === 'L' ? 1 : 0.6)) * 10) / 10, unit: m.unit }));
    const errorCount = Math.max(0, full.score.errorCount + (shift > 0 ? 1 : shift < 0 ? -1 : 0));
    const stored: StoredClip = { clipId, sessionId: sid, patientId, movement, view, startedAt: 0, failed: false, decisions: [] };
    if (decided) stored.decisions.push({ id: id('d'), action: 'accept', band: errorCount > 2 ? 'red' : 'watch', faultTags: [], unsure: false, note: '', decidedBy: 'MUDr. Zkušební', decidedAt: new Date(Date.now() - 86_400_000).toISOString() });
    return [{ clipId, movement, view, status: 'done', score: { band: full.score.band, errorCount }, decisionBand: decided ? stored.decisions[0].band : null, keyMetrics: key }, stored];
  };
  const out: MovementSession[] = [];
  for (const [i, spec] of ([[60, 4, true], [30, 2, true], [0, 0, false]] as const).entries()) {
    const sid = `${patientId}-s${i + 1}`;
    const a = mk(sid, 'drop_jump', 'front', spec[1] * 1.5, spec[2]);
    const b = mk(sid, 'running', 'side', spec[1], spec[2]);
    clips.set(a[1].clipId, a[1]);
    clips.set(b[1].clipId, b[1]);
    out.push({ id: sid, patientId, date: day(spec[0]), clips: [a[0], b[0]] });
  }
  return out.reverse();
}

const sessionsOf = (patientId: string): MovementSession[] => {
  if (!sessions.has(patientId)) sessions.set(patientId, seed(patientId));
  return sessions.get(patientId)!;
};

/** Fixed demo clips every screen can open by address: /pohyb/klip/fx-running-side etc. */
function demoClip(clipId: string): StoredClip | undefined {
  if (clipId === 'fx-running-side') return clips.get(clipId) ?? (clips.set(clipId, { clipId, sessionId: 'fx', patientId: 'demo', movement: 'running', view: 'side', startedAt: 0, failed: false, decisions: [] }), clips.get(clipId));
  if (clipId === 'fx-dropjump-front') return clips.get(clipId) ?? (clips.set(clipId, { clipId, sessionId: 'fx', patientId: 'demo', movement: 'drop_jump', view: 'front', startedAt: 0, failed: false, decisions: [] }), clips.get(clipId));
  if (clipId === 'fx-qa-rejected') return clips.get(clipId) ?? (clips.set(clipId, { clipId, sessionId: 'fx', patientId: 'demo', movement: 'running', view: 'side', startedAt: 0, failed: true, decisions: [] }), clips.get(clipId));
  return clips.get(clipId);
}

export async function createSession(input: { patientId: string; appointmentId?: string; date: string }): Promise<MovementSession> {
  await delay();
  const s: MovementSession = { id: id('s'), patientId: input.patientId, date: input.date, appointmentId: input.appointmentId ?? null, clips: [] };
  sessions.set(input.patientId, [s, ...sessionsOf(input.patientId)]);
  return s;
}

export async function listSessions(patientId: string): Promise<MovementSession[]> {
  await delay();
  return sessionsOf(patientId).map((s) => ({
    ...s,
    clips: s.clips.map((c) => {
      const st = clips.get(c.clipId);
      return st && c.status !== 'done' ? { ...c, status: statusOf(st) } : c;
    }),
  }));
}

export async function createClip(sessionId: string, input: { movement: Movement; view: View; markerPx?: number }): Promise<NewClip> {
  await delay();
  const owner = [...sessions.entries()].find(([, list]) => list.some((s) => s.id === sessionId));
  const patientId = owner?.[0] ?? 'demo';
  const clipId = id('clip');
  clips.set(clipId, { clipId, sessionId, patientId, movement: input.movement, view: input.view, startedAt: null, failed: false, decisions: [], markerPx: input.markerPx });
  const list = sessionsOf(patientId);
  const s = list.find((x) => x.id === sessionId);
  if (s) s.clips = [...s.clips, { clipId, movement: input.movement, view: input.view, status: 'uploading', score: null, decisionBand: null, keyMetrics: [] }];
  return { clipId, uploadUrl: `/api/movement/clips/${clipId}/upload` };
}

export async function uploadClipFile(_clipId: string, file: Blob, onProgress: (r: number) => void, signal?: AbortSignal): Promise<void> {
  void file;
  for (let i = 1; i <= 10; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await delay(60);
    onProgress(i / 10);
  }
}

export async function processClip(clipId: string): Promise<void> {
  await delay();
  const c = demoClip(clipId);
  if (c) { c.startedAt = Date.now(); c.failed = false; }
}

/** queued for 1.5 s, processing for 2.5 s, then done. */
function statusOf(c: StoredClip): ClipDetail['status'] {
  if (c.failed) return 'failed';
  if (c.startedAt === null) return 'uploading';
  const age = Date.now() - c.startedAt;
  return age < 1500 ? 'queued' : age < 4000 ? 'processing' : 'done';
}

export async function getClip(clipId: string): Promise<ClipDetail> {
  await delay(60);
  const c = demoClip(clipId);
  if (!c) throw Object.assign(new Error('not found'), { response: { status: 404 } });
  const status = statusOf(c);
  const base = { clipId, sessionId: c.sessionId, patientId: c.patientId, movement: c.movement, view: c.view, status, decisions: c.decisions };
  if (status === 'done') return { ...base, error: null, result: resultFor(c) };
  if (status === 'failed') return { ...base, error: { code: 'qa_rejected', message: 'QA rejected' }, result: resultFor(c) };
  return { ...base, error: null, result: null };
}

export async function videoUrl(clipId: string): Promise<string> {
  const c = demoClip(clipId);
  return c?.movement === 'drop_jump' ? dropJumpVideo : runningVideo;
}

export async function postDecision(clipId: string, input: DecisionInput): Promise<Decision> {
  await delay();
  const c = demoClip(clipId);
  if (!c) throw new Error('not found');
  const d: Decision = { ...input, id: id('d'), decidedBy: 'Vy (zkušební režim)', decidedAt: new Date().toISOString() };
  c.decisions = [...c.decisions, d];
  return d;
}

/** A tiny but valid one-page PDF. */
export async function reportBlob(clipId: string): Promise<Blob> {
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

export async function adminStats(): Promise<AdminStats> {
  await delay();
  return {
    qa: { total: 128, passed: 109, rejected: 19, reasons: [{ code: 'low_fps', count: 8 }, { code: 'too_dark', count: 5 }, { code: 'low_confidence', count: 4 }, { code: 'truncated_body', count: 2 }] },
    consents: { care: { given: 41, withdrawn: 1 }, ml: { given: 27, withdrawn: 3 } },
    dataset: { clips: 109, athletes: 27, labelled: 84, exported: 61 },
    versions: { pipeline: ['0.1.0'], rules: ['landing.v1', 'running.v1'], model: ['rtmpose-halpe26'] },
  };
}

export async function getConsents(patientId: string): Promise<MovementConsent[]> {
  await delay(60);
  return consents.get(patientId) ?? [
    { type: 'care', version: '1', given: true, at: new Date(Date.now() - 20 * 86_400_000).toISOString() },
    { type: 'ml', version: '1', given: false, at: null },
  ];
}

export async function setConsent(patientId: string, body: { type: ConsentType; version: string; given: boolean }): Promise<MovementConsent[]> {
  await delay();
  const now = await getConsents(patientId);
  const next = now.map((c) => (c.type === body.type ? { ...c, given: body.given, version: body.version, at: new Date().toISOString() } : c));
  consents.set(patientId, next);
  return next;
}
