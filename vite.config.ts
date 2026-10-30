import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { legacyWebRedirect } from './src/web/sitePaths.ts';
import { apiOriginOf } from './src/web/apiOrigin.ts';

/*
 * Two builds share this file:
 *   vite build                    the browser bundles (the staff app + the public site), with a manifest the
 *                                 prerender script reads to find the public site's JS/CSS;
 *   vite build --ssr <entry>      the server entry of the public site (src/web/entry-server.tsx), which
 *                                 scripts/prerender.mjs runs once per page to write dist/index.html (the landing
 *                                 page) and dist/<route>/index.html — the public site is the root of the domain.
 * `npm run build` runs both and then the script; it also keeps Vite's SPA shell as dist/app.html.
 *
 * The dev server needs nothing special: index.html answers every address and src/main.tsx picks the bundle by path.
 */

/*
 * `vite preview` serves dist/ like Vercel does (vercel.json): a prerendered page is a file and wins; an address
 * that is not a file goes to the SPA shell dist/app.html (NOT dist/index.html — that is the prerendered landing
 * page now); the old /web/… addresses are redirected with a 308.
 */
function appShellFallback(): Plugin {
  return {
    name: 'sm-app-shell-fallback',
    configurePreviewServer(server) {
      const outDir = path.resolve(server.config.root, server.config.build.outDir);
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '/';
        const moved = legacyWebRedirect(url);
        if (moved !== null) {
          res.statusCode = 308;
          res.setHeader('Location', moved);
          res.end();
          return;
        }
        const pathname = decodeURIComponent(url.split('?')[0].split('#')[0]);
        const isFile = /\.[a-z0-9]+$/i.test(pathname);
        const isPage = existsSync(path.join(outDir, pathname, 'index.html'));
        if (isPage && !isFile) {
          // vercel.json's rewrite: '/sluzby' → '/sluzby/index.html' (sirv does not resolve a directory without a trailing slash).
          req.url = `${pathname.replace(/\/+$/, '')}/index.html`;
        } else if (!isFile && !pathname.startsWith('/assets/') && existsSync(path.join(outDir, 'app.html'))) {
          req.url = '/app.html';
        }
        next();
      });
    },
  };
}

/*
 * The browser opens the connection to the API while it is still reading the page: the first request of
 * every screen (the account, the data) then skips the DNS lookup and the TLS handshake (about 3 round
 * trips on a phone). Written only when the build is given an ABSOLUTE API address (`VITE_API_BASE_URL`,
 * set in the Vercel project); with the usual empty value the API is on the same origin and there is
 * nothing to hint. The address is read from the environment, never typed here.
 */
function apiOriginHints(apiBase: string | undefined): Plugin {
  const origin = apiOriginOf(apiBase);
  return {
    name: 'sm-api-origin-hints',
    transformIndexHtml() {
      if (origin === null) return [];
      return [
        { tag: 'link', attrs: { rel: 'preconnect', href: origin, crossorigin: true }, injectTo: 'head-prepend' },
        { tag: 'link', attrs: { rel: 'dns-prefetch', href: origin }, injectTo: 'head-prepend' },
        /* The wake-up ping starts with the HTML, in parallel with the JS download (public/early-wake.js). */
        { tag: 'script', attrs: { async: true, src: '/early-wake.js', 'data-api': origin }, injectTo: 'head' },
      ];
    },
  };
}

export default defineConfig(({ isSsrBuild, mode }) => ({
  plugins: [react(), appShellFallback(), apiOriginHints(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL)],
  // The server bundle never serves static files; do not copy public/ into it.
  publicDir: isSsrBuild ? false : 'public',
  build: {
    manifest: !isSsrBuild,
    rolldownOptions: {
      output: isSsrBuild
        ? undefined
        : {
            /* Vendor code in its own long-lived chunks: a release of our screens no longer
               re-downloads React/MUI, and the browser fetches them in parallel with the app.
               The groups are explicit and ordered (higher priority wins): the public site
               (the root of the domain) must never pull the charts library — React's core lives in 'react', not in
               whichever chunk imports it first. */
            codeSplitting: {
              includeDependenciesRecursively: false,
              groups: [
                /* use-sync-external-store serves react-i18next (every screen) and recharts alike: it belongs with
                   React. Left in 'charts' it dragged the whole charts library into every page that translates. */
                { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/, priority: 50 },
                {
                  name: 'charts',
                  test: /node_modules[\\/](recharts|d3-[^\/]+|victory-vendor|es-toolkit|immer|redux|@reduxjs|reselect|decimal\.js-light|internmap|react-redux)[\\/]/,
                  priority: 40,
                },
                { name: 'mui', test: /node_modules[\\/]@(mui|emotion)[\\/]/, priority: 30 },
                /* MUI's positioning engine: its own chunk, imported by 'mui'. Left ungrouped, the bundler may merge it into
                   whichever app chunk shares its importers - and then 'mui' (every first load) imports that app chunk. */
                { name: 'popper', test: /node_modules[\\/]@popperjs[\\/]/, priority: 30 },
                { name: 'motion', test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/, priority: 25 },
                /* The scroll-driven public pages (src/motion): each its own lazy chunk, none of them in any first load. */
                { name: 'gsap', test: /node_modules[\\/]gsap[\\/]/, priority: 25 },
                { name: 'lenis', test: /node_modules[\\/]lenis[\\/]/, priority: 25 },
                { name: 'shaders', test: /node_modules[\\/]@paper-design[\\/]/, priority: 25 },
                { name: 'signalr', test: /node_modules[\\/]@microsoft[\\/]signalr[\\/]/, priority: 25 },
                { name: 'router', test: /node_modules[\\/](react-router|react-router-dom|@remix-run|cookie|set-cookie-parser)[\\/]/, priority: 20 },
                { name: 'query', test: /node_modules[\\/]@tanstack[\\/]/, priority: 20 },
              ],
            },
          },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    /* Above the 10 s wait limit in the setup file, so a wait that fails says what it waited for. */
    testTimeout: 30_000,
    /* Only our own tests. Without this vitest also walks node_modules. */
    include: ['src/**/*.test.{ts,tsx}'],
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5092',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:5092',
        changeOrigin: true,
      },
      '/openapi': {
        target: 'http://localhost:5092',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'ws://localhost:5092',
        ws: true,
      },
    },
  },
}));
