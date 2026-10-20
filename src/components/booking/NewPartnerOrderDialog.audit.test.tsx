/*
 * Settings audit (20. 10. 2026) - Nová hromadná objednávka (the dialog behind /vyhrazeni) and Uvolnit.
 *
 * Server facts (dev API, /api/calendars/{id}/partner-orders…):
 *   a name over 100 characters or an e-mail over 128 -> 422; an e-mail is otherwise stored whatever it says ("not-an-email" -> 201)
 *   the SAME činnost twice in PUT …/items -> a bare 500; a count of 0 -> 422 scheduling.partner.count_positive
 *   a window that ends where it starts -> 422 scheduling.partner.window_end_before_start, AFTER the order exists
 *   the order is created first, items and windows follow in separate calls, so a failure part-way leaves a half-made order
 *   (and the dialog said "nezakládejte ho znovu" while Uložit stayed on).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
void within;
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../../test/auditHarness';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const create = vi.fn();
const setItems = vi.fn();
const addWindow = vi.fn();
const releaseWindow = vi.fn();
const preview = vi.fn();

vi.mock('../../api/activities', () => ({
  activitiesApi: {
    list: vi.fn().mockResolvedValue({
      activities: [
        { id: 'a1', name: 'Základní', durationMinutes: 15, isActive: true, priceCzk: 1600 },
        { id: 'a2', name: 'Komplexní', durationMinutes: 30, isActive: true, priceCzk: null },
        { id: 'a3', name: 'Archivovaná', durationMinutes: 30, isActive: false, priceCzk: null },
      ],
      warnings: [],
    }),
  },
}));
vi.mock('../../api/partnerOrders', () => ({ partnerOrdersApi: { create, setItems, addWindow, releaseWindow } }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview } }));
vi.mock('../../services/clubsApi', () => ({ clubsApi: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/displaySettings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/displaySettings')>();
  return { ...actual, useCalendarDisplay: () => ({ settings: { ...actual.CALENDAR_DISPLAY_OFFLINE, dayStartHour: 8, dayEndHour: 18 }, loaded: true }) };
});

const { NewPartnerOrderDialog } = await import('./NewPartnerOrderDialog');
const { ReleaseWindowDialog } = await import('./ReleaseWindowDialog');

const OPEN_DAY = (date: string) => ({ date, isOpen: true, closedBecause: null, startTime: '08:00:00', endTime: '16:00:00', breakStart: '12:00:00', breakEnd: '12:30:00', workerUserId: null, workerDisplayName: null, isChangedByOverride: false, offeredActivityIds: [] });

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  create.mockReset().mockResolvedValue({ id: 'o1' });
  setItems.mockReset().mockResolvedValue({});
  addWindow.mockReset().mockResolvedValue({});
  releaseWindow.mockReset().mockResolvedValue({});
  preview.mockReset().mockImplementation(async (_calendar: string, from: string, to: string) => {
    const days: ReturnType<typeof OPEN_DAY>[] = [];
    for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) days.push(OPEN_DAY(d.toISOString().slice(0, 10)));
    return days;
  });
});

const mount = (props: Record<string, unknown> = {}) => {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  const view = renderScreen(<NewPartnerOrderDialog open calendarId="c1" onClose={onClose} onCreated={onCreated} {...props} />);
  return { onClose, onCreated, ...view };
};
const save = () => screen.getByRole('button', { name: 'Uložit' });
const name = () => screen.findByLabelText('Název partnera');

describe('the partner', () => {
  it('needs a name and keeps Uložit off until there is one', async () => {
    const user = userEvent.setup();
    mount();
    expect(save()).toBeDisabled();
    await user.type(await name(), 'FK Slaný');
    expect(save()).toBeEnabled();
  });

  it('stops the name at 100 and the e-mail at 128 characters, which is all the server keeps', async () => {
    mount();
    expect(await name()).toHaveAttribute('maxlength', '100');
    expect(screen.getByLabelText('Kontaktní e-mail')).toHaveAttribute('maxlength', '128');
  });

  it.each(['not-an-email', 'a@b', '@x.cz'])('refuses the e-mail "%s" at the field (the server would store it)', async (typed) => {
    const user = userEvent.setup();
    mount();
    await user.type(await name(), 'Klub');
    await user.type(screen.getByLabelText('Kontaktní e-mail'), typed);
    expect(screen.getByText(/Zadejte e-mail ve tvaru klub@priklad\.cz/)).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('accepts a good e-mail and an empty one (sent as null)', async () => {
    const user = userEvent.setup();
    mount();
    await user.type(await name(), 'Klub');
    await user.click(save());
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][1]).toMatchObject({ partnerName: 'Klub', partnerType: 0, contactEmail: null, note: null, clubId: null });
  });

  it('sends the typed e-mail, trimmed, the chosen type and the note', async () => {
    const user = userEvent.setup();
    mount();
    await user.type(await name(), '  SK Kladno ');
    await user.click(screen.getByRole('combobox', { name: 'Typ' }));
    await user.click(await screen.findByRole('option', { name: 'Agentura' }));
    await user.type(screen.getByLabelText('Kontaktní e-mail'), ' klub@priklad.cz ');
    await user.type(screen.getByLabelText('Poznámka'), ' Přijdou ve dvou autech ');
    await user.click(save());
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith('c1', { partnerName: 'SK Kladno', partnerType: 1, contactEmail: 'klub@priklad.cz', note: 'Přijdou ve dvou autech', clubId: null });
  });
});

describe('the request (items)', () => {
  const addItem = async (user: ReturnType<typeof userEvent.setup>) => user.click(await screen.findByRole('button', { name: 'Přidat činnost' }));

  it('offers only active činnosti and the length and price with each', async () => {
    const user = userEvent.setup();
    mount();
    await addItem(user);
    await user.click(await screen.findByRole('combobox', { name: 'Činnost' }));
    const options = screen.getAllByRole('option').map((o) => o.textContent?.replace(/\s/g, ' '));
    expect(options).toEqual(['Základní · 15 min · 1 600 Kč', 'Komplexní · 30 min']);
  });

  it('does not let the same činnost be picked twice (the server answers 500)', async () => {
    const user = userEvent.setup();
    mount();
    await user.type(await name(), 'Klub');
    await addItem(user);
    await addItem(user);
    const boxes = screen.getAllByRole('combobox', { name: 'Činnost' });
    await user.click(boxes[0]);
    await user.click(await screen.findByRole('option', { name: /Základní/ }));
    await user.click(boxes[1]);
    const options = await screen.findAllByRole('option');
    expect(options.find((o) => /Základní/.test(o.textContent ?? ''))).toHaveAttribute('aria-disabled', 'true');
    expect(options.find((o) => /Komplexní/.test(o.textContent ?? ''))).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('keeps Uložit off while a line has no činnost or a count of 0', async () => {
    const user = userEvent.setup();
    mount();
    await user.type(await name(), 'Klub');
    await addItem(user);
    expect(save()).toBeDisabled();
    await user.click(screen.getByRole('combobox', { name: 'Činnost' }));
    await user.click(await screen.findByRole('option', { name: /Základní/ }));
    expect(save()).toBeEnabled();
    const count = screen.getByLabelText('Počet');
    await user.clear(count);
    expect(save()).toBeDisabled();
  });

  it('shows the minutes a line needs: length times count', async () => {
    const user = userEvent.setup();
    mount();
    await addItem(user);
    await user.click(await screen.findByRole('combobox', { name: 'Činnost' }));
    await user.click(await screen.findByRole('option', { name: /Komplexní/ }));
    const count = screen.getByLabelText('Počet');
    await user.clear(count);
    await user.type(count, '4');
    expect(screen.getByText('120 min')).toBeInTheDocument();
    expect(screen.getByText(/Pokryto 0 min z 120 min/)).toBeInTheDocument();
  });

  it('sends the items as činnost id and count, after the order was created', async () => {
    const user = userEvent.setup();
    mount();
    await user.type(await name(), 'Klub');
    await addItem(user);
    await user.click(await screen.findByRole('combobox', { name: 'Činnost' }));
    await user.click(await screen.findByRole('option', { name: /Základní/ }));
    const count = screen.getByLabelText('Počet');
    await user.clear(count);
    await user.type(count, '12');
    await user.click(save());
    await waitFor(() => expect(setItems).toHaveBeenCalledWith('c1', 'o1', [{ activityId: 'a1', requestedCount: 12 }]));
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(setItems.mock.invocationCallOrder[0]);
  });
});

describe('the windows', () => {
  it('"Přidat okno" starts at the clinic’s own day hours', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Přidat okno' }));
    await screen.findByLabelText('Den');
    /* the bulk range has the first two time boxes, the window the last two */
    const times = Array.from(document.querySelectorAll('input[type=time]')) as HTMLInputElement[];
    expect(times).toHaveLength(4);
    expect(times.map((t) => t.value)).toEqual(['08:00', '18:00', '08:00', '18:00']);
  });

  it('"Přidat dny" adds one window for every day of the range, inclusive, with the bulk hours', async () => {
    const user = userEvent.setup();
    mount();
    const dates = await screen.findAllByLabelText('Od', { selector: 'input[type=date]' });
    fireEvent.change(dates[0], { target: { value: '2026-12-07' } });
    fireEvent.change(screen.getAllByLabelText('Do', { selector: 'input[type=date]' })[0], { target: { value: '2026-12-10' } });
    await user.click(screen.getByRole('button', { name: 'Přidat dny' }));
    expect(await screen.findAllByLabelText('Den')).toHaveLength(4);
  });

  it('a range that runs backwards adds nothing', async () => {
    const user = userEvent.setup();
    mount();
    const from = (await screen.findAllByLabelText('Od', { selector: 'input[type=date]' }))[0];
    fireEvent.change(from, { target: { value: '2026-12-10' } });
    fireEvent.change(screen.getAllByLabelText('Do', { selector: 'input[type=date]' })[0], { target: { value: '2026-12-07' } });
    await user.click(screen.getByRole('button', { name: 'Přidat dny' }));
    expect(screen.queryAllByLabelText('Den')).toHaveLength(0);
  });

  it('keeps Uložit off for a window with no day, and for one that ends where it starts', async () => {
    const user = userEvent.setup();
    mount();
    await user.type(await name(), 'Klub');
    await user.click(screen.getByRole('button', { name: 'Přidat okno' }));
    expect(save()).toBeDisabled();
    fireEvent.change(await screen.findByLabelText('Den'), { target: { value: '2026-12-07' } });
    expect(save()).toBeEnabled();
    const times = Array.from(document.querySelectorAll('input[type=time]')) as HTMLInputElement[];
    fireEvent.change(times[3], { target: { value: '08:00' } });
    expect(screen.getByText('Konec musí být později než začátek.')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('counts the cover as the server does: only the open hours, without the lunch break', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Přidat okno' }));
    fireEvent.change(await screen.findByLabelText('Den'), { target: { value: '2026-12-07' } });
    await waitFor(() => expect(preview).toHaveBeenCalled());
    /* the window 08:00-18:00 on a day open 08:00-16:00 with a 30-minute break = 450 minutes */
    expect(await screen.findByText(/Pokryto 450 min z 0 min/)).toBeInTheDocument();
  });

  it('warns about a window on a closed day', async () => {
    preview.mockResolvedValue([{ ...OPEN_DAY('2026-12-07'), isOpen: false, closedBecause: 'holiday' }]);
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Přidat okno' }));
    fireEvent.change(await screen.findByLabelText('Den'), { target: { value: '2026-12-07' } });
    expect(await screen.findByText(/2026-12-07/)).toBeInTheDocument();
  });

  it('sends every window after the items', async () => {
    const user = userEvent.setup();
    mount();
    await user.type(await name(), 'Klub');
    const dates = await screen.findAllByLabelText('Od', { selector: 'input[type=date]' });
    fireEvent.change(dates[0], { target: { value: '2026-12-07' } });
    fireEvent.change(screen.getAllByLabelText('Do', { selector: 'input[type=date]' })[0], { target: { value: '2026-12-08' } });
    await user.click(screen.getByRole('button', { name: 'Přidat dny' }));
    await user.click(save());
    await waitFor(() => expect(addWindow).toHaveBeenCalledTimes(2));
    expect(addWindow.mock.calls.map((call) => call[2])).toEqual([
      { date: '2026-12-07', startTime: '08:00', endTime: '18:00' }, { date: '2026-12-08', startTime: '08:00', endTime: '18:00' },
    ]);
  });
});

describe('a save that fails part-way', () => {
  it('says the partner exists, tells the list to reload, and turns Uložit off so the order is not made twice', async () => {
    addWindow.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    const { onCreated, onClose } = mount();
    await user.type(await name(), 'Klub');
    await user.click(screen.getByRole('button', { name: 'Přidat okno' }));
    fireEvent.change(await screen.findByLabelText('Den'), { target: { value: '2026-12-07' } });
    await user.click(save());
    expect(await screen.findByText(/nezakládejte ho znovu/)).toBeInTheDocument();
    expect(onCreated).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(save()).toBeDisabled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('closes and reloads the list after a complete save', async () => {
    const user = userEvent.setup();
    const { onCreated, onClose } = mount();
    await user.type(await name(), 'Klub');
    await user.click(save());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onCreated).toHaveBeenCalled();
  });

  it('shows the server sentence when the order itself is refused', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    create.mockRejectedValue(new BookingApiError('domainRule', 422, 'Vyplňte název klubu nebo firmy.'));
    const user = userEvent.setup();
    mount();
    await user.type(await name(), 'Klub');
    await user.click(save());
    expect(await screen.findByText(/nezakládejte ho znovu|Vyplňte název/)).toBeInTheDocument();
  });

  it('sends one request for a double click', async () => {
    let finish: (value: unknown) => void = () => undefined;
    create.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    mount();
    await user.type(await name(), 'Klub');
    await user.dblClick(save());
    expect(create).toHaveBeenCalledTimes(1);
    finish({ id: 'o1' });
  });
});

describe('a handoff from the calendar', () => {
  it('fills the dragged slot as a window and the club name, and counts the athletes as the first line', async () => {
    mount({ initial: { partnerName: 'FK Slaný', contactEmail: 'fk@example.cz', headcount: 62, windows: [{ date: '2026-12-07', startTime: '09:00', endTime: '11:00' }] } });
    expect(await name()).toHaveValue('FK Slaný');
    expect(screen.getByLabelText('Kontaktní e-mail')).toHaveValue('fk@example.cz');
    expect(await screen.findByLabelText('Počet')).toHaveValue(62);
    expect(screen.getByLabelText('Den')).toHaveValue('2026-12-07');
  });
});

describe('releasing a held window', () => {
  const order = { id: 'o1', calendarId: 'c1', partnerName: 'FK Slaný' } as never;
  const held = { id: 'w1', date: '2026-12-07', startTime: '09:00:00', endTime: '11:00:00', coveredMinutes: 120 } as never;
  const others = [{ id: 'o2', partnerName: 'SK Kladno' }, { id: 'o3', partnerName: 'Tým Praha' }] as never;
  const release = (extra: Record<string, unknown> = {}) => {
    const onClose = vi.fn();
    const onReleased = vi.fn();
    renderScreen(<ReleaseWindowDialog open order={order} window={held} otherOrders={others} onClose={onClose} onReleased={onReleased} {...extra} />);
    return { onClose, onReleased };
  };

  it('says which window of which partner goes back, and that nobody is chosen by default', () => {
    release();
    expect(screen.getByText(/FK Slaný/)).toBeInTheDocument();
    expect(screen.getByText(/09:00/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /SK Kladno/ })).not.toBeChecked();
    expect(screen.getByText(/nikoho|nikomu/i)).toBeInTheDocument();
  });

  it('sends "to nobody in particular" as public false and no partners', async () => {
    const user = userEvent.setup();
    const { onReleased, onClose } = release();
    await user.click(screen.getByRole('button', { name: 'Uvolnit' }));
    await waitFor(() => expect(releaseWindow).toHaveBeenCalledWith('c1', 'o1', 'w1', { toPublic: false, partnerOrderIds: [] }));
    await waitFor(() => expect(onReleased).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('sends the public flag and the partners that were ticked', async () => {
    const user = userEvent.setup();
    release();
    await user.click(screen.getByRole('checkbox', { name: /veřejnost|web/i }));
    await user.click(screen.getByRole('checkbox', { name: /Tým Praha/ }));
    await user.click(screen.getByRole('button', { name: 'Uvolnit' }));
    await waitFor(() => expect(releaseWindow).toHaveBeenCalledWith('c1', 'o1', 'w1', { toPublic: true, partnerOrderIds: ['o3'] }));
  });

  it('unticking a partner takes it out again', async () => {
    const user = userEvent.setup();
    release();
    await user.click(screen.getByRole('checkbox', { name: /SK Kladno/ }));
    await user.click(screen.getByRole('checkbox', { name: /SK Kladno/ }));
    await user.click(screen.getByRole('button', { name: 'Uvolnit' }));
    await waitFor(() => expect(releaseWindow).toHaveBeenCalled());
    expect(releaseWindow.mock.calls[0][3].partnerOrderIds).toEqual([]);
  });

  it('says there is no other partner when there is none', () => {
    release({ otherOrders: [] });
    expect(screen.getByText(/jiný partner|žádný další/i)).toBeInTheDocument();
  });

  it('shows the refusal and stays open', async () => {
    const { BookingApiError } = await import('../../api/apiError');
    releaseWindow.mockRejectedValue(new BookingApiError('server', 500));
    const user = userEvent.setup();
    const { onClose } = release();
    await user.click(screen.getByRole('button', { name: 'Uvolnit' }));
    await waitFor(() => expect(releaseWindow).toHaveBeenCalled());
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(1));
    expect(onClose).not.toHaveBeenCalled();
  });
});
