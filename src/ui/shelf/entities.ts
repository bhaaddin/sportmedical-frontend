/*
 * The things the clinic is made of, and where each one lives.
 *
 * Every connected chip, every "Související" row, every recent and pinned entry and every command-palette result is an
 * `EntityRef`: a kind, an id and a DISPLAY LABEL - nothing else that identifies a person. No birth number, no insurance
 * number, no e-mail, no telephone ever travels in a ref (it is stored in the browser and handed to the router). The
 * router `state` carries ids only, never a name.
 *
 * Pure: no React, no network. `entityTarget` is the one place that knows the address of an entity; a page that links to a
 * patient never writes `/patients/${id}` itself.
 */
import type { Permission } from '../../auth/usePermission';

export type EntityKind = 'patient' | 'club' | 'order' | 'appointment' | 'invoice' | 'document' | 'service' | 'activity' | 'calendar' | 'worker';

export const ENTITY_KINDS: readonly EntityKind[] = ['patient', 'club', 'order', 'appointment', 'invoice', 'document', 'service', 'activity', 'calendar', 'worker'];

export interface EntityRef {
  kind: EntityKind;
  id: string;
  /** What to call it on screen ("Jana Marková", "FC Sparta", "FA-2026-014"). Never an identifier of a person. */
  label: string;
  /** An appointment's calendar: the address of one appointment needs it. */
  calendarId?: string;
  /** A document's patient: a document lives on its patient's card. */
  patientId?: string;
}

/** The Czech name of each kind, as a chip's small caption and a palette group say it. */
export const ENTITY_LABEL: Record<EntityKind, string> = {
  patient: 'Pacient',
  club: 'Klub',
  order: 'Objednávka klubu',
  appointment: 'Termín',
  invoice: 'Faktura',
  document: 'Dokument',
  service: 'Služba',
  activity: 'Činnost',
  calendar: 'Kalendář',
  /** A staff member: their login account is the employee (Uživatelé a práva). */
  worker: 'Zaměstnanec',
};

/** The plural, for a palette group heading and a "zobrazit vše" label. */
export const ENTITY_PLURAL: Record<EntityKind, string> = {
  patient: 'Pacienti',
  club: 'Kluby',
  order: 'Objednávky klubů',
  appointment: 'Termíny',
  invoice: 'Faktury',
  document: 'Dokumenty',
  service: 'Služby',
  activity: 'Činnosti',
  calendar: 'Kalendáře',
  worker: 'Zaměstnanci',
};

/** The permission the screen behind a kind asks for. `null`: any signed-in person. The server refuses regardless; this hides. */
export const ENTITY_PERMISSION: Record<EntityKind, Permission | null> = {
  patient: 'patients.view',
  club: null,
  order: null,
  appointment: null,
  invoice: 'billing.manage',
  document: 'patients.view',
  service: 'settings.clinic.manage',
  activity: 'settings.clinic.manage',
  calendar: 'settings.clinic.manage',
  worker: 'users.manage',
};

export interface EntityTarget {
  to: string;
  /** Router state (ids only) the destination reads once: `invoiceId` for Fakturace, `openOrderId` for Objednávky klubů. */
  state?: Record<string, unknown>;
}

const seg = (value: string): string => encodeURIComponent(value);

/** Where one entity is opened. Never throws; an entity that cannot be placed exactly lands on its list. */
export function entityTarget(ref: Pick<EntityRef, 'kind' | 'id' | 'calendarId' | 'patientId'>): EntityTarget {
  switch (ref.kind) {
    case 'patient':
      return { to: `/patients/${seg(ref.id)}` };
    case 'club':
      return { to: `/clubs/${seg(ref.id)}` };
    case 'order':
      return { to: '/clubs/objednavky', state: { openOrderId: ref.id } };
    case 'appointment':
      return ref.calendarId ? { to: `/kalendar/${seg(ref.calendarId)}/termin/${seg(ref.id)}` } : { to: '/planovani' };
    case 'invoice':
      return { to: '/billing', state: { invoiceId: ref.id } };
    case 'document':
      return ref.patientId ? { to: `/patients/${seg(ref.patientId)}/dokumenty` } : { to: '/patients' };
    case 'service':
      return { to: `/nastaveni/sluzby/${seg(ref.id)}` };
    case 'activity':
      return { to: '/activities' };
    case 'calendar':
      /* Kalendáře scrolls to that calendar and marks it (`openCalendarId`, read once). */
      return { to: '/calendars', state: { openCalendarId: ref.id } };
    case 'worker':
      /* Uživatelé a práva marks the account given in `?user=` (an id, never a name). */
      return { to: `/staff-management?user=${seg(ref.id)}` };
  }
}

/** The list a kind's "zobrazit vše" opens. */
export function entityListPath(kind: EntityKind): string {
  switch (kind) {
    case 'patient': return '/patients';
    case 'club': return '/clubs';
    case 'order': return '/clubs/objednavky';
    case 'appointment': return '/dnes';
    case 'invoice': return '/billing';
    case 'document': return '/patients';
    case 'service': return '/nastaveni/sluzby';
    case 'activity': return '/activities';
    case 'calendar': return '/calendars';
    case 'worker': return '/staff-management';
  }
}

/** Does this person's permission list let them open the kind? */
export function mayOpen(kind: EntityKind, held: readonly string[]): boolean {
  const need = ENTITY_PERMISSION[kind];
  return need === null || held.includes(need);
}

export const refKey = (ref: Pick<EntityRef, 'kind' | 'id'>): string => `${ref.kind}:${ref.id}`;

/**
 * A label that must not be stored or shown as an entity's name: it looks like a Czech birth number (`850101/1234`,
 * `8501011234`) or - for the kinds that name a person - any long run of digits that could be an insurance number. An
 * invoice number is a long run of digits on purpose, so it is only held to the birth-number shape.
 */
const BIRTH_NUMBER = /(?:^|\D)\d{6}\s*\/\s*\d{3,4}(?:\D|$)/;
const LONG_DIGITS = /\d{9,}/;
const PERSON_KINDS: readonly EntityKind[] = ['patient', 'appointment', 'document', 'worker'];

export function looksLikeIdentifier(text: string, kind?: EntityKind): boolean {
  if (BIRTH_NUMBER.test(text)) return true;
  return (kind === undefined || PERSON_KINDS.includes(kind)) && LONG_DIGITS.test(text);
}

/** A label fit to keep: trimmed, one line, at most 80 characters, and never an identifier. Empty when there is nothing safe to keep. */
export function safeLabel(text: unknown, kind?: EntityKind): string {
  if (typeof text !== 'string') return '';
  const one = text.replace(/\s+/g, ' ').trim();
  if (one === '' || looksLikeIdentifier(one, kind)) return '';
  return one.length > 80 ? `${one.slice(0, 79)}…` : one;
}

/** A ref read back from anywhere (storage, a router state): a good one, or null. Unknown kinds and empty ids are junk. */
export function readRef(raw: unknown): EntityRef | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.kind !== 'string' || !(ENTITY_KINDS as readonly string[]).includes(r.kind)) return null;
  if (typeof r.id !== 'string' || r.id.trim() === '' || r.id.length > 80) return null;
  const label = safeLabel(r.label, r.kind as EntityKind);
  if (label === '') return null;
  const out: EntityRef = { kind: r.kind as EntityKind, id: r.id, label };
  if (typeof r.calendarId === 'string' && r.calendarId !== '' && r.calendarId.length <= 80) out.calendarId = r.calendarId;
  if (typeof r.patientId === 'string' && r.patientId !== '' && r.patientId.length <= 80) out.patientId = r.patientId;
  return out;
}
