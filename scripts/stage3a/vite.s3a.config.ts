/* The worktree's Vite on :3007 proxying to the shared dev API (:5092). */
import { mergeConfig, type UserConfig } from 'vite';
import base from '../../vite.config';

export default (env: Parameters<Extract<typeof base, (...a: never[]) => unknown>>[0]) =>
  mergeConfig((base as unknown as (e: typeof env) => UserConfig)(env), {
    server: { port: 3007, strictPort: true, open: false },
  });
