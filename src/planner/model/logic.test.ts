/*
 * Hand-pinned numbers for the model functions the golden test (golden.test.ts) cannot reach
 * because the prototype keeps them inside DOM handlers: the mini-calendar interaction rules,
 * the carousel arithmetic, the reservation drawer, the smart editor, dialog models and the
 * overlay geometry. Every expected value is derived from the prototype's formulas, on the
 * prototype's own fixtures (`demoFixtures.ts`).
 */
import { describe, expect, it } from 'vitest';
import {
  demoBaseline, demoCategories, demoClubProfile, demoDemands, demoSessions,
} from '../data/demoFixtures';
import {
  activePlanHint, addBooking, addDays, addMonths, agendaDetailModel, agendaFullListModel, agendaPanelModel,
  automaticCapacityText, beginPlacement, bookingBreakdown, canSelectForPlanning, cardVisibility, carouselModel,
  clampCarouselIndex, clubOccupancyModel, completionCalloutModel, contactReady, createFromDialog, dayIndexInWeek,
  deleteSession, emailDraft, finishPlanModel, formPreviewRows, hasAnyClubData, headerValues, initialMiniState,
  isInsideSafeCorridor, makeContext, mondayOf, miniDayClickPlan, miniHoverPlan, miniOpenTimerValid, miniReduce,
  miniTooltipTop, miniZoomFocus, minutesAsTime, monthCells, monthStartOf, moveConfirmModel, newEventDefaults,
  notificationsModel, orderCommandModel, orderDetailsModel, placementOverlay, planToastCaption, previewedCardFigures,
  previewedOrderCommand, previewedSummary, publicEventDetailModel, publishModel, releaseDay, reservationDrawerModel,
  resizeOverlay, moveOverlay, selectionFromPointer, smartEditBooked, smartEditIsLegacy, smartEditInitialDraft,
  smartEditReduce, smartEditValidation, smartEditViewModel, snapCarouselIndex, summaryDetailLine, summaryExperienceModel,
  termChangeImpact, timeAsMinutes, weekNumberLabel, weekRangeLabel, dayTooltipModel, searchTerms,
  type ClubProfile, type PlannerContext, type PlannerSession,
} from './index';
import { proposalForMove, proposalForTermExpansion } from './edit';

const TODAY = '2026-11-10';
const ctxWith = (sessions: PlannerSession[] = demoSessions, extra: Partial<PlannerContext> = {}): PlannerContext =>
  makeContext({
    categories: demoCategories, demands: demoDemands, baselineSessions: demoBaseline, sessions, today: TODAY, ...extra,
  });
const base = ctxWith();
const club = (id: string, date: string, start: string, end: string, categoryId: string, capacity: number, extra: Partial<PlannerSession> = {}): PlannerSession =>
  ({ id, date, start, end, categoryId, capacity, booked: 0, showInList: true, createdByPlanner: true, ...extra });

describe('dates', () => {
  it('moves by days and months without drifting over a DST change', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01');
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
    expect(mondayOf('2026-11-22')).toBe('2026-11-16');
    expect(mondayOf('2026-11-16')).toBe('2026-11-16');
    expect(monthStartOf('2026-11-20')).toBe('2026-11-01');
  });
  it('indexes a day in its week even across the spring DST change (the prototype floors a 143 h gap to day 5)', () => {
    expect(dayIndexInWeek('2027-03-22', '2027-03-28')).toBe(6);
    expect(dayIndexInWeek('2026-11-16', '2026-11-18')).toBe(2);
    expect(dayIndexInWeek('2026-11-16', '2026-11-25')).toBe(9);
  });
  it('builds the 42 cells and the headings', () => {
    const cells = monthCells('2026-11-01');
    expect(cells).toHaveLength(42);
    expect(cells[0]).toBe('2026-10-26');
    expect(cells[41]).toBe('2026-12-06');
    expect(weekRangeLabel('2026-11-30')).toBe('30. 11. – 6. 12. 2026');
    expect(weekRangeLabel('2026-12-28')).toBe('28. 12. – 3. 1. 2027');
    expect(weekNumberLabel('2026-11-16')).toBe('47. týden');
    expect(timeAsMinutes('9:00')).toBeNaN();
    expect(minutesAsTime(75)).toBe('01:15');
  });
});

describe('reservations', () => {
  it('splits the occupancy bar', () => {
    const parts = bookingBreakdown({ club: 12, publicCount: 6, held: 0, free: 2, slots: 20 });
    expect(parts.map((p) => [p.label, p.count, p.widthPercent])).toEqual([
      ['Klub potvrzen', 12, 60], ['Jednotlivci potvrzeni', 6, 30], ['Drženo pro klub', 0, 0], ['Veřejně volná místa', 2, 10],
    ]);
    expect(bookingBreakdown({ club: 0, publicCount: 0, held: 0, free: 0, slots: 0 }).every((p) => p.widthPercent === 0)).toBe(true);
  });
  it('builds the drawer for a day with a held club block', () => {
    const ctx = ctxWith([...demoSessions, club('h1', '2026-11-30', '09:00', '10:00', 'medical', 10, { booked: 3 })]);
    const d = reservationDrawerModel(ctx, '2026-11-30');
    expect(d.summary).toMatchObject({ slots: 10, club: 3, held: 7, free: 0, confirmed: 3, percent: 30 });
    expect(d.release).toMatchObject({ pending: true, cutoff: '2026-11-23', cutoffLabel: '23. 11.' });
    expect(d.release.before).toBe('Neobsazená klubová místa se 7 dní před termínem (');
    expect(d.hasPendingHold).toBe(true);
    expect(d.title).toBe('Pondělí, 30. 11.');
    expect(d.cards[0]).toMatchObject({ tag: 'KLUBOVÝ TERMÍN', statusText: '🔒 7 pro klub', canAddClub: true, canAddPublic: false, progressPercent: 30 });
    expect(d.heroText).toBe('Potvrzené rezervace konkrétních osob. Naplánovaných 1 h z referenční kapacity 12 h (8 %).');
    const full = reservationDrawerModel(ctx, '2026-11-18');
    expect(full.release.pending).toBe(false);
    expect(full.confirmedPercent).toBe(100);
    expect(full.timing.map((t) => [t.name, t.duration, t.slotsLabel])).toEqual([
      ['Sportovní prohlídky', '2 h', '12 slotů'], ['VO₂max test', '1 h 30 min', '8 slotů'],
    ]);
  });
  it('adds a booking only where the rules allow it, and releases a day', () => {
    const sessions = [club('h1', '2026-11-30', '09:00', '10:00', 'medical', 10, { booked: 3 }), ...demoSessions];
    const added = addBooking(sessions, 'h1', 'club', TODAY);
    expect(added.ok).toBe(true);
    expect(added.sessions.find((s) => s.id === 'h1')).toMatchObject({ clubBooked: 4, publicBooked: 0, booked: 4 });
    expect(added.message).toBe('Demo: přidána rezervace sportovce klubu');
    // individuals can only take a FREE place: none while the club holds the rest
    expect(addBooking(sessions, 'h1', 'public', TODAY).ok).toBe(false);
    // a public term has no club places
    expect(addBooking(sessions, 'v1', 'club', TODAY).ok).toBe(false);
    const released = releaseDay(sessions, '2026-11-30');
    expect(released.sessions.find((s) => s.id === 'h1')?.released).toBe(true);
    expect(addBooking(released.sessions, 'h1', 'public', TODAY).ok).toBe(true);
  });
  it('lists the club occupancy', () => {
    const m = clubOccupancyModel(base, { clubName: 'Klub' }, '2026-11-20');
    expect(m.termCount).toBe(6);
    expect(m.totals).toEqual({ capacity: 68, club: 48, publicCount: 0, held: 20, free: 0 });
    const f1 = m.rows.find((r) => r.id === 'f1')!;
    expect(f1).toMatchObject({ dateLabel: '20. 11.', clubLabel: '12 / 12', focused: true, note: 'Obsazeno', progressPercent: 100 });
  });
});

describe('mini-calendar interaction', () => {
  it('decides what hover does', () => {
    const m = initialMiniState;
    expect(miniHoverPlan({ ...m, pinnedDate: '2026-11-18' }, '2026-11-19', true, false)).toEqual({ kind: 'ignore' });
    expect(miniHoverPlan(m, '2026-11-19', true, true)).toEqual({ kind: 'ignore' });
    expect(miniHoverPlan(m, '2026-11-19', true, false)).toEqual({ kind: 'hover', zoomNow: true, timer: { delayMs: 120, then: 'open' } });
    expect(miniHoverPlan(m, '2026-11-19', false, false)).toEqual({ kind: 'hover', zoomNow: true, timer: null });
    const open = { ...m, openDate: '2026-11-18' };
    expect(miniHoverPlan(open, '2026-11-18', true, false)).toEqual({ kind: 'hover', zoomNow: true, timer: null });
    expect(miniHoverPlan(open, '2026-11-19', true, false)).toEqual({ kind: 'hover', zoomNow: false, timer: { delayMs: 245, then: 'open' } });
    expect(miniHoverPlan(open, '2026-11-24', false, false)).toEqual({ kind: 'hover', zoomNow: false, timer: { delayMs: 245, then: 'closeFlyout' } });
  });
  it('runs the timers only while they are still valid', () => {
    expect(miniOpenTimerValid({ ...initialMiniState, hoverCandidate: '2026-11-18' }, '2026-11-18', false)).toBe(true);
    expect(miniOpenTimerValid({ ...initialMiniState, hoverCandidate: '2026-11-19' }, '2026-11-18', false)).toBe(false);
    expect(miniOpenTimerValid({ ...initialMiniState, hoverCandidate: '2026-11-18', pinnedDate: '2026-11-20' }, '2026-11-18', false)).toBe(false);
    expect(miniOpenTimerValid({ ...initialMiniState, hoverCandidate: '2026-11-18' }, '2026-11-18', true)).toBe(false);
  });
  it('walks through hover, pin, unpin and hide', () => {
    let m = initialMiniState;
    m = miniReduce(m, { type: 'hoverCandidate', date: '2026-11-18', zoomNow: true });
    expect(m).toMatchObject({ hoverCandidate: '2026-11-18', zoomHoveredDate: '2026-11-18' });
    m = miniReduce(m, { type: 'openFlyout', date: '2026-11-18', pinned: false });
    expect(m).toMatchObject({ openDate: '2026-11-18', zoomHoveredDate: '2026-11-18', pinnedDate: null, hoverCandidate: null });
    m = miniReduce(m, { type: 'openFlyout', date: '2026-11-18', pinned: true });
    expect(m).toMatchObject({ pinnedDate: '2026-11-18', zoomHoveredDate: null });
    expect(miniDayClickPlan(m, '2026-11-18', true)).toBe('unpin');
    expect(miniDayClickPlan(m, '2026-11-19', true)).toBe('pinWithFlyout');
    expect(miniDayClickPlan(m, '2026-11-19', false)).toBe('pinEmptyAndSelect');
    m = miniReduce(m, { type: 'unpin', date: '2026-11-18' });
    expect(m).toMatchObject({ pinnedDate: null, zoomHoveredDate: '2026-11-18', openDate: '2026-11-18' });
    expect(miniReduce(m, { type: 'closeFlyoutKeepZoom' })).toMatchObject({ openDate: null, zoomHoveredDate: '2026-11-18' });
    expect(miniReduce(m, { type: 'hide' })).toEqual(initialMiniState);
  });
  it('knows which day has the zoom focus', () => {
    const dates = ['2026-11-18', '2026-11-19'];
    expect(miniZoomFocus(initialMiniState, dates).zoomState).toBe('neutral');
    expect(miniZoomFocus({ ...initialMiniState, zoomHoveredDate: '2026-11-19' }, dates)).toMatchObject({ zoomState: 'hover', focusDate: '2026-11-19', isPinned: false });
    expect(miniZoomFocus({ ...initialMiniState, pinnedDate: '2026-11-18', zoomHoveredDate: '2026-11-19' }, dates)).toMatchObject({ zoomState: 'pinned', focusDate: '2026-11-18' });
    expect(miniZoomFocus({ ...initialMiniState, pinnedDate: '2026-12-31' }, dates).zoomState).toBe('neutral');
  });
  it('places the flyout and keeps a safe corridor to it', () => {
    expect(miniTooltipTop(100)).toBe(164);
    expect(miniTooltipTop(300)).toBe(215);
    expect(miniTooltipTop(900)).toBe(495);
    const src = { left: 100, right: 150, top: 200, bottom: 250 };
    const dest = { left: 400, right: 700, top: 150, bottom: 450 };
    const opts = { tipVisible: true, pinned: false };
    expect(isInsideSafeCorridor(200, 225, src, dest, opts)).toBe(true);
    expect(isInsideSafeCorridor(200, 400, src, dest, opts)).toBe(false);
    expect(isInsideSafeCorridor(390, 440, src, dest, opts)).toBe(true); // funnel has widened to the popup
    expect(isInsideSafeCorridor(90, 225, src, dest, opts)).toBe(false);
    expect(isInsideSafeCorridor(200, 225, src, dest, { tipVisible: false, pinned: false })).toBe(false);
    expect(isInsideSafeCorridor(200, 225, src, dest, { tipVisible: true, pinned: true })).toBe(false);
  });
  it('builds the flyout model of a day', () => {
    expect(dayTooltipModel(base, '2026-11-25', false)).toBeNull();
    const m = dayTooltipModel(base, '2026-11-19', true)!;
    expect(m.pinned).toBe(true);
    expect(m.heading).toBe('Čtvrtek 19. 11.');
    expect(m.stats).toEqual({ terms: 2, slots: 20, plannedTime: '3 h 30 min' });
  });
});

describe('carousel', () => {
  it('pages two cards at a time', () => {
    const six = carouselModel(6, 0);
    expect(six).toMatchObject({ mode: 'mode-scroll', showNavigation: true, showCarousel: true, rightLimit: 4, pageLabel: '1–2 / 6', prevDisabled: true, nextDisabled: false });
    expect(six.dots).toEqual([true, true, false, false, false, false]);
    expect(carouselModel(6, 9)).toMatchObject({ index: 4, pageLabel: '5–6 / 6', nextDisabled: true, prevDisabled: false });
    expect(carouselModel(2, 5)).toMatchObject({ mode: 'mode-2', index: 0, pageLabel: '1–2 / 2', prevDisabled: true, nextDisabled: true, showCarousel: false });
    expect(carouselModel(1, 0)).toMatchObject({ mode: 'mode-1', showNavigation: false, pageLabel: '1–1 / 1' });
    expect(carouselModel(3, 1)).toMatchObject({ pageLabel: '2–3 / 3', nextDisabled: true });
    expect(clampCarouselIndex(6, -3)).toBe(0);
    expect(clampCarouselIndex(6, 9)).toBe(4);
    expect(clampCarouselIndex(2, 1)).toBe(0);
  });
  it('fades cards at the edge of the viewport and snaps a drag to a page', () => {
    const viewport = { left: 0, right: 200 };
    expect(cardVisibility({ left: 0, right: 100 }, viewport)).toEqual({ opacity: 1, outside: false });
    expect(cardVisibility({ left: 150, right: 250 }, viewport)).toEqual({ opacity: 0.974, outside: false });
    expect(cardVisibility({ left: 400, right: 500 }, viewport)).toEqual({ opacity: 0, outside: true });
    expect(snapCarouselIndex(250, 0, 100, false)).toBe(3);
    expect(snapCarouselIndex(250, 100, 100, true)).toBe(1);
    expect(snapCarouselIndex(250, 0, 0, false)).toBe(0);
  });
});

describe('order figures while dragging', () => {
  it('previews the command panel, the card and the summary', () => {
    expect(previewedOrderCommand(base, 3)).toEqual({ percent: 67, planned: 255, requested: 378, remainingText: 'Náhled: 123 osob zbývá' });
    expect(previewedOrderCommand(base, 126).remainingText).toBe('✓ Celá objednávka bude splněna');
    expect(previewedCardFigures(base, 'medical', 3)).toMatchObject({ after: 51, percent: 71, remainingText: 'Zbývá 21 osob', bottomText: '✦ NÁHLED +3 OSOB', previewing: true, willComplete: false });
    expect(previewedCardFigures(base, 'medical', 24)).toMatchObject({ after: 72, remainingText: '✓ Tímto naplníte požadavek', willComplete: true });
    expect(previewedCardFigures(base, 'medical', 0).bottomText).toBe('✦ VYBRÁNO PRO PLÁNOVÁNÍ');
    const s = previewedSummary(base, 3, 'medical');
    expect(s).toMatchObject({ planned: 255, percent: 67, remaining: 123, previewChip: '  +3 náhled' });
    expect(s.bars.find((b) => b.categoryId === 'medical')!.percent).toBe(71);
    expect(s.remainingTime).toBe('92 h'); // 5580 min pending - 3 x 20 min
    expect(previewedSummary(base, 0, null).previewChip).toBe('');
  });
  it('writes the hint strip', () => {
    expect(activePlanHint(base, null)).toEqual({ active: false, dragging: false, parts: ['Vyberte činnost'], tail: 'Žádná činnost není vybraná' });
    expect(activePlanHint(base, 'medical')).toMatchObject({ active: true, dragging: false, parts: ['Právě plánujete: Sportovní prohlídky', '20 min / osoba · zbývá 24 osob'], tail: 'ESC ukončit výběr' });
    expect(activePlanHint(base, 'medical', { quantity: 3, isLimit: false })).toMatchObject({
      dragging: true, parts: ['NÁHLED: Sportovní prohlídky', '+3 osob · 1 h', '48 → 51 / 72'], tail: 'UPUŠTĚNÍM VYTVOŘÍTE',
    });
    expect(activePlanHint(base, 'medical', { quantity: 1, isLimit: true }).tail).toBe('MAXIMUM');
  });
  it('reads the order command panel', () => {
    expect(orderCommandModel(base)).toEqual({ percent: 67, planned: 252, requested: 378, remainingText: '126 osob zbývá naplánovat', terms: 6, newSlots: 0, ready: false });
    const more = ctxWith([...demoSessions, club('n1', '2026-11-25', '09:00', '10:00', 'physio', 2)]);
    expect(orderCommandModel(more)).toMatchObject({ planned: 254, terms: 7, newSlots: 2 });
  });
});

describe('placement start and completion', () => {
  it('starts a drag aligned so one slot still fits', () => {
    expect(beginPlacement(base, null, { x: 0.3, y: 0.5 })).toEqual({ kind: 'noSelection' });
    expect(beginPlacement(base, 'medical', { x: 0.3, y: 0.5 })).toEqual({ kind: 'start', drag: { day: 2, startMinutes: 780 } });
    expect(beginPlacement(base, 'medical', { x: 0.99999, y: 0.999 })).toEqual({ kind: 'start', drag: { day: 6, startMinutes: 1120 } });
    const done = ctxWith([...demoSessions, club('big', '2026-11-27', '07:00', '19:00', 'physio', 8)]);
    expect(beginPlacement(done, 'physio', { x: 0.1, y: 0.1 })).toEqual({ kind: 'complete', categoryId: 'physio' });
    expect(canSelectForPlanning(base, 'medical')).toBe('ok');
    expect(canSelectForPlanning(done, 'physio')).toBe('complete');
    expect(canSelectForPlanning(base, 'nope')).toBe('unknown');
  });
  it('reports the toast and the completion card', () => {
    expect(planToastCaption(3, 'Fyzioterapie', 0)).toBe('✓ Přidáno 3 slotů pro Fyzioterapie');
    expect(planToastCaption(3, 'Fyzioterapie', 1)).toBe('✓ Přidáno 3 slotů · spojeno s existujícím termínem');
    expect(planToastCaption(3, 'Fyzioterapie', 2)).toBe('✓ Spojeno 3 bloků do jednoho termínu');
    const done = ctxWith([...demoSessions, club('big', '2026-11-27', '07:00', '19:00', 'physio', 8)]);
    const m = completionCalloutModel(done, 'physio', 118, 'Fyzioterapie', '#ffb124');
    expect(m).toMatchObject({ wholeOrder: false, title: 'Požadavek naplněn', eyebrow: 'KAPACITA SPLNĚNA', stat: '24 / 24 osob', anotherLabel: 'Jiná činnost', nextCategoryId: 'medical' });
    expect(completionCalloutModel(done, 'physio', 0, 'Fyzioterapie', '#ffb124')).toMatchObject({ wholeOrder: true, title: 'Celá objednávka naplánována', anotherLabel: 'Zavřít' });
  });
});

describe('selection geometry', () => {
  it('stops at the end of the day and at the remaining seats', () => {
    const drag = { day: 3, startMinutes: 1100 };
    const r = selectionFromPointer(base, drag, 'medical', '2026-11-16', { x: 0.4, y: 1 })!;
    // 1100 + 20 min * n <= 1140 -> two slots at most
    expect(r).toMatchObject({ date: '2026-11-19', start: '18:20', end: '19:00', quantity: 2, blockedByEndOfDay: false, col: 3 });
    const up = selectionFromPointer(base, { day: 1, startMinutes: 1000 }, 'physio', '2026-11-16', { x: 0.2, y: 0 })!;
    expect(up.quantity).toBe(8); // physio remaining 8; 580 min above would allow more
    expect(up.isLimit).toBe(true);
    expect(up.startMinutes).toBe(1000 - 8 * 30);
  });
});

describe('overlays', () => {
  it('lays out the placement preview and its HUD', () => {
    const p = selectionFromPointer(base, { day: 1, startMinutes: 540 }, 'medical', '2026-11-16', { x: 0.3, y: 0.3 })!;
    const o = placementOverlay(base, p, 1127);
    expect(o.preview).toMatchObject({ left: 'calc(1 * 100% / 7 + 4px)', width: 'calc(100% / 7 - 8px)', invalid: false, limitReached: false });
    expect(o.preview.top).toBeCloseTo(((540 - 420) / 720) * 455, 3);
    expect(o.hud.left).toBeCloseTo((1.5 * 1127) / 7 + 18, 3);
    expect(o.hud.heading).toBe('ŽIVÝ NÁHLED PLÁNOVÁNÍ');
    expect(o.hud.plus).toMatch(/^\+\d+$/);
  });
  it('lays out the move ghost and the resize layers', () => {
    const rect = { left: 0, top: 0, width: 1127, height: 455 };
    const mp = proposalForMove(base, { id: 'm1', grabOffset: 0 }, { clientX: 700, clientY: 200 }, rect, '2026-11-16')!;
    const mo = moveOverlay(base, mp, 1127)!;
    expect(mo.ghost.left).toBe(`calc(${mp.col} * 100% / 7 + 4px)`);
    expect(mo.hud.heading).toBe(mp.validation.ok ? 'NÁHLED PŘESUNU' : 'NELZE PŘESUNOUT');
    expect(mo.hud.rule).toEqual({ slots: '12 slotů', text: ' · délka zachována' });
    const ctx = ctxWith([...demoSessions, club('nm1', '2026-11-18', '13:00', '14:00', 'medical', 3, { slotDuration: 20 })]);
    const original = ctx.sessions.find((s) => s.id === 'nm1')!;
    const rp = proposalForTermExpansion(ctx, { id: 'nm1', original, edge: 'bottom', pointerId: 1, originY: 0, started: true }, 80, 1, '2026-11-16')!;
    const ro = resizeOverlay(ctx, rp, 1127, 455)!;
    expect(ro.added.label).toBe(`+${rp.added} ${rp.added === 1 ? 'slot' : 'slotů'}`);
    expect(ro.hud.eyebrow).toBe(rp.validation.ok ? 'ROZŠÍŘENÍ TERMÍNU' : 'NELZE ROZŠÍŘIT');
    expect(resizeOverlay(ctx, { ...rp, added: 0 }, 1127, 455)).toBeNull();
  });
});

describe('smart editor', () => {
  const S = club('S', '2026-11-25', '09:00', '10:00', 'medical', 3, { slotDuration: 20 });
  const ctx = ctxWith([...demoSessions, S]);
  const draft0 = smartEditInitialDraft(S);
  it('starts clean, recalculates the end and validates', () => {
    expect(smartEditValidation(ctx, S, draft0)).toEqual({ ok: false, reason: 'Nejprve proveďte změnu. Původní termín zatím zůstává platný.' });
    const plus = smartEditReduce(ctx, draft0, { type: 'plus' });
    expect(plus).toMatchObject({ capacity: 4, end: '10:20', mode: 'auto', dirty: true });
    expect(smartEditValidation(ctx, S, plus)).toEqual({ ok: true, reason: 'Vše sedí · bez časové kolize · rezervace zachovány' });
    const type = smartEditReduce(ctx, draft0, { type: 'category', value: 'physio' });
    expect(type).toMatchObject({ categoryId: 'physio', end: '10:30' });
    expect(smartEditViewModel(ctx, S, type).impacts[0]).toBe('Změna činnosti Sportovní prohlídky → Fyzioterapie');
    expect(smartEditReduce(ctx, draft0, { type: 'minus' })).toMatchObject({ capacity: 2, end: '09:40' });
    expect(smartEditReduce(ctx, smartEditReduce(ctx, draft0, { type: 'minus' }), { type: 'minus' }).capacity).toBe(1);
    expect(smartEditReduce(ctx, { ...draft0, capacity: 1 }, { type: 'minus' }).capacity).toBe(1);
  });
  it('lets the end drive the quantity only for exact multiples', () => {
    const manual = smartEditReduce(ctx, draft0, { type: 'toggleMode' });
    expect(manual.mode).toBe('manual');
    expect(smartEditReduce(ctx, manual, { type: 'end', value: '10:40' })).toMatchObject({ capacity: 5, end: '10:40', dirty: true, mode: 'manual' });
    const off = smartEditReduce(ctx, manual, { type: 'end', value: '10:50' });
    expect(off.capacity).toBe(3);
    expect(smartEditValidation(ctx, S, off).reason).toBe('Rozsah není násobkem 20 minut. Opravte konec nebo počet slotů.');
    expect(smartEditReduce(ctx, manual, { type: 'toggleMode' })).toMatchObject({ mode: 'auto', end: '10:00', dirty: true });
  });
  it('refuses collisions, bookings, the working window and the order limit', () => {
    const T = club('T', '2026-11-25', '10:00', '11:00', 'fitness', 1, { slotDuration: 45 });
    const c2 = ctxWith([...demoSessions, S, T]);
    const plus = smartEditReduce(c2, draft0, { type: 'plus' });
    expect(smartEditValidation(c2, S, plus).reason).toBe('Kolize: Kondiční diagnostika 10:00–11:00.');
    expect(smartEditValidation(ctx, S, { ...draft0, dirty: true, date: 'x' }).reason).toBe('Vyberte platné datum termínu.');
    expect(smartEditValidation(ctx, S, smartEditReduce(ctx, draft0, { type: 'start', value: '06:00' })).reason).toBe('Termín musí být v pracovním okně 07:00–19:00.');
    const B = club('B', '2026-11-26', '09:00', '10:00', 'medical', 3, { slotDuration: 20, booked: 2 });
    const cb = ctxWith([...demoSessions, B]);
    const one = smartEditReduce(cb, smartEditReduce(cb, smartEditInitialDraft(B), { type: 'minus' }), { type: 'minus' });
    expect(one.capacity).toBe(1);
    expect(smartEditBooked(cb, B)).toBe(2);
    expect(smartEditValidation(cb, B, one).reason).toBe('Nelze zrušit obsazené sloty: 2 rezervací, nově pouze 1 míst.');
    const big = smartEditReduce(ctx, { ...draft0, capacity: 24 }, { type: 'plus' });
    expect(smartEditValidation(ctx, S, big).reason).toBe('Objednávka klubu: pro Sportovní prohlídky zbývá 24 slotů.');
    const slotted = { ...S, slots: [{ start: '09:00', end: '09:20' }, { start: '09:20', end: '09:40', bookingId: 'x' }, { start: '09:40', end: '10:00' }] };
    const cs = ctxWith([...demoSessions, slotted]);
    const two = smartEditReduce(cs, smartEditInitialDraft(slotted), { type: 'minus' });
    expect(smartEditValidation(cs, slotted, smartEditReduce(cs, two, { type: 'minus' })).reason).toBe('Na pozdějším slotu existuje rezervace. Zachovejte alespoň 2 slotů.');
  });
  it('flags the sample terms whose length differs from the catalogue', () => {
    const m2 = base.sessions.find((s) => s.id === 'm2')!;
    expect(smartEditIsLegacy(base, m2)).toBe(true);
    expect(smartEditIsLegacy(ctx, S)).toBe(false);
  });
});

describe('dialog models', () => {
  it('creates a term from the dialog', () => {
    let n = 0;
    const newId = () => `N${n++}`;
    const ok = createFromDialog(base, { date: '2026-11-25', categoryId: 'medical', start: '09:00', end: '10:00' }, newId);
    expect(ok).toMatchObject({ ok: true, session: { id: 'N0', capacity: 3, createdByPlanner: true, booked: 0 } });
    expect(createFromDialog(base, { date: '2026-11-25', categoryId: 'medical', start: '09:00', end: '09:50' }, newId)).toEqual({ ok: false, reason: 'Rozsah musí být násobkem 20 minut.' });
    expect(createFromDialog(base, { date: '2026-11-25', categoryId: 'medical', start: '06:00', end: '07:00' }, newId)).toEqual({ ok: false, reason: 'Plánovací okno je 07:00–19:00.' });
    expect(createFromDialog(base, { date: '2026-11-25', categoryId: 'medical', start: '07:00', end: '15:20' }, newId)).toEqual({ ok: false, reason: 'Zbývá pouze 24 osob. Zkraťte časový úsek.' });
    expect(createFromDialog(base, { date: '2026-11-25', categoryId: 'medical', start: '09:00', end: '09:00' }, newId).ok).toBe(false);
  });
  it('proposes defaults and an automatic capacity line', () => {
    expect(newEventDefaults(base, null, '2026-11-20')).toBeNull();
    expect(newEventDefaults(base, 'medical', '2026-11-20')).toEqual({ date: '2026-11-20', categoryId: 'medical', start: '09:00', end: '09:40', capacity: 2 });
    expect(newEventDefaults(base, 'medical', '2026-11-20', { start: '10:00', categoryId: 'fitness' })).toMatchObject({ categoryId: 'fitness', end: '11:30' });
    expect(automaticCapacityText('09:00', '10:00', 20)).toBe('3 slotů · 20 min na osobu');
    expect(automaticCapacityText('09:00', '10:10', 20)).toBe('3 slotů · 20 min na osobu · neúplný interval');
    expect(automaticCapacityText('10:00', '09:00', 20)).toBe('Vyberte platný časový rozsah');
  });
  it('removes a session and tells who must be informed of a change', () => {
    expect(deleteSession(base, 'm1').find((s) => s.id === 'm1')).toBeUndefined();
    expect(termChangeImpact(base, base.sessions.find((s) => s.id === 'm1')!)).toEqual({ clubLinkUpdated: true, individualRecipients: 0 });
    expect(termChangeImpact(base, base.sessions.find((s) => s.id === 'v1')!)).toEqual({ clubLinkUpdated: false, individualRecipients: 8 });
  });
  it('explains a move', () => {
    const rect = { left: 0, top: 0, width: 1127, height: 455 };
    const p = proposalForMove(base, { id: 'm1', grabOffset: 0 }, { clientX: 700, clientY: 300 }, rect, '2026-11-16')!;
    const m = moveConfirmModel(base, p)!;
    expect(m).toMatchObject({ name: 'Sportovní prohlídky', slotsPill: '12 SLOTŮ', needsAck: true, noticeTitle: '12 potvrzených rezervací · 0 míst držených pro klub' });
    expect(m.facts).toContain('Délka 2 h zachována');
    expect(moveConfirmModel(base, { ...p, eventId: 'zzz' })).toBeNull();
  });
  it('summarises the order for the dialogs', () => {
    const od = orderDetailsModel(base);
    expect(od.totals.percent).toBe(67);
    expect(od.rows.find((r) => r.categoryId === 'fitness')).toMatchObject({ planned: 42, requested: 48, remaining: 6, canPlan: true, subline: '45 min / osoba · zbývá 6 osob (4 h 30 min)' });
    const notReady = finishPlanModel(base, demoClubProfile);
    expect(notReady).toMatchObject({ ready: false, primary: 'continue', title: 'Kontrola rozpracovaného plánu', primaryLabel: 'Pokračovat v plánování' });
    expect(notReady.rows).toHaveLength(6);
    expect(notReady.message).toBe('Zbývá naplánovat 126 osob. Dokončení objednávky zatím není možné.');
    const full = ctxWith(demoSessions, { demands: demoDemands.map((d) => ({ ...d, baselinePlanned: d.requested })) });
    expect(finishPlanModel(full, demoClubProfile)).toMatchObject({ ready: true, primary: 'fillContact', primaryLabel: 'Doplnit kontakt klubu' });
    const filled: ClubProfile = { ...demoClubProfile, contactName: 'Jana', contactEmail: 'jana@example.test' };
    expect(finishPlanModel(full, filled)).toMatchObject({ primary: 'confirm', title: 'Dokončení plánování' });
    expect(contactReady(filled)).toBe(true);
    const pub = publishModel(base, demoClubProfile);
    expect(pub.warning).toMatch(/^Zbývá naplánovat 126 osob \(/);
    expect(pub.recipient).toBe('');
    expect(publishModel(full, filled).warning).toBeNull();
  });
  it('drafts the e-mail and lists the form rows', () => {
    const e = emailDraft(base, { clubName: 'Klub' }, { clinicName: 'Klinika' });
    expect(e.subject).toBe('Klinika · Termíny vyšetření pro Klub');
    expect(e.body).toContain('Počet požadovaných osob: 378');
    expect(e.body).toContain('Aktuálně naplánováno: 252');
    expect(e.body).toContain('[ZDE BUDE BEZPEČNÝ ODKAZ PO NAPOJENÍ SERVERU]');
    expect(e.body.endsWith('S pozdravem\nKlinika')).toBe(true);
    expect(emailDraft(base, { clubName: 'Klub' }, { clinicName: 'K', link: 'https://x.test/f' }).body).toContain('https://x.test/f');
    expect(formPreviewRows(base).map((r) => r.id)).toEqual(['m1', 'a1', 'm2', 'f1', 'm3', 'x1']);
    expect(formPreviewRows(base)[0]).toEqual({ id: 'm1', name: 'Sportovní prohlídky', meta: '18. 11. 08:00–10:00 · 12 míst' });
  });
  it('summarises for the summary experience', () => {
    const m = summaryExperienceModel(base, demoClubProfile);
    expect(m.status).toBe('V PRŮBĚHU');
    expect(m.readiness).toBe('126 osob ještě není naplánováno · Chybí kontakt klubu');
    expect(m.topRows).toHaveLength(4);
    expect(summaryDetailLine(m.snapshot.rows[0]!)).toBe('67% naplánováno · zbývá 24 osob · 8 h vyšetření');
  });
});

describe('club header', () => {
  it('shows "Doplnit" for what is empty', () => {
    const v = headerValues({ ...demoClubProfile, ico: ' 123 ', contactEmail: 'a@b.test' });
    expect(v).toHaveLength(9);
    expect(v.find((x) => x.field === 'ico')).toEqual({ field: 'ico', value: '123', missing: false, title: '123' });
    expect(v.find((x) => x.field === 'dic')).toEqual({ field: 'dic', value: 'Doplnit', missing: true, title: 'Údaj zatím není vyplněn' });
    expect(hasAnyClubData(demoClubProfile)).toBe(false);
    expect(hasAnyClubData({ ...demoClubProfile, dic: 'x' })).toBe(true);
  });
});

describe('agenda dialogs', () => {
  it('filters the full list by text, činnost and day, grouped by date', () => {
    const all = agendaFullListModel(base, { query: '', categoryId: 'all', date: '' });
    expect(all.stats).toEqual({ terms: 18, slots: all.stats.slots, time: all.stats.time });
    const med = agendaFullListModel(base, { query: 'prohl', categoryId: 'medical', date: '' });
    expect(med.groups.map((g) => g.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-22']);
    expect(med.groups[0]).toMatchObject({ title: 'Po 16. listopadu 2026', summary: '2 termíny · 14 slotů' });
    const day = agendaFullListModel(base, { query: '', categoryId: 'all', date: '2026-11-18' });
    expect(day.stats).toMatchObject({ terms: 2, slots: 20, time: '3 h 30 min' });
    expect(agendaFullListModel(base, { query: 'zzz', categoryId: 'all', date: '' }).empty).toBe('Žádné termíny neodpovídají vybraným filtrům.');
  });
  it('describes a club term and a public term', () => {
    const d = agendaDetailModel(base, base.sessions.find((s) => s.id === 'm1')!);
    expect(d).toMatchObject({ name: 'Sportovní prohlídky', dateline: 'St 18. 11. 2026', isClub: true });
    expect(d.stats).toEqual({ time: '08:00–10:00', slots: '12 slotů', length: '2 h ' }); // the prototype's agendaHours keeps the trailing space
    expect(d.note.startsWith('V objednávce zbývá naplánovat 24 slotů pro tuto činnost.')).toBe(true);
    const p = publicEventDetailModel(base, base.sessions.find((s) => s.id === 'v1')!);
    expect(p).toMatchObject({ occupancy: '8 / 8 osob', free: '0 volných míst', fillPercent: 100 });
  });
  it('searches and notifies', () => {
    expect(searchTerms(base, 'fyzio').map((r) => r.id)).toEqual(['p1']);
    expect(searchTerms(base, '18. 11.').map((r) => r.id)).toEqual(['m1', 'v1']);
    const n = notificationsModel(base);
    expect(n.full.length).toBeLessThanOrEqual(3);
    expect(n.summary).toMatch(/termíny s plnou kapacitou/);
  });
  it('lists the panel for a day scope', () => {
    const m = agendaPanelModel(base, { mode: 'all', categoryId: null, scope: 'day' }, { weekStart: '2026-11-16', selectedDate: '2026-11-20' });
    expect(m.scopeNote).toBe('Datum 20. 11.');
    expect(m.allRows.map((r) => r.id)).toEqual(['p1', 'f1']);
    expect(m.categoryId).toBe('medical');
  });
});
