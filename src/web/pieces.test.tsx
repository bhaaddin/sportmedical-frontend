import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWeb } from './testUtils';
import { WebErrorBoundary } from './WebErrorBoundary';
import { FaqList } from './Faq';
import { PageHero, PriceRow, WebSection } from './ui';
import { VIEWPORTS } from '../test/viewport';

vi.mock('./http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http')>();
  return { ...actual, webHttp: { get: () => Promise.reject(new Error('Network Error')) } };
});

afterEach(cleanup);

describe('WebErrorBoundary — never a white screen', () => {
  it('shows what failed and a "Zkusit znovu" button that tries again', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let explode = true;
    function Page() {
      if (explode) throw new Error('boom');
      return <p>Hotovo</p>;
    }
    renderWeb(
      <WebErrorBoundary resetKey="/web">
        <Page />
      </WebErrorBoundary>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Stránku se nepodařilo zobrazit' })).toBeInTheDocument();
    explode = false;
    fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(screen.getByText('Hotovo')).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('FaqList', () => {
  it.each([VIEWPORTS.phone, VIEWPORTS.tablet, VIEWPORTS.desktop])('lists the default questions as native accordions at %i px', (width) => {
    const { container } = renderWeb(<FaqList />, { width });
    expect(container.querySelectorAll('details').length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText('Jak dlouho posudek platí?')).toBeInTheDocument();
  });
});

describe('the building blocks for the inner pages', () => {
  it('PriceRow shows a dash for an unknown price and the formatted price for a known one', () => {
    renderWeb(
      <>
        <PriceRow to="/web/cenik" name="Neznámá cena" item={null} />
        <PriceRow to="/web/cenik" name="Známá cena" item={{ code: 'x', name: 'Známá cena', description: '', priceCzk: 4321, durationMinutes: 45 }} />
      </>,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/^4\s321\sKč$/)).toBeInTheDocument();
    expect(screen.getByText(/^45\smin$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Známá cena/ })).toHaveAttribute('href', '/web/cenik');
  });

  it('PageHero and WebSection render their content', () => {
    renderWeb(
      <>
        <PageHero eyebrow="Ceník" title="Co kolik stojí" lead="Úvod" />
        <WebSection tone="warm"><p>Obsah</p></WebSection>
      </>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Co kolik stojí' })).toBeInTheDocument();
    expect(screen.getByText('Obsah')).toBeInTheDocument();
  });
});
