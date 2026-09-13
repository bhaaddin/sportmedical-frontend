/*
 * A calendar runs one služba, and one that runs none offers nothing.
 *
 * Not a warning - a silence. The server's `OfferedActivityIdsAsync` returns
 * `[]` for a calendar with no service, so the grid is empty, availability is
 * empty, and the day says nothing about why. Booking found it by reading the
 * live contract after their own deploy: they had shipped the filter and not
 * the field it filtered on, so every calendar was in that state and no screen
 * could get one out of it.
 *
 * Which makes this screen the only place the state is visible or fixable, and
 * these the tests for both halves: the picker that sets it, and the warning
 * that names a calendar still without one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const listCalendars = vi.fn();
const saveCalendar = vi.fn();
const listClinicServices = vi.fn();

vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: listCalendars,
    create: saveCalendar,
    update: saveCalendar,
    remove: vi.fn(),
    deactivate: vi.fn(),
    activate: vi.fn(),
    getAccess: vi.fn().mockResolvedValue([]),
    saveAccess: vi.fn(),
  },
}));
vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: { list: listClinicServices },
}));

const { default: CalendarsPage } = await import('./CalendarsPage');

const svc = (id: string, name: string, isActive = true) =>
  ({ id, name, description: '', sortOrder: 0, isActive, activities: 2, calendars: 1 });

const calendar = (over: Record<string, unknown> = {}) => ({
  id: 'c1', name: 'Ordinace', color: '#0D7377', location: '', displayStepMinutes: 15,
  isActive: true, sortOrder: 0, clinicServiceId: 's1',
  publicMinimumNoticeMinutes: null, publicHorizonDays: null,
  ...over,
});

beforeEach(() => {
  listCalendars.mockReset().mockResolvedValue([]);
  saveCalendar.mockReset().mockResolvedValue(calendar());
  listClinicServices.mockReset().mockResolvedValue([
    svc('s1', 'Sportovní lékařské prohlídky'),
    svc('s2', 'Sportovní diagnostika'),
  ]);
});

/*
 * Says whether the router state is still carrying a handoff.
 *
 * The screen spends it when the dialog closes, so this is how a test sees
 * that happen. It is NOT a signal that the decision was made - a handoff the
 * screen refuses is left exactly where it is - which is why the tests that
 * assert "nothing opened" wait on the services arriving instead.
 */
function HandoffProbe() {
  const { state } = useLocation();
  return <div>{state === null ? 'předání spotřebováno' : 'předání čeká'}</div>;
}

/* The client the last render was given, so a test can wait for the services
   to have actually landed. Asserting "no dialog" before then is satisfied by
   a screen that has not decided anything yet - a test that passes whether the
   guard exists or not, which is how the retired-service check first slipped
   through untested. */
let lastClient: QueryClient;
const servicesHaveArrived = () =>
  waitFor(() => expect(lastClient.getQueryData(['clinic-services'])).toBeDefined());

/* A router, because the screen reads `useLocation().state` - the Služby
   screen hands a service over that way when it sends somebody here to close a
   gap it can see and cannot fix. `state` carries the handoff. */
const withQueries = (ui: ReactNode, state: unknown = null) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  lastClient = client;
  return (
    <MemoryRouter initialEntries={[{ pathname: '/calendars', state }]}>
      <QueryClientProvider client={client}>
        {ui}
        <HandoffProbe />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

const openNew = async () => {
  render(withQueries(<CalendarsPage />));
  await userEvent.click(await screen.findByRole('button', { name: /Nový kalendář/i }));
  await screen.findByLabelText(/Název/);
};

describe('the service a calendar runs', () => {
  it('is asked for, and the save waits for it', async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText(/Název/), 'Ordinace');

    expect(screen.getByLabelText(/Služba/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Uložit/i })).toBeDisabled();
    expect(saveCalendar).not.toHaveBeenCalled();
  });

  it('lets the save go once one is chosen, and sends it', async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText(/Název/), 'Ordinace');

    await userEvent.click(screen.getByLabelText(/Služba/));
    await userEvent.click(await screen.findByRole('option', { name: 'Sportovní diagnostika' }));
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(saveCalendar).toHaveBeenCalled());
    expect(saveCalendar.mock.calls[0].at(-1)).toMatchObject({ clinicServiceId: 's2' });
  });

  /*
   * `PUT` is the whole calendar, so a form that forgets this clears it - and
   * renaming a calendar would silently stop it offering anything at all.
   */
  it('sends an existing calendar back with the service it already had', async () => {
    listCalendars.mockResolvedValue([calendar({ clinicServiceId: 's2' })]);

    render(withQueries(<CalendarsPage />));
    await userEvent.click(await screen.findByRole('button', { name: /Upravit/i }));
    await screen.findByLabelText(/Název/);

    await userEvent.type(screen.getByLabelText(/Název/), ' II');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(saveCalendar).toHaveBeenCalled());
    expect(saveCalendar.mock.calls[0].at(-1)).toMatchObject({ clinicServiceId: 's2' });
  });

  /*
   * A retired service is not something to point a calendar at. Written with a
   * retired one in the list on purpose: the first version of these fixtures
   * held only active services, so removing the filter changed nothing any of
   * them saw.
   */
  it('offers only the services still in use', async () => {
    listClinicServices.mockResolvedValue([
      svc('s1', 'Sportovní lékařské prohlídky'),
      svc('s9', 'Zrušená služba', false),
    ]);
    await openNew();

    await userEvent.click(screen.getByLabelText(/Služba/));
    expect(await screen.findByRole('option', { name: 'Sportovní lékařské prohlídky' }))
      .toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Zrušená služba' })).not.toBeInTheDocument();
  });

  it('says where to go when no service exists yet', async () => {
    listClinicServices.mockResolvedValue([]);
    await openNew();

    expect(await screen.findByText(/Nejdřív ji založte v Nastavení/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Uložit/i })).toBeDisabled();
  });
});

describe('a calendar already saved without a service', () => {
  /*
   * The state every calendar was in before booking's fix, and the one this
   * row exists to make visible. Nothing else on any screen says why such a
   * calendar offers nothing.
   */
  it('is named on its row', async () => {
    listCalendars.mockResolvedValue([calendar({ clinicServiceId: null })]);
    render(withQueries(<CalendarsPage />));

    expect(await screen.findByText(/Neprovozuje žádnou službu/)).toBeInTheDocument();
  });

  it('says which service the others run', async () => {
    listCalendars.mockResolvedValue([calendar({ clinicServiceId: 's1' })]);
    render(withQueries(<CalendarsPage />));

    expect(await screen.findByText('Sportovní lékařské prohlídky')).toBeInTheDocument();
    expect(screen.queryByText(/Neprovozuje žádnou službu/)).not.toBeInTheDocument();
  });

  /* A service that was deleted leaves a pointer to nothing - which reads the
     same as a working calendar unless the row says otherwise. */
  it('says so when the service it points at is gone', async () => {
    listCalendars.mockResolvedValue([calendar({ clinicServiceId: 'deleted' })]);
    render(withQueries(<CalendarsPage />));

    expect(await screen.findByText(/Služba už neexistuje/)).toBeInTheDocument();
  });
});

/*
 * Arriving from a služba that no calendar runs.
 *
 * The same handoff as on the činnosti screen and for the same reason: the
 * Služby screen can see that nothing runs the service and cannot fix it from
 * there, so its button sends the service here.
 */
describe('being sent here from a service nothing runs', () => {
  it('opens the form ready for that service', async () => {
    render(withQueries(<CalendarsPage />, { clinicServiceId: 's2' }));

    await screen.findByLabelText(/Název/);
    expect(screen.getByLabelText(/Služba/)).toHaveTextContent('Sportovní diagnostika');
  });

  it('opens nothing when nobody was sent', async () => {
    render(withQueries(<CalendarsPage />));

    await screen.findByRole('button', { name: /Nový kalendář/i });
    expect(screen.queryByLabelText(/Název/)).not.toBeInTheDocument();
  });

  /* The service could have been retired between the click and the load. */
  it('opens nothing for a service that is no longer offered', async () => {
    listClinicServices.mockResolvedValue([svc('s9', 'Zrušená služba', false)]);
    render(withQueries(<CalendarsPage />, { clinicServiceId: 's9' }));

    /* After the decision, not before it. */
    await servicesHaveArrived();
    expect(screen.queryByLabelText(/Název/)).not.toBeInTheDocument();
  });
});
