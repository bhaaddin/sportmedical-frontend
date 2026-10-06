import { useEffect } from 'react';

/**
 * The club's link is a credential: search engines must not index it. Adds `<meta name="robots" content="noindex">`
 * while the page is mounted and removes it (or restores the previous value) afterwards.
 */
export function useNoIndex(): void {
  useEffect(() => {
    let tag = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = tag === null;
    const previous = tag?.getAttribute('content') ?? null;
    if (tag === null) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'robots');
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', 'noindex');
    return () => {
      if (created) tag.remove();
      else if (previous !== null) tag.setAttribute('content', previous);
    };
  }, []);
}
