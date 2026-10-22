/* The worktree's Vite (run: npx vite --config scripts/stage2/vite.s2api.config.ts) on :3006 proxying to the stage-2 API copy on :5193. */
import { mergeConfig, type UserConfig } from 'vite';
import base from '../../vite.config';

export default (env: Parameters<Extract<typeof base, (...a: never[]) => unknown>>[0]) =>
  mergeConfig((base as unknown as (e: typeof env) => UserConfig)(env), {
    server: {
      port: 3006,
      strictPort: true,
      open: false,
      proxy: {
        '/api': { target: 'http://localhost:5193', changeOrigin: true },
        '/health': { target: 'http://localhost:5193', changeOrigin: true },
        '/openapi': { target: 'http://localhost:5193', changeOrigin: true },
      },
    },
  });
