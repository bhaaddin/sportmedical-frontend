import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setViewport, VIEWPORTS, type ViewportName } from '../../../test/viewport';

/*
 * The detail's card for a desk quick registration the patient has not finished:
 * the chip with the time left (beige, red under three hours), and the one
 * button that re-issues the link and copies it.
 */

const issueLink = vi.fn();
vi.mock('../../../api/patientPreRegistration', () => ({
  patientPreRegistrationApi: { issueLink },
}));

const { QuickPendingCard } = await import('./QuickPendingCard');

const HOUR = 3_600_000;
const inHours = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

function renderCard(deadlineUtc: string | null, email: string | undefined = 'filip@example.cz') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuickPendingCard patientId="p1" email={email} deadlineUtc={deadlineUtc} />
    </QueryClientProvider>,
  );
}

const RED_BG = 'rgb(245, 224, 216)';
const BEIGE_BG = 'rgb(251, 241, 231)';

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  issueLink.mockReset().mockResolvedValue({
    url: 'https://sportmedical.test/dokonceni/abc',
    path: '/dokonceni/abc',
    token: 'abc',
    referenceNumber: 'R1',
    expiresAtUtc: '2026-10-27T08:30:00Z',
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe('the pending-registration card', () => {
  it('shows the time left in a beige chip', () => {
    renderCard(inHours(20.5));
    const chip = screen.getByText('Čeká na dokončení registrace · zbývá 21 h');
    expect(chip).toHaveStyle({ backgroundColor: BEIGE_BG });
    expect(screen.getByText(/^Pacient má čas na dokončení registrace do \d+\. \d+\. \d{4} \d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('turns the chip red under three hours', () => {
    renderCard(inHours(2.5));
    const chip = screen.getByText('Čeká na dokončení registrace · zbývá 3 h');
    expect(chip).toHaveStyle({ backgroundColor: RED_BG });
  });

  it('counts minutes in the last hour', () => {
    renderCard(inHours(0.5));
    expect(screen.getByText('Čeká na dokončení registrace · zbývá 30 min')).toHaveStyle({ backgroundColor: RED_BG });
  });

  it('re-issues the link and copies it with "Zkopírovat odkaz"', async () => {
    renderCard(inHours(10));
    await userEvent.click(screen.getByRole('button', { name: 'Zkopírovat odkaz' }));

    await waitFor(() => expect(issueLink).toHaveBeenCalledWith('p1'));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://sportmedical.test/dokonceni/abc'),
    );
    expect(await screen.findByRole('button', { name: 'Zkopírováno' })).toBeInTheDocument();
    /* The link is shown, with the server's own expiry - not "24 hodin". */
    expect(screen.getByText('https://sportmedical.test/dokonceni/abc')).toBeInTheDocument();
    expect(screen.getByText(/Platí do 27\. 10\. 2026 09:30\./)).toBeInTheDocument();
    expect(screen.queryByText(/24 hodin/)).not.toBeInTheDocument();
    expect(screen.getByText(/Nic se neodesílá/)).toBeInTheDocument();
  });

  it('falls back to the path when the server knows no public address', async () => {
    issueLink.mockResolvedValue({ url: null, path: '/dokonceni/zzz', token: 'zzz', referenceNumber: 'R', expiresAtUtc: null });
    renderCard(inHours(10));
    await userEvent.click(screen.getByRole('button', { name: 'Zkopírovat odkaz' }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/dokonceni/zzz`),
    );
  });

  it('says plainly when the link could not be issued', async () => {
    issueLink.mockRejectedValue(new Error('500'));
    renderCard(inHours(10));
    await userEvent.click(screen.getByRole('button', { name: 'Zkopírovat odkaz' }));
    expect(await screen.findByText('Odkaz se nepodařilo vygenerovat. Zkuste to prosím znovu.')).toBeInTheDocument();
  });

  it('stops offering the link once the time is up - the server is about to release the slot', () => {
    renderCard(new Date(Date.now() - 1000).toISOString());
    expect(screen.getByText('Čeká na dokončení registrace · lhůta vypršela')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkopírovat odkaz' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Poslat znovu' })).toBeDisabled();
  });

  it('still shows the chip and the copy button when the server sent no deadline', () => {
    renderCard(null);
    expect(screen.getByText('Čeká na dokončení registrace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkopírovat odkaz' })).toBeEnabled();
  });

  it('cannot "send again" a patient who has no e-mail', () => {
    renderCard(inHours(10), '');
    expect(screen.getByRole('button', { name: 'Poslat znovu' })).toBeDisabled();
  });

  it.each(['phone', 'tablet', 'desktop'] as ViewportName[])('renders at %s width', (name) => {
    setViewport(VIEWPORTS[name]);
    renderCard(inHours(20.5));
    expect(screen.getByTestId('quick-pending-card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkopírovat odkaz' })).toBeInTheDocument();
  });
});
