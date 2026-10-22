/*
 * The merged history of an order group (R14a): which kinds a line belongs to (pinned against the exact wording the backend
 * writes), the merge across the root and its addenda, the order, the links and the filters.
 */
import { describe, expect, it } from 'vitest';
import { toOrder } from '../../../api/clubOrders';
import type { ClubOrderView } from '../../../api/clubOrders';
import { orderCode } from '../../../components/clubs/order/orderFormat';
import {
  buildTimeline,
  classifyHistoryText,
  filterTimeline,
  groupOrderIds,
  HISTORY_KINDS,
  kindCounts,
  type HistoryKind,
} from './historyTimeline';

const ROOT = '80e74a6c-0000-4000-8000-0000000000a1';
const ADD1 = '80e74a6c-0000-4000-8000-0000000000b2';
const ADD2 = '80e74a6c-0000-4000-8000-0000000000c3';

type Line = { atUtc: string; user: string; text: string; visibleToClub?: boolean };

const order = (id: string, history: Line[], extra: Record<string, unknown> = {}): ClubOrderView =>
  toOrder({
    id, groupId: ROOT, clubId: 'club-1', clubName: 'FK Slaný', serviceId: 's-1', serviceName: 'Prohlídky', status: 'Confirmed',
    paymentMethod: 'ClubInvoice', activitySeats: [], totalSeats: 0, registered: 0,
    priceQuote: { listTotalCzk: 0, discounts: [], totalCzk: 0 }, requestedRanges: [], note: '', contact: null,
    createdBy: 'Staff', history, addenda: [], blocks: [], ...extra,
  });

const kindsOf = (text: string): HistoryKind[] => classifyHistoryText(text);

describe('classifyHistoryText - the wording the backend writes', () => {
  it.each([
    ['Objednávka založena. Odkaz na formulář čeká na předání klubu.', ['status']],
    ['Objednávka založena. Odkaz na formulář čeká na předání klubu. Nabídnuto 3 dní.', ['status', 'window']],
    ['Klub odeslal objednávku.', ['status']],
    ['Objednávka zadána recepcí, čeká na zpracování.', ['status']],
    ['Objednávka zadána recepcí a rovnou potvrzena (2 období v kalendáři).', ['status', 'window']],
    ['Objednávka potvrzena, v kalendáři vznikly 2 období.', ['status', 'window']],
    ['Objednávka zrušena.', ['status']],
    ['Objednávka zrušena. Důvod: Klub zrušil soustředění.', ['status']],
    ['Objednávka zrušena, zrušeno 3 rezervací sportovců.', ['status', 'players']],
    ['Objednávka dokončena: poslední okno skončilo.', ['status']],
    ['Objednávka byla zrušena ordinací. Zpráva ordinace: Nepotřebujeme.', ['status', 'message']],
    ['Ordinace potvrdila termíny: 12. 10. 2026 – 13. 10. 2026 (08:00–12:00)', ['status', 'window']],
  ] as [string, HistoryKind[]][])('%s', (text, expected) => {
    expect(kindsOf(text)).toEqual(expected);
  });

  it.each([
    ['Dodatek k objednávce KO-AAAA0001: Fyzio, 4 míst.', ['addendum']],
    ['Přidán dodatek KO-AAAA0002: Fyzio, 4 míst.', ['addendum']],
    ['Dodatek KO-AAAA0002 zrušen. Důvod: Nepotřebujeme.', ['addendum']],
    ['Zrušeno i 2 dodatků: KO-AAAA0002, KO-AAAA0003.', ['addendum']],
    ['Objednávka zrušena spolu s hlavní objednávkou KO-AAAA0001.', ['status', 'addendum']],
    ['Sloučeno do objednávky KO-AAAA0001.', ['addendum']],
    ['Sloučena objednávka KO-AAAA0002: Fyzio, 4 míst.', ['addendum']],
    ['Hlavní objednávka KO-AAAA0001 sloučena do objednávky KO-AAAA0009; dodatek od teď patří k ní.', ['addendum']],
  ] as [string, HistoryKind[]][])('%s', (text, expected) => {
    expect(kindsOf(text)).toEqual(expected);
  });

  it.each([
    ['Počet hráčů změněn: VO2max 10 → 12.', ['players']],
    ['Kvůli změně byly zrušeny rezervace hráčů: 2.', ['players']],
    ['Rezervace hráče Jan Novák (VO2max, 12. 10. 10:00) byla zrušena ordinací.', ['players']],
    ['Objednávka upravena: místa (VO2max 10 → 12); časové bloky (1 přidáno, 1 zrušeno).', ['players', 'window']],
    ['Termín 29. 10. byl zrušen.', ['window']],
    ['Ordinace změnila termíny, nově: 12. 10. 2026', ['window']],
    ['Uvolněno 120 min dne 12. 10. pro veřejnost.', ['window']],
    ['Ordinace uvolnila nevyužitý čas dne 12. 10. (60 min).', ['window']],
    ['Nabídnuté dny upraveny (4 dní).', ['window']],
    ['Zpráva ordinace: Přineste dokumenty.', ['message']],
    ['Vystavena společná faktura 2026-0042 za 2 objednávek skupiny.', ['invoice']],
    ['Vystavena dodatečná faktura 2026-0043 (hlavní objednávka KO-AAAA0001).', ['invoice']],
    ['Objednávka zahrnuta do společné faktury 2026-0042 (hlavní objednávka KO-AAAA0001).', ['invoice']],
    ['Objednávka upravena: platba (nezadáno → ClubInvoice).', ['other']],
    ['Odkazy klubu byly obnoveny, dosavadní odkazy přestaly platit. Nový odkaz je třeba klubu předat.', ['other']],
    ['Něco, co server ještě neumí.', ['other']],
    ['', ['other']],
  ] as [string, HistoryKind[]][])('%s', (text, expected) => {
    expect(kindsOf(text)).toEqual(expected);
  });

  it('never returns an empty list and keeps the chip order', () => {
    for (const text of ['', 'x', 'Objednávka zrušena, zrušeno 3 rezervací sportovců.']) {
      const kinds = classifyHistoryText(text);
      expect(kinds.length).toBeGreaterThan(0);
      expect(kinds).toEqual(HISTORY_KINDS.filter((k) => kinds.includes(k)));
    }
  });
});

describe('buildTimeline', () => {
  const root = order(ROOT, [
    { atUtc: '2026-10-01T08:00:00Z', user: 'Eva', text: 'Objednávka založena. Odkaz na formulář čeká na předání klubu.' },
    { atUtc: '2026-10-02T08:00:00Z', user: 'Eva', text: 'Objednávka potvrzena, v kalendáři vznikly 2 období.', visibleToClub: false },
    { atUtc: '2026-10-05T08:00:00.002Z', user: 'Eva', text: `Přidán dodatek ${orderCode(ADD1)}: Fyzio, 4 míst.` },
    { atUtc: '2026-10-07T08:00:00Z', user: 'Eva', text: `Dodatek ${orderCode(ADD1)} zrušen. Důvod: Nepotřebujeme.` },
    { atUtc: '2026-10-08T09:00:00Z', user: 'Eva', text: 'Vystavena společná faktura 2026-0042 za 2 objednávek skupiny.' },
    { atUtc: '2026-10-09T09:00:00Z', user: 'Eva', text: 'Zpráva ordinace: Přineste doklady.', visibleToClub: true },
  ]);
  const add1 = order(ADD1, [
    { atUtc: '2026-10-05T08:00:00.001Z', user: 'Eva', text: `Dodatek k objednávce ${orderCode(ROOT)}: Fyzio, 4 míst.` },
    { atUtc: '2026-10-07T08:00:00Z', user: 'Eva', text: 'Objednávka zrušena. Důvod: Nepotřebujeme.' },
    { atUtc: '2026-10-07T08:00:00.001Z', user: 'Eva', text: 'Objednávka byla zrušena ordinací. Zpráva ordinace: Nepotřebujeme.', visibleToClub: true },
  ], { parentOrderId: ROOT });
  const add2 = order(ADD2, [
    { atUtc: '2026-10-06T08:00:00Z', user: 'Eva', text: 'Objednávka zrušena spolu s hlavní objednávkou KO-X.' },
    { atUtc: '2026-10-06T08:00:00.001Z', user: 'Eva', text: 'Počet hráčů změněn: Masáž 4 → 6.', visibleToClub: true },
  ], { parentOrderId: ROOT });

  const timeline = buildTimeline({ root, addenda: [add1, add2] });

  it('is one list, newest first, across the root and its addenda', () => {
    const times = timeline.map((e) => Date.parse(e.atUtc));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(timeline[0].text).toBe('Zpráva ordinace: Přineste doklady.');
    expect(timeline.at(-1)!.text).toContain('Objednávka založena');
    expect(new Set(timeline.map((e) => e.orderId))).toEqual(new Set([ROOT, ADD1, ADD2]));
  });

  it('shows the creation of an addendum once (the root says it) and keeps the addendum\'s own cancellation', () => {
    expect(timeline.filter((e) => /^Dodatek k objednávce /.test(e.text))).toHaveLength(0);
    expect(timeline.filter((e) => e.text.startsWith('Přidán dodatek'))).toHaveLength(1);
    expect(timeline.filter((e) => e.text.startsWith('Objednávka zrušena spolu s hlavní'))).toHaveLength(0);
    expect(timeline.some((e) => e.orderId === ADD1 && e.text.startsWith('Objednávka zrušena. Důvod: Nepotřebujeme.'))).toBe(true);
  });

  it('marks which lines are on an addendum, with its code', () => {
    const own = timeline.find((e) => e.orderId === ADD2 && e.text.startsWith('Počet hráčů'))!;
    expect(own.isAddendum).toBe(true);
    expect(own.orderCode).toBe(orderCode(ADD2));
    expect(timeline.find((e) => e.orderId === ROOT)!.isAddendum).toBe(false);
  });

  it('links an addendum line to its order and an invoice line to the invoices', () => {
    const created = timeline.find((e) => e.text.startsWith('Přidán dodatek'))!;
    expect(created.link).toEqual({ kind: 'order', orderId: ADD1, label: `Otevřít ${orderCode(ADD1)}` });
    const cancelledRoot = timeline.find((e) => e.text.startsWith('Dodatek ') && e.text.includes('zrušen.'))!;
    expect(cancelledRoot.link).toMatchObject({ kind: 'order', orderId: ADD1 });
    const invoice = timeline.find((e) => e.kinds.includes('invoice'))!;
    expect(invoice.link).toEqual({ kind: 'billing', label: 'Otevřít faktury' });
    const players = timeline.find((e) => e.text.startsWith('Počet hráčů'))!;
    expect(players.link).toBeNull();
    const message = timeline.find((e) => e.text.startsWith('Zpráva ordinace'))!;
    expect(message.link).toBeNull();
  });

  it('puts undated lines last and keeps equal times in the order they were written', () => {
    const t = buildTimeline({
      root: order(ROOT, [
        { atUtc: '', user: '', text: 'bez času' },
        { atUtc: '2026-10-03T08:00:00Z', user: '', text: 'a' },
        { atUtc: '2026-10-03T08:00:00Z', user: '', text: 'b' },
        { atUtc: 'junk', user: '', text: 'junk' },
      ]),
      addenda: [],
    });
    expect(t.map((e) => e.text)).toEqual(['a', 'b', 'bez času', 'junk']);
  });

  it('copes with an empty group and does not change its input', () => {
    expect(buildTimeline({ root: order(ROOT, []), addenda: [] })).toEqual([]);
    expect(root.history[0].text).toContain('Objednávka založena');
  });

  it('does not list the root twice when it is also among the addenda', () => {
    expect(buildTimeline({ root, addenda: [root] })).toHaveLength(buildTimeline({ root, addenda: [] }).length);
  });
});

describe('filters', () => {
  const root = order(ROOT, [
    { atUtc: '2026-10-01T08:00:00Z', user: '', text: 'Objednávka zrušena, zrušeno 3 rezervací sportovců.' },
    { atUtc: '2026-10-02T08:00:00Z', user: '', text: 'Vystavena společná faktura 2026-0042 za 1 objednávek skupiny.' },
    { atUtc: '2026-10-03T08:00:00Z', user: '', text: 'Zpráva ordinace: Ahoj.', visibleToClub: true },
    { atUtc: '2026-10-04T08:00:00Z', user: '', text: 'Termín 29. 10. byl zrušen.', visibleToClub: true },
  ]);
  const all = buildTimeline({ root, addenda: [] });

  it('no chip shows everything; a chip shows its kind; several chips show any of them', () => {
    expect(filterTimeline(all, 'all', new Set())).toHaveLength(4);
    expect(filterTimeline(all, 'all', new Set<HistoryKind>(['invoice'])).map((e) => e.text)).toEqual(['Vystavena společná faktura 2026-0042 za 1 objednávek skupiny.']);
    expect(filterTimeline(all, 'all', new Set<HistoryKind>(['invoice', 'message']))).toHaveLength(2);
    expect(filterTimeline(all, 'all', new Set<HistoryKind>(['players']))).toHaveLength(1);
  });

  it('a line with two kinds is found under both', () => {
    expect(filterTimeline(all, 'all', new Set<HistoryKind>(['status']))).toHaveLength(1);
    expect(filterTimeline(all, 'all', new Set<HistoryKind>(['players']))[0].kinds).toEqual(['status', 'players']);
  });

  it('the club view keeps only what the club reads, and the chips narrow that further', () => {
    expect(filterTimeline(all, 'club', new Set())).toHaveLength(2);
    expect(filterTimeline(all, 'club', new Set<HistoryKind>(['invoice']))).toHaveLength(0);
    expect(filterTimeline(all, 'club', new Set<HistoryKind>(['window']))).toHaveLength(1);
  });

  it('counts per kind, per view', () => {
    expect(kindCounts(all, 'all')).toMatchObject({ status: 1, players: 1, invoice: 1, message: 1, window: 1, addendum: 0, other: 0 });
    expect(kindCounts(all, 'club')).toMatchObject({ invoice: 0, message: 1, window: 1 });
  });
});

describe('groupOrderIds', () => {
  it('an order with addenda is its own root', () => {
    const r = order(ROOT, [], { addenda: [{ id: ADD1, serviceName: 'x', status: 'Confirmed', totalSeats: 1, registered: 0, totalCzk: 0 }] });
    expect(groupOrderIds(r, undefined)).toEqual([ROOT, ADD1]);
  });

  it('an addendum is read through its root', () => {
    const r = order(ROOT, [], { addenda: [{ id: ADD1, serviceName: 'x', status: 'Confirmed', totalSeats: 1, registered: 0, totalCzk: 0 }, { id: ADD2, serviceName: 'y', status: 'Confirmed', totalSeats: 1, registered: 0, totalCzk: 0 }] });
    const a = order(ADD1, [], { parentOrderId: ROOT });
    expect(groupOrderIds(a, r)).toEqual([ROOT, ADD1, ADD2]);
    expect(groupOrderIds(a, undefined)).toEqual([ADD1]);
  });
});
