/*
 * Shared pieces of the settings-audit tests (20. 10. 2026): one place for how a
 * screen is rendered, how a refused request looks and how the HTTP client is
 * doubled by URL - so each audit file says what it checks, not how to wire it.
 */
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosResponse } from 'axios';

/** A page rendered inside a router and a query client that never retries. */
export function renderScreen(ui: ReactElement, route = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

/** What axios throws for a refused request, with the body the server sent. */
export function refused(status: number, data: unknown): AxiosError {
  const response = { status, data, statusText: '', headers: {}, config: {} } as AxiosResponse;
  return new AxiosError('refused', 'ERR_BAD_REQUEST', undefined, undefined, response);
}

/** The server's answer to a value it will not store: `settings.invalid` with the sentences per field. */
export function invalidSettings(errors: Record<string, string[]>, message = 'Nastavení nelze uložit.'): AxiosError {
  return refused(400, { code: 'settings.invalid', message, errors });
}

/** A request that never got an answer (the API is asleep). */
export function unreachable(): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK');
}

export type Handler = (url: string, body?: unknown) => unknown | Promise<unknown>;

/**
 * Turns `{ '/api/x': handler }` into a function usable as `client.get/put/post`:
 * the first route whose key the URL starts with answers `{ data: result }`, a
 * thrown value is a refusal, anything else is an empty list.
 */
export function byUrl(routes: Record<string, Handler>) {
  return async (url: string, bodyOrConfig?: unknown) => {
    const key = Object.keys(routes).find((route) => url.startsWith(route));
    if (key === undefined) return { data: [] };
    return { data: await routes[key](url, bodyOrConfig) };
  };
}
