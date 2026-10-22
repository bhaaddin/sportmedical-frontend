/*
 * R13 - the words of "Uvolnit nevyplněné" (the release of the unfilled part of a club's hold). Kept apart from `clubHold.ts` so that the
 * planner's first load does not carry them: only the lazy release panel imports this file.
 */
export const HOLD_RELEASE_TEXT = {
  all: 'Uvolnit nevyplněné',
  expired: 'Uvolnit jen vypršené',
  confirm: (onlyExpired: boolean) =>
    onlyExpired
      ? 'Uvolní se jen ty části, jejichž držení vypršelo a které nikdo nevyplnil. Zapsaní hráči a jejich termíny se nemění.'
      : 'Uvolní se čas, který hráči nevyplnili: část bez hráčů zmizí, část s hráči se zkrátí po posledního z nich. Zapsaní hráči a jejich termíny se nemění.',
  go: 'Uvolnit',
  back: 'Zpět',
  failed: 'Čas se nepodařilo uvolnit. Zkuste to prosím znovu.',
} as const;

/** What the owner is told after the release (contract: windows removed / shortened, minutes given back). */
export function releaseSummary(r: { windowsRemoved: number; windowsShortened: number; minutesReleased: number; stretchesKept: number; blockCancelled: boolean }): string {
  if (r.windowsRemoved === 0 && r.windowsShortened === 0) return 'Není co uvolnit: všechen držený čas je vyplněný, nebo už byl uvolněn.';
  const parts = [`Uvolněno ${r.minutesReleased} min`];
  if (r.windowsRemoved > 0) parts.push(`odstraněno ${r.windowsRemoved}`);
  if (r.windowsShortened > 0) parts.push(`zkráceno ${r.windowsShortened}`);
  if (r.stretchesKept > 0) parts.push(`ponecháno ${r.stretchesKept}`);
  return `${parts.join(', ')}.${r.blockCancelled ? ' Blokace klubu tím zanikla.' : ''}`;
}

/** The sentence for a refused release: the server's own text (it is Czech), else the generic one. */
export function releaseFailedText(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  return message !== '' && !/^Request failed/i.test(message) ? message : HOLD_RELEASE_TEXT.failed;
}
