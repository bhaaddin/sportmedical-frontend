/*
 * Settings audit (20. 10. 2026) - Kalendáře (/calendars).
 *
 * Measured on the dev API (PUT /api/calendars/{id} with the body the screen builds):
 *   name over 100 chars, location over 200            -> 422 scheduling.text.too_long
 *   displayStepMinutes 0 or -5                         -> 422 scheduling.calendar.display_step_positive
 *   sortOrder -1                                       -> 422 scheduling.sort_order_negative
 *   publicHorizonDays / publicHoldMinutes / publicCancellationHours 0 or -1
 *                                                      -> 422 scheduling.sort_order_negative (wrong code, right refusal)
 *   publicMinimumNoticeMinutes 0                       -> 200
 *   a PUT that leaves the public* fields out clears them.
 * The form says each of these at its field instead of after the round trip.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';
import { calendarProblems, hasCalendarProblems } from './calendarForm';
import type { CalendarInput } from '../../api/bookingContracts';

const listCalendars = vi.fn();
const createCalendar = vi.fn();
const updateCalendar = vi.fn();
const removeCalendar = vi.fn();
const deactivate = vi.fn();
const activate = vi.fn();
const listServices = vi.fn();

vi.mock('../../api/calendars', () => ({
  calendarsApi: {
    list: listCalendars, create: createCalendar, update: updateCalendar, remove: removeCalendar,
    deactivate, activate, getAccess: vi.fn().mockResolvedValue([]), setAccess: vi.fn(),
  },
}));
vi.mock('../../api/clinicServices', () => ({ clinicServicesApi: { list: listServices } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [], warnings: [] }) } }));
vi.mock('../../api/serviceColors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/serviceColors')>()),
  serviceColorsApi: { get: vi.fn().mockResolvedValue({ palette: ['#0D5C52', '#2563EB', '#D97706', '#7C3AED', '#DC2626', '#0891B2'] }), put: vi.fn() },
}));

const { default: CalendarsPage } = await import('./CalendarsPage');

const calendar = (over: Record<string, unknown> = {}) => ({
  id: 'c1', name: 'Ordinace 1', color: '#0D5C52', location: 'Praha', displayStepMinutes: 15, isActive: true, sortOrder: 1,
  clinicServiceId: 's1', publicMinimumNoticeMinutes: 60, publicHorizonDays: 60, publicHoldMinutes: 10, publicCancellationHours: null, ...over,
});
const service = (id: string, name: string, isActive = true) => ({ id, name, description: '', sortOrder: 0, isActive, activities: 1, calendars: 1, colorHex: null });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  listCalendars.mockReset().mockResolvedValue([calendar()]);
  createCalendar.mockReset().mockResolvedValue(calendar());
  updateCalendar.mockReset().mockResolvedValue(calendar());
  removeCalendar.mockReset().mockResolvedValue(undefined);
  deactivate.mockReset().mockResolvedValue(undefined);
  activate.mockReset().mockResolvedValue(undefined);
  listServices.mockReset().mockResolvedValue([service('s1', 'Sportovní lékařské prohlídky'), service('s2', 'Diagnostika'), service('s3', 'Zrušená', false)]);
});

const draft = (over: Partial<CalendarInput> = {}): CalendarInput => ({
  name: 'Ordinace', color: '#0D5C52', location: '', displayStepMinutes: 15, isActive: true, sortOrder: 0, clinicServiceId: 's1',
  publicMinimumNoticeMinutes: null, publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null, ...over,
});

describe('calendarProblems (the rules the server enforces, said at the field)', () => {
  it('has nothing to say about a calendar as the dev API holds it', () => {
    expect(hasCalendarProblems(calendarProblems(draft({ publicMinimumNoticeMinutes: 60, publicHorizonDays: 60, publicHoldMinutes: 10 })))).toBe(false);
  });

  it.each([
    ['name', draft({ name: '   ' }), 'Vyplňte název.'],
    ['name', draft({ name: 'x'.repeat(101) }), 'Název může mít nejvýše 100 znaků.'],
    ['location', draft({ location: 'x'.repeat(201) }), 'Místo může mít nejvýše 200 znaků.'],
    ['displayStepMinutes', draft({ displayStepMinutes: 0 }), 'Krok musí být celé číslo, aspoň 1 minuta.'],
    ['displayStepMinutes', draft({ displayStepMinutes: -5 }), 'Krok musí být celé číslo, aspoň 1 minuta.'],
    ['displayStepMinutes', draft({ displayStepMinutes: 7.5 }), 'Krok musí být celé číslo, aspoň 1 minuta.'],
    ['sortOrder', draft({ sortOrder: -1 }), 'Pořadí musí být celé číslo od 0.'],
    ['publicMinimumNoticeMinutes', draft({ publicMinimumNoticeMinutes: -1 }), 'Zadejte celé číslo od 0, nebo pole nechte prázdné.'],
    ['publicHorizonDays', draft({ publicHorizonDays: 0 }), 'Zadejte celé číslo od 1, nebo pole nechte prázdné.'],
    ['publicHoldMinutes', draft({ publicHoldMinutes: 0 }), 'Zadejte celé číslo od 1, nebo pole nechte prázdné.'],
    ['publicCancellationHours', draft({ publicCancellationHours: -4 }), 'Zadejte celé číslo od 1, nebo pole nechte prázdné.'],
    ['publicHorizonDays', draft({ publicHorizonDays: 2_147_483_648 }), 'Číslo je příliš velké.'],
  ] as const)('%s: %#', (field, input, sentence) => {
    expect(calendarProblems(input)[field]).toBe(sentence);
  });

  it('lets notice be 0 (the server takes it) and any public number be empty', () => {
    expect(calendarProblems(draft({ publicMinimumNoticeMinutes: 0 }))).toEqual({});
    expect(calendarProblems(draft({ publicHorizonDays: null, publicHoldMinutes: null, publicCancellationHours: null }))).toEqual({});
  });
});

describe('the list', () => {
  it('shows the stored name, place, step and service of every calendar', async () => {
    renderScreen(<CalendarsPage />, '/calendars');
    const row = (await screen.findByText('Ordinace 1')).closest('[data-card="calendar"]') as HTMLElement;
    expect(within(row).getByText('Praha')).toBeInTheDocument();
    expect(within(row).getByText('15 min')).toBeInTheDocument();
    expect(within(row).getByText('Sportovní lékařské prohlídky')).toBeInTheDocument();
    expect(within(row).getByText('Aktivní')).toBeInTheDocument();
  });

  it('hides a deactivated calendar until asked, and offers the switch only when something is hidden', async () => {
    listCalendars.mockResolvedValue([calendar(), calendar({ id: 'c2', name: 'Stará', isActive: false, sortOrder: 2 })]);
    const user = userEvent.setup();
    renderScreen(<CalendarsPage />, '/calendars');
    await screen.findByText('Ordinace 1');
    expect(screen.queryByText('Stará')).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Zobrazit neaktivní \(1\)/ }));
    expect(await screen.findByText('Stará')).toBeInTheDocument();
  });

  it('warns on a calendar that runs no service, because it offers nothing on any day', async () => {
    listCalendars.mockResolvedValue([calendar({ clinicServiceId: null })]);
    renderScreen(<CalendarsPage />, '/calendars');
    expect(await screen.findByText('Neprovozuje žádnou službu — nenabídne nic')).toBeInTheDocument();
  });

  it('deactivating is its own button and calls the deactivate route, not a PUT', async () => {
    const user = userEvent.setup();
    renderScreen(<CalendarsPage />, '/calendars');
    await user.click(await screen.findByRole('button', { name: /Zneaktivnit.*Ordinace 1/ }));
    await waitFor(() => expect(deactivate).toHaveBeenCalledWith('c1'));
    expect(updateCalendar).not.toHaveBeenCalled();
  });

  it('activating a deactivated calendar calls the activate route', async () => {
    listCalendars.mockResolvedValue([calendar({ isActive: false })]);
    const user = userEvent.setup();
    renderScreen(<CalendarsPage />, '/calendars');
    await user.click(await screen.findByRole('switch', { name: /Zobrazit neaktivní/ }));
    await user.click(await screen.findByRole('button', { name: /Znovu aktivovat.*Ordinace 1/ }));
    await waitFor(() => expect(activate).toHaveBeenCalledWith('c1'));
  });
});

describe('editing a calendar', () => {
  const edit = async () => {
    const user = userEvent.setup();
    renderScreen(<CalendarsPage />, '/calendars');
    await user.click(await screen.findByRole('button', { name: 'Upravit' }));
    return { user, dialog: await screen.findByRole('dialog') };
  };

  it('loads every stored field into the form, the public numbers included', async () => {
    const { dialog } = await edit();
    expect(within(dialog).getByLabelText(/^Název/)).toHaveValue('Ordinace 1');
    expect(within(dialog).getByLabelText('Místo')).toHaveValue('Praha');
    expect(within(dialog).getByLabelText('Krok zobrazení')).toHaveValue(15);
    expect(within(dialog).getByLabelText('Pořadí')).toHaveValue(1);
    expect(within(dialog).getByLabelText('Nejdřív za (minut)')).toHaveValue(60);
    expect(within(dialog).getByLabelText('Nejpozději za (dnů)')).toHaveValue(60);
    expect(within(dialog).getByLabelText('Držení termínu (minut)')).toHaveValue(10);
    expect(within(dialog).getByLabelText('Zrušení nejpozději (hodin předem)')).toHaveValue(null);
  });

  it('sends the whole calendar back on a rename - isActive, service and all four public numbers', async () => {
    const { user, dialog } = await edit();
    const name = within(dialog).getByLabelText(/^Název/);
    await user.clear(name);
    await user.type(name, '  Ordinace Nová  ');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateCalendar).toHaveBeenCalled());
    expect(updateCalendar).toHaveBeenCalledWith('c1', {
      name: 'Ordinace Nová', color: '#0D5C52', location: 'Praha', displayStepMinutes: 15, isActive: true, sortOrder: 1,
      clinicServiceId: 's1', publicMinimumNoticeMinutes: 60, publicHorizonDays: 60, publicHoldMinutes: 10, publicCancellationHours: null,
    });
  });

  it('sends an emptied public number as null (no limit), not as 0', async () => {
    const { user, dialog } = await edit();
    await user.clear(within(dialog).getByLabelText('Nejpozději za (dnů)'));
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateCalendar).toHaveBeenCalled());
    expect(updateCalendar.mock.calls[0][1]).toMatchObject({ publicHorizonDays: null });
  });

  it.each([
    ['Krok zobrazení', '0', /aspoň 1 minuta/],
    ['Nejpozději za (dnů)', '0', /Zadejte celé číslo od 1/],
    ['Držení termínu (minut)', '0', /Zadejte celé číslo od 1/],
    ['Zrušení nejpozději (hodin předem)', '0', /Zadejte celé číslo od 1/],
    ['Nejdřív za (minut)', '-2', /Zadejte celé číslo od 0/],
  ])('%s = %s: the sentence appears under the field and Uložit is off', async (label, typed, sentence) => {
    const { user, dialog } = await edit();
    const field = within(dialog).getByLabelText(label);
    await user.clear(field);
    await user.type(field, typed);
    expect(within(dialog).getByText(sentence)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('accepts 0 minutes of notice (the server does)', async () => {
    const { user, dialog } = await edit();
    const field = within(dialog).getByLabelText('Nejdřív za (minut)');
    await user.clear(field);
    await user.type(field, '0');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(updateCalendar).toHaveBeenCalled());
    expect(updateCalendar.mock.calls[0][1]).toMatchObject({ publicMinimumNoticeMinutes: 0 });
  });

  it('stops the typing at the limits the server keeps', async () => {
    const { dialog } = await edit();
    expect(within(dialog).getByLabelText(/^Název/)).toHaveAttribute('maxlength', '100');
    expect(within(dialog).getByLabelText('Místo')).toHaveAttribute('maxlength', '200');
  });

  it('keeps the form filled in and shows the Czech sentence when the server refuses with a code', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    updateCalendar.mockRejectedValue(new BookingApiError('domainRule', 422, 'Číslo je mimo povolený rozsah.'));
    const { user, dialog } = await edit();
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(await within(dialog).findByText('Číslo je mimo povolený rozsah.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^Název/)).toHaveValue('Ordinace 1');
  });

  it('sends one request for a double click on Uložit', async () => {
    let finish: (value: unknown) => void = () => undefined;
    updateCalendar.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { user, dialog } = await edit();
    await user.dblClick(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(updateCalendar).toHaveBeenCalledTimes(1);
    finish(calendar());
  });
});

describe('creating a calendar', () => {
  const create = async () => {
    const user = userEvent.setup();
    renderScreen(<CalendarsPage />, '/calendars');
    await user.click(await screen.findByRole('button', { name: 'Nový kalendář' }));
    return { user, dialog: await screen.findByRole('dialog') };
  };

  it('opens with the defaults: 15-minute step, order after the visible ones, nothing limited', async () => {
    const { dialog } = await create();
    expect(within(dialog).getByLabelText('Krok zobrazení')).toHaveValue(15);
    expect(within(dialog).getByLabelText('Pořadí')).toHaveValue(1);
    expect(within(dialog).getByLabelText('Nejdřív za (minut)')).toHaveValue(null);
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
  });

  it('waits for a service: a calendar that runs none offers nothing', async () => {
    const { user, dialog } = await create();
    await user.type(within(dialog).getByLabelText(/^Název/), 'Nový');
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeDisabled();
    await user.click(within(dialog).getByRole('combobox', { name: /Služba/ }));
    await user.click(await screen.findByRole('option', { name: 'Diagnostika' }));
    expect(within(dialog).getByRole('button', { name: 'Uložit' })).toBeEnabled();
  });

  it('offers only the services still offered (an archived one is not something to point a calendar at)', async () => {
    const { user, dialog } = await create();
    await user.click(within(dialog).getByRole('combobox', { name: /Služba/ }));
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(['Sportovní lékařské prohlídky', 'Diagnostika']);
  });

  it('creates with the typed values and the public numbers as numbers', async () => {
    const { user, dialog } = await create();
    await user.type(within(dialog).getByLabelText(/^Název/), 'Nový');
    await user.type(within(dialog).getByLabelText('Místo'), 'Brno');
    await user.click(within(dialog).getByRole('combobox', { name: /Služba/ }));
    await user.click(await screen.findByRole('option', { name: 'Diagnostika' }));
    await user.type(within(dialog).getByLabelText('Nejdřív za (minut)'), '30');
    await user.type(within(dialog).getByLabelText('Držení termínu (minut)'), '15');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    await waitFor(() => expect(createCalendar).toHaveBeenCalled());
    expect(createCalendar.mock.calls[0][0]).toMatchObject({
      name: 'Nový', location: 'Brno', clinicServiceId: 's2', displayStepMinutes: 15, isActive: true,
      publicMinimumNoticeMinutes: 30, publicHoldMinutes: 15, publicHorizonDays: null, publicCancellationHours: null,
    });
    expect(updateCalendar).not.toHaveBeenCalled();
  });

  it('says so when there is no service to pick and where to make one', async () => {
    listServices.mockResolvedValue([]);
    const { dialog } = await create();
    expect(await within(dialog).findByText(/Zatím není žádná služba/)).toBeInTheDocument();
  });
});

describe('deleting a calendar', () => {
  it('asks first, and after the server refuses (it has bookings) offers to deactivate instead', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    removeCalendar.mockRejectedValue(new BookingApiError('conflict', 409, 'Kalendář nelze smazat: obsahuje 12 termínů.'));
    const user = userEvent.setup();
    renderScreen(<CalendarsPage />, '/calendars');
    await user.click(await screen.findByRole('button', { name: /Smazat.*Ordinace 1/ }));
    expect(removeCalendar).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Smazat' }));
    expect(await within(dialog).findByText('Kalendář nelze smazat: obsahuje 12 termínů.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Zneaktivnit/ })).toBeInTheDocument();
  });
});
