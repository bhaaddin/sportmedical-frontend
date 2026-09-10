import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
      '/swagger': {
        target: 'http://localhost:5092',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'ws://localhost:5092',
        ws: true,
      },
    },
  },
});
