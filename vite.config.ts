import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { legacyWebRedirect } from './src/web/sitePaths.ts';

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

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), appShellFallback()],
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
                { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 50 },
                {
                  name: 'charts',
                  test: /node_modules[\\/](recharts|d3-[^\/]+|victory-vendor|es-toolkit|immer|redux|@reduxjs|reselect|decimal\.js-light|internmap|react-redux|use-sync-external-store)[\\/]/,
                  priority: 40,
                },
                { name: 'mui', test: /node_modules[\\/]@(mui|emotion)[\\/]/, priority: 30 },
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
