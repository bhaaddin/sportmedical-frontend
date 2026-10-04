/*
 * The availability screen at the three widths (Etapa 2 brief, rule 3).
 *
 * Phone (390): a list is a stack of cards, the screen's main action is pinned
 * at the bottom, filters scroll sideways. Tablet (834): a table with three
 * columns. Desktop (1440): the whole table. Every list also has a loading
 * placeholder, an empty state in Czech and an error state with "Zkusit znovu"
 * (rule 8) - a failed load is never drawn as an empty list.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS, type ViewportName } from '../test/viewport';

const availabilityGetAll = vi.fn();

vi.mock('../api/availability', () => ({ availabilityApi: { getAll: availabilityGetAll, create: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

/* The picker searches the whole register; here it is one button that picks a patient. */
vi.mock('../components/patients/PatientPicker', () => ({
  default: ({ onChange }: { onChange: (p: unknown) => void }) => (
    <button type="button" onClick={() => onChange({ id: 'p1', firstName: 'Jana', lastName: 'Marková' })}>
      Vybrat pacienta
    </button>
  ),
}));

const { default: Availability } = await import('./Availability');

const WIDTHS: ViewportName[] = ['phone', 'tablet', 'desktop'];

function renderAt(width: ViewportName, ui: React.ReactElement) {
  setViewport(VIEWPORTS[width]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const headers = () => screen.queryAllByRole('columnheader').map((h) => h.textContent);

beforeEach(() => {
  availabilityGetAll.mockReset();
  setViewport(VIEWPORTS.desktop);
});

/* ───────── Dostupnost ───────── */
const avail = (id: string, status: string, name: string) => ({
  id, patientId: `${id}-uuid`, patientName: name, date: '2026-09-30T00:00:00Z', status, reason: 'Zranění kolene',
  expectedReturnDate: '2026-11-01T00:00:00Z', updatedBy: 'MUDr. Novák',
});

describe('Dostupnost sportovců', () => {
  describe.each(WIDTHS)('at %s', (width) => {
    it('lays the athletes out for that width', async () => {
      availabilityGetAll.mockResolvedValue([avail('a1', 'Unavailable', 'Jan Novák'), avail('a2', 'Available', 'Eva Černá')]);
      const { container } = renderAt(width, <Availability />);
      await screen.findByText('Jan Novák');

      if (width === 'phone') {
        expect(container.querySelector('[data-layout="cards"]')).not.toBeNull();
        expect(container.querySelector('[data-pinned="true"]')).not.toBeNull();
        expect(container.querySelector('[data-scroll="x"]')).not.toBeNull();
      } else if (width === 'tablet') {
        expect(headers()).toEqual(['Sportovec', 'Stav', 'Návrat']);
      } else {
        expect(headers()).toEqual(['Sportovec', 'Stav', 'Důvod', 'Návrat', 'Zapsáno']);
      }
      expect(screen.getAllByRole('button', { name: 'Přidat' })).toHaveLength(1);
    });
  });

  it('filters by state', async () => {
    availabilityGetAll.mockResolvedValue([avail('a1', 'Unavailable', 'Jan Novák'), avail('a2', 'Available', 'Eva Černá')]);
    renderAt('desktop', <Availability />);
    await screen.findByText('Jan Novák');
    await userEvent.click(screen.getByRole('button', { name: /^K dispozici/ }));
    expect(screen.queryByText('Jan Novák')).toBeNull();
    expect(within(screen.getByRole('table')).getByText('Eva Černá')).toBeInTheDocument();
  });

  it('says so when nobody is recorded', async () => {
    availabilityGetAll.mockResolvedValue([]);
    renderAt('phone', <Availability />);
    expect(await screen.findByText('Žádné záznamy o dostupnosti')).toBeInTheDocument();
  });

  it('shows what failed and retries', async () => {
    availabilityGetAll.mockRejectedValueOnce(new Error('500')).mockResolvedValue([avail('a1', 'Modified', 'Jan Novák')]);
    renderAt('phone', <Availability />);
    expect(await screen.findByText(/Dostupnost sportovců se nepodařilo načíst/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(await screen.findByText('Jan Novák')).toBeInTheDocument();
  });
});
