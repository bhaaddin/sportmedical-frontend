/*
 * The link shown once. The desk has to be able to copy it and has to be told,
 * in plain words, whether an e-mail is going out or whether it is on them to
 * hand the link over.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegistrationLinkBox } from './RegistrationLinkBox';
import type { IssuedRegistrationLink } from '../../api/preRegistration';

const link = (overrides: Partial<IssuedRegistrationLink> = {}): IssuedRegistrationLink => ({
  intakeId: 'i1',
  referenceNumber: 'ZD-2026-000001',
  token: 'abc',
  path: '/dokonceni/abc',
  url: null,
  expiresAtUtc: '2026-09-26T08:00:00Z',
  emailQueued: true,
  emailWillSend: true,
  sentTo: 'jan@example.cz',
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe('the generated link box', () => {
  it('shows the full address, never a bare path, and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<RegistrationLinkBox link={link()} />);

    const field = screen.getByLabelText('Odkaz pro pacienta') as HTMLInputElement;
    expect(field.value).toBe(`${window.location.origin}/dokonceni/abc`);
    expect(field).toHaveAttribute('readonly');

    await userEvent.click(screen.getByRole('button', { name: 'Zkopírovat' }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/dokonceni/abc`);
    expect(screen.getByRole('button', { name: 'Zkopírováno' })).toBeInTheDocument();
  });

  it('prefers the public site address when the server knows one', () => {
    render(<RegistrationLinkBox link={link({ url: 'https://klinika.cz/dokonceni/abc' })} />);
    expect((screen.getByLabelText('Odkaz pro pacienta') as HTMLInputElement).value)
      .toBe('https://klinika.cz/dokonceni/abc');
  });

  it('says the e-mail is going out when a sender is configured', () => {
    render(<RegistrationLinkBox link={link()} />);
    expect(screen.getByText(/E-mail s odkazem odešleme na jan@example.cz/)).toBeInTheDocument();
  });

  it('tells the desk to send the link itself when e-mail is queued but cannot leave', () => {
    render(<RegistrationLinkBox link={link({ emailWillSend: false })} />);
    expect(screen.getByText(/odesílání e-mailů není nastaveno — pošlete odkaz pacientovi sami/)).toBeInTheDocument();
  });

  it('says until when the link is valid', () => {
    render(<RegistrationLinkBox link={link()} />);
    expect(screen.getByText(/Platí do 26\. 9\. 2026/)).toBeInTheDocument();
  });
});
