/*
 * "Poslední změny" under a settings page: the last five, "kdo · kdy · pole:
 * před → po", and gone - quietly - where the history cannot be read.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RecentChanges } from './RecentChanges';
import { formatChangeValue } from './changesApi';

const get = vi.fn();
vi.mock('../../api/client', () => ({ default: { get: (...a: unknown[]) => get(...a) }, client: { get: (...a: unknown[]) => get(...a) } }));

beforeEach(() => { get.mockReset(); });

describe('RecentChanges', () => {
  it('asks for five changes of the page\'s scope', async () => {
    get.mockResolvedValue({ data: { items: [], total: 0 } });
    render(<RecentChanges scope="pracovni-doba" />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get).toHaveBeenCalledWith('/api/v1/settings/changes', { params: { scope: 'pracovni-doba', take: 5 } });
  });

  it('shows who, when, which field and from what to what', async () => {
    get.mockResolvedValue({
      data: {
        items: [
          { at: '2026-10-03T12:05:00Z', user: 'Jana Nová', scope: 'pracovni-doba', label: 'Pondělí od', before: '08:00', after: '07:30' },
          { at: '2026-10-02T09:00:00Z', user: 'Admin', scope: 'pracovni-doba', label: 'Oběd zapnut', before: false, after: true },
        ],
        total: 2,
      },
    });
    render(<RecentChanges scope="pracovni-doba" />);

    expect(await screen.findByText(/Pondělí od: 08:00 → 07:30/)).toBeInTheDocument();
    expect(screen.getByText('Jana Nová')).toBeInTheDocument();
    expect(screen.getByText(/Oběd zapnut: ne → ano/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Poslední změny' })).toBeInTheDocument();
  });

  it('shows at most five lines', async () => {
    get.mockResolvedValue({
      data: {
        items: Array.from({ length: 8 }, (_, i) => ({ at: `2026-10-0${i + 1}T10:00:00Z`, user: `U${i}`, scope: 's', label: `Pole ${i}`, before: 'a', after: 'b' })),
        total: 8,
      },
    });
    render(<RecentChanges scope="s" />);
    await screen.findByText(/Pole 0/);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('says so, in one line, when nobody has changed anything', async () => {
    get.mockResolvedValue({ data: { items: [], total: 0 } });
    render(<RecentChanges scope="s" />);
    expect(await screen.findByText('Zatím tu nikdo nic neměnil.')).toBeInTheDocument();
  });

  it.each([404, 503, 500])('is not there at all on a %i', async (status) => {
    get.mockImplementation(() => Promise.reject({ response: { status } }));
    render(<RecentChanges scope="s" />);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Poslední změny' })).not.toBeInTheDocument());
    expect(screen.queryByText(/Zatím tu nikdo/)).not.toBeInTheDocument();
  });

  it('is not there when the answer is not a list of changes', async () => {
    get.mockResolvedValue({ data: '<html>not json</html>' });
    render(<RecentChanges scope="s" />);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Poslední změny' })).not.toBeInTheDocument());
  });
});

describe('formatChangeValue', () => {
  it('reads empty as a dash, switches as ano/ne and masked secrets as they come', () => {
    expect(formatChangeValue(null)).toBe('—');
    expect(formatChangeValue('')).toBe('—');
    expect(formatChangeValue(true)).toBe('ano');
    expect(formatChangeValue(false)).toBe('ne');
    expect(formatChangeValue('••••')).toBe('••••');
    expect(formatChangeValue(15)).toBe('15');
  });
});
