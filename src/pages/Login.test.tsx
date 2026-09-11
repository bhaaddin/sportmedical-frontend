/*
 * The login screen must not offer a way out that isn't there.
 *
 * It carried two `href="#"` links - "Zapomenuté heslo?" and "Požádat o
 * přístup". Both looked like features and did nothing at all when clicked.
 *
 * The person who has forgotten their password is the only person who ever
 * clicks the first one, so the silence lands on precisely the one who cannot
 * afford it. That happened to the owner of this system on 11. 9. 2026, which
 * is how it was found - not by a typecheck, a lint or a build, all of which
 * are perfectly happy with a link to nowhere.
 *
 * Neither has a destination to be given: the API has two password routes and
 * both require a session, and an account is only ever created by an
 * administrator through `POST /api/v1/users`.
 *
 * What would have to break for these to fail: putting a dead link back on this
 * screen, or replacing the honest sentences with a promise again.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../api/auth', () => ({
  authApi: { login: vi.fn(), activate: vi.fn() },
}));

const { default: Login } = await import('./Login');

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );

describe('the login screen', () => {
  it('has no link that goes nowhere', () => {
    const { container } = renderLogin();
    expect(container.querySelectorAll('a[href="#"]')).toHaveLength(0);
  });

  it('says who resets a password, instead of offering a reset it cannot do', () => {
    renderLogin();
    expect(
      screen.getByText(/Zapomenuté heslo\? Nové vám nastaví správce/),
    ).toBeInTheDocument();
  });

  it('says who creates an account, instead of inviting a request nobody receives', () => {
    renderLogin();
    expect(screen.getByText(/Přístup zakládá správce/)).toBeInTheDocument();
  });

  /* The screen still has to do its actual job. */
  it('still asks for an e-mail and a password, and offers to submit them', () => {
    renderLogin();
    expect(screen.getByLabelText(/E-mail/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Heslo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Přihlásit se/ })).toBeInTheDocument();
  });
});
