import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarColorList, defaultCalendarColor } from './CalendarColorList';
import { calendarToInput } from '../../../api/calendars';
import type { Calendar } from '../../../api/bookingContracts';

const PALETTE = ['#0D5C52', '#2B3440', '#8A5A2F'];
const calendar = (over: Partial<Calendar>): Calendar => ({
  id: 'c1', name: 'Ordinace 1', color: '#0D5C52', location: 'Praha', displayStepMinutes: 15, isActive: true, sortOrder: 1, clinicServiceId: 's1',
  publicMinimumNoticeMinutes: 60, publicHorizonDays: 30, publicHoldMinutes: 15, publicCancellationHours: 24, ...over,
});
const CALENDARS = [calendar({}), calendar({ id: 'c2', name: 'Diagnostika', color: '#AA5500', sortOrder: 2 }), calendar({ id: 'c3', name: 'InBody', color: '#8A5A2F', sortOrder: 3, isActive: false })];

describe('defaultCalendarColor', () => {
  it('is the palette colour at the position of the calendar, wrapping round', () => {
    const four = [...CALENDARS, calendar({ id: 'c4', name: 'Balíčky', sortOrder: 4 })];
    expect(defaultCalendarColor(four, four[0]!, PALETTE, '#999999')).toBe('#0D5C52');
    expect(defaultCalendarColor(four, four[2]!, PALETTE, '#999999')).toBe('#8A5A2F');
    expect(defaultCalendarColor(four, four[3]!, PALETTE, '#999999')).toBe('#0D5C52');
  });
  it('falls back when the palette is empty', () => {
    expect(defaultCalendarColor(CALENDARS, CALENDARS[0]!, [], '#999999')).toBe('#999999');
  });
});

describe('CalendarColorList', () => {
  it('draws one swatch button per calendar, marks a colour of its own and a switched-off calendar', () => {
    render(<CalendarColorList calendars={CALENDARS} palette={PALETTE} fallback="#999999" onPick={() => undefined} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    const own = screen.getByRole('button', { name: 'Změnit barvu kalendáře Diagnostika' }).closest('li') as HTMLElement;
    expect(within(own).getByText('vlastní')).toBeInTheDocument();
    const plain = screen.getByRole('button', { name: 'Změnit barvu kalendáře Ordinace 1' }).closest('li') as HTMLElement;
    expect(within(plain).queryByText('vlastní')).not.toBeInTheDocument();
    expect(screen.getByText('Vypnuto')).toBeInTheDocument();
  });

  it('hands the clicked calendar to the page (which owns the popover)', async () => {
    const onPick = vi.fn();
    render(<CalendarColorList calendars={CALENDARS} palette={PALETTE} fallback="#999999" onPick={onPick} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Změnit barvu kalendáře InBody' }));
    expect(onPick).toHaveBeenCalledWith(expect.any(HTMLElement), CALENDARS[2]);
  });

  it('says so when there is no calendar', () => {
    render(<CalendarColorList calendars={[]} palette={PALETTE} fallback="#999999" onPick={() => undefined} />);
    expect(screen.getByText('Zatím žádný kalendář.')).toBeInTheDocument();
  });
});

describe('calendarToInput', () => {
  it('saves the calendar exactly as read with only the colour changed (PUT is the whole calendar)', () => {
    const input = calendarToInput(CALENDARS[0]!, { color: '#EA580C' });
    expect(input).toEqual({
      name: 'Ordinace 1', color: '#EA580C', location: 'Praha', displayStepMinutes: 15, isActive: true, sortOrder: 1, clinicServiceId: 's1',
      publicMinimumNoticeMinutes: 60, publicHorizonDays: 30, publicHoldMinutes: 15, publicCancellationHours: 24,
    });
  });
});
