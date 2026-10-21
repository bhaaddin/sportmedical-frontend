/*
 * PageFrame: the header of every shelf page. One h1, one line of purpose, the primary action (pinned on a phone), the
 * palette button (not on a phone: its top bar has one), status badges and connected chips.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { OPEN_SEARCH_EVENT } from '../../components/UniversalSearch';
import { PageFrame } from './PageFrame';

const renderFrame = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['patients.view']));
  setViewport(VIEWPORTS.desktop);
});

describe('PageFrame', () => {
  it('has one h1, the purpose under it and the shelves in the body', () => {
    renderFrame(
      <PageFrame title="Pacienti" purpose="Kartotéka kliniky">
        <section aria-label="Polička">obsah</section>
      </PageFrame>,
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pacienti');
    expect(screen.getByText('Kartotéka kliniky')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Polička' })).toBeInTheDocument();
  });

  it('draws the primary action in the header on a desktop and a tablet, as a link or a button', async () => {
    const press = vi.fn();
    const { unmount } = renderFrame(<PageFrame title="A" primaryAction={{ label: 'Nový pacient', to: '/patients/register' }} />);
    expect(screen.getByRole('link', { name: 'Nový pacient' })).toHaveAttribute('href', '/patients/register');
    expect(screen.queryByRole('region', { name: 'Hlavní akce' })).toBeNull();
    unmount();

    setViewport(VIEWPORTS.tablet);
    renderFrame(<PageFrame title="A" primaryAction={{ label: 'Objednat', onClick: press }} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Objednat' }));
    expect(press).toHaveBeenCalledTimes(1);
  });

  it('pins the primary action at the bottom of a phone, once, and not in the header', () => {
    setViewport(VIEWPORTS.phone);
    renderFrame(<PageFrame title="A" primaryAction={{ label: 'Nový pacient', to: '/patients/register' }} />);
    const pinned = screen.getByRole('region', { name: 'Hlavní akce' });
    expect(pinned).toHaveAttribute('data-pinned', 'true');
    expect(within(pinned).getByRole('link', { name: 'Nový pacient' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Nový pacient' })).toHaveLength(1);
  });

  it('has the palette button on a desktop and a tablet, and it asks the shell to open the palette', async () => {
    const heard = vi.fn();
    window.addEventListener(OPEN_SEARCH_EVENT, heard);
    renderFrame(<PageFrame title="A" />);
    const button = screen.getByRole('button', { name: 'Hledat' });
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K');
    await userEvent.setup().click(button);
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_SEARCH_EVENT, heard);
  });

  it('has no palette button on a phone (its top bar has one) and none when the page asks for none', () => {
    setViewport(VIEWPORTS.phone);
    const { unmount } = renderFrame(<PageFrame title="A" />);
    expect(screen.queryByRole('button', { name: 'Hledat' })).toBeNull();
    unmount();

    setViewport(VIEWPORTS.desktop);
    renderFrame(<PageFrame title="A" search={false} />);
    expect(screen.queryByRole('button', { name: 'Hledat' })).toBeNull();
  });

  it('draws a breadcrumb whose last crumb is the page, the rest links', () => {
    renderFrame(<PageFrame title="Karta" breadcrumb={[{ label: 'Pacienti', to: '/patients' }, { label: 'Jana Marková' }]} />);
    const trail = screen.getByRole('navigation', { name: 'Cesta' });
    expect(within(trail).getByRole('link', { name: 'Pacienti' })).toHaveAttribute('href', '/patients');
    expect(within(trail).getByText('Jana Marková')).toHaveAttribute('aria-current', 'page');
  });

  it('draws status badges and connected chips, each chip a link to the thing', () => {
    renderFrame(
      <PageFrame
        title="Jana Marková"
        badges={<span>Aktivní</span>}
        entities={[{ kind: 'club', id: 'c1', label: 'FC Sparta' }, { kind: 'invoice', id: 'i1', label: 'FA-1' }]}
      />,
    );
    expect(screen.getByText('Aktivní')).toBeInTheDocument();
    const chips = screen.getByRole('list', { name: 'Propojené' });
    expect(within(chips).getByRole('link', { name: 'Klub: FC Sparta' })).toHaveAttribute('href', '/clubs/c1');
    /* No billing.manage in this test: the invoice is named but is not a link. */
    expect(within(chips).queryByRole('link', { name: /FA-1/ })).toBeNull();
    expect(within(chips).getByText('FA-1')).toBeInTheDocument();
  });

  it('does not scroll the document itself: it is a page frame, not a window', () => {
    const { container } = renderFrame(<PageFrame title="A" fit>x</PageFrame>);
    expect(container.querySelector('[data-fit-page]')).not.toBeNull();
    expect(container.querySelector('[data-shelf-body]')).not.toBeNull();
  });
});
