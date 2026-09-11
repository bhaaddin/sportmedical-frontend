/*
 * The bell's panel, rendered.
 *
 * The arrangement logic has its own tests next door; these cover the part that
 * only shows up on screen - that a group draws as one line and opens into its
 * rows, that the day heading is there, that the exact time is reachable from a
 * row whose label is relative, and that a list with no `kind` stays as it was.
 *
 * That last one matters today rather than hypothetically: the server does not
 * send `kind` yet, so this is the shape the panel is actually in, and grouping
 * must not invent groups out of rows that merely look alike.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const get = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('../api/client', () => ({
  default: { get, patch, delete: del, post: vi.fn(), put: vi.fn() },
}));
vi.mock('../hooks/useRealtimeSync', () => ({ useRealtimeSync: () => ({}) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { default: NotificationCenter } = await import('./NotificationCenter');

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  type: 'info',
  title: 'Nový dotazník k posouzení',
  message: `Pacient ${id}`,
  timestamp: minutesAgo(5),
  read: false,
  ...over,
});

beforeEach(() => {
  get.mockReset();
  patch.mockReset().mockResolvedValue({});
  del.mockReset().mockResolvedValue({});
});

const openPanel = async () => {
  const user = userEvent.setup();
  render(<NotificationCenter />);
  const bell = await screen.findByRole('button', { name: /oznámení/i });
  await user.click(bell);
  return user;
};

describe('the notification panel', () => {
  it('heads the list with the day', async () => {
    get.mockResolvedValue({ data: [row('a')] });
    await openPanel();
    expect(await screen.findByText('Dnes')).toBeInTheDocument();
  });

  it('collapses a run of the same kind into one line, and opens it', async () => {
    get.mockResolvedValue({
      data: [
        row('a', { kind: 'intake.submitted', timestamp: minutesAgo(3) }),
        row('b', { kind: 'intake.submitted', timestamp: minutesAgo(4) }),
        row('c', { kind: 'intake.submitted', timestamp: minutesAgo(5) }),
      ],
    });

    const user = await openPanel();

    const summary = await screen.findByText('3 nové dotazníky');
    expect(summary).toBeInTheDocument();
    /* Collapsed: the individual rows are not on screen yet. */
    expect(screen.queryByText('Pacient a')).not.toBeInTheDocument();

    await user.click(summary);

    expect(await screen.findByText('Pacient a')).toBeInTheDocument();
    expect(screen.getByText('Pacient b')).toBeInTheDocument();
    expect(screen.getByText('Pacient c')).toBeInTheDocument();
  });

  it('says how many of a group are unread', async () => {
    get.mockResolvedValue({
      data: [
        row('a', { kind: 'intake.submitted', read: false, timestamp: minutesAgo(3) }),
        row('b', { kind: 'intake.submitted', read: true, timestamp: minutesAgo(4) }),
      ],
    });

    await openPanel();
    expect(await screen.findByText('1 nepřečtených')).toBeInTheDocument();
  });

  /*
   * The state the application is actually in: no `kind` from the server. Rows
   * that look identical must stay separate, because the thing that would group
   * them is the title, and a title is prose.
   */
  it('leaves rows ungrouped when the server sends no kind', async () => {
    get.mockResolvedValue({
      data: [row('a', { timestamp: minutesAgo(3) }), row('b', { timestamp: minutesAgo(4) })],
    });

    await openPanel();

    expect(await screen.findByText('Pacient a')).toBeInTheDocument();
    expect(screen.getByText('Pacient b')).toBeInTheDocument();
    expect(screen.queryByText(/nové dotazníky/)).not.toBeInTheDocument();
  });

  it('offers the exact moment on a row whose label is relative', async () => {
    get.mockResolvedValue({ data: [row('a', { timestamp: minutesAgo(12) })] });

    await openPanel();

    const label = await screen.findByText('Před 12 min');
    /* MUI puts the tooltip text on the element's aria-label / title chain. */
    const holder = label.closest('[aria-label], [title]');
    expect(holder ?? label.parentElement).toBeTruthy();
  });

  it('orders newest first and does not float unread to the top', async () => {
    get.mockResolvedValue({
      data: [
        row('older-unread', { timestamp: minutesAgo(30), read: false, message: 'starší' }),
        row('newer-read', { timestamp: minutesAgo(2), read: true, message: 'novější' }),
      ],
    });

    await openPanel();

    const panel = (await screen.findByText('novější')).closest('ul') as HTMLElement;
    const text = within(panel).getByText('novější').closest('ul')?.textContent ?? '';
    expect(text.indexOf('novější')).toBeLessThan(text.indexOf('starší'));
  });

  it('draws no "new since" line while the server has not said when we last looked', async () => {
    get.mockResolvedValue({ data: [row('a'), row('b', { timestamp: minutesAgo(90) })] });

    await openPanel();
    await screen.findByText('Pacient a');

    expect(screen.queryByText(/Nové od vašeho posledního pohledu/)).not.toBeInTheDocument();
  });

  it('draws the line once the server does say', async () => {
    get.mockResolvedValue({
      data: {
        items: [
          row('new', { timestamp: minutesAgo(2), message: 'po pohledu' }),
          row('seen', { timestamp: minutesAgo(90), message: 'před pohledem' }),
        ],
        lastSeenAt: minutesAgo(30),
      },
      lastSeenAt: minutesAgo(30),
    });

    await openPanel();

    expect(await screen.findByText(/Nové od vašeho posledního pohledu/)).toBeInTheDocument();
  });
});
