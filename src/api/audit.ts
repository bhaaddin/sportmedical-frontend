/* ══════════════════════════════════════════════════════════════
   The audit trail: who did what, to what, and when.

     GET /api/audit/search?user=&action=&entity=&from=&to=&search=&page=&pageSize=
     GET /api/audit/catalogue        the actions, entities and users it holds

   Both need settings.clinic.manage. The server masks anything that looks like
   a birth number, an insurance number, an e-mail or a phone in the values;
   this screen shows what it is given and never reads the table any other way.
   ══════════════════════════════════════════════════════════════ */
import { client } from './client';

export interface AuditEntry {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  /** Allowlisted values before the change, as JSON text; null for a create. */
  oldValue: string | null;
  /** Allowlisted values after the change, as JSON text; null for a delete. */
  newValue: string | null;
  ipAddress: string | null;
  notes: string | null;
}

export interface AuditPage {
  items: AuditEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AuditCatalogue {
  actions: string[];
  entities: string[];
  users: string[];
}

export interface AuditFilter {
  user?: string;
  action?: string;
  entity?: string;
  /** ISO date `YYYY-MM-DD`; the whole day is included. */
  from?: string;
  to?: string;
  search?: string;
}

/**
 * The query string for one search. A blank filter sends nothing for that
 * column; `to` is widened to the end of its day, because "do 25. 9." means
 * including the 25th.
 */
export function auditSearchParams(filter: AuditFilter, page: number, pageSize: number): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.user?.trim()) params.set('user', filter.user.trim());
  if (filter.action?.trim()) params.set('action', filter.action.trim());
  if (filter.entity?.trim()) params.set('entity', filter.entity.trim());
  if (filter.from) params.set('from', `${filter.from}T00:00:00Z`);
  if (filter.to) params.set('to', `${filter.to}T23:59:59Z`);
  if (filter.search?.trim()) params.set('search', filter.search.trim());
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return params;
}

export const auditApi = {
  search: async (filter: AuditFilter, page: number, pageSize: number): Promise<AuditPage> => {
    const { data } = await client.get<AuditPage>(`/api/audit/search?${auditSearchParams(filter, page, pageSize).toString()}`);
    return data;
  },

  catalogue: async (): Promise<AuditCatalogue> => {
    const { data } = await client.get<AuditCatalogue>('/api/audit/catalogue');
    return data;
  },
};

/* ── What the codes mean, for the person reading the screen ── */

const ACTION_LABELS: Record<string, string> = {
  'patient.registered': 'Pacient zaregistrován',
  'patient.address_changed': 'Změna adresy pacienta',
  'patient.identity_changed': 'Změna pojištění / identity pacienta',
  update: 'Oprava jména nebo data narození',
  'account.session_created': 'Přihlášení',
  'account.authentication_failed': 'Neúspěšné přihlášení',
  'account.second_factor_challenged': 'Vyžádán ověřovací kód',
  'account.second_factor_passed': 'Ověřovací kód přijat',
  'account.second_factor_failed': 'Špatný ověřovací kód',
  'account.second_factor_recovery_code_used': 'Použit záložní kód',
  'account.two_factor_setup_started': 'Zahájeno nastavení dvoufázového ověření',
  'account.two_factor_enabled': 'Dvoufázové ověření zapnuto',
  'account.two_factor_disabled': 'Dvoufázové ověření vypnuto',
  'account.two_factor_setup_abandoned': 'Nastavení dvoufázového ověření zrušeno',
  'account.two_factor_reset_by_admin': 'Dvoufázové ověření zrušeno správcem',
  'account.account_created': 'Účet založen',
  'account.account_activated': 'Účet aktivován (první přihlášení)',
  'account.account_activated_by_admin': 'Přístup zapnut',
  'account.account_deactivated': 'Přístup vypnut',
  'account.password_changed': 'Heslo změněno',
  'account.password_reset': 'Heslo resetováno správcem',
  'account.role_assigned': 'Změna role',
  'account.email_changed': 'Změna přihlašovacího e-mailu',
  'account.display_name_changed': 'Změna jména zaměstnance',
  'account.owner_bootstrapped': 'Založen účet vlastníka',
  'account.owner_recovered_from_console': 'Obnova vlastníka z konzole',
  'appointment.created': 'Rezervace vytvořena',
  'appointment.moved': 'Rezervace přesunuta',
  'appointment.cancelled': 'Rezervace zrušena',
  'appointment.status_changed': 'Změna stavu rezervace',
  'appointment.deleted': 'Rezervace smazána',
  'invoice.created': 'Faktura vystavena',
  'invoice.payment_recorded': 'Platba faktury zaznamenána',
  'invoice.refunded': 'Faktura vrácena',
  'invoice.status_changed': 'Změna stavu faktury',
  'payment.created': 'Platba na pokladně založena',
  'payment.completed': 'Platba přijata',
  'payment.cancelled': 'Platba stornována',
  'payment.refunded': 'Platba vrácena',
  'payment.status_changed': 'Změna stavu platby',
  'settings.changed': 'Změna nastavení',
  'settings.calendar_display_changed': 'Změna vzhledu kalendáře',
  'settings.patient_fields_changed': 'Změna zobrazených údajů o pacientovi',
  'settings.company_changed': 'Změna údajů o ordinaci',
  'document.uploaded': 'Dokument nahrán',
  'document.accepted': 'Dokument uznán',
  'document.rejected': 'Dokument odmítnut',
  'document.reclassified': 'Dokument přeřazen do jiného oboru',
  'document.moved': 'Dokument přesunut k jinému pacientovi',
  'document.invalidated': 'Dokument zneplatněn',
  'posudek.issued': 'Posudek vystaven',
  'patient.exported': 'Export údajů pacienta',
  'email_template.changed': 'Změna šablony e-mailu',
  'email_template.test_sent': 'Odeslán testovací e-mail',
};

const PERMISSION_LABELS: Record<string, string> = {
  grant: 'Oprávnění uděleno',
  revoke: 'Oprávnění odebráno',
  reset: 'Oprávnění vráceno na roli',
};

const ENTITY_LABELS: Record<string, string> = {
  Patient: 'Pacient',
  PatientResidenceAddress: 'Adresa pacienta',
  PatientAdministrativeProfile: 'Pojištění pacienta',
  PatientDocument: 'Dokument',
  UserAccount: 'Účet zaměstnance',
  Appointment: 'Rezervace',
  Invoice: 'Faktura',
  CashierTransaction: 'Platba na pokladně',
  SystemSetting: 'Nastavení',
  CompanySettings: 'Údaje o ordinaci',
  CalendarDisplaySettings: 'Vzhled kalendáře',
  PatientFieldVisibility: 'Údaje o pacientovi',
  Posudek: 'Posudek',
  EmailTemplate: 'Šablona e-mailu',
};

/** A sentence for an action code. Unknown codes come back as they are - never hidden. */
export function actionLabel(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;
  const permission = /^account\.permission\.(grant|revoke|reset):(.+)$/.exec(action);
  if (permission) return `${PERMISSION_LABELS[permission[1]]}: ${permission[2]}`;
  return action;
}

export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity;
}

/** The recorded values as rows, for the detail under an entry. */
export function parseValues(json: string | null): Array<[string, string]> {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
      key,
      value === null || value === undefined ? '—' : String(value),
    ]);
  } catch {
    return [['hodnota', json]];
  }
}
