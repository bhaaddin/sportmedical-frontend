/*
 * Etapa 10 "activity routing": a window of a club order may allow only some of the order's činnosti (spiroergometry
 * and the basic exams are mixed in a window only when the desk allows it). Pure helpers shared by pick mode, the
 * order screens, the calendar and the players' page. `null` / absent always means "all činnosti of the order".
 */

export interface RoutedActivity {
  activityId: string;
  name: string;
}

/** The first word of a činnost name: "Základní sportovní prohlídka" -> "Základní". */
export const firstWord = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/**
 * The allowed ids as the order stores them: only ids the order has (`all`), null when that is every one of them
 * (or nothing usable was given). A single-činnost order can never be restricted.
 */
export function normalizeAllowed(ids: readonly string[] | null | undefined, all: readonly string[]): string[] | null {
  if (ids === null || ids === undefined) return null;
  const known = all.filter((id) => ids.includes(id));
  if (known.length === 0 || known.length >= all.length) return null;
  return known;
}

/** A stable key of an allowed set: `*` for all. Windows with the same key may be joined, others never. */
export const allowedKey = (ids: readonly string[] | null | undefined): string =>
  ids === null || ids === undefined || ids.length === 0 ? '*' : [...ids].sort().join(',');

export const allowsActivity = (ids: readonly string[] | null | undefined, activityId: string): boolean =>
  ids === null || ids === undefined || ids.length === 0 || ids.includes(activityId);

/**
 * One chip pressed: the new allowed set. Pressing an allowed činnost takes it out (never the last one), pressing
 * one that is out puts it in; the result is null when it is every činnost again.
 */
export function toggleAllowed(current: readonly string[] | null | undefined, activityId: string, all: readonly string[]): string[] | null {
  const have = current === null || current === undefined || current.length === 0 ? [...all] : all.filter((id) => current.includes(id));
  const next = have.includes(activityId)
    ? have.length <= 1
      ? have
      : have.filter((id) => id !== activityId)
    : all.filter((id) => id === activityId || have.includes(id));
  return normalizeAllowed(next, all);
}

/** "Spiroergometrie" or "Základní + Komplexní" for a restricted window; null when it allows everything. */
export function allowedNames(
  ids: readonly string[] | null | undefined,
  activities: readonly RoutedActivity[],
  mode: 'full' | 'short' = 'full',
): string | null {
  const all = activities.map((a) => a.activityId);
  const allowed = normalizeAllowed(ids, all);
  if (allowed === null) return null;
  const name = (a: RoutedActivity) => (mode === 'short' ? firstWord(a.name) : a.name);
  return activities.filter((a) => allowed.includes(a.activityId)).map(name).join(' + ');
}

/** The names of činnosti by id, in the order given (unknown ids are dropped). */
export function namesOf(ids: readonly string[], activities: readonly RoutedActivity[]): string[] {
  return ids.map((id) => activities.find((a) => a.activityId === id)?.name).filter((n): n is string => n !== undefined);
}
