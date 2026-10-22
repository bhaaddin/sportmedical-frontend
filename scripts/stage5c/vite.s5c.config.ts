/* The worktree's Vite on :3012 (npx vite --config scripts/stage5c/vite.s5c.config.ts). node_modules is a junction to the main checkout, so its files must be allowed. */
import { mergeConfig, type UserConfig } from 'vite';
import base from '../../vite.config';

export default (env: Parameters<Extract<typeof base, (...a: never[]) => unknown>>[0]) =>
  mergeConfig((base as unknown as (e: typeof env) => UserConfig)(env), {
    server: { port: 3012, strictPort: true, open: false, fs: { allow: ['../..', 'C:/Users/Matko/sportmedical-frontend/node_modules'] } },
  });
