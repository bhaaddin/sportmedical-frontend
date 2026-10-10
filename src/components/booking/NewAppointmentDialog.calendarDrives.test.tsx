/*
 * Etapa 12: the CALENDAR is the one source of truth in the staff booking drawer.
 * A calendar runs one služba, so picking a calendar puts its služba on the form
 * at once and lists exactly that služba's činnosti - a činnost of another služba
 * is cleared, never listed. Picking a služba first narrows the calendars to its
 * own and preselects the only one. The same in the step-2 flow and in "Rychlá
 * registrace", at the three widths, in every order of operations.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';

vi.setConfig({ testTimeout: 30000 });

const listCalendars = vi.fn();
const listActivities = vi.fn();
const listServices = vi.fn();
const preview = vi.fn();

vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/clinicServices', () => ({ clinicServicesApi: { list: listServices } }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview } }));
vi.mock('../../api/appointments', () => ({
  appointmentsApi: { getAvailability: vi.fn().mockResolvedValue([]), create: vi.fn(), createUnregistered: vi.fn(), createQuick: vi.fn() },
}));
vi.mock('../../api/patients', () => ({ patientsApi: { list: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }), getProfile: vi.fn(), getById: vi.fn() } }));
vi.mock('../../api/patientPreRegistration', () => ({ patientPreRegistrationApi: { issueLink: vi.fn() } }));
vi.mock('../../services/clubsApi', () => ({ clubsApi: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/onSiteConsents', () => ({
  onSiteConsentsApi: { getOptions: vi.fn().mockResolvedValue({ activityId: '', options: [] }), record: vi.fn() },
  default: { getOptions: vi.fn().mockResolvedValue({ activityId: '', options: [] }), record: vi.fn() },
}));

const { NewAppointmentDialog } = await import('./NewAppointmentDialog');

const PROHLIDKY = 'Sportovní lékařské prohlídky';
const DIAGNOSTIKA = 'Sportovní diagnostika';

const CALENDARS = [
  { id: 'c1', name: 'Ordinace 1', isActive: true, clinicServiceId: 's1' },
  { id: 'c2', name: 'Diagnostika', isActive: true, clinicServiceId: 's2' },
  { id: 'c3', name: 'InBody', isActive: true, clinicServiceId: 's2' },
];
const SERVICES = [
  { id: 's1', name: PROHLIDKY, isActive: true, sortOrder: 0, activities: 2, calendars: 1, colorHex: null, description: '' },
  { id: 's2', name: DIAGNOSTIKA, isActive: true, sortOrder: 1, activities: 1, calendars: 2, colorHex: null, description: '' },
];
const ACTIVITIES = [
  { id: 'a1', name: 'Základní prohlídka', durationMinutes: 30, isActive: true, priceCzk: 1600, clinicServiceId: 's1' },
  { id: 'a2', name: 'Komplexní prohlídka', durationMinutes: 60, isActive: true, priceCzk: 3200, clinicServiceId: 's1' },
  { id: 'a3', name: 'Základní diagnostika', durationMinutes: 45, isActive: true, priceCzk: 2000, clinicServiceId: 's2' },
];
/* What each calendar's day plan offers: Ordinace 1 only the basic prohlídka, Diagnostika its own, InBody nothing. */
const OFFERED: Record<string, string[]> = { c1: ['a1'], c2: ['a3'], c3: [] };

function open(props: Partial<Parameters<typeof NewAppointmentDialog>[0]> = {}) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <NewAppointmentDialog open onClose={vi.fn()} onBooked={vi.fn()} initialDate="2026-09-24" {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const service = () => screen.getByRole('combobox', { name: 'Služba' });
const calendar = () => screen.getByRole('combobox', { name: 'Kalendář' });
const quickActivity = () => screen.getByRole('combobox', { name: 'Prohlídka, na kterou volal' });

async function choose(user: ReturnType<typeof userEvent.setup>, box: HTMLElement, option: RegExp | string) {
  await user.click(box);
  await user.click(await screen.findByRole('option', { name: option }));
}

/* MUI gives the placeholder and the group heading the option role too; the real choices carry a value. */
const realOptions = (listbox: HTMLElement) =>
  within(listbox)
    .getAllByRole('option')
    .filter((o) => o.hasAttribute('data-value') && o.getAttribute('aria-disabled') !== 'true');
/* Prices are grouped with a no-break space; the tests read them as plain words. */
const text = (el: HTMLElement) => (el.textContent ?? '').replace(/ /g, ' ');

/** The names of the options a closed select would list, then the list is closed again. */
async function optionsOf(user: ReturnType<typeof userEvent.setup>, box: HTMLElement): Promise<string[]> {
  await user.click(box);
  const listbox = await screen.findByRole('listbox');
  const names = realOptions(listbox).map(text);
  await user.keyboard('{Escape}');
  return names;
}

beforeEach(() => {
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'patients.view', 'patients.register']));
  listCalendars.mockReset().mockResolvedValue(CALENDARS);
  listActivities.mockReset().mockResolvedValue({ activities: ACTIVITIES, warnings: [] });
  listServices.mockReset().mockResolvedValue(SERVICES);
  preview.mockReset().mockImplementation(async (calendarId: string) => [
    { date: '2026-09-24', isOpen: true, closedBecause: null, offeredActivityIds: OFFERED[calendarId] ?? [] },
  ]);
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)(
  'the calendar drives the služba and the činnosti · %s',
  (_name, width) => {
    beforeEach(() => setViewport(width, width === VIEWPORTS.desktop ? 900 : 1112));

    it('quick registration: a calendar of another služba switches the služba, clears the foreign činnost and lists only its own', async () => {
      const user = userEvent.setup();
      open();
      await user.click(await screen.findByRole('radio', { name: 'Rychlá registrace' }));
      await screen.findByRole('combobox', { name: 'Služba' });

      /* Služba first: the only calendar of prohlídky is chosen with it. */
      await choose(user, service(), PROHLIDKY);
      expect(calendar()).toHaveTextContent('Ordinace 1');
      expect(await optionsOf(user, quickActivity())).toEqual([
        'Základní prohlídka — 1 600 Kč · 30 min',
        'Komplexní prohlídka — 3 200 Kč · 60 min · dnes se nenabízí',
      ]);
      await choose(user, quickActivity(), /^Základní prohlídka/);
      expect(quickActivity()).toHaveTextContent('Základní prohlídka');

      /* The wrong calendar for that služba: the calendar wins, at once. */
      await choose(user, calendar(), /^Diagnostika/);
      expect(service()).toHaveTextContent(DIAGNOSTIKA);
      expect(screen.getByText(`Kalendář Diagnostika patří službě ${DIAGNOSTIKA}.`)).toBeInTheDocument();
      expect(quickActivity()).toHaveTextContent('Vyberte prohlídku');
      expect(await optionsOf(user, quickActivity())).toEqual(['Základní diagnostika — 2 000 Kč · 45 min']);

      /* And back. */
      await choose(user, calendar(), /^Ordinace 1/);
      expect(service()).toHaveTextContent(PROHLIDKY);
      expect(screen.getByText(`Kalendář Ordinace 1 patří službě ${PROHLIDKY}.`)).toBeInTheDocument();
      expect(await optionsOf(user, quickActivity())).toEqual([
        'Základní prohlídka — 1 600 Kč · 30 min',
        'Komplexní prohlídka — 3 200 Kč · 60 min · dnes se nenabízí',
      ]);
    });

    it('step 2: the calendar select switches the služba and the činnost cards, and unchecks a foreign činnost', async () => {
      const user = userEvent.setup();
      open();
      await user.click(await screen.findByRole('button', { name: 'Jen zablokovat čas bez pacienta' }));
      await screen.findByRole('combobox', { name: 'Kalendář' });
      await choose(user, calendar(), /^Ordinace 1/);
      fireEvent.change(screen.getByLabelText('Čas od'), { target: { value: '09:00' } });
      await user.click(screen.getByRole('button', { name: 'Pokračovat' }));
      await screen.findByText('Krok 2 ze 2 — co se bude dělat');

      /* The calendar chosen on step 1 already decided the služba. */
      expect(service()).toHaveTextContent(PROHLIDKY);
      const cards = () => screen.getByRole('radiogroup', { name: 'Činnost' });
      expect(within(cards()).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['Základní prohlídka']);
      await user.click(within(cards()).getByRole('radio', { name: 'Základní prohlídka' }));
      expect(within(cards()).getByRole('radio', { name: 'Základní prohlídka' })).toBeChecked();

      await choose(user, calendar(), /^Diagnostika/);
      expect(service()).toHaveTextContent(DIAGNOSTIKA);
      expect(screen.getByText(`Kalendář Diagnostika patří službě ${DIAGNOSTIKA}.`)).toBeInTheDocument();
      expect(within(cards()).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['Základní diagnostika']);
      expect(within(cards()).queryByRole('radio', { checked: true })).toBeNull();
      /* "Zobrazit všechny" never brings a prohlídka into a diagnostika calendar. */
      const showAll = screen.queryByRole('button', { name: /Zobrazit/ });
      if (showAll) await user.click(showAll);
      expect(within(cards()).queryByRole('radio', { name: /prohlídka/ })).toBeNull();
    });

    it('služba first with several calendars: its own calendars come first, none is preselected, and the single one is', async () => {
      const user = userEvent.setup();
      open();
      await user.click(await screen.findByRole('radio', { name: 'Rychlá registrace' }));
      await screen.findByRole('combobox', { name: 'Služba' });

      await choose(user, service(), DIAGNOSTIKA);
      expect(calendar()).toHaveTextContent('Vyberte kalendář');
      await user.click(calendar());
      const listbox = await screen.findByRole('listbox');
      expect(realOptions(listbox).map(text)).toEqual([
        'Diagnostika',
        'InBody',
        `Ordinace 1${PROHLIDKY}`,
      ]);
      expect(within(listbox).getByText('Kalendáře jiných služeb')).toBeInTheDocument();
      await user.click(within(listbox).getByRole('option', { name: 'InBody' }));
      expect(service()).toHaveTextContent(DIAGNOSTIKA);
      expect(screen.queryByText(/patří službě/)).toBeNull();
      /* InBody offers nothing today: the one diagnostika is there, marked so. */
      expect(await optionsOf(user, quickActivity())).toEqual(['Základní diagnostika — 2 000 Kč · 45 min · dnes se nenabízí']);

      /* Back to the služba with one calendar: that calendar is chosen with it. */
      await choose(user, service(), PROHLIDKY);
      expect(calendar()).toHaveTextContent('Ordinace 1');
      expect(await optionsOf(user, quickActivity())).toEqual([
        'Základní prohlídka — 1 600 Kč · 30 min',
        'Komplexní prohlídka — 3 200 Kč · 60 min · dnes se nenabízí',
      ]);
    });

    it('opened on a calendar: its služba is on the form at once and overrules the služba handed in', async () => {
      const user = userEvent.setup();
      open({ initialCalendarId: 'c2', initialStart: '2026-09-24T09:00', initialEnd: '2026-09-24T09:45', initialQuick: true, initialServiceId: 's1' });
      await screen.findByRole('combobox', { name: 'Služba' });
      expect(service()).toHaveTextContent(DIAGNOSTIKA);
      expect(await optionsOf(user, quickActivity())).toEqual(['Základní diagnostika — 2 000 Kč · 45 min']);
    });
  },
);
