/*
 * "Přidat další den": fills the next free day after the order's last term for ONE činnost that is still short
 * (see `addDay.ts` for the rule). Reads the following two weeks from the data source, writes the result through
 * the same `createInterval` the drag uses - so it lands in the draft, merges, and can be undone with Ctrl+Z.
 */
import { useCallback, useState } from 'react';
import { usePlannerData } from '../../data/PlannerDataProvider';
import { dayOfWeekShort, formatShortDate } from './dayLabels';
import { usePlannerActions } from '../../state/PlannerStoreProvider';
import { planFx } from '../../motion/planFx';
import { usePlannerCtx, usePlannerModelState } from '../context';
import { ADD_DAY_HORIZON, planNextDay } from './addDay';
import { orderTerms } from './orderFigures';
import { usePlanCommit } from './usePlanCommit';
import { usePlanFigures } from './usePlanFigures';
import type { PlanPart } from '../../../components/booking/calendar/pickPlan';

const addDays = (date: string, n: number): string => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function useAddDay(): { addDay: (categoryId: string) => Promise<void>; busy: string | null } {
  const ctx = usePlannerCtx();
  const { order, today } = usePlannerModelState();
  const { source } = usePlannerData();
  const { base } = usePlanFigures();
  const act = usePlannerActions();
  const commit = usePlanCommit();
  const [busy, setBusy] = useState<string | null>(null);

  const addDay = useCallback(
    async (categoryId: string) => {
      const f = base.byId.get(categoryId);
      if (!f || f.remaining <= 0 || busy !== null) return;
      setBusy(categoryId);
      try {
        const terms = orderTerms(ctx, order?.id);
        const last = terms.reduce<string | null>((m, s) => (m === null || s.date > m ? s.date : m), null);
        const from = last !== null && last >= today ? addDays(last, 1) : addDays(today, 1);
        const range = { from, to: addDays(from, ADD_DAY_HORIZON - 1) };
        const [sessions, marks] = await Promise.all([source.listSessions(range), source.listDayMarks(range)]);
        const plan = planNextDay({ figure: f, from, marks: Object.fromEntries(marks.map((m) => [m.date, m])), sessions });
        if (!plan) {
          planFx.refuse();
          act.toast(`Pro ${f.name} není v nejbližších ${ADD_DAY_HORIZON} dnech po posledním termínu volný den.`);
          return;
        }
        const parts: PlanPart[] = plan.parts.map((p) => ({
          activityId: categoryId,
          name: f.name,
          range: { start: p.start, end: p.start + p.slots * f.slotMinutes },
          seats: Math.min(f.remaining, p.slots * f.lanes),
          slots: p.slots,
        }));
        const done = await commit.dropParts(ctx, base, plan.date, parts, { orderId: order?.id ?? null });
        if (done) {
          act.focusDate(plan.date, true);
          const slots = `${plan.slots} ${plan.slots === 1 ? 'slot' : plan.slots >= 2 && plan.slots <= 4 ? 'sloty' : 'slotů'}`;
          act.toast(`Přidán ${dayOfWeekShort(plan.date)} ${formatShortDate(plan.date)} pro ${f.name} (${slots}).`, { actionLabel: '↶ Zpět', actionKey: 'undo', durationMs: 5200 });
        }
      } catch (error) {
        act.toast(error instanceof Error && error.message ? error.message : 'Další den se nepodařilo přidat.');
      } finally {
        setBusy(null);
      }
    },
    [base, busy, ctx, order?.id, today, source, act, commit],
  );

  return { addDay, busy };
}

