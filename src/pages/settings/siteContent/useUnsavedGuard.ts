import { useEffect } from 'react';

export const UNSAVED_MESSAGE = 'Máte neuložené změny. Opravdu chcete odejít a zahodit je?';

/**
 * While `dirty`, leaving the page asks first:
 *  - closing the tab / reloading → the browser's own prompt (`beforeunload`);
 *  - clicking a link inside the app (the sidebar, the breadcrumb) → `window.confirm`.
 * The app uses a plain BrowserRouter, which has no navigation blocker, hence the click listener.
 * Links that open a new tab (target="_blank") do not leave the page and are not asked about.
 */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return undefined;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (anchor === null || anchor === undefined) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href') ?? '';
      if (href === '' || href.startsWith('#')) return;
      if (!window.confirm(UNSAVED_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);
}
