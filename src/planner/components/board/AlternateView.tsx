/*
 * `#alternate-view` - the prototype's "Den" (a list of the day) and "Měsíc" (42 tiles) which cover
 * the week board (`renderAlternative`). With the real calendar the day's bookings are among the
 * rows and the tiles count them too; closed days are named on their tile.
 */
import type { CSSProperties, RefObject } from 'react';
import { FRESH_MS, usePickedDays } from '../../motion/planFx';
import { inRange, rangePill } from '../../../components/booking/calendar/model';
import { inquiryLabel, inquiryTileLabel, inquiryTitle, type InquiryRef } from '../../model/inquiries';
import { PLANNER_TEXT } from '../../text';
import type { DayListModel, MonthListModel } from './boardModel';
import './month/month.css';
import { DayTray, MonthTools } from './month/MonthSelectionUi';
import type { DaySelectApi } from './month/useDaySelect';

/** A club inquiry as a dashed chip; a button that opens the order when `onOpen` is given. */
export function InquiryChip({ inquiry, onOpen }: { inquiry: InquiryRef; onOpen?: (orderId: string) => void }) {
  const className = `inquiry-chip${inquiry.current ? ' is-current' : ''}`;
  const common = { 'data-testid': `inquiry-chip-${inquiry.orderId}`, title: inquiryTitle(inquiry) };
  return onOpen ? (
    <button type="button" className={className} {...common} aria-label={`${inquiryLabel(inquiry)}. ${PLANNER_TEXT.inquiry.openOrder}`} onClick={() => onOpen(inquiry.orderId)}>
      {inquiryLabel(inquiry)}
    </button>
  ) : (
    <span className={className} {...common}>{inquiryLabel(inquiry)}</span>
  );
}

export function DayList({
  model,
  onOpen,
  onCreate,
  inquiries = [],
  onOpenInquiry,
}: {
  model: DayListModel;
  onOpen: (row: DayListModel['rows'][number]) => void;
  onCreate: () => void;
  /** The club inquiries asking for this day: dashed chips above the rows. */
  inquiries?: readonly InquiryRef[];
  onOpenInquiry?: (orderId: string) => void;
}) {
  return (
    <>
      <div className="alternative-head">{model.heading}</div>
      {inquiries.length ? (
        <div className="inquiry-list" role="group" aria-label={PLANNER_TEXT.inquiry.listTitle} data-testid="day-inquiries">
          {inquiries.map((inquiry) => <InquiryChip key={inquiry.orderId} inquiry={inquiry} {...(onOpenInquiry ? { onOpen: onOpenInquiry } : {})} />)}
        </div>
      ) : null}
      {model.rows.length ? (
        model.rows.map((row) => (
          <div
            key={row.key}
            className={`alt-row${row.kind === 'booking' ? ' is-booking' : ''}`}
            data-event={row.id}
            data-kind={row.kind}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(row)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(row);
              }
            }}
          >
            <span>{row.timeLabel}</span>
            <strong>
              {row.name}
              {row.sub ? <span className="alt-sub">{row.sub}</span> : null}
              {row.priceText ? <span className="alt-price">{row.priceText}</span> : null}
            </strong>
            <span>{row.tail}</span>
          </div>
        ))
      ) : (
        <div className="empty-info">
          {model.empty}
          <div style={{ marginTop: 18 }}>
            <button className="app-button primary" type="button" data-command="newEvent" onClick={onCreate}>+ Vytvořit termín</button>
          </div>
        </div>
      )}
    </>
  );
}

/** The month's several-days selection: the state, the element the drag is read from, and what the tray may do. */
export interface MonthSelection {
  select: DaySelectApi;
  surfaceRef: RefObject<HTMLDivElement | null>;
  today: string;
  mayBlock: boolean;
  onBlock: () => void;
  /** Club planning: the marked days go to the order being planned (a click on a day plans it whole). */
  club?: { onPlan: () => void; busy: boolean };
}

export function MonthMatrix({ model, onPick, selection }: { model: MonthListModel; onPick: (date: string) => void; selection?: MonthSelection }) {
  const select = selection?.select;
  const picked = usePickedDays();
  /* The days the last pick took ripple once, in the order they were taken; a month opened later stays calm. */
  const rippleOf = new Map(Date.now() - picked.at < FRESH_MS + 400 ? picked.dates.map((d, i) => [d, i] as const) : []);
  const highlight = select?.highlight ?? null;
  const firstLit = highlight ? model.tiles.find((t) => inRange(t.date, highlight))?.date : undefined;
  return (
    <>
      <div className="alternative-head">{model.heading}</div>
      {select ? <MonthTools select={select} club={selection?.club !== undefined} /> : null}
      <div
        className="month-matrix"
        ref={selection?.surfaceRef}
        data-testid="month-matrix"
        data-dragging={select?.dragging ? 'true' : undefined}
      >
        {model.tiles.map((t) => {
          const lit = inRange(t.date, highlight);
          const placed = select?.placeState(t.date) ?? null;
          return (
            <button
              key={t.date}
              type="button"
              className={`month-tile${lit || placed === 'active' ? ' is-picked' : placed === 'past' ? ' is-picked-past' : ''}`}
              data-day={t.date}
              data-range-day={select ? t.date : undefined}
              data-picked={lit || placed === 'active' ? 'true' : placed === 'past' ? 'past' : undefined}
              data-inquiry={t.inquiries.length ? 'true' : undefined}
              data-fx={rippleOf.has(t.date) ? 'picked' : undefined}
              style={{ opacity: t.otherMonth ? 0.42 : 1, ...(rippleOf.has(t.date) ? { '--ripple-i': rippleOf.get(t.date) } : {}) } as CSSProperties}
              onPointerDown={(event) => {
                if (select && event.button === 0) select.begin(t.date, event);
              }}
              onPointerUp={select?.cancelPress}
              onPointerCancel={select?.cancelPress}
              onClick={(event) => {
                if (select?.tap(t.date, { x: event.clientX, y: event.clientY })) return;
                if (select?.swallowClick(event)) return;
                onPick(t.date);
              }}
            >
              {highlight && t.date === firstLit ? (
                <span className="range-pill" data-testid="range-pill" aria-hidden="true">{rangePill(highlight)}</span>
              ) : null}
              <span className="date-num">{t.dayNumber}</span>
              {t.countLabel ? <small>{t.countLabel}</small> : null}
              {t.flag ? <small className="tile-flag" style={{ color: '#e7cba9' }}>{t.flag}</small> : null}
              {t.blocked ? <small className="tile-blocked" data-testid={`tile-blocked-${t.date}`}>{PLANNER_TEXT.days.blockedTile}</small> : null}
              {t.inquiries.length ? (
                <small className="tile-inquiry" data-testid={`tile-inquiry-${t.date}`} title={t.inquiries.map(inquiryTitle).join(' · ')}>
                  {inquiryTileLabel(t.inquiries)}
                </small>
              ) : null}
            </button>
          );
        })}
      </div>
      {selection ? <DayTray select={selection.select} today={selection.today} mayBlock={selection.mayBlock} onBlock={selection.onBlock} {...(selection.club ? { club: selection.club } : {})} /> : null}
    </>
  );
}
