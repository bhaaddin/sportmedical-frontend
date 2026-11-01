/*
 * The Administrace's protection (Bezpečnostní pravidla): the gate in front of the area, the confirmation window, the screen
 * with the three switches, and "Kde jsem přihlášený/á". Every switch is OFF by default and nothing changes until the owner
 * turns one on; a server without the routes shows none of it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS } from '../../../test/viewport';
import { resetAdminChallengeForTests, setTwoFactorRequired } from '../../../auth/adminChallenge';

const get = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
vi.mock('../../../api/client', () => ({ default: { get, put, post }, client: { get, put, post } }));
const twoFactorStatus = vi.hoisted(() => vi.fn());
vi.mock('../../../api/twoFactor', () => ({ twoFactorApi: { status: twoFactorStatus } }));

import AdminGate from './AdminGate';
import ReconfirmHost from './ReconfirmHost';
import MySessions from './MySessions';
import SecurityPolicyPage from '../SecurityPolicyPage';
import { DEFAULT_SECURITY_POLICY } from '../../../api/securityPolicy';

const POLICY = '/api/v1/settings/security-policy';
const RECONFIRM = '/api/v1/session/reconfirm';
const FUTURE = '2999-01-01T00:00:00Z';
const PAST = '2000-01-01T00:00:00Z';

/** Answers the routes a test names; every other route is a 404 (a server that lacks it). */
function server(routes: Record<string, unknown>) {
  get.mockImplementation(async (url: string) => {
    if (url in routes) {
      const value = routes[url];
      if (value instanceof Error) throw value;
      return { data: value };
    }
    throw { response: { status: 404 } };
  });
}

const renderIn = (ui: React.ReactElement, path = '/administrace') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const gated = (
  <>
    <ReconfirmHost />
    <AdminGate><div>obsah administrace</div></AdminGate>
  </>
);

beforeEach(() => {
  get.mockReset(); put.mockReset(); post.mockReset(); twoFactorStatus.mockReset();
  twoFactorStatus.mockResolvedValue({ enabled: false, setupPending: false });
  resetAdminChallengeForTests();
  localStorage.clear();
  localStorage.setItem('permissions', JSON.stringify(['settings.clinic.manage', 'users.manage']));
  setViewport(VIEWPORTS.desktop);
});

describe('AdminGate with every switch off (the default)', () => {
  it('passes the Administrace through untouched', async () => {
    server({ [POLICY]: DEFAULT_SECURITY_POLICY });
    renderIn(gated);
    expect(await screen.findByText('obsah administrace')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith(RECONFIRM);
  });

  it('passes it through on a server that does not have the policy yet', async () => {
    server({});
    renderIn(gated);
    expect(await screen.findByText('obsah administrace')).toBeInTheDocument();
    await waitFor(() => expect(get).toHaveBeenCalledWith(POLICY));
    expect(screen.queryByText('Potvrďte, že jste to vy')).toBeNull();
  });

  it('asks nothing of somebody who may not see the Administrace', async () => {
    localStorage.setItem('permissions', JSON.stringify(['patients.view']));
    server({ [POLICY]: { ...DEFAULT_SECURITY_POLICY, reconfirmForAdmin: true } });
    renderIn(gated);
    expect(await screen.findByText('obsah administrace')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});

describe('reconfirm up front (reconfirmForAdmin)', () => {
  const policy = { ...DEFAULT_SECURITY_POLICY, reconfirmForAdmin: true };

  it('asks to reconfirm when the last confirmation is past, hides the area, and opens it after the password', async () => {
    const user = userEvent.setup();
    server({ [POLICY]: policy, [RECONFIRM]: { confirmedAt: PAST, validUntil: PAST } });
    post.mockResolvedValue({ data: { confirmedAt: 'now', validUntil: FUTURE } });
    renderIn(gated);

    expect(await screen.findByRole('heading', { name: 'Potvrďte, že jste to vy' })).toBeInTheDocument();
    expect(screen.queryByText('obsah administrace')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Potvrdit' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Heslo'), 'tajne-heslo');
    expect(within(dialog).queryByLabelText('Kód z aplikace')).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Potvrdit' }));

    expect(await screen.findByText('obsah administrace')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(RECONFIRM, { password: 'tajne-heslo', code: null });
  });

  it('asks for the code too when the account has two-factor', async () => {
    const user = userEvent.setup();
    twoFactorStatus.mockResolvedValue({ enabled: true, setupPending: false });
    server({ [POLICY]: policy, [RECONFIRM]: { confirmedAt: null, validUntil: null } });
    post.mockResolvedValue({ data: { confirmedAt: 'now', validUntil: FUTURE } });
    renderIn(gated);

    await user.click(await screen.findByRole('button', { name: 'Potvrdit' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Heslo'), 'h');
    await user.type(await within(dialog).findByLabelText('Kód z aplikace'), '123456');
    await user.click(within(dialog).getByRole('button', { name: 'Potvrdit' }));

    expect(await screen.findByText('obsah administrace')).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(RECONFIRM, { password: 'h', code: '123456' });
  });

  it('says so and keeps the area closed when the password is wrong', async () => {
    const user = userEvent.setup();
    server({ [POLICY]: policy, [RECONFIRM]: { confirmedAt: null, validUntil: null } });
    post.mockRejectedValue({ response: { status: 401, data: {} } });
    renderIn(gated);

    await user.click(await screen.findByRole('button', { name: 'Potvrdit' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Heslo'), 'spatne');
    await user.click(within(dialog).getByRole('button', { name: 'Potvrdit' }));

    expect(await within(dialog).findByText(/Heslo nebo kód nesedí/)).toBeInTheDocument();
    expect(screen.queryByText('obsah administrace')).toBeNull();
  });

  it('lets the person cancel the window and stay outside', async () => {
    const user = userEvent.setup();
    server({ [POLICY]: policy, [RECONFIRM]: { confirmedAt: null, validUntil: null } });
    renderIn(gated);

    await user.click(await screen.findByRole('button', { name: 'Potvrdit' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Zrušit' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText('obsah administrace')).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it('lets the person straight in while the confirmation still holds', async () => {
    server({ [POLICY]: policy, [RECONFIRM]: { confirmedAt: 'x', validUntil: FUTURE } });
    renderIn(gated);
    expect(await screen.findByText('obsah administrace')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Potvrďte, že jste to vy' })).toBeNull();
  });
});

describe('two_factor_required', () => {
  it('shows ONLY the notice with a button to the setup while the account has no second factor', async () => {
    server({ [POLICY]: DEFAULT_SECURITY_POLICY });
    renderIn(gated);
    expect(await screen.findByText('obsah administrace')).toBeInTheDocument();

    act(() => setTwoFactorRequired(true));

    expect(await screen.findByRole('heading', { name: 'Pro administraci zapněte dvoufázové ověření' })).toBeInTheDocument();
    expect(screen.queryByText('obsah administrace')).toBeNull();
    expect(screen.getByRole('link', { name: 'Zapnout dvoufázové ověření' })).toHaveAttribute('href', '/nastaveni/zabezpeceni');
    await waitFor(() => expect(twoFactorStatus).toHaveBeenCalled());
    expect(screen.getByRole('heading', { name: 'Pro administraci zapněte dvoufázové ověření' })).toBeInTheDocument();
  });

  it('goes away by itself once the account turns out to have two-factor', async () => {
    twoFactorStatus.mockResolvedValue({ enabled: true, setupPending: false });
    server({ [POLICY]: DEFAULT_SECURITY_POLICY });
    renderIn(gated);
    await screen.findByText('obsah administrace');

    act(() => setTwoFactorRequired(true));

    expect(await screen.findByText('obsah administrace')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Pro administraci zapněte dvoufázové ověření' })).toBeNull());
  });
});

describe('idle lock (adminIdleLock)', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => vi.useRealTimers());

  const policy = { ...DEFAULT_SECURITY_POLICY, adminIdleLock: true, adminIdleLockMinutes: 1 };

  it('locks the area after the idle minutes, keeps the screens mounted underneath, and unlocks with the password', async () => {
    server({ [POLICY]: policy });
    post.mockResolvedValue({ data: { confirmedAt: 'now', validUntil: FUTURE } });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderIn(gated);
    expect(await screen.findByText('obsah administrace')).toBeVisible();

    await act(async () => { vi.advanceTimersByTime(61_000); });

    expect(await screen.findByRole('heading', { name: 'Administrace je zamčená' })).toBeInTheDocument();
    expect(screen.getByText('obsah administrace')).not.toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Odemknout' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Heslo'), 'x');
    await user.click(within(dialog).getByRole('button', { name: 'Potvrdit' }));

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Administrace je zamčená' })).toBeNull());
    expect(screen.getByText('obsah administrace')).toBeVisible();
  });

  it('is restarted by activity', async () => {
    server({ [POLICY]: policy });
    renderIn(gated);
    await screen.findByText('obsah administrace');

    await act(async () => { vi.advanceTimersByTime(40_000); });
    act(() => { window.dispatchEvent(new Event('pointerdown')); });
    await act(async () => { vi.advanceTimersByTime(40_000); });

    expect(screen.queryByRole('heading', { name: 'Administrace je zamčená' })).toBeNull();
    await act(async () => { vi.advanceTimersByTime(25_000); });
    expect(await screen.findByRole('heading', { name: 'Administrace je zamčená' })).toBeInTheDocument();
  });

  it('does nothing when the switch is off', async () => {
    server({ [POLICY]: DEFAULT_SECURITY_POLICY });
    renderIn(gated);
    await screen.findByText('obsah administrace');
    await act(async () => { vi.advanceTimersByTime(3_600_000); });
    expect(screen.queryByRole('heading', { name: 'Administrace je zamčená' })).toBeNull();
  });
});

describe('the Bezpečnostní pravidla screen', () => {
  const open = (path = '/nastaveni/bezpecnostni-pravidla') => renderIn(<SecurityPolicyPage />, path);

  it('shows the three rules as plain switches, all OFF by default, each with one line', async () => {
    server({ [POLICY]: DEFAULT_SECURITY_POLICY });
    open();

    const reconfirm = await screen.findByRole('switch', { name: /Při vstupu do Administrace znovu zadat heslo/ });
    const twoFactor = screen.getByRole('switch', { name: /Administrátoři musí mít dvoufázové ověření/ });
    const idle = screen.getByRole('switch', { name: /Po nečinnosti Administraci zamknout/ });
    for (const sw of [reconfirm, twoFactor, idle]) expect(sw).not.toBeChecked();
    expect(screen.getByText(/Kdo nemá k heslu i kód z ověřovací aplikace/)).toBeInTheDocument();
    /* The minutes appear only for a rule that is on. */
    expect(screen.queryByLabelText('Potvrzení platí')).toBeNull();
    expect(screen.queryByLabelText('Zamknout po')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Bezpečnostní pravidla' })).toBeInTheDocument();
  });

  it('saves a switch with its minutes through PUT', async () => {
    const user = userEvent.setup();
    server({ [POLICY]: DEFAULT_SECURITY_POLICY });
    put.mockImplementation(async (_url: string, body: unknown) => ({ data: body }));
    open();

    await user.click(await screen.findByRole('switch', { name: /Po nečinnosti Administraci zamknout/ }));
    const minutes = screen.getByLabelText('Zamknout po');
    expect(minutes).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Uložit/ }));

    await waitFor(() => expect(put).toHaveBeenCalledWith(POLICY, { ...DEFAULT_SECURITY_POLICY, adminIdleLock: true }));
    expect(await screen.findByText('Uloženo.')).toBeInTheDocument();
  });

  it('warns the owner who has no two-factor before the rule would lock themselves out', async () => {
    const user = userEvent.setup();
    server({ [POLICY]: DEFAULT_SECURITY_POLICY });
    open();
    await user.click(await screen.findByRole('switch', { name: /Administrátoři musí mít dvoufázové ověření/ }));
    expect(await screen.findByText(/dvoufázové ověření zatím nemáte/)).toBeInTheDocument();
  });

  it('is not there on a server without the route: it goes back to the Administrace', async () => {
    server({});
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/nastaveni/bezpecnostni-pravidla']}>
          <Routes>
            <Route path="/nastaveni/bezpecnostni-pravidla" element={<SecurityPolicyPage />} />
            <Route path="/administrace" element={<div>stránka Administrace</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('stránka Administrace')).toBeInTheDocument();
  });
});

describe('Kde jsem přihlášený/á', () => {
  const sessions = [
    { id: 's1', createdAt: '2026-11-01T08:00:00Z', lastSeenAt: '2026-11-01T09:30:00Z', device: 'Chrome · Windows', current: true },
    { id: 's2', createdAt: '2026-10-30T08:00:00Z', lastSeenAt: null, device: null, current: false },
    { id: 's3', createdAt: '2026-10-29T08:00:00Z', lastSeenAt: '2026-10-31T08:00:00Z', device: 'Safari · iPhone', current: false },
  ];
  const route = '/api/v1/account/sessions';

  it('lists the sessions, marks this one, and offers "Odhlásit" on the others only', async () => {
    server({ [route]: sessions });
    renderIn(<MySessions />, '/nastaveni/zabezpeceni');

    const list = await screen.findByRole('list', { name: 'Přihlášená zařízení' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByText('Toto zařízení')).toBeInTheDocument();
    expect(within(list).getByText('Neznámé zařízení')).toBeInTheDocument();
    expect(within(list).getAllByRole('button', { name: /^Odhlásit/ })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Odhlásit všude jinde' })).toBeInTheDocument();
  });

  it('signs one out, and signs out all the others, then reloads the list', async () => {
    const user = userEvent.setup();
    server({ [route]: sessions });
    post.mockResolvedValue({});
    renderIn(<MySessions />, '/nastaveni/zabezpeceni');

    await user.click(await screen.findByRole('button', { name: 'Odhlásit: Safari · iPhone' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/account/sessions/s3/revoke'));

    await user.click(screen.getByRole('button', { name: 'Odhlásit všude jinde' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/account/sessions/revoke-others'));
    await waitFor(() => expect(get.mock.calls.filter((c) => c[0] === route).length).toBeGreaterThan(1));
  });

  it('says there is nowhere else when this is the only one', async () => {
    server({ [route]: [sessions[0]] });
    renderIn(<MySessions />, '/nastaveni/zabezpeceni');
    expect(await screen.findByText('Jinde nejste přihlášený/á.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Odhlásit všude jinde' })).toBeNull();
  });

  it('draws nothing at all on a server without the routes', async () => {
    server({});
    const { container } = renderIn(<MySessions />, '/nastaveni/zabezpeceni');
    await waitFor(() => expect(get).toHaveBeenCalledWith(route));
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});
