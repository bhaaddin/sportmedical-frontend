/*
 * Assigning činnosti and kalendáře to a služba, from the služba.
 *
 * The owner sent two versions of this back. The first told him to go and edit
 * each calendar. The second sent him to a list to do the same thing one row at
 * a time - "ja si kompolikoane musim dat editovat teraz a potom to priradit
 * .... to mi fakt nevies spravit do pcici okienko rozrolovacie kde si to uz
 * len vybriem ?? ved ako to robia profesionaly".
 *
 * He was right both times. The link lives on the other side in the API, and
 * that is the API's business - turning it into several `PUT`s behind one tick
 * is what this screen is for.
 *
 * The one thing that is genuinely the server's rule and shows through: a
 * činnost must belong to a service, so it can be ticked here and never
 * unticked. A calendar's service is nullable, so it can be both.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const listClinicServices = vi.fn();
const updateService = vi.fn();
const listActivities = vi.fn();
const updateActivity = vi.fn();
const listCalendars = vi.fn();
const updateCalendar = vi.fn();

vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: {
    list: listClinicServices,
    create: vi.fn(),
    update: updateService,
    remove: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}));
vi.mock('../../api/activities', () => ({
  activitiesApi: { list: listActivities, update: updateActivity },
}));
vi.mock('../../api/calendars', () => ({
  calendarsApi: { list: listCalendars, update: updateCalendar },
}));

const { default: ClinicServicesPage } = await import('./ClinicServicesPage');

const svc = (over: Record<string, unknown> = {}) => ({
  id: 's1', name: 'Sportovní lékařské prohlídky', description: '',
  sortOrder: 0, isActive: true, activities: 0, calendars: 0, ...over,
});

const act = (over: Record<string, unknown> = {}) => ({
  id: 'a1', name: 'Spiroergometrie', slug: 'spiro', durationMinutes: 90,
  color: '#0D7377', publicNote: 'pozn', isPubliclyBookable: true, sortOrder: 3,
  isActive: true, serviceItemId: 'item-7', priceCzk: 1200, clinicServiceId: null,
  ...over,
});

const cal = (over: Record<string, unknown> = {}) => ({
  id: 'c1', name: 'Ordinace', color: '#0D7377', location: 'přízemí',
  displayStepMinutes: 15, isActive: true, sortOrder: 2, clinicServiceId: null,
  publicMinimumNoticeMinutes: 60, publicHorizonDays: 30, ...over,
});

beforeEach(() => {
  listClinicServices.mockReset().mockResolvedValue([svc()]);
  updateService.mockReset().mockImplementation(async () => svc());
  listActivities.mockReset().mockResolvedValue({ activities: [], warnings: [] });
  updateActivity.mockReset().mockResolvedValue({ activity: {}, warnings: [] });
  listCalendars.mockReset().mockResolvedValue([]);
  updateCalendar.mockReset().mockResolvedValue(cal());
});

/* Stands in for the destination, so a test can see what it was handed. */
function Landing({ label }: { label: string }) {
  const { state } = useLocation();
  const id = (state as { clinicServiceId?: string } | null)?.clinicServiceId ?? 'nic';
  return <div>{`${label} dostal ${id}`}</div>;
}

const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const ui: ReactNode = (
    <Routes>
      <Route path="/sluzby" element={<ClinicServicesPage />} />
      <Route path="/activities" element={<Landing label="Činnosti" />} />
      <Route path="/calendars" element={<Landing label="Kalendáře" />} />
    </Routes>
  );
  render(
    <MemoryRouter initialEntries={['/sluzby']}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
};

const openTheService = async () => {
  show();
  await userEvent.click(await screen.findByRole('button', { name: /Upravit službu/i }));
  await screen.findByLabelText(/Název/);
};

const pick = async (label: RegExp, option: string) => {
  await userEvent.click(screen.getByLabelText(label));
  const listbox = await screen.findByRole('listbox');
  await userEvent.click(within(listbox).getByRole('option', { name: new RegExp(option) }));
  await userEvent.keyboard('{Escape}');
};

describe('the gap warning', () => {
  /* It used to leave the screen. Both versions of that came back; it opens
     the service now, where the picker is. */
  it('opens the service rather than sending him somewhere', async () => {
    show();

    await userEvent.click(await screen.findByRole('button', { name: /^Přiřadit$/i }));

    expect(await screen.findByLabelText(/Činnosti/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Kalendáře/)).toBeInTheDocument();
  });

  it('says nothing on a service that is set up', async () => {
    listClinicServices.mockResolvedValue([svc({ activities: 3, calendars: 1 })]);
    show();

    await screen.findByText('Sportovní lékařské prohlídky');
    expect(screen.queryByRole('button', { name: /^Přiřadit$/i })).not.toBeInTheDocument();
  });
});

describe('ticking what belongs under the service', () => {
  it('opens with what is already under it ticked', async () => {
    listActivities.mockResolvedValue({
      activities: [act({ clinicServiceId: 's1' }), act({ id: 'a2', name: 'Zátěžové EKG' })],
      warnings: [],
    });
    await openTheService();

    expect(screen.getByLabelText(/Činnosti/)).toHaveTextContent('Spiroergometrie');
    expect(screen.getByLabelText(/Činnosti/)).not.toHaveTextContent('Zátěžové EKG');
  });

  it('moves a ticked činnost under this service', async () => {
    listActivities.mockResolvedValue({ activities: [act()], warnings: [] });
    await openTheService();

    await pick(/Činnosti/, 'Spiroergometrie');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    expect(updateActivity.mock.calls[0][0]).toBe('a1');
    expect(updateActivity.mock.calls[0][1]).toMatchObject({ clinicServiceId: 's1' });
  });

  /*
   * `PUT` is the whole entity in this lane. Sending only the new link would
   * clear everything left out - and dropping `serviceItemId` takes the
   * činnost's price away, silently, on a click that said "assign".
   */
  it('sends the whole činnost back, so nothing is quietly cleared', async () => {
    listActivities.mockResolvedValue({ activities: [act()], warnings: [] });
    await openTheService();

    await pick(/Činnosti/, 'Spiroergometrie');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(updateActivity).toHaveBeenCalled());
    expect(updateActivity.mock.calls[0][1]).toMatchObject({
      name: 'Spiroergometrie',
      durationMinutes: 90,
      color: '#0D7377',
      publicNote: 'pozn',
      isPubliclyBookable: true,
      sortOrder: 3,
      serviceItemId: 'item-7',
    });
  });

  it('points a ticked calendar at this service', async () => {
    listCalendars.mockResolvedValue([cal()]);
    await openTheService();

    await pick(/Kalendáře/, 'Ordinace');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(updateCalendar).toHaveBeenCalled());
    expect(updateCalendar.mock.calls[0][1]).toMatchObject({
      clinicServiceId: 's1',
      location: 'přízemí',
      displayStepMinutes: 15,
      publicMinimumNoticeMinutes: 60,
      publicHorizonDays: 30,
    });
  });

  /* A calendar's service is nullable, so taking it away is a real action. */
  it('takes the service off an unticked calendar', async () => {
    listCalendars.mockResolvedValue([cal({ clinicServiceId: 's1' })]);
    await openTheService();

    await pick(/Kalendáře/, 'Ordinace');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(updateCalendar).toHaveBeenCalled());
    expect(updateCalendar.mock.calls[0][1]).toMatchObject({ clinicServiceId: null });
  });

  /*
   * A činnost cannot be freed - the server refuses one with no service. So
   * the row is not untickable, and it says why rather than offering a save
   * that ends in a 400.
   */
  it('will not let a činnost be taken away, and says why', async () => {
    listActivities.mockResolvedValue({ activities: [act({ clinicServiceId: 's1' })], warnings: [] });
    await openTheService();

    await userEvent.click(screen.getByLabelText(/Činnosti/));
    const listbox = await screen.findByRole('listbox');
    const row = within(listbox).getByRole('option', { name: /Spiroergometrie/ });

    expect(row).toHaveAttribute('aria-disabled', 'true');
    expect(row).toHaveTextContent(/přesunout jde jen na jiné službě/i);
  });

  /* Ticking is a move, not a copy: the other service loses it. Worth seeing
     while ticking rather than on the other service's card afterwards. */
  it('says which service a tick would take it from', async () => {
    listClinicServices.mockResolvedValue([svc(), svc({ id: 's2', name: 'Sportovní diagnostika' })]);
    listActivities.mockResolvedValue({ activities: [act({ clinicServiceId: 's2' })], warnings: [] });
    show();
    /* Named, because two services means two Upravit buttons. */
    await userEvent.click(
      await screen.findByRole('button', { name: /Upravit službu Sportovní lékařské prohlídky/i }),
    );
    await screen.findByLabelText(/Název/);

    await userEvent.click(screen.getByLabelText(/Činnosti/));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('option', { name: /Spiroergometrie/ }))
      .toHaveTextContent(/z „Sportovní diagnostika“/);
  });

  /* A retired one is not offered - unless it is already under this service,
     where hiding it would make the service look emptier than it is. */
  it('does not offer a retired one, but keeps one that is already here', async () => {
    listCalendars.mockResolvedValue([
      cal({ id: 'c9', name: 'Zrušený', isActive: false }),
      cal({ id: 'c8', name: 'Starý ale náš', isActive: false, clinicServiceId: 's1' }),
    ]);
    await openTheService();

    await userEvent.click(screen.getByLabelText(/Kalendáře/));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).queryByRole('option', { name: /Zrušený/ })).not.toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: /Starý ale náš/ })).toBeInTheDocument();
  });
});

describe('when only some of the writes go through', () => {
  /*
   * One tick can be several `PUT`s, so partial success is real. The worst
   * thing the dialog could do is close and look finished.
   */
  it('stays open and names the one that failed', async () => {
    listCalendars.mockResolvedValue([cal(), cal({ id: 'c2', name: 'Laboratoř zátěže' })]);
    updateCalendar.mockImplementation(async (id: string) => {
      if (id === 'c2') throw new Error('nope');
      return cal();
    });
    await openTheService();

    await pick(/Kalendáře/, 'Ordinace');
    await pick(/Kalendáře/, 'Laboratoř zátěže');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    /* The alert, not the picker's own summary line - both say the name. */
    expect(await screen.findByText(/Nepodařilo se uložit: Laboratoř zátěže/))
      .toBeInTheDocument();
    expect(screen.getByLabelText(/Název/)).toBeInTheDocument();
  });

  it('closes when everything went through', async () => {
    listCalendars.mockResolvedValue([cal()]);
    await openTheService();

    await pick(/Kalendáře/, 'Ordinace');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(screen.queryByLabelText(/Název/)).not.toBeInTheDocument());
  });
});

describe('when there is nothing to tick', () => {
  /*
   * The only case where leaving this screen is still the right answer -
   * something has to exist before it can be assigned. The service goes with
   * it so the form opens ready.
   */
  it('offers to make one, carrying the service', async () => {
    await openTheService();

    await userEvent.click(screen.getByRole('button', { name: /Založit činnost/i }));

    expect(await screen.findByText('Činnosti dostal s1')).toBeInTheDocument();
  });

  it('does not offer that once something exists to tick', async () => {
    listActivities.mockResolvedValue({ activities: [act()], warnings: [] });
    await openTheService();

    expect(screen.queryByRole('button', { name: /Založit činnost/i })).not.toBeInTheDocument();
  });
});
