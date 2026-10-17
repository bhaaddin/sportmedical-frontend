/*
 * Test-only: fixtures in the shapes of the application's API clients and a fake `ApiDeps`. Not exported from
 * any barrel. Every number in the tests comes from here, so a test can state the exact result it expects.
 */
import { vi } from 'vitest';
import type { Activity, Appointment, Calendar, DayAppointment, PreviewDay, TimeBlock } from '../../api/bookingContracts';
import type { ClinicService } from '../../api/clinicServices';
import type { ClubBlockAthlete, ClubBlockView } from '../../api/clubBlocks';
import type { ClubOrderView } from '../../api/clubOrders';
import type { Club, ClubSettings } from '../../api/clubs';
import type { CalendarDisplayResponse } from '../../api/displaySettings';
import type { ClinicHoliday } from '../../api/holidays';
import type { PickSession } from '../../components/clubs/order/pickSession';
import type { ApiDeps } from './deps';

export const A_MEDICAL = 'act-medical';
export const A_SPIRO = 'act-spiro';
export const SVC = 'svc-1';
export const CAL_A = 'cal-a';
export const CAL_B = 'cal-b';

export const calendar = (id: string, patch: Partial<Calendar> = {}): Calendar => ({
  id,
  name: id === CAL_A ? 'Ordinace A' : id === CAL_B ? 'Ordinace B' : id,
  color: '#3366cc',
  location: '',
  displayStepMinutes: 30,
  isActive: true,
  sortOrder: 0,
  clinicServiceId: SVC,
  publicMinimumNoticeMinutes: null,
  publicHorizonDays: null,
  publicHoldMinutes: null,
  publicCancellationHours: null,
  ...patch,
});

export const activity = (id: string, patch: Partial<Activity> = {}): Activity => ({
  id,
  name: id === A_MEDICAL ? 'Základní prohlídka' : id === A_SPIRO ? 'Spiroergometrie' : id,
  slug: id,
  durationMinutes: id === A_SPIRO ? 60 : 30,
  color: 'blue',
  publicNote: '',
  isPubliclyBookable: true,
  requiresReportByEmail: false,
  requiresClubSharing: false,
  questionnaireRequirement: 'NotAsked',
  sortOrder: id === A_SPIRO ? 2 : 1,
  isActive: true,
  serviceItemId: null,
  priceCzk: id === A_SPIRO ? 2400 : 1500,
  clinicServiceId: SVC,
  questionnaireDefinitionId: null,
  colorHex: null,
  effectiveColorHex: id === A_SPIRO ? '#aa5500' : '#112233',
  parallelCapacity: 1,
  requiredDocumentTemplateIds: [],
  ...patch,
});

export const service: ClinicService = {
  id: SVC,
  name: 'Sportovní prohlídky',
  description: '',
  sortOrder: 0,
  isActive: true,
  activities: 2,
  calendars: 2,
  colorHex: '#445566',
};

export const display: CalendarDisplayResponse = {
  settings: {
    defaultView: 'week',
    slotMinutes: 30,
    dayStartHour: 7,
    dayEndHour: 19,
    nowLineColor: '#C0392B',
    holidayColor: '#AA0000',
    lunchColor: '#BBBBBB',
    hoverFields: [],
  },
  views: ['day', 'week', 'month'],
  slotLengths: [15, 30, 60],
  defaults: {
    defaultView: 'week',
    slotMinutes: 30,
    dayStartHour: 7,
    dayEndHour: 19,
    nowLineColor: '#C0392B',
    holidayColor: '#AA0000',
    lunchColor: '#BBBBBB',
    hoverFields: [],
  },
};

export const clubSettings: ClubSettings = {
  registrationLinkValidityDays: 14,
  minimumPlayers: null,
  releaseUnusedDaysBefore: 5,
  allowMultiServiceOrders: false,
};

export const club = (patch: Partial<Club> = {}): Club => ({
  id: 'club-1',
  name: 'FK Slaný',
  ico: '12345678',
  dic: 'CZ12345678',
  address: 'Smetanova 1',
  city: 'Slaný',
  postalCode: '274 01',
  contactPerson: 'Eva Malá',
  contactEmail: 'eva@fkslany.cz',
  contactPhone: '777 987 654',
  paymentTermsDays: 14,
  discountPercent: null,
  colorHex: '#2a7f62',
  management: [
    { id: 'm1', fullName: 'Petr Svoboda', role: 'místopředseda', phone: null, email: null, source: 'ares' },
    { id: 'm2', fullName: 'Jan Novák', role: 'předseda', phone: '777 123 456', email: 'jan@fkslany.cz', source: 'ares' },
  ],
  isActive: true,
  createdAt: '2026-10-01T10:00:00Z',
  ...patch,
});

export const preview = (date: string, patch: Partial<PreviewDay> = {}): PreviewDay => ({
  date,
  isOpen: true,
  closedBecause: null,
  startTime: '08:00',
  endTime: '18:00',
  breakStart: '12:00',
  breakEnd: '12:30',
  workerUserId: null,
  workerDisplayName: null,
  isChangedByOverride: false,
  offeredActivityIds: [A_MEDICAL, A_SPIRO],
  ...patch,
});

export const appt = (id: string, patch: Partial<DayAppointment> = {}): DayAppointment => ({
  id,
  calendarId: CAL_A,
  patientId: `p-${id}`,
  activityId: A_MEDICAL,
  activityName: 'Základní prohlídka',
  startUtc: '2026-11-04T08:00:00Z', // 09:00 Prague
  endUtc: '2026-11-04T08:30:00Z',
  status: 1,
  isRunningLate: false,
  checkedInUtc: null,
  paperwork: null,
  patientName: `Pacient ${id}`,
  ...patch,
});

export const athlete = (id: string, startUtc: string, patch: Partial<ClubBlockAthlete> = {}): ClubBlockAthlete => ({
  id,
  name: `Sportovec ${id}`,
  activityName: 'Základní prohlídka',
  startUtc,
  endUtc: startUtc,
  status: 'Booked',
  phone: null,
  activityId: A_MEDICAL,
  ...patch,
});

export const clubBlock = (id: string, patch: Partial<ClubBlockView> = {}): ClubBlockView => ({
  id,
  clubId: 'club-1',
  clubName: 'FK Slaný',
  colorHex: '#2a7f62',
  name: null,
  calendarIds: [CAL_A],
  activityIds: [A_MEDICAL],
  fromDate: '2026-11-23',
  toDate: '2026-11-23',
  dailyFrom: '08:00',
  dailyTo: '18:00',
  playerCount: 20,
  seats: 20,
  registered: 0,
  status: 'Active',
  registrationToken: null,
  registrationUrl: null,
  note: null,
  createdAtUtc: null,
  athletes: [],
  activitySeats: [],
  clubOrderId: 'order-1',
  ...patch,
});

export const timeBlock = (id: string, clubBlockId: string, patch: Partial<TimeBlock> = {}): TimeBlock => ({
  id,
  startUtc: '2026-11-23T07:00:00Z', // 08:00 Prague
  endUtc: '2026-11-23T17:00:00Z', // 18:00 Prague
  reason: '',
  kind: 'club',
  clubBlockId,
  clubId: 'club-9',
  clubName: 'SK Kladno',
  colorHex: '#aa3377',
  ...patch,
});

export const orderView = (patch: Partial<ClubOrderView> = {}): ClubOrderView => ({
  id: '0199c0de-0000-7000-8000-00000000abcd',
  clubId: 'club-1',
  clubName: 'FK Slaný',
  clubColorHex: '#2a7f62',
  serviceId: SVC,
  serviceName: 'Sportovní prohlídky',
  status: 'Confirmed',
  paymentMethod: 'ClubInvoice',
  activitySeats: [{ activityId: A_MEDICAL, activityName: 'Základní prohlídka', durationMinutes: 30, seats: 20, registered: 0, unitPriceCzk: 1500 }],
  totalSeats: 20,
  registered: 0,
  priceQuote: null,
  requestedRanges: [{ fromDate: '2026-11-23', toDate: '2026-11-23', dailyFrom: '08:00', dailyTo: '18:00', activityIds: null }],
  blocks: [clubBlock('block-1')],
  note: '',
  contact: null,
  formToken: '',
  formUrl: 'https://example.test/form/abc',
  portalUrl: 'https://example.test/portal/abc',
  registrationToken: '',
  registrationUrl: '',
  releaseDaysBefore: null,
  effectiveReleaseDaysBefore: 3,
  createdBy: 'Staff',
  createdAtUtc: '2026-10-10T10:00:00Z',
  submittedAtUtc: null,
  confirmedAtUtc: null,
  history: [],
  parentOrderId: null,
  groupId: '0199c0de-0000-7000-8000-00000000abcd',
  addenda: [],
  groupTotals: { totalSeats: 20, registered: 0, listTotalCzk: 30000, discountCzk: 0, totalCzk: 30000 },
  invoiceId: null,
  ...patch,
});

/** The session the calendar's pick mode starts from, for the order above. */
export const editSession = (order = orderView(), patch: Partial<PickSession> = {}): PickSession => ({
  clubId: order.clubId,
  clubName: order.clubName,
  serviceId: order.serviceId ?? '',
  serviceName: order.serviceName,
  activities: [{ activityId: A_MEDICAL, name: 'Základní prohlídka', seats: 20, minutesPerSeat: 30, parallelCapacity: 1 }],
  paymentMethod: 'ClubInvoice',
  note: '',
  editOrder: {
    mode: 'edit',
    orderId: order.id,
    dirty: false,
    requested: [],
    blocks: [{ id: 'block-1', calendarId: CAL_A, range: order.requestedRanges[0]! }],
    firstDate: '2026-11-23',
  },
  ...patch,
});

export const newSession = (patch: Partial<PickSession> = {}): PickSession => {
  const { editOrder: _ignored, ...base } = editSession();
  void _ignored;
  return { ...base, ...patch };
};

export interface FakeState {
  calendars: Calendar[];
  appointments: DayAppointment[];
  blocks: Record<string, TimeBlock[]>;
  clubBlocks: ClubBlockView[];
  previews: (calendarId: string, date: string) => PreviewDay;
  holidays: ClinicHoliday[];
  permissions: string[];
  order: ClubOrderView;
  liveOrders: ClubOrderView[];
  activities: Activity[];
}

export function fakeState(patch: Partial<FakeState> = {}): FakeState {
  return {
    calendars: [calendar(CAL_A), calendar(CAL_B)],
    appointments: [],
    blocks: {},
    clubBlocks: [],
    previews: (_c, date) => preview(date),
    holidays: [],
    permissions: ['bookings.create', 'bookings.edit'],
    order: orderView(),
    liveOrders: [],
    activities: [activity(A_MEDICAL), activity(A_SPIRO)],
    ...patch,
  };
}

export type FakeDeps = { [K in keyof ApiDeps]: ReturnType<typeof vi.fn> & ApiDeps[K] };

export function fakeDeps(state: FakeState = fakeState()): FakeDeps {
  const deps = {
    calendars: vi.fn(async () => state.calendars),
    activities: vi.fn(async () => ({ activities: state.activities, warnings: [] })),
    services: vi.fn(async () => [service]),
    display: vi.fn(async () => display),
    clubSettings: vi.fn(async () => clubSettings),
    clinicName: vi.fn(async () => 'Klinika Test'),
    range: vi.fn(async (from: string, to: string, ids: string[]) =>
      state.appointments.filter((a) => a.startUtc.slice(0, 10) >= from && a.startUtc.slice(0, 10) <= to && (a.calendarId === null || ids.includes(a.calendarId))),
    ),
    blocks: vi.fn(async (calendarId: string) => state.blocks[calendarId] ?? []),
    previews: vi.fn(async (ids: string[], from: string, to: string) => {
      const out = new Map<string, Map<string, PreviewDay>>();
      for (const id of ids) {
        const byDate = new Map<string, PreviewDay>();
        for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
          const date = d.toISOString().slice(0, 10);
          byDate.set(date, state.previews(id, date));
        }
        out.set(id, byDate);
      }
      return out;
    }),
    holidays: vi.fn(async () => state.holidays),
    clubBlocks: vi.fn(async () => state.clubBlocks),
    appointment: vi.fn(async (calendarId: string, id: string) => {
      const row = state.appointments.find((a) => a.id === id && a.calendarId === calendarId);
      if (!row) throw new Error('not found');
      return { ...row, calendarId, patientId: row.patientId, activityName: row.activityName, concurrencyToken: `tok-${row.id}` } as unknown as Appointment;
    }),
    reschedule: vi.fn(async () => undefined),
    order: vi.fn(async () => state.order),
    clubOrders: vi.fn(async () => state.liveOrders),
    createStaffOrder: vi.fn(async () => state.order),
    updateOrder: vi.fn(async () => state.order),
    confirmOrder: vi.fn(async () => state.order),
    inviteClub: vi.fn(async () => state.order),
    club: vi.fn(async () => club()),
    updateClub: vi.fn(async (_id: string, data: Partial<Club>) => club(data)),
    permissions: vi.fn(() => state.permissions),
    invalidate: vi.fn(async () => undefined),
  };
  return deps as unknown as FakeDeps;
}
