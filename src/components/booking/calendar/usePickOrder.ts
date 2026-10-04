import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Calendar } from "../../../api/bookingContracts";
import { ClubOrderError, clubOrdersApi } from "../../../api/clubOrders";
import type { ClubOrderView } from "../../../api/clubOrders";
import { dayOfWeekOf, type DateOnly } from "../../../utils/time";
import { useBlockCalculation } from "../../clubs/dialog/useBlockCalculation";
import { computeCoverage, pickAllowance } from "../../clubs/order/coverage";
import { rangeLine } from "../../clubs/order/orderFormat";
import { rowFromRange, rowIndexForError } from "../../clubs/order/orderLogic";
import type { PickSession } from "../../clubs/order/pickSession";
import { formatDayMonth } from "../../clubs/blockLogic";
import type { GridPickMode } from "../grid/TimeGrid";
import type { NewPicked } from "./multiSelect";
import {
  earliestPick,
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
 * the calendar's `multi` selection; everything else - the live coverage, the stop at "enough", the automatic
 * proposal, the final `createStaff` with its 409 - is here, so the page only wires it to the grid and the panel.
 */

const WEEKDAY_SHOWN = ["ne", "po", "út", "st", "čt", "pá", "so"];

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
  closeResult: () => void;
}

export function usePickOrder(input: {
  multi: MultiSelectApi;
  calendars: readonly Calendar[];
  todayKey: DateOnly;
  /** The grid is about to show only this služba's calendars (the page narrows its filters). */
  onStarted?: (session: PickSession) => void;
  onEnded?: () => void;
  onCreated?: (order: ClubOrderView) => void;
}): PickOrderApi {
  const { multi, calendars, todayKey, onStarted, onEnded, onCreated } = input;
  const queryClient = useQueryClient();
  const [session, setSession] = useState<PickSession | null>(null);
  const [allowReserve, setAllowReserve] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [proposing, setProposing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<{ message: string; conflict: string | null; ids: string[] } | null>(null);
  const [undo, setUndo] = useState<NewPicked[] | null>(null);
  const [result, setResult] = useState<ClubOrderView | null>(null);

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

  /* The server's own count of the same picks, shown only when it says something else. */
  const orderRanges = useMemo(() => ordersRangesOf(multi.items, todayKey), [multi.items, todayKey]);
  const usedCalendars = useMemo(() => pickedCalendarIds(multi.items), [multi.items]);
  const seatsMap = useMemo(() => Object.fromEntries(activities.map((a) => [a.activityId, a.seats])), [activities]);
  const calc = useBlockCalculation({
    activityIds: activities.map((a) => a.activityId),
    seats: seatsMap,
    legacyCount: null,
    calendarIds: usedCalendars,
    rows: useMemo(() => orderRanges.map(rowFromRange), [orderRanges]),
  });
  const analysis = calc.calc?.analysis ?? null;
  const serverNote =
    session !== null && picks.length > 0 && !calc.busy && analysis !== null &&
    (Math.abs(analysis.totalNeededMinutes - coverage.neededMinutes) >= 1 || Math.abs(analysis.availableMinutes - coverage.pickedMinutes) >= 1)
      ? { neededMinutes: Math.round(analysis.totalNeededMinutes), availableMinutes: Math.round(analysis.availableMinutes) }
      : null;

  const clearFailure = useCallback(() => setFailure((f) => (f === null ? f : null)), []);

  const start = useCallback(
    (next: PickSession) => {
      multi.clear();
      setSession(next);
      setAllowReserve(false);
      setNote(null);
      setFailure(null);
      setUndo(null);
      setResult(null);
      onStarted?.(next);
    },
    [multi, onStarted],
  );

  const end = useCallback(() => {
    multi.clear();
    setSession(null);
    setNote(null);
    setFailure(null);
    setUndo(null);
    setAllowReserve(false);
    onEnded?.();
  }, [multi, onEnded]);

  const earliest = earliestPick(multi.items);
  const proposalFrom = earliest === null ? null : `${formatDayMonth(earliest.date)} (${WEEKDAY_SHOWN[dayOfWeekOf(earliest.date)]}) v ${earliest.time}`;

  const propose = useCallback(async () => {
    if (session === null || earliest === null) return;
    setProposing(true);
    setFailure(null);
    try {
      const answer = await clubOrdersApi.proposal({
        serviceId: session.serviceId,
        activitySeats: session.activities.map((a) => ({ activityId: a.activityId, seats: a.seats })),
        calendarIds: [earliest.calendarId],
        startDate: earliest.date,
        startTime: earliest.time,
        ...(weekdays.length > 0 ? { daysOfWeek: weekdays } : {}),
      });
      if (answer.ranges.length === 0) {
        setNote("Server nenašel žádný volný termín od tohoto místa. Zkuste jiný začátek nebo jiné dny.");
        return;
      }
      setUndo(withoutIds(multi.items));
      multi.replace(picksFromRanges(answer.ranges, earliest.calendarId, (id) => id));
      setNote("Návrh je rozložen od vybraného místa — upravte ho podle potřeby (tažením, ×).");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Automatický návrh se nepodařilo získat.");
    } finally {
      setProposing(false);
    }
  }, [session, earliest, weekdays, multi]);

  const undoProposal = useCallback(() => {
    if (undo === null) return;
    multi.replace(undo);
    setUndo(null);
    setNote(null);
  }, [undo, multi]);

  const confirm = useCallback(async () => {
    if (session === null || picks.length === 0 || confirming) return;
    const ranges = ordersRangesOf(multi.items, todayKey);
    const calendarIds = pickedCalendarIds(multi.items);
    setConfirming(true);
    setFailure(null);
    try {
      const order = await clubOrdersApi.createStaff({
        clubId: session.clubId,
        serviceId: session.serviceId,
        activitySeats: session.activities.map((a) => ({ activityId: a.activityId, seats: a.seats })),
        paymentMethod: session.paymentMethod,
        ranges,
        calendarIds,
        status: "Confirmed",
        ...(session.note.trim() !== "" ? { note: session.note.trim() } : {}),
        ...(session.parentOrderId !== undefined ? { parentOrderId: session.parentOrderId } : {}),
      });
      void queryClient.invalidateQueries({ queryKey: ["day-range"] });
      void queryClient.invalidateQueries({ queryKey: ["club-orders"] });
      setResult(order);
      onCreated?.(order);
      toast.success("Objednávka je potvrzená a termíny jsou v kalendáři.");
      multi.clear();
      setSession(null);
      setUndo(null);
      onEnded?.();
    } catch (error) {
      if (error instanceof ClubOrderError) {
        const index = rowIndexForError(error, ranges.map(rowFromRange));
        const range = index === null ? null : ranges[index];
        const ids = range === null ? [] : picks.filter((p) => pickInRange(p, range)).map((p) => p.id);
        setFailure({
          message: error.message,
          conflict: range === null ? null : rangeLine(range),
          ids,
        });
      } else {
        setFailure({ message: "Objednávku se nepodařilo uložit. Výběr zůstal — zkuste to znovu.", conflict: null, ids: [] });
      }
    } finally {
      setConfirming(false);
    }
  }, [session, picks, confirming, multi, todayKey, queryClient, onCreated, onEnded]);

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
            onNote: (text) => noteRef.current(text),
            onAdjust: (id, range) => {
              multi.update(id, range);
              clearFailure();
              setUndo(null);
            },
            onRemove: (id) => {
              multi.remove(id);
              clearFailure();
            },
            conflictIds,
          },
    [session, allowance, serviceCalendarIds, todayKey, multi, conflictIds, clearFailure],
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
          serverNote,
          proposalFrom,
          weekdays,
          onWeekdays: setWeekdays,
          proposing,
          confirming,
          failure: failure === null ? null : { message: failure.message, conflict: failure.conflict },
          onRemoveConflict: failure !== null && failure.ids.length > 0 ? removeConflict : null,
          onUndoProposal: undo !== null ? undoProposal : null,
          onPropose: () => void propose(),
          onConfirm: () => void confirm(),
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

  return { session, active: session !== null, start, cancel: end, gridPick, panel, result, closeResult: () => setResult(null) };
}
