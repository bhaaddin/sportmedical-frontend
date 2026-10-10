import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { activitiesApi } from "../../../api/activities";
import type { Calendar } from "../../../api/bookingContracts";
import { fetchBlockableActivities } from "../../../api/clubBlocks";
import { ClubOrderError, clubOrdersApi, REASON_ACTIVITY_REMOVED } from "../../../api/clubOrders";
import type { ClubOrderView } from "../../../api/clubOrders";
import { addDaysToDateOnly, type DateOnly } from "../../../utils/time";
import { invalidateClubWorld } from "../../clubs/clubWorld";
import type { CoverageActivity } from "../../clubs/order/coverage";
import { mergeSessionInto } from "../../clubs/order/editSession";
import { orderCode, rangeLine } from "../../clubs/order/orderFormat";
import { rowFromRange, rowIndexForError } from "../../clubs/order/orderLogic";
import { allowedNames, normalizeAllowed, toggleAllowed } from "../../clubs/order/routing";
import type { PickSession } from "../../clubs/order/pickSession";
import { shortDate, weekdayShort } from "../grid/periodTitle";
import type { GridPickMode } from "../grid/TimeGrid";
import { formatFree, type FreeBlock } from "./pickDays";
import { CAL_TEXT } from "./calendarText";
import type { PickedTime } from "./multiSelect";
import { findNextFreeDay } from "./pickNextDay";
import { moreNeeded, stepFor, takeForActivity, trimToNeed, type AskPart, type PickCoverage, type PlanWindow } from "./pickPlan";
import { coverageOf, subtractRanges, takeNeeded } from "./pickTake";
import {
  ordersRangesOf,
  pickedCalendarIds,
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
 * the calendar's `multi` selection; everything else - the live coverage (players still missing, per činnost), the
 * question "for which činnosti is this window" the moment one is picked (Etapa 12), the shortfall confirm, and the
 * final `createStaff` / `update` / `confirm` with its 409 - is here, so the page only wires it to the grid, the panel
 * and the bubbles. Picking is MANUAL only: nothing proposes terms.
 */

export interface NoteAction {
  label: string;
  onClick: () => void;
}

/** What `findLiveOrders` found for this club and this pick's služba. */
export interface LiveOrdersFound {
  /** The club's newest live order of the SAME služba (a merge candidate), null when there is none. */
  sameService: ClubOrderView | null;
  /** Every other live order, one per group, of a DIFFERENT služba (an addendum candidate each), newest first. */
  others: readonly ClubOrderView[];
}

export type DuplicateChoice =
  | { kind: "merge" }
  | { kind: "addendum"; order: ClubOrderView }
  | { kind: "separate" }
  | { kind: "dismiss" };

/**
 * Etapa 12: a window has just been picked (or the desk pressed "Rozdělit" on one) and the bubble asks which činnosti
 * it is for. `windows` are the picks in question (several after a day shortcut around the lunch break), `others` the
 * rest of the pick, so the bubble can count live.
 */
export interface PickAsk {
  /** "new": "Zrušit" removes the windows again. "edit": a window already in the pick, "Zrušit" keeps it as it is. */
  mode: "new" | "edit";
  windows: PickedTime[];
  /** The order's činnosti with players, in the order's order. */
  activities: CoverageActivity[];
  others: PlanWindow[];
  baseline?: CoverageActivity[];
  /** The grid step the window sits on (its calendar's step, or a finer one that fits). */
  stepOf: (calendarId: string) => number;
  calendarName: (calendarId: string) => string;
  /** The price of a činnost (null = none set); the map itself is null while the catalogue loads. */
  prices: ReadonlyMap<string, number | null> | null;
}

/** What the bubble hands back: each window's parts (one part = unchanged window), with the činnosti of each. */
export interface AskResult {
  id: string;
  parts: AskPart[];
}

/**
 * Etapa 12: "Potvrdit objednávku" pressed while players are still without a slot, or with places picked beyond the
 * players (money lost) - the desk decides, nothing is created or trimmed silently.
 */
export interface Shortfall {
  totalSeats: number;
  remainingSeats: number;
  perActivity: { activityId: string; name: string; remainingSeats: number }[];
  /** Calendar minutes the missing players still need (whole slots). */
  neededMinutes: number;
  /** Picked minutes no slot uses (information, never a block). */
  unusedMinutes: number;
  /** Places picked beyond the players, per činnost, with the money they would earn (null = no price set). */
  spare: { activityId: string; name: string; seats: number; minutes: number; lostCzk: number | null }[];
  spareSeats: number;
  editing: boolean;
}

export type ShortfallChoice = "fill" | "trim" | "create";

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
   * The club already has a live order (Requested or Confirmed) that this one could join: the same služba (merge
   * candidate) and/or any other live order of a DIFFERENT služba (addendum candidate). The new order is NOT created
   * until the desk chooses. Null when there is nothing to decide.
   */
  duplicate: LiveOrdersFound | null;
  resolveDuplicate: (choice: DuplicateChoice) => void;
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
  /** Etapa 12: the činnost bubble of a just-picked window (null = nothing to ask). */
  ask: PickAsk | null;
  resolveAsk: (results: readonly AskResult[]) => void;
  cancelAsk: () => void;
  /** Etapa 12: the confirm before creating ("Doplnit termíny" / "Zkrátit na potřebu" / "Vytvořit i tak"); null = nothing to confirm. */
  shortfall: Shortfall | null;
  resolveShortfall: (choice: ShortfallChoice) => void;
}

interface AskState {
  ids: string[];
  mode: "new" | "edit";
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
  /** The desk picked "Přidat jako dodatek k ..." for a different-služba live order: start that order's own addendum flow. */
  onAddendum?: (order: ClubOrderView) => void;
}): PickOrderApi {
  const { multi, calendars, todayKey, nowMinute, onStarted, onEnded, onCreated, onAddendum } = input;
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
  const [duplicate, setDuplicate] = useState<LiveOrdersFound | null>(null);
  const [resultTitle, setResultTitle] = useState("Objednávka potvrzena");
  const [askState, setAskState] = useState<AskState | null>(null);
  const [shortfall, setShortfall] = useState<(Shortfall & { cancelAthletes: boolean }) | null>(null);
  const [focusActivityId, setFocusActivityId] = useState<string | null>(null);
  const [addingDay, setAddingDay] = useState<string | null>(null);
  /* Etapa 12: once every player has a slot the grid takes no new pick - "Přidat termín navíc" arms exactly one. */
  const [extraArmed, setExtraArmed] = useState(false);

  const picks = useMemo(() => timePicks(multi.items), [multi.items]);
  const activities = useMemo(() => session?.activities ?? [], [session]);
  /* Etapa 10: the činnosti that can be routed (players expected), and each picked window's allowed set. */
  const routableActivities = useMemo(() => activities.filter((a) => a.seats > 0), [activities]);
  const routable = useMemo(() => routableActivities.map((a) => ({ activityId: a.activityId, name: a.name })), [routableActivities]);
  const routableIds = useMemo(() => routable.map((a) => a.activityId), [routable]);
  const baseStep = useCallback((calendarId: string) => calendars.find((c) => c.id === calendarId)?.displayStepMinutes ?? 30, [calendars]);
  const stepOf = useCallback((calendarId: string, range?: { start: number; end: number }) => (range === undefined ? baseStep(calendarId) : stepFor(range, baseStep(calendarId))), [baseStep]);
  /* Every picked window as the calculator reads it (Etapa 12: counted individually per činnost). */
  const windows = useMemo<PlanWindow[]>(
    () =>
      picks.map((p) => ({
        id: p.id,
        range: p.range,
        dayKey: p.dayKey,
        activityIds: normalizeAllowed(p.activityIds, routableIds),
        step: stepFor(p.range, baseStep(p.calendarId)),
      })),
    [picks, routableIds, baseStep],
  );
  const baseline = session?.editOrder?.baseline;
  /* Enlarging an order: only what the added players cost is missing (see `pickCoverage`). */
  const takeState = useMemo(() => ({ activities, ...(baseline !== undefined ? { baseline } : {}), windows }), [activities, baseline, windows]);
  const coverage: PickCoverage = useMemo(() => coverageOf(takeState), [takeState]);
  const itemsRef = useRef(multi.items);
  itemsRef.current = multi.items;
  const full = coverage.covered;
  const accepting = !full || extraArmed;
  useEffect(() => {
    if (!full && extraArmed) setExtraArmed(false);
  }, [full, extraArmed]);

  const serviceCalendars = useMemo(() => calendars.filter((c) => session !== null && c.clinicServiceId === session.serviceId), [calendars, session]);
  const serviceCalendarIds = useMemo(() => new Set(serviceCalendars.map((c) => c.id)), [serviceCalendars]);
  const calendarName = useCallback((id: string) => calendars.find((c) => c.id === id)?.name ?? "", [calendars]);

  /* The prices of the činnosti for the bubble (the price list, through the activity). Nothing waits for it. */
  const pricesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesApi.list(),
    enabled: session !== null && routable.length > 1,
    staleTime: 5 * 60 * 1000,
  });
  const prices = useMemo<ReadonlyMap<string, number | null> | null>(
    () => (pricesQuery.data === undefined ? null : new Map(pricesQuery.data.activities.map((a) => [a.id, a.priceCzk ?? null] as const))),
    [pricesQuery.data],
  );

  const clearFailure = useCallback(() => setFailure((f) => (f === null ? f : null)), []);

  /*
   * Etapa 12: the bubble. A pick that comes from the grid or a shortcut "arms" the question with the ids known
   * before it; the effect below sees the new ids once they exist and opens the bubble for them - synchronously
   * with the pick, nothing waits for a query. Only when the order has at least two činnosti with players.
   */
  const armRef = useRef<Set<string> | null>(null);
  const arm = useCallback(() => {
    armRef.current = routable.length > 1 ? new Set(itemsRef.current.map((i) => i.id)) : null;
  }, [routable.length]);
  useEffect(() => {
    const known = armRef.current;
    if (known === null) return;
    armRef.current = null;
    const fresh = timePicks(multi.items).filter((i) => !known.has(i.id)).map((i) => i.id);
    if (fresh.length > 0) {
      setAskState({ ids: fresh, mode: "new" });
      setExtraArmed(false);
    }
  }, [multi.items]);
  /* The one extra pick was added (also when the order has a single činnost and nothing is asked): the guard re-arms. */
  const pickCountRef = useRef(picks.length);
  useEffect(() => {
    if (picks.length > pickCountRef.current && extraArmed) setExtraArmed(false);
    pickCountRef.current = picks.length;
  }, [picks.length, extraArmed]);

  const start = useCallback(
    (next: PickSession) => {
      multi.clear();
      armRef.current = null;
      setAskState(null);
      setShortfall(null);
      setFocusActivityId(null);
      setExtraArmed(false);
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
    armRef.current = null;
    setAskState(null);
    setShortfall(null);
    setFocusActivityId(null);
    setSession(null);
    setNote(null);
    setFailure(null);
    onEnded?.();
  }, [multi, onEnded]);

  const confirm = useCallback(async (cancelAthletes = false, skipDuplicateCheck = false, force = false) => {
    if (session === null || picks.length === 0 || confirming) return;
    /* Etapa 12 (constitution IV): players without a slot, or places picked beyond them, never slip through - the desk is asked first. */
    if (!force && (coverage.remainingSeats > 0 || coverage.spareSeats > 0)) {
      const short = coverage.perActivity.filter((a) => a.remainingSeats > 0);
      setShortfall({
        totalSeats: coverage.totalSeats,
        remainingSeats: coverage.remainingSeats,
        perActivity: short.map((a) => ({ activityId: a.activityId, name: a.name, remainingSeats: a.remainingSeats })),
        neededMinutes: short.reduce((n, a) => n + moreNeeded(a, null).minutes, 0),
        unusedMinutes: coverage.unusedMinutes,
        spare: coverage.perActivity
          .filter((a) => a.spareSeats > 0)
          .map((a) => {
            const price = prices?.get(a.activityId) ?? null;
            return { activityId: a.activityId, name: a.name, seats: a.spareSeats, minutes: a.spareMinutes, lostCzk: price === null ? null : price * a.spareSeats };
          }),
        spareSeats: coverage.spareSeats,
        editing: session.editOrder?.mode === "edit",
        cancelAthletes,
      });
      return;
    }
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
        /* Never silently a second, disconnected order: a club that already holds ANY live order - same služba
         * (a merge candidate) or a different one (an addendum candidate) - chooses first. */
        if (editing === undefined && session.parentOrderId === undefined && !skipDuplicateCheck) {
          const found = await findLiveOrders(queryClient, session.clubId, session.serviceId);
          if (found.sameService !== null || found.others.length > 0) {
            setDuplicate(found);
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
      setAskState(null);
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
  }, [session, picks, confirming, coverage, prices, multi, todayKey, queryClient, onCreated, onEnded]);

  const resolveShortfall = useCallback(
    (choice: ShortfallChoice) => {
      const current = shortfall;
      setShortfall(null);
      if (current === null) return;
      if (choice === "fill") {
        setFocusActivityId(current.perActivity[0]?.activityId ?? null);
        return;
      }
      if (choice === "trim") {
        /* "Zkrátit na potřebu": only on this click - the spare windows are cut back to what the players use. */
        for (const change of trimToNeed(activities, windows)) {
          if (change.range === null) multi.remove(change.id);
          else multi.update(change.id, change.range);
        }
        clearFailure();
        setNote("Termíny zkráceny na potřebu hráčů.");
        return;
      }
      /* "Vytvořit i tak": the order as it is - the desk decided. The duplicate check still runs. */
      void confirm(current.cancelAthletes, false, true);
    },
    [shortfall, confirm, activities, windows, multi, clearFailure, setNote],
  );

  /* "Vytvořit samostatnou objednávku" after the duplicate dialog repeats the confirm; the shortfall was already decided. */
  const resolveDuplicate = useCallback(
    (choice: DuplicateChoice) => {
      const found = duplicate;
      setDuplicate(null);
      if (found === null || session === null) return;
      if (choice.kind === "separate") {
        void confirm(false, true, true);
        return;
      }
      if (choice.kind === "dismiss") return;
      if (choice.kind === "addendum") {
        /* The desk picks a DIFFERENT live order to extend: leave this pick behind (it is not created) and hand off
         * to that order's own "Přidat další službu" flow - exactly what its own button does. */
        multi.clear();
        setAskState(null);
        setSession(null);
        setNote(null);
        setFailure(null);
        onEnded?.();
        onAddendum?.(choice.order);
        return;
      }
      /* "merge": the new picks and players join the SAME-služba order; its windows are painted again, the new ones stay on top. */
      const existing = found.sameService;
      if (existing === null) return;
      void (async () => {
        const catalogue = await queryClient
          .fetchQuery({ queryKey: ["club-block-activities"], queryFn: fetchBlockableActivities, staleTime: 5 * 60 * 1000 })
          .catch(() => []);
        const merged = mergeSessionInto(existing, session, catalogue, todayKey);
        const mergedIds = merged.activities.filter((a) => a.seats > 0).map((a) => a.activityId);
        const own = (merged.editOrder?.blocks ?? []).flatMap((block) =>
          picksFromRanges([{ ...block.range, activityIds: normalizeAllowed(block.range.activityIds, mergedIds) }], block.calendarId, (id) => id),
        );
        armRef.current = null;
        multi.replace([...own, ...withoutIds(multi.items)]);
        setSession(merged);
        setFailure(null);
        setNote(`Přidáno do objednávky ${orderCode(existing.id)}. Zkontrolujte termíny a uložte změny.`);
      })();
    },
    [duplicate, session, confirm, queryClient, todayKey, multi, onEnded, onAddendum],
  );

  const ownBlockIds = useMemo(() => new Set((session?.editOrder?.blocks ?? []).map((b) => b.id)), [session]);
  const conflictIds = useMemo(() => new Set(failure?.ids ?? []), [failure]);
  const removeConflict = useCallback(() => {
    for (const id of failure?.ids ?? []) multi.remove(id);
    setFailure(null);
  }, [failure, multi]);

  const noteRef = useRef(setNote);
  noteRef.current = setNote;
  const armRefFn = useRef(arm);
  armRefFn.current = arm;

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
            /* Etapa 12: a paint or tap is about to add a window - the bubble asks for its činnosti once it exists. */
            onPicked: () => armRefFn.current(),
            /* Etapa 12: every player has a slot - the grid refuses a new pick until "Přidat termín navíc". */
            accepting,
            ignoreClubBlockIds: ownBlockIds,
            onAdjust: (id, range) => {
              armRef.current = null;
              multi.update(id, range);
              clearFailure();
            },
            onRemove: (id) => {
              armRef.current = null;
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
    [session, serviceCalendarIds, todayKey, nowMinute, multi, conflictIds, ownBlockIds, clearFailure, routable, accepting],
  );

  const pickBlocks = useCallback(
    (day: DateOnly, blocks: readonly FreeBlock[], options?: { whole?: boolean; unit?: "day" | "block" }): boolean => {
      if (blocks.length === 0) {
        setNote("V tento den už není volný čas.");
        return false;
      }
      const unit = options?.unit ?? "day";
      const add = (list: readonly FreeBlock[], activityIds: string[] | null = null) => {
        for (const t of list) {
          multi.add({ kind: "time", columnKey: t.calendarId, calendarId: t.calendarId, activityId: null, dayKey: day, range: t.range, activityIds });
        }
      };
      /* The explicit "whole" is booked exactly as it is. */
      if (options?.whole === true) {
        arm();
        add(blocks);
        clearFailure();
        setNote(null);
        return true;
      }
      const take = takeNeeded(takeState, blocks);
      if (take.covered) {
        clearFailure();
        /* With the one extra pick armed the day is still taken whole - the desk asked for more. */
        if (extraArmed) {
          arm();
          add(blocks);
          setNote(null);
          return true;
        }
        setNote(CAL_TEXT.pick.alreadyCovered);
        return false;
      }
      arm();
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
          /* The whole day keeps the činnosti the desk chose for the trimmed pick. */
          const chosen = mine[0]?.activityIds ?? null;
          for (const p of mine) multi.remove(p.id);
          const gone = new Set(mine.map((p) => p.id));
          for (const b of blocks) {
            const cuts = current.filter((p) => !gone.has(p.id) && p.dayKey === day && p.calendarId === b.calendarId).map((p) => p.range);
            add(subtractRanges(b.range, cuts).map((range) => ({ calendarId: b.calendarId, range })), chosen);
          }
          clearFailure();
          setNote(null);
        },
      });
      return true;
    },
    [multi, clearFailure, takeState, setNote, arm, extraArmed],
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

  /* ── Etapa 12: the činnost bubble ── */

  const ask = useMemo<PickAsk | null>(() => {
    if (askState === null || session === null) return null;
    const wanted = new Set(askState.ids);
    const asked = picks.filter((p) => wanted.has(p.id));
    if (asked.length === 0) return null;
    return {
      mode: askState.mode,
      windows: asked,
      activities: routableActivities,
      others: windows.filter((w) => w.id === undefined || !wanted.has(w.id)),
      ...(baseline !== undefined ? { baseline } : {}),
      stepOf: (calendarId: string) => baseStep(calendarId),
      calendarName,
      prices,
    };
  }, [askState, session, picks, routableActivities, windows, baseline, baseStep, calendarName, prices]);
  useEffect(() => {
    if (askState !== null && ask === null) setAskState(null);
  }, [askState, ask]);

  const resolveAsk = useCallback(
    (results: readonly AskResult[]) => {
      for (const r of results) {
        const item = itemsRef.current.find((i) => i.id === r.id);
        if (item?.kind !== "time") continue;
        const [first, ...rest] = r.parts;
        if (first === undefined) continue;
        if (first.range.start !== item.range.start || first.range.end !== item.range.end) multi.update(r.id, first.range);
        multi.setActivities(r.id, normalizeAllowed(first.activityIds, routableIds));
        for (const p of rest) {
          multi.add({
            kind: "time",
            columnKey: item.columnKey,
            calendarId: item.calendarId,
            activityId: item.activityId,
            dayKey: item.dayKey,
            range: p.range,
            activityIds: normalizeAllowed(p.activityIds, routableIds),
          });
        }
      }
      armRef.current = null;
      setAskState(null);
      clearFailure();
    },
    [multi, routableIds, clearFailure],
  );
  const cancelAsk = useCallback(() => {
    const current = askState;
    setAskState(null);
    if (current === null) return;
    if (current.mode === "new") {
      for (const id of current.ids) multi.remove(id);
      clearFailure();
      setNote(null);
    }
  }, [askState, multi, clearFailure, setNote]);

  /* ── Etapa 12: "Přidat další den" for one činnost that is still short ── */

  const addDayFor = useCallback(
    async (activityId: string) => {
      if (session === null || addingDay !== null) return;
      const activity = activities.find((a) => a.activityId === activityId);
      const cov = coverage.perActivity.find((a) => a.activityId === activityId);
      if (activity === undefined || cov === undefined || cov.remainingSeats <= 0) return;
      setAddingDay(activityId);
      try {
        const current = timePicks(itemsRef.current);
        const last = current.reduce<DateOnly | null>((m, p) => (m === null || p.dayKey > m ? p.dayKey : m), null);
        const from = last !== null && last >= todayKey ? addDaysToDateOnly(last, 1) : todayKey;
        const found = await findNextFreeDay({ calendars: serviceCalendars, from, today: todayKey, nowMinute: nowMinute ?? 0, picks: itemsRef.current });
        if (found === null) {
          setNote(`Pro ${activity.name} není v nejbližších 14 dnech po posledním termínu volný den.`);
          return;
        }
        const step = found.blocks[0] === undefined ? 5 : baseStep(found.blocks[0].calendarId);
        const take = takeForActivity(found.blocks, activity, cov.remainingSeats, step);
        if (take.blocks.length === 0) {
          setNote(`${weekdayShort(found.day)} ${shortDate(found.day)}: volný čas je kratší než jeden slot ${activity.name}.`);
          return;
        }
        armRef.current = null;
        for (const b of take.blocks) {
          multi.add({ kind: "time", columnKey: b.calendarId, calendarId: b.calendarId, activityId: null, dayKey: found.day, range: b.range, activityIds: [activityId] });
        }
        clearFailure();
        const slots = `${take.slots} ${take.slots === 1 ? "slot" : take.slots >= 2 && take.slots <= 4 ? "sloty" : "slotů"}`;
        setNote(`Přidán ${weekdayShort(found.day)} ${shortDate(found.day)} pro ${activity.name} (${slots}).`);
      } finally {
        setAddingDay(null);
      }
    },
    [session, addingDay, activities, coverage, todayKey, serviceCalendars, nowMinute, baseStep, multi, clearFailure, setNote],
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
          ...(routable.length > 1 ? { onSplitPick: (id: string) => setAskState({ ids: [id], mode: "edit" }) } : {}),
          onAddDay: (activityId: string) => void addDayFor(activityId),
          addingDay,
          focusActivityId,
          onFocused: () => setFocusActivityId(null),
          accepting,
          extraArmed,
          onExtraPick: () => {
            setExtraArmed(true);
            setNote("Další termín: označte ho v kalendáři (jen jeden, potom se výběr zase uzavře).");
          },
          prices,
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

  const shortfallView: Shortfall | null = useMemo(() => {
    if (shortfall === null) return null;
    const { cancelAthletes: _cancelAthletes, ...rest } = shortfall;
    return rest;
  }, [shortfall]);

  return {
    session,
    active: session !== null,
    start,
    cancel: end,
    gridPick,
    panel,
    result,
    duplicate,
    resolveDuplicate,
    resultTitle,
    closeResult: () => setResult(null),
    pickBlocks,
    previewTake,
    removeDay,
    setNote,
    ask,
    resolveAsk,
    cancelAsk,
    shortfall: shortfallView,
    resolveShortfall,
  };
}

/**
 * The club's live (Requested/Confirmed) orders split against this pick's služba: the newest one of the SAME
 * služba (a merge candidate), and every other live order of a DIFFERENT služba (one per group, newest first - an
 * addendum candidate each). Empty/null on both sides when there is nothing to ask, also when the list cannot be read.
 */
async function findLiveOrders(queryClient: ReturnType<typeof useQueryClient>, clubId: string, serviceId: string): Promise<LiveOrdersFound> {
  try {
    const orders = await queryClient.fetchQuery({
      queryKey: ["club-orders", "pick-duplicate", clubId],
      queryFn: () => clubOrdersApi.list({ clubId }),
      staleTime: 0,
    });
    const live = orders.filter((o) => o.status === "Requested" || o.status === "Confirmed");
    const byNewest = (a: ClubOrderView, b: ClubOrderView) => b.createdAtUtc.localeCompare(a.createdAtUtc);
    const sameService = live.filter((o) => o.serviceId === serviceId).sort(byNewest)[0] ?? null;
    /* One row per group (an addendum shares its root's groupId): the ROOT order represents the group when it is
     * itself live, so the code shown here is the same one the addendum flow's own "Dodatek k objednávce" names;
     * the newest member stands in when the root itself is not live (e.g. already completed or cancelled). */
    const byGroup = new Map<string, ClubOrderView[]>();
    for (const o of live.filter((o) => o.serviceId !== serviceId)) {
      const members = byGroup.get(o.groupId);
      if (members === undefined) byGroup.set(o.groupId, [o]);
      else members.push(o);
    }
    const others = [...byGroup.values()]
      .map((members) => members.find((m) => m.id === m.groupId) ?? members.slice().sort(byNewest)[0])
      .sort(byNewest);
    return { sameService, others };
  } catch {
    return { sameService: null, others: [] };
  }
}
