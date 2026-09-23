/*
 * What a typed settings route refused, in the shape the screens need.
 *
 * The server answers a value it cannot use with
 * `{ code, message, errors: { field: [sentence, …] } }`, the sentences written
 * for a person. A screen puts each field's sentence under that field and the
 * message above the button; it never writes a refusal of its own.
 */

interface ProblemBody {
  message?: unknown;
  errors?: unknown;
}

const bodyOf = (error: unknown): ProblemBody | undefined =>
  (error as { response?: { data?: ProblemBody } } | null)?.response?.data;

/** The first sentence per field, keyed as the request named the field. */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  const errors = bodyOf(error)?.errors;
  if (errors === null || typeof errors !== 'object') return {};

  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(errors as Record<string, unknown>)) {
    if (Array.isArray(messages) && typeof messages[0] === 'string') out[field] = messages[0];
  }
  return out;
}

/** The server's own sentence, or `fallback` when the request never got one. */
export function problemMessageOf(error: unknown, fallback: string): string {
  const message = bodyOf(error)?.message;
  return typeof message === 'string' && message.trim() !== '' ? message : fallback;
}
