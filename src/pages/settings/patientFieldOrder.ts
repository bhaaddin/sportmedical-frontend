/**
 * `key` moved one place up (`-1`) or down (`+1`) in `order`. Unchanged when it
 * is already at that end or not in the list at all.
 */
export function moveKey(order: readonly string[], key: string, direction: -1 | 1): string[] {
  const from = order.indexOf(key);
  const to = from + direction;

  if (from < 0 || to < 0 || to >= order.length) return [...order];

  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
