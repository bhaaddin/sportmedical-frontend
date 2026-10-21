/*
 * Writing the club's planning into the draft through the data source - the drop of a dragged interval and the
 * confirmed windows of the činnosti bubble.
 *
 * Nothing here reaches an API client: every write is `PlannerDataSource.createInterval` (the source keeps the
 * LOCAL DRAFT and merges adjacent blocks of the same činnost; the real order is written once, at `finishPlan`).
 */
import { useMemo } from 'react';
import { usePlannerCommands } from '../../data/usePlannerCommands';
import { PlannerWriteError } from '../../data/PlannerDataSource';
import { minutesAsTime, planToastCaption, slotMinutesOf, type PlannerContext } from '../../model';
import { usePlannerActions, usePlannerStore } from '../../state/PlannerStoreProvider';
import { planFx } from '../../motion/planFx';
import { orderFigures, previewFigures, previewWindow, previewWindows, type OrderFigures } from './orderFigures';
import type { PlanPart } from '../../../components/booking/calendar/pickPlan';

export const writeMessage = (error: unknown, fallback = 'Změnu se nepodařilo uložit.'): string =>
  error instanceof PlannerWriteError || error instanceof Error ? error.message || fallback : fallback;

export interface DropInput {
  date: string;
  categoryId: string;
  startMinutes: number;
  /** Whole slots of the činnost. */
  quantity: number;
}

export interface PlanCommit {
  /** Drop one interval of one činnost (what the file does on mouse-up). */
  drop: (ctx: PlannerContext, base: OrderFigures, input: DropInput, options?: { orderId?: string | null }) => Promise<boolean>;
  /** Write the parts the sequential plan laid out for a confirmed bubble window. */
  dropParts: (ctx: PlannerContext, base: OrderFigures, date: string, parts: readonly PlanPart[], options?: { orderId?: string | null }) => Promise<boolean>;
}

export function usePlanCommit(): PlanCommit {
  const commands = usePlannerCommands();
  const act = usePlannerActions();
  const store = usePlannerStore();

  return useMemo<PlanCommit>(() => {
    const drop: PlanCommit['drop'] = async (ctx, base, input, options = {}) => {
      const f = base.byId.get(input.categoryId);
      if (!f) return false;
      const extra = store.getState().planning.extraArmed;
      const pre = previewFigures(ctx, base, previewWindows(ctx, 'preview', input.date, input.categoryId, input.startMinutes, input.quantity), { orderId: options.orderId ?? null });
      try {
        const result = await commands.createInterval({
          date: input.date,
          categoryId: input.categoryId,
          start: minutesAsTime(input.startMinutes),
          quantity: input.quantity,
          ...(extra ? { allowExtra: true } : {}),
        });
        planFx.wrote();
        act.setUndoToken(result.undoToken);
        act.focusDate(input.date);
        if (extra) {
          act.setExtraArmed(false);
          act.clearPlanningSelection();
          act.toast(`✓ Přidán termín navíc · ${input.quantity} slotů pro ${f.name}`, { actionLabel: '↶ Zpět', actionKey: 'undo', durationMs: 5200 });
          return true;
        }
        if (result.complete || pre.willComplete) act.showCompletion(input.categoryId, false);
        else act.toast(planToastCaption(input.quantity, f.name, result.mergedCount), { actionLabel: '↶ Zpět', actionKey: 'undo', durationMs: 5200 });
        return true;
      } catch (error) {
        planFx.refuse();
        act.toast(writeMessage(error, 'Termín se nepodařilo vytvořit.'));
        return false;
      }
    };

    const dropParts: PlanCommit['dropParts'] = async (ctx, base, date, parts, options = {}) => {
      const todo = parts.filter((p) => p.slots > 0);
      if (todo.length === 0) {
        act.toast('Všichni hráči těchto činností už mají termín.');
        return false;
      }
      let lastToken: string | null = null;
      let created = 0;
      let slotsTotal = 0;
      let merged = 0;
      try {
        for (const p of todo) {
          const result = await commands.createInterval({
            date,
            categoryId: p.activityId,
            start: minutesAsTime(p.range.start),
            quantity: p.slots,
          });
          created += 1;
          slotsTotal += p.slots;
          merged += result.mergedCount;
          lastToken = result.undoToken ?? lastToken;
        }
      } catch (error) {
        if (lastToken) act.setUndoToken(lastToken);
        act.toast(
          created > 0
            ? `Vytvořeno ${created} z ${todo.length} termínů. ${writeMessage(error, 'Zbytek se nepodařilo vytvořit.')}`
            : writeMessage(error, 'Termín se nepodařilo vytvořit.'),
        );
        return created > 0;
      }
      planFx.wrote();
      act.setUndoToken(lastToken);
      act.focusDate(date);
      const after = orderFigures(ctx, {
        orderId: options.orderId ?? null,
        extraWindows: todo.map((p, i) => previewWindow(`part-${i}`, date, p.activityId, p.range.start, p.slots, slotMinutesOf(ctx, p.activityId))),
      });
      const done = todo.map((p) => p.activityId).find((id) => after.byId.get(id)?.done && !base.byId.get(id)?.done);
      if (done) {
        act.showCompletion(done, false);
      } else {
        act.toast(
          created === 1 ? planToastCaption(slotsTotal, base.byId.get(todo[0]!.activityId)?.name ?? '', merged) : `✓ Přidáno ${slotsTotal} slotů v ${created} termínech`,
          { actionLabel: '↶ Zpět', actionKey: 'undo', durationMs: 5200 },
        );
      }
      return true;
    };

    return { drop, dropParts };
  }, [commands, act, store]);
}
