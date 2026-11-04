/* A notification of the movement module opens the movement screens, not the page the server's plain link names. */
import { MOVE_PATHS, movementEnabled } from '../flags';

interface NoteLike { kind?: string | null; type?: string | null; actionUrl?: string | null }

const PATIENT_URL = /^\/patients\/([0-9a-fA-F-]{36})\/?$/;

/**
 * Where a notification leads. "Analýza pohybu dokončena" (movement.finished) points at the patient's timeline, where the clip
 * that has just finished is the newest; "Zpráva je uložena" (movement.report_ready) keeps the link to the patient's documents.
 * Anything else, or the module switched off, keeps the address the server gave.
 */
export function notificationTarget(note: NoteLike): string | undefined {
  const url = note.actionUrl ?? undefined;
  if (url === undefined) return undefined;
  const kind = note.kind ?? note.type ?? '';
  if (kind === 'movement.finished' && movementEnabled()) {
    const m = PATIENT_URL.exec(url);
    if (m) return MOVE_PATHS.patient(m[1]);
  }
  if (kind === 'movement.report_ready') return /^\/patients\/([0-9a-fA-F-]{36})\/?$/.test(url) ? `${url.replace(/\/$/, '')}/dokumenty` : url;
  return url;
}
