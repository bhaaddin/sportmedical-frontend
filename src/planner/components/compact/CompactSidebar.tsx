/*
 * CompactSidebar - the file's `.sidebar` (mini calendar + agenda) in the tablet / phone layouts.
 *
 *   tablet >= 1000 px   pinned: a left column next to the board, always there
 *   tablet <  1000 px   a slide-over drawer from the left, opened by the board's calendar button
 *   phone               a bottom sheet, opened by the same button
 *
 * The panels inside are the very same `MiniCalendarPanel` / `AgendaPanel`; only the frame differs. A drawer or
 * sheet is a dialog while it is open: Esc and the backdrop close it, Tab stays inside, and the focus goes back to
 * the button that opened it. Closed, it is `inert` (not focusable, not read) but stays mounted, so the panels keep
 * their ids and state.
 */
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { usePlannerStore } from '../../state/PlannerStoreProvider';
import { Icon } from '../Icons';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface CompactSidebarProps {
  open: boolean;
  pinned: boolean;
  layout: 'tablet' | 'phone';
  onClose: () => void;
  /** The button that opened the sheet; it gets the focus back when the sheet closes. */
  openerRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function CompactSidebar({ open, pinned, layout, onClose, openerRef, children }: CompactSidebarProps) {
  const store = usePlannerStore();
  const panelRef = useRef<HTMLElement | null>(null);
  const modal = !pinned;
  const shown = pinned || open;
  const wasOpen = useRef(false);

  /* Focus: in on open, back to the opener on close. */
  useEffect(() => {
    if (!modal) {
      wasOpen.current = false;
      return;
    }
    if (open) {
      wasOpen.current = true;
      const raf = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('[data-sheet-close]')?.focus());
      return () => cancelAnimationFrame(raf);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      openerRef.current?.focus();
    }
    return undefined;
  }, [open, modal, openerRef]);

  /* Esc closes the sheet first (before the planner's own Esc ladder sees it), Tab stays inside. */
  useEffect(() => {
    if (!modal || !open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      const state = store.getState();
      if (event.key === 'Escape') {
        /* A flyout, dialog or drawer on top of the sheet is closed by the planner's own ladder, not by us. */
        if (state.dialog || state.drawer || state.summary.open || state.mini.openDate !== null || state.mini.pinnedDate !== null) return;
        event.stopPropagation();
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      /* Something is open on top of the sheet (a dialog, the drawer, the day's flyout): the focus belongs there. */
      if (state.dialog || state.drawer || state.summary.open || state.mini.openDate !== null) return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!panel.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [modal, open, onClose, store]);

  /* Picking a day on the mini calendar closes the sheet once the day's flyout (if any) is done with. */
  const dateAtOpen = useRef<string | null>(null);
  useEffect(() => {
    if (!modal || !open) {
      dateAtOpen.current = null;
      return undefined;
    }
    dateAtOpen.current = store.getState().selectedDate;
    return store.subscribe(() => {
      const s = store.getState();
      if (dateAtOpen.current !== null && s.selectedDate !== dateAtOpen.current && s.mini.openDate === null) onClose();
    });
  }, [modal, open, onClose, store]);

  return (
    <>
      {modal && open ? <button type="button" className="compact-backdrop" tabIndex={-1} aria-label="Zavřít panel kalendáře" data-testid="compact-backdrop" onClick={onClose} /> : null}
      <section
        ref={panelRef}
        className="sidebar glass-panel compact-sidebar"
        aria-label="Mini kalendář a vytvořené termíny"
        data-testid="sidebar"
        data-compact-sidebar={pinned ? 'pinned' : layout === 'phone' ? 'sheet' : 'drawer'}
        data-open={shown ? 'true' : 'false'}
        role={modal ? 'dialog' : undefined}
        aria-modal={modal ? true : undefined}
        inert={modal && !open ? true : undefined}
      >
        {modal ? (
          <div className="compact-sheet-head modal-header">
            <h2 className="modal-title">Kalendář a termíny</h2>
            <button type="button" className="modal-x" data-sheet-close="" aria-label="Zavřít" title="Zavřít" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
        ) : null}
        {children}
      </section>
    </>
  );
}
