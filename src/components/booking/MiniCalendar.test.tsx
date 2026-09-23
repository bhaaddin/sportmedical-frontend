import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MiniCalendar } from './MiniCalendar';

const day = (label: RegExp) => screen.getByRole('button', { name: label });
const cellOf = (key: string) => document.querySelector(`[data-day="${key}"]`) as HTMLElement;

describe('MiniCalendar', () => {
  it('shows the month in Czech, Monday first, and moves a month at a time', async () => {
    render(<MiniCalendar value={new Date(2026, 8, 23)} view="month" onSelect={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Září 2026' })).toBeInTheDocument();
    expect(screen.getByText('Po')).toBeInTheDocument();
    expect(screen.getByText('Ne')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Další měsíc' }));
    expect(screen.getByRole('heading', { name: 'Říjen 2026' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Předchozí měsíc' }));
    await userEvent.click(screen.getByRole('button', { name: 'Předchozí měsíc' }));
    expect(screen.getByRole('heading', { name: 'Srpen 2026' })).toBeInTheDocument();
  });

  it('hands the clicked day to the page', async () => {
    const onSelect = vi.fn();
    render(<MiniCalendar value={new Date(2026, 8, 23)} view="week" onSelect={onSelect} />);

    await userEvent.click(day(/^úterý 8\. září 2026/));

    expect(onSelect).toHaveBeenCalledTimes(1);
    const picked = onSelect.mock.calls[0][0] as Date;
    expect([picked.getFullYear(), picked.getMonth(), picked.getDate()]).toEqual([2026, 8, 8]);
  });

  it('lights the whole week of the 8th in week view, the 8th strongest', () => {
    render(<MiniCalendar value={new Date(2026, 8, 8)} view="week" onSelect={() => {}} />);

    expect(cellOf('2026-09-08').dataset.highlight).toBe('day');
    expect(cellOf('2026-09-08')).toHaveAttribute('aria-pressed', 'true');
    for (const key of ['2026-09-07', '2026-09-09', '2026-09-13']) {
      expect(cellOf(key).dataset.highlight).toBe('week');
    }
    expect(cellOf('2026-09-06').dataset.highlight).toBe('none');
    expect(cellOf('2026-09-14').dataset.highlight).toBe('none');
  });

  it('keeps the week softer in day view', () => {
    render(<MiniCalendar value={new Date(2026, 8, 8)} view="day" onSelect={() => {}} />);
    expect(cellOf('2026-09-09').dataset.highlight).toBe('weekSoft');
  });

  it('marks holidays and closed days, and says so', () => {
    render(
      <MiniCalendar
        value={new Date(2026, 8, 23)}
        view="month"
        onSelect={() => {}}
        holidays={new Set(['2026-09-28'])}
        closedDays={new Set(['2026-09-29'])}
      />,
    );

    expect(cellOf('2026-09-28')).toHaveAttribute('data-holiday', 'true');
    expect(cellOf('2026-09-28')).toHaveAccessibleName('pondělí 28. září 2026, svátek');
    expect(cellOf('2026-09-29')).toHaveAttribute('data-closed', 'true');
    expect(cellOf('2026-09-30')).not.toHaveAttribute('data-holiday');
    expect(screen.getByText('červené číslo')).toBeInTheDocument();
    expect(screen.getByText('zavřeno')).toBeInTheDocument();
  });

  it('follows the selection into another month', () => {
    const { rerender } = render(
      <MiniCalendar value={new Date(2026, 8, 23)} view="week" onSelect={() => {}} />,
    );
    rerender(<MiniCalendar value={new Date(2026, 10, 2)} view="week" onSelect={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Listopad 2026' })).toBeInTheDocument();
    expect(cellOf('2026-11-02').dataset.highlight).toBe('day');
  });
});
