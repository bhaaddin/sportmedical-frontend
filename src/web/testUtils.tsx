/* Helpers for the tests of the public site: the providers the real entries add (query client,
   router, the "this is the /web bundle" flag, the public theme) and a viewport. */

import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { publicTheme } from '../components/public/brand';
import { WebRouterContext } from './SiteLink';
import { setViewport } from '../test/viewport';
import { seedQueryClient } from './data';
import type { WebBootstrap } from './data';

export interface RenderWebOptions {
  route?: string;
  /** 390 / 834 / 1440 — see src/test/viewport.ts. */
  width?: number;
  /** A build-time snapshot to seed the cache with (what a prerendered page starts from). */
  seed?: WebBootstrap;
}

export function newTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
}

export function renderWeb(ui: ReactElement, { route = '/web', width = 1440, seed }: RenderWebOptions = {}) {
  setViewport(width);
  const client = newTestQueryClient();
  seedQueryClient(client, seed);
  const result = render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={publicTheme}>
        <WebRouterContext.Provider value>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </WebRouterContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...result, client };
}

/** Obviously made-up amounts: the tests prove that a price comes from the list, not that it is right. */
export const TEST_PRICE_LIST = [
  {
    category: 'Sportovní lékařské prohlídky',
    items: [
      { code: 'a1', name: 'Základní sportovní prohlídka', description: '', priceCzk: 1234, durationMinutes: 40 },
      { code: 'a2', name: 'Komplexní sportovní prohlídka', description: '', priceCzk: 2345, durationMinutes: 60 },
      { code: 'a3', name: 'Spiroergometrické vyšetření', description: '', priceCzk: 3456, durationMinutes: 90 },
    ],
  },
  {
    category: 'Sportovní diagnostika',
    items: [
      { code: 'b1', name: 'Základní diagnostika', description: '', priceCzk: 4567, durationMinutes: 60 },
      { code: 'b2', name: 'Komplexní diagnostika', description: '', priceCzk: 5678, durationMinutes: 90 },
    ],
  },
  {
    category: 'InBody 770 – tělesná analýza',
    items: [{ code: 'c1', name: 'Základní InBody měření', description: '', priceCzk: 678, durationMinutes: 15 }],
  },
];
