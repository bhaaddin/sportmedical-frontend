import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VIEWPORTS, setViewport } from '../../test/viewport';
import PublicLayout from '../../pages/public/PublicLayout';
import { SiteLink, WebRouterContext, currentSiteAddress, isWebTarget } from '../../web/SiteLink';
import { renderWeb } from '../../web/testUtils';
import { PublicHeader, SERVICE_MENU } from './PublicHeader';

vi.mock('../../api/clinicSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clinicSettings')>();
  return { ...actual, readPublicClinic: () => Promise.resolve({ name: '', email: 'x@y.cz', phone: '+420 111 222 333', address: 'Praha 4', bookingEnabled: true }) };
});

afterEach(cleanup);

describe('the public header', () => {
  // jsdom evaluates no media queries, so the desktop-only parts count as display:none here and their
  // accessible names are empty: they are found by their DOM instead of by role and name.
  const desktopNav = (container: HTMLElement) => container.querySelector('nav[aria-label="Hlavní"]') as HTMLElement;
  const linkByText = (root: HTMLElement | Document, text: string) =>
    [...root.querySelectorAll('a')].find((a) => a.textContent?.trim() === text) as HTMLAnchorElement;

  it('has the brand, the sections, "Služby ▾" with its three entries, the portal and the booking button', () => {
    const { container } = renderWeb(<PublicHeader />, { width: VIEWPORTS.desktop });
    const hrefs = [...desktopNav(container).querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/o-nas', '/sluzby', '/prohlidky', '/diagnostika', '/inbody',
      '/cenik', '/kluby', '/dokumenty', '/kontakt',
    ]);
    expect(SERVICE_MENU.map((i) => i.label)).toEqual(['Sportovní lékařské prohlídky', 'Sportovní diagnostika', 'InBody 770']);
    expect(linkByText(container, 'Můj portál')).toHaveAttribute('href', '/portal/prihlaseni');
    expect(linkByText(container, 'Objednat termín')).toHaveAttribute('href', '/objednat');
    expect(screen.getByRole('link', { name: /SportMedical Diagnostics — úvod/ })).toHaveAttribute('href', '/');
  });

  it('marks the current page', () => {
    const { container } = renderWeb(<PublicHeader />, { route: '/cenik' });
    expect(linkByText(desktopNav(container), 'Ceník')).toHaveAttribute('aria-current', 'page');
    expect(linkByText(desktopNav(container), 'Kontakt')).not.toHaveAttribute('aria-current');
  });

  it.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet]])('folds into a menu at %s, with every target reachable', (_n, width) => {
    renderWeb(<PublicHeader />, { width });
    expect(screen.queryByRole('navigation', { name: 'Hlavní menu' })).toBeNull();
    const button = screen.getByRole('button', { name: 'Otevřít menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    const panel = screen.getByRole('navigation', { name: 'Hlavní menu' });
    expect(screen.getByRole('button', { name: 'Zavřít menu' })).toHaveAttribute('aria-expanded', 'true');
    for (const label of ['O nás', 'Služby', 'Ceník', 'Pro kluby', 'Dokumenty', 'Kontakt', 'Můj portál']) {
      expect(within(panel).getByRole('link', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
    expect(within(panel).getByRole('link', { name: /^Sportovní diagnostika/ })).toHaveAttribute('href', '/diagnostika');
    expect(within(panel).getByRole('link', { name: /Objednat termín/ })).toHaveAttribute('href', '/objednat');
    // Escape closes it.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Hlavní menu' })).toBeNull();
  });

  it('hides "Můj portál" where the page asks for it', () => {
    const { container } = renderWeb(<PublicHeader hidePortalLink />);
    expect(linkByText(container, 'Můj portál')).toBeUndefined();
  });
});

describe('SiteLink — links between the two bundles', () => {
  it('knows which targets belong to the public site', () => {
    expect(isWebTarget('/')).toBe(true);
    expect(isWebTarget('/#kontakt')).toBe(true);
    expect(isWebTarget('/cenik#x')).toBe(true);
    expect(isWebTarget('/kluby')).toBe(true);
    expect(isWebTarget('/webinar')).toBe(false);
    for (const staffOrApp of ['/objednat', '/login', '/prehled', '/portal', '/clubs', '/nastaveni/cenik']) {
      expect(isWebTarget(staffOrApp), staffOrApp).toBe(false);
    }
  });

  it('still understands the old /web spelling and sends it to the new address', () => {
    expect(isWebTarget('/web')).toBe(true);
    expect(isWebTarget('/web/cenik#x')).toBe(true);
    expect(currentSiteAddress('/web')).toBe('/');
    expect(currentSiteAddress('/web/cenik#x')).toBe('/cenik#x');
    expect(currentSiteAddress('/objednat')).toBe('/objednat');
    render(
      <WebRouterContext.Provider value>
        <MemoryRouter>
          <SiteLink to="/web/kluby#mam-odkaz">starý odkaz</SiteLink>
        </MemoryRouter>
      </WebRouterContext.Provider>,
    );
    expect(screen.getByRole('link', { name: 'starý odkaz' })).toHaveAttribute('href', '/kluby#mam-odkaz');
  });

  const inApp = (ui: React.ReactElement) => render(<MemoryRouter initialEntries={['/objednat']}>{ui}</MemoryRouter>);

  it('inside the application, a link to a public page is a real page load and a link to /objednat stays client-side', () => {
    inApp(
      <>
        <SiteLink to="/cenik">ven</SiteLink>
        <SiteLink to="/objednat">dovnitř</SiteLink>
      </>,
    );
    // Both render as anchors with an href; only the router link carries the router's click handler,
    // which is observable as "does not reload": clicking the app link must not be default-prevented away.
    expect(screen.getByRole('link', { name: 'ven' })).toHaveAttribute('href', '/cenik');
    expect(screen.getByRole('link', { name: 'dovnitř' })).toHaveAttribute('href', '/objednat');
    const appClick = fireEvent.click(screen.getByRole('link', { name: 'dovnitř' }));
    expect(appClick).toBe(false); // the router handled it (preventDefault)
    const webClick = fireEvent.click(screen.getByRole('link', { name: 'ven' }));
    expect(webClick).toBe(true); // left to the browser: a full page load
  });

  it('inside the public site it is the other way round; external and hash links are plain anchors', () => {
    render(
      <WebRouterContext.Provider value>
        <MemoryRouter initialEntries={['/']}>
          <SiteLink to="/cenik">uvnitř</SiteLink>
          <SiteLink to="/objednat">ven</SiteLink>
          <SiteLink to="https://example.org">cizí</SiteLink>
          <SiteLink to="#kontakt">kotva</SiteLink>
        </MemoryRouter>
      </WebRouterContext.Provider>,
    );
    expect(fireEvent.click(screen.getByRole('link', { name: 'uvnitř' }))).toBe(false);
    expect(fireEvent.click(screen.getByRole('link', { name: 'ven' }))).toBe(true);
    expect(fireEvent.click(screen.getByRole('link', { name: 'cizí' }))).toBe(true);
    expect(screen.getByRole('link', { name: 'kotva' })).toHaveAttribute('href', '#kontakt');
  });
});

describe('PublicLayout (the application pages) still works with the new header and footer', () => {
  it('renders its children between the header and the footer without a query client', async () => {
    setViewport(VIEWPORTS.phone);
    render(
      <MemoryRouter initialEntries={['/objednat']}>
        <PublicLayout>
          <p>Obsah stránky</p>
        </PublicLayout>
      </MemoryRouter>,
    );
    expect(screen.getByText('Obsah stránky')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    // The footer takes the clinic's own details once they arrive.
    expect(await screen.findByRole('link', { name: '+420 111 222 333' })).toHaveAttribute('href', 'tel:+420111222333');
    // In the application, "Objednat termín" is a client-side link and the public sections are page loads.
    expect(screen.getAllByText('Objednat termín')[0].closest('a')).toHaveAttribute('href', '/objednat');
    expect(screen.getAllByText('Ceník')[0].closest('a')).toHaveAttribute('href', '/cenik');
  });

  it('can leave the footer out and hide the portal link', () => {
    render(
      <MemoryRouter>
        <PublicLayout noFooter hidePortalLink clinic={null}>x</PublicLayout>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('contentinfo')).toBeNull();
    expect(screen.queryByText('Můj portál')).toBeNull();
  });
});
