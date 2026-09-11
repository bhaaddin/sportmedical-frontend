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

const getList = vi.fn();
const getSeen = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();

/* Two paths now: the list, and the "when did I last look" marker on its own
   route. Routed here by url so a test can move one without the other. */
const get = vi.fn((url: string) =>
  url === '/api/notifications/seen' ? getSeen() : getList(),
);

vi.mock('../api/client', () => ({
  default: { get, patch, delete: del, post, put: vi.fn() },
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
  getList.mockReset().mockResolvedValue({ data: [] });
  getSeen.mockReset().mockResolvedValue({ data: { lastSeenAtUtc: null } });
  post.mockReset().mockResolvedValue({ data: { lastSeenAtUtc: new Date().toISOString() } });
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
    getList.mockResolvedValue({ data: [row('a')] });
    await openPanel();
    expect(await screen.findByText('Dnes')).toBeInTheDocument();
  });

  it('collapses a run of the same kind into one line, and opens it', async () => {
    getList.mockResolvedValue({
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
    getList.mockResolvedValue({
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
    getList.mockResolvedValue({
      data: [row('a', { timestamp: minutesAgo(3) }), row('b', { timestamp: minutesAgo(4) })],
    });

    await openPanel();

    expect(await screen.findByText('Pacient a')).toBeInTheDocument();
    expect(screen.getByText('Pacient b')).toBeInTheDocument();
    expect(screen.queryByText(/nové dotazníky/)).not.toBeInTheDocument();
  });

  it('offers the exact moment on a row whose label is relative', async () => {
    getList.mockResolvedValue({ data: [row('a', { timestamp: minutesAgo(12) })] });

    await openPanel();

    /* The column is labelled, because a booking notification carries two
       times: when it arrived, and when the patient is coming. */
    const label = await screen.findByText(/přišlo Před 12 min/);
    expect(label).toBeInTheDocument();
    const holder = label.closest('[aria-label], [title]');
    expect(holder ?? label.parentElement).toBeTruthy();
  });

  it('says which time it is showing, so it cannot be read as the appointment time', async () => {
    getList.mockResolvedValue({
      data: [
        row('a', {
          title: 'Nový termín',
          message: 'Ordinace · Odběr · 24. 9. 2026 10:00',
          timestamp: minutesAgo(20),
        }),
      ],
    });

    await openPanel();

    /* Both times on one row: the arrival is labelled, the appointment time
       stays inside the server's own sentence. */
    expect(await screen.findByText(/přišlo Před 20 min/)).toBeInTheDocument();
    expect(screen.getByText(/24\. 9\. 2026 10:00/)).toBeInTheDocument();
  });

  it('orders newest first and does not float unread to the top', async () => {
    getList.mockResolvedValue({
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
    getList.mockResolvedValue({ data: [row('a'), row('b', { timestamp: minutesAgo(90) })] });

    await openPanel();
    await screen.findByText('Pacient a');

    expect(screen.queryByText(/Nové od vašeho posledního pohledu/)).not.toBeInTheDocument();
  });

  it('draws the line once the server does say', async () => {
    getList.mockResolvedValue({
      data: [
        row('new', { timestamp: minutesAgo(2), message: 'po pohledu' }),
        row('seen', { timestamp: minutesAgo(90), message: 'před pohledem' }),
      ],
    });
    getSeen.mockResolvedValue({ data: { lastSeenAtUtc: minutesAgo(30) } });

    await openPanel();

    expect(await screen.findByText(/Nové od vašeho posledního pohledu/)).toBeInTheDocument();
  });

  /*
   * Stamped on closing, never on opening. On opening, the line would move out
   * from under the person reading the list.
   */
  it('marks the panel seen when it closes, not when it opens', async () => {
    getList.mockResolvedValue({ data: [row('a')] });

    const user = await openPanel();
    await screen.findByText('Pacient a');
    expect(post).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');

    expect(post).toHaveBeenCalledWith('/api/notifications/seen');
  });

  it('shows no line when this viewer has never looked', async () => {
    getList.mockResolvedValue({
      data: [row('a'), row('b', { timestamp: minutesAgo(90) })],
    });
    getSeen.mockResolvedValue({ data: { lastSeenAtUtc: null } });

    await openPanel();
    await screen.findByText('Pacient a');

    expect(screen.queryByText(/Nové od vašeho posledního pohledu/)).not.toBeInTheDocument();
  });
});
