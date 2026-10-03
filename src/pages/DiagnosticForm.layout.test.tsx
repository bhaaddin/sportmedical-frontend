/*
 * Výsledky (staff) - the diagnostic form in its three layouts, and its second
 * way in: the doctor's manual entry.
 *
 *   390   the wizard's Zpět / Další pinned at the bottom
 *   834 / 1440   them inline under the card
 *
 * What would have to break for these to fail: losing the way to the manual
 * entry from the form, drawing the wizard's buttons twice, or the manual entry
 * asking for the patient's raw id instead of a picker.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../test/viewport';

const create = vi.fn();
vi.mock('../api/diagnostics', () => ({ diagnosticsApi: { create } }));
vi.mock('../api/activities', () => ({ activitiesApi: { list: vi.fn().mockResolvedValue({ activities: [] }) } }));
vi.mock('../api/patients', () => ({ patientsApi: { search: vi.fn().mockResolvedValue([]) } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const { default: DiagnosticForm } = await import('./DiagnosticForm');

beforeEach(() => {
  create.mockReset();
  window.history.replaceState({}, '', '/diagnostics/new');
});

const renderForm = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <DiagnosticForm />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('the wizard', () => {
  it('pins its step buttons at the bottom of a phone', () => {
    setViewport(VIEWPORTS.phone);
    const { container } = renderForm();

    const pinned = container.querySelector('[data-pinned="true"]') as HTMLElement;
    expect(pinned).not.toBeNull();
    expect(pinned.querySelector('button')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Další' })).toHaveLength(1);
  });

  it.each([['iPad', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])(
    'keeps its step buttons under the card on an %s',
    (_name, width) => {
      setViewport(width);
      const { container } = renderForm();

      expect(container.querySelector('[data-pinned="true"]')).toBeNull();
      expect(screen.getAllByRole('button', { name: 'Další' })).toHaveLength(1);
    },
  );

  it('offers the manual entry next to it', () => {
    setViewport(VIEWPORTS.desktop);
    renderForm();

    expect(screen.getByRole('button', { name: 'Průvodce' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Ruční zápis' })).toBeInTheDocument();
  });
});

describe('the manual entry', () => {
  it.each([
    ['phone', VIEWPORTS.phone, 'one-column'],
    ['iPad', VIEWPORTS.tablet, 'grid'],
    ['desktop', VIEWPORTS.desktop, 'grid'],
  ])('opens one page of fields on a %s (%s)', async (_name, width, layout) => {
    setViewport(width);
    const user = userEvent.setup();
    const { container } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Ruční zápis' }));

    expect(container.querySelector(`form[data-layout="${layout}"]`)).not.toBeNull();
    /* a picker, not a box for a raw patient id */
    expect(screen.getByLabelText(/^Pacient/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/ID pacienta/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^VO₂max/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uložit hodnoty' })).toBeInTheDocument();
  });

  it('goes back to the wizard with its toggle', async () => {
    setViewport(VIEWPORTS.desktop);
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Ruční zápis' }));
    await user.click(screen.getByRole('button', { name: 'Průvodce' }));

    expect(screen.getByLabelText(/ID pacienta/)).toBeInTheDocument();
  });
});
