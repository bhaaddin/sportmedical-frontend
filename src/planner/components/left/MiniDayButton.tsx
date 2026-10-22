/*
 * One day button of the mini-calendar (prototype `renderMiniCell` + `miniContent`): the colour
 * spectrum ring (one arc per činnost of the day), the liquid orb (fill = planned minutes against the
 * day budget) and the day number, all inside `.day-zoom-visual` so the zoom never moves the hit box.
 * The model (`miniCellModel`) computed the figures; this only draws them.
 */
import type { MiniCellModel, MiniCellFlags } from '../../model';
import { holdLabel } from '../board/clubHold';
import type { MiniClubMark } from './miniClubs';

export interface MiniDayButtonProps {
  model: MiniCellModel;
  flags: MiniCellFlags;
  otherMonth: boolean;
  /** The live preview of a planning drag lands on this day. */
  previewing: boolean;
  today: boolean;
  /** The day is closed (holiday, closure, absence) and in which colour its number is drawn. */
  /** R13: the clubs that hold time on this day (a hatched mark in the club's colour; the words are in the label / title). */
  clubs?: readonly MiniClubMark[];
  closed: { label: string | null; color: string; kind?: 'holiday' | 'closed'; fill?: string; ink?: string } | null;
  tabbable: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onEnter: () => void;
  onLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

const fixed = (n: number): string => n.toFixed(2);

export function MiniDayButton({
  model, flags, otherMonth, previewing, today, closed, tabbable, clubs = [],
  onClick, onEnter, onLeave, onFocus, onBlur,
}: MiniDayButtonProps) {
  const classes = ['day-cell', 'spectrum-day'];
  if (otherMonth) classes.push('other-month');
  if (model.hasTerms) classes.push('has-terms');
  if (previewing) classes.push('preview-liquid');
  if (flags.pinned) classes.push('is-pinned');
  if (flags.hoverAnchor) classes.push('is-hover-anchor');
  if (flags.focused) classes.push('is-focus-target', 'zoom-focus-target');
  if (today) classes.push('is-today');
  if (closed) classes.push('is-closed');
  const closedLabel = closed
    ? `${model.ariaLabel} · ${closed.kind === 'holiday' ? 'Svátek' : 'Zavřeno'}${closed.label ? `: ${closed.label}` : ''}`
    : model.ariaLabel;
  /* R13: "Klub FK Slaný, Čeká na hráče" in the day's name, so the mark is not colour alone */
  const clubWords = clubs.map((c) => ['Klub ' + c.club, c.orderCode, c.hold ? holdLabel(c.hold) : null].filter(Boolean).join(', '));
  const ariaLabel = clubWords.length > 0 ? `${closedLabel} · ${clubWords.join(' · ')}` : closedLabel;
  const { ring } = model;
  return (
    <button
      type="button"
      className={classes.join(' ')}
      data-date={model.date}
      data-testid={`mini-day-${model.date}`}
      title=""
      tabIndex={tabbable ? 0 : -1}
      aria-label={ariaLabel}
      aria-pressed={flags.pinned}
      aria-current={flags.current ? 'date' : undefined}
      onClick={onClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <span className="day-zoom-visual" aria-hidden="true">
        {ring ? (
          <>
            <svg className="spectrum-ring" viewBox="0 0 48 48" aria-hidden="true">
              <circle className="spectrum-track" r="21" cx="24" cy="24" />
              {ring.arcs.map((arc) => (
                <circle
                  key={arc.categoryId}
                  className="spectrum-arc"
                  r="21"
                  cx="24"
                  cy="24"
                  stroke={arc.color}
                  strokeDasharray={`${fixed(arc.dash)} ${fixed(ring.circumference)}`}
                  strokeDashoffset={fixed(arc.offset)}
                  data-category={arc.categoryId}
                />
              ))}
            </svg>
            <span className="liquid-orb">
              <span className="liquid-water" style={{ '--liquid-fill': `${ring.liquidPercent.toFixed(3)}%` } as React.CSSProperties} data-fill={ring.liquidPercent.toFixed(3)} />
              <span className="liquid-glint" />
            </span>
          </>
        ) : null}
        {clubs.length > 0 ? (
          <span className="mini-clubs" data-testid={`mini-clubs-${model.date}`} aria-hidden="true">
            {clubs.slice(0, 3).map((c) => <i key={c.key} data-hold={c.hold ?? undefined} style={{ '--club': c.colour } as React.CSSProperties} />)}
          </span>
        ) : null}
        <span
          className="day-number"
          data-lock={closed?.kind}
          style={closed ? (closed.kind === 'holiday' && closed.fill ? { color: closed.ink ?? closed.color, background: closed.fill } : { color: closed.color }) : undefined}
        >{model.dayNumber}</span>
      </span>
    </button>
  );
}
