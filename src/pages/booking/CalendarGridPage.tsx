import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonBase,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  MenuItem,
  Popover,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RemoveIcon from "@mui/icons-material/Remove";
import TuneIcon from "@mui/icons-material/Tune";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { Link as MuiLink } from "@mui/material";
import { calendarsApi } from "../../api/calendars";
import { clinicServicesApi } from "../../api/clinicServices";
import { holidaysApi, type ClinicHoliday } from "../../api/holidays";
import { readPublicClinic } from "../../api/clinicSettings";
import { usePermission } from "../../auth/usePermission";
import { appointmentsApi } from "../../api/appointments";
import { workingHoursApi } from "../../api/workingHours";
import { statusTally } from "../../api/bookingContracts";
import type { DayAppointment, PreviewDay, TimeBlock } from "../../api/bookingContracts";
import { AsyncSection } from "../../components/booking/AsyncSection";
import { AppointmentDetail } from "../../components/booking/AppointmentDetail";
import { NewAppointmentDialog } from "../../components/booking/NewAppointmentDialog";
import { CalendarFilters, GridSidebar, type GridView, type LegendService } from "../../components/booking/grid/GridSidebar";
import { TimeGrid, toRequest, type GridBookingRequest, type GridMoveRequest } from "../../components/booking/grid/TimeGrid";
import {
  closedHolidayDates,
  dayMark,
  holidayDates,
  yearsBetween,
  type DayMark,
} from "../../components/booking/grid/dayMarks";
import {
  dayBelongsTo,
  employeesIn,
  mondayOf,
  toggleCalendar,
  visibleCalendars,
  type Employee,
} from "../../components/booking/grid/filters";
import { GRID_TEXT } from "../../components/booking/grid/gridText";
import {
  NEXT_FREE_HORIZON_DAYS,
  nextFreeSlotAcrossDays,
  type DayFacts,
} from "../../components/booking/grid/nextFreeSlot";
import type { FoundSlot } from "../../components/booking/NewAppointmentDialog";
import { resolveNowLineColor } from "../../components/booking/grid/nowLine";
import { periodTitle } from "../../components/booking/grid/periodTitle";
import {
  RESOLUTIONS,
  resolutionOf,
  stepResolution,
} from "../../components/booking/grid/resolution";
import { useCalendarDisplay } from "../../api/displaySettings";
import {
  formatMinutes,
  localDateTime,
  parseTimeOfDay,
  pragueMinuteOfDay,
  spanOnDay,
  touchesDay,
  visibleHours,
  type MinuteRange,
} from "../../components/booking/grid/timeRange";
import { CAL_TEXT } from "../../components/booking/calendar/calendarText";
import { ClubBlockPopover, type ClubBlockPick, type ClubBlockRef } from "../../components/booking/calendar/ClubBlockPopover";
import { MonthView } from "../../components/booking/calendar/MonthView";
import { MoveConfirmDialog } from "../../components/booking/calendar/MoveConfirmDialog";
import { clubWindowsByDay as clubWindowsByDay_, type ClubWindow } from "../../components/booking/calendar/clubWindows";
import { clubBlocksApi, fetchBlockableActivities } from "../../api/clubBlocks";
import type { ClubOrderView } from "../../api/clubOrders";
import { PhoneCalendar } from "../../components/booking/calendar/PhoneCalendar";
import { RangeBlockDialog } from "../../components/booking/calendar/RangeBlockDialog";
import { SelectionPopover } from "../../components/booking/calendar/SelectionPopover";
import {
  buildColumns,
  clubBlockDates,
  dayCount,
  daysWord,
  passesService,
  rangeDates,
  serviceIdOfAppointment,
  type OpenClubBlockState,
} from "../../components/booking/calendar/model";
import { useCalendarCatalogue } from "../../components/booking/calendar/useCalendarCatalogue";
import { useDayRange } from "../../components/booking/calendar/useDayRange";
import { useMultiSelect } from "../../components/booking/calendar/useMultiSelect";
import { MultiBlockDialog } from "../../components/booking/calendar/MultiBlockDialog";
import { SelectionTray } from "../../components/booking/calendar/SelectionTray";
import { AddToClubOrderDialog } from "../../components/booking/calendar/AddToClubOrderDialog";
import type { PickedRange } from "../../components/booking/calendar/multiSelect";
import { ClubOrderEntry } from "../../components/clubs/order/ClubOrderEntry";
import { PickOrderSetup } from "../../components/clubs/order/PickOrderSetup";
import { OrderSuccess } from "../../components/clubs/order/OrderSuccess";
import { editSessionFor } from "../../components/clubs/order/editSession";
import { readPickOrderState } from "../../components/clubs/order/pickSession";
import type { PickParent } from "../../components/clubs/order/pickSession";
import { PickOrderPanel } from "../../components/booking/calendar/PickOrderPanel";
import { usePickOrder } from "../../components/booking/calendar/usePickOrder";
import { PickDuplicateDialog } from "../../components/booking/calendar/PickDuplicateDialog";
import { usePickJump } from "../../components/booking/calendar/usePickJump";
import { useInquiries } from "../../components/booking/calendar/inquiries";
import { useWindowRestrictions } from "../../components/booking/calendar/windowRestrictions";
import { PickMonthView } from "../../components/booking/calendar/PickMonthView";
import { FreeBlocksList } from "../../components/booking/calendar/FreeBlocksList";
import { freeBlocksOfDay, minutesOfBlocks, type FreeBlock } from "../../components/booking/calendar/pickDays";
import { timePicks } from "../../components/booking/calendar/pickLogic";
import { SidebarPortal, useHasSidebarSlot } from "../../components/shell/SidebarSlot";
import { PinnedActionBar } from "../../components/ui/PinnedActionBar";
import { useDevice } from "../../layout/useDevice";
import { DESIGN } from "../../theme";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { addDaysToDateOnly, pragueDateKey } from "../../utils/time";
import { inactiveAmong } from "./calendarLifecycle";

/**
 * The calendar - contract screen 5.1, drawn to the board of 3. 10. 2026
 * (Main, L01-Tyden, L01-Mesic, Z-60 / Z-30 / Z-10, N-Slot) and built for the
 * three widths at once:
 *
 *   DESKTOP ≥1280  top bar, ROZLIŠENÍ toolbar, the grid with a column per
 *                  činnost; the mini calendar and the SLUŽBY legend live in the
 *                  shell's sidebar (`SidebarPortal`).
 *   TABLET 768–1279  the same grid, the mini month collapsed above it, the week
 *                  three days wide and scrolling, a 7×6 month with short labels,
 *                  touch drags (press and hold) and tap-tap day ranges.
 *   PHONE ≤767     no grid: the day is a list, the week one day at a time with a
 *                  seven-day strip, the month a list of days; "Nová objednávka"
 *                  pinned at the bottom, calendar and filters in a bottom sheet.
 *
 * Rules that shape it and are easy to break:
 *
 *  - **It never asks for availability** (6.1). The grid draws appointments,
 *    blocks and working hours; a drag only picks a time and the booking dialog
 *    asks the server whether it can be booked.
 *  - **Filters filter.** The calendar checkboxes, the legend and the employee
 *    decide what is drawn; they never just decorate a list that stays the same.
 *  - **Colour never carries meaning alone** (7.1). Every appointment shows its
 *    status as text, every closed day says why in words, and every one of them
 *    is a button, not a div with onClick.
 */

type ViewMode = GridView;

interface BookingPrefill {
  initialDate?: string;
  initialCalendarId?: string;
  /** Clinic local time, `YYYY-MM-DDTHH:mm`. Read by the dialog once it takes them. */
  initialStart?: string;
  initialEnd?: string;
  /** The patient's card said "Objednat termín": the drawer opens with them chosen. */
  initialPatientId?: string;
}

/** Shifts by whole calendar months, clamping a day the target month lacks. */
function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const d = String(Math.min(day, lastDay)).padStart(2, "0");
  const m = String(target.getUTCMonth() + 1).padStart(2, "0");
  return `${target.getUTCFullYear()}-${m}-${d}`;
}

/**
 * The last resort of "Nová objednávka" when the preview for the days ahead
 * cannot be had: the first Monday-to-Friday that is not a known holiday, at
 * the earliest opening time any known day has (08:00 when none is known).
 * A proposal, not a claim - the drawer asks the server whether it is free.
 */
function firstOpenWeekday(
  start: { dayKey: string; minute: number },
  known: ReadonlyMap<string, PreviewDay>,
  holidays: ReadonlyMap<string, ClinicHoliday>,
): { dayKey: string; slot: MinuteRange } | null {
  let opening: number | null = null;
  for (const row of known.values()) {
    const at = row.isOpen ? parseTimeOfDay(row.startTime) : null;
    if (at !== null && (opening === null || at < opening)) opening = at;
  }
  const openAt = opening ?? 8 * 60;
  let dayKey = start.dayKey;
  for (let i = 0; i < NEXT_FREE_HORIZON_DAYS; i += 1) {
    const [y, m, d] = dayKey.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const holiday = holidays.get(dayKey);
    const workday = weekday >= 1 && weekday <= 5 && !(holiday?.isHoliday ?? false);
    const known_ = known.get(dayKey);
    const shut = known_ !== undefined && !known_.isOpen;
    if (workday && !shut && (i > 0 || start.minute <= openAt)) {
      return { dayKey, slot: { start: openAt, end: openAt + 30 } };
    }
    dayKey = addDaysToDateOnly(dayKey, 1);
  }
  return null;
}

/*
 * Stable `combine` functions: TanStack reruns one only when a result changed,
 * so the lists below keep their identity between renders and the memos built
 * on them do not rebuild every minute for nothing.
 */
function dataOfEach(results: { data?: TimeBlock[] }[]): (TimeBlock[] | undefined)[] {
  return results.map((r) => r.data);
}

function allHolidays(results: { data?: ClinicHoliday[] }[]): ClinicHoliday[] {
  return results.flatMap((r) => r.data ?? []);
}

/** The square ‹ › buttons of the top bar (44 px, as the board draws them). */
function SquareButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          sx={{
            width: 44,
            height: 44,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: `${DESIGN.radius.lg}px`,
            bgcolor: "background.paper",
            color: "text.primary",
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

export default function CalendarGridPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const device = useDevice();
  const isPhone = device === "phone";
  const isTablet = device === "tablet";
  const inSidebar = useHasSidebarSlot();
  const mayManageCalendars = usePermission("settings.clinic.manage");
  const mayBook = usePermission("bookings.create");
  const mayBlock = usePermission("bookings.edit");

  const [view, setView] = useState<ViewMode>("week");
  /* Vertical zoom for the grid — a per-viewer convenience, remembered locally. */
  const [zoom, setZoom] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("calendarZoom"));
      return v >= 0.6 && v <= 2 ? v : 1;
    } catch {
      return 1;
    }
  });
  const changeZoom = useCallback(
    (delta: number) =>
      setZoom((z) => {
        const next = Math.min(2, Math.max(0.6, Math.round((z + delta) * 10) / 10));
        try {
          localStorage.setItem("calendarZoom", String(next));
        } catch {
          /* storage blocked; zoom still works for this view */
        }
        return next;
      }),
    [],
  );
  const resolution = resolutionOf(zoom);
  const setResolution = (key: string) => {
    const level = RESOLUTIONS.find((r) => r.key === key);
    if (level) changeZoom(level.zoom - zoom);
  };
  const [anchor, setAnchor] = useState<string>(() => pragueDateKey(new Date()));
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  /* The legend's filter: which services are shown (`null` = all). */
  const [serviceSet, setServiceSet] = useState<Set<string> | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  /* 5.9: the dialog is reachable from the button and from a drag on the grid. */
  const [booking, setBooking] = useState<{ key: number; prefill: BookingPrefill } | null>(
    null,
  );
  const [now, setNow] = useState(() => new Date());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterMenu, setFilterMenu] = useState<HTMLElement | null>(null);
  const [clubPick, setClubPick] = useState<ClubBlockPick | null>(null);
  /* "Nová klubová objednávka": the two-way chooser, then the small setup form, then picking in the grid.
     A club order is never STARTED from places marked in the grid - those only book a patient or block time.
     Etapa 12: a place marked the plain way CAN be attached to a club order that already exists (`addToClub`
     below) - that is an edit of that order, never a new one. */
  const [entryOpen, setEntryOpen] = useState(false);
  const [setupFor, setSetupFor] = useState<{ clubId?: string; parent?: PickParent } | null>(null);
  const [rangeBlock, setRangeBlock] = useState<{ from: string; to: string } | null>(null);
  const [moveProposal, setMoveProposal] = useState<GridMoveRequest | null>(null);
  /* Several different places at once: marked with Ctrl/⌘/Shift (or the touch toggle), acted on from the tray. */
  const multi = useMultiSelect(pragueDateKey(now));
  const rangeSelect = useDayRange(multi);
  const [multiBlock, setMultiBlock] = useState(false);
  /*
   * Etapa 12: "Přidat do objednávky klubu" from a plain mark (popover or tray). The underlying selection is kept
   * (not cleared) while this is open, only hidden, so "Zrušit výběr" still works if the desk backs out; `source`
   * says which one to clear once the merge is actually saved.
   */
  const [addToClub, setAddToClub] = useState<{ marked: PickedRange; source: "popover" | "tray" | "pending" } | null>(null);
  /* Escape drops every marked place, wherever the focus is (a dialog keeps its own Escape). */
  const multiCount = multi.items.length;
  const clearMulti = multi.clear;
  const pickingRef = useRef(false);
  useEffect(() => {
    if (multiCount === 0 || multiBlock) return;
    const onKey = (event: KeyboardEvent) => {
      /* The picks of a phone order are dropped only by its own "Zrušit". */
      if (event.key === "Escape" && !pickingRef.current) clearMulti();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [multiCount, multiBlock, clearMulti]);

  /*
   * 6.2 and the now-line: both are facts about the clock. The tick lands on
   * the minute, so the line moves when the clock on the wall does.
   */
  useEffect(() => {
    let interval: number | undefined;
    const tick = () => setNow(new Date());
    const timeout = window.setTimeout(
      () => {
        tick();
        interval = window.setInterval(tick, 60_000);
      },
      60_000 - (Date.now() % 60_000),
    );
    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: calendarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const calendars = useMemo(
    () => (calendarsQuery.data ?? []).filter((c) => c.isActive),
    [calendarsQuery.data],
  );
  const allIds = useMemo(() => calendars.map((c) => c.id), [calendars]);

  /*
   * Named, not silently dropped: an inactive calendar is not drawn here - its
   * hours no longer count and nothing new can be booked into it - and a
   * calendar that simply vanished would leave "where did it go" unanswered.
   */
  const hiddenInactive = useMemo(
    () => inactiveAmong(calendarsQuery.data ?? []),
    [calendarsQuery.data],
  );

  const servicesQuery = useQuery({
    queryKey: ["clinic-services"],
    queryFn: clinicServicesApi.list,
    staleTime: 5 * 60 * 1000,
  });

  /** Činnosti and služby with their colours (contract C1). */
  const { catalogue, ready: catalogueReady } = useCalendarCatalogue(servicesQuery.data);

  /* Only services a visible calendar runs: filtering by any other shows nothing, always. */
  const services = useMemo(
    () =>
      (servicesQuery.data ?? []).filter(
        (s) => s.isActive && calendars.some((c) => c.clinicServiceId === s.id),
      ),
    [servicesQuery.data, calendars],
  );

  /* "Výběr termínů": a phone order picked in the grid. While it runs, the grid shows only that služba's calendars. */
  /* A touch screen (a phone, a tablet, or a mouse-less laptop) picks by tapping; a mouse paints by dragging. */
  const coarsePointer =
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const touchPick = isPhone || isTablet || coarsePointer;
  const [jumpToken, setJumpToken] = useState<number | null>(null);
  const savedFilters = useRef<{ serviceSet: Set<string> | null; ticked: Set<string> | null } | null>(null);
  const pick = usePickOrder({
    multi,
    calendars,
    todayKey: pragueDateKey(now),
    nowMinute: pragueMinuteOfDay(now),
    onStarted: (session) => {
      savedFilters.current ??= { serviceSet, ticked };
      setServiceSet(new Set([session.serviceId]));
      setTicked(null);
      rangeSelect.clear();
      /* A phone starts on the day (three narrow columns are too small to aim at); the calendar opens on today and
         then jumps to the first day that can still be booked. */
      viewChosenByHand.current = true;
      setView((current) => (isPhone ? "day" : current));
      /* Editing an order opens on its first day; a new one on the first day that can still be booked. */
      const first = session.editOrder?.firstDate ?? null;
      setAnchor(first ?? pragueDateKey(new Date()));
      setJumpToken(first === null ? Date.now() : null);
    },
    onEnded: () => {
      const saved = savedFilters.current;
      savedFilters.current = null;
      if (saved !== null) {
        setServiceSet(saved.serviceSet);
        setTicked(saved.ticked);
      }
    },
    onCreated: () => void appointmentsQuery.refetch(),
  });
  const pickActive = pick.active;
  pickingRef.current = pickActive;
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const pickCalendars = useMemo(
    () => calendars.filter((c) => pick.session !== null && c.clinicServiceId === pick.session.serviceId),
    [calendars, pick.session],
  );
  usePickJump({
    token: pick.active ? jumpToken : null,
    calendars: pickCalendars,
    now,
    onFound: useCallback((day: string | null) => {
      setJumpToken(null);
      if (day !== null) setAnchor(day);
      else pickRef.current.setNote("V nejbližších 14 dnech není volný čas. Zkuste další týdny nebo jiný měsíc.");
    }, []),
  });
  const legendServices = useMemo<LegendService[]>(
    () =>
      services.map((s) => ({
        id: s.id,
        name: s.name,
        color:
          catalogue.services.get(s.id)?.colorHex ??
          calendars.find((c) => c.clinicServiceId === s.id)?.color ??
          DESIGN.faint,
      })),
    [services, catalogue, calendars],
  );
  const isServiceShown = useCallback(
    (id: string) => serviceSet === null || serviceSet.has(id),
    [serviceSet],
  );
  const toggleService = (id: string) =>
    setServiceSet((current) => {
      const all = services.map((s) => s.id);
      const next = new Set(current ?? all);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size === all.length ? null : next;
    });

  const ticksApply = useMemo(() => visibleCalendars(calendars, ticked, null), [calendars, ticked]);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    if (view === "week") {
      const monday = mondayOf(anchor);
      return Array.from({ length: 7 }, (_, i) => addDaysToDateOnly(monday, i));
    }
    /*
     * Whole weeks around the month, so every row has seven columns. Six weeks
     * is 42 days, inside the 62-day ceiling the range endpoint enforces, so the
     * month is still one request (7.3).
     */
    const [year, month] = anchor.split("-").map(Number);
    const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
    const gridStart = mondayOf(firstOfMonth);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastOfMonth = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const gridEnd = addDaysToDateOnly(mondayOf(lastOfMonth), 6);
    const out: string[] = [];
    for (let d = gridStart; d <= gridEnd; d = addDaysToDateOnly(d, 1)) out.push(d);
    return out;
  }, [view, anchor]);

  const anchorMonth = anchor.slice(0, 7);
  const from = days[0];
  const to = days[days.length - 1];

  /**
   * One request for the whole visible window and every calendar the user may
   * see (7.3). The checkboxes and filters then narrow it on this side, so
   * ticking a calendar redraws at once instead of asking again.
   */
  const appointmentsQuery = useQuery({
    queryKey: ["day-range", from, to, allIds.join(",")],
    queryFn: () => appointmentsApi.range(from, to, allIds),
    enabled: allIds.length > 0,
    placeholderData: (previous) => previous,
    /* The calendar is a shared board: a booking made online, or at another desk,
       should appear here on its own. A minute keeps it live without hammering the
       server, and refetchOnWindowFocus already covers coming back to the tab. */
    refetchInterval: 60_000,
  });

  /**
   * What each calendar does on each day - hours, break, worker, closed and
   * why. `preview` answers per calendar, so this is one call per calendar.
   */
  const previewQuery = useQuery({
    queryKey: ["grid-preview", from, to, allIds.join(",")],
    queryFn: async () => {
      const perCalendar = await Promise.all(
        calendars.map(async (calendar) => {
          const rows = await workingHoursApi.preview(calendar.id, from, to);
          return [calendar.id, new Map(rows.map((row) => [row.date, row]))] as const;
        }),
      );
      return new Map<string, Map<string, PreviewDay>>(perCalendar);
    },
    enabled: allIds.length > 0,
    placeholderData: (previous) => previous,
  });
  const previewByCalendar = useMemo(
    () => previewQuery.data ?? new Map<string, Map<string, PreviewDay>>(),
    [previewQuery.data],
  );

  /*
   * A calendar stays in the grid when it is ticked and its služba is shown -
   * through the service it runs or through a činnost it offers in the period.
   */
  const shown = useMemo(
    () =>
      ticksApply.filter((calendar) => {
        if (serviceSet === null) return true;
        if (calendar.clinicServiceId !== null && serviceSet.has(calendar.clinicServiceId)) return true;
        for (const day of days) {
          for (const id of previewByCalendar.get(calendar.id)?.get(day)?.offeredActivityIds ?? []) {
            const serviceId = catalogue.activities.get(id)?.serviceId;
            if (serviceId && serviceSet.has(serviceId)) return true;
          }
        }
        return false;
      }),
    [ticksApply, serviceSet, days, previewByCalendar, catalogue],
  );
  /* Etapa 12: the calendar's visible service filter narrowed to exactly one služba, or null (every live order shown). */
  const singleServiceId = useMemo(
    () => (serviceSet !== null && serviceSet.size === 1 ? [...serviceSet][0] : null),
    [serviceSet],
  );
  /* The employee list follows the service, not the ticked calendars. */
  const serviceCalendars = useMemo(
    () => calendars.filter((c) => serviceSet === null || (c.clinicServiceId !== null && serviceSet.has(c.clinicServiceId))),
    [calendars, serviceSet],
  );

  const timeGridShown = !isPhone && view !== "month";

  /* Blocks: on the time axis, as club rows in the month, and as club cards in the phone lists. */
  const blockLists = useQueries({
    queries: shown.map((calendar) => ({
      queryKey: ["blocks", calendar.id, from, to],
      queryFn: () => appointmentsApi.blocks(calendar.id, from, to),
      enabled: true,
      placeholderData: (previous: TimeBlock[] | undefined) => previous,
    })),
    combine: dataOfEach,
  });
  const blocksByCalendar = useMemo(() => {
    const map = new Map<string, TimeBlock[]>();
    shown.forEach((calendar, i) => map.set(calendar.id, blockLists[i] ?? []));
    return map;
  }, [shown, blockLists]);

  /* The mini calendar may be showing the anchor's year while the grid spans New Year. */
  const years = useMemo(
    () => Array.from(new Set([...yearsBetween(from, to), Number(anchor.slice(0, 4))])),
    [from, to, anchor],
  );
  const holidays = useQueries({
    queries: years.map((year) => ({
      queryKey: ["holidays", year],
      queryFn: () => holidaysApi.year(year),
      staleTime: 10 * 60 * 1000,
    })),
    combine: allHolidays,
  });
  const holidayByDate = useMemo(
    () => new Map<string, ClinicHoliday>(holidays.map((h) => [h.date, h])),
    [holidays],
  );

  /*
   * The calendar's own display settings, from the one endpoint every signed-in
   * staff member may read. The now-line and holiday colours used to come from
   * the admin-only `/api/settings` (settings.clinic.manage), so every
   * receptionist saw the theme's error colour instead of the owner's choice;
   * they are the same owner's settings, so they are read from the same place.
   */
  const { settings: calendarDisplay, loaded: calendarDisplayLoaded } = useCalendarDisplay();
  const holidayColor = calendarDisplay.holidayColor;
  const lunchColor = calendarDisplay.lunchColor;
  const nowLineColor = resolveNowLineColor(
    calendarDisplay.nowLineColor,
    theme.palette.error.main,
  );

  /*
   * The calendar opens on the view the owner chose (calendar.defaultView),
   * not a hardcoded "week". It is applied once, when the setting first
   * arrives; the moment the person picks a view themselves it is theirs for
   * the session (changeView marks it), so a late-arriving setting never
   * yanks the grid out from under them.
   */
  const viewChosenByHand = useRef(false);
  const changeView = (next: ViewMode) => {
    viewChosenByHand.current = true;
    rangeSelect.clear();
    setView(next);
  };
  useEffect(() => {
    if (!calendarDisplayLoaded || viewChosenByHand.current) return;
    viewChosenByHand.current = true;
    setView(calendarDisplay.defaultView);
  }, [calendarDisplayLoaded, calendarDisplay.defaultView]);

  /* `pub.bookingEnabled`, through the endpoint every screen may read. Never throws. */
  const publicClinicQuery = useQuery({
    queryKey: ["public-clinic"],
    queryFn: readPublicClinic,
    staleTime: 5 * 60 * 1000,
  });
  const onlineBookingOff = publicClinicQuery.data?.bookingEnabled === false;

  const marks = useMemo(() => {
    const map = new Map<string, DayMark>();
    for (const dayKey of days) {
      const rows = shown
        .map((c) => previewByCalendar.get(c.id)?.get(dayKey))
        .filter((row): row is PreviewDay => row !== undefined);
      map.set(dayKey, dayMark(holidayByDate.get(dayKey), rows));
    }
    return map;
  }, [days, shown, previewByCalendar, holidayByDate]);

  /* Everybody the rota names in the period, for the calendars the service filter leaves. */
  const employees = useMemo(() => {
    const rows: PreviewDay[] = [];
    for (const calendar of serviceCalendars) {
      rows.push(...(previewByCalendar.get(calendar.id)?.values() ?? []));
    }
    const found = employeesIn(rows);
    return employee && !found.some((e) => e.id === employee.id)
      ? [...found, employee]
      : found;
  }, [serviceCalendars, previewByCalendar, employee]);
  const employeeId = employee?.id ?? null;
  const chooseEmployee = (id: string | null) =>
    setEmployee(id === null ? null : (employees.find((e) => e.id === id) ?? null));

  const shownIds = useMemo(() => new Set(shown.map((c) => c.id)), [shown]);
  const calendarById = useMemo(
    () => new Map(calendars.map((c) => [c.id, c])),
    [calendars],
  );

  /* What the grid draws: the shown calendars' bookings, of the shown services, of the chosen worker. */
  const visibleAppointments = useMemo(() => {
    const out: DayAppointment[] = [];
    for (const appointment of appointmentsQuery.data ?? []) {
      if (!appointment.calendarId || !shownIds.has(appointment.calendarId)) continue;
      const serviceId = serviceIdOfAppointment(appointment, calendarById.get(appointment.calendarId), catalogue);
      if (!passesService(serviceId, serviceSet)) continue;
      const row = previewByCalendar.get(appointment.calendarId)?.get(pragueDateKey(appointment.startUtc));
      if (!dayBelongsTo(row, employeeId)) continue;
      out.push(appointment);
    }
    return out;
  }, [appointmentsQuery.data, shownIds, calendarById, catalogue, serviceSet, previewByCalendar, employeeId]);

  const byDay = useMemo(() => {
    const map = new Map<string, DayAppointment[]>();
    for (const appointment of visibleAppointments) {
      const key = pragueDateKey(appointment.startUtc);
      map.set(key, [...(map.get(key) ?? []), appointment]);
    }
    return map;
  }, [visibleAppointments]);

  /* The day view's columns: a činnost each, grouped by calendar, once the činnosti are known. */
  const columns = useMemo(
    () =>
      catalogueReady
        ? buildColumns({
            calendars: shown,
            catalogue,
            previewByCalendar,
            days,
            appointments: visibleAppointments,
            serviceFilter: serviceSet,
          })
        : undefined,
    [catalogueReady, shown, catalogue, previewByCalendar, days, visibleAppointments, serviceSet],
  );

  /** The hours drawn: the working hours on screen, widened to anything outside them. */
  const openSpan = useMemo(() => {
    const working: MinuteRange[] = [];
    const items: MinuteRange[] = [];
    for (const dayKey of days) {
      for (const calendar of shown) {
        const row = previewByCalendar.get(calendar.id)?.get(dayKey);
        if (!row) continue;
        const start = parseTimeOfDay(row.startTime);
        const end = parseTimeOfDay(row.endTime);
        if (row.isOpen && start !== null && end !== null) working.push({ start, end });
      }
      /* A cancelled booking is not drawn, so it must not stretch the day either:
         one cancelled 01:00 slot used to open every day at one in the morning. */
      for (const a of byDay.get(dayKey) ?? []) {
        if (statusTally(a.status) === "cancelled") continue;
        items.push(spanOnDay(a.startUtc, a.endUtc, dayKey));
      }
      for (const blocks of blocksByCalendar.values()) {
        for (const b of blocks) {
          if (touchesDay(b.startUtc, b.endUtc, dayKey)) items.push(spanOnDay(b.startUtc, b.endUtc, dayKey));
        }
      }
    }
    return visibleHours(working, items);
  }, [days, shown, previewByCalendar, byDay, blocksByCalendar]);

  /* Club orders that do not block time yet (an offer, a request): a dashed "Poptávka" chip on their days. */
  const inquiriesByDay = useInquiries(pick.session?.editOrder?.mode === "process" ? pick.session.editOrder.orderId : null);
  const openInquiry = (orderId: string) => navigate("/clubs/objednavky", { state: { openOrderId: orderId } });

  /* The club windows of each day (a card on a phone list, a dot in its week strip and month list). */
  const clubDetailsQuery = useQuery({
    queryKey: ["club-blocks", "details", from, to],
    queryFn: () => clubBlocksApi.list({ from, to }),
    enabled: !pickActive,
    retry: false,
    staleTime: 30_000,
  });
  const restrictedWindows = useWindowRestrictions(!pickActive);
  const clubWindowsByDay = useMemo(() => {
    const details = new Map((clubDetailsQuery.data ?? []).map((b) => [b.id, b]));
    const all = [...blocksByCalendar.values()].flat();
    return clubWindowsByDay_(
      blocksByCalendar,
      days,
      details,
      (calendarId, day) => {
        const row = previewByCalendar.get(calendarId)?.get(day);
        if (!row || !row.isOpen) return null;
        const start = parseTimeOfDay(row.startTime);
        const end = parseTimeOfDay(row.endTime);
        return start === null || end === null ? null : { start, end };
      },
      (id, block) => clubBlockDates(all, id, block),
      restrictedWindows,
    );
  }, [clubDetailsQuery.data, blocksByCalendar, days, previewByCalendar, restrictedWindows]);

  /* The club blocks of the month, one row per club per day. */
  const clubBlocksByDay = useMemo(() => {
    const map = new Map<string, ClubBlockRef[]>();
    if (view !== "month") return map;
    for (const blocks of blocksByCalendar.values()) {
      for (const block of blocks) {
        if (block.kind !== "club" || !block.clubName) continue;
        const range = clubBlockDates(blocks, block.clubBlockId, block);
        const ref: ClubBlockRef = {
          clubBlockId: block.clubBlockId ?? block.id,
          clubId: block.clubId ?? null,
          clubName: block.clubName,
          colorHex: block.colorHex ?? null,
          range,
        };
        for (const day of days) {
          if (!touchesDay(block.startUtc, block.endUtc, day)) continue;
          const list = map.get(day) ?? [];
          if (!list.some((r) => r.clubBlockId === ref.clubBlockId)) map.set(day, [...list, ref]);
        }
      }
    }
    return map;
  }, [view, blocksByCalendar, days]);

  /**
   * Which appointment the detail is opened on. Only its id and calendar are
   * taken from here - the detail reads the appointment itself (4.5, v26).
   */
  const openAppointment = useMemo(
    () =>
      openId === null
        ? null
        : ((appointmentsQuery.data ?? []).find((a) => a.id === openId) ?? null),
    [openId, appointmentsQuery.data],
  );

  /* On a phone the week moves a day at a time; everywhere else by its own unit. */
  const stepBy = (direction: number) =>
    setAnchor(
      view === "month"
        ? addMonths(anchor, direction)
        : addDaysToDateOnly(anchor, direction * (view === "day" || isPhone ? 1 : 7)),
    );
  const todayKey = pragueDateKey(now);

  const pickDay = (day: string) => {
    rangeSelect.clear();
    setAnchor(day);
    changeView("day");
  };

  const openBooking = useCallback(
    (prefill: BookingPrefill) =>
      setBooking((current) => ({ key: (current?.key ?? 0) + 1, prefill })),
    [],
  );

  const bookFromGrid = (request: GridBookingRequest) =>
    openBooking({
      initialDate: request.dayKey,
      initialCalendarId: request.calendarId,
      initialStart: request.start,
      initialEnd: request.end,
    });

  /* A click on a club's window: a window of an order opens the ORDER ("Otevřít objednávku", "Upravit termíny"),
     only a legacy block without an order still says "Otevřít blok". */
  const openClubBlock = (picked: ClubBlockPick) => {
    const state: OpenClubBlockState = { clubBlockId: picked.clubBlockId, ...(picked.clubId ? { clubId: picked.clubId } : {}) };
    setClubPick(null);
    navigate("/clubs", { state });
  };
  const openClubOrder = (orderId: string) => {
    setClubPick(null);
    navigate("/clubs/objednavky", { state: { openOrderId: orderId } });
  };
  const catalogueActivitiesQuery = useQuery({
    queryKey: ["club-block-activities"],
    queryFn: fetchBlockableActivities,
    staleTime: 5 * 60 * 1000,
    enabled: clubPick !== null,
  });
  /* "Upravit termíny" on a window: pick mode opens on that order with every window of it already painted. */
  const editClubOrderTerms = (order: ClubOrderView) => {
    setClubPick(null);
    pick.start(editSessionFor(order, catalogueActivitiesQuery.data ?? [], pragueDateKey(new Date())));
  };

  /* The days marked by dragging across them, and what the popover does with them. */
  const chosenRange = rangeSelect.chosen;
  const chosenCalendarIds = shown.map((c) => c.id);

  /**
   * "Nová objednávka" - the sidebar's big button and the one in the top bar:
   * open the booking dialog on the next free half hour from now, on the first
   * calendar on screen, exactly as if it had been dragged. What is on the
   * calendar already, the lunch break and the working hours are stepped
   * over - and so is a day the clinic is shut or offers nothing: on a Saturday
   * the proposal is Monday at opening time, not "today, zavřeno" (owner,
   * 3. 10. 2026). The grid moves to that day so the slot is in view. Whether
   * the time can really be booked is still the server's answer in the dialog
   * (6.1).
   */
  const factsOf = useCallback(
    (
      row: PreviewDay | undefined,
      dayKey: string,
      calendarId: string,
      appointments: readonly DayAppointment[],
      blocks: readonly TimeBlock[],
    ): DayFacts | undefined => {
      if (row === undefined) return undefined;
      const mark = dayMark(holidayByDate.get(dayKey), [row]);
      const offers = (row.offeredActivityIds ?? []).length > 0;
      if (mark.closed || !row.isOpen || !offers) return { open: false, bounds: null, busy: [] };
      const busy: MinuteRange[] = [];
      for (const a of appointments) {
        if (a.calendarId !== calendarId || statusTally(a.status) === "cancelled") continue;
        if (touchesDay(a.startUtc, a.endUtc, dayKey)) busy.push(spanOnDay(a.startUtc, a.endUtc, dayKey));
      }
      for (const b of blocks) {
        if (touchesDay(b.startUtc, b.endUtc, dayKey)) busy.push(spanOnDay(b.startUtc, b.endUtc, dayKey));
      }
      const breakStart = parseTimeOfDay(row.breakStart);
      const breakEnd = parseTimeOfDay(row.breakEnd);
      if (breakStart !== null && breakEnd !== null) busy.push({ start: breakStart, end: breakEnd });
      const workStart = parseTimeOfDay(row.startTime);
      const workEnd = parseTimeOfDay(row.endTime);
      const bounds = workStart !== null && workEnd !== null ? { start: workStart, end: workEnd } : null;
      return { open: true, bounds, busy };
    },
    [holidayByDate],
  );

  /*
   * The month ahead for one calendar, asked for only when the days on screen
   * cannot answer. Cached briefly, so "Příští volný termín" pressed twice in
   * the drawer is one round trip.
   */
  const horizonFor = useCallback(
    (calendarId: string, fromDay: string) =>
      queryClient.fetchQuery({
        queryKey: ["next-free-horizon", calendarId, fromDay],
        queryFn: async () => {
          const to = addDaysToDateOnly(fromDay, NEXT_FREE_HORIZON_DAYS);
          const [rows, appointments, blocks] = await Promise.all([
            workingHoursApi.preview(calendarId, fromDay, to),
            appointmentsApi.range(fromDay, to, [calendarId]),
            appointmentsApi.blocks(calendarId, fromDay, to),
          ]);
          return { rows: new Map(rows.map((r) => [r.date, r])), appointments, blocks };
        },
        staleTime: 30_000,
      }),
    [queryClient],
  );

  const findNextFree = useCallback(
    async (
      calendarId: string,
      start: { dayKey: string; minute: number },
    ): Promise<{ dayKey: string; slot: MinuteRange } | null> => {
      const calendar = calendarById.get(calendarId);
      const step = calendar && calendar.displayStepMinutes > 0 ? calendar.displayStepMinutes : 30;

      /* The days on screen first: no request when today or tomorrow has room. */
      const visible = nextFreeSlotAcrossDays(start, step, (day) =>
        factsOf(
          previewByCalendar.get(calendarId)?.get(day),
          day,
          calendarId,
          appointmentsQuery.data ?? [],
          blocksByCalendar.get(calendarId) ?? [],
        ),
      );
      if (visible.kind === "found") return visible;
      if (visible.kind === "none") return null;

      /* Then the month ahead; if even that cannot be had, the first open weekday at opening time. */
      let known: ReadonlyMap<string, PreviewDay> = previewByCalendar.get(calendarId) ?? new Map();
      try {
        const horizon = await horizonFor(calendarId, start.dayKey);
        known = horizon.rows;
        const walk = nextFreeSlotAcrossDays(start, step, (day) =>
          factsOf(horizon.rows.get(day), day, calendarId, horizon.appointments, horizon.blocks),
        );
        if (walk.kind === "found") return walk;
        if (walk.kind === "none") return null;
      } catch {
        /* The preview could not be fetched; the fallback below says so by being generic. */
      }
      return firstOpenWeekday(start, known, holidayByDate);
    },
    [calendarById, factsOf, previewByCalendar, appointmentsQuery.data, blocksByCalendar, horizonFor, holidayByDate],
  );

  const bookNextFree = useCallback(
    async (extra: Pick<BookingPrefill, "initialPatientId"> = {}) => {
      const calendar = shown[0];
      if (!calendar) return;
      const nowDate = new Date();
      const dayKey = pragueDateKey(nowDate);
      const found = await findNextFree(calendar.id, { dayKey, minute: pragueMinuteOfDay(nowDate) });
      if (found) setAnchor(found.dayKey);
      openBooking(
        found
          ? {
              initialDate: found.dayKey,
              initialCalendarId: calendar.id,
              initialStart: localDateTime(found.dayKey, found.slot.start),
              initialEnd: localDateTime(found.dayKey, found.slot.end),
              ...extra,
            }
          : { initialDate: dayKey, initialCalendarId: calendar.id, ...extra },
      );
    },
    [shown, findNextFree, openBooking],
  );

  /* "Příští volný termín" on the drawer's slot card: after the moment it shows, exclusive. */
  const findNextFreeForDialog = useCallback(
    async (after: { date: string; time: string }, calendarId: string): Promise<FoundSlot | null> => {
      const [h, m] = after.time.split(":").map(Number);
      const minute = (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0) + 1;
      const found = await findNextFree(calendarId, { dayKey: after.date, minute });
      if (!found) return null;
      setAnchor(found.dayKey);
      return {
        date: found.dayKey,
        time: formatMinutes(found.slot.start),
        end: formatMinutes(found.slot.end),
      };
    },
    [findNextFree],
  );

  /*
   * The sidebar lands here with `state.newAppointment` (a timestamp). Each new
   * value opens the dialog once, as soon as the calendars and today's bookings
   * are known - so the slot proposed is one that is visibly free.
   */
  const landing = location.state as { newAppointment?: number; patientId?: string } | null;
  const newAppointmentKey = landing?.newAppointment;
  /* The patient's card hands over who it is for; the sidebar hands over nobody. */
  const landingPatientId = typeof landing?.patientId === "string" ? landing.patientId : undefined;
  const handledNewAppointment = useRef<number | null>(null);
  const bookingsKnown = appointmentsQuery.isSuccess || appointmentsQuery.isError;
  useEffect(() => {
    if (typeof newAppointmentKey !== "number") return;
    if (handledNewAppointment.current === newAppointmentKey) return;
    if (!mayBook || shown.length === 0 || !bookingsKnown) return;
    handledNewAppointment.current = newAppointmentKey;
    void bookNextFree(landingPatientId ? { initialPatientId: landingPatientId } : {});
  }, [newAppointmentKey, landingPatientId, mayBook, shown.length, bookingsKnown, bookNextFree]);

  /*
   * "Nová objednávka → Vybrat v kalendáři" lands here with `state.serviceId`:
   * the grid then shows only that služba. Applied once per navigation (the
   * history entry's key), so the desk can still change the filter afterwards.
   */
  const landingServiceId = (location.state as { serviceId?: unknown } | null)?.serviceId;
  const handledServiceKey = useRef<string | null>(null);
  useEffect(() => {
    if (typeof landingServiceId !== "string" || handledServiceKey.current === location.key) return;
    if (!services.some((s) => s.id === landingServiceId)) return;
    handledServiceKey.current = location.key;
    setServiceSet(services.length === 1 ? null : new Set([landingServiceId]));
  }, [landingServiceId, location.key, services]);

  /*
   * Two more hand-overs by router state, each applied once per navigation:
   *  - `state.openClubOrder` (the sidebar's and the toolbar's "Klubová objednávka") opens the club order dialog;
   *  - `state.date` (yyyy-MM-dd; "Zobrazit v kalendáři" from the club reservations) moves the grid to that day.
   */
  const handoff = location.state as { openClubOrder?: unknown; date?: unknown } | null;
  const wantsClubOrder = handoff?.openClubOrder === true;
  const landingDate = typeof handoff?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(handoff.date) ? handoff.date : undefined;
  const handledClubOrderKey = useRef<string | null>(null);
  const handledDateKey = useRef<string | null>(null);
  useEffect(() => {
    if (!wantsClubOrder || !mayBook || handledClubOrderKey.current === location.key) return;
    handledClubOrderKey.current = location.key;
    setEntryOpen(true);
  }, [wantsClubOrder, mayBook, location.key]);
  /* `state.pickOrder` (a club's card, Kluby -> Objednávky "Vyplním sám"): straight to the small setup form. */
  const wantsPick = readPickOrderState(location.state);
  const handledPickKey = useRef<string | null>(null);
  useEffect(() => {
    if (wantsPick === null || !mayBook || handledPickKey.current === location.key) return;
    handledPickKey.current = location.key;
    if (wantsPick.start !== undefined) {
      pickRef.current.start(wantsPick.start);
      return;
    }
    setSetupFor({
      ...(wantsPick.clubId !== undefined ? { clubId: wantsPick.clubId } : {}),
      ...(wantsPick.parent !== undefined ? { parent: wantsPick.parent } : {}),
    });
  }, [wantsPick, mayBook, location.key]);
  useEffect(() => {
    if (landingDate === undefined || handledDateKey.current === location.key) return;
    handledDateKey.current = location.key;
    setAnchor(landingDate);
  }, [landingDate, location.key]);

  /**
   * 7.1: the grid steps with the keyboard and is not a focus trap.
   * `PageUp`/`PageDown` rather than Alt+Arrow, which the browser takes for its
   * own history navigation.
   */
  const onGridKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpenId(null);
      rangeSelect.clear();
      if (!pickActive) multi.clear();
      return;
    }
    if (event.key === "PageUp") {
      stepBy(-1);
      event.preventDefault();
    }
    if (event.key === "PageDown") {
      stepBy(1);
      event.preventDefault();
    }
  };

  /* Moving to another day, week or month is not a pick: the sentence about the last paint ("Termín v minulosti…") goes. */
  const lastNav = useRef(`${view}|${anchor}`);
  useEffect(() => {
    const key = `${view}|${anchor}`;
    if (lastNav.current === key) return;
    lastNav.current = key;
    if (pickActive) pickRef.current.setNote(null);
  }, [view, anchor, pickActive]);

  /* The free time of the služba's calendars, day by day: the month's numbers, "Celý den" and the phone's block list. */
  const nowMinuteOfDay = pragueMinuteOfDay(now);
  const dayData = useMemo(
    () => ({
      calendars: shown.filter((c) => pick.session !== null && c.clinicServiceId === pick.session.serviceId),
      previewByCalendar,
      appointmentsByDay: byDay,
      blocksByCalendar,
      picks: multi.items,
      today: todayKey,
      nowMinute: nowMinuteOfDay,
    }),
    [shown, pick.session, previewByCalendar, byDay, blocksByCalendar, multi.items, todayKey, nowMinuteOfDay],
  );
  const freeBlocksOn = useCallback((day: string): FreeBlock[] => freeBlocksOfDay(day, dayData), [dayData]);
  const freeByDay = useMemo(() => {
    const map = new Map<string, number>();
    if (!pickActive || view !== "month") return map;
    for (const day of days) map.set(day, minutesOfBlocks(freeBlocksOn(day)));
    return map;
  }, [pickActive, view, days, freeBlocksOn]);
  const pickedByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of timePicks(multi.items)) map.set(p.dayKey, (map.get(p.dayKey) ?? 0) + (p.range.end - p.range.start));
    return map;
  }, [multi.items]);

  const title = periodTitle(view, days, anchor);
  const outlinedSelect = { minWidth: 180, "& .MuiInputBase-root": { bgcolor: "background.paper" } };
  const canSelectRange = (mayBook || mayBlock) && !isPhone;
  const calendarFilterCount = ticked === null ? 0 : calendars.length - ticked.size;
  const rangeHint =
    rangeSelect.tapMode && !isPhone
      ? rangeSelect.highlight && !rangeSelect.chosen
        ? CAL_TEXT.rangeModeFirst
        : CAL_TEXT.rangeModeHint
      : null;

  /* The sidebar's content, drawn wherever this width puts it. */
  const sideContent = (touch: boolean) => (
    <GridSidebar
      anchor={anchor}
      view={view}
      onDate={(d) => {
        setAnchor(d);
        rangeSelect.clear();
      }}
      holidays={holidayDates(holidays)}
      closedDays={closedHolidayDates(holidays)}
      services={legendServices}
      isServiceShown={isServiceShown}
      onToggleService={toggleService}
      onOnlyService={(id) => setServiceSet(new Set([id]))}
      onAllServices={() => setServiceSet(null)}
      touch={touch}
    />
  );
  const filtersContent = (
    <CalendarFilters
      calendars={serviceCalendars}
      isTicked={(id) => ticked === null || ticked.has(id)}
      onToggle={(id) => setTicked(toggleCalendar(ticked, allIds, id))}
      onOnly={(id) => setTicked(new Set([id]))}
      employees={employees}
      employeeId={employeeId}
      onEmployee={chooseEmployee}
    />
  );

  const nothingShown = shown.length === 0 || (columns !== undefined && view === "day" && columns.length === 0);

  return (
    <Box
      tabIndex={0}
      aria-label={t("booking.grid.title")}
      sx={{ maxWidth: 1680, mx: "auto", outline: "none" }}
      onKeyDown={onGridKeyDown}
    >
      {/* Desktop: the sidebar's own slot carries the mini calendar and the legend. */}
      {inSidebar ? (
        <SidebarPortal>
          <Box sx={{ pb: 2 }}>{sideContent(false)}</Box>
        </SidebarPortal>
      ) : null}

      {/* The top bar: ‹ › Dnes · the period · Den | Týden | Měsíc · Nová objednávka */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
          pb: isPhone ? 0 : 1.75,
          borderBottom: isPhone ? "none" : "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack direction="row" spacing={isPhone ? 0.5 : 1} sx={{ alignItems: "center", order: isPhone ? 2 : 0 }}>
          <SquareButton label={GRID_TEXT.previous} onClick={() => stepBy(-1)}>
            <ChevronLeftIcon fontSize="small" />
          </SquareButton>
          <SquareButton label={GRID_TEXT.next} onClick={() => stepBy(1)}>
            <ChevronRightIcon fontSize="small" />
          </SquareButton>
          <Button
            variant="outlined"
            onClick={() => {
              rangeSelect.clear();
              setAnchor(pragueDateKey(new Date()));
            }}
            sx={{ minHeight: 44, px: 2 }}
          >
            {GRID_TEXT.today}
          </Button>
        </Stack>
        <Typography
          component="h1"
          sx={{
            fontSize: { xs: 17, md: 19 },
            fontWeight: 600,
            letterSpacing: "-0.015em",
            flex: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            order: isPhone ? 1 : 0,
            flexBasis: isPhone ? "100%" : undefined,
          }}
        >
          {title}
        </Typography>

        {/* 7.2: wrapping needs `gap` rather than `spacing`, which lays out with
            margins and breaks across wrapped lines on a phone. */}
        <Stack
          direction="row"
          sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.25, order: isPhone ? 3 : 0, flexBasis: isPhone ? "100%" : undefined }}
        >
          <ToggleButtonGroup
            exclusive
            aria-label={GRID_TEXT.view}
            value={view}
            onChange={(_, next: ViewMode | null) => next && changeView(next)}
            sx={{
              flex: isPhone ? 1 : undefined,
              "& .MuiToggleButton-root": { minHeight: 44, px: 2, flex: isPhone ? 1 : undefined },
            }}
          >
            <ToggleButton value="day">{GRID_TEXT.dayView}</ToggleButton>
            <ToggleButton value="week">{GRID_TEXT.weekView}</ToggleButton>
            <ToggleButton value="month">{GRID_TEXT.monthView}</ToggleButton>
          </ToggleButtonGroup>
          {mayBook && !isPhone ? (
            <Button variant="outlined" disabled={pickActive} onClick={() => setEntryOpen(true)} sx={{ minHeight: 44, px: 2.25 }}>
              Klubová objednávka
            </Button>
          ) : null}
          {mayBook && !isPhone ? (
            <Button variant="contained" onClick={() => void bookNextFree()} sx={{ minHeight: 44, px: 2.25 }}>
              {GRID_TEXT.newAppointment}
            </Button>
          ) : null}
        </Stack>
      </Box>

      {/* The toolbar under it: ROZLIŠENÍ, the hint, the filters. */}
      {!isPhone ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1.5,
            mb: 2,
          }}
        >
          {timeGridShown ? (
            <>
              <SectionLabel sx={{ mb: 0 }}>{GRID_TEXT.resolution}</SectionLabel>
              <SquareButton
                label={GRID_TEXT.coarser}
                onClick={() => setResolution(stepResolution(zoom, -1).key)}
                disabled={resolution.key === RESOLUTIONS[0].key}
              >
                <RemoveIcon fontSize="small" />
              </SquareButton>
              <ToggleButtonGroup
                exclusive
                aria-label={GRID_TEXT.resolution}
                value={resolution.key}
                onChange={(_, next: string | null) => next && setResolution(next)}
                sx={{ "& .MuiToggleButton-root": { minHeight: 44, px: 1.75 } }}
              >
                {RESOLUTIONS.map((level) => (
                  <ToggleButton key={level.key} value={level.key}>
                    {level.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <SquareButton
                label={GRID_TEXT.finer}
                onClick={() => setResolution(stepResolution(zoom, 1).key)}
                disabled={resolution.key === RESOLUTIONS[RESOLUTIONS.length - 1].key}
              >
                <AddIcon fontSize="small" />
              </SquareButton>
              <Typography sx={{ fontSize: 12, color: "text.secondary", display: { xs: "none", lg: "block" } }}>
                {GRID_TEXT.gridStepHint(resolution.hint)}
              </Typography>
            </>
          ) : null}
          <Box sx={{ flex: 1 }} />
          {onlineBookingOff ? (
            <Tooltip title={GRID_TEXT.onlineBookingOffWhy}>
              <Chip color="warning" label={GRID_TEXT.onlineBookingOff} />
            </Tooltip>
          ) : null}
          {/* Touch: mark days by tapping the first and then the last. */}
          {isTablet && canSelectRange && view !== "day" ? (
            <Button
              variant={rangeSelect.tapMode ? "contained" : "outlined"}
              aria-pressed={rangeSelect.tapMode}
              onClick={() => {
                rangeSelect.clear();
                rangeSelect.setTapMode(!rangeSelect.tapMode);
              }}
              sx={{ minHeight: 44 }}
            >
              {CAL_TEXT.rangeMode}
            </Button>
          ) : null}
          {/* Touch: every tap or long press adds one more place, until switched off. */}
          {isTablet && canSelectRange ? (
            <Button
              variant={multi.touchMode ? "contained" : "outlined"}
              aria-pressed={multi.touchMode}
              onClick={() => multi.setTouchMode(!multi.touchMode)}
              sx={{ minHeight: 44 }}
            >
              {CAL_TEXT.multiMode}
            </Button>
          ) : null}
          <Badge color="primary" badgeContent={calendarFilterCount} invisible={calendarFilterCount === 0}>
            <Button
              variant="outlined"
              onClick={(event) => setFilterMenu(event.currentTarget)}
              startIcon={<TuneIcon fontSize="small" />}
              aria-haspopup="dialog"
              sx={{ minHeight: 44 }}
            >
              {CAL_TEXT.calendarsFilter}
            </Button>
          </Badge>
          <TextField
            select
            size="small"
            label={GRID_TEXT.employee}
            value={employeeId ?? ""}
            onChange={(e) => chooseEmployee(e.target.value === "" ? null : e.target.value)}
            sx={outlinedSelect}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          >
            <MenuItem value="">{GRID_TEXT.allEmployees}</MenuItem>
            {employees.map((e) => (
              <MenuItem key={e.id} value={e.id}>
                {e.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      ) : null}

      {rangeHint ? (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="range-hint">
          {rangeHint}
        </Alert>
      ) : null}

      {/* Tablet: the mini month and the legend collapsed above the grid. */}
      {isTablet && !inSidebar ? (
        <Box sx={{ mb: 2, border: "1px solid", borderColor: "divider", borderRadius: `${DESIGN.radius.lg}px`, bgcolor: "background.paper" }}>
          <ButtonBase
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="calendar-side-collapse"
            sx={{ width: "100%", minHeight: 48, px: 2, justifyContent: "space-between", fontSize: 14, fontWeight: 600 }}
          >
            {CAL_TEXT.filters}
            <ExpandMoreIcon sx={{ transform: filtersOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
          </ButtonBase>
          <Collapse in={filtersOpen} id="calendar-side-collapse" unmountOnExit>
            <Box sx={{ p: 2, pt: 0.5, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 3 }}>
              {sideContent(true)}
              {filtersContent}
            </Box>
          </Collapse>
        </Box>
      ) : null}

      {/* Phone: the same, as a button and a bottom sheet. */}
      {isPhone && onlineBookingOff ? (
        <Chip color="warning" label={GRID_TEXT.onlineBookingOff} sx={{ mb: 1.5 }} />
      ) : null}
      {isPhone ? (
        <Button
          variant="outlined"
          fullWidth
          startIcon={<TuneIcon fontSize="small" />}
          onClick={() => setFiltersOpen(true)}
          sx={{ minHeight: 44, mb: 2 }}
        >
          {CAL_TEXT.filters}
        </Button>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: [
            device === "desktop" && !inSidebar ? "248px" : null,
            "minmax(0, 1fr)",
            pickActive && device === "desktop" ? "340px" : null,
          ]
            .filter(Boolean)
            .join(" "),
          gap: 3,
          alignItems: "start",
        }}
      >
        {device === "desktop" && !inSidebar ? <Box>{sideContent(false)}</Box> : null}

        <Box sx={{ minWidth: 0 }}>
          {pick.panel !== null ? (
            <Alert severity="info" data-testid="pick-hint" sx={{ mb: 1.5 }}>
              {touchPick
                ? CAL_TEXT.pick.hintTouch(pick.panel.clubName)
                : CAL_TEXT.pick.hintMouse(pick.panel.clubName)}
            </Alert>
          ) : null}
          {pickActive && view === "day" && isPhone && pick.panel !== null ? (
            <FreeBlocksList
              blocks={freeBlocksOn(anchor)}
              calendarName={pick.panel.calendarName}
              showCalendar={dayData.calendars.length > 1}
              onPick={(block) => pick.pickBlocks(anchor, [block], { unit: "block" })}
              takeOf={(block) => pick.previewTake([block])}
              onNextDay={() => stepBy(1)}
            />
          ) : null}
          <AsyncSection
            isLoading={calendarsQuery.isLoading}
            isSettled={calendarsQuery.isSuccess}
            error={calendarsQuery.error}
            isEmpty={calendars.length === 0}
            emptyText={t("booking.grid.noCalendars")}
            onRetry={() => void calendarsQuery.refetch()}
            skeletonRows={3}
          >
            {hiddenInactive.length > 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t("booking.grid.inactiveHidden", {
                  names: hiddenInactive.map((c) => c.name).join(", "),
                  count: hiddenInactive.length,
                })}
                {mayManageCalendars ? (
                  <>
                    {" "}
                    <MuiLink component={RouterLink} to="/calendars">
                      {t("booking.grid.inactiveWhere")}
                    </MuiLink>
                  </>
                ) : null}
              </Alert>
            ) : null}

            <AsyncSection
              isLoading={appointmentsQuery.isLoading}
              isSettled={appointmentsQuery.isSuccess && !appointmentsQuery.isPlaceholderData}
              /* With placeholder data the query stays 'success', so a failed fetch
                 never reaches `error` — it lands in `failureReason`. */
              error={appointmentsQuery.error ?? appointmentsQuery.failureReason}
              isEmpty={false}
              emptyText=""
              onRetry={() => void appointmentsQuery.refetch()}
              skeletonRows={6}
            >
              {previewQuery.error ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {t("booking.grid.previewFailed")}
                </Alert>
              ) : null}

              {nothingShown ? (
                <Alert severity="info" data-testid="nothing-shown">
                  {CAL_TEXT.nothingToShow}
                </Alert>
              ) : isPhone && !pickActive ? (
                /* 7.2: on a phone the day is a list, not a shrunken grid (picking terms needs the grid). */
                <PhoneCalendar
                  view={view}
                  anchor={anchor}
                  days={days}
                  byDay={byDay}
                  marks={marks}
                  calendarById={calendarById}
                  catalogue={catalogue}
                  now={now}
                  todayKey={todayKey}
                  holidayColor={holidayColor}
                  onOpen={setOpenId}
                  clubWindowsByDay={clubWindowsByDay}
                  inquiriesByDay={inquiriesByDay}
                  onOpenInquiry={openInquiry}
                  onOpenClubWindow={(block, point) => setClubPick({ ...block, ...point })}
                  onPickDay={pickDay}
                  onAnchor={setAnchor}
                  onStep={stepBy}
                />
              ) : view === "month" && pickActive ? (
                <PickMonthView
                  days={days}
                  anchorMonth={anchorMonth}
                  todayKey={todayKey}
                  marks={marks}
                  holidayColor={holidayColor}
                  freeMinutes={(day) => freeByDay.get(day) ?? 0}
                  pickedMinutes={(day) => pickedByDay.get(day) ?? 0}
                  onWholeDay={(day) => pick.pickBlocks(day, freeBlocksOn(day))}
                  onExactDay={(day) => pick.pickBlocks(day, freeBlocksOn(day), { whole: true })}
                  takeFor={(day) => pick.previewTake(freeBlocksOn(day))}
                  onChooseTime={(day) => {
                    setAnchor(day);
                    changeView("day");
                  }}
                  onRemoveDay={pick.removeDay}
                  inquiriesByDay={inquiriesByDay}
                  onNote={pick.setNote}
                />
              ) : view === "month" ? (
                <MonthView
                  days={days}
                  byDay={byDay}
                  calendarById={calendarById}
                  catalogue={catalogue}
                  marks={marks}
                  anchor={anchor}
                  anchorMonth={anchorMonth}
                  now={now}
                  todayKey={todayKey}
                  holidayColor={holidayColor}
                  device={isTablet ? "tablet" : "desktop"}
                  rangeSelect={rangeSelect}
                  canSelectRange={canSelectRange}
                  clubBlocksByDay={clubBlocksByDay}
                  clubWindowsByDay={clubWindowsByDay}
                  onOpenClubBlock={(block, point) => setClubPick({ ...block, ...point })}
                  inquiriesByDay={inquiriesByDay}
                  onOpenInquiry={openInquiry}
                  onOpen={setOpenId}
                  onPickDay={pickDay}
                />
              ) : (
                <TimeGrid
                  days={days}
                  view={view === "day" ? "day" : "week"}
                  selectedDay={anchor}
                  calendars={shown}
                  appointmentsByDay={byDay}
                  previewByCalendar={previewByCalendar}
                  blocksByCalendar={blocksByCalendar}
                  marks={marks}
                  openSpan={openSpan}
                  now={now}
                  employeeId={employeeId}
                  nowLineColor={nowLineColor}
                  holidayColor={holidayColor}
                  lunchColor={lunchColor}
                  zoom={zoom}
                  onZoom={changeZoom}
                  resolutionStep={resolution.step}
                  mayBook={mayBook}
                  mayBlock={mayBlock}
                  onOpen={setOpenId}
                  onBook={bookFromGrid}
                  onAddToClubOrder={
                    pickActive
                      ? undefined
                      : (selection) =>
                          setAddToClub({
                            marked: {
                              id: "pending-range",
                              kind: "time",
                              columnKey: selection.columnKey,
                              calendarId: selection.calendarId,
                              activityId: selection.activityId,
                              dayKey: selection.dayKey,
                              range: selection.range,
                            },
                            source: "pending",
                          })
                  }
                  onPickDay={pickDay}
                  inquiriesByDay={inquiriesByDay}
                  onOpenInquiry={pickActive ? undefined : openInquiry}
                  columns={pickActive ? undefined : columns}
                  catalogue={catalogue}
                  device={isTablet || (isPhone && pickActive) ? "tablet" : "desktop"}
                  rangeSelect={pickActive ? undefined : rangeSelect}
                  multi={multi}
                  pick={pick.gridPick}
                  touchPick={pickActive && touchPick}
                  onOpenClubBlock={setClubPick}
                  onMove={setMoveProposal}
                />
              )}
            </AsyncSection>
          </AsyncSection>
        </Box>
        {pick.panel !== null && device === "desktop" ? <PickOrderPanel device="desktop" {...pick.panel} /> : null}
      </Box>

      {/* The calculator of a phone order: beside the grid on a desktop (inside the grid layout above), a bar at the bottom elsewhere. */}
      {pick.panel !== null && device !== "desktop" ? (
        <>
          <Box aria-hidden sx={{ height: 150 }} />
          <PickOrderPanel device={device} {...pick.panel} />
        </>
      ) : null}

      {/* Phone: "Nová objednávka" pinned above the bottom bar. */}
      {isPhone && mayBook && !pickActive ? (
        <PinnedActionBar label={CAL_TEXT.newAppointment}>
          <Button variant="contained" onClick={() => void bookNextFree()} sx={{ minHeight: 44 }}>
            {GRID_TEXT.newAppointment}
          </Button>
          <Button variant="outlined" onClick={() => setEntryOpen(true)} sx={{ minHeight: 44 }}>
            Klubová objednávka
          </Button>
        </PinnedActionBar>
      ) : null}

      {/* The calendars to show and the worker: a menu on tablet and desktop. */}
      <Popover
        open={filterMenu !== null}
        anchorEl={filterMenu}
        onClose={() => setFilterMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 300, maxWidth: "calc(100vw - 24px)", p: 2, borderRadius: `${DESIGN.radius.xl}px`, boxShadow: DESIGN.shadow.menu } } }}
      >
        <Box role="dialog" aria-label={CAL_TEXT.calendarsFilter}>
          {filtersContent}
        </Box>
      </Popover>

      {/* Phone: "Kalendář a filtry". */}
      <Drawer
        anchor="bottom"
        open={isPhone && filtersOpen}
        onClose={() => setFiltersOpen(false)}
        slotProps={{ paper: { sx: { maxHeight: "88vh", borderTopLeftRadius: 16, borderTopRightRadius: 16 } } }}
      >
        <Box role="dialog" aria-label={CAL_TEXT.filters} sx={{ p: 2, pb: 3, overflowY: "auto" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700 }}>{CAL_TEXT.filters}</Typography>
            <IconButton aria-label={CAL_TEXT.filtersClose} onClick={() => setFiltersOpen(false)} sx={{ width: 44, height: 44 }}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Stack spacing={3}>
            {sideContent(true)}
            {filtersContent}
          </Stack>
        </Box>
      </Drawer>

      {/* The range popover (N-Slot, for days): book from the first day, block whole days, or hand it to a club. */}
      <SelectionPopover
        anchor={addToClub ? null : chosenRange ? { x: chosenRange.x, y: chosenRange.y } : null}
        title={chosenRange ? rangeDates(chosenRange) : ""}
        subtitle={chosenRange ? daysWord(dayCount(chosenRange)) : ""}
        caption={shown.length > 1 ? `${GRID_TEXT.calendars}: ${shown.map((c) => c.name).join(", ")}` : shown[0]?.name}
        mayBook={mayBook}
        mayBlock={mayBlock}
        hints={{ book: CAL_TEXT.rangeBookHint, block: CAL_TEXT.rangeBlockHint }}
        onBook={() => {
          if (!chosenRange) return;
          const first = chosenRange.from;
          rangeSelect.clear();
          openBooking({ initialDate: first, initialCalendarId: shown[0]?.id });
        }}
        onBlock={() => {
          if (!chosenRange) return;
          const range = { from: chosenRange.from, to: chosenRange.to };
          rangeSelect.clear();
          setRangeBlock(range);
        }}
        onAddToClubOrder={() => {
          if (!chosenRange) return;
          setAddToClub({ marked: { id: "popover-range", kind: "days", from: chosenRange.from, to: chosenRange.to }, source: "popover" });
        }}
        onClose={rangeSelect.clear}
      />

      {/* Several marked places: the tray, and its block dialog. */}
      <SelectionTray
        items={pickActive || addToClub ? [] : multi.items}
        today={todayKey}
        phone={isPhone}
        mayBook={mayBook}
        mayBlock={mayBlock}
        onRemove={multi.remove}
        onClear={multi.clear}
        onBook={() => {
          const only = multi.items[0];
          if (!only || only.kind !== "time") return;
          multi.clear();
          bookFromGrid(toRequest(only.calendarId, only.activityId, only.dayKey, only.range));
        }}
        onBlock={() => setMultiBlock(true)}
        onAddToClubOrder={() => {
          const only = multi.items[0];
          if (!only) return;
          setAddToClub({ marked: only, source: "tray" });
        }}
      />
      {multiBlock ? (
        <MultiBlockDialog
          items={multi.items}
          calendars={shown}
          onClose={() => setMultiBlock(false)}
          onDone={() => {
            setMultiBlock(false);
            multi.clear();
          }}
        />
      ) : null}

      {rangeBlock ? (
        <RangeBlockDialog range={rangeBlock} calendars={shown} onClose={() => setRangeBlock(null)} />
      ) : null}

      {addToClub && mayBook ? (
        <AddToClubOrderDialog
          marked={addToClub.marked}
          calendars={shown}
          serviceId={singleServiceId}
          today={todayKey}
          onClose={() => setAddToClub(null)}
          onAdded={() => {
            /* "pending" (a single dragged range) was already cleared by the grid itself when the dialog opened. */
            if (addToClub.source === "tray") multi.remove(addToClub.marked.id);
            else if (addToClub.source === "popover") rangeSelect.clear();
            setAddToClub(null);
          }}
        />
      ) : null}

      {moveProposal ? <MoveConfirmDialog move={moveProposal} onClose={() => setMoveProposal(null)} /> : null}

      <ClubBlockPopover
        pick={clubPick}
        today={todayKey}
        onOpen={openClubBlock}
        onOpenOrder={openClubOrder}
        {...(mayBook && !pickActive ? { onEditTerms: editClubOrderTerms } : {})}
        onClose={() => setClubPick(null)}
      />

      {/* "Nová klubová objednávka": the two ways in. A starts picking in this calendar, B shows the club's link. */}
      <ClubOrderEntry
        open={entryOpen && mayBook}
        onClose={() => setEntryOpen(false)}
        onPhone={(clubId) => setSetupFor(clubId !== undefined ? { clubId } : {})}
      />
      {setupFor !== null && mayBook ? (
        <PickOrderSetup
          open
          defaultClubId={setupFor.clubId}
          parent={setupFor.parent}
          onClose={() => setSetupFor(null)}
          onStart={(session) => {
            setSetupFor(null);
            pick.start(session);
          }}
        />
      ) : null}
      <PickDuplicateDialog order={pick.duplicate} onChoose={pick.resolveDuplicate} />
      <Dialog open={pick.result !== null} onClose={pick.closeResult} fullWidth maxWidth="sm" fullScreen={isPhone}>
        <DialogTitle>{pick.resultTitle}</DialogTitle>
        <DialogContent>{pick.result !== null ? <OrderSuccess order={pick.result} /> : null}</DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={pick.closeResult}>Hotovo</Button>
        </DialogActions>
      </Dialog>

      {/* 5.8. The row is gone from the answer once it is cancelled, so the
          dialog closes itself rather than showing a stale copy. */}
      {booking && mayBook ? (
        <NewAppointmentDialog
          key={booking.key}
          open
          onClose={() => setBooking(null)}
          onBooked={() => void appointmentsQuery.refetch()}
          onFindNextFree={findNextFreeForDialog}
          {...booking.prefill}
        />
      ) : null}

      {openAppointment?.calendarId ? (
        <AppointmentDetail
          appointmentId={openAppointment.id}
          calendarId={openAppointment.calendarId}
          calendar={calendarById.get(openAppointment.calendarId)}
          open
          onClose={() => setOpenId(null)}
          onChanged={() => void appointmentsQuery.refetch()}
        />
      ) : null}
    </Box>
  );
}
