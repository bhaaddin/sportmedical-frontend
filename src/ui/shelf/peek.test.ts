import { describe, expect, it } from 'vitest';
import type { Invoice } from '../../api/billing';
import type { Appointment } from '../../api/bookingContracts';
import type { ClubOrderView } from '../../api/clubOrders';
import type { Club } from '../../api/clubs';
import type { Patient } from '../../api/patients';
import { activityPeek, appointmentPeek, clubPeek, invoicePeek, orderPeek, patientPeek, servicePeek } from './peek';

const NOW = new Date('2026-10-21T08:00:00Z');
/** Czech formatting uses non-breaking spaces; compare what a person reads. */
const plain = (facts: { label: string; value: string }[]) => facts.map((f) => ({ ...f, value: f.value.replace(/\s/g, ' ') }));

const patient: Patient = {
  id: 'p1', firstName: 'Jana', lastName: 'Marková', dateOfBirth: '1990-04-02', sex: 'Female', phone: '+420 777 123 456', email: 'jana@example.com', status: 'Active',
  createdAtUtc: '2026-01-01T00:00:00Z', updatedAtUtc: '2026-01-01T00:00:00Z',
};

describe('patientPeek', () => {
  it('says the year, the phone, the next appointment and the standing - and no full date of birth or e-mail', () => {
    const peek = patientPeek(patient, [{ id: 'a', patientId: 'p1', eventName: 'Kontrola', startTime: '2026-10-24T08:30:00Z', endTime: '2026-10-24T09:00:00Z', status: 'Scheduled', notes: '' }], NOW);
    expect(plain(peek.facts)).toEqual([
      { label: 'Ročník', value: '1990' },
      { label: 'Telefon', value: '+420 777 123 456' },
      { label: 'Příští termín', value: '24. 10. 2026 10:30' },
    ]);
    expect(peek.status).toEqual({ label: 'Aktivní', tone: 'green' });
    const text = JSON.stringify(peek);
    expect(text).not.toContain('1990-04-02');
    expect(text).not.toContain('jana@example.com');
  });

  it('says "žádný" when there is no next appointment, and nothing when the visits are not known', () => {
    expect(patientPeek(patient, [], NOW).facts.find((f) => f.label === 'Příští termín')?.value).toBe('žádný');
    expect(patientPeek(patient, null, NOW).facts.map((f) => f.label)).toEqual(['Ročník', 'Telefon']);
  });

  it('marks an archived patient and leaves out a missing phone', () => {
    const peek = patientPeek({ ...patient, status: 'Archived', phone: undefined }, null, NOW);
    expect(peek.status).toEqual({ label: 'Archivovaný', tone: 'grey' });
    expect(peek.facts.map((f) => f.label)).toEqual(['Ročník']);
  });
});

describe('clubPeek', () => {
  const club: Club = { id: 'c1', name: 'FC Sparta', ico: '12345678', city: 'Praha', contactPerson: 'Karel Trenér', discountPercent: 10, paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01' };

  it('gives at most four facts: contact, city, IČO and a discount', () => {
    const peek = clubPeek(club);
    expect(peek.facts.map((f) => f.label)).toEqual(['Kontakt', 'Město', 'IČO', 'Sleva']);
    expect(peek.facts[3].value).toBe('10 %');
    expect(peek.status?.label).toBe('Aktivní');
  });

  it('leaves out a zero or missing discount and says when a club is not active', () => {
    const peek = clubPeek({ ...club, discountPercent: 0, isActive: false });
    expect(peek.facts.map((f) => f.label)).not.toContain('Sleva');
    expect(peek.status).toEqual({ label: 'Neaktivní', tone: 'grey' });
  });
});

describe('invoicePeek', () => {
  const invoice = (over: Partial<Invoice>): Invoice => ({
    id: 'i1', patientId: 'p1', patientName: 'Jana Marková', invoiceNumber: 'FA-1', status: 'Issued', totalCzk: 1600, paidCzk: 0, remainingCzk: 1600, currency: 'CZK',
    issueDateUtc: '2026-09-01T10:00:00Z', dueDateUtc: '2026-10-01T10:00:00Z', items: [], ...over,
  });

  it('says what it costs, what is left, when it was due and who owes it, and shows Po splatnosti in red', () => {
    const peek = invoicePeek(invoice({}), NOW);
    expect(peek.facts.map((f) => f.label)).toEqual(['Částka', 'Zbývá', 'Splatnost', 'Komu']);
    expect(plain(peek.facts)[0].value).toBe('1 600 Kč');
    expect(peek.facts[2].value).toBe('1. 10. 2026');
    expect(peek.status).toEqual({ label: 'Po splatnosti', tone: 'red' });
  });

  it('leaves out "zbývá" on a paid invoice and prefers the club as the payer', () => {
    const peek = invoicePeek(invoice({ status: 'Paid', remainingCzk: 0, paidCzk: 1600, clubName: 'FC Sparta' }), NOW);
    expect(peek.facts.map((f) => f.label)).toEqual(['Částka', 'Splatnost', 'Komu']);
    expect(peek.facts[2].value).toBe('FC Sparta');
    expect(peek.status?.label).toBe('Zaplaceno');
  });
});

describe('orderPeek, appointmentPeek, servicePeek, activityPeek', () => {
  it('summarises a club order', () => {
    const order = {
      id: 'o1', clubId: 'c1', clubName: 'FC Sparta', serviceName: 'Sportovní prohlídky', status: 'Requested', totalSeats: 12, registered: 5,
      requestedRanges: [{ fromDate: '2026-11-02', toDate: '2026-11-03', dailyFrom: null, dailyTo: null }],
    } as unknown as ClubOrderView;
    const peek = orderPeek(order);
    expect(peek.facts.map((f) => f.value)).toEqual(['FC Sparta', 'Sportovní prohlídky', '5 z 12', '2. 11. 2026 – 3. 11. 2026']);
    expect(peek.status?.tone).toBe('beige');
  });

  it('summarises an appointment: when, činnost, paperwork and price', () => {
    const a = {
      id: 'a1', calendarId: 'k1', patientId: 'p1', activityId: 'x', activityName: 'Kontrola', startUtc: '2026-10-22T08:00:00Z', endUtc: '2026-10-22T08:30:00Z',
      status: 1, paperwork: { ready: false, missing: ['questionnaire_missing'] }, agreedPriceCzk: 1200, listPriceCzk: 1600,
    } as unknown as Appointment;
    const peek = appointmentPeek(a);
    expect(plain(peek.facts)).toEqual([
      { label: 'Kdy', value: '22. 10. 2026 10:00' },
      { label: 'Činnost', value: 'Kontrola' },
      { label: 'Podklady', value: 'něco chybí' },
      { label: 'Cena', value: '1 200 Kč' },
    ]);
    expect(peek.status).toEqual({ label: 'Potvrzeno', tone: 'green' });
  });

  it('summarises a služba and a činnost', () => {
    expect(servicePeek({ id: 's', name: 'Prohlídky', description: '', sortOrder: 0, isActive: true, activities: 3, calendars: 2, colorHex: null }).facts).toEqual([
      { label: 'Činností', value: '3' },
      { label: 'Kalendářů', value: '2' },
    ]);
    expect(activityPeek({ durationMinutes: 30, priceCzk: null, isActive: true }).facts).toEqual([
      { label: 'Délka', value: '30 minut' },
      { label: 'Cena', value: 'bez ceny' },
    ]);
    expect(activityPeek({ durationMinutes: 1, priceCzk: 900, isActive: false }).facts[0].value).toBe('1 minuta');
  });
});
