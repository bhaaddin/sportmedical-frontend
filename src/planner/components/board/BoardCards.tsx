/*
 * The cards of the board, drawn in the file's `button.schedule-event` language:
 *
 *   SessionCard   a term of the planner (činnost colour and icon, "N slotů", the times, the price
 *                 line when it is tall enough). Its edge handles (`.term-resize-handle`) and
 *                 `data-session-id` are what the planning layer (club planning) grabs.
 *   BookingCard   one booking of the real calendar (patient, činnost, times, price) - the same
 *                 click semantics as the old grid: one click selects (the summary), two open the detail.
 *   WindowBlock   a club's window (one block per day across the lunch) or a manual block.
 *
 * Hover cards are MUI tooltips (real size, portalled to the body); they carry the price line.
 */
import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Tooltip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { DayAppointment } from '../../../api/bookingContracts';
import { useCalendarDisplay } from '../../../api/displaySettings';
import { patientsApi } from '../../../api/patients';
import { AppointmentHoverCard } from '../../../components/booking/grid/AppointmentHoverCard';
import { DOUBLE_TAP_MS, DRAG_THRESHOLD_PX } from '../../../components/booking/grid/moveDrag';
import { Icon } from '../Icons';
import { toneVars, withAlpha, type BookingCardModel, type BoardWindowModel, type SessionCardModel } from './boardModel';

const tooltipSlotProps = {
  tooltip: {
    sx: {
      bgcolor: '#042c3d',
      color: '#eaf7ff',
      border: '1px solid #19708a',
      boxShadow: '0 10px 30px #000c',
      p: 1,
      fontSize: 12,
    },
  },
  arrow: { sx: { color: '#042c3d' } },
} as const;

const cardStyle = (card: SessionCardModel | BookingCardModel): CSSProperties =>
  ({
    left: card.left,
    width: card.width,
    top: `${card.top}px`,
    height: `${card.height}px`,
    zIndex: 3,
    ...toneVars(card.tone),
  }) as CSSProperties;

/* -------------------------------------------------------------------------- */
/* Session                                                                     */
/* -------------------------------------------------------------------------- */

function SessionTip({ card }: { card: SessionCardModel }) {
  const free = Math.max(0, card.capacity - card.booked);
  return (
    <div className="board-tip" data-testid="session-tip">
      <strong>{card.name}</strong>
      <dl>
        <dt>Čas</dt>
        <dd>{card.timeLabel}</dd>
        <dt>Kapacita</dt>
        <dd>{card.capacityLabel}</dd>
        <dt>Obsazenost</dt>
        <dd>{card.booked} / {card.capacity} osob</dd>
        <dt>Volná místa</dt>
        <dd>{free}</dd>
        <dt>Cena</dt>
        <dd data-testid="session-tip-price">{card.priceText}</dd>
      </dl>
    </div>
  );
}

export function SessionCard({
  card,
  armed,
  onOpen,
}: {
  card: SessionCardModel;
  /** A činnost is armed (planning): the click belongs to the planning layer. */
  armed: boolean;
  onOpen: (card: SessionCardModel) => void;
}) {
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <Tooltip arrow placement="top" enterDelay={350} enterNextDelay={350} slotProps={tooltipSlotProps} title={armed ? '' : <SessionTip card={card} />}>
      <button
        type="button"
        className={`schedule-event board-session${card.compact ? ' compact' : ''}${card.source === 'public' ? ' is-public' : ''}`}
        style={cardStyle(card)}
        data-board-item="session"
        data-col={card.col}
        data-lane={card.lane}
        data-lanes={card.lanes}
        data-session-id={card.session.id}
        data-category-id={card.categoryId}
        data-source={card.source}
        data-testid={`board-card-${card.session.id}`}
        data-price-lines={card.priceOwnLine ? 'own' : card.showPrice ? 'shared' : 'none'}
        aria-label={card.ariaLabel}
        onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => {
          down.current = { x: e.clientX, y: e.clientY };
        }}
        onClick={(e) => {
          e.stopPropagation();
          const start = down.current;
          down.current = null;
          /* The click that ends a drag (moving or pulling an edge) is not a click on the card. */
          if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_THRESHOLD_PX) return;
          onOpen(card);
        }}
      >
        <span className="event-symbol"><Icon name={card.iconKey} /></span>
        <span className="event-contents">
          <span className="event-title">{card.name}</span>
          <strong>{card.capacityLabel}</strong>
          <span className="event-time">{card.timeLabel}</span>
          {card.priceOwnLine ? <span className="event-price" data-testid="price-line">{card.priceText}</span> : null}
          {card.showMore ? <span className="event-more" data-testid="more-line">{card.booked} / {card.capacity} osob</span> : null}
        </span>
        <span className="term-resize-handle term-resize-top" data-expand-edge="top" aria-hidden="true" />
        <span className="term-resize-handle term-resize-bottom" data-expand-edge="bottom" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/* Booking                                                                     */
/* -------------------------------------------------------------------------- */

const isRealPatient = (a: DayAppointment) => a.patientId !== '' && a.patientId !== '00000000-0000-0000-0000-000000000000';

export function BookingCard({
  card,
  selected,
  proposed,
  moving,
  dragEnabled,
  onPress,
  onSelect,
  onOpen,
}: {
  card: BookingCardModel;
  selected: boolean;
  /** Sits at its new slot while the confirm popover is open. */
  proposed: boolean;
  /** Being dragged: the card stays faded where it was. */
  moving: boolean;
  dragEnabled: boolean;
  onPress: (event: ReactPointerEvent<HTMLElement>, card: BookingCardModel) => void;
  onSelect: (card: BookingCardModel, element: HTMLElement) => void;
  onOpen: (id: string) => void;
}) {
  const { settings } = useCalendarDisplay();
  const a = card.appointment;
  const lastTap = useRef<number | null>(null);
  const nameQuery = useQuery({
    queryKey: ['patient', a.patientId],
    queryFn: () => patientsApi.getById(a.patientId),
    enabled: !card.compact && isRealPatient(a),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const patient = nameQuery.data;
  const patientName = isRealPatient(a)
    ? (patient ? patient.fullName || `${patient.firstName} ${patient.lastName}`.trim() : card.rowName)
    : card.rowName;
  const title = patientName ?? card.activityName;
  const sub = patientName ? card.activityName : '';

  const activate = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    /* Keyboard activation arrives as a click with detail 0: it opens straight away. */
    if (event.detail === 0) {
      lastTap.current = null;
      onOpen(a.id);
      return;
    }
    const at = Date.now();
    const twice = event.detail >= 2 || (lastTap.current !== null && at - lastTap.current < DOUBLE_TAP_MS);
    if (twice) {
      lastTap.current = null;
      onOpen(a.id);
      return;
    }
    lastTap.current = at;
    onSelect(card, event.currentTarget);
  };

  return (
    <Tooltip
      arrow
      placement="top"
      enterDelay={350}
      enterNextDelay={350}
      slotProps={tooltipSlotProps}
      title={selected || proposed || moving ? '' : <AppointmentHoverCard appointment={a} calendarName={card.calendar?.name} fields={settings.hoverFields} />}
    >
      <button
        type="button"
        className={`schedule-event board-booking${card.compact ? ' compact' : ''}${card.cancelled ? ' is-cancelled' : ''}${selected ? ' is-selected' : ''}${proposed ? ' is-proposed' : ''}${moving ? ' is-moving-origin' : ''}`}
        style={{ ...cardStyle(card), cursor: dragEnabled ? 'grab' : 'pointer', zIndex: selected || proposed ? 12 : 4 }}
        data-board-item="booking"
        data-col={card.col}
        data-lane={card.lane}
        data-lanes={card.lanes}
        data-booking-id={a.id}
        data-testid={`board-booking-${a.id}`}
        data-draggable={dragEnabled ? 'true' : undefined}
        data-price-lines={card.priceOwnLine ? 'own' : card.showPrice ? 'shared' : 'none'}
        aria-label={card.ariaLabel}
        aria-haspopup="dialog"
        onPointerDown={dragEnabled ? (e) => onPress(e, card) : undefined}
        onContextMenu={dragEnabled ? (e) => e.preventDefault() : undefined}
        onClick={activate}
      >
        <span className="event-symbol"><Icon name={card.iconKey} /></span>
        <span className="event-contents">
          <span className="event-title">{title}</span>
          {sub ? <strong>{sub}</strong> : null}
          <span className="event-time-row">
            <span className="event-time">{card.timeLabel}</span>
            {card.showPrice && !card.priceOwnLine ? (
              <span className="event-price" data-testid="price-line">{card.priceAdjusted ? `${card.priceText} · upraveno` : card.priceText}</span>
            ) : null}
          </span>
          {card.priceOwnLine ? (
            <span className="event-price" data-testid="price-line">{card.priceAdjusted ? `${card.priceText} · upraveno` : card.priceText}</span>
          ) : null}
          {card.showMore && card.calendar ? <span className="event-more" data-testid="more-line">{card.calendar.name}</span> : null}
        </span>
      </button>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/* Club window / manual block                                                  */
/* -------------------------------------------------------------------------- */

export function WindowBlock({ window: w, onOpen }: { window: BoardWindowModel; onOpen: (w: BoardWindowModel, point: { x: number; y: number }) => void }) {
  const manual = w.kind === 'manual';
  const style = {
    left: w.left,
    width: w.width,
    top: `${w.top}px`,
    height: `${w.height}px`,
    '--win-line': manual ? 'rgba(180, 203, 220, 0.5)' : withAlpha(w.colour, 0.8),
    '--win-hatch': `repeating-linear-gradient(135deg, ${withAlpha(w.colour, manual ? 0.1 : 0.24)} 0px, ${withAlpha(w.colour, manual ? 0.1 : 0.24)} 7px, ${withAlpha(w.colour, 0.06)} 7px, ${withAlpha(w.colour, 0.06)} 14px)`,
    borderLeftColor: manual ? 'rgba(180, 203, 220, 0.5)' : w.colour,
  } as CSSProperties;
  return (
    <button
      type="button"
      className={`board-window ${manual ? 'is-manual' : 'is-club'}`}
      style={style}
      data-board-item="window"
      data-col={w.col}
      data-kind={w.kind}
      data-testid={`board-window-${w.block.id}-${w.day}`}
      aria-haspopup="dialog"
      aria-label={manual ? `Blokováno: ${w.label}, ${w.timeLabel}` : `Blok klubu ${w.label}, ${w.timeLabel}`}
      title={manual ? undefined : `Blok klubu · ${w.label} · ${w.timeLabel}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(w, { x: e.clientX, y: e.clientY });
      }}
    >
      <span className="board-sticky">
        <span className="win-label">{w.label}</span>
        {!manual ? <span className="win-time" data-testid="club-window-time">{w.timeLabel}</span> : null}
      </span>
    </button>
  );
}
