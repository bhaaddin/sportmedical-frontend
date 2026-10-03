import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/*
 * Two builds share this file:
 *   vite build                    the browser bundles (the staff app + the public site), with a manifest the
 *                                 prerender script reads to find the public site's JS/CSS;
 *   vite build --ssr <entry>      the server entry of the public site (src/web/entry-server.tsx), which
 *                                 scripts/prerender.mjs runs once per page to write dist/web/<route>/index.html.
 * `npm run build` runs both and then the script.
 */
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
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
               (/web) must never pull the charts library — React's core lives in 'react', not in
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
