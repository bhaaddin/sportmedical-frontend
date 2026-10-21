/*
 * The reservation drawer's term cards, with a činnost's individual bookings folded into ONE card (reviewer 2.2): ten bookings of
 * a komplexní prohlídka are "Komplexní prohlídka ×10", not ten cards. A club window or a lone booking stays its own card (it has
 * a detail of its own to open); the people behind a folded card are listed under it by `RecordFoldRow`.
 */
import { agendaSlotLabel, isBookingTerm, type DayEventCardModel, type PlannerContext } from '../../../model';

export type DrawerCard = DayEventCardModel & { folded?: { people: number; ids: string[] } };

export function foldCards(ctx: Pick<PlannerContext, 'sessions'>, cards: readonly DayEventCardModel[]): DrawerCard[] {
  const sessionOf = new Map(ctx.sessions.map((s) => [s.id, s]));
  const by = new Map<string, DayEventCardModel[]>();
  for (const card of cards) {
    const session = sessionOf.get(card.id);
    if (!session || !isBookingTerm(session)) continue;
    const list = by.get(card.categoryId);
    if (list) list.push(card);
    else by.set(card.categoryId, [card]);
  }
  const out: DrawerCard[] = [];
  const done = new Set<string>();
  for (const card of cards) {
    const members = by.get(card.categoryId);
    const session = sessionOf.get(card.id);
    if (!members || members.length < 2 || !session || !isBookingTerm(session)) {
      out.push(card);
      continue;
    }
    if (done.has(card.categoryId)) continue;
    done.add(card.categoryId);
    const sessions = members.map((m) => sessionOf.get(m.id)!);
    const people = sessions.reduce((n, s) => n + Math.max(0, Number(s.booked) || 0), 0);
    const cap = sessions.reduce((n, s) => n + Math.max(0, Number(s.capacity) || 0), 0);
    const start = sessions.map((s) => s.start).sort()[0]!;
    const end = sessions.map((s) => s.end).sort().at(-1)!;
    const free = Math.max(0, cap - people);
    out.push({
      ...card,
      id: `group:${card.categoryId}`,
      name: `${card.name} ×${people}`,
      timeRange: `${start}–${end}`,
      slotsLabel: `${people} ${agendaSlotLabel(people)}`,
      confirmed: people,
      cap,
      statusText: free > 0 ? `${free} volných` : 'Obsazeno',
      progressPercent: cap > 0 ? Math.round((people / cap) * 100) : 0,
      canAddClub: false,
      canAddPublic: false,
      folded: { people, ids: members.map((m) => m.id) },
    });
  }
  return out;
}
