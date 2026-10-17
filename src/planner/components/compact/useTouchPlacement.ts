/*
 * Club planning on a touch screen: tap the start, tap the end (the old calendar's `touchPick` / `tapAnchor` model).
 *
 * The desk's gesture - press, drag, release - is `plan/useBoardGestures.ts`, written for a mouse. A finger cannot
 * hold a drag on a board that also has to scroll, so on touch the same gesture is split in two taps:
 *
 *     first tap    "press" at the tapped place        -> the placement begins, the preview shows that slot
 *     second tap   "move" to the tapped place, "release" -> the placement is dropped exactly like a mouse drop
 *
 * Both are handed to the existing gesture code as mouse-typed pointer events on the board, so there is ONE place
 * that decides what a placement means (validation, the činnosti bubble, the shortfall rules, the write): this hook
 * only turns taps into those events. Touch events on the board are swallowed while a činnost is armed - except on
 * a planned term (its own move / edge pull) - so a stray finger never starts a half gesture or ends the anchor.
 * Moving the finger more than a tap's slack is a scroll and does nothing.
 *
 * The anchor is dropped when the činnost is disarmed (card tapped again, Esc), when the placement ends elsewhere,
 * or when the layout is left.
 */
import { useEffect, type RefObject } from 'react';
import { minutesAsTime } from '../../model';
import { usePlannerActions, usePlannerStore } from '../../state/PlannerStoreProvider';

const TAP_SLACK_PX = 10;
/** A pointer id no real device uses, so the synthetic gesture never collides with a finger. */
const SYNTHETIC_ID = 91001;

type Phase = 'pointerdown' | 'pointermove' | 'pointerup';

function fire(board: HTMLElement, type: Phase, x: number, y: number) {
  board.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: SYNTHETIC_ID,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: x,
      clientY: y,
    }),
  );
}

export function useTouchPlacement(mainRef: RefObject<HTMLElement | null>, enabled: boolean): void {
  const store = usePlannerStore();
  const act = usePlannerActions();

  useEffect(() => {
    if (!enabled) return undefined;
    const board = mainRef.current?.querySelector<HTMLElement>('#day-board') ?? null;
    if (!board) return undefined;
    let anchor = false;
    let press: { id: number; x: number; y: number; moved: boolean } | null = null;

    const planningState = () => store.getState().planning;
    const touchy = (e: PointerEvent) => e.pointerType !== 'mouse';
    /* A planned term carries its own gestures (move, edge pull); everything else on the board is a tap target. */
    const onTerm = (e: Event) => e.target instanceof Element && e.target.closest('.schedule-event') !== null;
    const swallow = (e: PointerEvent) => {
      if (!touchy(e) || planningState().selectedCategoryId === null || onTerm(e)) return false;
      e.stopImmediatePropagation();
      return true;
    };

    const onDown = (e: PointerEvent) => {
      if (!swallow(e)) return;
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!swallow(e)) return;
      if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > TAP_SLACK_PX) press.moved = true;
    };
    const onCancel = (e: PointerEvent) => {
      if (!swallow(e)) return;
      if (press && e.pointerId === press.id) press = null; // the browser took the finger for a scroll
    };
    const onUp = (e: PointerEvent) => {
      if (!swallow(e)) return;
      const mine = press && e.pointerId === press.id ? press : null;
      press = null;
      if (!mine || mine.moved) return;
      const { clientX: x, clientY: y } = e;
      if (!anchor) {
        fire(board, 'pointerdown', x, y);
        const p = planningState();
        if (p.drag === null) return; // refused (nothing to plan there): the gesture code said why with a toast
        anchor = true;
        const start = p.preview?.startMinutes;
        act.toast(start === undefined ? 'Začátek je označen — klepněte na konec.' : `Začátek ${minutesAsTime(start)} — klepněte na konec.`);
        return;
      }
      anchor = false;
      fire(board, 'pointermove', x, y);
      fire(board, 'pointerup', x, y);
    };

    board.addEventListener('pointerdown', onDown, true);
    board.addEventListener('pointermove', onMove, true);
    board.addEventListener('pointerup', onUp, true);
    board.addEventListener('pointercancel', onCancel, true);

    /* Anchor housekeeping: it only lives while the placement does. */
    const unsubscribe = store.subscribe(() => {
      if (!anchor) return;
      const p = store.getState().planning;
      if (p.selectedCategoryId === null || p.drag === null) {
        anchor = false;
        if (p.drag !== null) act.endPlacement();
      }
    });
    return () => {
      board.removeEventListener('pointerdown', onDown, true);
      board.removeEventListener('pointermove', onMove, true);
      board.removeEventListener('pointerup', onUp, true);
      board.removeEventListener('pointercancel', onCancel, true);
      unsubscribe();
      if (anchor && store.getState().planning.drag !== null) act.endPlacement();
    };
  }, [enabled, mainRef, store, act]);
}
