import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Calendar } from "../../../api/bookingContracts";
import { fetchBlockableActivities } from "../../../api/clubBlocks";
import { ClubOrderError, clubOrdersApi, REASON_ACTIVITY_REMOVED } from "../../../api/clubOrders";
import type { ClubOrderView } from "../../../api/clubOrders";
import type { DateOnly } from "../../../utils/time";
import { invalidateClubWorld } from "../../clubs/clubWorld";
import { mergeSessionInto } from "../../clubs/order/editSession";
import { orderCode, rangeLine } from "../../clubs/order/orderFormat";
import { rowFromRange, rowIndexForError } from "../../clubs/order/orderLogic";
import { allowedNames, normalizeAllowed, toggleAllowed } from "../../clubs/order/routing";
import type { PickSession } from "../../clubs/order/pickSession";
import type { GridPickMode } from "../grid/TimeGrid";
import { formatFree, type FreeBlock } from "./pickDays";
import { CAL_TEXT } from "./calendarText";
import { coverageOf, subtractRanges, takeNeeded } from "./pickTake";
import {
  ordersRangesOf,
  pickedCalendarIds,
  pickedMinutesOf,
  pickedWindowsOf,
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

export interface NoteAction {
  label: string;
  onClick: () => void;
}

export interface PickOrderApi {
  session: PickSession | null;
  active: boolean;
  start: (session: PickSession) => void;
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
  /**
   * The one-tap shortcut ("Celý den" in the month, a free block on the phone): the free time of the day or block is
   * picked ONLY UP TO what the order still misses (rounded up to a whole slot); the rest stays free for ordinary
   * bookings. `whole: true` is the explicit override and books the blocks exactly as they are.
   */
  pickBlocks: (day: DateOnly, blocks: readonly FreeBlock[], options?: { whole?: boolean; unit?: "day" | "block" }) => boolean;
  /** What the shortcut would take from these blocks right now (minutes), and whether the order is already covered. */
  previewTake: (blocks: readonly FreeBlock[]) => { minutes: number; covered: boolean };
  /** Every pick of one day is dropped. */
  removeDay: (day: DateOnly) => void;
  /** A sentence under the calculator (null clears it), optionally with one small action ("Vzít celý den"). */
  setNote: (text: string | null, action?: NoteAction | null) => void;
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
  const [note, setNoteText] = useState<string | null>(null);
  const [noteAction, setNoteAction] = useState<NoteAction | null>(null);
  const setNote = useCallback((text: string | null, action: NoteAction | null = null) => {
    setNoteText(text);
    setNoteAction(action);
  }, []);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<{
    message: string;
    conflict: string | null;
    ids: string[];
    athletes: number;
    athleteNames: string[];
    removedFromWindow: boolean;
  } | null>(null);
  const [result, setResult] = useState<ClubOrderView | null>(null);
  const [duplicate, setDuplicate] = useState<ClubOrderView | null>(null);
  const [resultTitle, setResultTitle] = useState("Objednávka potvrzena");

  const picks = useMemo(() => timePicks(multi.items), [multi.items]);
  const pickedMinutes = pickedMinutesOf(multi.items);
  const activities = useMemo(() => session?.activities ?? [], [session]);
  /* Etapa 10: the činnosti that can be routed (players expected), and each picked window's allowed set. */
  const routable = useMemo(() => activities.filter((a) => a.seats > 0).map((a) => ({ activityId: a.activityId, name: a.name })), [activities]);
  const routableIds = useMemo(() => routable.map((a) => a.activityId), [routable]);
  const windows = useMemo(() => pickedWindowsOf(multi.items), [multi.items]);
  const baseline = session?.editOrder?.baseline;
  /* Enlarging an order: only what the added players cost is missing (see `coverageOf`). */
  const takeState = useMemo(
    () => ({ activities, ...(baseline !== undefined ? { baseline } : {}), pickedMinutes, windows }),
    [activities, baseline, pickedMinutes, windows],
  );
  const coverage = useMemo(() => coverageOf(takeState), [takeState]);
  const itemsRef = useRef(multi.items);
  itemsRef.current = multi.items;

  const serviceCalendarIds = useMemo(
    () => new Set(calendars.filter((c) => session !== null && c.clinicServiceId === session.serviceId).map((c) => c.id)),
    [calendars, session],
  );
  const calendarName = useCallback((id: string) => calendars.find((c) => c.id === id)?.name ?? "", [calendars]);


  const clearFailure = useCallback(() => setFailure((f) => (f === null ? f : null)), []);

  const start = useCallback(
    (next: PickSession) => {
      multi.clear();
      setSession(next);
      setNote(null);
      setFailure(null);
      setResult(null);
      /* Editing an order: its windows are the first picks (so the numbers start where the order is). */
      const own = next.editOrder?.mode === "edit" ? next.editOrder.blocks : [];
      const sessionIds = next.activities.filter((a) => a.seats > 0).map((a) => a.activityId);
      const fromBlocks = own.flatMap((block) =>
        picksFromRanges([{ ...block.range, activityIds: normalizeAllowed(block.range.activityIds, sessionIds) }], block.calendarId, (id) => id),
      );
      const first = fromBlocks;
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
      void invalidateClubWorld(queryClient);
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
          athleteNames: athletes > 0 ? error.affectedAthletes.map((a) => (a.activityName ? `${a.name} (${a.activityName})` : a.name)) : [],
          removedFromWindow: athletes > 0 && error.affectedAthletes.some((a) => a.reason === REASON_ACTIVITY_REMOVED),
        });
      } else {
        setFailure({ message: "Objednávku se nepodařilo uložit. Výběr zůstal — zkuste to znovu.", conflict: null, ids: [], athletes: 0, athleteNames: [], removedFromWindow: false });
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
        const mergedIds = merged.activities.filter((a) => a.seats > 0).map((a) => a.activityId);
        const own = (merged.editOrder?.blocks ?? []).flatMap((block) =>
          picksFromRanges([{ ...block.range, activityIds: normalizeAllowed(block.range.activityIds, mergedIds) }], block.calendarId, (id) => id),
        );
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
            /* A window that allows only some činnosti says which ("Spiroergometrie") on its bar. */
            tagOf: (id) => {
              const item = multi.items.find((i) => i.id === id);
              return item?.kind === "time" ? allowedNames(item.activityIds, routable, "short") : null;
            },
          },
    [session, serviceCalendarIds, todayKey, nowMinute, multi, conflictIds, ownBlockIds, clearFailure, routable],
  );

  const pickBlocks = useCallback(
    (day: DateOnly, blocks: readonly FreeBlock[], options?: { whole?: boolean; unit?: "day" | "block" }): boolean => {
      if (blocks.length === 0) {
        setNote("V tento den už není volný čas.");
        return false;
      }
      const unit = options?.unit ?? "day";
      const add = (list: readonly FreeBlock[]) => {
        for (const t of list) {
          multi.add({ kind: "time", columnKey: t.calendarId, calendarId: t.calendarId, activityId: null, dayKey: day, range: t.range });
        }
      };
      /* The explicit "whole" is booked exactly as it is. */
      if (options?.whole === true) {
        add(blocks);
        clearFailure();
        setNote(null);
        return true;
      }
      const take = takeNeeded(takeState, blocks);
      if (take.covered) {
        clearFailure();
        setNote(CAL_TEXT.pick.alreadyCovered);
        return false;
      }
      add(take.blocks);
      clearFailure();
      if (!take.trimmed) {
        setNote(null);
        return true;
      }
      /* Trimmed: say so once, and offer the whole day (or block) as an explicit, exact pick. */
      const created = take.blocks;
      setNote(CAL_TEXT.pick.trimmed(formatFree(take.minutes), unit), {
        label: unit === "day" ? CAL_TEXT.pick.takeWholeDay : CAL_TEXT.pick.takeWholeBlock,
        onClick: () => {
          const current = timePicks(itemsRef.current);
          const mine = current.filter((p) => p.dayKey === day && created.some((c) => c.calendarId === p.calendarId && c.range.start === p.range.start && c.range.end === p.range.end));
          for (const p of mine) multi.remove(p.id);
          const gone = new Set(mine.map((p) => p.id));
          for (const b of blocks) {
            const cuts = current.filter((p) => !gone.has(p.id) && p.dayKey === day && p.calendarId === b.calendarId).map((p) => p.range);
            add(subtractRanges(b.range, cuts).map((range) => ({ calendarId: b.calendarId, range })));
          }
          clearFailure();
          setNote(null);
        },
      });
      return true;
    },
    [multi, clearFailure, takeState, setNote],
  );
  const previewTake = useCallback(
    (blocks: readonly FreeBlock[]) => {
      const take = takeNeeded(takeState, blocks);
      return { minutes: take.minutes, covered: take.covered };
    },
    [takeState],
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
          noteAction,
          requested: session.editOrder?.requested ?? [],
          editing: session.editOrder?.mode === "edit",
          confirming,
          failure: failure === null ? null : { message: failure.message, conflict: failure.conflict },
          onRemoveConflict: failure !== null && failure.ids.length > 0 ? removeConflict : null,
          athletesAffected: failure !== null && failure.athletes > 0 ? failure.athletes : null,
          athleteNames: failure?.athleteNames ?? [],
          athletesRemovedFromWindow: failure?.removedFromWindow ?? false,
          activities: routable,
          onToggleActivity: (id, activityId) => {
            const item = multi.items.find((i) => i.id === id);
            if (item?.kind !== "time") return;
            multi.setActivities(id, toggleAllowed(item.activityIds, activityId, routableIds));
            clearFailure();
          },
          onAllActivities: (id) => {
            multi.setActivities(id, null);
            clearFailure();
          },
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

  return { session, active: session !== null, start, cancel: end, gridPick, panel, result, duplicate, resolveDuplicate, resultTitle, closeResult: () => setResult(null), pickBlocks, previewTake, removeDay, setNote };
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
