/*
 * `#alternate-view` - the prototype's "Den" (a list of the day) and "Měsíc" (42 tiles) which cover
 * the week board (`renderAlternative`). With the real calendar the day's bookings are among the
 * rows and the tiles count them too; closed days are named on their tile.
 */
import { useState, type CSSProperties, type RefObject } from 'react';
import { FRESH_MS, usePickedDays } from '../../motion/planFx';
import { inRange, rangePill } from '../../../components/booking/calendar/model';
import { inquiryLabel, inquiryTileLabel, inquiryTitle, type InquiryRef } from '../../model/inquiries';
import { PLANNER_TEXT } from '../../text';
import { Icon } from '../Icons';
import { clubItemText } from './clubHold';
import { groupDayRows, type DayListModel, type DayRowGroup, type DayRowModel, type MonthListModel } from './boardModel';
import { agendaSlotLabel } from '../../model';
import type { PhoneEntry } from './phoneModel';
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

/** One row of the Den list: a booking or a term; opens its record. */
function DayRow({ row, onOpen, member = false }: { row: DayRowModel; onOpen: (row: DayRowModel) => void; member?: boolean }) {
  return (
    <div
      className={`alt-row${row.kind === 'booking' ? ' is-booking' : ''}${member ? ' is-member' : ''}`}
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
  );
}

/**
 * A činnost with several bookings (or terms) on the day as ONE row - "Komplexní prohlídka ×10 · 10 slotů" - that opens
 * to the rows behind it (reviewer 2.2). Thirty people for one examination keep the day's list short.
 */
function DayGroupRow({ group, onOpen }: { group: DayRowGroup; onOpen: (row: DayRowModel) => void }) {
  const [open, setOpen] = useState(false);
  const mark = group.count > 1 ? ` ×${group.count}` : '';
  return (
    <div className="alt-group" data-testid="day-group" data-category={group.categoryId} data-kind={group.kind}>
      <button
        type="button"
        className={`alt-row is-group${group.kind === 'booking' ? ' is-booking' : ''}`}
        aria-expanded={open}
        aria-label={`${group.name}${mark}, ${group.slots} ${agendaSlotLabel(group.slots)}, ${group.timeLabel}. ${open ? 'Skrýt' : 'Zobrazit'} jednotlivé záznamy`}
        style={group.colour ? ({ '--group-tone': group.colour } as CSSProperties) : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{group.timeLabel}</span>
        <strong>
          <i className="alt-dot" aria-hidden="true" />
          {group.name}
          <span className="alt-count" data-testid="day-group-count">{mark.trim()}</span>
        </strong>
        <span>{group.slots} {agendaSlotLabel(group.slots)}<span className="alt-chevron" aria-hidden="true">{open ? '▴' : '▾'}</span></span>
      </button>
      {open ? (
        <div className="alt-members" data-testid="day-group-members">
          {group.rows.map((row) => <DayRow key={row.key} row={row} onOpen={onOpen} member />)}
        </div>
      ) : null}
    </div>
  );
}

/** A club's held time on the day's list: hatched in the club's colour, name + order code + hold state in words (R13). */
function DayHold({ entry, onOpen }: { entry: PhoneEntry; onOpen: (entry: PhoneEntry, point: { x: number; y: number }) => void }) {
  return (
    <button
      type="button"
      className="alt-row is-hold"
      data-kind="club"
      data-testid={`day-hold-${entry.id}`}
      style={entry.colour ? ({ '--club-tone': entry.colour } as CSSProperties) : undefined}
      onClick={(event) => onOpen(entry, { x: event.clientX, y: event.clientY })}
    >
      <span>{entry.timeLabel}</span>
      <strong>
        <Icon name="lock" />
        {entry.title}
        {entry.sub ? <span className="alt-sub" data-testid="day-hold-sub">{entry.sub}</span> : null}
      </strong>
      <span />
    </button>
  );
}

export function DayList({
  model,
  onOpen,
  onCreate,
  inquiries = [],
  onOpenInquiry,
  holds = [],
  onOpenHold,
}: {
  model: DayListModel;
  onOpen: (row: DayListModel['rows'][number]) => void;
  onCreate: () => void;
  /** The club windows of the day (the club's time is drawn even before its players are in). */
  holds?: readonly PhoneEntry[];
  onOpenHold?: (entry: PhoneEntry, point: { x: number; y: number }) => void;
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
      {holds.map((h) => <DayHold key={h.key} entry={h} onOpen={onOpenHold ?? (() => {})} />)}
      {model.rows.length ? (
        groupDayRows(model.rows).map((item) =>
          item.type === 'group' ? <DayGroupRow key={item.group.key} group={item.group} onOpen={onOpen} /> : <DayRow key={item.row.key} row={item.row} onOpen={onOpen} />,
        )
      ) : holds.length > 0 ? null : (
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
              className={`month-tile${lit || placed === 'active' ? ' is-picked' : placed === 'past' ? ' is-picked-past' : ''}${t.lock ? ` is-lock is-lock-${t.lock.kind}` : ''}`}
              data-day={t.date}
              data-range-day={select ? t.date : undefined}
              data-picked={lit || placed === 'active' ? 'true' : placed === 'past' ? 'past' : undefined}
              data-inquiry={t.inquiries.length ? 'true' : undefined}
              data-fx={rippleOf.has(t.date) ? 'picked' : undefined}
              style={{ opacity: t.otherMonth ? 0.42 : 1, ...(t.lock ? { '--lock-fill': t.lock.fill, '--lock-ink': t.lock.ink } : {}), ...(rippleOf.has(t.date) ? { '--ripple-i': rippleOf.get(t.date) } : {}) } as CSSProperties}
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
              {t.activities.length > 0 ? (
                <span className="tile-activities" data-testid={`tile-activities-${t.date}`} title={t.activities.map((a) => `${a.name}${a.count > 1 ? ` ×${a.count}` : ''} · ${a.slots} ${agendaSlotLabel(a.slots)}`).join(' · ')}>
                  {t.activities.slice(0, 2).map((a) => (
                    <small key={a.categoryId} className="tile-activity" data-testid="tile-activity" style={a.colour ? ({ '--tile-tone': a.colour } as CSSProperties) : undefined}>
                      <i aria-hidden="true" />
                      <span className="tile-activity-name">{a.name}</span>
                      {a.count > 1 ? <b>{`×${a.count}`}</b> : null}
                    </small>
                  ))}
                  {t.activities.length > 2 ? <small className="tile-activity tile-activity-more">{`+${t.activities.length - 2}`}</small> : null}
                </span>
              ) : t.countLabel ? <small>{t.countLabel}</small> : null}
              {t.lock ? (
                <small className="tile-flag" data-testid={`tile-lock-${t.date}`} data-lock={t.lock.kind}>
                  <Icon name="lock" />
                  <span>{t.lock.label}</span>
                  {t.lock.reason ? <em>{t.lock.reason}</em> : null}
                </small>
              ) : t.flag ? <small className="tile-flag">{t.flag}</small> : null}
              {t.clubItems.length > 0
                ? t.clubItems.slice(0, 2).map((c) => (
                    /* R13: a club's day is a hatched, locked bar in the club's colour - name, order code and the hold state in words */
                    <small key={c.key} className="tile-club is-held" data-testid={`tile-club-${t.date}`} data-hold={c.hold ?? undefined} title={t.clubs.join(' · ')} style={{ '--club': c.colour } as CSSProperties}>
                      <Icon name="lock" />
                      <span>{clubItemText(c)}</span>
                      {c.activities.length > 0 ? (
                        <em className="tile-club-acts" data-testid="tile-club-acts" title={c.activities.map((a) => a.name).join(', ')}>
                          {c.activities.slice(0, 4).map((a) => <i key={a.id} style={{ background: a.colour }} />)}
                        </em>
                      ) : null}
                    </small>
                  ))
                : t.clubs.slice(0, 2).map((line) => <small key={line} className="tile-club" data-testid={`tile-club-${t.date}`} title={t.clubs.join(' · ')}>{line}</small>)}
              {t.clubs.length > 2 ? <small className="tile-club tile-club-more" title={t.clubs.join(' · ')}>{`+${t.clubs.length - 2}`}</small> : null}
              {t.calendars.length > 0 ? (
                <span className="tile-calendars" data-testid={`tile-calendars-${t.date}`} aria-label={t.calendars.map((c) => `${c.name}: ${c.count}`).join(', ')}>
                  {t.calendars.map((c) => (
                    <small key={c.id} className="tile-calendar" data-calendar-id={c.id} title={`${c.name}: ${c.count}`} style={c.colour ? ({ '--cal': c.colour } as CSSProperties) : undefined}>
                      <i aria-hidden="true" />
                      <b>{c.count}</b>
                    </small>
                  ))}
                </span>
              ) : null}
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
