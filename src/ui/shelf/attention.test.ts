import { describe, expect, it } from 'vitest';
import type { Invoice } from '../../api/billing';
import type { DayAppointment } from '../../api/bookingContracts';
import {
  ITEMS_PER_GROUP, attentionGroups, attentionTotal, clubInquiries, daysBetween, expiringDocuments, failedMessages, intakeReviews,
  overdueInvoices, paperworkToday, paperworkWords,
} from './attention';

/* 21. 10. 2026, 10:00 Prague */
const NOW = new Date('2026-10-21T08:00:00Z');

const invoice = (over: Partial<Invoice>): Invoice => ({
  id: 'i1', patientId: 'p1', patientName: 'Jana Marková', invoiceNumber: 'FA-1', status: 'Issued', totalCzk: 1000, paidCzk: 0, remainingCzk: 1000,
  currency: 'CZK', issueDateUtc: '2026-09-01T10:00:00Z', dueDateUtc: '2026-10-01T10:00:00Z', items: [], ...over,
});

const appt = (over: Partial<DayAppointment>): DayAppointment => ({
  id: 'a1', calendarId: 'k1', patientId: 'p1', activityId: 'x', activityName: 'Kontrola', startUtc: '2026-10-21T09:00:00Z', endUtc: '2026-10-21T09:30:00Z',
  status: 0, isRunningLate: false, checkedInUtc: null, paperwork: { ready: false, missing: ['questionnaire_missing'] }, ...over,
});

describe('overdueInvoices', () => {
  it('is nothing when the invoices are not known (never a false all-clear)', () => {
    expect(overdueInvoices({ now: NOW })).toBeNull();
    expect(overdueInvoices({ now: NOW, invoices: null })).toBeNull();
  });

  it('counts an open invoice past its due date and nothing else', () => {
    const group = overdueInvoices({
      now: NOW,
      invoices: [
        invoice({ id: 'late', invoiceNumber: 'FA-LATE' }),
        invoice({ id: 'part', invoiceNumber: 'FA-PART', status: 'PartiallyPaid', remainingCzk: 400 }),
        invoice({ id: 'paid', status: 'Paid', remainingCzk: 0 }),
        invoice({ id: 'fresh', dueDateUtc: '2026-11-30T10:00:00Z' }),
        invoice({ id: 'draft', status: 'Draft' }),
        invoice({ id: 'cancelled', status: 'Cancelled' }),
        invoice({ id: 'zero', remainingCzk: 0 }),
      ],
    });
    expect(group?.count).toBe(2);
    expect(group?.severity).toBe('high');
    expect(group?.items.map((i) => i.id)).toEqual(['invoice-late', 'invoice-part']);
  });

  it('puts the longest overdue first, says how late and how much, and links to the invoice', () => {
    const group = overdueInvoices({
      now: NOW,
      invoices: [
        invoice({ id: 'recent', invoiceNumber: 'FA-R', dueDateUtc: '2026-10-19T10:00:00Z', remainingCzk: 5000 }),
        invoice({ id: 'old', invoiceNumber: 'FA-O', dueDateUtc: '2026-10-01T10:00:00Z', remainingCzk: 800 }),
      ],
    })!;
    expect(group.items[0].id).toBe('invoice-old');
    expect(group.items[0].detail).toContain('po splatnosti 20 dní');
    expect(group.items[1].detail).toContain('po splatnosti 2 dny');
    expect(group.items[0].to).toBe('/billing');
    expect(group.items[0].state).toEqual({ invoiceId: 'old' });
    expect(group.summary).toContain('nejstarší je 20 dní');
    expect(group.action.to).toBe('/billing');
  });

  it('says who owes it: the club first, then the recipient, then the patient', () => {
    const group = overdueInvoices({ now: NOW, invoices: [invoice({ id: 'c', clubName: 'FC Sparta', patientName: 'Jana Marková' })] })!;
    expect(group.items[0].detail.startsWith('FC Sparta')).toBe(true);
  });

  it('shows at most five cases but counts all of them', () => {
    const many = Array.from({ length: 9 }, (_, i) => invoice({ id: `i${i}`, invoiceNumber: `FA-${i}` }));
    const group = overdueInvoices({ now: NOW, invoices: many })!;
    expect(group.count).toBe(9);
    expect(group.items).toHaveLength(ITEMS_PER_GROUP);
  });
});

describe('paperworkToday', () => {
  it('lists the standing appointments of today whose paperwork is not ready, soonest first', () => {
    const group = paperworkToday({
      now: NOW,
      patientNames: { p1: 'Jana Marková', p2: 'Anna Černá' },
      todayAppointments: [
        appt({ id: 'late', patientId: 'p2', startUtc: '2026-10-21T13:00:00Z' }),
        appt({ id: 'early', patientId: 'p1', startUtc: '2026-10-21T07:00:00Z' }),
        appt({ id: 'ready', paperwork: { ready: true, missing: [] } }),
        appt({ id: 'unknown', paperwork: null }),
        appt({ id: 'cancelled', status: 4 }),
        appt({ id: 'noshow', status: 5 }),
        appt({ id: 'done', status: 3 }),
        appt({ id: 'waiting', status: 2, patientId: 'p2', startUtc: '2026-10-21T08:30:00Z' }),
      ],
    })!;
    expect(group.items.map((i) => i.id)).toEqual(['appointment-early', 'appointment-waiting', 'appointment-late']);
    expect(group.count).toBe(3);
  });

  it('is nothing when the day is not known, and nothing when all is in order', () => {
    expect(paperworkToday({ now: NOW })).toBeNull();
    expect(paperworkToday({ now: NOW, todayAppointments: [appt({ paperwork: { ready: true, missing: [] } })] })).toBeNull();
  });

  it('sends a missing questionnaire to the booking and a missing document or consent to the patient card', () => {
    const q = paperworkToday({ now: NOW, todayAppointments: [appt({ id: 'q' })] })!;
    expect(q.items[0].to).toBe('/kalendar/k1/termin/q');
    const d = paperworkToday({ now: NOW, todayAppointments: [appt({ id: 'd', paperwork: { ready: false, missing: ['report_missing'] } })] })!;
    expect(d.items[0].to).toBe('/patients/p1/dokumenty');
    const c = paperworkToday({ now: NOW, todayAppointments: [appt({ id: 'c', paperwork: { ready: false, missing: ['consent_missing'] } })] })!;
    expect(c.items[0].to).toBe('/patients/p1/dokumenty');
  });

  it('names the patient when known and never shows an id as a name', () => {
    const group = paperworkToday({ now: NOW, patientNames: { p1: 'Jana Marková' }, todayAppointments: [appt({ id: 'a' }), appt({ id: 'b', patientId: 'p-unknown' })] })!;
    expect(group.items[0].title).toBe('Jana Marková');
    expect(group.items[1].title.startsWith('Termín v')).toBe(true);
    expect(JSON.stringify(group)).not.toContain('p-unknown');
  });

  it('says what is missing in words', () => {
    expect(paperworkWords(['questionnaire_missing', 'consent_missing'])).toBe('dotazník, souhlas');
    expect(paperworkWords(['report_missing', 'registration_incomplete'])).toBe('dokončená registrace, výpis');
    expect(paperworkWords(['something_new'])).toBe('podklady');
    expect(paperworkWords([])).toBe('podklady');
  });
});

describe('expiringDocuments', () => {
  it('lists documents that still stand, soonest to run out first', () => {
    const group = expiringDocuments({
      now: NOW,
      expiring: [
        { patientId: 'p1', patientName: 'Jana', documentName: 'Výpis', validUntil: '2026-11-10' },
        { patientId: 'p2', patientName: 'Anna', documentName: 'Výpis', validUntil: '2026-10-23' },
        { patientId: 'p3', patientName: 'Petr', documentName: 'Výpis', validUntil: '2026-10-01' },
      ],
    })!;
    expect(group.items.map((i) => i.entity?.id)).toEqual(['p2', 'p1']);
    expect(group.items[0].detail).toContain('za 2 dny');
    expect(group.items[0].to).toBe('/patients/p2/dokumenty');
    expect(group.severity).toBe('low');
  });

  it('is nothing without data, or when none is about to run out', () => {
    expect(expiringDocuments({ now: NOW })).toBeNull();
    expect(expiringDocuments({ now: NOW, expiring: [] })).toBeNull();
  });
});

describe('clubInquiries', () => {
  const order = (id: string, status: string, submittedAtUtc: string | null) => ({ id, clubId: `c-${id}`, clubName: `Klub ${id}`, status, totalSeats: 12, submittedAtUtc });

  it('counts only orders a club submitted and nobody answered, oldest first', () => {
    const group = clubInquiries({
      now: NOW,
      clubOrders: [
        order('new', 'Requested', '2026-10-20T10:00:00Z'),
        order('old', 'Requested', '2026-10-15T10:00:00Z'),
        order('invited', 'Invited', null),
        order('confirmed', 'Confirmed', '2026-10-01T10:00:00Z'),
        order('cancelled', 'Cancelled', '2026-10-01T10:00:00Z'),
      ],
    })!;
    expect(group.items.map((i) => i.id)).toEqual(['order-old', 'order-new']);
    expect(group.items[0].to).toBe('/clubs/objednavky');
    expect(group.items[0].state).toEqual({ openOrderId: 'old' });
    expect(group.items[0].entity).toEqual({ kind: 'club', id: 'c-old', label: 'Klub old' });
    expect(group.summary).toContain('6 dní');
  });

  it('is nothing when there is none or the list is not known', () => {
    expect(clubInquiries({ now: NOW })).toBeNull();
    expect(clubInquiries({ now: NOW, clubOrders: [order('x', 'Confirmed', null)] })).toBeNull();
  });
});

describe('intakeReviews', () => {
  it('lists the registrations waiting for a person and links to the queue', () => {
    const group = intakeReviews({
      now: NOW,
      intake: [
        { intakeId: 'b', referenceNumber: 'REG-2', givenName: 'Eva', familyName: 'Nová', submittedAtUtc: '2026-10-21T06:00:00Z' },
        { intakeId: 'a', referenceNumber: 'REG-1', givenName: 'Karel', familyName: 'Starý', submittedAtUtc: '2026-10-18T06:00:00Z' },
      ],
    })!;
    expect(group.items[0].title).toBe('Karel Starý');
    expect(group.items[0].to).toBe('/intake-review');
    expect(group.summary).toContain('3 dny');
    expect(intakeReviews({ now: NOW, intake: [] })).toBeNull();
    expect(intakeReviews({ now: NOW })).toBeNull();
  });
});

describe('failedMessages', () => {
  it('speaks only for a positive count', () => {
    expect(failedMessages({ now: NOW })).toBeNull();
    expect(failedMessages({ now: NOW, failedMessages: null })).toBeNull();
    expect(failedMessages({ now: NOW, failedMessages: 0 })).toBeNull();
    expect(failedMessages({ now: NOW, failedMessages: Number.NaN })).toBeNull();
    const group = failedMessages({ now: NOW, failedMessages: 3 })!;
    expect(group.count).toBe(3);
    expect(group.items[0].title).toBe('3 zprávy se nepodařilo odeslat');
    expect(group.items[0].to).toBe('/system-health');
  });
});

describe('attentionGroups', () => {
  it('orders by severity, then by how many, and drops rules with nothing in them', () => {
    const groups = attentionGroups({
      now: NOW,
      invoices: [invoice({})],
      todayAppointments: [appt({ id: 'a' }), appt({ id: 'b' })],
      clubOrders: [{ id: 'o', clubId: 'c', clubName: 'K', status: 'Requested', totalSeats: 1, submittedAtUtc: null }],
      intake: [],
      failedMessages: 5,
    });
    expect(groups.map((g) => g.id)).toEqual(['paperworkToday', 'overdueInvoices', 'failedMessages', 'clubInquiries']);
    expect(attentionTotal(groups)).toBe(2 + 1 + 5 + 1);
  });

  it('is empty when nothing is known and when everything is fine', () => {
    expect(attentionGroups({ now: NOW })).toEqual([]);
    expect(attentionGroups({ now: NOW, invoices: [], todayAppointments: [], clubOrders: [], intake: [], failedMessages: 0, expiring: [] })).toEqual([]);
  });

  it('puts a deep link on every item', () => {
    const groups = attentionGroups({
      now: NOW,
      invoices: [invoice({})],
      todayAppointments: [appt({})],
      clubOrders: [{ id: 'o', clubId: 'c', clubName: 'K', status: 'Requested', totalSeats: 1, submittedAtUtc: null }],
      intake: [{ intakeId: 'x', referenceNumber: 'R', givenName: 'A', familyName: 'B', submittedAtUtc: '2026-10-20T00:00:00Z' }],
      failedMessages: 1,
      expiring: [{ patientId: 'p1', patientName: 'Jana', documentName: 'Výpis', validUntil: '2026-10-30' }],
    });
    expect(groups).toHaveLength(6);
    for (const g of groups) {
      expect(g.action.to.startsWith('/')).toBe(true);
      for (const item of g.items) expect(item.to.startsWith('/')).toBe(true);
    }
  });
});

describe('daysBetween', () => {
  it('counts whole days between date keys, across a clock change', () => {
    expect(daysBetween('2026-10-01', '2026-10-21')).toBe(20);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('nonsense', '2026-10-26')).toBe(0);
  });
});
