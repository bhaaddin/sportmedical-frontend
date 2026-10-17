/*
 * Demo fixtures: the prototype's sample data (design/planner-v65.html).
 *
 * THESE ARE NOT PRODUCT DATA. The six categories, their colours, the order's
 * 378 seats and the 18 sample terms exist so that the lab route and the tests
 * have something to draw. Real values come from the API through
 * `PlannerDataSource`; nothing in `components/` or `state/` may import this file.
 */
import type { BaselineSession, ClubProfile, DayMark, OrderDemand, PlannerCategory, PlannerSession } from '../model';

/** Catalogue order of the prototype's `category` object. */
export const demoCategories: PlannerCategory[] = [
  { id: 'medical', name: 'Sportovní prohlídky', shortName: 'Prohlídky', iconKey: 'heart', color: '#00f1dc', subtitle: 'Lékařské vyšetření', slotMinutes: 20 },
  { id: 'vo2', name: 'VO₂max test', shortName: 'VO₂max', iconKey: 'run', color: '#0f94ff', subtitle: 'Zátěžové testy VO₂max', slotMinutes: 45 },
  { id: 'movement', name: 'Pohybová analýza', shortName: 'Pohyb', iconKey: 'run', color: '#9157f2', subtitle: 'Analýza pohybu', slotMinutes: 30 },
  { id: 'fitness', name: 'Kondiční diagnostika', shortName: 'Kondice', iconKey: 'dumbbell', color: '#128ffc', subtitle: 'Testování výkonnosti', slotMinutes: 45 },
  { id: 'physio', name: 'Fyzioterapie', shortName: 'Fyzio', iconKey: 'physio', color: '#ffb124', subtitle: 'Regenerace a prevence', slotMinutes: 30 },
  { id: 'performance', name: 'Výkonnostní testování', shortName: 'Výkon', iconKey: 'gauge', color: '#fe1951', subtitle: 'Výkonnostní testy', slotMinutes: 60 },
];

/** The order, in the deck order of the prototype (`adaptiveDemo.types`). */
export const demoDemands: OrderDemand[] = [
  { categoryId: 'medical', requested: 72, baselinePlanned: 48 },
  { categoryId: 'movement', requested: 32, baselinePlanned: 24 },
  { categoryId: 'fitness', requested: 48, baselinePlanned: 42 },
  { categoryId: 'physio', requested: 24, baselinePlanned: 16 },
  { categoryId: 'vo2', requested: 90, baselinePlanned: 60 },
  { categoryId: 'performance', requested: 112, baselinePlanned: 62 },
];

const t = (
  id: string, date: string, start: string, end: string, categoryId: string, booked: number, capacity: number,
  origin?: 'public',
): PlannerSession => ({ id, date, start, end, categoryId, booked, capacity, showInList: true, ...(origin ? { origin } : {}) });

/** `initialEvents`; v1, p1 and a2 are the prototype's PUBLIC_DEMO_IDS. */
export const demoSessions: PlannerSession[] = [
  t('m1', '2026-11-18', '08:00', '10:00', 'medical', 12, 12),
  t('v1', '2026-11-18', '10:30', '12:00', 'vo2', 8, 8, 'public'),
  t('a1', '2026-11-19', '09:00', '11:00', 'movement', 6, 8),
  t('m2', '2026-11-19', '13:00', '14:30', 'medical', 10, 12),
  t('p1', '2026-11-20', '09:00', '10:00', 'physio', 6, 8, 'public'),
  t('f1', '2026-11-20', '14:00', '16:00', 'fitness', 12, 12),
  t('m3', '2026-11-22', '09:00', '11:00', 'medical', 8, 12),
  t('a2', '2026-11-22', '11:30', '13:00', 'movement', 8, 8, 'public'),
  t('x1', '2026-11-23', '08:00', '10:00', 'performance', 0, 12),
  t('samplePublic02', '2026-11-02', '08:20', '11:20', 'fitness', 1, 4, 'public'),
  t('samplePublic04', '2026-11-04', '12:00', '12:45', 'fitness', 0, 1, 'public'),
  t('samplePublic05', '2026-11-05', '08:45', '09:30', 'fitness', 0, 1, 'public'),
  t('samplePublic06', '2026-11-06', '09:00', '12:00', 'vo2', 2, 4, 'public'),
  t('samplePublic16a', '2026-11-16', '07:00', '08:00', 'medical', 1, 3, 'public'),
  t('samplePublic16b', '2026-11-16', '08:50', '12:30', 'medical', 4, 11, 'public'),
  t('samplePublic17a', '2026-11-17', '11:15', '11:35', 'medical', 0, 1, 'public'),
  t('samplePublic17b', '2026-11-17', '14:00', '14:20', 'medical', 1, 1, 'public'),
  t('samplePublic21', '2026-11-21', '08:00', '10:00', 'performance', 0, 2, 'public'),
];

/** The sessions whose seats are already counted in `OrderDemand.baselinePlanned`. */
export const demoBaseline: BaselineSession[] = demoSessions.map((s) => ({
  id: s.id,
  categoryId: s.categoryId,
  capacity: s.capacity,
  ...(s.origin ? { origin: s.origin } : {}),
}));

/** The prototype starts with an empty profile apart from the name ("Doplnit" everywhere). */
export const demoClubProfile: ClubProfile = {
  clubName: 'RC Mountfield Říčany',
  ico: '', dic: '', address: '',
  leaderName: '', leaderEmail: '', leaderPhone: '',
  contactName: '', contactEmail: '', contactPhone: '',
  logoUrl: null,
};

export const DEMO_CLINIC_NAME = 'SportMedical Diagnostics';
export const DEMO_DAY_BUDGET_MINUTES = 720;

/** Working days Mon-Fri 07:00-19:00 with lunch, weekends without hours, one demo closure. */
export function demoDayMark(date: string, weekdayIndex: number): DayMark {
  if (date === '2026-11-26') return { date, closed: true, label: 'Zavřeno (ukázka)', hours: null, lunch: null };
  if (weekdayIndex >= 5) return { date, closed: false, label: null, hours: null, lunch: null };
  return { date, closed: false, label: null, hours: { from: '07:00', to: '19:00' }, lunch: { from: '12:00', to: '12:30' } };
}
