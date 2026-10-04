import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Calendar } from "../../../api/bookingContracts";
import { ClubOrderError, clubOrdersApi } from "../../../api/clubOrders";
import type { ClubOrderView } from "../../../api/clubOrders";
import type { DateOnly } from "../../../utils/time";
import { computeCoverage, pickAllowance } from "../../clubs/order/coverage";
import { rangeLine } from "../../clubs/order/orderFormat";
import { rowFromRange, rowIndexForError } from "../../clubs/order/orderLogic";
import type { PickSession } from "../../clubs/order/pickSession";
import type { GridPickMode } from "../grid/TimeGrid";
import type { NewPicked } from "./multiSelect";
import { takeWithinAllowance, type FreeBlock } from "./pickDays";
import {
  ordersRangesOf,
  pickedCalendarIds,
  pickedMinutesOf,
  paintNote,
  pickInRange,
  picksFromRanges,
  timePicks,
} from "./pickLogic";
import type { PickOrderPanelProps } from "./PickOrderPanel";
import type { MultiSelectApi } from "./useMultiSelect";

/*
 * "Výběr termínů" - the whole state machine of a phone order picked straight in the calendar.
 *
 * The session (club, služba, činnosti with players) is given at the start; the places painted in the grid live in
 * the calendar's `multi` selection; everything else - the live coverage (slots still missing), the stop at "enough",
 * the final `createStaff` / `update` / `confirm` with its 409 - is here, so the page only wires it to the grid and the
 * panel. Picking is MANUAL only: nothing proposes terms.
 */

export interface PickOrderApi {
  session: PickSession | null;
  active: boolean;
  /** `seed`: places already marked in the grid (clicked before the order was set up) that become the first picks. */
  start: (session: PickSession, seed?: readonly NewPicked[]) => void;
  cancel: () => void;
  /** Passed to the grid. */
  gridPick: GridPickMode | undefined;
  /** Passed to the panel (the page adds `device`). */
  panel: Omit<PickOrderPanelProps, "device"> | null;
  /** The confirmed order, until the page has shown it. */
  result: ClubOrderView | null;
  /** "Objednávka potvrzena" (new, processed) or "Termíny uloženy" (edited). */
  resultTitle: string;
  /** How many more minutes may be picked (Infinity = no limit). */
  allowance: number;
  /** "Celý den" / a free block: the blocks of one day become picks, stopped at the minutes still needed. */
  pickBlocks: (day: DateOnly, blocks: readonly FreeBlock[]) => boolean;
  /** Every pick of one day is dropped. */
  removeDay: (day: DateOnly) => void;
  /** A sentence under the calculator (null clears it). */
  setNote: (text: string | null) => void;
  closeResult: () => void;
}

export function usePickOrder(input: {
  multi: MultiSelectApi;
  calendars: readonly Calendar[];
  todayKey: DateOnly;
  /** The current minute of the clinic's day: today's past time cannot be picked. */
  nowMinute?: number;
  /** The grid is about to show only this služba's calendars (the page narrows its filters). */
  onStarted?: (session: PickSession) => void;
  onEnded?: () => void;
  onCreated?: (order: ClubOrderView) => void;
}): PickOrderApi {
  const { multi, calendars, todayKey, nowMinute, onStarted, onEnded, onCreated } = input;
  const queryClient = useQueryClient();
  const [session, setSession] = useState<PickSession | null>(null);
  const [allowReserve, setAllowReserve] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<{ message: string; conflict: string | null; ids: string[]; athletes: number } | null>(null);
  const [result, setResult] = useState<ClubOrderView | null>(null);
  const [resultTitle, setResultTitle] = useState("Objednávka potvrzena");

  const picks = useMemo(() => timePicks(multi.items), [multi.items]);
  const pickedMinutes = pickedMinutesOf(multi.items);
  const activities = useMemo(() => session?.activities ?? [], [session]);
  const coverage = useMemo(() => computeCoverage(activities, pickedMinutes), [activities, pickedMinutes]);
  const allowance = pickAllowance(coverage, allowReserve);

  const serviceCalendarIds = useMemo(
    () => new Set(calendars.filter((c) => session !== null && c.clinicServiceId === session.serviceId).map((c) => c.id)),
    [calendars, session],
  );
  const calendarName = useCallback((id: string) => calendars.find((c) => c.id === id)?.name ?? "", [calendars]);


  const clearFailure = useCallback(() => setFailure((f) => (f === null ? f : null)), []);

  const start = useCallback(
    (next: PickSession, seed?: readonly NewPicked[]) => {
      multi.clear();
      setSession(next);
      setAllowReserve(false);
      setNote(null);
      setFailure(null);
      setResult(null);
      /* Editing an order: its windows are the first picks (so the numbers start where the order is). */
      const own = next.editOrder?.mode === "edit" ? next.editOrder.blocks : [];
      const fromBlocks = own.flatMap((block) => picksFromRanges([block.range], block.calendarId, (id) => id));
      const first = [...fromBlocks, ...(seed ?? [])];
      if (first.length > 0) multi.replace(first);
      onStarted?.(next);
    },
    [multi, onStarted],
  );

  const end = useCallback(() => {
    multi.clear();
    setSession(null);
    setNote(null);
    setFailure(null);
    setAllowReserve(false);
    onEnded?.();
  }, [multi, onEnded]);

  const confirm = useCallback(async (cancelAthletes = false) => {
    if (session === null || picks.length === 0 || confirming) return;
    const ranges = ordersRangesOf(multi.items, todayKey);
    const calendarIds = pickedCalendarIds(multi.items);
    setConfirming(true);
    setFailure(null);
    try {
      const activitySeats = session.activities.map((a) => ({ activityId: a.activityId, seats: a.seats }));
      const editing = session.editOrder;
      let order: ClubOrderView;
      if (editing?.mode === "edit") {
        order = await clubOrdersApi.update(
          editing.orderId,
          { activitySeats, paymentMethod: session.paymentMethod, ranges, calendarIds, note: session.note.trim() },
          cancelAthletes,
        );
      } else if (editing?.mode === "process") {
        if (editing.dirty) {
          await clubOrdersApi.update(editing.orderId, { activitySeats, paymentMethod: session.paymentMethod, note: session.note.trim() });
        }
        order = await clubOrdersApi.confirm(editing.orderId, { calendarIds, ranges });
      } else {
        order = await clubOrdersApi.createStaff({
          clubId: session.clubId,
          serviceId: session.serviceId,
          activitySeats,
          paymentMethod: session.paymentMethod,
          ranges,
          calendarIds,
          status: "Confirmed",
          ...(session.note.trim() !== "" ? { note: session.note.trim() } : {}),
          ...(session.parentOrderId !== undefined ? { parentOrderId: session.parentOrderId } : {}),
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["day-range"] });
      void queryClient.invalidateQueries({ queryKey: ["club-orders"] });
      setResultTitle(editing?.mode === "edit" ? "Termíny uloženy" : "Objednávka potvrzena");
      setResult(order);
      onCreated?.(order);
      toast.success(editing?.mode === "edit" ? "Termíny objednávky jsou uložené." : "Objednávka je potvrzená a termíny jsou v kalendáři.");
      multi.clear();
      setSession(null);
      onEnded?.();
    } catch (error) {
      if (error instanceof ClubOrderError) {
        const index = rowIndexForError(error, ranges.map(rowFromRange));
        const range = index === null ? null : ranges[index];
        const ids = range === null ? [] : picks.filter((p) => pickInRange(p, range)).map((p) => p.id);
        const athletes = session.editOrder?.mode === "edit" && error.status === 409 ? error.affectedAthletes.length : 0;
        setFailure({
          message: error.message,
          conflict: range === null ? null : rangeLine(range),
          ids,
          athletes,
        });
      } else {
        setFailure({ message: "Objednávku se nepodařilo uložit. Výběr zůstal — zkuste to znovu.", conflict: null, ids: [], athletes: 0 });
      }
    } finally {
      setConfirming(false);
    }
  }, [session, picks, confirming, multi, todayKey, queryClient, onCreated, onEnded]);

  const ownBlockIds = useMemo(() => new Set((session?.editOrder?.blocks ?? []).map((b) => b.id)), [session]);
  const conflictIds = useMemo(() => new Set(failure?.ids ?? []), [failure]);
  const removeConflict = useCallback(() => {
    for (const id of failure?.ids ?? []) multi.remove(id);
    setFailure(null);
  }, [failure, multi]);

  const noteRef = useRef(setNote);
  noteRef.current = setNote;

  const gridPick: GridPickMode | undefined = useMemo(
    () =>
      session === null
        ? undefined
        : {
            active: true,
            allowance,
            allowedCalendar: (id: string) => serviceCalendarIds.has(id),
            today: todayKey,
            ...(nowMinute !== undefined ? { nowMinute } : {}),
            onNote: (text) => noteRef.current(text),
            ignoreClubBlockIds: ownBlockIds,
            onAdjust: (id, range) => {
              multi.update(id, range);
              clearFailure();
            },
            onRemove: (id) => {
              multi.remove(id);
              clearFailure();
            },
            conflictIds,
          },
    [session, allowance, serviceCalendarIds, todayKey, nowMinute, multi, conflictIds, ownBlockIds, clearFailure],
  );

  const pickBlocks = useCallback(
    (day: DateOnly, blocks: readonly FreeBlock[]): boolean => {
      if (blocks.length === 0) {
        setNote("V tento den už není volný čas.");
        return false;
      }
      const { taken, trimmedNeed } = takeWithinAllowance(blocks, allowance);
      if (taken.length === 0) {
        setNote(paintNote({ range: null, refused: "covered", trimmedBusy: false, trimmedNeed: false }));
        return false;
      }
      for (const t of taken) {
        multi.add({ kind: "time", columnKey: t.calendarId, calendarId: t.calendarId, activityId: null, dayKey: day, range: t.range });
      }
      clearFailure();
      setNote(trimmedNeed ? "Výběr zastaven — hráči jsou pokryti." : null);
      return true;
    },
    [allowance, multi, clearFailure],
  );
  const removeDay = useCallback(
    (day: DateOnly) => {
      for (const p of timePicks(multi.items)) if (p.dayKey === day) multi.remove(p.id);
      clearFailure();
      setNote(null);
    },
    [multi, clearFailure],
  );

  const panel: PickOrderApi["panel"] =
    session === null
      ? null
      : {
          clubName: session.clubName,
          serviceName: session.serviceName,
          coverage,
          picks,
          calendarName,
          allowReserve,
          onReserve: setAllowReserve,
          note,
          requested: session.editOrder?.requested ?? [],
          editing: session.editOrder?.mode === "edit",
          confirming,
          failure: failure === null ? null : { message: failure.message, conflict: failure.conflict },
          onRemoveConflict: failure !== null && failure.ids.length > 0 ? removeConflict : null,
          athletesAffected: failure !== null && failure.athletes > 0 ? failure.athletes : null,
          onConfirm: () => void confirm(),
          onConfirmCancelling: () => void confirm(true),
          onClearPicks: () => {
            multi.clear();
            clearFailure();
          },
          onRemovePick: (id) => {
            multi.remove(id);
            clearFailure();
          },
          onCancel: end,
        };

  return { session, active: session !== null, start, cancel: end, gridPick, panel, result, resultTitle, closeResult: () => setResult(null), allowance, pickBlocks, removeDay, setNote };
}
