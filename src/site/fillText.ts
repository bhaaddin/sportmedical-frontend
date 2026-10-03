/**
 * Fills the {placeholders} of an editable text (a slot).
 *
 * A value that is empty takes its surroundings with it, so a sentence never ends up
 * with a dangling "na ." or an empty "()": " na {email}", " ({service})" and " {email}"
 * are removed whole. A placeholder the admin did not use is simply not filled.
 */
export function fillText(template: string, values: Record<string, string>): string {
  let text = template;
  for (const [name, raw] of Object.entries(values)) {
    const value = raw.trim();
    const token = `\\{${name}\\}`;
    if (value === '') {
      text = text
        .replace(new RegExp(`\\s*\\(${token}\\)`, 'g'), '')
        .replace(new RegExp(`\\s+na ${token}`, 'g'), '')
        .replace(new RegExp(`\\s*${token}`, 'g'), '');
    } else {
      text = text.split(`{${name}}`).join(value);
    }
  }
  return text;
}
