/* ══════════════════════════════════════════════════════════════
   SERVER ENTRY OF THE PUBLIC SITE

   Built by `vite build --ssr` and loaded by scripts/prerender.mjs, which calls
   `render(url, data)` once per route and writes the HTML into dist/. Never runs
   in the browser and never at request time: the output is static files.

   `render` is synchronous and has no side effects beyond its return value: the
   API answers are passed in (the script fetches them with a timeout and falls
   back to nothing), so a sleeping server can never fail the build — the page is
   then rendered from the registry defaults and the browser refreshes it.
   ══════════════════════════════════════════════════════════════ */

import { renderToString } from 'react-dom/server';
import createCache from '@emotion/cache';
import createEmotionServer from '@emotion/server/create-instance';
import { CacheProvider } from '@emotion/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StaticRouter } from 'react-router-dom';
import { WebApp } from './WebApp';
import { EMPTY_BOOTSTRAP, createWebQueryClient, seedQueryClient } from './data';
import type { WebBootstrap } from './data';
import { NOT_FOUND_META, WEB_ROUTES, findWebRoute, routeOutputFile } from './routes';

export interface RenderResult {
  /** The markup that goes inside <div id="root">. */
  html: string;
  /** `<style data-emotion="css …">` tags holding exactly the CSS this page uses. */
  styles: string;
  title: string;
  description: string;
  /** False for an address that is not in the route table (rendered as the not-found page). */
  found: boolean;
  /** The snapshot the page was rendered from; the script embeds it so the browser hydrates identically. */
  data: WebBootstrap;
}

export function render(url: string, data: WebBootstrap = EMPTY_BOOTSTRAP): RenderResult {
  const cache = createCache({ key: 'css' });
  const { extractCriticalToChunks, constructStyleTagsFromChunks } = createEmotionServer(cache);
  const queryClient = createWebQueryClient();
  seedQueryClient(queryClient, data);

  const html = renderToString(
    <CacheProvider value={cache}>
      <QueryClientProvider client={queryClient}>
        <StaticRouter location={url}>
          <WebApp />
        </StaticRouter>
      </QueryClientProvider>
    </CacheProvider>,
  );

  const chunks = extractCriticalToChunks(html);
  const styles = constructStyleTagsFromChunks(chunks);
  const route = findWebRoute(url);
  const meta = route ?? NOT_FOUND_META;
  return { html, styles, title: meta.title, description: meta.description, found: route !== undefined, data };
}

export { WEB_ROUTES, routeOutputFile, NOT_FOUND_META };
export { normalizeBootstrap } from './data';
export type { WebBootstrap } from './data';
