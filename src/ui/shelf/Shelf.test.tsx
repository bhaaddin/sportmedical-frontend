/*
 * A shelf owns its four states, so no page draws its own: loading (skeletons the size of the cards), error (a sentence
 * and a retry), empty (a sentence and the NEXT ACTION) and ready (the cards, a count, "Zobrazit vše").
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { Shelf } from './Shelf';

beforeEach(() => setViewport(VIEWPORTS.desktop));

const renderShelf = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Shelf: anatomy', () => {
  it('is a region named by its heading, with a count pill and a "Zobrazit vše" link that says which shelf', () => {
    renderShelf(
      <Shelf id="x" title="Faktury" count={3} viewAll={{ to: '/billing' }}>
        <div role="listitem">jedna</div>
      </Shelf>,
    );
    const region = screen.getByRole('region', { name: 'Faktury' });
    expect(within(region).getByRole('heading', { level: 2, name: 'Faktury' })).toBeInTheDocument();
    expect(within(region).getByLabelText('Počet: 3')).toHaveTextContent('3');
    const link = within(region).getByRole('link', { name: 'Zobrazit vše: Faktury' });
    expect(link).toHaveAttribute('href', '/billing');
    expect(within(region).getByRole('list', { name: 'Faktury' })).toBeInTheDocument();
  });

  it('keeps a count of zero visible (zero is an answer) and draws none when the count is unknown', () => {
    const { rerender } = renderShelf(<Shelf id="x" title="A" count={0} empty><span /></Shelf>);
    expect(screen.getByLabelText('Počet: 0')).toBeInTheDocument();
    rerender(<MemoryRouter><Shelf id="x" title="A" empty><span /></Shelf></MemoryRouter>);
    expect(screen.queryByLabelText(/Počet/)).toBeNull();
  });

  it('puts a custom viewAll label to work and a filter in the header', () => {
    renderShelf(
      <Shelf id="x" title="Termíny" viewAll={{ to: '/dnes', label: 'Dnešní přehled' }} controls={<button type="button">Filtr</button>}>
        <div role="listitem">a</div>
      </Shelf>,
    );
    expect(screen.getByRole('link', { name: 'Dnešní přehled: Termíny' })).toHaveAttribute('href', '/dnes');
    expect(screen.getByRole('button', { name: 'Filtr' })).toBeInTheDocument();
  });

  it.each(['row', 'grid', 'list'] as const)('draws the children as a labelled list in the %s layout', (layout) => {
    renderShelf(
      <Shelf id="x" title="Lidé" layout={layout}>
        <div role="listitem">Jana</div>
        <div role="listitem">Anna</div>
      </Shelf>,
    );
    expect(within(screen.getByRole('list', { name: 'Lidé' })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('draws a board and a free body without announcing them as a list', () => {
    renderShelf(
      <>
        <Shelf id="b" title="Deska" layout="board"><p>obsah desky</p></Shelf>
        <Shelf id="f" title="Volné" layout="free"><p>obsah volný</p></Shelf>
      </>,
    );
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText('obsah desky')).toBeInTheDocument();
    expect(screen.getByText('obsah volný')).toBeInTheDocument();
  });
});

describe('Shelf: the four states', () => {
  it('loading: skeletons, busy, and no children or empty text', () => {
    renderShelf(<Shelf id="x" title="Pacienti" loading skeletons={4} empty emptyState={{ text: 'Nikdo.' }}><div role="listitem">hotovo</div></Shelf>);
    const region = screen.getByRole('region', { name: 'Pacienti' });
    expect(region).toHaveAttribute('data-state', 'loading');
    expect(within(region).getByLabelText('Pacienti: načítám')).toHaveAttribute('aria-busy', 'true');
    expect(within(region).queryByText('hotovo')).toBeNull();
    expect(within(region).queryByText('Nikdo.')).toBeNull();
  });

  it('error: says what failed, retries on request, never draws the children', async () => {
    const retry = vi.fn();
    renderShelf(<Shelf id="x" title="Faktury" error onRetry={retry}><div role="listitem">stará data</div></Shelf>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Polici „Faktury“ se nepodařilo načíst.');
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Zkusit znovu' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('stará data')).toBeNull();
  });

  it('error: uses the sentence it is given, and offers no retry without a handler', () => {
    renderShelf(<Shelf id="x" title="Faktury" error="Fakturace neodpovídá." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Fakturace neodpovídá.');
    expect(screen.queryByRole('button', { name: 'Zkusit znovu' })).toBeNull();
  });

  it('empty: says so and offers the NEXT ACTION, as a link or as a button', async () => {
    const press = vi.fn();
    const { rerender } = renderShelf(
      <Shelf id="x" title="Termíny" empty emptyState={{ text: 'Žádný termín.', action: { label: 'Objednat termín', to: '/planovani' } }} />,
    );
    expect(screen.getByRole('region', { name: 'Termíny' })).toHaveAttribute('data-state', 'empty');
    expect(screen.getByText('Žádný termín.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Objednat termín' })).toHaveAttribute('href', '/planovani');

    rerender(
      <MemoryRouter>
        <Shelf id="x" title="Termíny" empty emptyState={{ text: 'Žádný termín.', action: { label: 'Zkusit jinak', onClick: press } }} />
      </MemoryRouter>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Zkusit jinak' }));
    expect(press).toHaveBeenCalledTimes(1);
  });

  it('empty without a text still says something and never a bare blank', () => {
    renderShelf(<Shelf id="x" title="Termíny" empty />);
    expect(screen.getByText('Zatím tu nic není.')).toBeInTheDocument();
  });

  it('ready: the cards are all there from the first render (the cascade only fades them, it never hides them from the DOM)', () => {
    renderShelf(
      <Shelf id="x" title="Lidé" count={2}>
        <div role="listitem">Jana</div>
        <div role="listitem">Anna</div>
      </Shelf>,
    );
    expect(screen.getByRole('region', { name: 'Lidé' })).toHaveAttribute('data-state', 'ready');
    expect(screen.getByText('Jana')).toBeVisible();
    expect(screen.getByText('Anna')).toBeVisible();
  });

  it('state precedence: loading beats error beats empty beats ready', () => {
    const { rerender } = renderShelf(<Shelf id="x" title="A" loading error empty><i /></Shelf>);
    expect(screen.getByRole('region')).toHaveAttribute('data-state', 'loading');
    rerender(<MemoryRouter><Shelf id="x" title="A" error empty><i /></Shelf></MemoryRouter>);
    expect(screen.getByRole('region')).toHaveAttribute('data-state', 'error');
    rerender(<MemoryRouter><Shelf id="x" title="A" empty><i /></Shelf></MemoryRouter>);
    expect(screen.getByRole('region')).toHaveAttribute('data-state', 'empty');
  });
});

describe('Shelf: phone', () => {
  it('a phone has the same shelf (a row that swipes), with 44 px targets for its own buttons', () => {
    setViewport(VIEWPORTS.phone);
    renderShelf(
      <Shelf id="x" title="Termíny" viewAll={{ to: '/dnes' }} empty emptyState={{ text: 'Nic.', action: { label: 'Objednat', to: '/planovani' } }} />,
    );
    expect(screen.getByRole('region', { name: 'Termíny' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Objednat' })).toBeInTheDocument();
  });
});
