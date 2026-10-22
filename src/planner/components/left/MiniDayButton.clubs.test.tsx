/*
 * R6 + R13 in the mini calendar: a holiday's number sits on the fixed red disc, a closed day's number is grey, and a day a club holds time
 * on carries a hatched bar in the club's colour - with the club, the order and the hold state in the day's accessible name.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MiniCellModel } from '../../model';
import { MiniDayButton } from './MiniDayButton';

const model = { date: '2026-10-28', dayNumber: 28, hasTerms: false, ring: null, ariaLabel: 'St 28. října' } as unknown as MiniCellModel;
const flags = { focused: false, pinned: false, hoverAnchor: false, current: false };
const base = { model, flags, otherMonth: false, previewing: false, today: false, closed: null, tabbable: true, onClick: vi.fn(), onEnter: vi.fn(), onLeave: vi.fn(), onFocus: vi.fn(), onBlur: vi.fn() };

describe('the mini calendar day', () => {
  it('a holiday: the number on the red disc, and the name says "Svátek"', () => {
    render(<MiniDayButton {...base} closed={{ label: 'Den vzniku samostatného československého státu', color: '#FF8A80', kind: 'holiday', fill: '#C62828', ink: '#FFFFFF' }} />);
    const button = screen.getByTestId('mini-day-2026-10-28');
    expect(button).toHaveAttribute('aria-label', 'St 28. října · Svátek: Den vzniku samostatného československého státu');
    const number = button.querySelector('.day-number') as HTMLElement;
    expect(number).toHaveAttribute('data-lock', 'holiday');
    expect(number.style.background).toBe('rgb(198, 40, 40)');
    expect(number.style.color).toBe('rgb(255, 255, 255)');
  });

  it('a closed day: grey number, no disc, the name says "Zavřeno"', () => {
    render(<MiniDayButton {...base} closed={{ label: 'Nepracovní den', color: '#9AA7B4', kind: 'closed' }} />);
    const button = screen.getByTestId('mini-day-2026-10-28');
    expect(button).toHaveAttribute('aria-label', 'St 28. října · Zavřeno: Nepracovní den');
    const number = button.querySelector('.day-number') as HTMLElement;
    expect(number.style.background).toBe('');
    expect(number.style.color).toBe('rgb(154, 167, 180)');
  });

  it('a day a club holds: a bar per club in its colour, and the club, the order and the state in the name', () => {
    render(
      <MiniDayButton
        {...base}
        clubs={[
          { key: 'k1', club: 'FK Slaný', colour: '#2E7D6B', orderCode: 'KO-12AB34CD', hold: 'waiting', activities: [{ id: 'a1', name: 'Spiroergometrie', colour: '#22C55E' }, { id: 'a2', name: 'Komplexní prohlídka', colour: '#F59E0B' }] },
          { key: 'k2', club: 'Dukla', colour: '#7C3AED', orderCode: null, hold: null, activities: [] },
        ]}
      />,
    );
    const button = screen.getByTestId('mini-day-2026-10-28');
    expect(button).toHaveAttribute('aria-label', 'St 28. října · Klub FK Slaný, KO-12AB34CD, Čeká na hráče · Klub Dukla');
    const bars = screen.getByTestId('mini-clubs-2026-10-28').querySelectorAll('i');
    expect(bars).toHaveLength(2);
    expect((bars[0] as HTMLElement).style.getPropertyValue('--club')).toBe('#2E7D6B');
    expect(bars[0]).toHaveAttribute('data-hold', 'waiting');
  });

  it('an ordinary day has no bar and its own name', () => {
    render(<MiniDayButton {...base} />);
    expect(screen.queryByTestId('mini-clubs-2026-10-28')).toBeNull();
    expect(screen.getByTestId('mini-day-2026-10-28')).toHaveAttribute('aria-label', 'St 28. října');
  });
});

describe('R20: the liquid of a day is drawn as činnost bands', () => {
  const layered = (layers: { categoryId: string; color: string; share: number; slots: number; merged: boolean }[]) =>
    ({ ...model, hasTerms: true, ring: { circumference: 131.9, arcs: [], liquidPercent: 40, layers } }) as unknown as MiniCellModel;

  it('one band per činnost in its colour, the highest drawn first; each carries the share up to its own top', () => {
    render(
      <MiniDayButton
        {...base}
        model={layered([
          { categoryId: 'a', color: '#00f1dc', share: 0.5, slots: 2, merged: false },
          { categoryId: 'b', color: '#ffb124', share: 0.3, slots: 1, merged: false },
          { categoryId: '__other', color: '#8795a3', share: 0.2, slots: 1, merged: true },
        ])}
      />,
    );
    const water = screen.getByTestId('mini-day-2026-10-28').querySelector('.liquid-water') as HTMLElement;
    expect(water).toHaveClass('has-layers');
    expect(water).toHaveAttribute('data-layers', '3');
    const bands = [...water.querySelectorAll<HTMLElement>('.liquid-layer')];
    expect(bands.map((b) => b.dataset.category)).toEqual(['__other', 'b', 'a']); /* highest first: a lower wave rides over the one above */
    expect(bands.map((b) => b.style.getPropertyValue('--c'))).toEqual(['#8795a3', '#ffb124', '#00f1dc']);
    expect(bands.map((b) => b.style.getPropertyValue('--cum'))).toEqual(['1.00', '0.80', '0.50']);
    expect(bands[0]).toHaveAttribute('data-merged', 'true');
    expect(water).toHaveAttribute('data-fill', '40.000'); /* the level itself is unchanged */
  });

  it('a day whose činnosti are unknown keeps the plain water (no bands)', () => {
    render(<MiniDayButton {...base} model={layered([])} />);
    const water = screen.getByTestId('mini-day-2026-10-28').querySelector('.liquid-water') as HTMLElement;
    expect(water).not.toHaveClass('has-layers');
    expect(water.querySelectorAll('.liquid-layer')).toHaveLength(0);
  });
});
