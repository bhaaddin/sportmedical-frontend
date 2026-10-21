/*
 * The three live overlays of the board, drawn from the store while the desk drags (prototype `drawPreview`,
 * `drawExistingTermMove`, `drawTermExpansion`):
 *
 *   PlacementLayer   `#drag-preview` + `#drag-hud`                     dragging an armed činnost into the calendar
 *   MoveLayer        `#move-ghost` + `#move-lanes` + `#move-hud`        moving a planned term
 *   ResizeLayer      `#term-resize-range/-added/-hud`                   pulling the top / bottom edge of a term
 *
 * Positions are computed for the board's real size (`boardOverlays.ts`); the numbers in the placement HUD are
 * the order's own (`orderFigures`) - what the dropped slots add to the činnost.
 */
import type { CSSProperties } from 'react';
import { slotMinutesOf, type PlacementPreview } from '../../model';
import { usePlannerSelector } from '../../state/PlannerStoreProvider';
import { Icon } from '../Icons';
import { usePlannerCtx } from '../context';
import { moveOverlayFor, placementOverlayFor, resizeOverlayFor, type BoardSize } from './boardOverlays';
import { previewFigures, previewWindows } from './orderFigures';
import { usePlanFigures } from './usePlanFigures';

export function PlacementLayer({ board, held }: { board: BoardSize; held: PlacementPreview | null }) {
  const ctx = usePlannerCtx();
  const live = usePlannerSelector((s) => s.planning.preview);
  const { base } = usePlanFigures();
  const p = live ?? held;
  const f = p ? base.byId.get(p.categoryId) : undefined;
  if (!p || !f) {
    return (
      <>
        <div id="drag-preview" className="drag-preview" hidden />
        <div id="drag-hud" className="drag-hud" hidden aria-live="off" />
      </>
    );
  }
  const added = p.validation.ok
    ? previewFigures(ctx, base, previewWindows(ctx, 'preview', p.date, p.categoryId, p.startMinutes, p.quantity)).added
    : 0;
  const o = placementOverlayFor(ctx, p, f, added, board);
  const valid = p.validation.ok;
  /* A drop that crosses the lunch break is one frame with the break cut out of it. */
  const carve = carveOf(p, o.preview.height);
  return (
    <>
      <div
        id="drag-preview"
        className={`drag-preview${o.preview.invalid ? ' invalid' : ''}${o.preview.limitReached ? ' limit-reached' : ''}`}
        style={{ '--preview-tone': o.preview.tone, left: o.preview.left, width: o.preview.width, top: `${o.preview.top}px`, height: `${o.preview.height}px`, ...carve } as CSSProperties}
        title={o.preview.title}
        data-pick-id={held && !live ? 'ask' : undefined}
      >
        <span className="preview-content"><b>{o.preview.label}</b><small>{o.preview.timeLabel}</small></span>
      </div>
      <div
        id="drag-hud"
        className={`drag-hud${o.hud.conflict ? ' has-conflict' : ''}`}
        style={{ '--preview-tone': o.hud.tone, left: `${o.hud.left}px`, top: `${o.hud.top}px` } as CSSProperties}
        hidden={!live}
        aria-live="off"
      >
        <div className="hud-top"><span className="hud-light" /> {o.hud.heading}</div>
        <div className="hud-activity">{o.hud.activity}</div>
        <div className="hud-timeline">{o.hud.start} <span>→</span> {o.hud.end} <b>{o.hud.plus}</b></div>
        <div className="hud-track"><i style={{ width: `${o.hud.progress}%` }} /></div>
        <div className="hud-numbers"><b>{o.hud.numbersMain} <span>{o.hud.numbersOf}</span></b><span>{o.hud.progress}%</span></div>
        <p className={`hud-status${valid ? '' : ' conflict'}`}>{o.hud.status}</p>
      </div>
    </>
  );
}

export function MoveLayer({ board }: { board: BoardSize }) {
  const ctx = usePlannerCtx();
  const p = usePlannerSelector((s) => s.planning.movePreview);
  const o = p ? moveOverlayFor(ctx, p, board) : null;
  if (!p || !o) {
    return (
      <>
        <div id="move-lanes" className="move-lanes" hidden aria-hidden="true" />
        <div id="move-ghost" className="move-ghost" hidden aria-hidden="true" />
        <div id="move-hud" className="move-hud" hidden aria-live="off" />
      </>
    );
  }
  return (
    <>
      <div
        id="move-lanes"
        className={`move-lanes${o.lanes.invalid ? ' is-invalid' : ''}`}
        style={{ left: o.lanes.left, width: o.lanes.width }}
        aria-hidden="true"
      />
      <div
        id="move-ghost"
        className={`move-ghost${o.ghost.notAllowed ? ' not-allowed' : ''}`}
        style={{ '--move-tone': o.ghost.tone, left: o.ghost.left, width: o.ghost.width, top: `${o.ghost.top}px`, height: `${o.ghost.height}px` } as CSSProperties}
        aria-hidden="true"
      >
        <span className="move-ghost-head"><Icon name={o.ghost.iconKey} /><strong>{o.ghost.name}</strong></span>
        <span className="move-ghost-times">{o.ghost.timeLabel}</span>
        <span className="move-ghost-foot">{o.ghost.foot}</span>
      </div>
      <div
        id="move-hud"
        className={`move-hud${o.hud.invalid ? ' is-invalid' : ''}`}
        style={{ '--move-tone': o.hud.tone, left: `${o.hud.left}px`, top: `${o.hud.top}px` } as CSSProperties}
        aria-live="off"
      >
        <div className="move-hud-eyebrow"><i />{o.hud.heading}</div>
        <div className="move-hud-name">{o.hud.name}</div>
        <div className="move-hud-route"><span>{o.hud.from}</span><b>↓</b><strong>{o.hud.to}</strong></div>
        <div className="move-hud-rule"><Icon name="calendar" /> <b>{o.hud.rule.slots}</b><span>{o.hud.rule.text}</span></div>
        <div className={`move-hud-message${o.hud.conflict ? ' is-conflict' : ''}`}>{o.hud.message}</div>
      </div>
    </>
  );
}

export function ResizeLayer({ board }: { board: BoardSize }) {
  const ctx = usePlannerCtx();
  const p = usePlannerSelector((s) => s.planning.resizePreview);
  const o = p ? resizeOverlayFor(ctx, p, board) : null;
  if (!p || !o) {
    return (
      <>
        <div id="term-resize-range" hidden aria-hidden="true" />
        <div id="term-resize-added" hidden aria-hidden="true" />
        <div id="term-resize-hud" hidden aria-live="polite" />
      </>
    );
  }
  const common = { '--resize-tone': o.tone, left: o.left, width: o.width } as CSSProperties;
  return (
    <>
      <div id="term-resize-range" className={o.invalid ? 'is-invalid' : undefined} style={{ ...common, top: `${o.range.top}px`, height: `${o.range.height}px` }} aria-hidden="true" />
      <div id="term-resize-added" className={o.invalid ? 'is-invalid' : undefined} style={{ ...common, top: `${o.added.top}px`, height: `${o.added.height}px` }} aria-hidden="true">
        <strong>{o.added.label}</strong><small>{o.added.times}</small>
      </div>
      <div
        id="term-resize-hud"
        className={o.invalid ? 'is-invalid' : undefined}
        style={{ '--resize-tone': o.tone, left: `${o.hud.left}px`, top: `${o.hud.top}px` } as CSSProperties}
        aria-live="polite"
      >
        <div className="resize-hud-eyebrow">{o.hud.eyebrow}</div>
        <div className="resize-hud-name">{o.hud.name}</div>
        <div className="resize-hud-times">{o.hud.times}</div>
        <div className="resize-hud-delta"><strong>{o.hud.delta}</strong><span>{o.hud.fromTo}</span></div>
        <div className="resize-hud-note">{o.hud.note}</div>
      </div>
    </>
  );
}

/** The lunch break inside a placement that crosses it, as a mask over the frame (nothing: the frame is whole). */
export function carveOf(p: Pick<PlacementPreview, 'parts' | 'startMinutes' | 'endMinutes'>, heightPx: number): CSSProperties {
  const parts = p.parts;
  if (!parts || parts.length < 2) return {};
  const span = p.endMinutes - p.startMinutes;
  if (!(span > 0)) return {};
  const stops: string[] = [];
  let at = 0;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const from = ((parts[i]!.end - p.startMinutes) / span) * heightPx;
    const to = ((parts[i + 1]!.start - p.startMinutes) / span) * heightPx;
    stops.push(`#000 ${at}px`, `#000 ${from}px`, `transparent ${from}px`, `transparent ${to}px`);
    at = to;
  }
  stops.push(`#000 ${at}px`, '#000 100%');
  const mask = `linear-gradient(to bottom, ${stops.join(', ')})`;
  return { maskImage: mask, WebkitMaskImage: mask } as CSSProperties;
}
