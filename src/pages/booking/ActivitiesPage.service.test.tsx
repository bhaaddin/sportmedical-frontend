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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { StrictMode } from 'react';
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
const listQuestionnaires = vi.fn();
vi.mock('../../api/questionnaireEditor', () => ({
  questionnaireEditorApi: { list: listQuestionnaires },
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
    <MemoryRouter initialEntries={[{ pathname: '/activities', state }]}>
      <QueryClientProvider client={client}>
        {ui}
        <HandoffProbe />
      </QueryClientProvider>
    </MemoryRouter>
  );
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

/*
 * Arriving from a služba that has no činnost.
 *
 * The owner opened "Upravit službu", looked for somewhere to assign činnosti,
 * and found none - the server takes that link from this side only, so the
 * Služby screen can name the gap and cannot close it. Its button sends the
 * service here. If it landed him on a plain list he would have to find the
 * same service again in a dropdown, which is the errand the button was added
 * to save.
 */
describe('being sent here from a service with no činnost', () => {
  it('opens the form ready for that service', async () => {
    render(withQueries(<ActivitiesPage />, { clinicServiceId: 's2' }));

    await screen.findByLabelText(/Název/);
    expect(screen.getByLabelText(/Služba/)).toHaveTextContent('Sportovní diagnostika');
  });

  /* A page somebody simply opened is not a handoff, and opening a dialog over
     it would be a screen acting on its own. */
  it('opens nothing when nobody was sent', async () => {
    render(withQueries(<ActivitiesPage />));

    await screen.findByRole('button', { name: /Nová činnost/i });
    expect(screen.queryByLabelText(/Název/)).not.toBeInTheDocument();
  });

  /*
   * A retired service is not in the picker, so pre-selecting one would open a
   * dialog showing nothing above a save that never moves. Opening plain is the
   * better failure - and the handoff can be stale, since the service could
   * have been retired between the click and the load.
   */
  it('opens nothing for a service that is no longer offered', async () => {
    listClinicServices.mockResolvedValue([svc('s9', 'Zrušená služba', false)]);
    render(withQueries(<ActivitiesPage />, { clinicServiceId: 's9' }));

    /* After the decision, not before it. Asserting on the button alone is
       satisfied while the services are still in flight, and then the guard
       could be deleted without this noticing - which it was. */
    await servicesHaveArrived();
    expect(screen.queryByLabelText(/Název/)).not.toBeInTheDocument();
  });

  /* Router state that means something else entirely must not open a form. */
  it('opens nothing for state that carries no service', async () => {
    render(withQueries(<ActivitiesPage />, { from: '/sluzby' }));

    /* Nothing consumes it, so it stays put - and no dialog appears either. */
    await screen.findByRole('button', { name: /Nová činnost/i });
    expect(await screen.findByText('předání čeká')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Název/)).not.toBeInTheDocument();
  });
});

/*
 * The application runs in StrictMode and these tests did not.
 *
 * Worth saying plainly what this does and does not guard. The first version of
 * this handoff spent it in an effect on the way in - mount, read the service,
 * clear the history entry, open the form. Every test here was green and in the
 * browser nothing opened. I put StrictMode down as the cause, wrote this test,
 * and then put the broken version back to check: it stayed green. So StrictMode
 * is NOT the mechanism, and I never proved what was. What is measured is the
 * two shapes in the browser - the effect version left the entry emptied with no
 * dialog, the version that spends the handoff on the way out opens ready, both
 * confirmed on screen on 13. 9. 2026.
 *
 * This test therefore guards one real thing and not the bug it was written for:
 * that the screen behaves under the double invocation the application actually
 * runs with. Kept for that, labelled for that.
 */
describe('the way the application actually mounts', () => {
  it('still opens ready for the service when mounted twice', async () => {
    render(withQueries(
      <StrictMode><ActivitiesPage /></StrictMode>,
      { clinicServiceId: 's2' },
    ));

    await screen.findByLabelText(/Název/);
    expect(screen.getByLabelText(/Služba/)).toHaveTextContent('Sportovní diagnostika');
  });
});

/*
 * The version he sent back.
 *
 * "ked stlacim priradit kalendar .. tak ma to hodi na kalendar niekde ale tam
 * chce odomna vytvorit novy vobec nerespektuje to ze kalendar uz vytvoreny
 * mam neukazuje mi zoznam". The same was true here for činnosti.
 *
 * He was right and it was mine, not the server's: `PUT /api/activities/{id}`
 * takes `clinicServiceId`, so moving an existing činnost under a service is
 * an ordinary edit. The screen was the only thing demanding a new one.
 */
describe('being sent here when činnosti already exist', () => {
  const existing = (over: Record<string, unknown> = {}) => ({
    id: 'a1', name: 'Spiroergometrie', slug: 'spiro', durationMinutes: 90,
    color: '#0D7377', publicNote: '', isPubliclyBookable: true, sortOrder: 0,
    isActive: true, serviceItemId: null, priceCzk: null, clinicServiceId: null,
    ...over,
  });

  it('does not demand a new one', async () => {
    listActivities.mockResolvedValue({ activities: [existing()], warnings: [] });
    render(withQueries(<ActivitiesPage />, { clinicServiceId: 's2' }));

    await servicesHaveArrived();
    await screen.findByText('Spiroergometrie');
    expect(screen.queryByLabelText(/Název/)).not.toBeInTheDocument();
  });

  it('says which service is waiting, so the list is not a riddle', async () => {
    listActivities.mockResolvedValue({ activities: [existing()], warnings: [] });
    render(withQueries(<ActivitiesPage />, { clinicServiceId: 's2' }));

    expect(await screen.findByText(/Sportovní diagnostika/)).toBeInTheDocument();
    expect(screen.getByText(/přes Upravit/)).toBeInTheDocument();
  });

  /* Still offered, because a new one may be what he wanted after all. */
  it('still offers making a new one', async () => {
    listActivities.mockResolvedValue({ activities: [existing()], warnings: [] });
    render(withQueries(<ActivitiesPage />, { clinicServiceId: 's2' }));

    await screen.findByText(/přes Upravit/);
    expect(screen.getAllByRole('button', { name: /Nová činnost/i }).length).toBeGreaterThan(1);
  });

  /*
   * A činnost already under this service is not one that is missing, so it
   * does not count as something to assign - and with nothing else in the
   * list, a blank form is the right answer after all.
   */
  it('opens the form when the only činnost is already under that service', async () => {
    listActivities.mockResolvedValue({
      activities: [existing({ clinicServiceId: 's2' })], warnings: [],
    });
    render(withQueries(<ActivitiesPage />, { clinicServiceId: 's2' }));

    await screen.findByLabelText(/Název/);
    expect(screen.getByLabelText(/Služba/)).toHaveTextContent('Sportovní diagnostika');
  });
});

/*
 * Which questionnaire a činnost asks for.
 *
 * `PUT` is the whole činnost, so the picker has two jobs: offer the clinic's
 * questionnaires, and send the stored choice back untouched when somebody
 * edits something else - otherwise renaming a činnost would switch it back
 * to the default questionnaire without anybody choosing that.
 */
describe('the questionnaire a činnost asks for', () => {
  const spiro = {
    id: 'a1', name: 'Spiroergometrie', slug: 'spiro', durationMinutes: 90,
    color: '#0D7377', publicNote: '', isPubliclyBookable: true, sortOrder: 0,
    isActive: true, serviceItemId: null, priceCzk: null, clinicServiceId: 's2',
    questionnaireRequirement: 'Required', questionnaireDefinitionId: 'q2',
  };

  beforeEach(() => {
    localStorage.setItem('permissions', JSON.stringify(['questionnaires.manage']));
    listQuestionnaires.mockReset().mockResolvedValue([
      { id: 'q1', displayName: 'Zdravotní dotazník', key: 'k1', versions: [] },
      { id: 'q2', displayName: 'Dotazník pro diagnostiku', key: 'k2', versions: [] },
    ]);
    listActivities.mockResolvedValue({ activities: [spiro], warnings: [] });
  });

  afterEach(() => localStorage.removeItem('permissions'));

  it('sends the stored questionnaire back when something else is edited', async () => {
    render(withQueries(<ActivitiesPage />));
    await userEvent.click(await screen.findByRole('button', { name: /Upravit/i }));
    await screen.findByLabelText(/Název/);

    await userEvent.type(screen.getByLabelText(/Název/), ' II');
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(saveActivity).toHaveBeenCalled());
    expect(saveActivity.mock.calls[0].at(-1)).toMatchObject({ questionnaireDefinitionId: 'q2' });
  });

  it('offers the clinic questionnaires and sends the one picked', async () => {
    render(withQueries(<ActivitiesPage />));
    await userEvent.click(await screen.findByRole('button', { name: /Upravit/i }));

    await userEvent.click(await screen.findByLabelText(/Který dotazník/));
    await userEvent.click(await screen.findByRole('option', { name: 'Zdravotní dotazník' }));
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(saveActivity).toHaveBeenCalled());
    expect(saveActivity.mock.calls[0].at(-1)).toMatchObject({ questionnaireDefinitionId: 'q1' });
  });

  it('sends null for the clinic default', async () => {
    render(withQueries(<ActivitiesPage />));
    await userEvent.click(await screen.findByRole('button', { name: /Upravit/i }));

    await userEvent.click(await screen.findByLabelText(/Který dotazník/));
    await userEvent.click(await screen.findByRole('option', { name: 'Výchozí dotazník kliniky' }));
    await userEvent.click(screen.getByRole('button', { name: /Uložit/i }));

    await waitFor(() => expect(saveActivity).toHaveBeenCalled());
    expect(saveActivity.mock.calls[0].at(-1)).toMatchObject({ questionnaireDefinitionId: null });
  });
});
