/*
 * CompactLayers - the planner's panels for the tablet (768-1279) and phone (<= 767) layouts. The panels are the
 * same components the desktop stage composes (`PlannerLayers`); only the arrangement differs, and it is mostly CSS
 * (`styles/planner.compact.css`, scoped under `.sm-planner[data-layout]`). The DOM order is the reading and tab order:
 *
 *   header           a club's screen: one row + an expander for the three data columns   (CompactHeader)
 *                    the standard calendar: the slim one-line bar (name, bell, profile), no expander (ClinicTopBar)
 *   #live-ui         the mini calendar + agenda as a pinned column, drawer or sheet (CompactSidebar)
 *                    and the board with its calendar button / day strip            (CompactBoardChrome)
 *   #planning-cards  the činnost cards as a horizontal scroll-snap strip           (PlanningCarousel, unchanged)
 *   dock             `#active-plan-hint` + the order bar + "Souhrn"                (CompactOrderDock)
 *   layers           flyout, drawer, dialogs, summary, toast, callout              (as on the stage)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AgendaPanel } from '../AgendaPanel';
import { ClubHeader, type ClubHeaderMode, type ClubHeaderProps } from '../ClubHeader';
import { CompletionCallout } from '../CompletionCallout';
import { DialogLayer } from '../DialogLayer';
import { MiniCalendarPanel } from '../MiniCalendarPanel';
import { MiniDayTooltip } from '../MiniDayTooltip';
import { PlanningCarousel } from '../PlanningCarousel';
import { ReservationDrawer } from '../ReservationDrawer';
import { SummaryExperience } from '../SummaryExperience';
import { Toast } from '../Toast';
import { WeekBoardPanel } from '../WeekBoardPanel';
import { usePlannerKeyboard } from '../usePlannerKeyboard';
import { usePlannerModelState } from '../context';
import { BoardStrip, useBoardFit } from './CompactBoardChrome';
import { CompactDeckSync } from './CompactDeckSync';
import { CompactHeader } from './CompactHeader';
import { CompactOrderDock } from './CompactOrderDock';
import { CompactSidebar } from './CompactSidebar';
import { usePinnedSidebar } from './media';
import { useTouchPlacement } from './useTouchPlacement';

export interface CompactLayersProps {
  layout: 'tablet' | 'phone';
  user?: ClubHeaderProps['user'];
  headerMode?: ClubHeaderMode;
}

export function CompactLayers({ layout, user, headerMode }: CompactLayersProps) {
  usePlannerKeyboard();
  const standard = usePlannerModelState().order?.club === false;
  const mainRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  /* The tablet pins the left column from 1000 px; below that (and on the phone) it is a drawer / sheet. */
  const pinned = usePinnedSidebar() && layout === 'tablet';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const { fit, choose } = useBoardFit(mainRef);

  /* A window that grows into the pinned column leaves no sheet open behind it. */
  useEffect(() => {
    if (pinned) setSidebarOpen(false);
  }, [pinned]);

  /* Club planning by touch: tap the start, tap the end. The standard calendar keeps the board's own long-press. */
  useTouchPlacement(mainRef, !standard);

  return (
    <>
      {headerMode === 'clinic' ? (
        <ClubHeader user={user} mode="clinic" />
      ) : (
        <CompactHeader>
          <ClubHeader user={user} mode={headerMode} />
        </CompactHeader>
      )}
      <div id="live-ui" className="compact-live" aria-label="Interaktivní kalendář a termíny" data-testid="live-ui" data-fit={fit} data-pinned={pinned ? 'true' : 'false'}>
        <CompactSidebar open={sidebarOpen} pinned={pinned} layout={layout} onClose={closeSidebar} openerRef={openerRef}>
          <MiniCalendarPanel />
          <AgendaPanel />
        </CompactSidebar>
        <div className="compact-main" ref={mainRef}>
          <WeekBoardPanel />
          <BoardStrip
            mainRef={mainRef}
            fit={fit}
            onFit={choose}
            sidebarOpen={sidebarOpen}
            sidebarPinned={pinned}
            onOpenSidebar={() => setSidebarOpen(true)}
            openerRef={openerRef}
          />
        </div>
      </div>
      <PlanningCarousel />
      <CompactDeckSync />
      <CompactOrderDock />
      <div id="status-overlay" aria-live="polite" />
      <MiniDayTooltip />
      <ReservationDrawer />
      <DialogLayer />
      <SummaryExperience />
      <Toast />
      <CompletionCallout />
    </>
  );
}
