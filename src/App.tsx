import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, AppBar, Toolbar, Typography, Box, Drawer, List, ListItemButton, ListItemIcon, Avatar, IconButton, Menu, MenuItem, CircularProgress, Button, ButtonBase, Collapse, Divider, Stack, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Science, Dashboard, People, Settings, Logout, CalendarMonth, Receipt, Search, AttachMoney, Today, ArrowBack, Assessment, Groups, ExpandLess, ExpandMore, Menu as MenuIcon, EventBusy, Lock, RateReview, FactCheck, HealthAndSafety, Psychology, MonitorHeart, Spa, EventAvailable } from '@mui/icons-material';
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
const PatientPortal = lazy(() => import('./pages/public/PatientPortal'));
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

const DRAWER_WIDTH = 240;

/* ── Grouped sidebar menu ── */
interface MenuItemGroup {
  label: string;
  /* `requires` is the permission the server checks behind that screen; an
     entry the signed-in employee does not hold is not drawn. */
  items: { text: string; icon: React.ReactNode; path: string; requires?: Permission }[];
}

const menuGroups: MenuItemGroup[] = [
  /*
   * The six screens of the working day, in the order the design board lists
   * them (3. 10. 2026): the calendar, the people, the clubs, the results, the
   * money, the settings. Nothing else sits at the top level.
   *
   * Everything anybody sets up once - calendars, activities, working hours,
   * exceptions, the team, the public site, the audit log - lives behind
   * Nastavení, grouped the way the API already groups it.
   * `settingsDoesNotDuplicateTheSidebar` in catalogue.test.ts holds the line.
   */
  {
    label: '',
    items: [
      { text: 'Kalendář', icon: <CalendarMonth />, path: '/planovani' },
      { text: 'Pacienti', icon: <People />, path: '/patients', requires: 'patients.view' },
      { text: 'Kluby a týmy', icon: <Groups />, path: '/clubs' },
      { text: 'Výsledky', icon: <Science />, path: '/diagnostics/new' },
      { text: 'Fakturace', icon: <Receipt />, path: '/billing', requires: 'billing.manage' },
      { text: 'Nastavení', icon: <Settings />, path: '/settings' },
    ],
  },
  /*
   * The rest of the day's screens, folded away under "Další" so the sidebar
   * stays the board's six lines but nothing that existed is lost.
   */
  {
    label: 'Další',
    items: [
      { text: 'Přehled', icon: <Dashboard />, path: '/' },
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
      { text: 'Pokladna', icon: <AttachMoney />, path: '/cashier', requires: 'billing.manage' },
      { text: 'Účetní export', icon: <FactCheck />, path: '/accounting-export', requires: 'billing.manage' },
      { text: 'Kontrola registrací', icon: <RateReview />, path: '/intake-review', requires: 'patients.register' },
      { text: 'Zranění', icon: <HealthAndSafety />, path: '/injuries' },
      { text: 'Návrat do hry', icon: <EventAvailable />, path: '/rtp' },
      { text: 'Otřes mozku', icon: <Psychology />, path: '/concussion' },
      { text: 'Tréninková zátěž', icon: <MonitorHeart />, path: '/training-load' },
      { text: 'Wellness', icon: <Spa />, path: '/wellness' },
      { text: 'Dostupnost', icon: <EventBusy />, path: '/availability' },
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

/** The sidebar's width on the board: 300px of white with a hairline on the right. */
const SIDEBAR_WIDTH = 272;

/**
 * One row of the sidebar's navigation. The board draws it as plain text with
 * generous height; the open screen sits on a soft tinted pill in the accent.
 */
function NavRow({
  to,
  label,
  icon,
  active,
  indent = false,
  onNavigate,
}: {
  to: string;
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  indent?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ListItemButton
      component={Link as any}
      to={to}
      selected={active}
      onClick={onNavigate}
      sx={{
        borderRadius: 2,
        mb: 0.25,
        minHeight: indent ? 38 : 44,
        px: indent ? 2 : 1.75,
        ml: indent ? 2 : 0,
        gap: 1.25,
        color: active ? 'primary.main' : 'text.primary',
        fontWeight: active ? 600 : 500,
        fontSize: indent ? 13.5 : 14.5,
      }}
    >
      {icon !== undefined && (
        <Box sx={{ display: 'flex', color: active ? 'primary.main' : 'text.secondary', '& svg': { fontSize: 20 } }}>
          {icon}
        </Box>
      )}
      <Box component="span" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>
    </ListItemButton>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  /*
   * Inside a patient the sidebar becomes that patient's, and the application's
   * own menu steps aside. The owner's rule: while you are in somebody's file,
   * everything on screen is about them.
   *
   * On the board that is a sub-list under "Pacienti" rather than a second
   * sidebar: the file's sections, indented, with the way back out above them.
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('sm-nav-more') === '1'; } catch { return false; }
  });
  const { accent, mode, setAccent, setMode } = useThemePrefs();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const visibleMenu = menuGroups
    .map(group => ({ ...group, items: group.items.filter(item => item.requires === undefined || held.has(item.requires)) }))
    .filter(group => group.items.length > 0);

  const isActivePath = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const toggleMore = () => {
    setMoreOpen((open) => {
      try { localStorage.setItem('sm-nav-more', open ? '0' : '1'); } catch { /* private mode */ }
      return !open;
    });
  };

  const handleLogout = () => {
    setAnchorEl(null);
    void signOut();
  };

  const closeMobile = () => setMobileOpen(false);

  /*
   * The big button at the top of the sidebar. It always lands on the calendar;
   * the calendar reads `state.newAppointment` and opens the booking drawer on
   * the next free time, so the desk never has to find a slot first.
   */
  const newAppointment = () => {
    closeMobile();
    navigate('/planovani', { state: { newAppointment: Date.now() } });
  };

  const sidebar = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', px: 2, pt: 2.25, pb: 1.5 }}>
      <Box
        component={Link}
        to="/"
        onClick={closeMobile}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 0.5, color: 'text.primary' }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>SportMedical</Typography>
      </Box>

      <Button variant="contained" size="large" fullWidth onClick={newAppointment} sx={{ mb: 2.5, minHeight: 46 }}>
        Nová objednávka
      </Button>

      <Box sx={{ flex: 1, overflowY: 'auto', mx: -0.5, px: 0.5 }}>
        <List disablePadding>
          {visibleMenu.map((group, gi) => {
            const isMore = group.label === 'Další';
            const rows = group.items.map((item) => {
              const active = isActivePath(item.path);
              const inPatients = item.path === '/patients' && patientId !== null;
              return (
                <Box key={item.text}>
                  <NavRow to={item.path} label={item.text} icon={item.icon} active={active && !inPatients} onNavigate={closeMobile} />
                  {inPatients && (
                    <Box sx={{ mb: 0.75 }}>
                      {PATIENT_SECTIONS.map((section) => {
                        const to = sectionPath(patientId, section);
                        return (
                          <NavRow
                            key={section.id}
                            to={to}
                            label={section.label}
                            active={location.pathname === to}
                            indent
                            onNavigate={closeMobile}
                          />
                        );
                      })}
                    </Box>
                  )}
                </Box>
              );
            });

            if (isMore) {
              return (
                <Box key={gi} sx={{ mt: 1.5 }}>
                  <ListItemButton onClick={toggleMore} sx={{ borderRadius: 2, minHeight: 36, px: 1.75, color: 'text.secondary' }}>
                    <Typography variant="overline" sx={{ flex: 1 }}>Další</Typography>
                    {moreOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                  </ListItemButton>
                  <Collapse in={moreOpen} timeout="auto" unmountOnExit>
                    {rows}
                  </Collapse>
                </Box>
              );
            }

            return (
              <Box key={gi} sx={{ mt: gi > 0 ? 1 : 0 }}>
                {group.label && (
                  <Typography variant="overline" sx={{ px: 1.75, pb: 0.5, display: 'block', color: 'text.secondary' }}>
                    {group.label}
                  </Typography>
                )}
                {rows}
              </Box>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ my: 1.25 }} />

      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <ButtonBase
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Účet a vzhled"
          sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.25, borderRadius: 2, px: 1, py: 0.75, textAlign: 'left', minWidth: 0, '&:hover': { bgcolor: 'action.hover' } }}
        >
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: '#FFF', fontSize: 13 }}>
            {user.firstName?.[0]}{user.lastName?.[0]}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Účet'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.role || ''}
            </Typography>
          </Box>
        </ButtonBase>
        <IconButton size="small" title="Hledat (Ctrl+K)" aria-label="Hledat"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}>
          <Search fontSize="small" />
        </IconButton>
        <NotificationCenter />
      </Stack>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }} transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        <MenuItem onClick={() => { setAnchorEl(null); navigate('/settings'); }}>
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
                title={a.label}
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
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <a href="#main-content" className="skip-link">
        Přeskočit na hlavní obsah
      </a>

      {narrow ? (
        <>
          <AppBar position="fixed">
            <Toolbar sx={{ minHeight: 56, gap: 1 }}>
              <IconButton edge="start" aria-label="Otevřít menu" onClick={() => setMobileOpen(true)}>
                <MenuIcon />
              </IconButton>
              <Typography sx={{ fontWeight: 700, fontSize: 16, flexGrow: 1 }}>SportMedical</Typography>
              <Button size="small" variant="contained" onClick={newAppointment}>Objednat</Button>
            </Toolbar>
          </AppBar>
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={closeMobile}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, boxSizing: 'border-box' } }}
          >
            {sidebar}
          </Drawer>
        </>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              boxSizing: 'border-box',
              borderRight: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            },
          }}
        >
          {sidebar}
        </Drawer>
      )}

      <Box component="main" id="main-content" role="main" aria-label="Hlavní obsah"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 2, md: 3 },
          pt: { xs: '72px', md: 3 },
          minHeight: '100vh',
        }}
      >
        {/*
          * The way out of a settings screen, drawn once for all of them. Not
          * one had one: clicking into any of them left the gear in a collapsed
          * icon sidebar as the only route back, which is a route nobody finds
          * by looking. It names where it goes rather than promising "back".
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
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
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
            <Route path="/portal/:token" element={<Suspense fallback={<PageLoader />}><PatientPortal /></Suspense>} />
            <Route path="/portal" element={<Suspense fallback={<PageLoader />}><PatientPortal /></Suspense>} />
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
                      <Route path="historie" element={<PatientHistoryPage />} />
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
                    <Route path="/nastaveni/skupinove-slevy" element={<RequirePermission of="settings.clinic.manage"><GroupDiscountsPage /></RequirePermission>} />
                    <Route path="/hodnoceni-pacientu" element={<FeedbackReviewPage />} />
                    <Route path="/nastaveni/pripominky" element={<RequirePermission of="settings.clinic.manage"><RemindersPage /></RequirePermission>} />
                    <Route path="/nastaveni/souhlasy" element={<RequirePermission of="settings.clinic.manage"><ConsentSettingsPage /></RequirePermission>} />
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
