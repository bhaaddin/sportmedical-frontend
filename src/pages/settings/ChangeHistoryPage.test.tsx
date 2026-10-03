/*
 * Historie změn: filters, a paged table with před → po, masked secrets, and
 * the load/error path - at 390 (cards), 834 and 1440 (table).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ChangeHistoryPage from './ChangeHistoryPage';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const get = vi.fn();
vi.mock('../../api/client', () => ({ default: { get: (...a: unknown[]) => get(...a) }, client: { get: (...a: unknown[]) => get(...a) } }));

const row = (i: number, extra: Record<string, unknown> = {}) => ({
  at: `2026-10-0${(i % 9) + 1}T10:00:00Z`, user: `Uživatel ${i}`, scope: 'pracovni-doba', label: `Pole ${i}`, before: `a${i}`, after: `b${i}`, ...extra,
});

const renderPage = () => render(<MemoryRouter initialEntries={['/nastaveni/historie-zmen']}><ChangeHistoryPage /></MemoryRouter>);

beforeEach(() => {
  get.mockReset();
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
  setViewport(VIEWPORTS.desktop);
});

describe('Historie změn', () => {
  it('asks for the first page and shows before → after', async () => {
    get.mockResolvedValue({ data: { items: [row(1), row(2)], total: 2 } });
    renderPage();

    expect(await screen.findByText('Pole 1')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/v1/audit/changes', { params: { take: 25, skip: 0 } });
    const table = screen.getByRole('table', { name: 'Historie změn' });
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Kdy', 'Kdo', 'Oblast', 'Pole', 'Před', 'Po']);
    expect(within(table).getByText('a1')).toBeInTheDocument();
    expect(within(table).getByText('b1')).toBeInTheDocument();
    expect(screen.getByText('1–2 z 2')).toBeInTheDocument();
  });

  it('never prints a secret, even one the server forgot to mask', async () => {
    get.mockResolvedValue({ data: { items: [row(1, { label: 'Heslo ADAM', before: 'stare-heslo', after: 'nove-heslo' })], total: 1 } });
    renderPage();

    await screen.findByText('Heslo ADAM');
    expect(document.body.textContent).not.toContain('stare-heslo');
    expect(document.body.textContent).not.toContain('nove-heslo');
    expect(screen.getAllByText('••••••').length).toBe(2);
  });

  it('sends the filters: scope, dates and user', async () => {
    const user = userEvent.setup();
    get.mockResolvedValue({ data: { items: [], total: 0 } });
    renderPage();
    await screen.findByText('Žádné změny');

    await user.click(screen.getByLabelText('Oblast'));
    await user.click(await screen.findByRole('option', { name: /Otevírací doba/ }));
    await user.type(screen.getByLabelText('Od data'), '2026-10-01');
    await user.type(screen.getByLabelText('Do data'), '2026-10-03');
    await user.type(screen.getByLabelText('Uživatel'), ' jana ');
    await user.click(screen.getByRole('button', { name: 'Filtrovat' }));

    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/api/v1/audit/changes', {
      params: { take: 25, skip: 0, scope: 'pracovni-doba', from: '2026-10-01', to: '2026-10-03', user: 'jana' },
    }));
  });

  it('pages: Další asks for the next 25', async () => {
    const user = userEvent.setup();
    get.mockImplementation((_u: string, o: { params: { skip: number } }) =>
      Promise.resolve({ data: { items: [row(o.params.skip === 0 ? 1 : 2)], total: 60 } }));
    renderPage();

    await screen.findByText('Pole 1');
    expect(screen.getByRole('button', { name: 'Předchozí' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Další' }));
    expect(await screen.findByText('Pole 2')).toBeInTheDocument();
    expect(get).toHaveBeenLastCalledWith('/api/v1/audit/changes', { params: { take: 25, skip: 25 } });
    expect(screen.getByText('26–50 z 60')).toBeInTheDocument();
  });

  it('says what failed, and Zkusit znovu loads again', async () => {
    const user = userEvent.setup();
    get.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    expect(await screen.findByText('Historii změn se nepodařilo načíst.')).toBeInTheDocument();
    get.mockResolvedValue({ data: { items: [row(1)], total: 1 } });
    await user.click(screen.getByRole('button', { name: /Zkusit znovu/ }));
    expect(await screen.findByText('Pole 1')).toBeInTheDocument();
  });

  it('says so when nothing matches the filter', async () => {
    get.mockResolvedValue({ data: { items: [], total: 0 } });
    renderPage();
    expect(await screen.findByText('Žádné změny')).toBeInTheDocument();
  });

  it('draws cards instead of a table on a phone', async () => {
    setViewport(VIEWPORTS.phone);
    get.mockResolvedValue({ data: { items: [row(1)], total: 1 } });
    renderPage();

    expect(await screen.findByText('Pole 1')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('a1 → b1')).toBeInTheDocument();
  });

  it('draws the table on an iPad', async () => {
    setViewport(VIEWPORTS.tablet);
    get.mockResolvedValue({ data: { items: [row(1)], total: 1 } });
    renderPage();
    expect(await screen.findByRole('table', { name: 'Historie změn' })).toBeInTheDocument();
  });
});
