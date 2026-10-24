/*
 * "Související" - what one thing is connected to, as pure functions over lists the application already reads.
 *
 *   a patient   termíny (the booking window), faktury, dokumenty, klub (from the partner on their bookings)
 *   an invoice  pacient, termín, klub, platby
 *
 * Each group says how many there are, names the first few as `EntityRef`s (they become connected chips), and says where
 * "zobrazit vše" goes and what to do when there are none - so an empty relation is a next action, not a blank. A source
 * the person may not see (no `billing.manage`) is `hidden`: not "žádné faktury", which would be a claim nobody checked.
 *
 * Consents are not here: they are a line of their own (`ConsentLine`), drawn beside these.
 */
import type { DayAppointment } from '../../api/bookingContracts';
import { isTerminalStatus } from '../../api/bookingContracts';
import type { Invoice } from '../../api/billing';
import type { Club } from '../../api/clubs';
import type { ClubOrderView } from '../../api/clubOrders';
import type { PatientDocument } from '../../api/documents';
import { shortDayTime } from '../../components/patients/patientActivity';
import { isOpen } from '../../pages/billing/invoiceView';
import type { EntityRef } from './entities';

/** A list a group is built from: what it is now, and whether it can be known at all. */
export interface Source<T> {
  data?: readonly T[] | null;
  loading?: boolean;
  error?: boolean;
  /** The person may not see this list (a permission): the group is not drawn. */
  hidden?: boolean;
}

export interface RelatedGroup {
  id: string;
  title: string;
  status: 'ready' | 'loading' | 'error' | 'hidden';
  /** How many in all. */
  total: number;
  /** The first few, named. */
  entities: EntityRef[];
  /** Names that are known but cannot be linked (no id to open). */
  notes: string[];
  viewAll?: { to: string; state?: Record<string, unknown> };
  /** Said when `total` is 0. */
  empty: string;
  emptyAction?: { label: string; to: string; state?: Record<string, unknown> };
}

/** How many chips one group names; the rest are behind "zobrazit vše". */
export const CHIPS_PER_GROUP = 3;

function statusOf<T>(source: Source<T>): RelatedGroup['status'] {
  if (source.hidden === true) return 'hidden';
  if (source.error === true) return 'error';
  if (source.loading === true || source.data === undefined || source.data === null) return 'loading';
  return 'ready';
}

const base = (id: string, title: string, source: Source<unknown>, empty: string): RelatedGroup => ({
  id, title, status: statusOf(source), total: 0, entities: [], notes: [], empty,
});

export function patientRelatedGroups(input: {
  patientId: string;
  now?: Date;
  /** The booking window from today (every calendar this account may see). */
  upcoming: Source<DayAppointment>;
  invoices: Source<Invoice>;
  documents: Source<PatientDocument>;
  clubs: Source<Club>;
}): RelatedGroup[] {
  const { patientId } = input;
  const now = (input.now ?? new Date()).getTime();
  const me = `/patients/${encodeURIComponent(patientId)}`;

  /* Termíny */
  const appointments = base('appointments', 'Termíny', input.upcoming, 'Žádný termín v příštích dnech.');
  const mine = (input.upcoming.data ?? [])
    .filter((a) => a.patientId === patientId && !isTerminalStatus(a.status) && Date.parse(a.startUtc) >= now)
    .sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc));
  appointments.total = mine.length;
  appointments.entities = mine.slice(0, CHIPS_PER_GROUP).map((a) => ({
    kind: 'appointment' as const,
    id: a.id,
    label: `${shortDayTime(a.startUtc)} · ${a.activityName}`,
    ...(a.calendarId !== null ? { calendarId: a.calendarId } : {}),
  }));
  appointments.viewAll = { to: `${me}/terminy` };
  appointments.emptyAction = { label: 'Objednat termín', to: '/planovani', state: { newAppointment: now, patientId } };

  /* Faktury */
  const invoices = base('invoices', 'Faktury', input.invoices, 'Zatím žádná faktura.');
  const sorted = [...(input.invoices.data ?? [])].sort(
    (a, b) => Number(isOpen(b)) - Number(isOpen(a)) || Date.parse(b.issueDateUtc) - Date.parse(a.issueDateUtc),
  );
  invoices.total = sorted.length;
  invoices.entities = sorted.slice(0, CHIPS_PER_GROUP).map((i) => ({ kind: 'invoice' as const, id: i.id, label: i.invoiceNumber }));
  invoices.viewAll = { to: `${me}/faktury` };

  /* Dokumenty */
  const documents = base('documents', 'Dokumenty', input.documents, 'Zatím žádný dokument.');
  const docs = [...(input.documents.data ?? [])]
    .filter((d) => d.status !== 'Superseded')
    .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));
  documents.total = docs.length;
  documents.entities = docs.slice(0, CHIPS_PER_GROUP).map((d) => ({
    kind: 'document' as const, id: d.id, label: d.templateName ?? d.specialtyName ?? 'Dokument', patientId,
  }));
  documents.viewAll = { to: `${me}/dokumenty` };

  /* Klub: the partner a booking is made under is the club's name; only an exact name with one club behind it is linked. */
  const clubsGroup = base('clubs', 'Klub', input.upcoming.hidden === true ? { hidden: true } : { data: input.upcoming.data }, 'Žádný klub u nadcházejících termínů.');
  const partnerNames = [...new Set(mine.map((a) => a.partnerName).filter((n): n is string => typeof n === 'string' && n.trim() !== ''))];
  const known = input.clubs.data ?? [];
  for (const name of partnerNames) {
    const matches = known.filter((c) => c.name === name);
    if (matches.length === 1) clubsGroup.entities.push({ kind: 'club', id: matches[0].id, label: matches[0].name });
    else clubsGroup.notes.push(name);
  }
  clubsGroup.total = partnerNames.length;
  clubsGroup.viewAll = partnerNames.length > 0 ? { to: '/clubs' } : undefined;
  return [appointments, invoices, documents, clubsGroup].filter((g) => g.status !== 'hidden');
}

export function invoiceRelatedGroups(input: {
  invoice: Pick<Invoice, 'id' | 'patientId' | 'patientName' | 'appointmentId' | 'clubId' | 'clubName' | 'payments' | 'paidCzk'>;
}): RelatedGroup[] {
  const { invoice } = input;
  const ready = { data: [] as unknown[] };
  const groups: RelatedGroup[] = [];

  const patient = base('patient', 'Pacient', ready, 'Faktura nemá pacienta.');
  if (invoice.patientId !== '' && invoice.patientName !== null && invoice.patientName !== undefined && invoice.patientName !== '') {
    patient.total = 1;
    patient.entities = [{ kind: 'patient', id: invoice.patientId, label: invoice.patientName }];
  }
  groups.push(patient);

  const appointment = base('appointment', 'Termín', ready, 'Faktura nevznikla z termínu.');
  if (invoice.appointmentId !== null && invoice.appointmentId !== undefined && invoice.appointmentId !== '') {
    appointment.total = 1;
    appointment.entities = [{ kind: 'appointment', id: invoice.appointmentId, label: 'Termín této faktury' }];
  }
  groups.push(appointment);

  const club = base('club', 'Klub', ready, 'Platí pacient, ne klub.');
  if (invoice.clubId !== null && invoice.clubId !== undefined && invoice.clubId !== '' && invoice.clubName) {
    club.total = 1;
    club.entities = [{ kind: 'club', id: invoice.clubId, label: invoice.clubName }];
  }
  groups.push(club);

  const payments = base('payments', 'Platby', ready, 'Zatím nic nezaplaceno.');
  payments.total = invoice.payments?.length ?? 0;
  payments.notes = payments.total > 0 ? [`${payments.total} ${payments.total === 1 ? 'platba' : payments.total < 5 ? 'platby' : 'plateb'}`] : [];
  groups.push(payments);

  return groups;
}

/**
 * A club order (S-4, the order's detail): its club, its invoice (hidden for a person who may not bill) and its players
 * (how many are registered of the seats, "zobrazit vše" = the club's players). Everything is on the order itself: no read.
 */
export function clubOrderRelatedGroups(input: {
  order: Pick<ClubOrderView, 'clubId' | 'clubName' | 'invoiceId' | 'paymentMethod' | 'registered' | 'totalSeats'>;
  /** The invoice's number when it is known (the invoice draft lists it); otherwise the chip says "Faktura". */
  invoiceNumber?: string | null;
  mayBill: boolean;
}): RelatedGroup[] {
  const { order } = input;
  const ready = { data: [] as unknown[] };

  const club = base('club', 'Klub', ready, 'Objednávka nemá klub.');
  if (order.clubId !== '' && order.clubName !== '') {
    club.total = 1;
    club.entities = [{ kind: 'club', id: order.clubId, label: order.clubName }];
  }

  const invoice = base('invoice', 'Faktura', input.mayBill ? ready : { hidden: true },
    order.paymentMethod === 'PerPerson' ? 'Platí se po osobách, faktura klubu nevzniká.' : 'Zatím nevyfakturováno.');
  if (order.invoiceId !== null && order.invoiceId !== '') {
    invoice.total = 1;
    invoice.entities = [{ kind: 'invoice', id: order.invoiceId, label: input.invoiceNumber || 'Faktura' }];
  }

  const players = base('players', 'Hráči', ready, order.totalSeats > 0 ? `Zatím se nikdo nezapsal (0 z ${order.totalSeats} míst).` : 'Objednávka zatím nemá místa.');
  players.total = order.registered;
  players.notes = order.registered > 0 ? [`${order.registered} z ${order.totalSeats} míst`] : [];
  players.viewAll = { to: `/clubs/hraci?clubId=${encodeURIComponent(order.clubId)}` };

  return [club, invoice, players].filter((g) => g.status !== 'hidden');
}
