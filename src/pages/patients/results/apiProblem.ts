/*
 * What a refused write carries, whichever way the server shaped it. Kept apart
 * from `api/diagnostics` so a screen that mocks that module still gets it.
 */

export interface ApiProblem {
  /** A sentence about the request as a whole. */
  message?: string;
  /** Messages by the server's own field path, e.g. "trainingZones[0].name". */
  fields: Record<string, string>;
}

const firstText = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  if (Array.isArray(value)) {
    const first = value.map(firstText).find((t) => t !== undefined);
    return first;
  }
  return undefined;
};

/**
 * What a 400/422 carries, whichever way the server shaped it: ASP.NET
 * validation problems (`errors: { Field: [text] }`), a list of
 * `{ field, message }`, or just `message` / `detail`.
 */
export function readApiProblem(error: unknown): ApiProblem {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  const fields: Record<string, string> = {};
  if (data === null || typeof data !== 'object') return { fields };
  const body = data as Record<string, unknown>;

  const errors = body.errors;
  if (Array.isArray(errors)) {
    for (const item of errors) {
      if (item === null || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      const path = firstText(e.field ?? e.propertyName ?? e.property ?? e.path);
      const text = firstText(e.message ?? e.error ?? e.errorMessage);
      if (path !== undefined && text !== undefined && fields[path] === undefined) fields[path] = text;
    }
  } else if (errors !== null && typeof errors === 'object') {
    for (const [path, value] of Object.entries(errors as Record<string, unknown>)) {
      const text = firstText(value);
      if (text !== undefined) fields[path] = text;
    }
  }

  const message = firstText(body.message) ?? firstText(body.detail);
  return { ...(message !== undefined ? { message } : {}), fields };
}

