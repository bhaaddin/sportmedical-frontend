import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Calendar } from "../../../api/bookingContracts";
import { fetchBlockableActivities } from "../../../api/clubBlocks";
import { ClubOrderError, clubOrdersApi } from "../../../api/clubOrders";
import type { ClubOrderView } from "../../../api/clubOrders";
import type { DateOnly } from "../../../utils/time";
import { computeCoverage } from "../../clubs/order/coverage";
import { mergeSessionInto } from "../../clubs/order/editSession";
import { orderCode, rangeLine } from "../../clubs/order/orderFormat";
import { rowFromRange, rowIndexForError } from "../../clubs/order/orderLogic";
import type { PickSession } from "../../clubs/order/pickSession";
import type { GridPickMode } from "../grid/TimeGrid";
import type { NewPicked } from "./multiSelect";
import type { FreeBlock } from "./pickDays";
import {
  ordersRangesOf,
  pickedCalendarIds,
  pickedMinutesOf,
  pickInRange,
  picksFromRanges,
  timePicks,
  withoutIds,
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
  /**
   * The club already has a live order of the same služba: the new order is NOT created until the desk chooses
   * ("Přidat do té objednávky" or "Vytvořit samostatnou objednávku"). Null when there is nothing to decide.
   */
  duplicate: ClubOrderView | null;
  resolveDuplicate: (choice: "add" | "separate" | "dismiss") => void;
  /** "Objednávka potvrzena" (new, processed) or "Termíny uloženy" (edited). */
  resultTitle: string;
  /** "Celý den" / a free block: the blocks of one day become picks, exactly as they are (never cut to the need). */
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
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<{ message: string; conflict: string | null; ids: string[]; athletes: number } | null>(null);
  const [result, setResult] = useState<ClubOrderView | null>(null);
  const [duplicate, setDuplicate] = useState<ClubOrderView | null>(null);
  const [resultTitle, setResultTitle] = useState("Objednávka potvrzena");

  const picks = useMemo(() => timePicks(multi.items), [multi.items]);
  const pickedMinutes = pickedMinutesOf(multi.items);
  const activities = useMemo(() => session?.activities ?? [], [session]);
  const coverage = useMemo(() => computeCoverage(activities, pickedMinutes), [activities, pickedMinutes]);

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
    onEnded?.();
  }, [multi, onEnded]);

  const confirm = useCallback(async (cancelAthletes = false, skipDuplicateCheck = false) => {
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
        /* Never silently a second order: a club that already holds a live order of this služba chooses first. */
        if (editing === undefined && session.parentOrderId === undefined && !skipDuplicateCheck) {
          const existing = await findLiveOrder(queryClient, session.clubId, session.serviceId);
          if (existing !== null) {
            setDuplicate(existing);
            return;
          }
        }
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

  const resolveDuplicate = useCallback(
    (choice: "add" | "separate" | "dismiss") => {
      const existing = duplicate;
      setDuplicate(null);
      if (existing === null || session === null) return;
      if (choice === "separate") {
        void confirm(false, true);
        return;
      }
      if (choice === "dismiss") return;
      /* The new picks and players join the existing order: its windows are painted again, the new ones stay on top. */
      void (async () => {
        const catalogue = await queryClient
          .fetchQuery({ queryKey: ["club-block-activities"], queryFn: fetchBlockableActivities, staleTime: 5 * 60 * 1000 })
          .catch(() => []);
        const merged = mergeSessionInto(existing, session, catalogue, todayKey);
        const own = (merged.editOrder?.blocks ?? []).flatMap((block) => picksFromRanges([block.range], block.calendarId, (id) => id));
        multi.replace([...own, ...withoutIds(multi.items)]);
        setSession(merged);
        setFailure(null);
        setNote(`Přidáno do objednávky ${orderCode(existing.id)}. Zkontrolujte termíny a uložte změny.`);
      })();
    },
    [duplicate, session, confirm, queryClient, todayKey, multi],
  );

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
    [session, serviceCalendarIds, todayKey, nowMinute, multi, conflictIds, ownBlockIds, clearFailure],
  );

  const pickBlocks = useCallback(
    (day: DateOnly, blocks: readonly FreeBlock[]): boolean => {
      if (blocks.length === 0) {
        setNote("V tento den už není volný čas.");
        return false;
      }
      for (const t of blocks) {
        multi.add({ kind: "time", columnKey: t.calendarId, calendarId: t.calendarId, activityId: null, dayKey: day, range: t.range });
      }
      clearFailure();
      setNote(null);
      return true;
    },
    [multi, clearFailure],
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

  return { session, active: session !== null, start, cancel: end, gridPick, panel, result, duplicate, resolveDuplicate, resultTitle, closeResult: () => setResult(null), pickBlocks, removeDay, setNote };
}

/** The club's newest Requested or Confirmed order of this služba, or null (also when the list cannot be read). */
async function findLiveOrder(queryClient: ReturnType<typeof useQueryClient>, clubId: string, serviceId: string): Promise<ClubOrderView | null> {
  try {
    const orders = await queryClient.fetchQuery({
      queryKey: ["club-orders", "pick-duplicate", clubId],
      queryFn: () => clubOrdersApi.list({ clubId }),
      staleTime: 0,
    });
    const live = orders
      .filter((o) => (o.status === "Requested" || o.status === "Confirmed") && o.serviceId === serviceId)
      .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));
    return live[0] ?? null;
  } catch {
    return null;
  }
}
