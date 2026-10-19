/*
 * `#alternate-view` - the prototype's "Den" (a list of the day) and "Měsíc" (42 tiles) which cover
 * the week board (`renderAlternative`). With the real calendar the day's bookings are among the
 * rows and the tiles count them too; closed days are named on their tile.
 */
import { inquiryLabel, inquiryTileLabel, inquiryTitle, type InquiryRef } from '../../model/inquiries';
import { PLANNER_TEXT } from '../../text';
import type { DayListModel, MonthListModel } from './boardModel';

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

export function MonthMatrix({ model, onPick }: { model: MonthListModel; onPick: (date: string) => void }) {
  return (
    <>
      <div className="alternative-head">{model.heading}</div>
      <div className="month-matrix">
        {model.tiles.map((t) => (
          <button
            key={t.date}
            type="button"
            className="month-tile"
            data-day={t.date}
            data-inquiry={t.inquiries.length ? 'true' : undefined}
            style={{ opacity: t.otherMonth ? 0.42 : 1 }}
            onClick={() => onPick(t.date)}
          >
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
        ))}
      </div>
    </>
  );
}
