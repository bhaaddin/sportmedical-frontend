/*
 * The signed-in employee's second factor: off, set up in two steps, on.
 *
 * What would have to break for these to fail: a setup that goes into force
 * before the code is confirmed, a QR code drawn from anything but the
 * server's otpauth URI, recovery codes not shown after confirming, or a
 * disable button that does not ask for a code.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const twoFactorStatus = vi.fn();
const beginTwoFactorSetup = vi.fn();
const confirmTwoFactor = vi.fn();
const disableTwoFactor = vi.fn();

vi.mock('../../api/auth', async () => {
  const actual = await vi.importActual<typeof import('../../api/auth')>('../../api/auth');
  return {
    ...actual,
    authApi: { twoFactorStatus, beginTwoFactorSetup, confirmTwoFactor, disableTwoFactor },
  };
});

const { TwoFactorCard } = await import('./TwoFactorCard');

beforeEach(() => {
  twoFactorStatus.mockReset().mockResolvedValue({ enabled: false, setupPending: false });
  beginTwoFactorSetup.mockReset().mockResolvedValue({
    secret: 'JBSWY3DPEHPK3PXP',
    otpauthUri: 'otpauth://totp/SportMedical:jana%40ordinace.cz?secret=JBSWY3DPEHPK3PXP&issuer=SportMedical&algorithm=SHA1&digits=6&period=30',
  });
  confirmTwoFactor.mockReset().mockResolvedValue(['ABCDE-FGHJK', 'LMNPQ-RSTUV']);
  disableTwoFactor.mockReset().mockResolvedValue(undefined);
});

describe('when the factor is off', () => {
  it('offers to switch it on, draws the QR code from the URI and asks for a code before enabling', async () => {
    const user = userEvent.setup();
    render(<TwoFactorCard />);

    expect(await screen.findByText('Vypnuto')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapnout dvoufázové ověření' }));

    expect(await screen.findByLabelText('QR kód pro ověřovací aplikaci')).toBeInTheDocument();
    expect(screen.getByTestId('two-factor-secret')).toHaveTextContent('JBSWY3DPEHPK3PXP');
    /* Nothing is confirmed yet. */
    expect(confirmTwoFactor).not.toHaveBeenCalled();

    const confirm = screen.getByRole('button', { name: 'Potvrdit a zapnout' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Kód z aplikace'), '123456');
    await user.click(confirm);

    await waitFor(() => expect(confirmTwoFactor).toHaveBeenCalledWith('123456'));
    expect(await screen.findByText('ABCDE-FGHJK')).toBeInTheDocument();
    expect(screen.getByText('LMNPQ-RSTUV')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mám je uložené' }));
    expect(await screen.findByText('Zapnuto')).toBeInTheDocument();
  });

  it('says in Czech when the code does not match', async () => {
    confirmTwoFactor.mockRejectedValue({ response: { status: 400, data: { code: 'two_factor.code_invalid' } } });
    const user = userEvent.setup();
    render(<TwoFactorCard />);

    await user.click(await screen.findByRole('button', { name: 'Zapnout dvoufázové ověření' }));
    await user.type(await screen.findByLabelText('Kód z aplikace'), '000000');
    await user.click(screen.getByRole('button', { name: 'Potvrdit a zapnout' }));

    expect(await screen.findByText(/Kód nesouhlasí/)).toBeInTheDocument();
    /* Still in the setup, the QR code still there to try again. */
    expect(screen.getByLabelText('QR kód pro ověřovací aplikaci')).toBeInTheDocument();
  });

  it('says a half-finished setup protects nothing', async () => {
    twoFactorStatus.mockResolvedValue({ enabled: false, setupPending: true });
    render(<TwoFactorCard />);

    expect(await screen.findByText(/Nastavení nebylo dokončeno/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Začít nastavení znovu' })).toBeInTheDocument();
  });
});

describe('when the factor is on', () => {
  beforeEach(() => twoFactorStatus.mockResolvedValue({ enabled: true, setupPending: false }));

  it('switches off only with a code', async () => {
    const user = userEvent.setup();
    render(<TwoFactorCard />);

    expect(await screen.findByText('Zapnuto')).toBeInTheDocument();
    const off = screen.getByRole('button', { name: 'Vypnout dvoufázové ověření' });
    expect(off).toBeDisabled();

    await user.type(screen.getByLabelText('Kód z aplikace'), '654321');
    await user.click(off);

    await waitFor(() => expect(disableTwoFactor).toHaveBeenCalledWith('654321'));
    expect(await screen.findByText('Vypnuto')).toBeInTheDocument();
  });
});
