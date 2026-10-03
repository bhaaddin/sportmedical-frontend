/*
 * Signing in to the patient portal: each refusal the server can give turns
 * into one sentence the patient reads, and a success stores the token for the
 * tab and lands on /portal/{token}.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VIEWPORTS, setViewport } from '../../test/viewport';

const portalLogin = vi.fn();

vi.mock('../../api/patientPortal', async () => {
  const actual = await vi.importActual<typeof import('../../api/patientPortal')>('../../api/patientPortal');
  return { ...actual, portalLogin };
});

vi.mock('../../api/clinicSettings', async () => {
  const actual = await vi.importActual<typeof import('../../api/clinicSettings')>('../../api/clinicSettings');
  return {
    ...actual,
    readPublicClinic: vi.fn().mockResolvedValue({ name: 'Ordinace', email: '', phone: '', address: '', bookingEnabled: true }),
  };
});

const { default: PatientSignIn } = await import('./PatientSignIn');
const { PortalAuthError, portalSignInMessage, PORTAL_TOKEN_KEY } = await import('../../api/patientPortal');

const renderSignIn = () =>
  render(
    <MemoryRouter initialEntries={['/portal/prihlaseni']}>
      <Routes>
        <Route path="/portal/prihlaseni" element={<PatientSignIn />} />
        <Route path="/portal/:token" element={<div>PORTAL OPENED</div>} />
      </Routes>
    </MemoryRouter>,
  );

const fillAndSubmit = async () => {
  await userEvent.type(screen.getByLabelText('E-mail'), 'jan@example.cz');
  await userEvent.type(screen.getByLabelText('Heslo'), 'tajne-heslo');
  await userEvent.click(screen.getByRole('button', { name: 'Přihlásit se' }));
};

beforeEach(() => {
  portalLogin.mockReset();
  window.sessionStorage.clear();
});

describe('portalSignInMessage', () => {
  it('maps every status the server can answer with to the sentence the patient reads', () => {
    expect(portalSignInMessage(401, 'Wrong password')).toBe('Neplatné přihlašovací údaje.');
    expect(portalSignInMessage(423, 'Účet je uzamčen do 10:15.')).toBe('Účet je uzamčen do 10:15.');
    expect(portalSignInMessage(409, 'Heslo zatím není nastavené.')).toBe('Heslo zatím není nastavené.');
    expect(portalSignInMessage(429, undefined)).toMatch(/^Příliš mnoho pokusů/);
    expect(portalSignInMessage(0, undefined)).toMatch(/spojit se serverem/);
  });

  it('falls back to a neutral sentence when a 423 or 409 arrives without one', () => {
    expect(portalSignInMessage(423, undefined)).toMatch(/uzamčen/);
    expect(portalSignInMessage(409, '')).toMatch(/heslo/i);
  });
});

describe('PatientSignIn', () => {
  it('shows the neutral sentence on 401 and never says which field was wrong', async () => {
    portalLogin.mockRejectedValue(new PortalAuthError('Bad password for jan@example.cz', 401));
    renderSignIn();
    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Neplatné přihlašovací údaje.');
    expect(screen.queryByText(/Bad password/)).not.toBeInTheDocument();
  });

  it("shows the server's own sentence on 423", async () => {
    portalLogin.mockRejectedValue(new PortalAuthError('Účet je dočasně uzamčen do 14:30.', 423));
    renderSignIn();
    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Účet je dočasně uzamčen do 14:30.');
  });

  it('tells the patient to slow down on 429', async () => {
    portalLogin.mockRejectedValue(new PortalAuthError('', 429));
    renderSignIn();
    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Příliš mnoho pokusů/);
  });

  it('stores the token for this tab and opens the portal on success', async () => {
    portalLogin.mockResolvedValue('tok-xyz');
    renderSignIn();
    await fillAndSubmit();

    expect(await screen.findByText('PORTAL OPENED')).toBeInTheDocument();
    await waitFor(() => expect(window.sessionStorage.getItem(PORTAL_TOKEN_KEY)).toBe('tok-xyz'));
    expect(portalLogin).toHaveBeenCalledWith('jan@example.cz', 'tajne-heslo');
  });

  it('asks for both fields before calling the server', async () => {
    renderSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Přihlásit se' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Vyplňte prosím e-mail i heslo.');
    expect(portalLogin).not.toHaveBeenCalled();
  });

  it('goes straight to the portal when this tab already signed in', async () => {
    window.sessionStorage.setItem(PORTAL_TOKEN_KEY, 'tok-kept');
    renderSignIn();

    expect(await screen.findByText('PORTAL OPENED')).toBeInTheDocument();
  });

  it('tells a patient who forgot the password to ask the clinic', () => {
    renderSignIn();

    expect(screen.getByText(/Zapomněli jste heslo\? Ozvěte se ordinaci — heslo vám smaže a pošle nový odkaz\./))
      .toBeInTheDocument();
  });
});

describe('three layouts', () => {
  it('phone: one field per row and "Přihlásit se" pinned at the bottom', () => {
    setViewport(VIEWPORTS.phone);
    renderSignIn();

    const bar = document.querySelector('[data-pinned="true"]') as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(bar?.querySelector('button[type="submit"]')?.textContent).toBe('Přihlásit se');
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Heslo')).toBeInTheDocument();
  });

  it.each([['iPad', VIEWPORTS.tablet], ['desktop', VIEWPORTS.desktop]])('%s: the button is inline, nothing is pinned', (_n, width) => {
    setViewport(width);
    renderSignIn();

    expect(document.querySelector('[data-pinned="true"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Přihlásit se' })).toBeInTheDocument();
  });
});
