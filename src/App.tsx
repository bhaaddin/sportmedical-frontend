import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, AppBar, Toolbar, Typography, Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Avatar, IconButton, Menu, MenuItem, Badge, CircularProgress, Button } from '@mui/material';
import { Science, Dashboard, People, PersonAdd, Settings, LocalHospital, Logout, Notifications, CalendarMonth, Receipt, MonitorHeart, AdminPanelSettings, Warning, Flag, Psychology, EventAvailable, Search, AttachMoney, Schedule, EventBusy, Today, Description, ArrowBack, Assessment } from '@mui/icons-material';
import { QueryClientProvider } from '@tanstack/react-query';
import { usePermissions, type Permission } from './auth/usePermission';
import { useAccountRefresh } from './auth/accountRefresh';
import { queryClient } from './api/queryClient';
import { PATIENT_SECTIONS, patientInPath, sectionPath } from './pages/patients/sections';
import { settingsItemAt } from './pages/settings/catalogue';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useMemo, lazy, Suspense, useRef, useCallback } from 'react';
import { buildTheme, THEME_ACCENTS, type ThemeMode } from './theme';
import {
  ThemePrefsContext,
  useThemePrefs,
  readStoredAccent,
  readStoredMode,
  ACCENT_STORAGE_KEY,
  MODE_STORAGE_KEY,
} from './themePrefs';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import NetworkBanner from './components/NetworkBanner';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import UniversalSearch from './components/UniversalSearch';
import NotificationCenter from './components/NotificationCenter';
import { signOut } from './auth/signOut';

/* ── Lazy-loaded routes (code-split per page) ── */
const NotFound = lazy(() => import('./pages/NotFound'));
const Login = lazy(() => import('./pages/Login'));
const IntakeQuestionnaire = lazy(() => import('./pages/public/IntakeQuestionnaire'));
const PublicBooking = lazy(() => import('./pages/public/PublicBooking'));
const ManageBooking = lazy(() => import('./pages/public/ManageBooking'));
const IntakeReviewQueue = lazy(() => import('./pages/IntakeReviewQueue'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const DiagnosticForm = lazy(() => import('./pages/DiagnosticForm'));
const PatientList = lazy(() => import('./pages/PatientList'));
const PatientDetails = lazy(() => import('./pages/PatientDetails'));
const PatientLayout = lazy(() => import('./pages/patients/PatientLayout'));
const PatientDocumentsPage = lazy(() => import('./pages/patients/PatientDocumentsPage'));
const PatientAppointmentsPage = lazy(() => import('./pages/patients/PatientAppointmentsPage'));
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
const HolidaysPage = lazy(() => import('./pages/settings/HolidaysPage'));
const QuestionnairePage = lazy(() => import('./pages/settings/QuestionnairePage'));
const CalendarDisplayPage = lazy(() => import('./pages/settings/CalendarDisplayPage'));
const PatientFieldsPage = lazy(() => import('./pages/settings/PatientFieldsPage'));
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

/* ── Loading spinner for Suspense ── */
function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
      <CircularProgress size={40} sx={{ color: '#0D7377' }} />
    </Box>
  );
}

const DRAWER_WIDTH = 240;

/* ── Grouped sidebar menu ── */
interface MenuItemGroup {
  label: string;
  /* `requires` is the permission the server checks behind that screen; an
     entry the signed-in employee does not hold is not drawn. */
  items: { text: string; icon: React.ReactNode; path: string; requires?: Permission }[];
}

const menuGroups: MenuItemGroup[] = [
  {
    label: '',
    items: [
      { text: 'Přehled', icon: <Dashboard />, path: '/' },
    ],
  },
  /*
   * Daily work only. Everything anybody sets up once - calendars, activities,
   * working hours, exceptions, the team, the public site, the audit log - now
   * lives behind Nastavení, grouped the way the API already groups it.
   *
   * The sidebar was twenty entries, and the four somebody opens every morning
   * sat among sixteen they open twice a year. Documents were not there at all:
   * the screen existed and could only be reached by typing its address.
   */
  {
    label: '',
    items: [
      { text: 'Dnešní přehled', icon: <Today />, path: '/dnes' },
      { text: 'Plánování', icon: <CalendarMonth />, path: '/planovani' },
      /*
       * No `requires`, and that is measured, not forgotten: everything behind
       * this screen - GET /api/day, …/preview, …/availability, /api/activities,
       * /api/clinic-services - carries `[Authorize]` and per-calendar
       * visibility only, no named permission. An employee who sees one
       * calendar gets the overview of that one calendar, and the server is
       * what narrows it (6.5).
       */
      { text: 'Přehled podle služeb', icon: <Assessment />, path: '/prehled-sluzeb' },
      { text: 'Pacienti', icon: <People />, path: '/patients', requires: 'patients.view' },
      { text: 'Diagnostika', icon: <Science />, path: '/diagnostics/new' },
    ],
  },
  {
    label: 'Peníze',
    items: [
      { text: 'Pokladna', icon: <AttachMoney />, path: '/cashier', requires: 'billing.manage' },
      { text: 'Fakturace', icon: <Receipt />, path: '/billing', requires: 'billing.manage' },
      { text: 'Účetní export', icon: <Receipt />, path: '/accounting-export', requires: 'billing.manage' },
    ],
  },
  {
    /*
     * Plátci used to sit here as well as in Nastavení. It is configuration,
     * so Nastavení is where it lives and the sidebar is for the work of the
     * day. Two entries for one screen is the shape this
     * project keeps finding, and this time I put it there myself: adding
     * Plátci to Nastavení without taking it out of here.
     *
     * `settingsDoesNotDuplicateTheSidebar` in catalogue.test.ts holds the line.
     */
    label: '',
    items: [
      { text: 'Nastavení', icon: <Settings />, path: '/settings' },
    ],
  },
];

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

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login';
    return null;
  }
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  /*
   * Inside a patient the sidebar becomes that patient's, and the application's
   * own menu steps aside. The owner's rule: while you are in somebody's file,
   * everything on screen is about them.
   *
   * It is the same navigation either way - a column of links on the left -
   * so nobody has to learn a second way of getting around; only its contents
   * change, and the way back out is the first thing in it.
   */
  /* Reloaded from GET /api/v1/account on start, on focus and after any 403,
     so a permission the owner changed redraws this menu without a new sign-in. */
  useAccountRefresh();
  const held = new Set(usePermissions());
  /* Without patients.view the address is NotFound, and a patient's sidebar
     around it would offer sections that are NotFound too. */
  const patientId = held.has('patients.view') ? patientInPath(location.pathname) : null;
  const settingsHere = settingsItemAt(location.pathname);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { accent, mode, setAccent, setMode } = useThemePrefs();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const visibleMenu = menuGroups
    .map(group => ({ ...group, items: group.items.filter(item => item.requires === undefined || held.has(item.requires)) }))
    .filter(group => group.items.length > 0);

  const COLLAPSED_WIDTH = 64;
  const EXPANDED_WIDTH = 240;
  const currentWidth = sidebarOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  const handleSidebarEnter = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setSidebarOpen(true);
  }, []);

  const handleSidebarLeave = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setSidebarOpen(false), 300);
  }, []);

  const handleLogout = () => {
    setAnchorEl(null);
    void signOut();
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <a href="#main-content" className="skip-link">
        Přeskočit na hlavní obsah
      </a>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, bgcolor: '#0D7377', boxShadow: '0 2px 16px rgba(13,115,119,0.25)' }}>
        <Toolbar>
          <LocalHospital sx={{ mr: 1 }} />
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, flexGrow: 1 }}>
            SportMedical Diagnostics
          </Typography>
          <IconButton color="inherit" sx={{ mr: 1 }} title="Hledat (Ctrl+K)"
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}>
            <Search />
          </IconButton>
          <NotificationCenter />
          <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{ transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.1)' } }}>
            <Avatar sx={{ bgcolor: '#14A3A8', width: 36, height: 36, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 0 0 3px rgba(20,163,168,0.4)' } }}>
              {user.firstName?.[0]}{user.lastName?.[0]}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem onClick={() => { setAnchorEl(null); window.location.href = '/settings'; }}>
              <ListItemIcon><Settings fontSize="small" /></ListItemIcon> Nastavení
            </MenuItem>
            <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
                Vzhled
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75, mb: 1 }}>
                {THEME_ACCENTS.map((a) => (
                  <Box
                    key={a.key}
                    role="button"
                    aria-label={a.label}
                    onClick={() => setAccent(a.color)}
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      bgcolor: a.color,
                      outline: '2px solid',
                      outlineColor: accent === a.color ? 'text.primary' : 'transparent',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </Box>
              <Button
                size="small"
                variant="outlined"
                fullWidth
                onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
              >
                {mode === 'light' ? 'Tmavý režim' : 'Světlý režim'}
              </Button>
            </Box>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon> Odhlásit se
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Hover zone — triggers sidebar open when cursor nears left edge */}
      <Box
        onMouseEnter={handleSidebarEnter}
        sx={{
          position: 'fixed', top: 64, left: 0, width: sidebarOpen ? currentWidth : 8,
          height: 'calc(100vh - 64px)', zIndex: 1200,
          transition: 'width 0.25s ease',
        }}
      />

      <Drawer
        variant="permanent"
        onMouseEnter={handleSidebarEnter}
        onMouseLeave={handleSidebarLeave}
        sx={{
          width: currentWidth, flexShrink: 0,
          transition: 'width 0.25s ease',
          overflowX: 'hidden',
          '& .MuiDrawer-paper': {
            width: currentWidth, boxSizing: 'border-box', mt: '64px',
            borderRight: '1px solid rgba(0,0,0,0.06)',
            transition: 'width 0.25s ease',
            overflowX: 'hidden',
          },
        }}
      >
        <List sx={{ px: 0.5, pt: 1 }}>
          {patientId !== null && (
            <Box sx={{ mb: 1 }}>
              <ListItemButton
                component={Link as any}
                to="/patients"
                title={!sidebarOpen ? 'Zpět na pacienty' : undefined}
                sx={{
                  borderRadius: 2, mb: 0.5, py: 1.0, minHeight: 44,
                  justifyContent: sidebarOpen ? 'initial' : 'center',
                  px: sidebarOpen ? 2 : 1.5,
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, justifyContent: 'center' }}>
                  <ArrowBack />
                </ListItemIcon>
                {sidebarOpen && (
                  <ListItemText primary="Zpět na pacienty" slotProps={{
                    primary: { sx: { fontSize: 14, whiteSpace: 'nowrap' } },
                  }} />
                )}
              </ListItemButton>
              <Box sx={{ mx: 1.5, my: 1, borderTop: '1px solid #e0e0e0' }} />
              {PATIENT_SECTIONS.map((section) => {
                const to = sectionPath(patientId, section);
                const isActive = location.pathname === to;
                return (
                  <ListItemButton
                    key={section.id}
                    component={Link as any}
                    to={to}
                    selected={isActive}
                    title={!sidebarOpen ? section.label : undefined}
                    sx={{
                      borderRadius: 2, mb: 0.5, py: 1.0, minHeight: 44,
                      justifyContent: sidebarOpen ? 'initial' : 'center',
                      px: sidebarOpen ? 2 : 1.5,
                      '&.Mui-selected': { bgcolor: '#E0F2F1', color: '#0D7377', boxShadow: 'inset 3px 0 0 #0D7377' },
                      '&:hover': { bgcolor: '#E0F2F1' },
                    }}
                  >
                    <ListItemIcon sx={{
                      color: isActive ? '#0D7377' : 'inherit', minWidth: 40, justifyContent: 'center',
                    }}>
                      {section.icon}
                    </ListItemIcon>
                    {sidebarOpen && (
                      <ListItemText primary={section.label} slotProps={{
                        primary: { sx: { fontWeight: isActive ? 600 : 400, fontSize: 14, whiteSpace: 'nowrap' } },
                      }} />
                    )}
                  </ListItemButton>
                );
              })}
            </Box>
          )}

          {patientId === null && visibleMenu.map((group, gi) => (
            <Box key={gi}>
              {group.label && sidebarOpen && (
                <Typography variant="caption" sx={{ px: 2, pt: gi > 0 ? 2 : 0, pb: 0.5, display: 'block', fontWeight: 700, color: '#999', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {group.label}
                </Typography>
              )}
              {group.label && !sidebarOpen && gi > 0 && (
                <Box sx={{ mx: 1.5, my: 1, borderTop: '1px solid #e0e0e0' }} />
              )}
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <motion.div key={item.text} whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                    <ListItemButton component={Link as any} to={item.path}
                      selected={isActive}
                      title={!sidebarOpen ? item.text : undefined}
                      sx={{
                        borderRadius: 2, mb: 0.5, py: 1.0, minHeight: 44,
                        justifyContent: sidebarOpen ? 'initial' : 'center',
                        px: sidebarOpen ? 2 : 1.5,
                        transition: 'all 0.2s ease',
                        '&.Mui-selected': { bgcolor: '#E0F2F1', color: '#0D7377', boxShadow: 'inset 3px 0 0 #0D7377' },
                        '&:hover': { bgcolor: '#E0F2F1', transform: 'translateX(2px)' },
                      }}>
                      <ListItemIcon sx={{
                        color: isActive ? '#0D7377' : 'inherit', minWidth: 40,
                        justifyContent: 'center',
                      }}>
                        {item.icon}
                      </ListItemIcon>
                      {sidebarOpen && (
                        <ListItemText primary={item.text} slotProps={{
                          primary: { sx: { fontWeight: isActive ? 600 : 400, fontSize: 14, whiteSpace: 'nowrap' } },
                        }} />
                      )}
                    </ListItemButton>
                  </motion.div>
                );
                })}
            </Box>
          ))}
        </List>
      </Drawer>

      <Box component="main" id="main-content" role="main" aria-label="Hlavní obsah"
        sx={{
          flexGrow: 1, p: 3, mt: '64px', ml: `${currentWidth}px`,
          transition: 'margin-left 0.25s ease',
          bgcolor: '#F5F7FA', minHeight: '100vh', overflow: 'auto',
        }}
      >
        {/*
          * The way out of a settings screen, drawn once for all fourteen of
          * them. Not one had one: clicking into any of them left the gear in a
          * collapsed icon sidebar as the only route back, which is a route
          * nobody finds by looking.
          *
          * It names where it goes rather than promising "back". `navigate(-1)`
          * would be a guess - somebody can arrive here from the booking screen
          * or by typing the address - and a control that lands somewhere
          * different each time is worse than none.
          */}
        {settingsHere !== null && (
          <Box sx={{ mb: 2 }}>
            <Button
              component={Link as any}
              to="/settings"
              startIcon={<ArrowBack />}
              size="small"
              sx={{ color: 'text.secondary', textTransform: 'none' }}
            >
              Nastavení
              <Box component="span" sx={{ mx: 0.75, color: 'text.disabled' }}>/</Box>
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                {settingsHere.section.label}
              </Box>
            </Button>
          </Box>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </Box>
    </Box>
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
            {/* Objednání online. Anonymous, like /dotaznik, and outside the
                AuthGuard for the same reason: a patient has no account. */}
            <Route path="/objednat" element={<Suspense fallback={<PageLoader />}><PublicBooking /></Suspense>} />
            {/* Sprava rezervace. Anonymous like the two above: the manage token
                IS the identity, and a patient sent to a login screen on the way
                to their own appointment can never get there. That is exactly
                what the confirmation's button did until this route existed. */}
            <Route path="/rezervace/:token" element={<Suspense fallback={<PageLoader />}><ManageBooking /></Suspense>} />
            <Route path="/*" element={
              <AuthGuard>
                <Layout>
                  <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
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
                    </Route>
                    <Route path="/diagnostics/new" element={<DiagnosticForm />} />
                    <Route path="/billing" element={<RequirePermission of="billing.manage"><BillingPage /></RequirePermission>} />
                    <Route path="/cenik" element={<CenikPage />} />
                    <Route path="/injuries" element={<InjuriesPage />} />
                    <Route path="/rtp" element={<RtpPage />} />
                    <Route path="/concussion" element={<ConcussionPage />} />
                    <Route path="/availability" element={<AvailabilityPage />} />
                    <Route path="/svatky" element={<RequirePermission of="settings.clinic.manage"><HolidaysPage /></RequirePermission>} />
                    <Route path="/dotaznik-nastaveni" element={<RequirePermission of="questionnaires.manage"><QuestionnairePage /></RequirePermission>} />
                    <Route path="/nastaveni/vzhled-kalendare" element={<RequirePermission of="settings.clinic.manage"><CalendarDisplayPage /></RequirePermission>} />
                    <Route path="/nastaveni/udaje-pacienta" element={<RequirePermission of="settings.clinic.manage"><PatientFieldsPage /></RequirePermission>} />
                    <Route path="/training-load" element={<TrainingLoadPage />} />
                    <Route path="/wellness" element={<WellnessPage />} />
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
                    <Route path="/sluzby" element={<RequirePermission of="settings.clinic.manage"><ClinicServicesPage /></RequirePermission>} />
                    <Route path="/pravidla-dokumentu" element={<RequirePermission of="settings.clinic.manage"><DocumentRequirementsPage /></RequirePermission>} />
                    <Route path="/dokumenty-sablony" element={<RequirePermission of="settings.clinic.manage"><DocumentTemplatesPage /></RequirePermission>} />
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
