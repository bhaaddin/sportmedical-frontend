/*
 * Likely duplicates among služby and činnosti, found on the client from the
 * list that is already loaded: the same name once case, diacritics, punctuation
 * and word order are ignored (a reordered "Základní sportovní prohlídka"). A
 * činnost only counts as a duplicate of one in the same služba; the same name
 * under two služby is legitimate.
 */
export interface DuplicateCandidate {
  id: string;
  name: string;
  isActive: boolean;
}

/** Lower case, no diacritics, words sorted: the key two spellings of one name share. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('cs')
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== '')
    .sort()
    .join(' ');
}

export interface DuplicateGroup<T> {
  key: string;
  items: T[];
}

/** Groups of two or more with the same name key; `scope` narrows what counts as "the same place". */
export function findDuplicateGroups<T extends DuplicateCandidate>(
  items: readonly T[],
  scope: (item: T) => string = () => '',
): DuplicateGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const item of items) {
    const name = normalizeName(item.name);
    if (name === '') continue;
    const key = `${scope(item)}|${name}`;
    byKey.set(key, [...(byKey.get(key) ?? []), item]);
  }
  return [...byKey.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, items: group }));
}
