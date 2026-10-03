import { BrowserRouter, Navigate, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, Typography, CircularProgress, Button } from '@mui/material';
import { Science, Dashboard, People, Settings, CalendarMonth, Receipt, AttachMoney, Today, ArrowBack, Assessment, Groups, EventBusy, RateReview, FactCheck, HealthAndSafety, Psychology, MonitorHeart, Spa, EventAvailable, PersonAdd, BarChart } from '@mui/icons-material';
import { QueryClientProvider } from '@tanstack/react-query';
import { usePermissions, type Permission } from './auth/usePermission';
import { useAccountRefresh } from './auth/accountRefresh';
import { queryClient } from './api/queryClient';
import { patientInPath } from './pages/patients/sections';
import { settingsItemAt } from './pages/settings/catalogue';
import { Toaster } from 'react-hot-toast';
import { useState, useMemo, lazy, Suspense, useRef, useEffect } from 'react';
import { SettingsSearchContext } from './components/shell/settingsSearch';
import { SidebarSlotProvider } from './components/shell/SidebarSlot';
import { DesktopSidebar } from './components/shell/Sidebar';
import { TabletRail } from './components/shell/TabletRail';
import { PhoneBottomBar, PhoneTopBar, PHONE_BOTTOM_BAR, PHONE_TOP_BAR } from './components/shell/PhoneShell';
import { AccountMenu } from './components/shell/AccountMenu';
import { WhereAmI, computeCrumbs, useDocumentTitle } from './components/shell/whereAmI';
import { loginUrl } from './components/shell/loginRedirect';
import { RAIL_WIDTH, SIDEBAR_WIDTH } from './components/shell/shellStyles';
import type { MenuEntry, ShellNav } from './components/shell/shellTypes';
import { useDevice } from './layout/useDevice';
import { buildTheme, type ThemeMode } from './theme';
import {
  ThemePrefsContext,
  readStoredAccent,
  readStoredMode,
  ACCENT_STORAGE_KEY,
  MODE_STORAGE_KEY,
} from './themePrefs';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import NetworkBanner from './components/NetworkBanner';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import UniversalSearch from './components/UniversalSearch';

/* ── Lazy-loaded routes (code-split per page) ── */
const NotFound = lazy(() => import('./pages/NotFound'));
const Login = lazy(() => import('./pages/Login'));
const IntakeQuestionnaire = lazy(() => import('./pages/public/IntakeQuestionnaire'));
const PublicBooking = lazy(() => import('./pages/public/PublicBooking'));
const ManageBooking = lazy(() => import('./pages/public/ManageBooking'));
const PatientPortal = lazy(() => import('./pages/public/PatientPortal'));
const PatientSignIn = lazy(() => import('./pages/public/PatientSignIn'));
const ClubRegistration = lazy(() => import('./pages/public/ClubRegistration'));
const FeedbackPage = lazy(() => import('./pages/public/FeedbackPage'));
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
const InjuriesPage = lazy(() => import('./pages/Injuries'));
const WellnessPage = lazy(() => import('./pages/Wellness'));
const RtpPage = lazy(() => import('./pages/Rtp'));
const ConcussionPage = lazy(() => import('./pages/Concussion'));
const AvailabilityPage = lazy(() => import('./pages/Availability'));
const TrainingLoadPage = lazy(() => import('./pages/TrainingLoad'));
const SystemHealthPage = lazy(() => import('./pages/SystemHealth'));
const StaffManagementPage = lazy(() => import('./pages/StaffManagement'));
const AuditLogPage = lazy(() => import('./pages/AuditLog'));
/* Booking phase 1, stage 1: calendars, access and activities */
const BookingCalendarsPage = lazy(() => import('./pages/booking/CalendarsPage'));
const ClinicServicesPage = lazy(() => import('./pages/booking/ClinicServicesPage'));
const DocumentRequirementsPage = lazy(() => import('./pages/settings/DocumentRequirementsPage'));
const DocumentTemplatesPage = lazy(() => import('./pages/settings/DocumentTemplatesPage'));
const EmailTemplatesPage = lazy(() => import('./pages/settings/EmailTemplatesPage'));
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
const CompanyInvoiceSettingsPage = lazy(() => import('./pages/settings/CompanyInvoiceSettingsPage'));
const SiteContentAdminPage = lazy(() => import('./pages/settings/SiteContentAdminPage'));
const MediaStorageSettingsPage = lazy(() => import('./pages/settings/MediaStorageSettingsPage'));
const ClubSettingsPage = lazy(() => import('./pages/settings/ClubSettingsPage'));
const RemindersPage = lazy(() => import('./pages/settings/RemindersPage'));
const ConsentSettingsPage = lazy(() => import('./pages/settings/ConsentSettingsPage'));
const BookingActivitiesPage = lazy(() => import('./pages/booking/ActivitiesPage'));
/* Booking phase 1, stage 2: working hours, periods, cycle and exceptions */
const BookingWorkingHoursPage = lazy(() => import('./pages/booking/WorkingHoursPage'));
const BookingExceptionsPage = lazy(() => import('./pages/booking/ExceptionsPage'));
/* Booking phase 1, stage 3: the calendar grid */
const BookingGridPage = lazy(() => import('./pages/booking/CalendarGridPage'));
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
const AccountingExportPage = lazy(() => import('./pages/AccountingExportPage'));
/* "Statistics for everything in one place" - under Výsledky in the rail. */
const StatisticsPage = lazy(() => import('./pages/Statistics'));

/* ── Loading spinner for Suspense ── */
function PageLoader() {
  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', gap: 1.5,
        justifyContent: 'center', alignItems: 'center', minHeight: '50vh',
      }}
    >
      <CircularProgress size={40} color="primary" />
      <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: 1 }}>
        SPORTMEDICAL
      </Typography>
    </Box>
  );
}

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
const MENU_CHILDREN: Record<string, MenuEntry[]> = {
  '/planovani': [
    { text: 'Dnešní přehled', icon: <Today />, path: '/dnes' },
    /*
     * No `requires`, and that is measured, not forgotten: everything behind
     * this screen - GET /api/day, …/preview, …/availability, /api/activities,
     * /api/clinic-services - carries `[Authorize]` and per-calendar
     * visibility only, no named permission. An employee who sees one
     * calendar gets the overview of that one calendar, and the server is
     * what narrows it (6.5).
     */
    { text: 'Přehled podle služeb', icon: <Assessment />, path: '/prehled-sluzeb' },
    { text: 'Dostupnost', icon: <EventBusy />, path: '/availability' },
  ],
  '/patients': [
    { text: 'Nový pacient', icon: <PersonAdd />, path: '/patients/register', requires: 'patients.register' },
    { text: 'Kontrola registrací', icon: <RateReview />, path: '/intake-review', requires: 'patients.register' },
  ],
  '/diagnostics/new': [
    { text: 'Diagnostika a měření', icon: <Science />, path: '/diagnostics/new' },
    { text: 'Zranění', icon: <HealthAndSafety />, path: '/injuries' },
    { text: 'Návrat do hry', icon: <EventAvailable />, path: '/rtp' },
    { text: 'Otřes mozku', icon: <Psychology />, path: '/concussion' },
    { text: 'Tréninková zátěž', icon: <MonitorHeart />, path: '/training-load' },
    { text: 'Wellness', icon: <Spa />, path: '/wellness' },
    /* "Statistics for everything in one place." */
    { text: 'Statistiky', icon: <BarChart />, path: '/statistiky' },
  ],
  '/billing': [
    { text: 'Pokladna', icon: <AttachMoney />, path: '/cashier', requires: 'billing.manage' },
    { text: 'Účetní export', icon: <FactCheck />, path: '/accounting-export', requires: 'billing.manage' },
  ],
};

/*
 * The six screens of the working day, in the order the design board lists
 * them (3. 10. 2026): the calendar, the people, the clubs, the results, the
 * money, the settings - with Přehled, small, above them, because the brand
 * also lands there and a home needs a name.
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
  { text: 'Výsledky', icon: <Science />, path: '/diagnostics/new' },
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
function RequirePermission({ of, children }: { of: Permission; children: React.ReactNode }) {
  const held = usePermissions();
  if (!held.includes(of)) {
    return <NotFound />;
  }
  return <>{children}</>;
}

/*
 * Everything the router does not name above is the staff portal, and it is behind the
 * sign-in: without a session the person is sent to /login and, once signed in, comes back to
 * the screen they asked for (?next=). The public patient site is NOT in this router at all -
 * it is the other bundle, served at the root of the domain (see src/main.tsx and
 * src/web/sitePaths.ts), so no staff path may ever equal a public one
 * (src/web/routeCollisions.test.ts).
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to={loginUrl(`${location.pathname}${location.search}${location.hash}`)} replace />;
  }
  return <>{children}</>;
}


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
 *   ≥1280  a fixed 258px sidebar with text            (components/shell/Sidebar)
 *   768+   a 72px rail that opens as an overlay        (components/shell/TabletRail)
 *   ≤767   a bottom bar, a top bar and a "Více" sheet  (components/shell/PhoneShell)
 *
 * On a settings route the navigation's content is replaced by the settings
 * one; the main entries are not drawn at all there.
 */
export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const device = useDevice();
  /* Reloaded from GET /api/v1/account on start, on focus and after any 403,
     so a permission the owner changed redraws this menu without a new sign-in. */
  useAccountRefresh();
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

  const settingsNeedsFrame = settingsHere !== null && SETTINGS_UNFRAMED.has(settingsHere.item.to);

  /* The area's offset is a pixel STRING: sx `ml` with a number is spacing × 8. */
  const marginLeft = device === 'desktop' ? `${SIDEBAR_WIDTH}px` : device === 'tablet' ? `${RAIL_WIDTH}px` : '0px';

  return (
    <SettingsSearchContext.Provider value={settingsSearch}>
      <SidebarSlotProvider available={device === 'desktop' && !settingsMode}>
        <Box sx={{ minHeight: '100vh' }}>
          <a href="#main-content" className="skip-link">
            Přeskočit na hlavní obsah
          </a>

          {device === 'desktop' && <DesktopSidebar nav={nav} />}
          {device === 'tablet' && <TabletRail nav={nav} />}
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
              minHeight: '100vh',
              boxSizing: 'border-box',
              /* One margin per device and no transition: nothing moves while a page loads. */
              ml: marginLeft,
              ...(device === 'desktop'
                ? { px: '28px', pt: '24px', pb: '40px' }
                : device === 'tablet'
                  ? { px: 3, pt: 3, pb: 4 }
                  : { px: 2, pt: `calc(${PHONE_TOP_BAR} + 16px)`, pb: `calc(${PHONE_BOTTOM_BAR} + 24px)` }),
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
                  <Box component="span" sx={{ mx: 0.75, color: 'text.disabled' }}>/</Box>
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                    {settingsHere.section.label}
                  </Box>
                </Button>
              </Box>
            )}

            {/*
              * No page transition: routes render at once, and a nested layout
              * stays mounted across its children.
              */}
            {children}
          </Box>
        </Box>
      </SidebarSlotProvider>
    </SettingsSearchContext.Provider>
  );
}


export default function App() {
  const [accent, setAccentState] = useState<string>(readStoredAccent);
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const setAccent = (color: string) => {
    setAccentState(color);
    try { localStorage.setItem(ACCENT_STORAGE_KEY, color); } catch { /* private mode */ }
  };
  const setMode = (next: ThemeMode) => {
    setModeState(next);
    try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch { /* private mode */ }
  };
  const activeTheme = useMemo(() => buildTheme(accent, mode), [accent, mode]);
  return (
    <GlobalErrorBoundary>
    <ThemePrefsContext.Provider value={{ accent, mode, setAccent, setMode }}>
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      <KeyboardShortcuts />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
            <Route path="/dotaznik" element={<Suspense fallback={<PageLoader />}><IntakeQuestionnaire /></Suspense>} />
            {/* Dokončení registrace z odkazu, který desk poslal pacientovi.
                Anonymní jako /dotaznik — pacient nemá účet, dokud ho tu nezaloží. */}
            <Route path="/dokonceni/:token" element={<Suspense fallback={<PageLoader />}><IntakeQuestionnaire /></Suspense>} />
            {/* Objednání online. Anonymous, like /dotaznik, and outside the
                AuthGuard for the same reason: a patient has no account. */}
            <Route path="/objednat" element={<Suspense fallback={<PageLoader />}><PublicBooking /></Suspense>} />
            {/* Sprava rezervace. Anonymous like the two above: the manage token
                IS the identity, and a patient sent to a login screen on the way
                to their own appointment can never get there. That is exactly
                what the confirmation's button did until this route existed. */}
            <Route path="/rezervace/:token" element={<Suspense fallback={<PageLoader />}><ManageBooking /></Suspense>} />
            <Route path="/klub/:token" element={<Suspense fallback={<PageLoader />}><ClubRegistration /></Suspense>} />
            <Route path="/hodnoceni/:token" element={<Suspense fallback={<PageLoader />}><FeedbackPage /></Suspense>} />
            {/* Patient portal. Anonymous like the links above: the personal access
                token IS the identity, resolving to one patient's own dashboard. */}
            <Route path="/portal/prihlaseni" element={<Suspense fallback={<PageLoader />}><PatientSignIn /></Suspense>} />
            <Route path="/portal/:token" element={<Suspense fallback={<PageLoader />}><PatientPortal /></Suspense>} />
            <Route path="/portal" element={<Suspense fallback={<PageLoader />}><PatientPortal /></Suspense>} />
            <Route path="/*" element={
              <AuthGuard>
                <Layout>
                  <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/prehled" element={<DashboardPage />} />
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
                    <Route path="/diagnostics/new" element={<DiagnosticForm />} />
                    <Route path="/billing" element={<RequirePermission of="billing.manage"><BillingPage /></RequirePermission>} />
                    {/* The staff price list. /cenik is the PUBLIC price list now (the other bundle). */}
                    <Route path="/nastaveni/cenik" element={<CenikPage />} />
                    <Route path="/injuries" element={<InjuriesPage />} />
                    <Route path="/rtp" element={<RtpPage />} />
                    <Route path="/concussion" element={<ConcussionPage />} />
                    <Route path="/availability" element={<AvailabilityPage />} />
                    <Route path="/svatky" element={<RequirePermission of="settings.clinic.manage"><HolidaysPage /></RequirePermission>} />
                    <Route path="/dotaznik-nastaveni" element={<RequirePermission of="questionnaires.manage"><QuestionnairePage /></RequirePermission>} />
                    <Route path="/nastaveni/vzhled-kalendare" element={<RequirePermission of="settings.clinic.manage"><CalendarDisplayPage /></RequirePermission>} />
                    <Route path="/nastaveni/udaje-pacienta" element={<RequirePermission of="settings.clinic.manage"><PatientFieldsPage /></RequirePermission>} />
                    <Route path="/nastaveni/slevy" element={<RequirePermission of="settings.clinic.manage"><DiscountsPage /></RequirePermission>} />
                    <Route path="/nastaveni/barvy-sluzeb" element={<RequirePermission of="settings.clinic.manage"><ServiceColorsPage /></RequirePermission>} />
                    <Route path="/nastaveni/rychla-registrace" element={<RequirePermission of="settings.clinic.manage"><QuickRegistrationSettingsPage /></RequirePermission>} />
                    <Route path="/nastaveni/firma-a-faktury" element={<RequirePermission of="settings.clinic.manage"><CompanyInvoiceSettingsPage /></RequirePermission>} />
                    <Route path="/nastaveni/media-a-texty" element={<RequirePermission of="settings.clinic.manage"><SiteContentAdminPage /></RequirePermission>} />
                    <Route path="/nastaveni/uloziste-medii" element={<RequirePermission of="settings.clinic.manage"><MediaStorageSettingsPage /></RequirePermission>} />
                    <Route path="/nastaveni/kluby" element={<RequirePermission of="settings.clinic.manage"><ClubSettingsPage /></RequirePermission>} />
                    <Route path="/nastaveni/integrace" element={<RequirePermission of="settings.clinic.manage"><IntegrationsPage /></RequirePermission>} />
                    <Route path="/nastaveni/historie-zmen" element={<RequirePermission of="settings.clinic.manage"><ChangeHistoryPage /></RequirePermission>} />
                    <Route path="/nastaveni/skupinove-slevy" element={<RequirePermission of="settings.clinic.manage"><GroupDiscountsPage /></RequirePermission>} />
                    <Route path="/hodnoceni-pacientu" element={<FeedbackReviewPage />} />
                    <Route path="/nastaveni/pripominky" element={<RequirePermission of="settings.clinic.manage"><RemindersPage /></RequirePermission>} />
                    <Route path="/nastaveni/souhlasy" element={<RequirePermission of="settings.clinic.manage"><ConsentSettingsPage /></RequirePermission>} />
                    <Route path="/training-load" element={<TrainingLoadPage />} />
                    <Route path="/wellness" element={<WellnessPage />} />
                    <Route path="/statistiky" element={<StatisticsPage />} />
                    <Route path="/cashier" element={<RequirePermission of="billing.manage"><CashierPage /></RequirePermission>} />
                    <Route path="/clubs" element={<ClubsPage />} />
                    <Route path="/accounting-export" element={<RequirePermission of="billing.manage"><AccountingExportPage /></RequirePermission>} />
                    <Route path="/intake-review" element={<RequirePermission of="patients.register"><IntakeReviewQueue /></RequirePermission>} />
                    <Route path="/planovani" element={<BookingGridPage />} />
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
                    <Route path="/pravidla-dokumentu" element={<RequirePermission of="settings.clinic.manage"><DocumentRequirementsPage /></RequirePermission>} />
                    <Route path="/dokumenty-sablony" element={<RequirePermission of="settings.clinic.manage"><DocumentTemplatesPage /></RequirePermission>} />
                    <Route path="/nastaveni/sablony-emailu" element={<RequirePermission of="communication.manage"><EmailTemplatesPage /></RequirePermission>} />
                    <Route path="/nastaveni/zabezpeceni" element={<TwoFactorPage />} />
                    <Route path="/calendars" element={<RequirePermission of="settings.clinic.manage"><BookingCalendarsPage /></RequirePermission>} />
                    <Route path="/activities" element={<RequirePermission of="settings.clinic.manage"><BookingActivitiesPage /></RequirePermission>} />
                    <Route path="/working-hours" element={<RequirePermission of="settings.clinic.manage"><BookingWorkingHoursPage /></RequirePermission>} />
                    <Route path="/exceptions" element={<RequirePermission of="settings.clinic.manage"><BookingExceptionsPage /></RequirePermission>} />
                    <Route path="/nepritomnosti" element={<RequirePermission of="settings.clinic.manage"><EmployeeAbsencesPage /></RequirePermission>} />
                    <Route path="/admin" element={<RequirePermission of="settings.clinic.manage"><AdminPage /></RequirePermission>} />
                    <Route path="/system-health" element={<RequirePermission of="settings.clinic.manage"><SystemHealthPage /></RequirePermission>} />
                    <Route path="/staff-management" element={<RequirePermission of="users.manage"><StaffManagementPage /></RequirePermission>} />
                    <Route path="/audit-log" element={<RequirePermission of="settings.clinic.manage"><AuditLogPage /></RequirePermission>} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/settings/:group" element={<SettingsPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  </Suspense>
                </Layout>
              </AuthGuard>
            } />
          </Routes>
          <UniversalSearch />
          <NetworkBanner />
          <Toaster position="top-right" />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
    </ThemePrefsContext.Provider>
    </GlobalErrorBoundary>
  );
}
