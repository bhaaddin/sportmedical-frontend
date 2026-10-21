/*
 * The peek card: three or four facts about an entity, shown when somebody rests on its chip.
 *
 * Two halves. The `*Peek` functions are pure - one entity in, a few words out - and are pinned by tests. `loadPeek` is
 * the lazy half: it asks the application's own api modules (and their shared react-query keys, so a list another
 * screen already holds is not fetched again) and hands the answer to the matching function. Nothing here is fetched
 * until a chip is hovered or focused.
 *
 * What a peek may say: dates, statuses, counts, money and the contact a desk already sees in the register's list. What
 * it never says: a birth number, an insurance number, an address, a diagnosis.
 */
import type { QueryClient } from '@tanstack/react-query';
import { activitiesApi } from '../../api/activities';
import { appointmentsApi } from '../../api/appointments';
import { billingApi, type Invoice } from '../../api/billing';
import { statusName, type Appointment } from '../../api/bookingContracts';
import { clinicServicesApi, type ClinicService } from '../../api/clinicServices';
import { clubOrdersApi, ORDER_STATUS_LABEL, type ClubOrderView } from '../../api/clubOrders';
import { clubsApi, type Club } from '../../api/clubs';
import { documentsApi, type PatientDocument } from '../../api/documents';
import { patientsApi, type Patient } from '../../api/patients';
import { formatCzk } from '../../components/booking/grid/appointmentPrice';
import { rangeLine } from '../../components/clubs/order/orderFormat';
import { ALL_APPOINTMENTS_KEY, fetchAllAppointments } from '../../components/patients/appointmentsSource';
import { summariseVisits, type PatientAppointment } from '../../components/patients/patientActivity';
import type { ChipTone } from '../../components/ui';
import { statusOf } from '../../pages/billing/invoiceView';
import { formatDateOnly, formatPragueDate, formatPragueDateTime, pragueDateKey } from '../../utils/time';
import type { EntityRef } from './entities';
import { PEEK_KEYS } from './peekKeys';
import { APPOINTMENT_STATUS_WORD } from './words';

export { PEEK_KEYS, APPOINTMENT_STATUS_WORD };

export interface PeekFact {
  label: string;
  value: string;
}

export interface Peek {
  facts: PeekFact[];
  status?: { label: string; tone: ChipTone };
}

const DOCUMENT_STATUS_WORD: Record<string, { label: string; tone: ChipTone }> = {
  Pending: { label: 'Čeká na schválení', tone: 'beige' },
  SignedOff: { label: 'Schváleno', tone: 'green' },
  Expired: { label: 'Prošlo', tone: 'red' },
  Superseded: { label: 'Nahrazeno', tone: 'grey' },
  Rejected: { label: 'Zamítnuto', tone: 'red' },
};

const fact = (label: string, value: string | null | undefined): PeekFact[] =>
  value === null || value === undefined || value.trim() === '' ? [] : [{ label, value }];

const plural = (n: number, one: string, few: string, many: string): string => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

/** `nar. 1990`: the year only; the full date of birth is on the card, not on a hover. */
const birthYearOf = (iso: string | undefined): string | null => {
  const year = (iso ?? '').slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
};

/* ───────────────────────────── pure: one entity in, a few facts out ───────────────────────────── */

export function patientPeek(patient: Patient, appointments: readonly PatientAppointment[] | null, now: Date = new Date()): Peek {
  const next = appointments === null ? null : summariseVisits(patient.id, appointments, now).nextAppointment;
  const archived = patient.status === 'Archived';
  return {
    facts: [
      ...fact('Ročník', birthYearOf(patient.dateOfBirth)),
      ...fact('Telefon', patient.phone),
      ...(appointments === null ? [] : fact('Příští termín', next === null ? 'žádný' : formatPragueDateTime(next.startTime))),
    ],
    status: { label: archived ? 'Archivovaný' : 'Aktivní', tone: archived ? 'grey' : 'green' },
  };
}

export function clubPeek(club: Club): Peek {
  return {
    facts: [
      ...fact('Kontakt', club.contactPerson),
      ...fact('Město', club.city),
      ...fact('IČO', club.ico),
      ...fact('Sleva', typeof club.discountPercent === 'number' && club.discountPercent > 0 ? `${club.discountPercent} %` : null),
    ].slice(0, 4),
    status: { label: club.isActive ? 'Aktivní' : 'Neaktivní', tone: club.isActive ? 'green' : 'grey' },
  };
}

export function orderPeek(order: ClubOrderView): Peek {
  const range = order.requestedRanges[0];
  return {
    facts: [
      ...fact('Klub', order.clubName),
      ...fact('Služba', order.serviceName),
      ...fact('Místa', order.totalSeats > 0 ? `${order.registered} z ${order.totalSeats}` : null),
      ...fact('Termín', range === undefined ? null : rangeLine(range)),
    ].slice(0, 4),
    status: {
      label: ORDER_STATUS_LABEL[order.status],
      tone: order.status === 'Confirmed' || order.status === 'Completed' ? 'green' : order.status === 'Cancelled' ? 'red' : order.status === 'Requested' ? 'beige' : 'grey',
    },
  };
}

export function appointmentPeek(a: Appointment): Peek {
  const status = APPOINTMENT_STATUS_WORD[statusName(a.status) ?? ''];
  const paperwork = a.paperwork === null ? null : a.paperwork.ready ? 'v pořádku' : 'něco chybí';
  return {
    facts: [
      ...fact('Kdy', formatPragueDateTime(a.startUtc)),
      ...fact('Činnost', a.activityName),
      ...fact('Podklady', paperwork),
      ...fact('Cena', typeof (a.agreedPriceCzk ?? a.listPriceCzk) === 'number' ? formatCzk((a.agreedPriceCzk ?? a.listPriceCzk) as number) : null),
    ],
    status,
  };
}

export function invoicePeek(invoice: Invoice, now: Date = new Date()): Peek {
  const view = statusOf(invoice, now);
  return {
    facts: [
      ...fact('Částka', formatCzk(invoice.totalCzk)),
      ...fact('Zbývá', invoice.remainingCzk > 0 ? formatCzk(invoice.remainingCzk) : null),
      ...fact('Splatnost', formatDateOnly(pragueDateKey(invoice.dueDateUtc))),
      ...fact('Komu', invoice.clubName ?? invoice.recipientName ?? invoice.patientName ?? null),
    ].slice(0, 4),
    status: view,
  };
}

export function documentPeek(doc: PatientDocument): Peek {
  return {
    facts: [
      ...fact('Druh', doc.templateName ?? doc.specialtyName ?? null),
      ...fact('Nahráno', formatPragueDate(doc.uploadedAt)),
      ...fact('Platí do', doc.expiryAt === undefined ? null : formatDateOnly(pragueDateKey(doc.expiryAt))),
    ],
    status: DOCUMENT_STATUS_WORD[doc.status] ?? undefined,
  };
}

export function servicePeek(service: ClinicService): Peek {
  return {
    facts: [
      ...fact('Činností', String(service.activities)),
      ...fact('Kalendářů', String(service.calendars)),
      ...fact('Popis', service.description === '' ? null : service.description.length > 70 ? `${service.description.slice(0, 69)}…` : service.description),
    ],
    status: { label: service.isActive ? 'Aktivní' : 'Neaktivní', tone: service.isActive ? 'green' : 'grey' },
  };
}

export function activityPeek(activity: { durationMinutes: number; priceCzk: number | null; isActive: boolean }): Peek {
  return {
    facts: [
      ...fact('Délka', `${activity.durationMinutes} ${plural(activity.durationMinutes, 'minuta', 'minuty', 'minut')}`),
      ...fact('Cena', activity.priceCzk === null ? 'bez ceny' : formatCzk(activity.priceCzk)),
    ],
    status: { label: activity.isActive ? 'Aktivní' : 'Neaktivní', tone: activity.isActive ? 'green' : 'grey' },
  };
}

/* ───────────────────────────── lazy: ask the api modules ───────────────────────────── */

const MINUTE = 60_000;

export async function loadPeek(ref: EntityRef, queryClient: QueryClient, now: Date = new Date()): Promise<Peek> {
  switch (ref.kind) {
    case 'patient': {
      const patient = await queryClient.fetchQuery({ queryKey: ['patient', ref.id], queryFn: () => patientsApi.getById(ref.id), staleTime: 5 * MINUTE });
      /* The visits are the same list the register and the card read; if it cannot be had the peek simply has no "next". */
      const appointments = await queryClient
        .fetchQuery({ queryKey: ALL_APPOINTMENTS_KEY, queryFn: fetchAllAppointments, staleTime: MINUTE })
        .catch(() => null);
      return patientPeek(patient, appointments, now);
    }
    case 'club':
      return clubPeek(await queryClient.fetchQuery({ queryKey: ['shelf', 'club', ref.id], queryFn: () => clubsApi.getById(ref.id), staleTime: 5 * MINUTE }));
    case 'order':
      return orderPeek(await queryClient.fetchQuery({ queryKey: ['shelf', 'order', ref.id], queryFn: () => clubOrdersApi.get(ref.id), staleTime: MINUTE }));
    case 'appointment': {
      if (ref.calendarId === undefined) return { facts: [] };
      const calendarId = ref.calendarId;
      return appointmentPeek(await queryClient.fetchQuery({ queryKey: ['shelf', 'appointment', ref.id], queryFn: () => appointmentsApi.get(calendarId, ref.id), staleTime: MINUTE }));
    }
    case 'invoice': {
      const invoices = await queryClient.fetchQuery({ queryKey: PEEK_KEYS.invoices, queryFn: () => billingApi.getInvoices(), staleTime: MINUTE });
      const invoice = invoices.find((i) => i.id === ref.id);
      return invoice === undefined ? { facts: [] } : invoicePeek(invoice, now);
    }
    case 'document': {
      if (ref.patientId === undefined) return { facts: [] };
      const patientId = ref.patientId;
      const docs = await queryClient.fetchQuery({ queryKey: ['shelf', 'documents', patientId], queryFn: () => documentsApi.getPatientDocuments(patientId), staleTime: MINUTE });
      const doc = docs.find((d) => d.id === ref.id);
      return doc === undefined ? { facts: [] } : documentPeek(doc);
    }
    case 'service': {
      const services = await queryClient.fetchQuery({ queryKey: PEEK_KEYS.services, queryFn: () => clinicServicesApi.list(), staleTime: 5 * MINUTE });
      const service = services.find((s) => s.id === ref.id);
      return service === undefined ? { facts: [] } : servicePeek(service);
    }
    case 'activity': {
      const list = await queryClient.fetchQuery({ queryKey: PEEK_KEYS.activities, queryFn: () => activitiesApi.list(), staleTime: 5 * MINUTE });
      const activity = list.activities.find((a) => a.id === ref.id);
      return activity === undefined ? { facts: [] } : activityPeek(activity);
    }
  }
}
