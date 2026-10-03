/*
 * The staff portal is behind the sign-in. Without a session every staff address — the overview at
 * /prehled included — ends at /login; once signed in, the person returns to where they were going
 * (?next=) and by default lands on /prehled. A foreign `next` is never followed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterLoginPath, loginUrl, safeNextPath } from './components/shell/loginRedirect';

vi.mock('./api/auth', () => ({
  authApi: { login: vi.fn(), activate: vi.fn(), completeSecondFactor: vi.fn() },
  isSecondFactorChallenge: () => false,
}));
vi.mock('./auth/accountRefresh', () => ({ useAccountRefresh: () => undefined }));
vi.mock('./components/UniversalSearch', () => ({ default: () => null, openUniversalSearch: () => undefined, OPEN_SEARCH_EVENT: 'x' }));
vi.mock('./components/NetworkBanner', () => ({ default: () => null }));

const { default: App } = await import('./App');
const { authApi } = await import('./api/auth');
const { default: Login } = await import('./pages/Login');

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); window.history.pushState({}, '', '/'); });

function at(path: string) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('the staff portal requires a session', () => {
  it('/prehled without a session goes to the sign-in', async () => {
    at('/prehled');
    expect(await screen.findByRole('button', { name: /Přihlásit se/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('another staff address goes to the sign-in carrying where the person wanted to go', async () => {
    at('/patients?q=novak');
    expect(await screen.findByRole('button', { name: /Přihlásit se/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(new URLSearchParams(window.location.search).get('next')).toBe('/patients?q=novak');
  });

  it('the staff price list lives at /nastaveni/cenik and is behind the sign-in too', async () => {
    at('/nastaveni/cenik');
    expect(await screen.findByRole('button', { name: /Přihlásit se/ })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('next')).toBe('/nastaveni/cenik');
  });

  it('the sign-in page is open to everybody and links back to the public site', async () => {
    at('/login');
    const back = await screen.findByRole('link', { name: /Zpět na web/ });
    expect(back).toHaveAttribute('href', '/');
  });

  it('the patient app pages stay anonymous (no redirect to the sign-in)', async () => {
    at('/objednat');
    await waitFor(() => expect(window.location.pathname).toBe('/objednat'));
  });
});

describe('after the sign-in', () => {
  function Where() {
    const location = useLocation();
    return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
  }

  async function signIn(entry: string) {
    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: 't', account: { userId: '1', email: 'a@b.cz', displayName: 'Jana Nováková', role: 'Recepce', mustChangePassword: false }, permissions: [],
    } as never);
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByLabelText(/E-mail/), 'a@b.cz');
    await userEvent.type(screen.getByLabelText(/Heslo/), 'x');
    await userEvent.click(screen.getByRole('button', { name: /Přihlásit se/ }));
    return screen.findByTestId('where');
  }

  it('returns to the screen the person asked for', async () => {
    expect((await signIn('/login?next=%2Fpatients%3Fq%3D1')).textContent).toBe('/patients?q=1');
  });

  it('lands on /prehled by default', async () => {
    expect((await signIn('/login')).textContent).toBe('/prehled');
  });

  it('never follows a foreign address', async () => {
    expect((await signIn('/login?next=https%3A%2F%2Fevil.example')).textContent).toBe('/prehled');
    cleanup();
    expect((await signIn('/login?next=%2F%2Fevil.example')).textContent).toBe('/prehled');
  });
});

describe('loginRedirect (pure)', () => {
  it('builds the sign-in address with the way back', () => {
    expect(loginUrl('/patients?q=1')).toBe('/login?next=%2Fpatients%3Fq%3D1');
    expect(loginUrl('/prehled')).toBe('/login');
    expect(loginUrl('/login')).toBe('/login');
    expect(loginUrl(undefined)).toBe('/login');
  });

  it.each([
    ['/patients', '/patients'],
    ['/patients/1?x=2#y', '/patients/1?x=2#y'],
    ['https://evil.example', null],
    ['//evil.example', null],
    ['/\\evil.example', null],
    ['javascript:alert(1)', null],
    ['/login', null],
    ['/login?next=/x', null],
    ['', null],
    [null, null],
  ])('safeNextPath(%j) = %j', (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it('afterLoginPath defaults to the staff overview', () => {
    expect(afterLoginPath('')).toBe('/prehled');
    expect(afterLoginPath('?next=%2Fclubs')).toBe('/clubs');
    expect(afterLoginPath('?next=%2F%2Fevil')).toBe('/prehled');
  });
});
