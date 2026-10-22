import { describe, expect, it } from 'vitest';
import type { TimeBlock } from '../../../api/bookingContracts';
import { clubDaysOf } from '../left/miniClubs';
import type { ClubBlockView } from '../../../api/clubBlocks';
import { clubHolding, clubItemText, clubReservedText, holdLabel, holdStateOf, seatsLabel } from './clubHold';
import { releaseFailedText, releaseSummary } from './clubRelease';
import { clubItemsByDay, clubLinesByDay } from './phoneModel';

const block = (over: Partial<TimeBlock> = {}): TimeBlock =>
  ({ id: 'b1', startUtc: '2026-12-10T07:00:00Z', endUtc: '2026-12-10T11:00:00Z', reason: '', kind: 'club', clubName: 'FK Slaný', clubBlockId: 'kb1', colorHex: '#2E7D6B', ...over }) as TimeBlock;

describe('R13: the hold state of a club block', () => {
  it('waiting for players, full, expired - the words the owner asked for', () => {
    expect(holdLabel(holdStateOf(block({ playersMissing: true }))!)).toBe('Čeká na hráče');
    expect(holdLabel(holdStateOf(block({ playersMissing: false }))!)).toBe('Obsazeno');
    expect(holdLabel(holdStateOf(block({ playersMissing: true, windowEmpty: true, holdExpired: true }))!)).toBe('Hold vypršel');
  });

  it('an expired hold wins over "waiting"; nothing is claimed without data (an older server)', () => {
    expect(holdStateOf(block({ playersMissing: false, holdExpired: true }))).toBe('expired');
    expect(holdStateOf(block())).toBeNull();
    expect(holdStateOf(block({ kind: 'manual', playersMissing: true }))).toBeNull();
  });

  it('derives waiting / full from the seat counts when the flags are absent', () => {
    expect(holdStateOf(block({ seats: 22, registered: 7 }))).toBe('waiting');
    expect(holdStateOf(block({ seats: 22, registered: 22 }))).toBe('full');
    expect(holdStateOf(block({ seats: 0, registered: 0 }))).toBeNull();
    expect(seatsLabel(block({ seats: 22, registered: 7 }))).toBe('7/22 zapsáno');
    expect(seatsLabel(block())).toBeNull();
  });

  it('says whose the held time is: "Rezervováno pro klub X"', () => {
    const range = { start: 9 * 60, end: 9 * 60 + 30 }; // 08:00Z-12:00Z... December is CET: 08:00-12:00 Prague
    expect(clubHolding([block()], '2026-12-10', range)?.id).toBe('b1');
    expect(clubHolding([block()], '2026-12-10', { start: 13 * 60, end: 14 * 60 })).toBeNull(); // after the window
    expect(clubHolding([block()], '2026-12-11', range)).toBeNull(); // another day
    expect(clubHolding([block({ kind: 'manual' })], '2026-12-10', range)).toBeNull(); // a manual block is not a club's
    expect(clubReservedText(block())).toBe('Rezervováno pro klub FK Slaný');
    expect(clubReservedText(block({ clubName: null }))).toBe('Rezervováno pro klub klub');
  });

  it('the line of the month and the phone list carries the order code and the hold state when the server sent them', () => {
    const days = ['2026-12-10'];
    const plain = clubLinesByDay(days, ['c1'], new Map([['c1', [block()]]]), () => null);
    expect(plain.get('2026-12-10')).toEqual(['FK Slaný · 08:00–12:00']); // an older server: exactly as before
    const rich = clubItemsByDay(days, ['c1'], new Map([['c1', [block({ orderCode: 'KO-12AB34CD', playersMissing: true, clubOrderId: 'o1' })]]]), () => null).get('2026-12-10')![0]!;
    expect(rich).toMatchObject({ club: 'FK Slaný', colour: '#2E7D6B', orderCode: 'KO-12AB34CD', orderId: 'o1', hold: 'waiting', range: '08:00–12:00' });
    expect(clubItemText(rich)).toBe('FK Slaný · KO-12AB34CD · 08:00–12:00 · Čeká na hráče');
  });

  it('the mini calendar marks the days inside a block\'s span, not closed days, with the hold state', () => {
    const view = (over: Partial<ClubBlockView>): ClubBlockView => ({
      id: 'k1', clubId: 'c', clubName: 'FK Slaný', colorHex: '#2E7D6B', name: null, calendarIds: [], activityIds: [], fromDate: '2026-12-09', toDate: '2026-12-11',
      dailyFrom: null, dailyTo: null, playerCount: 0, seats: 10, registered: 10, status: 'Active', registrationToken: null, registrationUrl: null, note: null,
      createdAtUtc: null, athletes: [], ...over,
    });
    const days = ['2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11', '2026-12-12'];
    const marks = { '2026-12-10': { date: '2026-12-10', closed: true, label: 'Svátek' } };
    const out = clubDaysOf(days, [view({ orderCode: 'KO-1' }), view({ id: 'k2', status: 'Cancelled' })], marks);
    expect([...out.keys()]).toEqual(['2026-12-09', '2026-12-11']);
    expect(out.get('2026-12-09')![0]).toMatchObject({ club: 'FK Slaný', orderCode: 'KO-1', hold: 'full' });
  });

  it('tells the owner what a release did, and refuses nothing it did not do', () => {
    expect(releaseSummary({ windowsRemoved: 2, windowsShortened: 1, minutesReleased: 180, stretchesKept: 3, blockCancelled: false })).toBe('Uvolněno 180 min, odstraněno 2, zkráceno 1, ponecháno 3.');
    expect(releaseSummary({ windowsRemoved: 0, windowsShortened: 0, minutesReleased: 0, stretchesKept: 4, blockCancelled: false })).toMatch(/Není co uvolnit/);
    expect(releaseSummary({ windowsRemoved: 1, windowsShortened: 0, minutesReleased: 60, stretchesKept: 0, blockCancelled: true })).toContain('Blokace klubu tím zanikla');
    expect(releaseFailedText(new Error('Objednávka není potvrzená.'))).toBe('Objednávka není potvrzená.');
    expect(releaseFailedText(new Error('Request failed with status code 500'))).toBe('Čas se nepodařilo uvolnit. Zkuste to prosím znovu.');
  });
});
