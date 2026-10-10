/*
 * "Nová objednávka": služba first, then Rychlá registrace (the drawer on the
 * next free slot of that služba) or Vybrat v kalendáři. At the three widths.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setViewport, VIEWPORTS, type ViewportName } from '../../test/viewport';

const listServices = vi.fn();
const listCalendars = vi.fn();
const listActivities = vi.fn();
const getAvailability = vi.fn();

vi.mock('../../api/clinicServices', () => ({ clinicServicesApi: { list: listServices } }));
vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/appointments', () => ({ appointmentsApi: { getAvailability } }));

/* The drawer has its own tests; here it only has to receive the right slot. */
vi.mock('./NewAppointmentDialog', () => ({
  NewAppointmentDialog: (props: Record<string, unknown>) => (
    <pre data-testid="drawer">
      {JSON.stringify({
        calendar: props.initialCalendarId,
        start: props.initialStart,
        end: props.initialEnd,
        quick: props.initialQuick,
        activity: props.initialActivityId,
        service: props.initialServiceId,
      })}
    </pre>
  ),
}));

const { NewOrderChooser } = await import('./NewOrderChooser');

const service = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, description: '', sortOrder: 0, isActive: true, activities: 1, calendars: 1, colorHex: '#0D7377', ...extra,
});
const calendar = (id: string, serviceId: string | null, isActive = true) => ({
  id, name: id, color: '#000000', location: '', displayStepMinutes: 15, isActive, sortOrder: 0, clinicServiceId: serviceId,
});
const activity = (id: string, serviceId: string, duration = 30) => ({
  id, name: id, durationMinutes: duration, isActive: true, clinicServiceId: serviceId, sortOrder: 0,
});

function Probe() {
  const location = useLocation();
  return <pre data-testid="where">{JSON.stringify({ path: location.pathname, state: location.state })}</pre>;
}

function renderChooser() {
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/start']}>
        <Routes>
          <Route path="/start" element={<NewOrderChooser open onClose={onClose} />} />
          <Route path="/planovani" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onClose };
}

beforeEach(() => {
  listServices.mockReset().mockResolvedValue([
    service('s1', 'Sportovní prohlídky'),
    service('s2', 'Diagnostika', { colorHex: '#aa3300', sortOrder: 1 }),
    service('s3', 'Vyřazená', { isActive: false }),
  ]);
  listCalendars.mockReset().mockResolvedValue([calendar('c1', 's1'), calendar('c2', 's1'), calendar('c3', 's2')]);
  listActivities.mockReset().mockResolvedValue({
    activities: [activity('a1', 's1', 30), activity('a2', 's2', 60)],
    warnings: [],
  });
  getAvailability.mockReset().mockImplementation(async (calendarId: string) =>
    calendarId === 'c1'
      ? [{ startUtc: '2099-01-05T09:00:00Z', endUtc: '2099-01-05T09:30:00Z' }]
      : calendarId === 'c2'
        ? [{ startUtc: '2099-01-05T08:00:00Z', endUtc: '2099-01-05T08:30:00Z' }]
        : [],
  );
});

describe.each(['phone', 'tablet', 'desktop'] as ViewportName[])('NewOrderChooser at %s width', (name) => {
  beforeEach(() => setViewport(VIEWPORTS[name]));

  it('lists the active services with their colour and no club entry (a club order has its own entry)', async () => {
    renderChooser();
    const list = await screen.findByRole('group', { name: 'Služby' });
    expect(within(list).getAllByRole('button').map((i) => i.textContent)).toEqual(['Sportovní prohlídky', 'Diagnostika']);
    expect(within(list).getAllByTestId('service-colour')).toHaveLength(2);
    expect(screen.queryByText('Vyřazená')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Klubová objednávka' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby');
  });

  it('after a service offers Rychlá registrace and Vybrat v kalendáři', async () => {
    renderChooser();
    await userEvent.click(await screen.findByRole('button', { name: 'Sportovní prohlídky' }));
    expect(screen.getByRole('button', { name: /Rychlá registrace/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Vybrat v kalendáři/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Jiná služba' }));
    expect(await screen.findByRole('group', { name: 'Služby' })).toBeInTheDocument();
  });

  it('Rychlá registrace opens the drawer in quick mode on the earliest free slot of the service', async () => {
    renderChooser();
    await userEvent.click(await screen.findByRole('button', { name: 'Sportovní prohlídky' }));
    await userEvent.click(screen.getByRole('button', { name: /Rychlá registrace/ }));

    const drawer = JSON.parse((await screen.findByTestId('drawer')).textContent ?? '{}');
    /* c2 offers 08:00Z = 09:00 Prague (January), earlier than c1. */
    /* The calendar, the činnost and the služba handed over all belong together. */
    expect(drawer).toEqual({ calendar: 'c2', start: '2099-01-05T09:00', end: '2099-01-05T09:30', quick: true, activity: 'a1', service: 's1' });
    /* Only the service's own calendars were asked. */
    expect(getAvailability.mock.calls.map((c) => c[0]).sort()).toEqual(['c1', 'c2']);
  });

  it('says so when no free slot is found within the horizon', async () => {
    getAvailability.mockResolvedValue([]);
    renderChooser();
    await userEvent.click(await screen.findByRole('button', { name: 'Diagnostika' }));
    await userEvent.click(screen.getByRole('button', { name: /Rychlá registrace/ }));
    expect(await screen.findByText(/Pro službu „Diagnostika“ není v následujících \d+ dnech volný termín/)).toBeInTheDocument();
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
  });

  it('says so when the search itself fails, and stays open', async () => {
    getAvailability.mockRejectedValue(new Error('503'));
    renderChooser();
    await userEvent.click(await screen.findByRole('button', { name: 'Sportovní prohlídky' }));
    await userEvent.click(screen.getByRole('button', { name: /Rychlá registrace/ }));
    expect(await screen.findByText(/Volný termín se nepodařilo zjistit/)).toBeInTheDocument();
  });

  it('Vybrat v kalendáři navigates to /planovani with the service in state', async () => {
    const { onClose } = renderChooser();
    await userEvent.click(await screen.findByRole('button', { name: 'Diagnostika' }));
    await userEvent.click(screen.getByRole('button', { name: /Vybrat v kalendáři/ }));
    expect(JSON.parse((await screen.findByTestId('where')).textContent ?? '{}')).toEqual({
      path: '/planovani',
      state: { serviceId: 's2' },
    });
    expect(onClose).toHaveBeenCalled();
  });

});

describe('NewOrderChooser states', () => {
  beforeEach(() => setViewport(VIEWPORTS.desktop));

  it('says what failed when the services cannot be loaded, and retries', async () => {
    listServices.mockRejectedValueOnce(new Error('503'));
    renderChooser();
    expect(await screen.findByText('Služby se nepodařilo načíst.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByRole('group', { name: 'Služby' })).toBeInTheDocument();
  });

  it('says so when no service is active', async () => {
    listServices.mockResolvedValue([]);
    renderChooser();
    expect(await screen.findByText('Zatím tu není žádná aktivní služba.')).toBeInTheDocument();
  });

  it('a service nothing runs finds no slot without asking the server', async () => {
    listCalendars.mockResolvedValue([]);
    renderChooser();
    await userEvent.click(await screen.findByRole('button', { name: 'Sportovní prohlídky' }));
    await userEvent.click(screen.getByRole('button', { name: /Rychlá registrace/ }));
    expect(await screen.findByText(/není v následujících/)).toBeInTheDocument();
    expect(getAvailability).not.toHaveBeenCalled();
  });
});
