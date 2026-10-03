/*
 * The desk deletes a patient's portal password: after a confirmation it posts
 * the reset, and says in words whether it worked or the patient has no
 * portal account.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const post = vi.fn();
vi.mock('../../api/client', () => ({ default: { post }, client: { post } }));
const success = vi.fn();
const error = vi.fn();
vi.mock('react-hot-toast', () => ({ default: { success, error } }));

const { default: PortalPasswordReset, PORTAL_RESET_DONE, PORTAL_RESET_NO_ACCOUNT } = await import('./PortalPasswordReset');

beforeEach(() => {
  post.mockReset().mockResolvedValue({ status: 204 });
  success.mockReset();
  error.mockReset();
});

const open = async () => {
  const user = userEvent.setup();
  render(<PortalPasswordReset patientId="p1" />);
  await user.click(screen.getByRole('button', { name: 'Resetovat heslo do portálu' }));
  return user;
};

describe('PortalPasswordReset', () => {
  it('asks first, and posts nothing until it is confirmed', async () => {
    const user = await open();
    expect(post).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Zrušit' }));
    expect(post).not.toHaveBeenCalled();
  });

  it('posts the reset and tells the desk to send a new link', async () => {
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Smazat heslo' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/v1/patients/p1/portal-password/reset'));
    await waitFor(() => expect(success).toHaveBeenCalledWith(PORTAL_RESET_DONE));
  });

  it('says the patient has no portal account on a 404', async () => {
    post.mockRejectedValue({ response: { status: 404, data: { message: 'x' } } });
    const user = await open();
    await user.click(screen.getByRole('button', { name: 'Smazat heslo' }));

    await waitFor(() => expect(error).toHaveBeenCalledWith(PORTAL_RESET_NO_ACCOUNT));
    expect(success).not.toHaveBeenCalled();
  });
});
