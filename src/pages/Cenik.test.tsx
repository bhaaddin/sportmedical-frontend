/*
 * Everybody reads the price list; only whoever may change the clinic's
 * settings sees the controls that change it. The server refuses the writes
 * without settings.clinic.manage, so a button offered to anybody else would
 * only ever produce a refusal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const getAll = vi.fn();
vi.mock('../api/services', () => ({ servicesApi: { getAll, archive: vi.fn() } }));

const { default: Cenik } = await import('./Cenik');

const item = {
  id: 's1',
  code: 'SLP-1',
  name: 'Sportovní prohlídka',
  description: '',
  category: '',
  durationMinutes: 60,
  priceCzk: 1200,
  vatRate: 0,
  isActive: true,
};

beforeEach(() => {
  getAll.mockReset().mockResolvedValue([item]);
});

afterEach(() => {
  localStorage.clear();
});

describe('Ceník', () => {
  it('shows the list without the editing controls to somebody who may not change it', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));

    render(<Cenik />);

    expect((await screen.findAllByText('Sportovní prohlídka')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Nová položka/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Upravit položku Sportovní prohlídka')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Vyřadit položku Sportovní prohlídka')).not.toBeInTheDocument();
  });

  it('offers them to somebody who holds settings.clinic.manage', async () => {
    localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));

    render(<Cenik />);

    expect(await screen.findByLabelText('Upravit položku Sportovní prohlídka')).toBeInTheDocument();
    expect(screen.getByLabelText('Vyřadit položku Sportovní prohlídka')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nová položka/ })).toBeInTheDocument();
  });
});
