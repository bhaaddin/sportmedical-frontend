import { describe, expect, it } from 'vitest';
import { clubOrderRelatedGroups } from './related';

const order = (over: Partial<Parameters<typeof clubOrderRelatedGroups>[0]['order']> = {}) => ({
  clubId: 'c1', clubName: 'ZZ test FC', invoiceId: null, paymentMethod: 'ClubInvoice' as const, registered: 0, totalSeats: 20, ...over,
});

describe('clubOrderRelatedGroups (an order\'s Související)', () => {
  it('names the club, the invoice and the players, in that order', () => {
    const groups = clubOrderRelatedGroups({ order: order({ invoiceId: 'i1', registered: 7 }), invoiceNumber: '2026-0012', mayBill: true });
    expect(groups.map((g) => g.id)).toEqual(['club', 'invoice', 'players']);
    expect(groups[0].entities).toEqual([{ kind: 'club', id: 'c1', label: 'ZZ test FC' }]);
    expect(groups[1].entities).toEqual([{ kind: 'invoice', id: 'i1', label: '2026-0012' }]);
    expect(groups[2]).toMatchObject({ total: 7, notes: ['7 z 20 míst'], viewAll: { to: '/clubs/hraci?clubId=c1' } });
  });

  it('an invoice without a known number is still a chip ("Faktura")', () => {
    const [, invoice] = clubOrderRelatedGroups({ order: order({ invoiceId: 'i1' }), mayBill: true });
    expect(invoice.entities[0].label).toBe('Faktura');
  });

  it('nothing billed yet is said, per person it says no club invoice comes', () => {
    expect(clubOrderRelatedGroups({ order: order(), mayBill: true })[1]).toMatchObject({ total: 0, empty: 'Zatím nevyfakturováno.' });
    expect(clubOrderRelatedGroups({ order: order({ paymentMethod: 'PerPerson' }), mayBill: true })[1].empty).toMatch(/po osobách/);
  });

  it('a person who may not bill sees no invoice group at all', () => {
    expect(clubOrderRelatedGroups({ order: order({ invoiceId: 'i1' }), mayBill: false }).map((g) => g.id)).toEqual(['club', 'players']);
  });

  it('no registered player is the empty sentence with the seats, not a zero', () => {
    const players = clubOrderRelatedGroups({ order: order(), mayBill: true })[2];
    expect(players).toMatchObject({ total: 0, notes: [], empty: 'Zatím se nikdo nezapsal (0 z 20 míst).' });
  });
});
