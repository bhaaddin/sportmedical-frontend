import { describe, it, expect } from 'vitest';
import type { Calculation } from '../../api/clubBlocks';
import {
  blockFree, blockPercent, calculationSentence, clubColorOf, formatMinutes, formatPlayers, formatShortSpan,
  formatWeekdayDayMonth, hasBlockErrors, initialsOf, inkOn, parsePlayerCount, plural, validateBlockDraft,
} from './blockLogic';
import { coveredMinutes, moveToToday, nextDay, overlapErrors, sortRows, startsInPast, todayInPrague } from './blockLogic';
import type { BlockDraft } from './blockLogic';

const calc = (over: Partial<Calculation> = {}): Calculation => ({
  minutesPerPlayer: 60, parallelCapacity: 2, neededMinutes: 3600, dailyOpenMinutes: 600,
  suggestedDays: 7, suggestedFrom: '2026-10-26', suggestedTo: '2026-11-03', fitsHorizon: true,
  minimumPlayers: null, belowMinimum: false, perDay: [], ...over,
});

const draft = (over: Partial<BlockDraft> = {}): BlockDraft => ({
  clubId: 'club-1', name: '', calendarIds: ['c-1'], activityIds: ['a-1'], fromDate: '2026-10-26', toDate: '2026-10-30',
  dailyFrom: '', dailyTo: '', playerCount: '120', note: '', ...over,
});

describe('Czech plurals', () => {
  it('picks one, few and many', () => {
    expect(plural(1, ['den', 'dny', 'dní'])).toBe('den');
    expect(plural(3, ['den', 'dny', 'dní'])).toBe('dny');
    expect(plural(7, ['den', 'dny', 'dní'])).toBe('dní');
    expect(plural(0, ['den', 'dny', 'dní'])).toBe('dní');
  });

  it('writes players and minutes with a non-breaking unit', () => {
    expect(formatPlayers(120)).toBe('120 hráčů');
    expect(formatPlayers(3)).toBe('3 hráči');
    expect(formatMinutes(3600)).toMatch(/^3\s600 min$/);
  });
});

describe('calculationSentence', () => {
  it('reads players × minutes ÷ stations = needed → days, span', () => {
    const text = calculationSentence(120, calc());
    expect(text.replace(/\s/g, ' ')).toBe('120 hráčů × 60 min ÷ 2 stanoviště = 3 600 min → 7 dní, 26. 10. – 3. 11.');
  });

  it('says one station and five stations in the right form', () => {
    expect(calculationSentence(10, calc({ parallelCapacity: 1, neededMinutes: 600, suggestedDays: 1, suggestedFrom: '2026-10-26', suggestedTo: '2026-10-26' })))
      .toMatch(/÷ 1 stanoviště = .* → 1 den, 26\. 10\.$/);
    expect(calculationSentence(10, calc({ parallelCapacity: 5 }))).toContain('÷ 5 stanovišť');
  });

  it('stops at the need when no days are suggested', () => {
    expect(calculationSentence(10, calc({ suggestedDays: 0, suggestedFrom: null, suggestedTo: null }))).not.toContain('→');
  });
});

describe('dates', () => {
  it('formats a span and a weekday', () => {
    expect(formatShortSpan('2026-10-26', '2026-11-03')).toBe('26. 10. – 3. 11.');
    expect(formatShortSpan('2026-10-26', '2026-10-26')).toBe('26. 10.');
    expect(formatWeekdayDayMonth('2026-10-26')).toBe('po 26. 10.');
  });
});

describe('player count', () => {
  it('has no ceiling, only a floor of one', () => {
    expect(parsePlayerCount('120')).toBe(120);
    expect(parsePlayerCount('10 000')).toBe(10000);
    expect(parsePlayerCount('0')).toBeNull();
    expect(parsePlayerCount('')).toBeNull();
    expect(parsePlayerCount('12,5')).toBeNull();
  });
});

describe('validateBlockDraft', () => {
  it('accepts a complete draft', () => {
    expect(hasBlockErrors(validateBlockDraft(draft(), true, false))).toBe(false);
  });

  it('asks for the club, the lists, the days and the headcount', () => {
    const errors = validateBlockDraft(draft({ calendarIds: [], activityIds: [], fromDate: '', playerCount: '' }), false, false);
    expect(Object.keys(errors).sort()).toEqual(['activityIds', 'calendarIds', 'clubId', 'fromDate', 'playerCount']);
  });

  it('refuses an end before the start and half a daily window', () => {
    expect(validateBlockDraft(draft({ toDate: '2026-10-20' }), true, false).toDate).toBe('Konec nesmí být před začátkem.');
    expect(validateBlockDraft(draft({ dailyFrom: '08:00' }), true, false).dailyFrom).toMatch(/obě hodiny/);
    expect(validateBlockDraft(draft({ dailyFrom: '12:00', dailyTo: '08:00' }), true, false).dailyTo).toMatch(/později/);
  });

  it('does not ask an edit for the lists a PUT cannot change', () => {
    expect(hasBlockErrors(validateBlockDraft(draft({ calendarIds: [], activityIds: [] }), false, true))).toBe(false);
  });
});

describe('block figures', () => {
  it('counts free places and the filled share', () => {
    expect(blockFree({ seats: 120, registered: 45 })).toBe(75);
    expect(blockFree({ seats: 10, registered: 12 })).toBe(0);
    expect(blockPercent({ seats: 120, registered: 30 })).toBe(25);
    expect(blockPercent({ seats: 0, registered: 0 })).toBe(0);
  });
});

describe('club colour', () => {
  it("takes the club's own colour, then its blocks', then none", () => {
    expect(clubColorOf({ id: 'a', colorHex: '#112233' }, [])).toBe('#112233');
    expect(clubColorOf({ id: 'a' }, [{ clubId: 'b', colorHex: '#000000' }, { clubId: 'a', colorHex: '#445566' }])).toBe('#445566');
    expect(clubColorOf({ id: 'a' }, [{ clubId: 'b', colorHex: '#000000' }])).toBeNull();
  });

  it('picks readable ink and initials', () => {
    expect(inkOn('#FFFFFF')).toBe('#14181C');
    expect(inkOn('#0D5C52')).toBe('#FFFFFF');
    expect(inkOn('nonsense')).toBe('#14181C');
    expect(initialsOf('FK Slaný')).toBe('FS');
    expect(initialsOf('Sparta')).toBe('SP');
  });
});

describe('several ranges', () => {
  it('finds today in Prague, not in the browser zone', () => {
    expect(todayInPrague(new Date('2026-10-03T23:30:00Z'))).toBe('2026-10-04');
    expect(todayInPrague(new Date('2026-10-04T10:00:00Z'))).toBe('2026-10-04');
  });

  it('steps to the next day across month and year ends', () => {
    expect(nextDay('2026-10-31')).toBe('2026-11-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(nextDay('')).toBe('');
  });

  it('moves a past start to today and keeps a later end', () => {
    expect(moveToToday({ fromDate: '2026-09-30', toDate: '2026-10-02' }, '2026-10-04')).toEqual({ fromDate: '2026-10-04', toDate: '2026-10-04' });
    expect(moveToToday({ fromDate: '2026-09-30', toDate: '2026-10-09' }, '2026-10-04')).toEqual({ fromDate: '2026-10-04', toDate: '2026-10-09' });
    expect(startsInPast({ fromDate: '2026-10-04' }, '2026-10-04')).toBe(false);
    expect(startsInPast({ fromDate: '2026-10-03' }, '2026-10-04')).toBe(true);
  });

  it('flags overlapping and duplicate rows', () => {
    const rows = [
      { fromDate: '2026-10-26', toDate: '2026-10-28' },
      { fromDate: '2026-10-28', toDate: '2026-10-30' },
      { fromDate: '2026-11-02', toDate: '2026-11-03' },
    ];
    expect(overlapErrors(rows)).toEqual(['Tento termín se překrývá s řádkem 2', 'Tento termín se překrývá s řádkem 1', undefined]);
    expect(overlapErrors([rows[2], rows[2]])).toEqual(['Tento termín se překrývá s řádkem 2', 'Tento termín se překrývá s řádkem 1']);
  });

  it('sorts by first day, rows without one last', () => {
    expect(sortRows([{ fromDate: '2026-11-02' }, { fromDate: '' }, { fromDate: '2026-10-26' }]).map((r) => r.fromDate)).toEqual(['2026-10-26', '2026-11-02', '']);
  });

  it('sums open minutes inside each row, capped by its daily window', () => {
    const rows = [
      { fromDate: '2026-10-26', toDate: '2026-10-27', dailyFrom: '', dailyTo: '' },
      { fromDate: '2026-11-02', toDate: '2026-11-02', dailyFrom: '08:00', dailyTo: '10:00' },
    ];
    const per = [
      [{ date: '2026-10-26', openMinutes: 600 }, { date: '2026-10-27', openMinutes: 600 }, { date: '2026-10-28', openMinutes: 600 }],
      [{ date: '2026-11-02', openMinutes: 600 }, { date: '2026-11-03', openMinutes: 600 }],
    ];
    expect(coveredMinutes(rows, (i) => per[i])).toBe(1200 + 120);
  });
});
