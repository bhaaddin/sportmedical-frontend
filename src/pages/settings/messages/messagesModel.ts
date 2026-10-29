/*
 * Zprávy - the pure parts: how an alarm is worded, how templates are grouped, which placeholders a NEW message may use.
 * Nothing here talks to the server.
 */
import type { EmailPlaceholder, EmailTemplate, SendTarget, TemplateAudience } from '../../../api/emailTemplates';
import { BookingApiError } from '../../../api/apiError';

/** Czech plural: 1 -> one, 2-4 -> few, else many. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  return n >= 2 && n <= 4 ? few : many;
}

/** "1 den předem", "3 hodiny předem", "V čase události" - how far ahead a calendar alarm rings, said plainly. */
export function alarmLabel(minutes: number): string {
  if (minutes <= 0) return 'V čase události';
  if (minutes % 10080 === 0) {
    const n = minutes / 10080;
    return `${n} ${plural(n, 'týden', 'týdny', 'týdnů')} předem`;
  }
  if (minutes % 1440 === 0) {
    const n = minutes / 1440;
    return `${n} ${plural(n, 'den', 'dny', 'dní')} předem`;
  }
  if (minutes % 60 === 0) {
    const n = minutes / 60;
    return `${n} ${plural(n, 'hodina', 'hodiny', 'hodin')} předem`;
  }
  return `${minutes} ${plural(minutes, 'minuta', 'minuty', 'minut')} předem`;
}

/** The leads offered by "Přidat" - the choice, not a rule: any value in the server's bounds is kept as it is. */
export const ALARM_PRESETS: readonly number[] = [10080, 2880, 1440, 180, 60, 30, 15, 0];

/** Longest first, no repeats - the order the chips are drawn and saved in. */
export function normaliseAlarms(minutes: readonly number[]): number[] {
  return [...new Set(minutes)].sort((a, b) => b - a);
}

export const AUDIENCE_LABEL: Record<TemplateAudience, string> = { patient: 'Pacient', club: 'Klub', any: 'Pacient i klub' };

/** Built-in templates split into the two groups the page shows. */
export function groupBuiltIn(templates: readonly EmailTemplate[]): { patients: EmailTemplate[]; clubs: EmailTemplate[] } {
  const builtIn = templates.filter((template) => !template.isCustom);
  return {
    patients: builtIn.filter((template) => template.audience !== 'club'),
    clubs: builtIn.filter((template) => template.audience === 'club'),
  };
}

export const customOnly = (templates: readonly EmailTemplate[]): EmailTemplate[] => templates.filter((template) => template.isCustom);

/** Custom templates a patient (or a club) may be sent: its own audience, or "any". */
export function sendableTo(templates: readonly EmailTemplate[], kind: 'patient' | 'club'): EmailTemplate[] {
  return customOnly(templates).filter((template) => template.audience === kind || template.audience === 'any');
}

/*
 * The placeholders a NEW custom message may use (messages contract: the server fills these for every custom message; the
 * clinic's own data is `klinika.*`). Once the message is saved the server's own list for it is used instead.
 */
const ph = (key: string, description: string, sample: string): EmailPlaceholder => ({ key, description, sample, isHtml: false });
const RECIPIENT = ph('prijemce.jmeno', 'Jméno příjemce', 'Jana');
const PATIENT = [ph('pacient.jmeno', 'Jméno pacienta', 'Jana'), ph('pacient.prijmeni', 'Příjmení pacienta', 'Nováková')];
const CLUB = [ph('klub.nazev', 'Název klubu', 'FC Sparta')];

export function placeholdersFor(audience: TemplateAudience): EmailPlaceholder[] {
  if (audience === 'patient') return [RECIPIENT, ...PATIENT];
  if (audience === 'club') return [RECIPIENT, ...CLUB];
  return [RECIPIENT];
}

/** The server does not know the route yet (backend not deployed): a calm notice, not an error. */
export function isNotDeployed(error: unknown): boolean {
  return error instanceof BookingApiError && error.kind === 'notFound';
}

export const NOT_DEPLOYED_TEXT = 'Server tuto funkci zatím nemá. Zprávy půjde upravovat, jakmile se nasadí nová verze.';

/**
 * The hours as typed, or null when the text is not a whole number. `parseInt` read "12.5" as 12 and "1e1" as 1 and saved
 * that silently; the field says what it takes.
 */
export function wholeHours(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) && Number.isSafeInteger(Number(trimmed)) ? Number(trimmed) : null;
}

export type MessageTarget = { kind: 'patient'; id: string } | { kind: 'club'; id: string };

/** What the API takes, from the page's target and the "including players" box. */
export function toSendTarget(target: MessageTarget, includePlayers: boolean): SendTarget {
  return target.kind === 'club' ? { kind: 'club', id: target.id, includePlayers } : { kind: 'patient', id: target.id };
}
