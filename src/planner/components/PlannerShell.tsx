/*
 * PlannerShell - the whole planner: providers, the scaled stage, the loading gate and the panels
 * in the DOM order (= stacking order) of the prototype.
 *
 *   <PlannerShell source={source} user={{ displayName }} />
 *
 * Panels and the prototype region each one owns:
 *
 *   .sidebar  (section, here)        MiniCalendarPanel  .mini-calendar          calendar of day rings
 *                                    AgendaPanel        #agenda-panel           tabs / chips / term lists
 *   WeekBoardPanel     section.planner                  toolbar + 07:00-19:00 board + drag layers
 *   ClubHeader         #club-unified-header             logo, name, identification / leadership / contact
 *   OrderCommandPanel  #order-command, #active-plan-hint, #corner-return
 *   PlanningCarousel   #planning-cards                  činnost cards + "Celková objednávka" card
 *   MiniDayTooltip     #mini-day-tooltip                flyout of a day (stage-level)
 *   ReservationDrawer  #reservation-drawer-layer
 *   DialogLayer        #dialog-layer
 *   SummaryExperience  #summary-experience-layer
 *   Toast              #toast-layer
 *   CompletionCallout  #planner-feedback
 *
 * Desktop (>= 1280 px) only for now; narrower widths get a notice. The `compact` flag of the stage
 * is where the later phone / tablet layouts will hook in.
 */
import { useDevice } from '../../layout/useDevice';
import type { PlannerDataSource } from '../data/PlannerDataSource';
import type { IsoDate } from '../model';
import { AgendaPanel } from './AgendaPanel';
import { ClubHeader, type ClubHeaderProps } from './ClubHeader';
import { CompletionCallout } from './CompletionCallout';
import { DialogLayer } from './DialogLayer';
import { MiniCalendarPanel } from './MiniCalendarPanel';
import { MiniDayTooltip } from './MiniDayTooltip';
import { OrderCommandPanel } from './OrderCommandPanel';
import { PlannerGate } from './PlannerGate';
import { PlannerProviders } from './PlannerProviders';
import { PlannerStage } from './PlannerStage';
import { PlanningCarousel } from './PlanningCarousel';
import { ReservationDrawer } from './ReservationDrawer';
import { SummaryExperience } from './SummaryExperience';
import { Toast } from './Toast';
import { WeekBoardPanel } from './WeekBoardPanel';
import { usePlannerKeyboard } from './usePlannerKeyboard';

export interface PlannerShellProps {
  source: PlannerDataSource;
  today?: IsoDate;
  /** Day the board opens on (default today). */
  initialDate?: IsoDate;
  user?: ClubHeaderProps['user'];
  /** Render the stage even below 1280 px (tests, screenshots). */
  forceDesktop?: boolean;
}

/** The panels, in prototype DOM order. Rendered inside the stage once the data is ready. */
export function PlannerLayers({ user }: { user?: ClubHeaderProps['user'] }) {
  usePlannerKeyboard();
  return (
    <>
      <div id="live-ui" aria-label="Interaktivní kalendář a termíny" data-testid="live-ui">
        <section className="sidebar glass-panel" aria-label="Mini kalendář a vytvořené termíny" data-testid="sidebar">
          <MiniCalendarPanel />
          <AgendaPanel />
          <div className="sidebar-footer" aria-hidden="true" />
        </section>
        <WeekBoardPanel />
      </div>
      <ClubHeader user={user} />
      <OrderCommandPanel />
      <PlanningCarousel />
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

export function PlannerShell({ source, today, initialDate, user, forceDesktop = false }: PlannerShellProps) {
  const device = useDevice();
  if (device !== 'desktop' && !forceDesktop) {
    return (
      <div className="sm-planner-desktop-only" role="status" data-testid="planner-desktop-only">
        Plánovač je zatím dostupný jen na počítači (od šířky okna 1280 px).
      </div>
    );
  }
  return (
    <PlannerProviders source={source} today={today} initialDate={initialDate}>
      <PlannerStage>
        <PlannerGate>
          <PlannerLayers user={user} />
        </PlannerGate>
      </PlannerStage>
    </PlannerProviders>
  );
}
