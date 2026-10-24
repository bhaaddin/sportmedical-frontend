/*
 * Kalendáře in the shelf look (Phase 2, S-5): the calendars are cards on one shelf, the služba is a connected chip, an
 * active calendar without a služba is "Vyžaduje pozornost" (and its link opens that calendar's form), and a calendar chip
 * elsewhere lands here with that calendar marked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { calendarDeepLink, calendarsAttention } from './calendarLifecycle';

const listCalendars = vi.fn();
const listServices = vi.fn();
vi.mock('../../api/calendars', () => ({
  calendarsApi: { list: listCalendars, create: vi.fn(), update: vi.fn(), remove: vi.fn(), deactivate: vi.fn(), activate: vi.fn(), getAccess: vi.fn().mockResolvedValue([]), setAccess: vi.fn() },
}));
vi.mock('../../api/clinicServices', () => ({ clinicServicesApi: { list: listServices } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [], warnings: [] }) } }));

const { default: CalendarsPage } = await import('./CalendarsPage');

const calendar = (over: Record<string, unknown> = {}) => ({
  id: 'c1', name: 'Ordinace 1', color: '#0D5C52', location: 'Praha', displayStepMinutes: 15, isActive: true, sortOrder: 1,
  clinicServiceId: 's1', publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null, ...over,
});
const service = (id: string, name: string) => ({ id, name, description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1, colorHex: null });

const show = (state?: Record<string, unknown>) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MemoryRouter initialEntries={[{ pathname: '/calendars', state }]}><CalendarsPage /></MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage']));
  setViewport(VIEWPORTS.desktop);
  listCalendars.mockReset().mockResolvedValue([calendar(), calendar({ id: 'c2', name: 'Laboratoř', clinicServiceId: null, sortOrder: 2 })]);
  listServices.mockReset().mockResolvedValue([service('s1', 'Prohlídky')]);
});

describe('Kalendáře as shelves', () => {
  it('draws each calendar as a card on the Kalendáře shelf, with its count', async () => {
    show();
    await screen.findAllByRole('region', { name: 'Kalendáře' });
    const shelf = document.querySelector('[data-shelf="calendars"]') as HTMLElement;
    await within(shelf).findByText('Ordinace 1');
    expect(within(shelf).getAllByRole('listitem').filter((el) => el.dataset.card === 'calendar')).toHaveLength(2);
    expect(within(shelf).getByLabelText('Počet: 2')).toBeInTheDocument();
  });

  it('the služba is a connected chip to that service', async () => {
    show();
    expect(await screen.findByRole('link', { name: /Prohlídky/ })).toHaveAttribute('href', '/nastaveni/sluzby/s1');
  });

  it('an active calendar without a služba is Vyžaduje pozornost, and its case opens that form', async () => {
    show();
    const shelf = await screen.findByRole('region', { name: 'Vyžaduje pozornost' });
    expect(within(shelf).getByRole('link', { name: /„Laboratoř“ bez služby/ })).toHaveAttribute('href', '/calendars');
  });

  it('draws no attention card when every active calendar runs a služba', async () => {
    listCalendars.mockResolvedValue([calendar(), calendar({ id: 'c2', name: 'Stará', isActive: false, clinicServiceId: null })]);
    show();
    await screen.findByText('Ordinace 1');
    expect(screen.queryByRole('region', { name: 'Vyžaduje pozornost' })).toBeNull();
  });

  it('editCalendarId opens that calendar\'s form', async () => {
    show({ editCalendarId: 'c2' });
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Název/)).toHaveValue('Laboratoř');
  });

  it('openCalendarId marks that calendar, and shows it even when it is inactive', async () => {
    listCalendars.mockResolvedValue([calendar(), calendar({ id: 'c3', name: 'Stará', isActive: false })]);
    show({ openCalendarId: 'c3' });
    const card = (await screen.findByText('Stará')).closest('[data-card="calendar"]') as HTMLElement;
    expect(card).toHaveAttribute('aria-current', 'true');
  });

  it('an empty list offers Nový kalendář as the next step', async () => {
    listCalendars.mockResolvedValue([]);
    show();
    await screen.findAllByRole('region', { name: 'Kalendáře' });
    const shelf = document.querySelector('[data-shelf="calendars"]') as HTMLElement;
    expect(await within(shelf).findByRole('button', { name: 'Nový kalendář' })).toBeInTheDocument();
  });

  it('a calendar links to its hours with the calendar id in router state', async () => {
    show();
    const card = (await screen.findByText('Ordinace 1')).closest('[data-card="calendar"]') as HTMLElement;
    expect(within(card).getByRole('link', { name: /Hodiny/ })).toHaveAttribute('href', '/working-hours');
  });
});

describe('the pure parts', () => {
  it('calendarsAttention counts only active calendars without a služba', () => {
    expect(calendarsAttention([{ id: 'a', name: 'A', isActive: true, clinicServiceId: 's' }])).toBeNull();
    const g = calendarsAttention([
      { id: 'a', name: 'A', isActive: true, clinicServiceId: null },
      { id: 'b', name: 'B', isActive: false, clinicServiceId: null },
    ]);
    expect(g?.count).toBe(1);
    expect(g?.items[0].state).toEqual({ editCalendarId: 'a' });
  });

  it('calendarDeepLink reads ids only and prefers the form', () => {
    expect(calendarDeepLink(null)).toBeNull();
    expect(calendarDeepLink({ openCalendarId: 'x' })).toEqual({ kind: 'open', id: 'x' });
    expect(calendarDeepLink({ editCalendarId: 'y', openCalendarId: 'x' })).toEqual({ kind: 'edit', id: 'y' });
    expect(calendarDeepLink({ openCalendarId: 5 })).toBeNull();
  });
});
