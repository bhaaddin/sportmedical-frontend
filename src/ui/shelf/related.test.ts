import { describe, expect, it } from 'vitest';
import type { Invoice } from '../../api/billing';
import type { DayAppointment } from '../../api/bookingContracts';
import type { Club } from '../../api/clubs';
import type { PatientDocument } from '../../api/documents';
import { CHIPS_PER_GROUP, invoiceRelatedGroups, patientRelatedGroups } from './related';

const NOW = new Date('2026-10-21T08:00:00Z');

const appt = (over: Partial<DayAppointment>): DayAppointment => ({
  id: 'a1', calendarId: 'k1', patientId: 'p1', activityId: 'x', activityName: 'Kontrola', startUtc: '2026-10-22T09:00:00Z', endUtc: '2026-10-22T09:30:00Z',
  status: 0, isRunningLate: false, checkedInUtc: null, paperwork: null, ...over,
});
const invoice = (over: Partial<Invoice>): Invoice => ({
  id: 'i1', patientId: 'p1', patientName: 'Jana', invoiceNumber: 'FA-1', status: 'Issued', totalCzk: 1000, paidCzk: 0, remainingCzk: 1000, currency: 'CZK',
  issueDateUtc: '2026-10-01T10:00:00Z', dueDateUtc: '2026-11-01T10:00:00Z', items: [], ...over,
});
const doc = (over: Partial<PatientDocument>): PatientDocument => ({ id: 'd1', patientId: 'p1', templateId: 't', templateName: 'Výpis', uploadedAt: '2026-09-01T10:00:00Z', filePath: 'x', status: 'SignedOff', source: 'Staff', ...over } as PatientDocument);
const club = (id: string, name: string): Club => ({ id, name, ico: '1', paymentTermsDays: 14, isActive: true, createdAt: '2026-01-01' });

const groups = (over: Partial<Parameters<typeof patientRelatedGroups>[0]> = {}) =>
  patientRelatedGroups({
    patientId: 'p1',
    now: NOW,
    upcoming: { data: [] },
    invoices: { data: [] },
    documents: { data: [] },
    clubs: { data: [] },
    ...over,
  });
const byId = (list: ReturnType<typeof groups>, id: string) => list.find((g) => g.id === id)!;

describe('patientRelatedGroups', () => {
  it('names the patient\'s next appointments as chips that open the booking, soonest first, and counts the rest', () => {
    const list = groups({
      upcoming: {
        data: [
          appt({ id: 'later', startUtc: '2026-10-30T09:00:00Z' }),
          appt({ id: 'soon', startUtc: '2026-10-22T09:00:00Z' }),
          appt({ id: 'other', patientId: 'p2' }),
          appt({ id: 'past', startUtc: '2026-10-01T09:00:00Z' }),
          appt({ id: 'gone', status: 4 }),
          appt({ id: 'c', startUtc: '2026-11-01T09:00:00Z' }),
          appt({ id: 'd', startUtc: '2026-11-02T09:00:00Z' }),
        ],
      },
    });
    const g = byId(list, 'appointments');
    expect(g.status).toBe('ready');
    expect(g.total).toBe(4);
    expect(g.entities).toHaveLength(CHIPS_PER_GROUP);
    expect(g.entities.map((e) => e.id)).toEqual(['soon', 'later', 'c']);
    expect(g.entities[0]).toMatchObject({ kind: 'appointment', calendarId: 'k1' });
    expect(g.viewAll?.to).toBe('/patients/p1/terminy');
  });

  it('turns an empty relation into the next action', () => {
    const g = byId(groups(), 'appointments');
    expect(g.total).toBe(0);
    expect(g.emptyAction).toMatchObject({ label: 'Objednat termín', to: '/planovani' });
    expect(g.emptyAction?.state).toMatchObject({ patientId: 'p1' });
  });

  it('lists open invoices first, then newest', () => {
    const g = byId(
      groups({
        invoices: {
          data: [
            invoice({ id: 'paid-new', status: 'Paid', remainingCzk: 0, invoiceNumber: 'FA-PAID', issueDateUtc: '2026-10-10T10:00:00Z' }),
            invoice({ id: 'open-old', invoiceNumber: 'FA-OPEN', issueDateUtc: '2026-08-10T10:00:00Z' }),
          ],
        },
      }),
      'invoices',
    );
    expect(g.entities.map((e) => e.id)).toEqual(['open-old', 'paid-new']);
    expect(g.entities[0].label).toBe('FA-OPEN');
  });

  it('hides a group the person may not see instead of saying "no invoices"', () => {
    const list = groups({ invoices: { hidden: true } });
    expect(list.map((g) => g.id)).not.toContain('invoices');
  });

  it('says loading and error rather than "none" while it cannot know', () => {
    expect(byId(groups({ invoices: { loading: true } }), 'invoices').status).toBe('loading');
    expect(byId(groups({ documents: { data: null } }), 'documents').status).toBe('loading');
    expect(byId(groups({ upcoming: { error: true } }), 'appointments').status).toBe('error');
  });

  it('names documents by their template, newest first, leaving out superseded ones, each bound to its patient', () => {
    const g = byId(
      groups({
        documents: {
          data: [
            doc({ id: 'old', uploadedAt: '2026-01-01T10:00:00Z', templateName: 'Souhlas' }),
            doc({ id: 'new', uploadedAt: '2026-09-01T10:00:00Z', templateName: 'Výpis' }),
            doc({ id: 'gone', status: 'Superseded' }),
            doc({ id: 'report', templateName: undefined, templateId: null, specialtyName: 'Kardiologie', uploadedAt: '2026-05-01T10:00:00Z' }),
          ],
        },
      }),
      'documents',
    );
    expect(g.entities.map((e) => e.id)).toEqual(['new', 'report', 'old']);
    expect(g.entities.map((e) => e.label)).toEqual(['Výpis', 'Kardiologie', 'Souhlas']);
    expect(g.entities[0].patientId).toBe('p1');
  });

  it('finds the club from the partner on the bookings, only when the name belongs to exactly one club', () => {
    const list = groups({
      upcoming: { data: [appt({ id: 'a', partnerName: 'FC Sparta' }), appt({ id: 'b', partnerName: 'FC Sparta' }), appt({ id: 'c', partnerName: 'Neznámý tým' }), appt({ id: 'd', partnerName: 'Dvojník' })] },
      clubs: { data: [club('c1', 'FC Sparta'), club('c2', 'Dvojník'), club('c3', 'Dvojník')] },
    });
    const g = byId(list, 'clubs');
    expect(g.entities).toEqual([{ kind: 'club', id: 'c1', label: 'FC Sparta' }]);
    expect(g.notes.sort()).toEqual(['Dvojník', 'Neznámý tým']);
    expect(g.total).toBe(3);
  });

  it('has no club for a patient without a partner on any booking', () => {
    const g = byId(groups({ upcoming: { data: [appt({})] } }), 'clubs');
    expect(g.total).toBe(0);
    expect(g.viewAll).toBeUndefined();
  });
});

describe('invoiceRelatedGroups', () => {
  it('connects an invoice to its patient, its appointment, its club and its payments', () => {
    const list = invoiceRelatedGroups({
      invoice: { id: 'i1', patientId: 'p1', patientName: 'Jana Marková', appointmentId: 'a1', clubId: 'c1', clubName: 'FC Sparta', paidCzk: 100, payments: [{ id: 'x', amountCzk: 100, method: 'Cash', paidAtUtc: '2026-10-01T10:00:00Z' }] },
    });
    expect(list.find((g) => g.id === 'patient')?.entities).toEqual([{ kind: 'patient', id: 'p1', label: 'Jana Marková' }]);
    expect(list.find((g) => g.id === 'appointment')?.entities[0]).toMatchObject({ kind: 'appointment', id: 'a1' });
    expect(list.find((g) => g.id === 'club')?.entities).toEqual([{ kind: 'club', id: 'c1', label: 'FC Sparta' }]);
    expect(list.find((g) => g.id === 'payments')?.notes).toEqual(['1 platba']);
  });

  it('says what an unconnected invoice is not connected to', () => {
    const list = invoiceRelatedGroups({ invoice: { id: 'i1', patientId: '', patientName: '', paidCzk: 0 } });
    expect(list.map((g) => g.total)).toEqual([0, 0, 0, 0]);
    expect(list.find((g) => g.id === 'club')?.empty).toBe('Platí pacient, ne klub.');
  });
});
