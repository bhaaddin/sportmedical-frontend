/**
 * Czech names of the consents the registry can report as missing
 * (`paperwork.missingConsents`), and the one line the appointment card shows.
 * An unknown code is shown as it came, never dropped.
 */
export const CONSENT_NAMES_CS: Record<string, string> = {
  treatment: 'Zpracování údajů o zdravotním stavu a poskytnutí zdravotních služeb',
  report_email: 'Zaslání zprávy e-mailem',
  club: 'Sdílení výsledků se sportovním klubem',
  communication: 'Novinky a nabídky',
};

export function consentName(code: string): string {
  return CONSENT_NAMES_CS[code] ?? code;
}

/** "Chybí souhlasy: …" - or the bare "Chybí souhlasy" when the server named none. */
export function missingConsentsLine(codes: readonly string[] | null | undefined): string {
  const names = (codes ?? []).map(consentName);
  return names.length === 0 ? 'Chybí souhlasy' : `Chybí souhlasy: ${names.join(', ')}`;
}
