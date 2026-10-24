/*
 * What the audit log screen reads out of an entry.
 *
 * The screen was written against `beforeState` / `afterState` and a fixed list of action names
 * ("Create", "Update", ...). The API sends `oldValue` / `newValue` and dotted action names
 * (`settings.changed`, `account.session_created`) - measured against the dev API on 2026-10-20:
 * 100 of 100 entries carried oldValue/newValue, none carried beforeState, so no row could be
 * expanded, every chip was grey and not one of the counters ever drew.
 */
import type { EntityKind, EntityRef } from '../ui/shelf/entities';

export type ActionTone = 'green' | 'blue' | 'red' | 'beige' | 'grey' | 'primary';

export interface AuditRow {
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  beforeState?: unknown;
  afterState?: unknown;
}

/** A value as the server stored it: a JSON text becomes the object it holds, anything else stays. */
export function readState(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (!/^[[{]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

const present = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '' && !(typeof value === 'object' && Object.keys(value as object).length === 0);

/** The state before the change, from whichever field the entry carries; null when there is none. */
export function stateBefore(entry: AuditRow): unknown {
  const value = readState(entry.oldValue ?? entry.beforeState);
  return present(value) ? value : null;
}

/** The state after the change; null when there is none. */
export function stateAfter(entry: AuditRow): unknown {
  const value = readState(entry.newValue ?? entry.afterState);
  return present(value) ? value : null;
}

const EXACT: Record<string, ActionTone> = {
  Create: 'green',
  Update: 'blue',
  Delete: 'red',
  Sign: 'primary',
  Import: 'beige',
  Override: 'beige',
  Login: 'grey',
  Logout: 'grey',
};

/** Colour of an action: the old plain names, then by what a dotted name ends in. */
export function toneOfAction(action: string): ActionTone {
  if (EXACT[action] !== undefined) return EXACT[action];
  const name = action.toLowerCase();
  if (/(fail|denied|refus|delet|remov|revok|disabled|deactivat)/.test(name)) return 'red';
  if (/(session|login|logout|signed_in|signed_out)/.test(name)) return 'grey';
  if (/(creat|add|regist|issued|enabled|activat)/.test(name)) return 'green';
  if (/(sign|approv|publish)/.test(name)) return 'primary';
  if (/(chang|updat|sav|renam|edit|moved|reset)/.test(name)) return 'blue';
  return 'grey';
}

/** The most frequent actions, most frequent first (ties in the order first seen). */
export function topActions(entries: readonly { action: string }[], limit = 6): { action: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.action, (counts.get(entry.action) ?? 0) + 1);
  return [...counts.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/* ───────────────────────────── the subject of an entry, as a connected chip ───────────────────────────── */


/** The server's entity names that are one of the clinic's things a chip can open. Anything else stays plain text. */
const SUBJECT_KIND: Record<string, EntityKind> = {
  Patient: 'patient',
  Invoice: 'invoice',
  Club: 'club',
  ClubOrder: 'order',
  ClinicService: 'service',
  Activity: 'activity',
};

/**
 * The thing an entry is about, when it is one a chip can open: the kind from the entry's `entity`, the label the first
 * eight characters of its id (what the row always showed - never a name the log does not carry, never an identifier of
 * a person). `null` for a setting, an account, a session ... and for an entry without an id.
 */
export function auditSubject(entry: { entity?: string | null; entityId?: string | null }): EntityRef | null {
  const kind = entry.entity ? SUBJECT_KIND[entry.entity] : undefined;
  const id = entry.entityId?.trim() ?? '';
  if (kind === undefined || id === '') return null;
  return { kind, id, label: id.slice(0, 8) };
}
