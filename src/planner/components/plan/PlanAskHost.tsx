/*
 * The činnosti bubble of a dropped window (Etapa 12, kept from pick mode): "When I drop a window, a small bubble
 * asks which činnosti it is for - Vše, one, or two of three - and can split the window."
 *
 * The bubble is the application's own `PickActivityPopover` (it already is the calendar's look of the new
 * theme); this host only feeds it the planner's window and turns its answer into writes:
 *
 *   window  -> a `PickedTime` of the armed činnost (whole slots of it), the other terms of the order as `others`
 *   answer  -> the parts with their činnosti -> `pickCoverage` lays the sequential plan -> one `createInterval`
 *              per planned part (`usePlanCommit.dropParts`)
 *
 * Nothing is written before the desk confirms; Esc / "Zrušit" drop the window (nothing was created).
 * A click outside keeps what is ticked (= "Potvrdit"), exactly as in the calendar.
 */
import { useMemo } from 'react';
import { slotMinutesOf, minutesAsTime } from '../../model';
import { usePlannerActions, usePlannerSelector } from '../../state/PlannerStoreProvider';
import { useDevice } from '../../../layout/useDevice';
import { normalizeAllowed } from '../../../components/clubs/order/routing';
import { PickActivityPopover } from '../../../components/booking/calendar/PickActivityPopover';
import type { PickedTime } from '../../../components/booking/calendar/multiSelect';
import { pickCoverage, stepFor, type PlanPart, type PlanWindow } from '../../../components/booking/calendar/pickPlan';
import type { AskResult, PickAsk } from '../../../components/booking/calendar/pickTypes';
import { usePlannerCtx, usePlannerModelState } from '../context';
import { coverageActivities, orderWindows, PLANNER_CALENDAR_ID, PLAN_STEP } from './orderFigures';
import { PlanDarkTheme } from './PlanDarkTheme';
import { useClubPlanningContext } from './useClubPlanningContext';
import { usePlanCommit } from './usePlanCommit';
import { usePlanFigures } from './usePlanFigures';

export function PlanAskHost() {
  const ask = usePlannerSelector((s) => s.planning.ask);
  if (!ask) return null;
  return <AskBubble key={`${ask.date}-${ask.startMinutes}-${ask.slots}-${ask.categoryId}`} />;
}

function AskBubble() {
  const ask = usePlannerSelector((s) => s.planning.ask)!;
  const act = usePlannerActions();
  const ctx = usePlannerCtx();
  const { order } = usePlannerModelState();
  const { session } = useClubPlanningContext();
  const { base } = usePlanFigures();
  const commit = usePlanCommit();
  const device = useDevice();
  const orderId = order?.id ?? null;
  const baseline = session?.editOrder?.baseline;

  const activities = useMemo(() => coverageActivities(ctx).filter((a) => a.seats > 0), [ctx]);
  const allIds = useMemo(() => activities.map((a) => a.activityId), [activities]);
  const others = useMemo(() => orderWindows(ctx, orderId), [ctx, orderId]);
  const prices = useMemo(() => new Map(ctx.categories.map((c) => [c.id, c.priceCzk ?? null] as const)), [ctx.categories]);

  const pickAsk = useMemo<PickAsk>(() => {
    const slot = slotMinutesOf(ctx, ask.categoryId);
    const window: PickedTime = {
      id: 'ask',
      kind: 'time',
      columnKey: PLANNER_CALENDAR_ID,
      calendarId: PLANNER_CALENDAR_ID,
      activityId: null,
      dayKey: ask.date,
      range: { start: ask.startMinutes, end: ask.startMinutes + ask.slots * slot },
      activityIds: normalizeAllowed([ask.categoryId], allIds),
    };
    return {
      mode: 'new',
      windows: [window],
      activities,
      others,
      ...(baseline ? { baseline: [...baseline] } : {}),
      stepOf: () => PLAN_STEP,
      calendarName: () => '',
      prices,
    };
  }, [ctx, ask, activities, allIds, others, prices, baseline]);

  const onConfirm = (results: readonly AskResult[]) => {
    const asked = results.flatMap((r) =>
      r.parts.map((p, k): PlanWindow => ({
        id: `${r.id}#${k}`,
        range: p.range,
        dayKey: ask.date,
        activityIds: normalizeAllowed(p.activityIds, allIds),
        step: stepFor(p.range, PLAN_STEP),
      })),
    );
    const coverage = pickCoverage(activities, [...others, ...asked], baseline ? { baseline } : {});
    const parts: PlanPart[] = asked
      .flatMap((w) => coverage.windows.find((r) => r.id === w.id)?.parts ?? [])
      .sort((a, b) => a.range.start - b.range.start);
    act.closePlanAsk();
    if (parts.length === 0) {
      act.toast('Všichni hráči těchto činností už mají termín. Nic nebylo vytvořeno.');
      return;
    }
    void commit.dropParts(ctx, base, ask.date, parts, { orderId });
  };

  return (
    <PlanDarkTheme>
      <PickActivityPopover ask={pickAsk} device={device} onConfirm={onConfirm} onCancel={() => window.setTimeout(() => act.closePlanAsk(), 0)} />
    </PlanDarkTheme>
  );
}

/** The held window as a placement preview, for the board to keep drawing it under the bubble. */
export function heldWindow(ask: { date: string; categoryId: string; startMinutes: number; slots: number }, slotMinutes: number, weekStart: string) {
  const startMinutes = ask.startMinutes;
  const endMinutes = ask.startMinutes + ask.slots * slotMinutes;
  const a = Date.UTC(+weekStart.slice(0, 4), +weekStart.slice(5, 7) - 1, +weekStart.slice(8, 10));
  const b = Date.UTC(+ask.date.slice(0, 4), +ask.date.slice(5, 7) - 1, +ask.date.slice(8, 10));
  const col = Math.round((b - a) / 86400000);
  return {
    kind: 'place' as const,
    date: ask.date,
    categoryId: ask.categoryId,
    start: minutesAsTime(startMinutes),
    end: minutesAsTime(endMinutes),
    quantity: ask.slots,
    validation: { ok: true, reason: '' },
    col,
    startMinutes,
    endMinutes,
    isLimit: false,
    stoppedAtLimit: false,
    blockedByEndOfDay: false,
    remaining: 0,
  };
}
