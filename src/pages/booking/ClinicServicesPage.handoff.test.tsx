/*
 * The way out of a warning the screen cannot act on itself.
 *
 * The owner opened "Upravit službu" on a service marked "nemá činnosti ani
 * kalendář", looked for somewhere to assign činnosti, and there was none. He
 * was right: the server takes that link from one side only - the činnost
 * names its service, and the calendar names the one it runs - so this screen
 * can name the gap and cannot close it.
 *
 * A warning that tells somebody to do something, on a screen with no way to do
 * it, is the failure this project keeps finding wearing different clothes. So
 * the row carries the service to the screen that can, and the dialog says
 * where the link actually lives instead of leaving him to look for it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const listClinicServices = vi.fn();

vi.mock('../../api/clinicServices', () => ({
  clinicServicesApi: {
    list: listClinicServices,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
  },
}));

const { default: ClinicServicesPage } = await import('./ClinicServicesPage');

const svc = (over: Record<string, unknown> = {}) => ({
  id: 's1', name: 'Sportovní lékařské prohlídky', description: '',
  sortOrder: 0, isActive: true, activities: 0, calendars: 0, ...over,
});

beforeEach(() => {
  listClinicServices.mockReset().mockResolvedValue([svc()]);
});

/* Stands in for the destination and reports what it was handed, so the test
   asserts on the carry rather than on a spy that could drift from the route. */
function Landing({ label }: { label: string }) {
  const { state } = useLocation();
  const id = (state as { clinicServiceId?: string } | null)?.clinicServiceId ?? 'nic';
  return <div>{`${label} dostal ${id}`}</div>;
}

const show = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const ui: ReactNode = (
    <Routes>
      <Route path="/sluzby" element={<ClinicServicesPage />} />
      <Route path="/activities" element={<Landing label="Činnosti" />} />
      <Route path="/calendars" element={<Landing label="Kalendáře" />} />
    </Routes>
  );
  render(
    <MemoryRouter initialEntries={['/sluzby']}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
};

describe('a service nobody has set up', () => {
  it('offers the way to both things it is missing', async () => {
    show();

    expect(await screen.findByRole('button', { name: /Přidat činnost/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Přiřadit kalendář/i })).toBeInTheDocument();
  });

  it('carries the service to the činnosti screen', async () => {
    show();

    await userEvent.click(await screen.findByRole('button', { name: /Přidat činnost/i }));

    expect(await screen.findByText('Činnosti dostal s1')).toBeInTheDocument();
  });

  it('carries the service to the kalendáře screen', async () => {
    show();

    await userEvent.click(await screen.findByRole('button', { name: /Přiřadit kalendář/i }));

    expect(await screen.findByText('Kalendáře dostal s1')).toBeInTheDocument();
  });
});

describe('a service missing only one of the two', () => {
  /* Offering the other would send somebody to fix what is not broken. */
  it('offers only the činnost when that is what is missing', async () => {
    listClinicServices.mockResolvedValue([svc({ activities: 0, calendars: 2 })]);
    show();

    expect(await screen.findByRole('button', { name: /Přidat činnost/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Přiřadit kalendář/i })).not.toBeInTheDocument();
  });

  it('offers only the kalendář when that is what is missing', async () => {
    listClinicServices.mockResolvedValue([svc({ activities: 3, calendars: 0 })]);
    show();

    expect(await screen.findByRole('button', { name: /Přiřadit kalendář/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Přidat činnost/i })).not.toBeInTheDocument();
  });

  it('offers neither to a service that is set up', async () => {
    listClinicServices.mockResolvedValue([svc({ activities: 3, calendars: 1 })]);
    show();

    await screen.findByText('Sportovní lékařské prohlídky');
    expect(screen.queryByRole('button', { name: /Přidat činnost/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Přiřadit kalendář/i })).not.toBeInTheDocument();
  });
});

describe('the dialog he actually opened', () => {
  /*
   * The exact question he asked, answered where he asked it. Without this the
   * dialog is a form that silently omits the thing the row just told him to
   * do, and looking for it is the errand.
   */
  it('says where činnosti and kalendáře are assigned', async () => {
    show();

    await userEvent.click(await screen.findByRole('button', { name: /Upravit službu/i }));

    expect(await screen.findByText(/nepřiřazují odsud/)).toBeInTheDocument();
  });
});
