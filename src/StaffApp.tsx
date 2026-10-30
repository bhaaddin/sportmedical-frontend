/*
 * StaffApp - the signed-in staff portal: the shell (sidebar / rail / bottom bar), the menu and every staff
 * screen. It is a CHUNK of its own, loaded by App.tsx only after the sign-in guard has let the address through,
 * so the sign-in page and the patients' pages (/objednat, /portal, /klub ...) never download the shell, the
 * booking drawer behind "Nová objednávka" or the staff screens' routing table.
 *
 * Moved out of App.tsx as it was: the route table (`<Route path=...>`), the menu and the `Layout` read the same.
 * Tests that read the route table as text (catalogue.routes.test, catalogue.test, patientRoutes.test,
 * fit.rules.test) read this file together with App.tsx.
 */
import { Navigate, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { Dashboard, People, Settings, CalendarMonth, Receipt, ReceiptLong, AttachMoney, Today, ArrowBack, Assessment, Groups, EventBusy, RateReview, FactCheck, PersonAdd, ListAlt, EventNote, SportsSoccer, Insights, Event } from '@mui/icons-material';
import { usePermissions, type Permission } from './auth/usePermission';
import { useAccountRefresh } from './auth/accountRefresh';
import { patientInPath } from './pages/patients/sections';
import { settingsItemAt } from './pages/settings/catalogue';
import { useState, useMemo, lazy, Suspense, useRef, useEffect } from 'react';
import { SettingsSearchContext } from './components/shell/settingsSearch';
import { SidebarSlotProvider } from './components/shell/SidebarSlot';
import { IconRail } from './components/shell/IconRail';
import { PhoneBottomBar, PhoneTopBar, PHONE_BOTTOM_BAR, PHONE_TOP_BAR } from './components/shell/PhoneShell';
import { AccountMenu } from './components/shell/AccountMenu';
import { WhereAmI, computeCrumbs, useDocumentTitle } from './components/shell/whereAmI';
import { PageLoader } from './components/shell/PageLoader';
import { RAIL_WIDTH, SIDEBAR_WIDTH } from './components/shell/shellStyles';
import { isPlannerRoute } from './components/shell/plannerRoutes';
import type { MenuEntry, ShellNav } from './components/shell/shellTypes';
import { SECTION_CHILDREN, type ContextualParent } from './components/shell/shellModel';
import { useDevice } from './layout/useDevice';
import { afterFirstPaint } from './utils/afterFirstPaint';
import UniversalSearch from './components/UniversalSearch';
import { warmMotion } from './motion/engine';
import { usePageArrival } from './motion/PageTransition';

/* ── Lazy-loaded routes (code-split per page) ── */
const NotFound = lazy(() => import('./pages/NotFound'));
/* DEV only: the pop-out gallery the contrast audit reads (scripts/stage3b); the condition is a build-time constant, so a production bundle has neither the route nor the module. */
const PopoutGallery = import.meta.env.DEV ? lazy(() => import('./dev/PopoutGallery')) : null;
const PlannerLabPage = lazy(() => import('./planner/PlannerLabPage'));
const PlannerPage = lazy(() => import('./planner/PlannerPage'));
const ClubPlannerPage = lazy(() => import('./planner/ClubPlannerPage'));
const ClubOverviewPage = lazy(() => import('./pages/clubs/overview/ClubOverviewPage'));
const FeedbackReviewPage = lazy(() => import('./pages/FeedbackReviewPage'));
const IntakeReviewQueue = lazy(() => import('./pages/IntakeReviewQueue'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const DiagnosticForm = lazy(() => import('./pages/DiagnosticForm'));
const PatientList = lazy(() => import('./pages/PatientList'));
const PatientDetails = lazy(() => import('./pages/PatientDetails'));
const PatientLayout = lazy(() => import('./pages/patients/PatientLayout'));
const PatientDocumentsPage = lazy(() => import('./pages/patients/PatientDocumentsPage'));
const PatientAppointmentsPage = lazy(() => import('./pages/patients/PatientAppointmentsPage'));
const PatientHistoryPage = lazy(() => import('./pages/patients/PatientHistoryPage'));
const PatientResultsPage = lazy(() => import('./pages/patients/PatientResultsPage'));
const PatientInvoicesPage = lazy(() => import('./pages/patients/PatientInvoicesPage'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const BillingPage = lazy(() => import('./pages/Billing'));
const AdminPage = lazy(() => import('./pages/Admin'));
const CenikPage = lazy(() => import('./pages/Cenik'));
const PatientFormPage = lazy(() => import('./pages/PatientForm'));
const PatientRegistrationPage = lazy(() => import('./pages/PatientRegistration'));
const AvailabilityPage = lazy(() => import('./pages/Availability'));
const SystemHealthPage = lazy(() => import('./pages/SystemHealth'));
const SecurityCenterPage = lazy(() => import('./pages/settings/SecurityCenterPage'));
const StaffManagementPage = lazy(() => import('./pages/StaffManagement'));
const AuditLogPage = lazy(() => import('./pages/AuditLog'));
/* Booking phase 1, stage 1: calendars, access and activities */
const BookingCalendarsPage = lazy(() => import('./pages/booking/CalendarsPage'));
const ClinicServicesPage = lazy(() => import('./pages/booking/ClinicServicesPage'));
const DocumentRequirementsPage = lazy(() => import('./pages/settings/DocumentRequirementsPage'));
const DocumentTemplatesPage = lazy(() => import('./pages/settings/DocumentTemplatesPage'));
const MessagesPage = lazy(() => import('./pages/settings/messages/MessagesPage'));
const OutboxPage = lazy(() => import('./pages/settings/outbox/OutboxPage'));
const TwoFactorPage = lazy(() => import('./pages/settings/TwoFactorPage'));
const HolidaysPage = lazy(() => import('./pages/settings/HolidaysPage'));
const QuestionnairePage = lazy(() => import('./pages/settings/QuestionnairePage'));
const CalendarDisplayPage = lazy(() => import('./pages/settings/CalendarDisplayPage'));
const PatientFieldsPage = lazy(() => import('./pages/settings/PatientFieldsPage'));
const GroupDiscountsPage = lazy(() => import('./pages/settings/GroupDiscountsPage'));
const IntegrationsPage = lazy(() => import('./pages/settings/IntegrationsPage'));
const ChangeHistoryPage = lazy(() => import('./pages/settings/ChangeHistoryPage'));
const DiscountsPage = lazy(() => import('./pages/settings/DiscountsPage'));
const ServiceColorsPage = lazy(() => import('./pages/settings/ServiceColorsPage'));
const QuickRegistrationSettingsPage = lazy(() => import('./pages/settings/QuickRegistrationSettingsPage'));
const IntakeLinkSettingsPage = lazy(() => import('./pages/settings/IntakeLinkSettingsPage'));
const CompanyInvoiceSettingsPage = lazy(() => import('./pages/settings/CompanyInvoiceSettingsPage'));
const SiteContentAdminPage = lazy(() => import('./pages/settings/SiteContentAdminPage'));
const MediaStorageSettingsPage = lazy(() => import('./pages/settings/MediaStorageSettingsPage'));
const ClubSettingsPage = lazy(() => import('./pages/settings/ClubSettingsPage'));
const ConsentSettingsPage = lazy(() => import('./pages/settings/ConsentSettingsPage'));
const BookingActivitiesPage = lazy(() => import('./pages/booking/ActivitiesPage'));
/* Booking phase 1, stage 2: working hours, periods, cycle and exceptions */
const BookingWorkingHoursPage = lazy(() => import('./pages/booking/WorkingHoursPage'));
const BookingExceptionsPage = lazy(() => import('./pages/booking/ExceptionsPage'));
/* Booking phase 1, stage 4: the appointment detail and the day at a glance */
const BookingDayOverviewPage = lazy(() => import('./pages/booking/DayOverviewPage'));
/* The owner's "přehled podle služeb": bookings, when, who, free capacity - per činnost, by filters */
const BookingServiceOverviewPage = lazy(() => import('./pages/booking/ServiceOverviewPage'));
/* Booking phase 1, stage 5: partner reservations */
const BookingPartnerOrdersPage = lazy(() => import('./pages/booking/PartnerOrdersPage'));
const BookingBlockedTimePage = lazy(() => import('./pages/booking/BlockedTimePage'));
const EmployeeAbsencesPage = lazy(() => import('./pages/booking/EmployeeAbsencesPage'));
const AppointmentLinkPage = lazy(() => import('./pages/booking/AppointmentLinkPage'));
const CashierPage = lazy(() => import('./pages/CashierPage'));
const ClubsPage = lazy(() => import('./pages/ClubsPage'));
const ClubOrdersPage = lazy(() => import('./pages/clubs/orders/ClubOrdersPage'));
const ClubOrderHistoryPage = lazy(() => import('./pages/clubs/orders/ClubOrderHistoryPage'));
const ClubOrdersHistoryPage = lazy(() => import('./pages/clubs/orders/ClubOrdersHistoryPage'));
const ClubPlayersPage = lazy(() => import('./pages/clubs/ClubPlayersPage'));
const ClubStatsPage = lazy(() => import('./pages/clubs/ClubStatsPage'));
const ClubBillingPage = lazy(() => import('./pages/clubs/ClubBillingPage'));
const AccountingExportPage = lazy(() => import('./pages/AccountingExportPage'));

/** Screens of the removed "Výsledky" rail section (Matko, 4. 10. 2026): bookmarks go to the overview. */
const RETIRED_PATHS = ['/injuries', '/rtp', '/concussion', '/training-load', '/wellness', '/statistiky'];

/* ── The navigation's menu (the type lives in components/shell/shellTypes) ── */

/*
 * What sits under each of the six main entries.
 *
 * Matko, 3. 10. 2026: "the Další section in the left sidebar is bad — put
 * things where they belong." So there is no "Další" any more: every screen
 * of the working day is a child of the entry it belongs to, and the rail
 * shows a parent's children when that parent (or one of them) is open, or
 * when its chevron is clicked.
 *
 * Kept as a map keyed by the parent's path rather than nested in the list
 * below, so the parents stay the one-line literals two tests read from this
 * file's text (`catalogue.test.ts`, `patientRoutes.test.ts`).
 */
const CHILD_ICONS: Record<string, React.ReactNode> = {
  'Kalendář': <CalendarMonth />, 'Dnešní přehled': <Today />, 'Přehled podle služeb': <Assessment />, 'Dostupnost': <EventBusy />,
  'Klubová objednávka': <Groups />, 'Přehled pacientů': <People />, 'Nový pacient': <PersonAdd />,
  'Kontrola registrací': <RateReview />, 'Přehled klubů': <Groups />, 'Objednávky klubů': <ListAlt />,
  'Rezervace': <Event />, 'Hráči': <SportsSoccer />, 'Statistiky': <Insights />, 'Fakturace': <Receipt />,
  'Faktury': <ReceiptLong />, 'Pokladna': <AttachMoney />, 'Účetní export': <FactCheck />,
};
const withIcons = (parent: ContextualParent): MenuEntry[] =>
  SECTION_CHILDREN[parent].map((c) => ({ ...c, icon: CHILD_ICONS[c.text] ?? <EventNote /> }));

const MENU_CHILDREN: Record<string, MenuEntry[]> = {
  /*
   * Kalendář, Pacienti and Kluby a týmy are CONTEXTUAL (Matko, 4. 10. 2026):
   * their children are the model in components/shell/shellModel.ts
   * (SECTION_CHILDREN, with the permission each needs) plus an icon here.
   * The no-`requires` note that used to sit on "Přehled podle služeb" lives
   * there: everything behind it carries [Authorize] and per-calendar
   * visibility only, and the server narrows it (6.5).
   */
  '/planovani': withIcons('/planovani'),
  '/patients': withIcons('/patients'),
  '/clubs': withIcons('/clubs'),
  '/billing': withIcons('/billing'),
};

/*
 * The screens of the working day (3. 10. 2026): the calendar, the people, the
 * clubs, the money, the settings - with Přehled, small, above them, because
 * the brand also lands there and a home needs a name. The "Výsledky" section
 * was removed on 4. 10. 2026. Choosing a section replaces the whole sidebar
 * with that section's own items (components/shell/shellModel.ts, sectionOf).
 *
 * Everything anybody sets up once - calendars, activities, working hours,
 * exceptions, the team, the public site, the audit log - lives behind
 * Nastavení, grouped the way the API already groups it.
 * `settingsDoesNotDuplicateTheSidebar` in catalogue.test.ts holds the line.
 */
const menuItems: MenuEntry[] = ([
  { text: 'Přehled', icon: <Dashboard />, path: '/prehled' },
  { text: 'Kalendář', icon: <CalendarMonth />, path: '/planovani' },
  { text: 'Pacienti', icon: <People />, path: '/patients', requires: 'patients.view' },
  { text: 'Kluby a týmy', icon: <Groups />, path: '/clubs' },
  { text: 'Fakturace', icon: <Receipt />, path: '/billing', requires: 'billing.manage' },
  { text: 'Nastavení', icon: <Settings />, path: '/settings' },
] as MenuEntry[]).map((entry) => ({ ...entry, children: MENU_CHILDREN[entry.path] }));

/*
 * Settings destinations that do NOT draw the board's settings frame themselves
 * (SettingsScreen: breadcrumb + header), so the shell gives them the one-line
 * "Nastavení / Skupina" way back. Every other settings screen - and every new
 * /nastaveni/ screen - draws its own breadcrumb and header. Take a path out of
 * this list the moment its page wears SettingsScreen.
 */
const SETTINGS_UNFRAMED = new Set<string>(['/blokovany-cas', '/nastaveni/cenik', '/vyhrazeni']);

/*
 * A screen the signed-in employee has no permission for is not there for them.
 *
 * The permission is the one the controller behind the screen checks, read from
 * the effective list the server sent at sign-in - the role's defaults with that
 * person's own grants and revocations applied. It hides; the server refuses.
 */
const MESSAGES_PERMISSIONS = ['communication.manage', 'settings.clinic.manage'] as const;

function RequirePermission({ of, children }: { of: Permission | readonly Permission[]; children: React.ReactNode }) {
  const held = usePermissions();
  const anyOf: readonly Permission[] = typeof of === 'string' ? [of] : of;
  if (!anyOf.some((p) => held.includes(p))) {
    return <NotFound />;
  }
  return <>{children}</>;
}

/** The main area's side padding per device; also the region's negative margin so its scroll bar hugs the window edge. */
const FIT_PAD_X = { desktop: 28, tablet: 24, phone: 16 } as const;

/** Is this address inside the settings - a catalogue destination, /settings itself, or a /nastaveni/ screen? */
function isSettingsRoute(pathname: string, settingsHere: ReturnType<typeof settingsItemAt>): boolean {
  return (
    settingsHere !== null ||
    pathname === '/settings' ||
    pathname.startsWith('/settings/') ||
    pathname === '/nastaveni' ||
    pathname.startsWith('/nastaveni/')
  );
}

/** The signed-in person, as stored at sign-in. Read once per shell, not once per render. */
function readUser(): { firstName?: string; lastName?: string; role?: string } {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
}

/*
 * The shell: one of three navigations, chosen by width, never two at once.
 *
 *   ≥768   a slim 56px ICON rail (R19) and, in the where-am-I row, the action bar   (components/shell/IconRail, ActionBar);
 *          "Všechny stránky" opens the full list as a drawer                         (components/shell/Sidebar: NavDrawer)
 *   ≤767   a bottom bar, a top bar and a "Více" sheet                                (components/shell/PhoneShell)
 *
 * On a settings route the rail stays (Nastavení lit) and the settings' own group list stands beside it on desktop.
 */
export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const device = useDevice();
  /* Reloaded from GET /api/v1/account on start, on focus and after any 403,
     so a permission the owner changed redraws this menu without a new sign-in. */
  useAccountRefresh();
  /* "Nová objednávka" opens a chooser and then the booking drawer; the drawer's script is fetched in idle time after the
     first paint (not with the shell), so the first click still finds it ready. */
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return undefined;
    let live = true;
    void afterFirstPaint(6_000).then(() => { if (live) void import('./components/booking/NewAppointmentDialog').catch(() => undefined); });
    return () => { live = false; };
  }, []);
  const held = new Set(usePermissions());
  /*
   * Inside a patient the sidebar becomes that patient's: under "Pacienti" the
   * file's sections, indented. Without patients.view the address is NotFound,
   * and sections around it would be NotFound too.
   */
  const patientId = held.has('patients.view') ? patientInPath(location.pathname) : null;
  const settingsHere = settingsItemAt(location.pathname);
  const settingsMode = isSettingsRoute(location.pathname, settingsHere);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [settingsQuery, setSettingsQuery] = useState('');
  /* Where "Zpět do aplikace" goes: the last screen that was not a settings one (the staff overview when there was none). */
  const lastAppRoute = useRef('/prehled');
  const user = useMemo(readUser, []);

  if (!settingsMode) lastAppRoute.current = `${location.pathname}${location.search}`;
  useEffect(() => {
    if (!settingsMode) setSettingsQuery('');
  }, [settingsMode]);

  const visibleMenu = useMemo(() => {
    const allowed = (entry: MenuEntry) => entry.requires === undefined || held.has(entry.requires);
    return menuItems
      .filter(allowed)
      .map((entry) => ({ ...entry, children: entry.children?.filter(allowed) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [[...held].sort().join(' ')]);

  /*
   * The big button. It always lands on the calendar; the calendar reads
   * `state.newAppointment` and opens the booking drawer on the next free time,
   * so the desk never has to find a slot first.
   */
  const newAppointment = () => navigate('/planovani', { state: { newAppointment: Date.now() } });

  const settingsSearch = useMemo(
    () => ({ query: settingsQuery, setQuery: setSettingsQuery, inRail: device === 'desktop' }),
    [settingsQuery, device],
  );

  const nav: ShellNav = {
    pathname: location.pathname,
    menu: visibleMenu,
    patientId,
    canSeeInvoices: held.has('billing.manage'),
    settingsMode,
    settingsQuery,
    onSettingsQueryChange: setSettingsQuery,
    backToAppPath: lastAppRoute.current,
    user,
    onNewAppointment: newAppointment,
    onOpenAccountMenu: setAnchorEl,
  };

  const crumbs = computeCrumbs({ pathname: location.pathname, patientId, settingsHere, menu: menuItems });
  useDocumentTitle(crumbs);

  const fit = !isPlannerRoute(location.pathname);
  const regionRef = useRef<HTMLDivElement | null>(null);
  /* A new screen starts at its top. */
  useEffect(() => { regionRef.current?.scrollTo?.({ top: 0 }); }, [location.pathname]);
  /* ... and arrives with a 6 px nudge in at most 180 ms (src/motion/PageTransition.tsx): the screen is already rendered, nothing waits
     for this, and the planner's stage (not a `fit` screen) is never animated. */
  usePageArrival(regionRef, fit ? location.pathname : '__planner');
  /* The animation library is fetched once the shell has painted, so the first dialog or list already finds it. */
  useEffect(() => warmMotion(), []);

  const settingsNeedsFrame = settingsHere !== null && SETTINGS_UNFRAMED.has(settingsHere.item.to);

  /* The area's offset is a pixel STRING: sx `ml` with a number is spacing × 8. */
  const marginLeft = device === 'phone' ? '0px' : `${RAIL_WIDTH + (settingsMode && device === 'desktop' ? SIDEBAR_WIDTH : 0)}px`;

  return (
    <SettingsSearchContext.Provider value={settingsSearch}>
      <SidebarSlotProvider available={false}>
        <Box sx={fit ? { height: '100dvh', overflow: 'hidden' } : { minHeight: '100vh' }}>
          <a href="#main-content" className="skip-link">
            Přeskočit na hlavní obsah
          </a>

          {device !== 'phone' && <IconRail nav={nav} />}
          {device === 'phone' && (
            <>
              <PhoneTopBar nav={nav} crumbs={settingsMode ? [{ label: 'Nastavení' }] : crumbs} />
              <PhoneBottomBar nav={nav} />
            </>
          )}
          <AccountMenu anchorEl={anchorEl} onClose={() => setAnchorEl(null)} onOpenSettings={() => navigate('/settings')} />

          <Box
            component="main"
            id="main-content"
            role="main"
            aria-label="Hlavní obsah"
            data-device={device}
            sx={{
              minWidth: 0,
              boxSizing: 'border-box',
              /* One margin per device and no transition: nothing moves while a page loads. */
              ml: marginLeft,
              /*
               * The screen is exactly the window (100dvh): the line of place stays on top, the page sits in
               * the region below it, and only that region may scroll - never the document. A page lays its
               * panels out to fit it (components/ui/fit.tsx) and scrolls its own lists; one that has not
               * been arranged yet scrolls as a whole inside the region. The planner's stage keeps its sizing.
               */
              ...(fit ? { height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } : { minHeight: '100vh' }),
              ...(device === 'desktop'
                ? { px: `${FIT_PAD_X.desktop}px`, pt: '20px', pb: fit ? 0 : '40px' }
                : device === 'tablet'
                  ? { px: `${FIT_PAD_X.tablet}px`, pt: 2.5, pb: fit ? 0 : 4 }
                  : { px: `${FIT_PAD_X.phone}px`, pt: `calc(${PHONE_TOP_BAR} + ${fit ? 12 : 16}px)`, pb: fit ? PHONE_BOTTOM_BAR : `calc(${PHONE_BOTTOM_BAR} + 24px)` }),
            }}
          >
            {/* The line of place; on a phone it lives in the top bar, in settings the screens draw their own. */}
            {device !== 'phone' && !settingsMode && <WhereAmI crumbs={crumbs} />}

            {/*
              * A settings destination that does not wear the board's frame
              * (SettingsScreen) yet still gets this one line - the crumb and the
              * way back - so no screen is ever a dead end.
              */}
            {settingsNeedsFrame && settingsHere !== null && (
              <Box sx={{ mb: 2 }}>
                <Button
                  component={Link as any}
                  to="/settings"
                  startIcon={<ArrowBack />}
                  size="small"
                  sx={{ color: 'text.secondary', textTransform: 'none', minHeight: 44 }}
                >
                  Nastavení
                  <Box component="span" sx={{ mx: 0.75, color: 'text.secondary' }}>/</Box>
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    {settingsHere.section.label}
                  </Box>
                </Button>
              </Box>
            )}

            {/*
              * Routes render at once and a nested layout stays mounted across its children; the region only
              * replays a short arrival (usePageArrival above).
              */}
            {fit ? (
              <Box
                ref={regionRef}
                id="fit-region"
                data-fit-region=""
                sx={{
                  /* Positioned, so a visually-hidden or absolutely placed child is held (and scrolled) by the region, never the document. */
                  position: 'relative',
                  flex: '1 1 0',
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  overscrollBehavior: 'contain',
                  /* The scroll bar sits on the window's edge, not inside the padding. */
                  mx: `-${FIT_PAD_X[device]}px`,
                  px: `${FIT_PAD_X[device]}px`,
                  pb: device === 'desktop' ? '24px' : 3,
                  /* The region ends where the bottom bar begins, so a pinned bar sticks to the region's foot. */
                  '--bottom-bar-height': '0px',
                }}
              >
                {children}
              </Box>
            ) : children}
          </Box>
        </Box>
      </SidebarSlotProvider>
    </SettingsSearchContext.Provider>
  );
}

/** The staff screens inside the shell. App.tsx reaches it through `lazy` (see the header of this file). */
export default function StaffApp() {
  return (
    <>
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {PopoutGallery ? <Route path="/audit/popouts" element={<PopoutGallery />} /> : null}
          <Route path="/prehled" element={<DashboardPage />} />
          <Route path="/planner-lab" element={<PlannerLabPage />} />
          <Route path="/patients" element={<RequirePermission of="patients.view"><PatientList /></RequirePermission>} />
          <Route path="/patients/register" element={<RequirePermission of="patients.register"><PatientRegistrationPage /></RequirePermission>} />
          <Route path="/patients/:id/edit" element={<RequirePermission of="patients.edit"><PatientFormPage /></RequirePermission>} />
          {/* One patient, with sections that are pages of their own -
              each carries the patient id, so every one of them can be
              linked to, bookmarked and reopened. */}
          <Route path="/patients/:id" element={<RequirePermission of="patients.view"><PatientLayout /></RequirePermission>}>
            <Route index element={<PatientDetails />} />
            <Route path="dokumenty" element={<PatientDocumentsPage />} />
            <Route path="terminy" element={<PatientAppointmentsPage />} />
            <Route path="historie" element={<PatientHistoryPage />} />
            <Route path="vysledky" element={<PatientResultsPage />} />
            <Route path="faktury" element={<RequirePermission of="billing.manage"><PatientInvoicesPage /></RequirePermission>} />
          </Route>
          {/* Opened from the patient's card (Výsledky tab, Přehled); not a rail section any more. */}
          <Route path="/diagnostics/new" element={<DiagnosticForm />} />
          {/* The retired Výsledky section: its screens are gone, old links land on the overview. */}
          {RETIRED_PATHS.map((path) => <Route key={path} path={path} element={<Navigate to="/prehled" replace />} />)}
          <Route path="/billing" element={<RequirePermission of="billing.manage"><BillingPage /></RequirePermission>} />
          {/* The staff price list. /cenik is the PUBLIC price list now (the other bundle). */}
          <Route path="/nastaveni/cenik" element={<CenikPage />} />
          <Route path="/availability" element={<AvailabilityPage />} />
          <Route path="/svatky" element={<RequirePermission of="settings.clinic.manage"><HolidaysPage /></RequirePermission>} />
          <Route path="/dotaznik-nastaveni" element={<RequirePermission of="questionnaires.manage"><QuestionnairePage /></RequirePermission>} />
          <Route path="/nastaveni/vzhled-kalendare" element={<RequirePermission of="settings.clinic.manage"><CalendarDisplayPage /></RequirePermission>} />
          <Route path="/nastaveni/udaje-pacienta" element={<RequirePermission of="settings.clinic.manage"><PatientFieldsPage /></RequirePermission>} />
          <Route path="/nastaveni/slevy" element={<RequirePermission of="settings.clinic.manage"><DiscountsPage /></RequirePermission>} />
          <Route path="/nastaveni/barvy-sluzeb" element={<RequirePermission of="settings.clinic.manage"><ServiceColorsPage /></RequirePermission>} />
          <Route path="/nastaveni/rychla-registrace" element={<RequirePermission of="settings.clinic.manage"><QuickRegistrationSettingsPage /></RequirePermission>} />
          <Route path="/nastaveni/odkaz-registrace" element={<RequirePermission of="settings.clinic.manage"><IntakeLinkSettingsPage /></RequirePermission>} />
          <Route path="/nastaveni/firma-a-faktury" element={<RequirePermission of="settings.clinic.manage"><CompanyInvoiceSettingsPage /></RequirePermission>} />
          <Route path="/nastaveni/media-a-texty" element={<RequirePermission of="settings.clinic.manage"><SiteContentAdminPage /></RequirePermission>} />
          <Route path="/nastaveni/uloziste-medii" element={<RequirePermission of="settings.clinic.manage"><MediaStorageSettingsPage /></RequirePermission>} />
          <Route path="/nastaveni/kluby" element={<RequirePermission of="settings.clinic.manage"><ClubSettingsPage /></RequirePermission>} />
          <Route path="/nastaveni/integrace" element={<RequirePermission of="settings.clinic.manage"><IntegrationsPage /></RequirePermission>} />
          <Route path="/nastaveni/historie-zmen" element={<RequirePermission of="settings.clinic.manage"><ChangeHistoryPage /></RequirePermission>} />
          <Route path="/nastaveni/skupinove-slevy" element={<RequirePermission of="settings.clinic.manage"><GroupDiscountsPage /></RequirePermission>} />
          <Route path="/hodnoceni-pacientu" element={<FeedbackReviewPage />} />
          <Route path="/nastaveni/souhlasy" element={<RequirePermission of="settings.clinic.manage"><ConsentSettingsPage /></RequirePermission>} />
          <Route path="/cashier" element={<RequirePermission of="billing.manage"><CashierPage /></RequirePermission>} />
          <Route path="/clubs" element={<ClubsPage />} />
          <Route path="/clubs/objednavky" element={<ClubOrdersPage />} />
          {/* R21: the cancelled orders (3 segments); one order's history below has 4, so `historie` is never read as an order id */}
          <Route path="/clubs/objednavky/historie" element={<ClubOrdersHistoryPage />} />
          <Route path="/clubs/objednavky/:orderId/historie" element={<ClubOrderHistoryPage />} />
          {/* R14b: the Rezervace page is gone; an old bookmark lands on the orders (it must not fall through to /clubs/:clubId) */}
          <Route path="/clubs/rezervace" element={<Navigate to="/clubs/objednavky" replace />} />
          <Route path="/clubs/hraci" element={<ClubPlayersPage />} />
          <Route path="/clubs/statistiky" element={<ClubStatsPage />} />
          <Route path="/clubs/fakturace" element={<ClubBillingPage />} />
          {/* Stage 5a (R7): a club has its own PAGE first; its calendar (the planner) is one click further. An old /clubs/:clubId bookmark is the page. */}
          <Route path="/clubs/:clubId" element={<ClubOverviewPage />} />
          <Route path="/clubs/:clubId/kalendar" element={<ClubPlannerPage />} />
          <Route path="/accounting-export" element={<RequirePermission of="billing.manage"><AccountingExportPage /></RequirePermission>} />
          <Route path="/intake-review" element={<RequirePermission of="patients.register"><IntakeReviewQueue /></RequirePermission>} />
          <Route path="/planovani" element={<PlannerPage />} />
          <Route path="/dnes" element={<BookingDayOverviewPage />} />
          {/* Unguarded for the reason given at the sidebar entry: the APIs
              behind it ask for sign-in and calendar visibility, nothing named. */}
          <Route path="/prehled-sluzeb" element={<BookingServiceOverviewPage />} />
          <Route path="/vyhrazeni" element={<BookingPartnerOrdersPage />} />
          <Route path="/blokovany-cas" element={<BookingBlockedTimePage />} />
          {/* Where a booking notification's actionUrl points. */}
          <Route
            path="/kalendar/:calendarId/termin/:appointmentId"
            element={<AppointmentLinkPage />}
          />
          {/* /sluzby is the public Služby page; the staff list of services sits under /nastaveni. */}
          <Route path="/nastaveni/sluzby" element={<RequirePermission of="settings.clinic.manage"><ClinicServicesPage /></RequirePermission>} />
          <Route path="/nastaveni/sluzby/:serviceId" element={<RequirePermission of="settings.clinic.manage"><ClinicServicesPage /></RequirePermission>} />
          <Route path="/pravidla-dokumentu" element={<RequirePermission of="settings.clinic.manage"><DocumentRequirementsPage /></RequirePermission>} />
          <Route path="/dokumenty-sablony" element={<RequirePermission of="settings.clinic.manage"><DocumentTemplatesPage /></RequirePermission>} />
          <Route path="/nastaveni/zpravy" element={<RequirePermission of={MESSAGES_PERMISSIONS}><MessagesPage /></RequirePermission>} />
          <Route path="/nastaveni/fronta-emailu" element={<RequirePermission of="settings.clinic.manage"><OutboxPage /></RequirePermission>} />
          {/* Šablony, E-mail and Připomínky became one screen, Zprávy; the old addresses keep working. */}
          {['sablony-emailu', 'email', 'pripominky'].map((old) => (
            <Route key={old} path={`/nastaveni/${old}`} element={<Navigate to="/nastaveni/zpravy" replace />} />
          ))}
          <Route path="/nastaveni/zabezpeceni" element={<TwoFactorPage />} />
          <Route path="/calendars" element={<RequirePermission of="settings.clinic.manage"><BookingCalendarsPage /></RequirePermission>} />
          <Route path="/activities" element={<RequirePermission of="settings.clinic.manage"><BookingActivitiesPage /></RequirePermission>} />
          <Route path="/working-hours" element={<RequirePermission of="settings.clinic.manage"><BookingWorkingHoursPage /></RequirePermission>} />
          <Route path="/exceptions" element={<RequirePermission of="settings.clinic.manage"><BookingExceptionsPage /></RequirePermission>} />
          <Route path="/nepritomnosti" element={<RequirePermission of="settings.clinic.manage"><EmployeeAbsencesPage /></RequirePermission>} />
          <Route path="/admin" element={<RequirePermission of="settings.clinic.manage"><AdminPage /></RequirePermission>} />
          <Route path="/system-health" element={<RequirePermission of="settings.clinic.manage"><SystemHealthPage /></RequirePermission>} />
          <Route path="/nastaveni/zabezpeceni-a-zalohy" element={<RequirePermission of="settings.clinic.manage"><SecurityCenterPage /></RequirePermission>} />
          <Route path="/staff-management" element={<RequirePermission of="users.manage"><StaffManagementPage /></RequirePermission>} />
          <Route path="/audit-log" element={<RequirePermission of="settings.clinic.manage"><AuditLogPage /></RequirePermission>} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:group" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
    {/* Staff only (patients, invoices, appointments, settings): it travels with the portal, not with the sign-in page. */}
    <UniversalSearch />
    </>
  );
}
