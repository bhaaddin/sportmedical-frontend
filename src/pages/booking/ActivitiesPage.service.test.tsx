/*
 * A činnost belongs to exactly one služba, and the server refuses it without
 * one.
 *
 * Not a warning - a refusal, and the owner asked for it that way. A činnost
 * under no service inherits no document rule, so it asks the patient for
 * nothing and looks exactly like one where everything is in order. That is the
 * shape this project has spent its time removing, and here it would have been
 * built in.
 *
 * The gate is what a person actually meets. TypeScript makes the field
 * required and the server refuses without it, but neither of those is visible
 * from a screen: what somebody sees is either a button that waits and says
 * why, or a save that fails after the fact. This is about that button.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const listActivities = vi.fn();
const saveActivity = vi.fn();
const listClinicServices = vi.fn();

vi.mock('../../api/activities', () => ({
  activitiesApi: {
    list: listActivities,
    create: saveActivity,
    update: saveActivity,
    remove: vi.fn(),
    restore: vi.fn(),
  },
}));
vi.mock('../../api/services', () => ({
  servicesApi: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: { list: listClinicServices },
}));

const { default: ActivitiesPage } = await import('./ActivitiesPage');

const svc = (id: string, name: string, isActive = true) =>
  ({ id, name, description: '', sortOrder: 0, isActive, activities: 0, calendars: 0 });

beforeEach(() => {
  listActivities.mockReset().mockResolvedValue({ activities: [], warnings: [] });
  saveActivity.mockReset().mockResolvedValue({ activity: {}, warnings: [] });
  listClinicServices.mockReset().mockResolvedValue([
    svc('s1', 'Sportovní lékařské prohlídky'),
    svc('s2', 'Sportovní diagnostika'),
  ]);
});

/* Retries off: a failing query would hold the test open and report a timeout
   instead of the failure. */
const withQueries = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
};

const openNew = async () => {
  render(withQueries(<ActivitiesPage />));
  await userEvent.click(await screen.findByRole('button', { name: /Nová činnost/i }));
  await screen.findByLabelText(/Název/);
};

describe('the service a činnost belongs to', () => {
  it('is asked for, and the save waits for it', async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText(/Název/), 'Komplexní prohlídka');

    expect(screen.getByLabelText(/Služba/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Uložit/i })).toBeDisabled();
    expect(saveActivity).not.toHaveBeenCalled();
  });

  it('lets the save go once one is chosen, and sends it', async () => {
    await openNew();
    await userEvent.type(screen.getByLabelText(/Název/), 'Komplexní prohlídka');

    await userEvent.click(screen.getByLabelText(/Služba/));
    await userEvent.click(await screen.findByRole('option', { name: 'Sportovní diagnostika' }));
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(saveActivity).toHaveBeenCalled());
    const sent = saveActivity.mock.calls[0].at(-1);
    expect(sent).toMatchObject({ clinicServiceId: 's2' });
  });

  /*
   * The state a new clinic is in. Without saying so, the picker is an empty
   * dropdown above a button that will not move, and nothing on screen says
   * where to go.
   */
  it('says where to go when no service exists yet', async () => {
    listClinicServices.mockResolvedValue([]);
    await openNew();

    expect(await screen.findByText(/Nejdřív ji založte v Nastavení/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Uložit/i })).toBeDisabled();
  });

  /* A retired service is not something to file a new činnost under. */
  it('offers only the services still in use', async () => {
    listClinicServices.mockResolvedValue([
      svc('s1', 'Sportovní lékařské prohlídky'),
      svc('s3', 'Zrušená služba', false),
    ]);
    await openNew();

    await userEvent.click(screen.getByLabelText(/Služba/));
    expect(await screen.findByRole('option', { name: 'Sportovní lékařské prohlídky' }))
      .toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Zrušená služba' })).not.toBeInTheDocument();
  });

  /*
   * Editing sends it back untouched.
   *
   * `PUT` is the whole činnost, so a form that forgets this field is a form
   * that clears it - and renaming an activity would quietly take its service
   * away, and with it every document rule the service carried. The same trap
   * the price link already has a comment about, one field along.
   *
   * Found by mutation: the first version of these tests only ever created,
   * so blanking the field on the edit path changed nothing any of them saw.
   */
  it('sends an existing činnost back with the service it already had', async () => {
    listActivities.mockResolvedValue({
      activities: [{
        id: 'a1', name: 'Spiroergometrie', slug: 'spiro', durationMinutes: 90,
        color: '#0D7377', publicNote: '', isPubliclyBookable: true, sortOrder: 0,
        isActive: true, serviceItemId: null, priceCzk: null, clinicServiceId: 's2',
      }],
      warnings: [],
    });

    render(withQueries(<ActivitiesPage />));
    await userEvent.click(await screen.findByRole('button', { name: /Upravit/i }));
    await screen.findByLabelText(/Název/);

    await userEvent.type(screen.getByLabelText(/Název/), ' II');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(saveActivity).toHaveBeenCalled());
    expect(saveActivity.mock.calls[0].at(-1)).toMatchObject({ clinicServiceId: 's2' });
  });

  /* Failing to load is not the same as there being none, and neither is a
     reason to let the save through. */
  it('says so when the services could not be loaded', async () => {
    listClinicServices.mockRejectedValue(new Error('offline'));
    await openNew();

    expect(await screen.findByText(/Služby se nepodařilo načíst/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Uložit/i })).toBeDisabled();
  });
});
