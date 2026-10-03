import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { VIEWPORTS } from '../test/viewport';
import { EMPTY_BOOTSTRAP, normalizeBootstrap } from './data';
import { TEST_PRICE_LIST, renderWeb } from './testUtils';
import LandingPage from './pages/LandingPage';
import { WebApp } from './WebApp';

const get = vi.fn();
vi.mock('./http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http')>();
  return { ...actual, webHttp: { get: (...args: unknown[]) => get(...args) } };
});

/** A server that is asleep: every public endpoint fails. */
const serverDown = () => get.mockRejectedValue(new Error('Network Error'));

/** A server that answers the four public endpoints. */
function serverUp(extra: { discountTiers?: unknown } = {}) {
  get.mockImplementation((url: string) => {
    if (url === '/api/public/price-list') return Promise.resolve({ data: TEST_PRICE_LIST });
    if (url === '/api/public/discount-tiers' && extra.discountTiers !== undefined) return Promise.resolve({ data: extra.discountTiers });
    return Promise.reject(new Error(`404 ${url}`));
  });
}

beforeEach(() => { get.mockReset(); });
afterEach(cleanup);

const widths = [
  ['phone', VIEWPORTS.phone],
  ['tablet', VIEWPORTS.tablet],
  ['desktop', VIEWPORTS.desktop],
] as const;

describe.each(widths)('the landing at %s (%i px)', (_name, width) => {
  it('renders every section of the artboard', async () => {
    serverDown();
    renderWeb(<LandingPage />, { width });

    // Hero: the headline is one H1, its last line is the accent one.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Výkon,\s*který se dá\s*změřit/);
    // Three numbered service blocks, as headings.
    for (const n of ['01', '02', '03']) expect(screen.getAllByText(n).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('heading', { level: 3, name: 'Sportovní lékařské prohlídky' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Sportovní diagnostika' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'InBody 770' })).toBeInTheDocument();
    // Equipment, the four steps, the club offer, the philosophy.
    expect(screen.getByRole('heading', { name: 'Na čem měříme' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(8);
    expect(screen.getByRole('heading', { name: /Od objednání\s*k výsledkům/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Mobilní testování\s*přímo u vás/ })).toBeInTheDocument();
    expect(screen.getByText('Naše filozofie')).toBeInTheDocument();
    // The club CTA "Mám odkaz od klubu" and the booking CTA.
    expect(screen.getByRole('link', { name: 'Mám odkaz od klubu' })).toHaveAttribute('href', '/web/kluby#mam-odkaz');
    expect(screen.getAllByRole('link', { name: /Objednat termín/ })[0]).toHaveAttribute('href', '/objednat');
    // The partner marquee: the ten default clubs (the strip is doubled for the loop, the copy is aria-hidden).
    expect(screen.getAllByText('Black Angels').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Zdravotní agentura').length).toBeGreaterThanOrEqual(1);
    // The hero carousel: three photo slots, all placeholders with the artboard's captions.
    expect(screen.getByText('[FOTO: spiroergometrie na ergometru]')).toBeInTheDocument();
    expect(screen.getByText('[FOTO: měření na InBody 770]')).toBeInTheDocument();
    expect(screen.getByText('[FOTO: testování v klubu]')).toBeInTheDocument();
  });

  it('shows no amount at all while the price list is unknown — "—", never a remembered number', async () => {
    serverDown();
    const { container } = renderWeb(<LandingPage />, { width });
    await waitFor(() => { expect(get).toHaveBeenCalled(); });
    expect(container.textContent).not.toMatch(/\d\s*Kč/);
    // The rows are there, with a dash in place of the price.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(9);
    // And the hero's secondary button has no "od … Kč".
    expect(screen.getByRole('link', { name: 'Ceník' })).toBeInTheDocument();
  });

  it('shows the prices the price list supplies, with a non-breaking space before Kč', async () => {
    serverUp();
    renderWeb(<LandingPage />, { width });
    expect(await screen.findByText(/^1\s234\sKč$/)).toBeInTheDocument();
    expect(screen.getByText(/^2\s345\sKč$/)).toBeInTheDocument();
    expect(screen.getByText(/^4\s567\sKč$/)).toBeInTheDocument();
    // The cheapest priced item is "Ceník od …" in the hero.
    expect(screen.getByRole('link', { name: /Ceník od 678\sKč/ })).toBeInTheDocument();
    // The amount's space is U+00A0, not a plain one.
    const price = screen.getByText(/^1\s234\sKč$/);
    expect(price.textContent).toContain(' Kč');
  });
});

describe('the landing and the club discount', () => {
  it('hides the discount number when the server publishes no tiers', async () => {
    serverUp();
    const { container } = renderWeb(<LandingPage />);
    await screen.findByText(/^1\s234\sKč$/);
    expect(container.textContent).not.toMatch(/−\s*\d+\s*%/);
    expect(screen.getByText('sportovců minimálně')).toBeInTheDocument();
  });

  it('shows the biggest tier of GET /api/public/discount-tiers', async () => {
    serverUp({ discountTiers: [{ minPersons: 4, percent: 5 }, { minPersons: 6, percent: 10 }, { minPersons: 8, percent: 12.5 }] });
    renderWeb(<LandingPage />);
    expect(await screen.findByText(/^−12,5\s%$/)).toBeInTheDocument();
    expect(screen.getByText(/^od 8\sosob$/)).toBeInTheDocument();
  });
});

describe('the landing starts from a prerendered snapshot', () => {
  it('shows the snapshot immediately, before any request has answered', () => {
    serverDown();
    const seed = normalizeBootstrap({ priceList: TEST_PRICE_LIST }, 1);
    renderWeb(<LandingPage />, { seed });
    expect(screen.getByText(/^1\s234\sKč$/)).toBeInTheDocument();
  });

  it('keeps the snapshot when the refresh fails (the server went to sleep)', async () => {
    serverDown();
    const seed = normalizeBootstrap({ priceList: TEST_PRICE_LIST }, 1);
    renderWeb(<LandingPage />, { seed });
    await waitFor(() => expect(get).toHaveBeenCalledWith('/api/public/price-list'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByText(/^1\s234\sKč$/)).toBeInTheDocument();
  });
});

describe('the whole /web app at the three widths', () => {
  it.each(widths)('renders the header, the main landmark and the footer at %s', async (_name, width) => {
    serverDown();
    renderWeb(<WebApp />, { width, route: '/web' });
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: /SportMedical Diagnostics — úvod/ })).toHaveAttribute('href', '/web');
    expect(within(header).getAllByRole('link', { name: 'Objednat termín', hidden: true }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Provozní doba');
    // The unknown route is a page, never a white screen.
    cleanup();
    renderWeb(<WebApp />, { width, route: '/web/neexistuje' });
    expect(screen.getByRole('heading', { level: 1, name: 'Stránka nenalezena' })).toBeInTheDocument();
  });

  it('the empty bootstrap is a valid snapshot', () => {
    expect(EMPTY_BOOTSTRAP.priceList).toBeNull();
  });
});
