/*
 * EntityChip / EntityLink: the connection between pages. One icon and colour per kind, a click that opens the thing, and a
 * peek of three or four facts - only when a mouse rests on it or the keyboard reaches it, never on a touch, never for a
 * person who may not open it.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EntityRef } from './entities';

const loadPeek = vi.fn();
vi.mock('./peek', async (importOriginal) => ({ ...(await importOriginal<typeof import('./peek')>()), loadPeek: (...args: unknown[]) => loadPeek(...args) }));

const { EntityChip, EntityLink } = await import('./EntityLink');

const patient: EntityRef = { kind: 'patient', id: 'p1', label: 'Jana Marková' };
const invoice: EntityRef = { kind: 'invoice', id: 'i1', label: 'FA-2026-0014' };

const Where = () => {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}{JSON.stringify(location.state)}</output>;
};

const renderAt = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/start']}>
        <Routes>
          <Route path="/start" element={ui} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['patients.view', 'billing.manage']));
  loadPeek.mockReset().mockResolvedValue({
    facts: [{ label: 'Ročník', value: '1990' }, { label: 'Příští termín', value: 'žádný' }],
    status: { label: 'Aktivní', tone: 'green' },
  });
});

describe('the chip', () => {
  it('is a link to the entity, named by its kind and label', () => {
    renderAt(<EntityChip entity={patient} />);
    const link = screen.getByRole('link', { name: 'Pacient: Jana Marková' });
    expect(link).toHaveAttribute('href', '/patients/p1');
    expect(link).toHaveAttribute('data-entity', 'patient');
  });

  it('opens an invoice with its id in the router state, never a name', async () => {
    const user = userEvent.setup();
    renderAt(<EntityChip entity={invoice} />);
    await user.click(screen.getByRole('link', { name: 'Faktura: FA-2026-0014' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/billing{"invoiceId":"i1"}');
  });

  it('is plain text, not a dead link, for somebody who may not open the kind', () => {
    localStorage.setItem('permissions', JSON.stringify([]));
    renderAt(<EntityChip entity={invoice} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('FA-2026-0014')).toBeInTheDocument();
  });

  it('runs the click handler first, so a table row can stop its own navigation', async () => {
    const seen = vi.fn((e: React.MouseEvent) => e.stopPropagation());
    const row = vi.fn();
    renderAt(<div onClick={row}><EntityChip entity={patient} onNavigate={seen} /></div>);
    await userEvent.setup().click(screen.getByRole('link'));
    expect(seen).toHaveBeenCalledTimes(1);
    expect(row).not.toHaveBeenCalled();
  });
});

describe('the peek', () => {
  it('opens after a mouse has rested on the chip, shows the facts, and closes when it leaves', async () => {
    const user = userEvent.setup();
    renderAt(<EntityChip entity={patient} />);
    const link = screen.getByRole('link');

    await user.hover(link);
    const tip = await screen.findByRole('tooltip', undefined, { timeout: 2000 });
    expect(tip).toHaveTextContent('Jana Marková');
    expect(tip).toHaveTextContent('Pacient');
    await waitFor(() => expect(tip).toHaveTextContent('Ročník'));
    expect(tip).toHaveTextContent('1990');
    expect(tip).toHaveTextContent('Aktivní');
    expect(link).toHaveAttribute('aria-describedby', tip.id);
    expect(loadPeek).toHaveBeenCalledTimes(1);
    expect(loadPeek.mock.calls[0][0]).toMatchObject({ kind: 'patient', id: 'p1' });

    await user.unhover(link);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull(), { timeout: 2000 });
  });

  it('asks for nothing until somebody rests on it', () => {
    renderAt(<EntityChip entity={patient} />);
    expect(loadPeek).not.toHaveBeenCalled();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('a quick pass of the mouse does not open it', async () => {
    const user = userEvent.setup();
    renderAt(<EntityChip entity={patient} />);
    await user.hover(screen.getByRole('link'));
    await user.unhover(screen.getByRole('link'));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(loadPeek).not.toHaveBeenCalled();
  });

  it('opens for the keyboard and Escape closes it', async () => {
    const user = userEvent.setup();
    renderAt(<EntityChip entity={patient} />);

    await user.tab();
    expect(screen.getByRole('link')).toHaveFocus();
    const tip = await screen.findByRole('tooltip', undefined, { timeout: 2000 });
    expect(tip).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull(), { timeout: 2000 });
  });

  it('never opens on a touch', async () => {
    renderAt(<EntityChip entity={patient} />);
    const link = screen.getByRole('link');
    await act(async () => { fireEvent.pointerEnter(link, { pointerType: 'touch' }); });
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not peek for somebody who may not open it, and not when the page asks for none', async () => {
    localStorage.setItem('permissions', JSON.stringify([]));
    const user = userEvent.setup();
    const { unmount } = renderAt(<EntityChip entity={patient} />);
    await user.hover(screen.getByText('Jana Marková'));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.queryByRole('tooltip')).toBeNull();
    unmount();

    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    renderAt(<EntityChip entity={patient} peek={false} />);
    await user.hover(screen.getByRole('link'));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('says it could not load rather than staying empty, and never shows a loading skeleton for ever', async () => {
    loadPeek.mockRejectedValue(new Error('500'));
    const user = userEvent.setup();
    renderAt(<EntityChip entity={patient} />);
    await user.hover(screen.getByRole('link'));
    const tip = await screen.findByRole('tooltip', undefined, { timeout: 2000 });
    await waitFor(() => expect(tip).toHaveTextContent('Údaje se nepodařilo načíst.'));
  });

  it('says "Víc se dozvíte po otevření" when the entity has nothing to peek at', async () => {
    loadPeek.mockResolvedValue({ facts: [] });
    const user = userEvent.setup();
    renderAt(<EntityChip entity={patient} />);
    await user.hover(screen.getByRole('link'));
    await waitFor(() => expect(screen.getByRole('tooltip')).toHaveTextContent('Víc se dozvíte po otevření.'), { timeout: 2000 });
  });
});

describe('the inline link', () => {
  it('shows its own text and the same peek', async () => {
    const user = userEvent.setup();
    renderAt(<p>Pacient <EntityLink entity={patient}>paní Marková</EntityLink> přišla.</p>);
    const link = screen.getByRole('link', { name: 'paní Marková' });
    expect(link).toHaveAttribute('href', '/patients/p1');
    await user.hover(link);
    expect(await screen.findByRole('tooltip', undefined, { timeout: 2000 })).toHaveTextContent('Jana Marková');
  });

  it('is its label as plain text without the permission', () => {
    localStorage.setItem('permissions', JSON.stringify([]));
    renderAt(<EntityLink entity={patient} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Jana Marková')).toBeInTheDocument();
  });
});
