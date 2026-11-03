import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddToCalendar } from './AddToCalendar';

const event = { startUtc: '2026-10-26T08:00:00Z', endUtc: '2026-10-26T08:15:00Z', title: 'Prohlídka', location: 'Praha' };
afterEach(() => vi.restoreAllMocks());

describe('AddToCalendar', () => {
  it('Google opens in a new tab on every platform', () => {
    render(<AddToCalendar event={event} platform="other" />);
    const link = screen.getByRole('link', { name: /Google Kalendář/ });
    expect(link).toHaveAttribute('href', expect.stringContaining('calendar.google.com/calendar/render?action=TEMPLATE'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('uses the server https URL as a plain link when there is one', () => {
    render(<AddToCalendar event={event} platform="ios-safari" icsUrl="https://api.example.cz/x/calendar.ics" />);
    const link = screen.getByRole('link', { name: /Apple Kalendář/ });
    expect(link).toHaveAttribute('href', 'https://api.example.cz/x/calendar.ics');
    expect(link).not.toHaveAttribute('download');
    expect(screen.queryByTestId('calendar-safari-hint')).not.toBeInTheDocument();
  });

  it('iOS Safari: navigates the window to a text/calendar data URI', async () => {
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign } as unknown as Location);
    render(<AddToCalendar event={event} platform="ios-safari" />);
    await userEvent.click(screen.getByRole('button', { name: /Apple Kalendář/ }));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(String(assign.mock.calls[0][0])).toMatch(/^data:text\/calendar;charset=utf-8,BEGIN%3AVCALENDAR/);
    expect(screen.queryByTestId('calendar-safari-hint')).not.toBeInTheDocument();
  });

  it('iOS Chrome / webview: file fallback plus the "open in Safari" hint', async () => {
    const create = vi.fn().mockReturnValue('blob:x');
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    render(<AddToCalendar event={event} platform="ios-other" />);
    expect(screen.getByTestId('calendar-safari-hint')).toHaveTextContent('Safari');
    await userEvent.click(screen.getByRole('button', { name: /Apple Kalendář/ }));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('desktop / Android: downloads an .ics Blob with the given name', async () => {
    const create = vi.fn().mockReturnValue('blob:x');
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
    render(<AddToCalendar event={event} platform="other" fileName="termin.ics" />);
    expect(screen.queryByTestId('calendar-safari-hint')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Apple Kalendář/ }));
    expect(click).toHaveBeenCalled();
    expect(names).toEqual(['termin.ics']);
    expect((create.mock.calls[0][0] as Blob).type).toContain('text/calendar');
  });
});
