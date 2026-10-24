import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TimeBlock } from '../../../api/bookingContracts';
import type { ActivityInfo, Catalogue } from '../../../components/booking/calendar/model';
import { WindowBlock } from './BoardCards';
import type { BoardWindowModel } from './boardModel';
import { clubItemsByDay } from './phoneModel';
import { distinctActivities, frameActivities, frameSubs, stripesCss, subTitle, UNKNOWN_ACTIVITY_COLOUR } from './clubFrame';

const act = (id: string, name: string, colorHex: string | null): ActivityInfo => ({ id, name, serviceId: null, colorHex, sortOrder: 0, durationMinutes: 30, parallelCapacity: 1, isActive: true });
const catalogue: Catalogue = { activities: new Map([['spiro', act('spiro', 'Spiroergometrie', '#22C55E')], ['komp', act('komp', 'Komplexní prohlídka', '#F59E0B')]]), services: new Map() };
/* December is CET: 08:00 Prague = 07:00Z */
const win = (id: string, from: string, to: string, ids: string[] | undefined, over: Partial<TimeBlock> = {}): TimeBlock =>
  ({ id, startUtc: `2026-12-10T${from}:00Z`, endUtc: `2026-12-10T${to}:00Z`, reason: '', kind: 'club', clubId: 'c', clubName: 'FK Slaný', clubBlockId: 'kb1', colorHex: '#2E7D6B', ...(ids ? { activityIds: ids } : {}), ...over }) as TimeBlock;

describe('R16b: the činnosti inside a club\'s frame', () => {
  it('a window names its činnosti by id: name and colour come from the catalogue, duplicates once', () => {
    expect(frameActivities(['spiro', 'komp', 'spiro'], catalogue)).toEqual([
      { id: 'spiro', name: 'Spiroergometrie', colour: '#22C55E' },
      { id: 'komp', name: 'Komplexní prohlídka', colour: '#F59E0B' },
    ]);
  });

  it('an unknown činnost is grey, never a club colour', () => {
    expect(frameActivities(['ghost'], catalogue)).toEqual([{ id: 'ghost', name: 'Činnost', colour: UNKNOWN_ACTIVITY_COLOUR }]);
  });

  it('one sub-block per window that names a činnost, in time order; a window naming none has none (older server)', () => {
    const subs = frameSubs([win('w2', '11:30', '15:00', ['komp']), win('w1', '07:00', '11:00', ['spiro']), win('w3', '15:00', '16:00', undefined)], '2026-12-10', catalogue);
    expect(subs.map((s) => [s.key, s.start, s.end, s.activities.map((a) => a.id)])).toEqual([
      ['w1', 8 * 60, 12 * 60, ['spiro']],
      ['w2', 12 * 60 + 30, 16 * 60, ['komp']],
    ]);
    expect(subTitle(subs[0]!)).toBe('08:00–12:00 Spiroergometrie');
  });

  it('distinct činnosti of the day keep the first-seen order', () => {
    const subs = frameSubs([win('a', '07:00', '09:00', ['spiro']), win('b', '09:00', '11:00', ['komp', 'spiro']), win('c', '12:00', '14:00', ['spiro'])], '2026-12-10', catalogue);
    expect(distinctActivities(subs).map((a) => a.id)).toEqual(['spiro', 'komp']);
  });

  it('several činnosti in one window are equal hard stripes; one is a flat tint', () => {
    expect(stripesCss(['#111111'], (c) => c)).toBe('linear-gradient(0deg, #111111, #111111)');
    expect(stripesCss(['#111111', '#222222'], (c) => c)).toBe('linear-gradient(90deg, #111111 0.00% 50.00%, #222222 50.00% 100.00%)');
  });

  it('the month tile / phone item carries the day\'s činnosti; a club day over the lunch is ONE item', () => {
    const blocks = new Map([['c1', [win('w1', '07:00', '11:00', ['spiro']), win('w2', '11:30', '16:00', ['komp'])]]]);
    const lunch = () => ({ start: 11 * 60 + 30 - 0, end: 12 * 60 + 30 });
    const items = clubItemsByDay(['2026-12-10'], ['c1'], blocks, lunch, undefined, catalogue).get('2026-12-10')!;
    expect(items).toHaveLength(1);
    expect(items[0]!.activities.map((a) => a.name)).toEqual(['Spiroergometrie', 'Komplexní prohlídka']);
  });
});

describe('R16b: the framed block on the board', () => {
  const base = (over: Partial<BoardWindowModel> = {}): BoardWindowModel => {
    const block = win('w1', '07:00', '16:00', ['spiro'], { orderCode: 'KO-1', clubOrderId: 'o1' });
    return {
      key: 'window:c1:w1:2026-12-10', kind: 'club', col: 3, sub: 0, subs: 1, day: '2026-12-10', top: 10, height: 300, lane: 0, lanes: 1, left: '0', width: '14%',
      label: 'FK Slaný', timeLabel: '08:00–17:00', start: 480, end: 1020, colour: '#2E7D6B', block, allBlocks: [block], calendarId: 'c1', calendarName: 'Ordinace 1', clubDates: null,
      frame: [
        { key: 'p1', start: 480, end: 720, top: 0, height: 120, activities: [{ id: 'spiro', name: 'Spiroergometrie', colour: '#22C55E' }] },
        { key: 'p2', start: 780, end: 1020, top: 160, height: 140, activities: [{ id: 'komp', name: 'Komplexní prohlídka', colour: '#F59E0B' }, { id: 'spiro', name: 'Spiroergometrie', colour: '#22C55E' }] },
      ],
      ...over,
    };
  };

  it('draws the club name, order code and lock once, with a sub-block per window in the činnost colours, and a click opens the order', () => {
    const onOpen = vi.fn();
    render(<WindowBlock window={base()} onOpen={onOpen} />);
    const block = screen.getByTestId('board-window-w1-2026-12-10');
    expect(block.querySelectorAll('.win-label')).toHaveLength(1);
    expect(screen.getByTestId('club-window-code')).toHaveTextContent('KO-1');
    expect(screen.getAllByTestId('club-frame-sub')).toHaveLength(2);
    expect(screen.getAllByTestId('club-frame-sub')[0]!.style.backgroundImage).toContain('linear-gradient');
    expect(screen.getByTestId('club-window-acts')).toHaveTextContent('Spiroergometrie');
    expect(screen.getByTestId('club-window-acts')).toHaveTextContent('Komplexní prohlídka');
    expect(block).toHaveAttribute('aria-label', expect.stringContaining('08:00–12:00 Spiroergometrie'));
    block.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('a window without named činnosti keeps the plain hatch (no frame layer)', () => {
    render(<WindowBlock window={base({ frame: [] })} onOpen={vi.fn()} />);
    expect(screen.queryByTestId('club-frame')).toBeNull();
    expect(screen.queryByTestId('club-window-acts')).toBeNull();
  });

  it('a manual block never gets a frame', () => {
    render(<WindowBlock window={base({ kind: 'manual', frame: [] })} onOpen={vi.fn()} />);
    expect(screen.queryByTestId('club-frame')).toBeNull();
  });
});
