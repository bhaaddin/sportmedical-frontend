import { AxiosError } from 'axios';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* The first sign-in after the server slept: it says it is waking up and signs in by itself - no second press. */
const login = vi.fn();
vi.mock('../api/auth', () => ({
  authApi: { login: (...a: unknown[]) => login(...a), activate: vi.fn(), completeSecondFactor: vi.fn() },
  isSecondFactorChallenge: () => false,
}));
vi.mock('../auth/wakeUpRetry', async (importOriginal) => {
  const real = await importOriginal<typeof import('../auth/wakeUpRetry')>();
  return {
    ...real,
    withWakeUp: <T,>(attempt: () => Promise<T>, onWaiting: (w: boolean) => void) =>
      real.withWakeUp(attempt, onWaiting, { pauseMs: 5, maxWaitMs: 5_000 }),
  };
});

const { default: Login, WAKING_MESSAGE } = await import('./Login');

afterEach(() => { cleanup(); login.mockReset(); });

const noAnswer = () => new AxiosError('timeout', 'ECONNABORTED');
const session = { accessToken: 't', expiresAtUtc: 'x', permissions: [], account: { id: '1', email: 'a@b.cz', displayName: 'A', mustChangePassword: false }, preferences: {} };

describe('the sign-in with a sleeping server', () => {
  it('shows that the server is waking, keeps trying and signs in once it answers', async () => {
    login.mockRejectedValueOnce(noAnswer()).mockRejectedValueOnce(noAnswer()).mockResolvedValueOnce(session);
    render(<MemoryRouter><Login /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'a@b.cz');
    await userEvent.type(screen.getByLabelText(/^heslo/i), 'Some-Long-Password-1!');
    await userEvent.click(screen.getByRole('button', { name: /přihlásit se/i }));
    await waitFor(() => expect(login).toHaveBeenCalledTimes(3));
    expect(screen.queryByText(/Server neodpovídá/)).toBeNull();
    expect(WAKING_MESSAGE).toMatch(/probouzí/);
  });

  it('a wrong password is still an error at once, not a wait', async () => {
    login.mockRejectedValueOnce(new AxiosError('bad', 'ERR_BAD_REQUEST', undefined, undefined, { status: 400, data: { message: 'Neplatné přihlašovací údaje' } } as never));
    render(<MemoryRouter><Login /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'a@b.cz');
    await userEvent.type(screen.getByLabelText(/^heslo/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /přihlásit se/i }));
    expect(await screen.findByText('Neplatné přihlašovací údaje')).toBeTruthy();
    expect(login).toHaveBeenCalledTimes(1);
  });
});
