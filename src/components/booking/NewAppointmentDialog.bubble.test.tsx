/*
 * Etapa 12, "rovnou na bublinku": with an `anchor` (the marked slot's box in
 * viewport pixels) a desktop and a tablet render the booking as a popover with
 * a caret pointing at the slot; a phone keeps the full-screen drawer, and so
 * does every opening without an anchor. Esc and a click outside close the
 * bubble - after "Zahodit rozpracovanou objednávku?" once something was typed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { setViewport, VIEWPORTS } from '../../test/viewport';

vi.setConfig({ testTimeout: 30000 });

const listCalendars = vi.fn();
const listActivities = vi.fn();
const preview = vi.fn();

vi.mock('../../api/calendars', () => ({ calendarsApi: { list: listCalendars } }));
vi.mock('../../api/activities', () => ({ activitiesApi: { list: listActivities } }));
vi.mock('../../api/workingHours', () => ({ workingHoursApi: { preview } }));
vi.mock('../../api/appointments', () => ({
  appointmentsApi: { getAvailability: vi.fn().mockResolvedValue([]), create: vi.fn(), createUnregistered: vi.fn(), createQuick: vi.fn() },
}));
vi.mock('../../api/patients', () => ({ patientsApi: { list: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }), getProfile: vi.fn(), getById: vi.fn() } }));
vi.mock('../../api/patientPreRegistration', () => ({ patientPreRegistrationApi: { issueLink: vi.fn() } }));
vi.mock('../../services/clubsApi', () => ({ clubsApi: { getAll: vi.fn().mockResolvedValue([]) } }));

const { NewAppointmentDialog } = await import('./NewAppointmentDialog');

/* A slot box on the left half of a 1440 screen, as `getBoundingClientRect()` would report it. */
const ANCHOR = { x: 320, y: 400, width: 180, height: 40 };

function open(props: Partial<Parameters<typeof NewAppointmentDialog>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <NewAppointmentDialog
          open
          onClose={onClose}
          onBooked={vi.fn()}
          initialCalendarId="c1"
          initialStart="2026-09-24T09:00"
          initialEnd="2026-09-24T09:30"
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onClose };
}

const dialog = () => screen.getByRole('dialog');

beforeEach(() => {
  window.localStorage.setItem('permissions', JSON.stringify(['bookings.create', 'patients.view', 'patients.register']));
  listCalendars.mockReset().mockResolvedValue([{ id: 'c1', name: 'Ordinace 1', isActive: true }]);
  listActivities.mockReset().mockResolvedValue({
    activities: [{ id: 'a1', name: 'Základní', durationMinutes: 30, isActive: true, priceCzk: 1600 }],
    warnings: [],
  });
  preview.mockReset().mockResolvedValue([{ date: '2026-09-24', isOpen: true, closedBecause: null, offeredActivityIds: ['a1'] }]);
});

describe.each([['desktop', VIEWPORTS.desktop, 900], ['tablet', VIEWPORTS.tablet, 1112]] as const)(
  'with an anchor · %s',
  (_name, width, height) => {
    beforeEach(() => setViewport(width, height));

    it('renders the bubble with a caret pointing at the slot, 440 px wide, the step inside it', async () => {
      open({ anchor: ANCHOR });
      const panel = dialog();
      expect(panel).toHaveAttribute('data-layout', 'bubble');
      expect(panel).toHaveStyle({ width: '440px', position: 'fixed' });
      const caret = within(panel).getByTestId('bubble-caret');
      /* On a 1440 screen the slot's right has room; on an 834 tablet neither side does, so it goes below. */
      expect(caret).toHaveAttribute('data-side', width === VIEWPORTS.desktop ? 'right' : 'below');
      expect(panel).toHaveAttribute('data-side', caret.getAttribute('data-side'));
      expect(within(panel).getByRole('heading', { name: 'Objednat termín' })).toBeInTheDocument();
      expect(within(panel).getByText('Krok 1 ze 2 — kdo přijde')).toBeInTheDocument();
      expect(within(panel).getByRole('radio', { name: 'Rychlá registrace' })).toBeInTheDocument();
      expect(screen.getByTestId('panel-footer')).toBeInTheDocument();
    });

    it('sits beside the slot with a gap, or flips to the left when the right has no room', async () => {
      if (width !== VIEWPORTS.desktop) return;
      open({ anchor: ANCHOR });
      expect(dialog()).toHaveStyle({ left: `${320 + 180 + 12}px` });
      cleanup();
      open({ anchor: { ...ANCHOR, x: 1200 } });
      expect(dialog()).toHaveAttribute('data-side', 'left');
      expect(dialog()).toHaveStyle({ left: `${1200 - 12 - 440}px` });
    });

    it('Esc with nothing typed closes at once; with something typed it asks first', async () => {
      const user = userEvent.setup();
      const { onClose } = open({ anchor: ANCHOR });
      await screen.findByRole('radio', { name: 'Rychlá registrace' });
      fireEvent.keyDown(dialog(), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Zahodit rozpracovanou objednávku?')).toBeNull();

      await user.click(screen.getByRole('radio', { name: 'Rychlá registrace' }));
      await user.type(screen.getByLabelText('Jméno a příjmení'), 'Filip');
      fireEvent.keyDown(dialog(), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
      const ask = screen.getByRole('alertdialog', { name: 'Zahodit rozpracovanou objednávku?' });
      await user.click(within(ask).getByRole('button', { name: 'Pokračovat' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(dialog(), { key: 'Escape' });
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Zahodit' }));
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('a click on the scrim outside asks the same question when something was typed', async () => {
      const user = userEvent.setup();
      const { onClose } = open({ anchor: ANCHOR });
      await user.click(await screen.findByRole('radio', { name: 'Rychlá registrace' }));
      await user.type(screen.getByLabelText('Jméno a příjmení'), 'Filip');
      const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
      expect(backdrop).not.toBeNull();
      await user.click(backdrop);
      expect(screen.getByRole('alertdialog', { name: 'Zahodit rozpracovanou objednávku?' })).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('the "Zavřít" button asks too, "Zrušit" in the footer closes without asking', async () => {
      const user = userEvent.setup();
      const { onClose } = open({ anchor: ANCHOR });
      await user.click(await screen.findByRole('radio', { name: 'Rychlá registrace' }));
      await user.type(screen.getByLabelText('Jméno a příjmení'), 'Filip');
      await user.click(screen.getByRole('button', { name: 'Zavřít' }));
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: 'Zrušit' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  },
);

describe('without a bubble', () => {
  it('phone: the anchor is ignored and the full-screen drawer stays', async () => {
    setViewport(VIEWPORTS.phone, 844);
    open({ anchor: ANCHOR });
    expect(dialog()).toHaveAttribute('data-layout', 'full-screen');
    expect(screen.queryByTestId('bubble-caret')).toBeNull();
  });

  it('desktop without an anchor: exactly the side panel as before', async () => {
    setViewport(VIEWPORTS.desktop, 900);
    open();
    expect(dialog()).toHaveAttribute('data-layout', 'side-panel');
    expect(screen.queryByTestId('bubble-caret')).toBeNull();
  });

  it('upright tablet without an anchor: the bottom panel as before', async () => {
    setViewport(VIEWPORTS.tablet, 1112);
    open();
    expect(dialog()).toHaveAttribute('data-layout', 'bottom-panel');
  });
});
