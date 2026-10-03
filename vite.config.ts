import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        /* Vendor code in its own long-lived chunks: a release of our screens no longer
           re-downloads React/MUI, and the browser fetches them in parallel with the app. */
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui';
          if (id.includes('react-router') || id.includes('@remix-run')) return 'router';
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react';
          return undefined;
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
});
