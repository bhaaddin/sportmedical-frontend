import { useLayoutEffect, useRef, useState } from "react";
import { Box, Tooltip, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  isLateStatus,
  statusName,
  statusTally,
  type DayAppointment,
} from "../../../api/bookingContracts";
import { patientsApi } from "../../../api/patients";
import { activitiesApi } from "../../../api/activities";
import { shownPrice } from "./appointmentPrice";
import { useCalendarDisplay } from "../../../api/displaySettings";
import { DESIGN } from "../../../theme";
import { cardTones } from "../calendar/colors";
import { formatPragueTime, isLate } from "../../../utils/time";
import { AppointmentHoverCard } from "./AppointmentHoverCard";
import { clubLine } from "./clubLine";
import { DOUBLE_TAP_MS } from "./moveDrag";
import { shortName } from "./periodTitle";

/*
 * How many lines of the board's type a grid card can hold (Etapa 12, "ceny
 * všude"). A line is 11-12 px at line-height 1.25 (~14 px) and the card has
 * 5 px of padding top and bottom. The price takes a line of its own only
 * when a fourth line fits; with exactly three it rides on the time line, so
 * the name and the status·činnost line - what the owner asked to see without
 * a hover - are never pushed out. Fewer than three: no price on the card,
 * the hover still has it.
 */
const CARD_LINE_PX = 14;
const CARD_PADDING_PX = 10;
export function linesThatFit(heightPx: number): number {
  if (!Number.isFinite(heightPx) || heightPx <= 0) return 0;
  return Math.floor((heightPx - CARD_PADDING_PX) / CARD_LINE_PX);
}

/** The card's own height, followed as the grid zooms. 0 until measured (jsdom, first paint). */
function useMeasuredHeight(enabled: boolean): [React.RefObject<HTMLElement | null>, number] {
  const ref = useRef<HTMLElement | null>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || element === null) return undefined;
    const read = () => setHeight(element.getBoundingClientRect().height);
    read();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);
  return [ref, height];
}

/**
 * One appointment, drawn the board's way (3. 10. 2026): a flat grey card
 * with a 3px coloured edge on the left, the time in bold, the patient's name
 * under it and the status in muted small print. A patient who has arrived or
 * is being seen sits on the darker grey.
 *
 * It is a `button`, not a div with an onClick (7.1), and its status is written
 * out as well as shaded, because colour may not be the only carrier of the
 * information. The month view (`compact`) has one line per booking.
 */
export function AppointmentButton({
  appointment,
  calendar,
  now,
  onOpen,
  layout,
  accent,
  dense = false,
  shortLabel = false,
  onSelect,
  hover = true,
}: {
  appointment: DayAppointment;
  calendar?: { id: string; name: string; color: string };
  now: Date;
  onOpen: (id: string) => void;
  /**
   * The grid's click semantics (Etapa 12): with this, one click SELECTS the card
   * (the caller shows its summary) and only a double click or double tap - or a
   * keyboard activation, which reaches here as a click with `detail` 0 - opens
   * the detail through `onOpen`. Without it every click opens, as a list row or
   * a month cell wants.
   */
  onSelect?: (id: string, element: HTMLElement) => void;
  /** The hover card; off while the card's own summary is open or a card is being dragged, so there is one card, not two. */
  hover?: boolean;
  layout: "row" | "block" | "compact";
  /** The činnost's colour (contract C1): the card's edge and tint. Without it, the board's grey. */
  accent?: string;
  /** A short card: one line, "09:30 Tomáš Kříž" - the rest is in the hover/tap card. */
  dense?: boolean;
  /** Month on a tablet: "J. Novák" instead of "Jan Novák". */
  shortLabel?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { settings } = useCalendarDisplay();
  /* The last plain click on this card, so a second within DOUBLE_TAP_MS opens it (touch has no dblclick to rely on). */
  const lastTap = useRef<number | null>(null);
  const activate = (event: React.MouseEvent<HTMLElement>) => {
    if (onSelect === undefined || event.detail === 0) {
      lastTap.current = null;
      onOpen(appointment.id);
      return;
    }
    const at = Date.now();
    const twice = event.detail >= 2 || (lastTap.current !== null && at - lastTap.current < DOUBLE_TAP_MS);
    if (twice) {
      lastTap.current = null;
      onOpen(appointment.id);
      return;
    }
    lastTap.current = at;
    onSelect(appointment.id, event.currentTarget);
  };
  const tones = accent
    ? cardTones(accent, theme.palette.background.paper)
    : {
        bg: DESIGN.appointment.bg,
        bgActive: DESIGN.appointment.bgActive,
        edge: calendar?.color ?? DESIGN.appointment.edge,
      };
  const edge = tones.edge;

  /*
   * The patient's name on the cell itself, not only in the hover (owner: "každá
   * objednávka bez haveru musí ukázat jméno a činnost"). Fetched through the same
   * cached ['patient', id] query the hover uses, so a day is one request per
   * patient however many times it is drawn. Not on the month view (compact),
   * where the name the row already carries has to do.
   */
  /* A slot taken for nobody on the books (walk-in or event) has an empty patient
     id and carries its name on the row itself — so there is nothing to fetch, and
     fetching the empty id would 404. Only a real patient is looked up. */
  const hasPatient =
    appointment.patientId !== "" &&
    appointment.patientId !== "00000000-0000-0000-0000-000000000000";
  const nameQuery = useQuery({
    queryKey: ["patient", appointment.patientId],
    queryFn: () => patientsApi.getById(appointment.patientId),
    enabled: layout !== "compact" && hasPatient,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const rowName = appointment.patientName?.trim() || null;
  const patientName = hasPatient
    ? (nameQuery.data
        ? (nameQuery.data.fullName
          || `${nameQuery.data.firstName} ${nameQuery.data.lastName}`.trim())
        : rowName)
    : rowName;
  const late = isLate(appointment.startUtc, isLateStatus(appointment.status), now);
  const tally = statusTally(appointment.status);
  const name = statusName(appointment.status);
  const statusLabel = name
    ? t(`booking.status.${name}`)
    : t("booking.status.unknown");
  const statusLine = late ? `${statusLabel} · ${t("booking.status.late")}` : statusLabel;
  const cancelled = tally === "cancelled";
  const active = tally === "arrived";
  /* "Klub · FK Slaný · −10 %" - the board's club line, from what the server sent. */
  const club = clubLine(appointment.partnerName, appointment.clubDiscountPercent);

  const paperworkMark = appointment.paperwork ? (
    /*
      4.5, v29: ✓ or ⚠ for the paperwork, and nothing at all while the
      register cannot answer. The mark carries a label of its own, because a
      symbol is not a word and 7.1 does not accept one standing alone.
    */
    <Box
      component="span"
      aria-label={
        appointment.paperwork.ready
          ? t("booking.paperwork.ready")
          : t("booking.paperwork.line")
      }
      sx={{ ml: 0.5 }}
    >
      {appointment.paperwork.ready ? "✓" : "⚠"}
    </Box>
  ) : null;

  const compact = layout === "compact";
  /* A grid card is drawn at the board's size (Main.dc.html: time 11/600, name 12/500, status 11);
     a phone's list row is read at arm's length and keeps the larger type. */
  const gridCard = layout === "block";

  /*
   * The price (Etapa 12): agreed, else the list price the row carries, else the
   * činnost's catalogue figure. Never on a dense or compact card; on a grid card
   * only when it is tall enough (see `linesThatFit`); on a list row always.
   */
  const fullCard = !compact && !dense;
  const [cardRef, cardHeight] = useMeasuredHeight(gridCard && fullCard);
  const lines = gridCard ? linesThatFit(cardHeight) : 99;
  const showPrice = fullCard && lines >= 3;
  const priceOwnLine = showPrice && lines >= 4;
  const rowHasPrice = appointment.agreedPriceCzk != null || appointment.listPriceCzk != null;
  const activitiesQuery = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesApi.list(),
    enabled: showPrice && !rowHasPrice,
    staleTime: 5 * 60 * 1000,
  });
  const cataloguePrice = activitiesQuery.data?.activities.find((a) => a.id === appointment.activityId)?.priceCzk ?? null;
  const price = shownPrice(appointment, cataloguePrice);
  const priceText = price.adjusted ? `${price.text} · upraveno` : price.text;

  return (
    <Tooltip
      arrow
      placement="top"
      enterDelay={350}
      enterNextDelay={350}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: "background.paper",
            color: "text.primary",
            boxShadow: DESIGN.shadow.menu,
            border: "1px solid",
            borderColor: "divider",
            p: 1,
          },
        },
        arrow: { sx: { color: "background.paper" } },
      }}
      /* A list row already says everything the card does, and a phone has no hover: no card there. */
      title={
        layout === "row" || !hover ? (
          ""
        ) : (
          <AppointmentHoverCard
            appointment={appointment}
            calendarName={calendar?.name}
            fields={settings.hoverFields}
          />
        )
      }
    >
    <Box
      component="button"
      type="button"
      ref={cardRef}
      data-grid-item="appointment"
      data-status={tally}
      data-price-lines={gridCard && fullCard ? lines : undefined}
      onClick={activate}
      aria-haspopup="dialog"
      aria-label={
        dense && layout === "block"
          ? [
              `${formatPragueTime(appointment.startUtc)} – ${formatPragueTime(appointment.endUtc)}`,
              patientName,
              club,
              appointment.activityName ? `${statusLine} · ${appointment.activityName}` : statusLine,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      sx={{
        display: "block",
        width: "100%",
        height: layout === "block" ? "100%" : "auto",
        textAlign: "left",
        cursor: "pointer",
        border: "none",
        borderLeft: `${compact ? 2 : 3}px solid ${edge}`,
        borderRadius: compact ? "3px" : `${DESIGN.radius.sm}px`,
        px: compact ? 0.75 : gridCard ? "7px" : 1,
        py: compact ? "2px" : gridCard ? "5px" : 0.5,
        font: "inherit",
        lineHeight: 1.25,
        overflow: "hidden",
        backgroundColor: active ? tones.bgActive : tones.bg,
        color: accent ? theme.palette.text.primary : DESIGN.ink,
        opacity: cancelled ? 0.55 : 1,
        textDecoration: cancelled ? "line-through" : "none",
        whiteSpace: compact ? "nowrap" : "normal",
        textOverflow: "ellipsis",
        "&:hover": { backgroundColor: tones.bgActive },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 1,
        },
      }}
    >
      {dense && layout === "block" ? (
        <Box
          component="span"
          sx={{
            display: "block",
            fontSize: 12,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {formatPragueTime(appointment.startUtc)}
          </Box>{" "}
          {patientName ?? appointment.activityName}
          {club ? ` · ${club}` : ""}
          {paperworkMark}
        </Box>
      ) : compact ? (
        /*
          A month cell has one line to spare: the time, then whoever is coming
          - or the činnost when the row carries no name. A status other than
          "booked" is still said in words, never only by shading (7.1).
        */
        <>
          <Box component="span" sx={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {formatPragueTime(appointment.startUtc)}
          </Box>{" "}
          <Box component="span" sx={{ fontSize: 11 }}>
            {(shortLabel && rowName ? shortName(rowName) : rowName) ?? appointment.activityName}
          </Box>
          {club ? (
            <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: DESIGN.muted }}>
              {club}
            </Box>
          ) : null}
          {tally !== "booked" || late ? (
            <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: DESIGN.muted }}>
              {late ? t("booking.status.late") : statusLabel}
            </Box>
          ) : null}
          {paperworkMark}
        </>
      ) : (
        <>
          <Box
            component="span"
            sx={{
              display: "flex",
              justifyContent: "space-between",
              gap: 1,
              fontSize: gridCard ? 11 : 13,
              fontWeight: gridCard ? 600 : 700,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            <span>
              {formatPragueTime(appointment.startUtc)} – {formatPragueTime(appointment.endUtc)}
            </span>
            {showPrice && !priceOwnLine ? (
              /* Three lines of room: the price shares the time line, right-aligned, so the
                 name and the status·činnost line stay whole. */
              <Box
                component="span"
                data-testid="price-line"
                sx={{ fontWeight: 500, color: DESIGN.muted, overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {priceText}
              </Box>
            ) : null}
          </Box>
          {patientName ? (
            <Box
              component="span"
              sx={{
                display: "block",
                fontSize: gridCard ? 12 : 14,
                fontWeight: gridCard ? 500 : 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {patientName}
            </Box>
          ) : null}
          {priceOwnLine ? (
            /* A fourth line fits: the price is the card's third line, after the name. */
            <Box
              component="span"
              data-testid="price-line"
              sx={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {priceText}
            </Box>
          ) : null}
          {club ? (
            <Box
              component="span"
              data-testid="club-line"
              sx={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: DESIGN.muted,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {club}
            </Box>
          ) : null}
          <Box
            component="span"
            sx={{
              display: "block",
              fontSize: 11,
              color: DESIGN.muted,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {statusLine}
            {appointment.activityName ? ` · ${appointment.activityName}` : ""}
            {paperworkMark}
          </Box>
        </>
      )}
    </Box>
    </Tooltip>
  );
}

