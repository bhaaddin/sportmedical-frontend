/*
 * "Tým, Zaměstnanci, Zabezpečení ... show NOTHING after a click."
 *
 * A screen whose load fails, or is still on its way, used to draw a bare
 * spinner or a bare red box with no title, no breadcrumb and no way to try
 * again - which is what "nothing" looks like. Each of these keeps the frame
 * (breadcrumb, title, sentence) in every state, says what failed and offers
 * "Zkusit znovu".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StaffManagement from '../StaffManagement';
import AuditLog from '../AuditLog';
import SystemHealth from '../SystemHealth';
import TwoFactorPage from './TwoFactorPage';
import { SettingsScreen } from './SettingsFrame';
import { setViewport, VIEWPORTS } from '../../test/viewport';

const get = vi.fn();
vi.mock('../../api/client', () => ({ default: { get: (...a: unknown[]) => get(...a) }, client: { get: (...a: unknown[]) => get(...a) } }));

const list = vi.fn();
vi.mock('../../api/userAccounts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/userAccounts')>()),
  userAccountsApi: { list: (...a: unknown[]) => list(...a) },
}));

const status = vi.fn();
vi.mock('../../api/twoFactor', () => ({ twoFactorApi: { status: (...a: unknown[]) => status(...a) } }));

beforeEach(() => {
  get.mockReset();
  list.mockReset();
  status.mockReset();
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage', 'users.manage', 'roles.manage']));
  setViewport(VIEWPORTS.desktop);
});

const at = (path: string, ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
  </QueryClientProvider>
);

describe.each(Object.entries(VIEWPORTS))('a failed load at %s (%i px)', (_n, width) => {
  beforeEach(() => setViewport(width));

  it('Uživatelé a práva keeps its title and offers Zkusit znovu', async () => {
    list.mockRejectedValue(new Error('down'));
    render(at('/staff-management', <StaffManagement />));

    expect(await screen.findByRole('heading', { level: 1, name: 'Uživatelé a práva' })).toBeInTheDocument();
    expect(await screen.findByText('Seznam účtů se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Kde jste' })).toHaveTextContent('Systém');

    list.mockResolvedValue([{ userId: 'u1', displayName: 'Jana Nová', email: 'j@n.cz', role: 'Staff', isActive: true, mustChangePassword: false, lastLoginAtUtc: null }]);
    await userEvent.setup().click(screen.getByRole('button', { name: /Zkusit znovu/ }));
    expect(await screen.findByText('Jana Nová')).toBeInTheDocument();
  });

  it('Zabezpečení keeps its title and offers Zkusit znovu', async () => {
    status.mockRejectedValue(new Error('down'));
    render(at('/nastaveni/zabezpeceni', <TwoFactorPage />));

    expect(await screen.findByRole('heading', { level: 1, name: 'Zabezpečení' })).toBeInTheDocument();
    const retry = await screen.findByRole('button', { name: 'Zkusit znovu' });

    status.mockResolvedValue({ enabled: false, setupPending: false });
    await userEvent.setup().click(retry);
    expect(await screen.findByRole('button', { name: /Zapnout dvoufázové ověření/ })).toBeInTheDocument();
  });

  it('Auditní log says it did not load - it does not pretend the log is empty', async () => {
    get.mockRejectedValue(new Error('down'));
    render(at('/audit-log', <AuditLog />));

    expect(await screen.findByText('Auditní log se nepodařilo načíst.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Auditní log' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zkusit znovu/ })).toBeInTheDocument();
  });

  it('Zdraví systému keeps its title when the numbers do not come', async () => {
    get.mockRejectedValue(new Error('down'));
    render(at('/system-health', <SystemHealth />));

    expect(await screen.findByRole('heading', { level: 1, name: 'Zdraví systému' })).toBeInTheDocument();
    expect((await screen.findAllByRole('button', { name: /Zkusit znovu/ })).length).toBeGreaterThan(0);
  });
});

describe('the frame while a screen loads', () => {
  it('keeps the title and holds the content\'s place with a skeleton', () => {
    render(at('/working-hours', <SettingsScreen title="Otevírací doba" subtitle="věta" loading>{null}</SettingsScreen>));
    expect(screen.getByRole('heading', { level: 1, name: 'Otevírací doba' })).toBeInTheDocument();
    expect(screen.getByLabelText('Načítám')).toHaveAttribute('aria-busy', 'true');
  });

  it('says what failed and calls onRetry', async () => {
    const onRetry = vi.fn();
    render(at('/working-hours', <SettingsScreen title="Otevírací doba" error="Nepodařilo se načíst." onRetry={onRetry}>{<div>obsah</div>}</SettingsScreen>));
    expect(screen.getByText('Nepodařilo se načíst.')).toBeInTheDocument();
    expect(screen.queryByText('obsah')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /Zkusit znovu/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
