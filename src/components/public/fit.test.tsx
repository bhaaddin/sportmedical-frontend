/*
 * The fit rule of the public pages, as structure (jsdom has no layout engine; the measured proof is
 * scripts/responsive-audit-public.mjs in a real Chromium):
 *   - an application page (PublicLayout) is exactly one viewport high and clips: the document never scrolls;
 *   - its body is one scrolling region (`data-fit-scroll`), with the footer closing it, plus a slim footer bar for the wide layout;
 *   - a workspace puts panes in a grid under a fixed head; a Pane has a fixed header and a scrolling body;
 *   - the price board (/cenik) is a fit page of the site, every other page of the site is long-form;
 *   - the touch-size and dvh rules the audit found.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VIEWPORTS, setViewport } from '../../test/viewport';
import PublicLayout from '../../pages/public/PublicLayout';
import { renderWeb, TEST_PRICE_LIST } from '../../web/testUtils';
import { WebLayout } from '../../web/WebLayout';
import { WEB_ROUTES } from '../../web/routes';
import CenikPage from '../../web/pages/CenikPage';
import { normalizeBootstrap } from '../../web/data';
import { FIT_NARROW, FIT_WIDE, NoticeScreen, Pane, PaneColumn, PublicMain, scrollPublicTop } from './kit';

vi.mock('../../api/clinicSettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/clinicSettings')>();
  return { ...actual, readPublicClinic: () => Promise.resolve({ name: '', email: 'x@y.cz', phone: '+420 111 222 333', address: 'Praha 4', bookingEnabled: true }) };
});

afterEach(cleanup);

const WIDTHS = [['phone', VIEWPORTS.phone, 844], ['tablet', VIEWPORTS.tablet, 1112], ['desktop', VIEWPORTS.desktop, 900]] as const;

describe.each(WIDTHS)('an application page at %s', (_name, width, height) => {
  const page = () => (
    <MemoryRouter>
      <PublicLayout>
        <PublicMain workspace maxWidth="none" columns="minmax(0, 1fr) minmax(0, 1fr)" head={<h1>Nadpis</h1>} foot={<button type="button">Odeslat</button>}>
          <PaneColumn><p>Levý sloupec</p></PaneColumn>
          <Pane title={<h2>Pravý panel</h2>}><p>Tělo panelu</p></Pane>
        </PublicMain>
      </PublicLayout>
    </MemoryRouter>
  );

  it('is one viewport high and clips, so the document cannot scroll', () => {
    setViewport(width, height);
    const { container } = render(page());
    const root = container.firstElementChild as HTMLElement;
    const style = getComputedStyle(root);
    // a fixed height (100vh, 100dvh where supported), not 'auto' and not a min-height that content could stretch
    expect(style.height).not.toBe('auto');
    expect(Number.parseFloat(style.height)).toBeGreaterThan(0);
    expect(style.overflow).toBe('hidden');
    expect(style.display).toBe('flex');
    // the region between the header and the footer may shrink below its content: that is what lets it scroll instead of the page
    expect(getComputedStyle(container.querySelector('main') as HTMLElement).minHeight).toBe('0px');
  });

  it('has exactly one scrolling region, the head outside the panes, and the pane header outside the pane body', () => {
    setViewport(width, height);
    const { container } = render(page());
    expect(container.querySelectorAll('[data-fit-scroll]')).toHaveLength(1);
    const workspace = container.querySelector('[data-fit-workspace]') as HTMLElement;
    expect(workspace).not.toBeNull();
    expect(workspace.contains(screen.getByText('Levý sloupec'))).toBe(true);
    expect(workspace.contains(screen.getByRole('heading', { name: 'Nadpis' }))).toBe(false);
    const body = container.querySelector('[data-pane-body]') as HTMLElement;
    expect(body.contains(screen.getByText('Tělo panelu'))).toBe(true);
    expect(body.contains(screen.getByRole('heading', { name: 'Pravý panel' }))).toBe(false);
    expect(screen.getByRole('button', { name: 'Odeslat' })).toBeInTheDocument();
  });

  it('offers the footer twice, the full one closing the scrolling region and a slim bar, each shown by CSS for its layout', () => {
    setViewport(width, height);
    const { container } = render(page());
    const region = container.querySelector('[data-fit-scroll]') as HTMLElement;
    expect(region.querySelector('footer')).not.toBeNull();
    expect(container.querySelector('[data-testid="footer-bar"]')).not.toBeNull();
    expect(FIT_WIDE).toContain('min-width: 720px');
    expect(FIT_NARROW).toContain('not all');
  });
});

describe('scrollPublicTop', () => {
  it('puts the page region back to its top (the document itself never scrolls)', () => {
    const { container } = render(<MemoryRouter><PublicLayout><PublicMain><p>x</p></PublicMain></PublicLayout></MemoryRouter>);
    const region = container.querySelector('[data-fit-scroll]') as HTMLElement;
    region.scrollTop = 300;
    scrollPublicTop();
    expect(region.scrollTop).toBe(0);
  });
});

describe('a whole-screen notice', () => {
  it('is a workspace with one pane that carries the message, whatever the width', () => {
    setViewport(VIEWPORTS.desktop, 900);
    const { container } = render(<MemoryRouter><PublicLayout><NoticeScreen><p>Odkaz neplatí</p></NoticeScreen></PublicLayout></MemoryRouter>);
    const workspace = container.querySelector('[data-fit-workspace]') as HTMLElement;
    expect(workspace.children).toHaveLength(1);
    expect(workspace.contains(screen.getByText('Odkaz neplatí'))).toBe(true);
  });
});

describe('the site: the price board is a fit page, the rest scrolls', () => {
  it('marks /cenik and only /cenik as a fit page', () => {
    expect(WEB_ROUTES.filter((route) => route.fit === true).map((route) => route.path)).toEqual(['/cenik']);
  });

  it.each(WIDTHS)('/cenik at %s: the layout is one screen high, the board has chips that filter it', (_name, width) => {
    const seed = normalizeBootstrap({ priceList: TEST_PRICE_LIST }, 1);
    const { container } = renderWeb(<WebLayout><CenikPage /></WebLayout>, { route: '/cenik', width, seed });
    const root = container.firstElementChild as HTMLElement;
    expect(getComputedStyle(root).overflow).toBe('hidden');
    expect(container.querySelectorAll('[data-fit-scroll]')).toHaveLength(1);

    const nav = screen.getByRole('navigation', { name: 'Kategorie ceníku' });
    const chips = nav.querySelectorAll('button');
    expect(chips.length).toBeGreaterThanOrEqual(TEST_PRICE_LIST.length + 3); // Vše, the categories, the notes, the clubs
    expect(screen.getByRole('button', { name: 'Vše' })).toHaveAttribute('aria-pressed', 'true');

    // every category is listed, then one chip narrows the board to it
    for (const group of TEST_PRICE_LIST) expect(screen.getAllByText(group.category).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: TEST_PRICE_LIST[1].category }));
    expect(screen.getByRole('button', { name: TEST_PRICE_LIST[1].category })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector(`[data-fit-scroll] h2#${CSS.escape('sportovni-diagnostika')}`)).not.toBeNull();
    expect(screen.queryByText('Základní sportovní prohlídka')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vše' }));
    expect(screen.getAllByText('Základní sportovní prohlídka').length).toBeGreaterThan(0);
  });

  it('a long-form page of the site scrolls with the document, as before', () => {
    const { container } = renderWeb(<WebLayout><p>Obsah</p></WebLayout>, { route: '/sluzby', width: VIEWPORTS.desktop });
    const root = container.firstElementChild as HTMLElement;
    expect(getComputedStyle(root).overflow).not.toBe('hidden');
    expect(container.querySelector('[data-fit-scroll]')).toBeNull();
  });
});

describe('the sizes the audit measured', () => {
  it('every link of the footer and of the slim footer bar is a 44 px target', () => {
    const { container } = renderWeb(<WebLayout><p>Obsah</p></WebLayout>, { route: '/sluzby', width: VIEWPORTS.desktop });
    const footer = container.querySelector('footer') as HTMLElement;
    const links = [...footer.querySelectorAll('a[href^="/"], a[href^="tel:"], a[href^="mailto:"]')]; // the address is a tall multi-line map link
    expect(links.length).toBeGreaterThan(8);
    for (const link of links) expect(Number.parseFloat(getComputedStyle(link).minHeight), link.textContent ?? '').toBeGreaterThanOrEqual(44);
  });

  it('the slim footer bar has the same legal links and the clinic contact', () => {
    setViewport(VIEWPORTS.desktop, 900);
    const { container } = render(<MemoryRouter><PublicLayout><PublicMain><p>x</p></PublicMain></PublicLayout></MemoryRouter>);
    const bar = container.querySelector('[data-testid="footer-bar"]') as HTMLElement;
    const hrefs = [...bar.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/obchodni-podminky');
    expect(hrefs).toContain('/ochrana-osobnich-udaju');
    for (const link of bar.querySelectorAll('a')) expect(Number.parseFloat(getComputedStyle(link).minHeight)).toBeGreaterThanOrEqual(44);
  });
});
