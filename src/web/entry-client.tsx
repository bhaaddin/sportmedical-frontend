/* ══════════════════════════════════════════════════════════════
   BROWSER ENTRY OF THE PUBLIC SITE

   A prerendered page (the file has `data-prerendered` on #root) is hydrated: the
   HTML that was already painted becomes interactive without being thrown away.
   The query cache is seeded from the snapshot the page embeds, so the first
   client render equals the server's; the queries then refresh prices, texts and
   photos from the API. Any other address (the dev server, an unknown public path)
   is rendered from scratch.
   ══════════════════════════════════════════════════════════════ */

import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { WebApp } from './WebApp';
import { createWebQueryClient, seedQueryClient } from './data';
/* Archivo + Public Sans (self-hosted). The prerender inlines this chunk's CSS into every page. */
import './fonts';

export function mountWeb(container: HTMLElement): void {
  const queryClient = createWebQueryClient();
  seedQueryClient(queryClient, window.__SM_WEB__);
  const cache = createCache({ key: 'css' });

  const tree = (
    <CacheProvider value={cache}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WebApp />
        </BrowserRouter>
      </QueryClientProvider>
    </CacheProvider>
  );

  if (container.hasAttribute('data-prerendered')) {
    hydrateRoot(container, tree);
  } else {
    // Nothing to adopt: start from an empty root (and drop any prerender marker leftovers).
    createRoot(container).render(<StrictMode>{tree}</StrictMode>);
  }
}
