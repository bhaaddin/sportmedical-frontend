/*
 * The booking flow on the three devices (Etapa 2, decision 13), at 390 / 834 /
 * 1440: which container it lives in, that the quick registration works end to
 * end in each, and that what a finger has to hit is big enough.
 *
 *   desktop  the 580 px side panel      (data-layout="side-panel")
 *   tablet   a half-height bottom panel (data-layout="bottom-panel", upright)
 *            or the side panel again    (held sideways)
 *   phone    the whole screen           (data-layout="full-screen")
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { setViewport, VIEWPORTS, type ViewportName } from '../../test/viewport';

vi.setConfig({ testTimeout: 20000 });

const listCalendars = vi.fn();
const listActivities = vi.fn();
const preview = vi.fn();
const getAvailability = vi.fn();
const createQuick = vi.fn();
const create = vi.fn();
const listPatients = vi.fn();
const getProfile = vi.fn();
const getById = vi.fn();
const getAllClubs = vi.fn();

vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview } }));
vi.mock('../../api/appointments', () => ({
  appointmentsApi: { getAvailability, create, createUnregistered: vi.fn(), createQuick },
}));
vi.mock('../../api/patients', () => ({ patientsApi: { list: listPatients, getProfile, getById } }));
vi.mock('../../api/patientPreRegistration', () => ({
  patientPreRegistrationApi: { issueLink: vi.fn() },
}));
vi.mock('../../services/clubsApi', () => ({ clubsApi: { getAll: getAllClubs } }));

const { NewAppointmentDialog } = await import('./NewAppointmentDialog');

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <NewAppointmentDialog
                open
                onClose={onClose}
                onBooked={vi.fn()}
                initialCalendarId="c1"
                initialStart="2026-09-24T09:00"
                initialEnd="2026-09-24T10:00"
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onClose };
}

const panel = () => screen.getByRole('dialog');

/** Sets the viewport; a tablet is held upright unless a height is given. */
function viewportFor(name: ViewportName, height?: number) {
  setViewport(VIEWPORTS[name], height ?? (name === 'tablet' ? 1112 : name === 'phone' ? 844 : 900));
}

async function fillQuick() {
  await userEvent.click(screen.getByRole('radio', { name: 'Rychlá registrace' }));
  await userEvent.type(screen.getByLabelText('Jméno a příjmení'), 'Filip Fehér');
  await userEvent.type(screen.getByLabelText('Telefon'), '773539001');
  await userEvent.type(screen.getByLabelText('E-mail'), 'filip@example.cz');
  await userEvent.click(screen.getByRole('combobox', { name: 'Prohlídka, na kterou volal' }));
  await userEvent.click(await screen.findByRole('option', { name: /^Prohlídka —/ }));
}

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'patients.view', 'patients.register']));
  listCalendars.mockReset().mockResolvedValue([{ id: 'c1', name: 'Sportovní prohlídka', isActive: true }]);
  listActivities.mockReset().mockResolvedValue({
    activities: [{ id: 'a1', name: 'Prohlídka', durationMinutes: 30, isActive: true, priceCzk: 1600 }],
    warnings: [],
  });
  preview.mockReset().mockResolvedValue([
    { date: '2026-09-24', isOpen: true, closedBecause: null, offeredActivityIds: ['a1'] },
  ]);
  getAvailability.mockReset().mockResolvedValue([{ startUtc: '2026-09-24T07:00:00Z', endUtc: '2026-09-24T07:30:00Z' }]);
  createQuick.mockReset().mockResolvedValue({
    appointment: {
      id: 'q1',
      startUtc: '2026-09-24T07:00:00Z',
      endUtc: '2026-09-24T07:30:00Z',
      activityName: 'Prohlídka',
    },
    patientId: 'np1',
    completionLink: { url: 'https://sportmedical.test/dokonceni/tok', token: 'tok', expiresAtUtc: '2026-09-25T07:00:00Z' },
    registrationDeadlineUtc: '2026-09-25T07:00:00Z',
  });
  listPatients.mockReset().mockResolvedValue({ items: [], totalCount: 0 });
  getProfile.mockReset().mockResolvedValue({});
  getById.mockReset().mockResolvedValue({});
  getAllClubs.mockReset().mockResolvedValue([
    { id: 'k1', name: 'FK Slaný', ico: '1', contactPerson: 'Jan Novák', paymentTermsDays: 14, isActive: true, createdAt: '' },
  ]);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe('which container the booking flow lives in', () => {
  it('desktop (1440): the 580 px side panel', async () => {
    viewportFor('desktop');
    renderDialog();
    expect(panel()).toHaveAttribute('data-layout', 'side-panel');
    expect(panel()).toHaveStyle({ width: '580px' });
    expect(await screen.findByText('Čtvrtek 24. 9. 2026 · 09:00 — 10:00')).toBeInTheDocument();
  });

  it('tablet upright (834): a bottom panel, half height, with the swipe handle', async () => {
    viewportFor('tablet');
    renderDialog();
    expect(panel()).toHaveAttribute('data-layout', 'bottom-panel');
    expect(panel()).toHaveAttribute('data-expanded', 'false');
    expect(within(panel()).getByRole('button', { name: 'Rozbalit panel' })).toBeInTheDocument();
    expect(await screen.findByText('Čtvrtek 24. 9. 2026 · 09:00 — 10:00')).toBeInTheDocument();
  });

  it('tablet upright: nothing is focused for the user, so the panel opens at half height', async () => {
    viewportFor('tablet');
    renderDialog();
    await screen.findByText('Čtvrtek 24. 9. 2026 · 09:00 — 10:00');
    expect(panel()).toHaveAttribute('data-expanded', 'false');
    expect(screen.getByLabelText('Jméno nebo příjmení')).not.toHaveFocus();
  });

  it('tablet upright: grows to the full height when a field takes the keyboard', async () => {
    viewportFor('tablet');
    renderDialog();
    await userEvent.click(screen.getByLabelText('Jméno nebo příjmení'));
    expect(panel()).toHaveAttribute('data-expanded', 'true');
  });

  it('tablet held sideways (1194 × 834): the side panel again', async () => {
    setViewport(1194, 834);
    renderDialog();
    expect(panel()).toHaveAttribute('data-layout', 'side-panel');
    expect(panel()).not.toHaveAttribute('data-expanded');
    await screen.findByText('Čtvrtek 24. 9. 2026 · 09:00 — 10:00');
  });

  it('phone (390): the whole screen, the back arrow for a way out and the action pinned below', async () => {
    viewportFor('phone');
    const { onClose } = renderDialog();
    expect(panel()).toHaveAttribute('data-layout', 'full-screen');
    expect(panel()).toHaveStyle({ width: '100%', height: '100%' });
    await screen.findByText('Čtvrtek 24. 9. 2026 · 09:00 — 10:00');
    const footer = within(panel()).getByTestId('panel-footer');
    expect(within(footer).getByRole('button', { name: 'Pokračovat' })).toBeInTheDocument();
    await userEvent.click(within(panel()).getByRole('button', { name: 'Zavřít' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('the quick registration, on every device', () => {
  it.each(['phone', 'tablet', 'desktop'] as ViewportName[])(
    'books with four facts at %s width and shows the deadline, the link and the copy button',
    async (name) => {
      viewportFor(name);
      renderDialog();
      await fillQuick();
      expect(await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Datum narození')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Vytvořit rezervaci' }));
      await waitFor(() => expect(createQuick).toHaveBeenCalledTimes(1));
      expect(createQuick).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ firstName: 'Filip', lastName: 'Fehér', phone: '+420773539001', email: 'filip@example.cz' }),
      );

      expect(await screen.findByRole('heading', { name: 'Rezervace vytvořena' })).toBeInTheDocument();
      expect(screen.getByText('Pacient má čas na dokončení registrace do 25. 9. 2026 09:00')).toBeInTheDocument();
      expect(screen.getByTestId('quick-completion-link')).toHaveTextContent('https://sportmedical.test/dokonceni/tok');
      await userEvent.click(screen.getByRole('button', { name: 'Kopírovat' }));
      await waitFor(() =>
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://sportmedical.test/dokonceni/tok'),
      );
      expect(await screen.findByText('Odkaz zkopírován do schránky')).toBeInTheDocument();
    },
  );

  it.each([
    ['desktop', '1fr 1fr'],
    ['tablet', '1fr 1fr'],
    ['phone', '1fr'],
  ] as [ViewportName, string][])(
    'puts the telephone and the e-mail %s: columns %s - one per row on a phone',
    async (name, columns) => {
      viewportFor(name);
      renderDialog();
      await userEvent.click(screen.getByRole('radio', { name: 'Rychlá registrace' }));
      expect(screen.getByTestId('quick-contact-row')).toHaveStyle({ gridTemplateColumns: columns });
    },
  );
});

describe('what a finger has to hit', () => {
  it('phone: the mode cards are 56 px rows, the footer buttons 48 px, the back arrow 44 px', async () => {
    viewportFor('phone');
    renderDialog();
    const cards = screen.getByRole('radiogroup', { name: 'Kdo se objednává' });
    expect(cards).toHaveStyle({ gridTemplateColumns: '1fr' });
    for (const radio of within(cards).getAllByRole('radio')) {
      expect(radio).toHaveStyle({ minHeight: '56px' });
    }
    const footer = within(panel()).getByTestId('panel-footer');
    for (const button of within(footer).getAllByRole('button')) {
      expect(button).toHaveStyle({ minHeight: '48px' });
    }
    expect(within(panel()).getByRole('button', { name: 'Zavřít' })).toHaveStyle({ width: '44px', height: '44px' });
  });

  it('phone: "Změnit" on the slot card is not smaller than 44 px', async () => {
    viewportFor('phone');
    renderDialog();
    const change = await screen.findByRole('button', { name: 'Změnit' });
    expect(getComputedStyle(change).minHeight).toBe('44px');
  });

  it('desktop keeps the board\'s two cards in a row and its 46 px footer buttons', () => {
    viewportFor('desktop');
    renderDialog();
    expect(screen.getByRole('radiogroup', { name: 'Kdo se objednává' })).toHaveStyle({
      gridTemplateColumns: 'repeat(2, 1fr)',
    });
    const footer = within(panel()).getByTestId('panel-footer');
    for (const button of within(footer).getAllByRole('button')) {
      expect(button).toHaveStyle({ minHeight: '46px' });
    }
  });
});

describe('no clubs in the drawer, on every device', () => {
  it.each(['phone', 'tablet', 'desktop'] as ViewportName[])('offers only database and quick registration at %s width', async (name) => {
    viewportFor(name);
    renderDialog();
    const who = await screen.findByRole('radiogroup', { name: 'Kdo se objednává' });
    expect(within(who).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Z databáze', 'Rychlá registrace']);
    expect(screen.queryByLabelText(/klub/i)).not.toBeInTheDocument();
    await userEvent.click(within(who).getByRole('radio', { name: 'Rychlá registrace' }));
    expect(screen.getByLabelText('Jméno a příjmení')).toBeInTheDocument();
    expect(screen.queryByLabelText(/klub/i)).not.toBeInTheDocument();
    expect(getAllClubs).not.toHaveBeenCalled();
  });
});
