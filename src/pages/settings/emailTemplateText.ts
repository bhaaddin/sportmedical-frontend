/*
 * Placeholders in an e-mail template, the way the server reads them.
 *
 * The server substitutes ONLY the double-brace form, `{{pacient.jmeno}}`. A
 * single-brace `{pacient.jmeno}` is saved without complaint (measured against
 * PUT /api/email-templates/{code}) and then goes to the patient as the literal
 * text, so the editor must never insert one and must say so when one is typed.
 */

/** The token the editor inserts for a placeholder: always the double-brace form. */
export function placeholderToken(key: string): string {
  return `{{${key}}}`;
}

/** `{name.part}` that is not part of a `{{ ... }}`: looks like a placeholder, will not be replaced. */
const SINGLE_BRACE = /(?<!\{)\{\s*([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)\s*\}(?!\})/gi;

/** The single-brace tokens in a text, once each, as written. */
export function singleBraceTokens(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(SINGLE_BRACE)) found.add(match[0]);
  return [...found];
}

/** What to tell the person about single-brace tokens in subject or body, or null when there are none. */
export function singleBraceWarning(subject: string, body: string): string | null {
  const tokens = [...new Set([...singleBraceTokens(subject), ...singleBraceTokens(body)])];
  if (tokens.length === 0) return null;
  return `Zástupné údaje se píšou ve dvojitých závorkách, např. {{pacient.jmeno}}. ${tokens.length === 1 ? 'Tohle' : 'Tyhle'} by pacient dostal doslova: ${tokens.join(', ')}.`;
}
