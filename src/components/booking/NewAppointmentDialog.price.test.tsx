/*
 * Etapa 12: the price in the booking dialog (the owner, 10. 10. 2026: "the
 * price must be visible and editable ... as soon as I click, there is a Cena
 * field and I can correct it. No percentages needed").
 *
 *   - every činnost reads its price BEFORE it is chosen - the step-2 cards and
 *     the quick-registration select alike, "bez ceny" when the list has none;
 *   - choosing one shows "Cena", prefilled from the list, "podle ceníku";
 *   - typing another amount says "upraveno (ceník …)", offers "Vrátit ceník",
 *     moves "Celkem k úhradě", and goes out as `agreedPriceCzk`; untouched
 *     goes out as `null`;
 *   - no percentage anywhere.
 *
 * At the three widths.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';

vi.setConfig({ testTimeout: 30000 });

const listCalendars = vi.fn();
const listActivities = vi.fn();
const preview = vi.fn();
const getAvailability = vi.fn();
const create = vi.fn();
const createUnregistered = vi.fn();
const createQuick = vi.fn();
const listPatients = vi.fn();
const getProfile = vi.fn();

vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview } }));
vi.mock('../../api/appointments', () => ({
  appointmentsApi: { getAvailability, create, createUnregistered, createQuick },
}));
vi.mock('../../api/patients', () => ({ patientsApi: { list: listPatients, getProfile, getById: vi.fn() } }));
vi.mock('../../api/patientPreRegistration', () => ({ patientPreRegistrationApi: { issueLink: vi.fn() } }));
vi.mock('../../services/clubsApi', () => ({ clubsApi: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../api/onSiteConsents', () => ({
  onSiteConsentsApi: { getOptions: vi.fn().mockResolvedValue({ activityId: '', options: [] }), record: vi.fn() },
  default: { getOptions: vi.fn().mockResolvedValue({ activityId: '', options: [] }), record: vi.fn() },
}));

const { NewAppointmentDialog } = await import('./NewAppointmentDialog');

function open(props: Partial<Parameters<typeof NewAppointmentDialog>[0]> = {}) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <NewAppointmentDialog
          open
          onClose={vi.fn()}
          onBooked={vi.fn()}
          initialCalendarId="c1"
          initialStart="2026-09-24T09:00"
          initialEnd="2026-09-24T09:30"
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/* Prices are grouped with a no-break space; the tests read them as plain words. */
const plain = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ');
const priceBox = () => screen.getByLabelText('Cena') as HTMLInputElement;
const caption = () => plain(screen.getByTestId('agreed-price-caption').textContent);
const total = () => plain(screen.getByTestId('total-due').textContent);

async function toStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Jen zablokovat čas bez pacienta' }));
  await user.click(screen.getByRole('button', { name: 'Pokračovat' }));
  await screen.findByText('Krok 2 ze 2 — co se bude dělat');
}

beforeEach(() => {
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'patients.view', 'patients.register']));
  listCalendars.mockReset().mockResolvedValue([{ id: 'c1', name: 'Ordinace 1', isActive: true }]);
  listActivities.mockReset().mockResolvedValue({
    activities: [
      { id: 'a1', name: 'Základní', durationMinutes: 30, isActive: true, priceCzk: 1600 },
      { id: 'a2', name: 'Bez ceníku', durationMinutes: 45, isActive: true, priceCzk: null },
    ],
    warnings: [],
  });
  preview.mockReset().mockResolvedValue([
    { date: '2026-09-24', isOpen: true, closedBecause: null, offeredActivityIds: ['a1', 'a2'] },
  ]);
  getAvailability.mockReset().mockResolvedValue([{ startUtc: '2026-09-24T07:00:00Z', endUtc: '2026-09-24T07:30:00Z' }]);
  create.mockReset().mockResolvedValue({ appointment: { startUtc: '2026-09-24T07:00:00Z' }, warnings: [] });
  createUnregistered.mockReset().mockResolvedValue({ startUtc: '2026-09-24T07:00:00Z' });
  createQuick.mockReset().mockResolvedValue({
    appointment: { id: 'q1', startUtc: '2026-09-24T07:00:00Z', endUtc: '2026-09-24T07:30:00Z', activityName: 'Základní' },
    patientId: 'np1',
    completionLink: { url: 'https://sportmedical.test/dokonceni/tok', token: 'tok', expiresAtUtc: '2026-09-25T07:00:00Z' },
    registrationDeadlineUtc: '2026-09-25T07:00:00Z',
  });
  listPatients.mockReset().mockResolvedValue({ items: [], totalCount: 0 });
  getProfile.mockReset().mockResolvedValue({});
});

describe.each([['phone', VIEWPORTS.phone], ['tablet', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]] as const)(
  'the price of a booking · %s',
  (_name, width) => {
    beforeEach(() => setViewport(width, width === VIEWPORTS.desktop ? 900 : 1112));

    it('step 2: every card reads "{price} · {min}" before the click, "bez ceny" when the list has none, and no "Cena" yet', async () => {
      const user = userEvent.setup();
      open();
      await toStep2(user);
      const cards = await screen.findByRole('radiogroup', { name: 'Činnost' });
      expect(within(cards).getAllByTestId('activity-card-caption').map((c) => plain(c.textContent))).toEqual([
        '1 600 Kč · 30 min',
        'bez ceny · 45 min',
      ]);
      expect(screen.queryByLabelText('Cena')).toBeNull();
      expect(screen.queryByText(/%/)).toBeNull();
    });

    it('step 2: choosing a činnost shows "Cena" prefilled from the list; typing moves the total, "Vrátit ceník" puts it back, and the payload carries agreedPriceCzk', async () => {
      const user = userEvent.setup();
      open();
      await toStep2(user);
      await user.click(await screen.findByRole('radio', { name: 'Základní' }));

      expect(priceBox().value).toBe('1600');
      expect(caption()).toBe('podle ceníku');
      expect(screen.queryByRole('button', { name: 'Vrátit ceník' })).toBeNull();
      expect(total()).toBe('1 600 Kč');
      /* 44 px, a touch target on every device. */
      expect(priceBox().closest('.MuiInputBase-root')).toHaveStyle({ minHeight: '44px' });

      await user.clear(priceBox());
      await user.type(priceBox(), '1200');
      expect(caption()).toBe('upraveno (ceník 1 600 Kč)');
      expect(total()).toBe('1 200 Kč');

      await user.click(screen.getByRole('button', { name: 'Vrátit ceník' }));
      expect(priceBox().value).toBe('1600');
      expect(caption()).toBe('podle ceníku');
      expect(total()).toBe('1 600 Kč');

      /* Typed again, and booked with it. */
      await user.clear(priceBox());
      await user.type(priceBox(), '1200,50');
      expect(total()).toBe('1 200,5 Kč');
      await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.');
      await user.click(screen.getByRole('button', { name: 'Objednat termín' }));
      await waitFor(() => expect(createUnregistered).toHaveBeenCalledTimes(1));
      expect(createUnregistered).toHaveBeenCalledWith(expect.objectContaining({ activityId: 'a1', agreedPriceCzk: 1200.5 }));
    });

    it('step 2: untouched, the list price goes out as null; the same figure typed goes out as the number', async () => {
      const user = userEvent.setup();
      open();
      await toStep2(user);
      await user.click(await screen.findByRole('radio', { name: 'Základní' }));
      await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.');
      await user.click(screen.getByRole('button', { name: 'Objednat termín' }));
      await waitFor(() => expect(createUnregistered).toHaveBeenCalledWith(expect.objectContaining({ agreedPriceCzk: null })));
    });

    it('step 2: another činnost starts from its own list price; a činnost without one reads "ceník cenu neuvádí"', async () => {
      const user = userEvent.setup();
      open();
      await toStep2(user);
      await user.click(await screen.findByRole('radio', { name: 'Základní' }));
      await user.clear(priceBox());
      await user.type(priceBox(), '1200');
      await user.click(screen.getByRole('radio', { name: 'Bez ceníku' }));
      expect(priceBox().value).toBe('');
      expect(caption()).toBe('ceník cenu neuvádí');
      expect(total()).toBe('—');
      await user.type(priceBox(), '900');
      expect(caption()).toBe('upraveno (ceník bez ceny)');
      expect(total()).toBe('900 Kč');
    });

    it('step 2: an amount that is not money disables booking until it is fixed', async () => {
      const user = userEvent.setup();
      open();
      await toStep2(user);
      await user.click(await screen.findByRole('radio', { name: 'Základní' }));
      await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.');
      await user.clear(priceBox());
      await user.type(priceBox(), '-5');
      expect(caption()).toMatch(/Zadejte částku/);
      expect(total()).toBe('—');
      expect(screen.getByRole('button', { name: 'Objednat termín' })).toBeDisabled();
      await user.click(screen.getByRole('button', { name: 'Vrátit ceník' }));
      expect(screen.getByRole('button', { name: 'Objednat termín' })).toBeEnabled();
    });

    it('quick registration: the select reads the prices, choosing shows "Cena", and the one call carries the typed amount', async () => {
      const user = userEvent.setup();
      open();
      await user.click(await screen.findByRole('radio', { name: 'Rychlá registrace' }));
      expect(screen.queryByLabelText('Cena')).toBeNull();

      await user.click(screen.getByRole('combobox', { name: 'Prohlídka, na kterou volal' }));
      const options = (await screen.findAllByRole('option')).filter((o) => o.hasAttribute('data-value') && o.getAttribute('aria-disabled') !== 'true');
      expect(options.map((o) => plain(o.textContent))).toEqual(['Základní — 1 600 Kč · 30 min', 'Bez ceníku — bez ceny · 45 min']);
      await user.click(options[0]);

      expect(priceBox().value).toBe('1600');
      expect(caption()).toBe('podle ceníku');
      await user.clear(priceBox());
      await user.type(priceBox(), '1500');
      expect(caption()).toBe('upraveno (ceník 1 600 Kč)');

      await user.type(screen.getByLabelText('Jméno a příjmení'), 'Filip Fehér');
      await user.type(screen.getByLabelText('Telefon'), '773539001');
      await user.type(screen.getByLabelText('E-mail'), 'filip@example.cz');
      await screen.findByText('Slot je volný. Nekoliduje s žádnou rezervací ani s obědem.');
      await user.click(screen.getByRole('button', { name: 'Vytvořit rezervaci' }));
      await waitFor(() => expect(createQuick).toHaveBeenCalledTimes(1));
      expect(createQuick).toHaveBeenCalledWith('c1', expect.objectContaining({ activityId: 'a1', agreedPriceCzk: 1500 }));
      /* The booked panel repeats the agreed figure, not the list's. */
      expect(await screen.findByText(/Základní — 1.500 Kč · 30 min/)).toBeInTheDocument();
    });
  },
);
