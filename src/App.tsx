import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, AppBar, Toolbar, Typography, Box, Drawer, List, ListItemButton, ListItemIcon, Avatar, IconButton, Menu, MenuItem, CircularProgress, Button, ButtonBase, Collapse, Divider, Tooltip, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Science, Dashboard, People, Settings, Logout, CalendarMonth, Receipt, Search, AttachMoney, Today, ArrowBack, Assessment, Groups, ExpandLess, ExpandMore, Menu as MenuIcon, EventBusy, RateReview, FactCheck, HealthAndSafety, Psychology, MonitorHeart, Spa, EventAvailable, PersonAdd, BarChart, Add } from '@mui/icons-material';
import { QueryClientProvider } from '@tanstack/react-query';
import { usePermissions, type Permission } from './auth/usePermission';
import { useAccountRefresh } from './auth/accountRefresh';
import { queryClient } from './api/queryClient';
import { PATIENT_SECTIONS, patientInPath, sectionPath } from './pages/patients/sections';
import { settingsItemAt } from './pages/settings/catalogue';
import { SettingsNav } from './pages/settings/SettingsFrame';
import { Toaster } from 'react-hot-toast';
import { useState, useMemo, lazy, Suspense, useRef, useEffect } from 'react';
import { Rail, RailRow, RailPin, IconCell, RAIL_EXPANDED, RAIL_ICON_COL, RAIL_MOTION, useRailState } from './components/shell/Rail';
import { SettingsSearchContext } from './components/shell/settingsSearch';
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

/* ── The rail's menu ── */
interface MenuEntry {
  text: string;
  icon: React.ReactNode;
  path: string;
  /* `requires` is the permission the server checks behind that screen; an
     entry the signed-in employee does not hold is not drawn. */
  requires?: Permission;
  /** The screens that belong under this one; shown when it is open in the rail. */
  children?: MenuEntry[];
}

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
  { text: 'Přehled', icon: <Dashboard />, path: '/' },
  { text: 'Kalendář', icon: <CalendarMonth />, path: '/planovani' },
  { text: 'Pacienti', icon: <People />, path: '/patients', requires: 'patients.view' },
  { text: 'Kluby a týmy', icon: <Groups />, path: '/clubs' },
  { text: 'Výsledky', icon: <Science />, path: '/diagnostics/new' },
  { text: 'Fakturace', icon: <Receipt />, path: '/billing', requires: 'billing.manage' },
  { text: 'Nastavení', icon: <Settings />, path: '/settings' },
] as MenuEntry[]).map((entry) => ({ ...entry, children: MENU_CHILDREN[entry.path] }));

/*
 * Settings destinations that draw the board's settings frame themselves
 * (SettingsScreen: breadcrumb + header), so the shell must not draw a second
 * way back above them. Everything else in the catalogue still gets the
 * one-line "Nastavení / Skupina" link.
 */
const SETTINGS_FRAMED = new Set<string>([
  '/admin', '/audit-log', '/activities', '/calendars', '/sluzby', '/nepritomnosti', '/exceptions',
  '/working-hours', '/nastaveni/vzhled-kalendare', '/nastaveni/souhlasy', '/pravidla-dokumentu',
  '/dokumenty-sablony', '/nastaveni/sablony-emailu', '/nastaveni/skupinove-slevy', '/svatky',
  '/nastaveni/udaje-pacienta', '/dotaznik-nastaveni', '/nastaveni/pripominky', '/nastaveni/zabezpeceni',
  '/staff-management', '/system-health',
]);

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

/** The phone drawer's width - the rail's open width. */
const SIDEBAR_WIDTH = RAIL_EXPANDED;

/** Is this address inside the settings - a catalogue destination, or /settings itself? */
function isSettingsRoute(pathname: string, settingsHere: ReturnType<typeof settingsItemAt>): boolean {
  return settingsHere !== null || pathname === '/settings' || pathname.startsWith('/settings/');
}

/*
 * "Where am I" - one quiet line at the top of every screen, so a click never
 * costs the sense of place: the rail's entry, then the screen inside it
 * (Pacienti › Karta pacienta › Termíny; Výsledky › Zranění; Nastavení ›
 * Služby a ceny › Ceník). The browser tab says the same, so ten open tabs are
 * tellable apart.
 */
function WhereAmI({
  pathname,
  patientId,
  settingsHere,
}: {
  pathname: string;
  patientId: string | null;
  settingsHere: ReturnType<typeof settingsItemAt>;
}) {
  const crumbs: { label: string; to?: string }[] = [];
  if (settingsHere !== null) {
    /* A settings screen in the board's frame draws its own breadcrumb; one line of place is enough. */
    if (SETTINGS_FRAMED.has(settingsHere.item.to)) return null;
    crumbs.push({ label: 'Nastavení', to: '/settings' }, { label: settingsHere.section.label }, { label: settingsHere.item.label });
  } else if (patientId !== null) {
    const section = PATIENT_SECTIONS.find((s) => sectionPath(patientId, s) === pathname);
    crumbs.push({ label: 'Pacienti', to: '/patients' }, { label: 'Karta pacienta', to: `/patients/${patientId}` });
    if (section && section.path !== '') crumbs.push({ label: section.label });
    if (pathname.endsWith('/edit')) crumbs.push({ label: 'Úprava karty' });
  } else if (pathname.startsWith('/kalendar/')) {
    crumbs.push({ label: 'Kalendář', to: '/planovani' }, { label: 'Termín' });
  } else {
    /* A child of one of the six first - its parent names the place. */
    let parent: MenuEntry | undefined;
    let child: MenuEntry | undefined;
    for (const entry of menuItems) {
      child = entry.children?.find((c) => c.path === pathname);
      if (child) { parent = entry; break; }
    }
    if (!parent) {
      parent = menuItems.find((i) => i.path === pathname)
        ?? menuItems.find((i) => i.path !== '/' && pathname.startsWith(i.path));
    }
    if (parent) crumbs.push({ label: parent.text, to: parent.path });
    if (child && child.text !== parent?.text) crumbs.push({ label: child.text });
  }
  const trail = crumbs.map((c) => c.label).join(' › ');

  useEffect(() => {
    const here = crumbs.length ? crumbs[crumbs.length - 1].label : 'SportMedical';
    document.title = `${here} · SportMedical`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail]);

  if (crumbs.length === 0) return null;
  return (
    <Box
      aria-label="Kde jsem"
      sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, fontSize: 13, color: 'text.secondary', flexWrap: 'wrap' }}
    >
      <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
      {crumbs.map((c, i) => (
        <Box key={i} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          {i > 0 && <Box component="span" sx={{ color: 'text.disabled' }}>›</Box>}
          {c.to && i < crumbs.length - 1 ? (
            <Box component={Link} to={c.to} sx={{ color: 'text.secondary', fontWeight: 600, '&:hover': { color: 'primary.main' } }}>{c.label}</Box>
          ) : (
            <Box component="span" sx={{ color: i === crumbs.length - 1 ? 'text.primary' : 'text.secondary', fontWeight: i === crumbs.length - 1 ? 700 : 600 }}>{c.label}</Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

/** The signed-in person, as stored at sign-in. Read once per shell, not once per render. */
function readUser(): { firstName?: string; lastName?: string; role?: string } {
  try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  /* The rail is where you are. It only ever folds into a drawer on a phone;
     on any laptop, whatever the zoom, it stays put - 76px at rest, 272px
     when the pointer, the keyboard or the pin is on it. */
  const narrow = useMediaQuery(theme.breakpoints.down('sm'));
  /* Reloaded from GET /api/v1/account on start, on focus and after any 403,
     so a permission the owner changed redraws this menu without a new sign-in. */
  useAccountRefresh();
  const held = new Set(usePermissions());
  /*
   * Inside a patient the rail becomes that patient's, and the application's
   * own menu steps aside. The owner's rule: while you are in somebody's file,
   * everything on screen is about them. On the board that is a sub-list
   * under "Pacienti": the file's sections, indented.
   *
   * Without patients.view the address is NotFound, and a patient's rail
   * around it would offer sections that are NotFound too.
   */
  const patientId = held.has('patients.view') ? patientInPath(location.pathname) : null;
  const settingsHere = settingsItemAt(location.pathname);
  /*
   * "In settings two sidebars next to each other is awful — only ONE, and it
   * is the settings one." On a settings route the rail's content is the
   * settings navigation, pinned open, because it is the only navigation there.
   */
  const settingsMode = isSettingsRoute(location.pathname, settingsHere);
  const rail = useRailState(settingsMode);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  /* A parent the person opened or shut by its chevron, on top of the default
     (open while it or one of its children is the screen). Forgotten on the
     next navigation, so the default rules again. */
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  const [settingsQuery, setSettingsQuery] = useState('');
  /* Where "Zpět do aplikace" goes: the last screen that was not a settings one. */
  const lastAppRoute = useRef('/planovani');
  const { accent, mode, setAccent, setMode } = useThemePrefs();
  const user = useMemo(readUser, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenOverrides({});
    if (!settingsMode) {
      lastAppRoute.current = `${location.pathname}${location.search}`;
      setSettingsQuery('');
    }
  }, [location.pathname, location.search, settingsMode]);

  const visibleMenu = useMemo(() => {
    const allowed = (entry: MenuEntry) => entry.requires === undefined || held.has(entry.requires);
    return menuItems
      .filter(allowed)
      .map((entry) => ({ ...entry, children: entry.children?.filter(allowed) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [[...held].sort().join(' ')]);

  const isActivePath = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const handleLogout = () => {
    setAnchorEl(null);
    void signOut();
  };

  const closeMobile = () => setMobileOpen(false);

  /*
   * The big button at the top of the rail. It always lands on the calendar;
   * the calendar reads `state.newAppointment` and opens the booking drawer on
   * the next free time, so the desk never has to find a slot first.
   */
  const newAppointment = () => {
    closeMobile();
    navigate('/planovani', { state: { newAppointment: Date.now() } });
  };

  const backToApp = () => {
    closeMobile();
    navigate(lastAppRoute.current);
  };

  const settingsSearch = useMemo(
    () => ({ query: settingsQuery, setQuery: setSettingsQuery, inRail: !narrow }),
    [settingsQuery, narrow],
  );

  /*
   * The rail's content, drawn for one width. `exp` is true when the rail is
   * open (272px) and in the phone's drawer, which is always open when it is
   * there at all; false is the 76px rail of icons with their labels under them.
   */
  const railContent = (exp: boolean) => {
    const brand = (
      <Box
        component={Link}
        to="/"
        onClick={closeMobile}
        aria-label="SportMedical — přehled"
        sx={{ display: 'flex', alignItems: 'center', height: 40, mb: 1.5, color: 'text.primary', textDecoration: 'none' }}
      >
        <IconCell>
          <Box
            sx={{
              width: 32, height: 32, borderRadius: 2, bgcolor: 'primary.main', color: '#FFF',
              display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, letterSpacing: '0.02em',
            }}
          >
            SM
          </Box>
        </IconCell>
        {exp && (
          <Typography sx={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            SportMedical
          </Typography>
        )}
      </Box>
    );

    const account = (
      <>
        <Divider sx={{ my: 1.25 }} />
        <Box sx={{ display: 'flex', flexDirection: exp ? 'row' : 'column', alignItems: 'center', gap: 0.5 }}>
          <ButtonBase
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-label="Účet a vzhled"
            sx={{
              flex: exp ? 1 : undefined,
              width: exp ? undefined : RAIL_ICON_COL,
              display: 'flex', alignItems: 'center', borderRadius: 2, py: 0.5, pr: exp ? 1 : 0,
              textAlign: 'left', minWidth: 0, '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <IconCell>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: '#FFF', fontSize: 13 }}>
                {user.firstName?.[0]}{user.lastName?.[0]}
              </Avatar>
            </IconCell>
            {exp && (
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Účet'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.role || ''}
                </Typography>
              </Box>
            )}
          </ButtonBase>
          <IconButton size="small" title="Hledat (Ctrl+K)" aria-label="Hledat"
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}>
            <Search fontSize="small" />
          </IconButton>
          <NotificationCenter />
        </Box>
        {exp && !narrow && !settingsMode && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
            <RailPin pinned={rail.pinned} onToggle={rail.togglePin} />
          </Box>
        )}
      </>
    );

    if (settingsMode) {
      return (
        <>
          <ListItemButton
            onClick={backToApp}
            sx={{ flex: '0 0 auto', borderRadius: 2, minHeight: 44, p: 0, pr: 1, mb: 0.5, color: 'text.secondary', fontSize: 14, fontWeight: 600 }}
          >
            <IconCell size={20}><ArrowBack /></IconCell>
            Zpět do aplikace
          </ListItemButton>
          {brand}
          <Divider sx={{ mb: 1.5 }} />
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', mx: -0.5, px: 0.5 }}>
            <SettingsNav plain query={settingsQuery} onQueryChange={setSettingsQuery} />
          </Box>
          {account}
        </>
      );
    }

    return (
      <>
        {brand}

        <Box sx={{ height: 46, mb: 2, display: 'flex', alignItems: 'center' }}>
          {exp ? (
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={newAppointment}
              startIcon={<Add />}
              sx={{ minHeight: 46, justifyContent: 'flex-start', pl: '18px', '& .MuiButton-startIcon': { ml: 0, mr: 1.5 } }}
            >
              Nová objednávka
            </Button>
          ) : (
            <Tooltip title="Nová objednávka" placement="right">
              <Button
                variant="contained"
                onClick={newAppointment}
                aria-label="Nová objednávka"
                sx={{ minWidth: 46, width: 46, height: 46, p: 0, mx: 'auto' }}
              >
                <Add />
              </Button>
            </Tooltip>
          )}
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', mx: -0.5, px: 0.5 }}>
          <List disablePadding>
            {visibleMenu.map((item) => {
              const active = isActivePath(item.path);
              const inPatients = item.path === '/patients' && patientId !== null;
              const kids = inPatients ? [] : (item.children ?? []);
              const childActive = kids.some((c) => isActivePath(c.path));
              const hasSublist = kids.length > 0 || inPatients;
              const open = exp && hasSublist && (openOverrides[item.path] ?? (active || childActive));
              return (
                <Box key={item.path}>
                  <RailRow
                    to={item.path}
                    label={item.text}
                    icon={item.icon}
                    active={active && !childActive && !inPatients}
                    expanded={exp}
                    onNavigate={closeMobile}
                    trailing={hasSublist ? (
                      <IconButton
                        size="small"
                        aria-label={open ? `Sbalit ${item.text}` : `Rozbalit ${item.text}`}
                        aria-expanded={open}
                        onClick={() => setOpenOverrides((o) => ({ ...o, [item.path]: !open }))}
                        sx={{ color: 'text.disabled' }}
                      >
                        {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                      </IconButton>
                    ) : undefined}
                  />
                  {hasSublist && (
                    <Collapse in={open} timeout={150} unmountOnExit>
                      <Box sx={{ mb: 0.75 }}>
                        {inPatients
                          ? PATIENT_SECTIONS.filter((section) => section.id !== 'faktury' || held.has('billing.manage')).map((section) => {
                              const to = sectionPath(patientId, section);
                              return (
                                <RailRow
                                  key={section.id}
                                  to={to}
                                  label={section.label}
                                  icon={section.icon}
                                  active={location.pathname === to}
                                  expanded
                                  indent
                                  onNavigate={closeMobile}
                                />
                              );
                            })
                          : kids.map((child) => (
                              <RailRow
                                key={child.path}
                                to={child.path}
                                label={child.text}
                                icon={child.icon}
                                active={isActivePath(child.path)}
                                expanded
                                indent
                                onNavigate={closeMobile}
                              />
                            ))}
                      </Box>
                    </Collapse>
                  )}
                </Box>
              );
            })}
          </List>
        </Box>

        {account}
      </>
    );
  };

  const accountMenu = (
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
  );

  return (
    <SettingsSearchContext.Provider value={settingsSearch}>
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
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', px: 1, pt: 1.5, pb: 1.25 }}>
              {railContent(true)}
            </Box>
          </Drawer>
        </>
      ) : (
        <Rail state={rail} label={settingsMode ? 'Nastavení' : 'Hlavní navigace'}>
          {railContent(rail.expanded)}
        </Rail>
      )}
      {accountMenu}

      <Box component="main" id="main-content" role="main" aria-label="Hlavní obsah"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 2, md: 3 },
          pt: { xs: '72px', md: 3 },
          minHeight: '100vh',
          /* The rail pushes the work area: this margin and the rail's width
             move together, 180ms, and nothing is covered. */
          ml: narrow ? 0 : `${rail.width}px`,
          transition: `margin-left ${RAIL_MOTION}`,
        }}
      >
        <WhereAmI pathname={location.pathname} patientId={patientId} settingsHere={settingsHere} />

        {/*
          * The way out of a settings screen is the rail itself now ("Zpět do
          * aplikace" and the settings nav), and a screen in the board's frame
          * (SettingsScreen) draws its own breadcrumb. A settings destination
          * that does not wear that frame yet still gets this one line, so no
          * screen is ever a dead end.
          */}
        {settingsHere !== null && !SETTINGS_FRAMED.has(settingsHere.item.to) && (
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

        {/*
          * No page transition. The framer-motion fade that was here (0.18s out
          * + 0.18s in, `mode="wait"`) cost 360ms on every click and remounted
          * the whole page tree by keying it on the pathname - so a patient's
          * layout was torn down between two of their own sections. Routes now
          * render at once, and a nested layout stays mounted across its children.
          */}
        {children}
      </Box>
    </Box>
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
                      <Route path="vysledky" element={<PatientResultsPage />} />
                      <Route path="faktury" element={<RequirePermission of="billing.manage"><PatientInvoicesPage /></RequirePermission>} />
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
