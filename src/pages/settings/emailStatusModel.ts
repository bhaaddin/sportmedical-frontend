import type { EmailProblem } from './emailStatusApi';

/** Pure wording for the E-mail settings page. */

export const PROVIDER_NAMES: Record<string, string> = {
  smtp: 'SMTP (přímé připojení)',
  brevo: 'Brevo (přes HTTPS)',
};

export const providerName = (provider: string): string => PROVIDER_NAMES[provider] ?? provider;

export const OLD_SERVER_TEXT = 'Tato verze serveru ještě neumí e-mail přes API.';

/** A plain, conservative address check; the server checks again and is the authority. */
export function validAddress(value: string): boolean {
  const v = value.trim();
  return v.length <= 254 && /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(v);
}

export function lastSuccessText(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return 'Zatím nic neodešlo';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Zatím nic neodešlo';
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** The Czech sentence for a failed test send. */
export function testProblemText(problem: EmailProblem): string {
  switch (problem.code) {
    case 'email.not_configured':
      return 'E-mail není nastaven. Na serveru chybí klíč poskytovatele nebo adresa odesílatele.';
    case 'email.provider_rejected':
      return 'Poskytovatel e-mailu zprávu odmítl. Zkontrolujte klíč a ověřenou doménu odesílatele.';
    case 'email.timeout':
      return 'Poskytovatel e-mailu neodpověděl včas. Zkuste to za chvíli.';
    case 'email.provider_unavailable':
      return 'Poskytovatel e-mailu je teď nedostupný. Zkuste to za chvíli.';
    case 'email.invalid_address':
      return 'Zadejte platnou e-mailovou adresu.';
    default:
      break;
  }
  if (problem.status === 404) return OLD_SERVER_TEXT;
  if (problem.status === 403) return 'Na odeslání zkušebního e-mailu nemáte oprávnění.';
  if (problem.status === 429) return 'Zkušební e-mail jde poslat nejvýše třikrát za hodinu. Zkuste to později.';
  if (problem.code === 'offline') return 'Server neodpovídá. Zkontrolujte připojení.';
  return 'Zkušební e-mail se nepodařilo odeslat.';
}

export const DNS_CHECKLIST: readonly string[] = [
  'Ověření domény: záznam TXT s kódem od poskytovatele',
  'DKIM: záznamy CNAME (nebo TXT) od poskytovatele',
  'SPF: jediný záznam TXT „v=spf1 …“ s include poskytovatele',
  'DMARC: záznam TXT _dmarc, nejdřív p=none, po dvou týdnech p=quarantine',
];

export const GUIDE_URL = 'https://github.com/bhaaddin/sportmedical-ops/blob/main/docs/EMAIL-SETUP.md';
