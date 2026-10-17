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
 * Three layouts (`useDevice()`): desktop (>= 1280 px) is the stage above, exactly as the file draws it; tablet
 * (768-1279) and phone (<= 767) compose the same panels in `compact/CompactLayers` and let CSS reflow them
 * (`styles/planner.compact.css`). `forceDesktop` keeps the stage on a narrow window (tests, screenshots);
 * `layout` forces any of the three.
 */
import { useDevice } from '../../layout/useDevice';
import type { PlannerDataSource } from '../data/PlannerDataSource';
import type { IsoDate } from '../model';
import { AgendaPanel } from './AgendaPanel';
import { ClubHeader, type ClubHeaderMode, type ClubHeaderProps } from './ClubHeader';
import { PlannerAccountProvider } from './dialogs/generic/account';
import { CompletionCallout } from './CompletionCallout';
import { DialogLayer } from './DialogLayer';
import { MiniCalendarPanel } from './MiniCalendarPanel';
import { MiniDayTooltip } from './MiniDayTooltip';
import { OrderCommandPanel } from './OrderCommandPanel';
import { PlannerGate } from './PlannerGate';
import { PlannerProviders } from './PlannerProviders';
import { PlannerStage, type PlannerLayout } from './PlannerStage';
import { PlanningCarousel } from './PlanningCarousel';
import { ReservationDrawer } from './ReservationDrawer';
import { SummaryExperience } from './SummaryExperience';
import { Toast } from './Toast';
import { WeekBoardPanel } from './WeekBoardPanel';
import { CompactLayers } from './compact/CompactLayers';
import { usePlannerKeyboard } from './usePlannerKeyboard';

export interface PlannerShellProps {
  source: PlannerDataSource;
  today?: IsoDate;
  /** Day the board opens on (default today). */
  initialDate?: IsoDate;
  user?: ClubHeaderProps['user'];
  /** `club` (default): a club's order is planned. `clinic`: the standard calendar, the strip shows the clinic's own data. */
  headerMode?: ClubHeaderMode;
  /** Render the stage even below 1280 px (tests, screenshots). */
  forceDesktop?: boolean;
  /** Force a layout instead of reading the window (tests, screenshots). Wins over `forceDesktop`. */
  layout?: PlannerLayout;
}

/** The panels, in prototype DOM order. Rendered inside the stage once the data is ready. */
export function PlannerLayers({ user, headerMode }: { user?: ClubHeaderProps['user']; headerMode?: ClubHeaderMode }) {
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
      <ClubHeader user={user} mode={headerMode} />
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

export function PlannerShell({ source, today, initialDate, user, headerMode, forceDesktop = false, layout: forcedLayout }: PlannerShellProps) {
  const device = useDevice();
  const layout: PlannerLayout = forcedLayout ?? (forceDesktop ? 'desktop' : device);
  return (
    <PlannerProviders source={source} today={today} initialDate={initialDate}>
      <PlannerStage layout={layout}>
        <PlannerGate>
          <PlannerAccountProvider user={user}>
            {layout === 'desktop' ? (
              <PlannerLayers user={user} headerMode={headerMode} />
            ) : (
              <CompactLayers layout={layout} user={user} headerMode={headerMode} />
            )}
          </PlannerAccountProvider>
        </PlannerGate>
      </PlannerStage>
    </PlannerProviders>
  );
}
