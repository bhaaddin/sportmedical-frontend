/*
 * The public patient site is the default page of the domain.
 *
 *   /            the landing page, for anybody — no session needed, nothing staff-looking on it
 *   /sluzby …    the other public pages, at the root
 *   footer       a small "Pro personál" link to /login (the way into the staff portal)
 *   header       a discreet "Do aplikace" link, ONLY once a session exists, and only after mount
 *                (the page is prerendered, so the server's HTML can never contain it)
 *
 * Rendered at the three widths of the design (390 / 834 / 1440).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen, within } from '@testing-library/react';
import { VIEWPORTS } from '../test/viewport';
import { EMPTY_BOOTSTRAP } from './data';
import { render as renderToHtml } from './entry-server';
import { renderWeb } from './testUtils';
import { WebApp } from './WebApp';

vi.mock('./http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http')>();
  return { ...actual, webHttp: { get: () => Promise.reject(new Error('Network Error')) } };
});

window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

beforeEach(() => { localStorage.clear(); });
afterEach(cleanup);

const widths = [['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const;

describe('/ is the landing page for an anonymous visitor', () => {
  it.each(widths)('at %s: the landing H1, the header, the booking action and the staff entry in the footer', (_name, width) => {
    renderWeb(<WebApp />, { route: '/', width });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Výkon/);
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: /SportMedical Diagnostics — úvod/ })).toHaveAttribute('href', '/');
    expect(within(header).getAllByRole('link', { name: 'Objednat termín', hidden: true })[0]).toHaveAttribute('href', '/objednat');
    // The patients' portal stays in the header; staff are NOT offered anything there without a session.
    expect(header.textContent).toContain('Můj portál');
    expect(within(header).queryByText('Do aplikace')).toBeNull();
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: 'Pro personál' })).toHaveAttribute('href', '/login');
  });

  it.each(widths)('at %s: /sluzby is the services page at the root, /web/sluzby is nothing any more', (_name, width) => {
    renderWeb(<WebApp />, { route: '/sluzby', width });
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Stránka nenalezena');
    cleanup();
    renderWeb(<WebApp />, { route: '/web/sluzby', width });
    expect(screen.getByRole('heading', { level: 1, name: 'Stránka nenalezena' })).toBeInTheDocument();
  });

  it('keeps "Pro personál" out of the main navigation', () => {
    renderWeb(<WebApp />, { route: '/', width: VIEWPORTS.desktop });
    const nav = screen.getByRole('banner').querySelector('nav[aria-label="Hlavní"]') as HTMLElement;
    expect(nav.textContent).not.toContain('personál');
    expect(screen.getByRole('banner').textContent).not.toContain('personál');
  });
});

describe('"Do aplikace" appears only for a signed-in staff member, after mount', () => {
  it('is not in the prerendered HTML — not even when this browser has a session (the server has none)', () => {
    localStorage.setItem('token', 'x');
    const { html } = renderToHtml('/', EMPTY_BOOTSTRAP);
    expect(html).not.toContain('Do aplikace');
    expect(html).toContain('Pro personál');
    expect(html).toContain('href="/login"');
  });

  it.each(widths)('at %s: shows the link to /prehled when a session exists', async (_name, width) => {
    localStorage.setItem('token', 'x');
    await act(async () => { renderWeb(<WebApp />, { route: '/', width }); });
    const header = screen.getByRole('banner');
    const link = within(header).getAllByText('Do aplikace')[0].closest('a');
    expect(link).toHaveAttribute('href', '/prehled');
  });

  it('is absent without a session', async () => {
    await act(async () => { renderWeb(<WebApp />, { route: '/', width: VIEWPORTS.desktop }); });
    expect(screen.queryByText('Do aplikace')).toBeNull();
  });
});
