/*
 * The phone's list (up to 767 px): no grid, lists. "Den" is an agenda - a strip of the week's seven days on top (swipe
 * the list or tap a day), then the day's bookings, terms, club windows and blocks in time order - and "Měsíc" is one
 * row per day with the figures written out, a tap opens that day. The old calendar's `PhoneCalendar` in the planner's
 * own classes (`phone.css`); "Týden" stays the board with one day at a time. Every target is at least 44 px tall.
 */
import { useRef, useState, type CSSProperties, type TouchEvent } from 'react';
import { InquiryChip } from './AlternateView';
import { PLANNER_TEXT } from '../../text';
import type { InquiryRef } from '../../model/inquiries';
import type { PhoneEntry, PhoneMonthRow, StripDayModel } from './phoneModel';
import './phone.css';

/** One entry of the phone's day list; a folded činnost (`members`) opens to its rows. */
function PhoneEntryRow({ entry, onOpenEntry, member = false }: { entry: PhoneEntry; onOpenEntry: (entry: PhoneEntry, point: { x: number; y: number }) => void; member?: boolean }) {
  const [open, setOpen] = useState(false);
  const folded = entry.members !== null;
  return (
    <li className={member ? 'is-member' : undefined}>
      <button
        type="button"
        className={`phone-entry${folded ? ' is-group' : ''}`}
        data-kind={entry.kind}
        data-event={entry.id}
        data-testid={folded ? 'phone-group' : `phone-entry-${entry.id}`}
        aria-expanded={folded ? open : undefined}
        onClick={(event) => (folded ? setOpen((v) => !v) : onOpenEntry(entry, { x: event.clientX, y: event.clientY }))}
      >
        <span className="phone-entry-bar" style={entry.colour ? { background: entry.colour } : undefined} aria-hidden="true" />
        <span className="phone-entry-time">{entry.timeLabel}</span>
        <span className="phone-entry-main">
          <strong>{entry.title}</strong>
          {entry.sub ? <small>{entry.sub}</small> : null}
        </span>
        <span className="phone-entry-tail">
          {entry.tail ? <span>{entry.tail}{folded ? <span aria-hidden="true"> {open ? '▴' : '▾'}</span> : null}</span> : null}
          {entry.priceText ? <small>{entry.priceText}</small> : null}
        </span>
      </button>
      {folded && open ? (
        <ul className="phone-entries phone-members" data-testid="phone-group-members">
          {(entry.members ?? []).map((m) => <PhoneEntryRow key={m.key} entry={m} onOpenEntry={onOpenEntry} member />)}
        </ul>
      ) : null}
    </li>
  );
}

export function PhoneAgenda({
  heading,
  strip,
  entries,
  empty,
  inquiries,
  onSelectDay,
  onStep,
  onOpenEntry,
  onOpenInquiry,
  onCreate,
  canCreate,
}: {
  heading: string;
  strip: readonly StripDayModel[];
  entries: readonly PhoneEntry[];
  /** The sentence of an empty day. */
  empty: string | null;
  inquiries: readonly InquiryRef[];
  onSelectDay: (date: string) => void;
  /** Swipe: one day on or back. */
  onStep: (direction: -1 | 1) => void;
  onOpenEntry: (entry: PhoneEntry, point: { x: number; y: number }) => void;
  onOpenInquiry?: (orderId: string) => void;
  onCreate: () => void;
  canCreate: boolean;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (event: TouchEvent) => {
    const t = event.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const t = event.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 64 && Math.abs(dy) < 40) onStep(dx < 0 ? 1 : -1);
  };
  return (
    <div className="phone-agenda" data-testid="phone-agenda" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="phone-strip" role="group" aria-label={PLANNER_TEXT.phone.weekStrip}>
        {strip.map((d) => (
          <button
            key={d.date}
            type="button"
            className={`phone-strip-day${d.selected ? ' is-selected' : ''}${d.today ? ' is-today' : ''}${d.closed ? ' is-closed' : ''}${d.lock ? ` is-lock is-lock-${d.lock.kind}` : ''}`}
            style={d.lock ? ({ '--lock-fill': d.lock.fill, '--lock-ink': d.lock.ink } as CSSProperties) : undefined}
            data-testid={`phone-strip-${d.date}`}
            data-day={d.date}
            aria-pressed={d.selected}
            aria-current={d.today ? 'date' : undefined}
            aria-label={`${d.weekName} ${d.dayNumber}.${d.flag ? ` – ${d.flag}` : ''}${d.count ? `, ${d.count}` : ''}${d.inquiries ? ` – ${PLANNER_TEXT.inquiry.flagLabel(d.inquiries).toLowerCase()}` : ''}`}
            onClick={() => onSelectDay(d.date)}
          >
            <span>{d.weekName}</span>
            <b>{d.dayNumber}</b>
            <small className={d.count ? 'has-count' : undefined}>{d.count || '·'}</small>
            {d.clubs.length ? (
              <span className="phone-dots" data-testid="club-dots" aria-hidden="true">
                {d.clubs.map((c) => <i key={c.name} title={c.name} style={{ background: c.colour }} />)}
              </span>
            ) : null}
            {d.inquiries ? <i className="phone-inquiry-dot" data-testid="inquiry-dot" aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
      <div className="alternative-head">{heading}</div>
      {inquiries.length ? (
        <div className="inquiry-list" role="group" aria-label={PLANNER_TEXT.inquiry.listTitle} data-testid="day-inquiries">
          {inquiries.map((inquiry) => <InquiryChip key={inquiry.orderId} inquiry={inquiry} {...(onOpenInquiry ? { onOpen: onOpenInquiry } : {})} />)}
        </div>
      ) : null}
      {entries.length ? (
        <ul className="phone-entries" aria-label={PLANNER_TEXT.phone.dayList} data-testid="phone-day-list">
          {entries.map((entry) => <PhoneEntryRow key={entry.key} entry={entry} onOpenEntry={onOpenEntry} />)}
        </ul>
      ) : (
        <div className="empty-info" data-testid="phone-empty">
          {empty ?? PLANNER_TEXT.phone.noBookings}
          {canCreate ? (
            <div className="phone-empty-action">
              <button className="app-button primary" type="button" data-command="newEvent" onClick={onCreate}>
                {PLANNER_TEXT.phone.newBooking}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function PhoneMonthList({ heading, rows, onPick, hint }: { heading: string; rows: readonly PhoneMonthRow[]; onPick: (date: string) => void; hint?: string }) {
  return (
    <>
      <div className="alternative-head">{heading}</div>
      {hint ? <p className="month-hint phone-month-hint" data-testid="phone-month-hint">{hint}</p> : null}
      <ul className="phone-month" aria-label={PLANNER_TEXT.phone.monthList} data-testid="phone-month-list">
        {rows.map((r) => (
          <li key={r.date}>
            <button
              type="button"
              className={`phone-month-row${r.today ? ' is-today' : ''}${r.flag ? ' is-closed' : ''}${r.lock ? ` is-lock is-lock-${r.lock.kind}` : ''}`}
              style={r.lock ? ({ '--lock-fill': r.lock.fill, '--lock-ink': r.lock.ink } as CSSProperties) : undefined}
              data-testid={`phone-month-day-${r.date}`}
              data-day={r.date}
              aria-current={r.today ? 'date' : undefined}
              aria-label={`${r.weekName} ${r.dayNumber}.${r.flag ? ` – ${r.flag}` : ''}, ${r.countLabel ?? PLANNER_TEXT.phone.noBookings}`}
              onClick={() => onPick(r.date)}
            >
              <span className="phone-month-date">
                <span>{r.weekName}</span>
                <b>{r.dayNumber}</b>
              </span>
              <span className="phone-month-body">
                {r.flag ? <span className="phone-month-flag">{r.lock ? r.lock.label : r.flag}</span> : null}
                {r.blocked ? <span className="phone-month-flag" data-testid={`phone-month-blocked-${r.date}`}>{PLANNER_TEXT.days.blockedTile}</span> : null}
                {r.activities.length > 0
                  ? r.activities.map((line) => <span key={line} className="phone-month-activity" data-testid={`phone-month-activity-${r.date}`}>{line}</span>)
                  : r.countLabel ? <span>{r.countLabel}</span> : null}
                {r.calendarLine ? <span className="phone-month-calendars" data-testid={`phone-month-calendars-${r.date}`}>{r.calendarLine}</span> : null}
                {r.clubs.map((line) => <span key={line} className="phone-month-club" data-testid={`phone-month-club-${r.date}`}>{line}</span>)}
                {r.inquiry ? <span className="phone-month-inquiry" data-testid={`phone-month-inquiry-${r.date}`}>{r.inquiry}</span> : null}
                {!r.countLabel && !r.flag && !r.blocked && r.clubs.length === 0 && !r.inquiry ? <span className="phone-month-none">{PLANNER_TEXT.phone.noBookings}</span> : null}
              </span>
              <span className="phone-month-count">{r.count || ''}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
