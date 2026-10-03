import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setViewport, VIEWPORTS, type ViewportName } from '../../../test/viewport';
import { QuickBookedPanel, type QuickBookedView } from './QuickBookedPanel';

/*
 * "Rezervace vytvořena": the panel the desk sees after a quick registration -
 * the deadline in the server's words, the link to copy, what is prefilled, and
 * the plain admission that nothing is sent.
 */

const view: QuickBookedView = {
  startUtc: '2026-10-26T08:30:00Z',
  endUtc: '2026-10-26T09:30:00Z',
  activityName: 'Komplexní prohlídka',
  calendarName: 'Sportovní prohlídka',
  deadlineUtc: '2026-10-27T08:30:00Z',
  linkUrl: 'https://sportmedical.test/dokonceni/tok123',
  prefilled: {
    name: 'Filip Fehér',
    phone: '+420773539001',
    email: 'filip@example.cz',
    activity: 'Komplexní prohlídka — 2 200 Kč · 60 min',
  },
};

beforeEach(() => {
  setViewport(VIEWPORTS.desktop);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

describe('the success panel of a quick registration', () => {
  it.each(['phone', 'tablet', 'desktop'] as ViewportName[])('shows everything at %s width', (name) => {
    setViewport(VIEWPORTS[name]);
    render(<QuickBookedPanel view={view} />);

    expect(screen.getByText(/Pondělí 26\. října 2026 · 09:30 — 10:30/)).toBeInTheDocument();
    expect(screen.getByText('Komplexní prohlídka · Sportovní prohlídka')).toBeInTheDocument();
    /* 2026-10-27T08:30Z is 09:30 in Prague (CET). */
    expect(screen.getByText('Pacient má čas na dokončení registrace do 27. 10. 2026 09:30')).toBeInTheDocument();
    expect(screen.getByTestId('quick-completion-link')).toHaveTextContent('https://sportmedical.test/dokonceni/tok123');
    expect(screen.getByRole('button', { name: 'Kopírovat' })).toBeInTheDocument();
    expect(screen.getByText('Odkaz zatím odešlete sami — odesílání zpráv se připravuje.')).toBeInTheDocument();
  });

  it('lists what the patient will find prefilled, and nothing the desk did not type', () => {
    render(<QuickBookedPanel view={view} />);
    const box = screen.getByText('Pacient už má vyplněno').parentElement as HTMLElement;
    expect(within(box).getByText('Filip Fehér')).toBeInTheDocument();
    expect(within(box).getByText('+420773539001')).toBeInTheDocument();
    expect(within(box).getByText('filip@example.cz')).toBeInTheDocument();
    expect(within(box).getByText('Komplexní prohlídka — 2 200 Kč · 60 min')).toBeInTheDocument();
    expect(within(box).queryByText(/Datum narození/i)).not.toBeInTheDocument();
  });

  it('never writes the length of the deadline itself', () => {
    render(<QuickBookedPanel view={view} />);
    expect(screen.queryByText(/24 hodin/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ h(odin)?\b/)).not.toBeInTheDocument();
  });

  it('copies the link and says so, on the button and in a toast', async () => {
    render(<QuickBookedPanel view={view} />);
    await userEvent.click(screen.getByRole('button', { name: 'Kopírovat' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(view.linkUrl));
    expect(await screen.findByText('Odkaz zkopírován do schránky')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zkopírováno' })).toBeInTheDocument();
  });

  it('tells the desk to copy by hand when the clipboard is blocked', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    render(<QuickBookedPanel view={view} />);
    await userEvent.click(screen.getByRole('button', { name: 'Kopírovat' }));
    expect(await screen.findByText(/Schránka není dostupná/)).toBeInTheDocument();
  });

  it('leaves the deadline block out when the server sent none', () => {
    render(<QuickBookedPanel view={{ ...view, deadlineUtc: null }} />);
    expect(screen.queryByText(/Pacient má čas na dokončení/)).not.toBeInTheDocument();
  });

  it('makes the copy button full width on a phone, 52 px tall', () => {
    setViewport(VIEWPORTS.phone);
    render(<QuickBookedPanel view={view} />);
    const button = screen.getByRole('button', { name: 'Kopírovat' });
    expect(button).toHaveStyle({ minHeight: '52px' });
    expect(button.className).toMatch(/fullWidth/);
  });
});
