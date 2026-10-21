/*
 * Picking whole days in the month for the club order being planned: a plain click on a day, a drag over several, Ctrl /
 * Shift places, the tray's "Naplánovat vybrané dny". The rules are `dayPick.ts`; this only reads the board, writes the
 * runs through the data source in ONE call (one check against the need, one "Zpět" for the whole pick) and says in
 * Czech what was taken and why a day was not.
 */
import { useCallback, useRef, useState } from 'react';
import { usePlannerData } from '../../data/PlannerDataProvider';
import { usePlannerCommands } from '../../data/usePlannerCommands';
import type { DayMark } from '../../model';
import { usePlannerActions, usePlannerStore } from '../../state/PlannerStoreProvider';
import { planFx } from '../../motion/planFx';
import { usePlannerCtx, usePlannerModelState } from '../context';
import { describeDayPick, expandRanges, planDays, type DayPickPlan, type DayRangeLike } from './dayPick';
import { writeMessage } from './usePlanCommit';
import { usePlanFigures } from './usePlanFigures';

export interface DayPick {
  /** Plan the whole days of these ranges for the armed činnost (or every činnost still short). */
  pick: (ranges: readonly DayRangeLike[]) => Promise<DayPickPlan | null>;
  busy: boolean;
}

export function useDayPick(): DayPick {
  const ctx = usePlannerCtx();
  const { dayMarks } = usePlannerModelState();
  const { source, today } = usePlannerData();
  const { base } = usePlanFigures();
  const commands = usePlannerCommands();
  const act = usePlannerActions();
  const store = usePlannerStore();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const pick = useCallback<DayPick['pick']>(
    async (ranges) => {
      if (running.current) return null;
      const dates = expandRanges(ranges);
      if (dates.length === 0) return null;
      running.current = true;
      setBusy(true);
      try {
        /* The days outside what the board has read (a range dragged over a month edge) are read here. */
        const missing = dates.filter((d) => dayMarks[d] === undefined);
        const marks: Record<string, DayMark> = { ...dayMarks };
        if (missing.length > 0) {
          for (const m of await source.listDayMarks({ from: missing[0]!, to: missing[missing.length - 1]! }).catch(() => [])) marks[m.date] = m;
        }
        const armed = store.getState().planning.selectedCategoryId;
        const plan = planDays({ dates, figures: base, armed, marks, sessions: ctx.sessions, today });
        const names = new Map(base.list.map((f) => [f.categoryId, f.name] as const));
        const said = describeDayPick(plan, names);
        if (plan.inputs.length === 0) {
          planFx.refuse();
          act.toast(said.text, { durationMs: 6500 });
          return plan;
        }
        const result = await commands.createIntervals(plan.inputs);
        planFx.picked(plan.daysUsed);
        act.setUndoToken(result.undoToken);
        const done = [...plan.seatsBy.entries()].find(([id, seats]) => {
          const f = base.byId.get(id);
          return f !== undefined && !f.done && f.remaining - seats <= 0;
        });
        if (done) act.showCompletion(done[0], false);
        /* The callout says "splněno"; anything the desk should still know (a day left out, a day cut short) is said too. */
        if (!done || said.tone !== 'ok') act.toast(said.text, { actionLabel: '↶ Zpět', actionKey: 'undo', durationMs: 7000 });
        return plan;
      } catch (error) {
        planFx.refuse();
        act.toast(writeMessage(error, 'Dny se nepodařilo naplánovat.'), { durationMs: 6500 });
        return null;
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [ctx.sessions, dayMarks, source, today, base, commands, act, store],
  );

  return { pick, busy };
}
