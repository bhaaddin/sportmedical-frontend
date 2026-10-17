/*
 * Pieces of the reservation drawer (prototype `bookingBreakdownMarkup`, `renderDayEventCard`) and of the
 * club occupancy overview, shared by both. They only draw what `model/booking.ts` computed; the real records
 * under a card (`RecordRow`) are the new part: one row per booking / club window, each opening its record.
 */
import type { CSSProperties } from 'react';
import type { BreakdownPart, DayEventCardModel } from '../../../model';
import { PRICE_LINE_TEXT, formatCzk } from '../../../../components/booking/grid/appointmentPrice';
import type { DayRecord, DayRecordGroup } from './dayRecords';
import { recordsTotal } from './dayRecords';

const css = (vars: Record<string, string>): CSSProperties => vars as CSSProperties;

/** The four coloured figures and the occupancy split bar. */
export function BreakdownBlock({ parts }: { parts: BreakdownPart[] }) {
  return (
    <>
      <div className="rd-quad" data-testid="rd-breakdown">
        {parts.map((part) => (
          <div className="rd-kpi" key={part.label} data-kpi={part.label}>
            <div className="rd-kpi-name"><i className="rd-dot" style={css({ '--dot': part.tone })} />{part.label}</div>
            <strong>{part.count}</strong>
            <small>{part.sub}</small>
          </div>
        ))}
      </div>
      <div className="rd-occupancy-split" aria-hidden="true">
        {parts.map((part) => <i key={part.label} style={{ width: `${part.widthPercent}%`, background: part.tone }} />)}
      </div>
    </>
  );
}

export interface EventCardProps {
  card: DayEventCardModel;
  /** The bookings tab shows the actions, the overview tab only the card. */
  actions?: {
    onDetail: () => void;
    /** Demo simulation only; left out on a real source. */
    simulate?: { onClub: () => void; onPublic: () => void };
  };
}

export function EventCard({ card, actions }: EventCardProps) {
  return (
    <div className="rd-event-row" style={css({ '--tone': card.tone })} data-testid="rd-event-card" data-event-id={card.id}>
      <div className="rd-event-title">
        <div><strong>{card.name}</strong><small>{card.timeRange} · {card.slotsLabel}</small></div>
        <span className="rd-event-tag">{card.tag}</span>
      </div>
      <div className="rd-event-bottom">
        <span>Potvrzeno <strong>{card.confirmed} / {card.cap}</strong></span>
        <span>{card.statusText}</span>
      </div>
      <div className="rd-progress"><i style={{ width: `${card.progressPercent}%` }} /></div>
      {actions ? (
        <div className="rd-event-actions">
          <button type="button" data-drawer-event={card.id} onClick={actions.onDetail}>Detail termínu ↗</button>
          {actions.simulate ? (
            <>
              <button type="button" data-demo-club={card.id} disabled={!card.canAddClub} onClick={actions.simulate.onClub}>+ Klub</button>
              <button type="button" className="primary" data-demo-public={card.id} disabled={!card.canAddPublic} onClick={actions.simulate.onPublic}>+ Jednotlivec</button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** One real record of the day: a booking or a club window, with its price. */
export function RecordRow({ record, onOpen }: { record: DayRecord; onOpen: (record: DayRecord) => void }) {
  const hasPrice = record.priceCzk !== null;
  return (
    <button
      type="button"
      className="rd-record"
      data-testid="rd-record"
      data-record={record.key}
      style={css({ '--tone': record.tone })}
      title={record.priceCaption ?? undefined}
      aria-label={`${record.title}, ${record.start}–${record.end}${record.subtitle ? `, ${record.subtitle}` : ''}, ${record.priceText}`}
      onClick={() => onOpen(record)}
    >
      <i className="rd-record-dot" aria-hidden="true" />
      <span className="rd-record-copy">
        <b>{record.title}</b>
        <small>{record.start}–{record.end}{record.subtitle ? ` · ${record.subtitle}` : ''}</small>
      </span>
      <span className={`rd-record-price${hasPrice ? '' : ' is-none'}`}>{record.priceText}</span>
      <span className="rd-record-open" aria-hidden="true">Otevřít →</span>
    </button>
  );
}

/** The day's records by source, each group with its heading; the day total of what has a price. */
export function RecordGroups({ groups, onOpen }: { groups: DayRecordGroup[]; onOpen: (record: DayRecord) => void }) {
  const all = groups.flatMap((g) => g.records);
  return (
    <div data-testid="rd-records">
      {groups.map((group) => (
        <section key={group.id} data-record-group={group.id}>
          <div className="rd-section-title">{group.title} <em>{group.records.length}</em></div>
          <div className="rd-record-list">
            {group.records.map((record) => <RecordRow key={record.key} record={record} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
      {all.some((r) => r.priceCzk !== null) ? (
        <div className="rd-day-total" data-testid="rd-day-total">{PRICE_LINE_TEXT.dayTotal} {formatCzk(recordsTotal(all))}</div>
      ) : null}
    </div>
  );
}
