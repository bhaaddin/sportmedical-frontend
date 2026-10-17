/*
 * `#alternate-view` - the prototype's "Den" (a list of the day) and "Měsíc" (42 tiles) which cover
 * the week board (`renderAlternative`). With the real calendar the day's bookings are among the
 * rows and the tiles count them too; closed days are named on their tile.
 */
import type { DayListModel, MonthListModel } from './boardModel';

export function DayList({
  model,
  onOpen,
  onCreate,
}: {
  model: DayListModel;
  onOpen: (row: DayListModel['rows'][number]) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <div className="alternative-head">{model.heading}</div>
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
            style={{ opacity: t.otherMonth ? 0.42 : 1 }}
            onClick={() => onPick(t.date)}
          >
            <span className="date-num">{t.dayNumber}</span>
            {t.countLabel ? <small>{t.countLabel}</small> : null}
            {t.flag ? <small className="tile-flag" style={{ color: '#e7cba9' }}>{t.flag}</small> : null}
          </button>
        ))}
      </div>
    </>
  );
}
