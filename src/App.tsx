import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline, AppBar, Toolbar, Typography, Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Avatar, IconButton, Menu, MenuItem, Badge, CircularProgress, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import {   Science, Dashboard, People, PersonAdd, Settings, LocalHospital, Logout, Notifications, CalendarMonth, Receipt, MonitorHeart, AdminPanelSettings, Warning, Flag, Psychology, EventAvailable, Group, Search, AttachMoney, Schedule, EventBusy, Today } from '@mui/icons-material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, lazy, Suspense, useRef, useCallback } from 'react';
import theme from './theme';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import PatientDrawer from './components/PatientDrawer';
import { useAppStore } from './store/useAppStore';
import NetworkBanner from './components/NetworkBanner';
import { AccessibilityProvider } from './components/AccessibilityProvider';
import UniversalSearch from './components/UniversalSearch';
import NotificationCenter from './components/NotificationCenter';

/* ── Lazy-loaded routes (code-split per page) ── */
const NotFound = lazy(() => import('./pages/NotFound'));
const Login = lazy(() => import('./pages/Login'));
const IntakeQuestionnaire = lazy(() => import('./pages/public/IntakeQuestionnaire'));
const IntakeReviewQueue = lazy(() => import('./pages/IntakeReviewQueue'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const DiagnosticForm = lazy(() => import('./pages/DiagnosticForm'));
const PatientList = lazy(() => import('./pages/PatientList'));
const PatientDetails = lazy(() => import('./pages/PatientDetails'));
const Reports = lazy(() => import('./pages/Reports'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const BillingPage = lazy(() => import('./pages/Billing'));
const StaffPage = lazy(() => import('./pages/Staff'));
const InventoryPage = lazy(() => import('./pages/Inventory'));
const DocumentsPage = lazy(() => import('./pages/Documents'));
const MeasurementsPage = lazy(() => import('./pages/Measurements'));
const AdminPage = lazy(() => import('./pages/Admin'));
const CenikPage = lazy(() => import('./pages/Cenik'));
const PatientFormPage = lazy(() => import('./pages/PatientForm'));
const PatientRegistrationPage = lazy(() => import('./pages/PatientRegistration'));
const InjuriesPage = lazy(() => import('./pages/Injuries'));
const WellnessPage = lazy(() => import('./pages/Wellness'));
const RtpPage = lazy(() => import('./pages/Rtp'));
const PreParticipationPage = lazy(() => import('./pages/PreParticipation'));
const ConcussionPage = lazy(() => import('./pages/Concussion'));
const AvailabilityPage = lazy(() => import('./pages/Availability'));
const AiRiskPage = lazy(() => import('./pages/AiRisk'));
const WearablesPage = lazy(() => import('./pages/Wearables'));
const TeamsPage = lazy(() => import('./pages/Teams'));
const PosudekPage = lazy(() => import('./pages/Posudek'));
const TrainingLoadPage = lazy(() => import('./pages/TrainingLoad'));
const ClientIntakePage = lazy(() => import('./pages/ClientIntake'));
const CodebookPage = lazy(() => import('./pages/Codebook'));
const SystemHealthPage = lazy(() => import('./pages/SystemHealth'));
const StaffManagementPage = lazy(() => import('./pages/StaffManagement'));
const EmailTemplatesPage = lazy(() => import('./pages/EmailTemplates'));
const AuditLogPage = lazy(() => import('./pages/AuditLog'));
const GdprPage = lazy(() => import('./pages/GdprPage'));
const PatientImportPage = lazy(() => import('./pages/PatientImport'));
const DataExportPage = lazy(() => import('./pages/DataExport'));
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettings'));
const BackupRestorePage = lazy(() => import('./pages/BackupRestore'));
const LicenseManagementPage = lazy(() => import('./pages/LicenseManagement'));
const CustomFieldsPage = lazy(() => import('./pages/CustomFields'));
const WorkflowAutomationPage = lazy(() => import('./pages/WorkflowAutomation'));
const ReportSchedulingPage = lazy(() => import('./pages/ReportScheduling'));
const MultiClinicPage = lazy(() => import('./pages/MultiClinic'));
const ApiKeysPage = lazy(() => import('./pages/ApiKeys'));
const PatientRecordsPage = lazy(() => import('./pages/PatientRecords'));
const WorkerSchedulePage = lazy(() => import('./pages/admin/WorkerScheduleSettings'));
/* Booking phase 1, stage 1: calendars, access and activities */
const BookingCalendarsPage = lazy(() => import('./pages/booking/CalendarsPage'));
const BookingActivitiesPage = lazy(() => import('./pages/booking/ActivitiesPage'));
/* Booking phase 1, stage 2: working hours, periods, cycle and exceptions */
const BookingWorkingHoursPage = lazy(() => import('./pages/booking/WorkingHoursPage'));
const BookingExceptionsPage = lazy(() => import('./pages/booking/ExceptionsPage'));
/* Booking phase 1, stage 3: the calendar grid */
const BookingGridPage = lazy(() => import('./pages/booking/CalendarGridPage'));
/* Booking phase 1, stage 4: the appointment detail and the day at a glance */
const BookingDayOverviewPage = lazy(() => import('./pages/booking/DayOverviewPage'));
/* Booking phase 1, stage 5: partner reservations */
const BookingPartnerOrdersPage = lazy(() => import('./pages/booking/PartnerOrdersPage'));
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

const queryClient = new QueryClient();
const DRAWER_WIDTH = 240;

/* ── Grouped sidebar menu ── */
interface MenuItemGroup {
  label: string;
  adminOnly?: boolean;
  items: { text: string; icon: React.ReactNode; path: string; adminOnly?: boolean }[];
}

export function isAdminRole(role?: string): boolean {
  return ['Owner', 'Administrator', 'Admin', 'SuperAdmin'].includes(role ?? '');
}

export function currentUserRole(): string {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').role ?? '';
  } catch {
    return '';
  }
}

const menuGroups: MenuItemGroup[] = [
  {
    label: '',
    items: [
      { text: 'Přehled', icon: <Dashboard />, path: '/' },
    ],
  },
  {
    label: '',
    items: [
      { text: 'Pacienti', icon: <People />, path: '/patients' },
      { text: 'Kalendář', icon: <CalendarMonth />, path: '/calendar' },
      { text: 'Diagnostika', icon: <Science />, path: '/diagnostics/new' },
      { text: 'Fakturace', icon: <Receipt />, path: '/billing' },
      { text: 'Pokladna', icon: <AttachMoney />, path: '/cashier' },
      { text: 'GDPR', icon: <Warning />, path: '/gdpr' },
    ],
  },
  {
    label: 'Tým a rezervace',
    items: [
      { text: 'Plánování', icon: <CalendarMonth />, path: '/planovani' },
      { text: 'Dnešní přehled', icon: <Today />, path: '/dnes' },
      { text: 'Vyhrazení', icon: <Group />, path: '/vyhrazeni' },
      { text: 'Můj rozvrh', icon: <CalendarMonth />, path: '/worker-schedule' },
      { text: 'Kluby', icon: <Group />, path: '/clubs' },
      { text: 'Účetní export', icon: <Receipt />, path: '/accounting-export', adminOnly: true },
      { text: 'Tým', icon: <Group />, path: '/staff-management', adminOnly: true },
    ],
  },
  {
    label: '',
    adminOnly: true,
    items: [
      { text: 'Kalendáře', icon: <CalendarMonth />, path: '/calendars' },
      { text: 'Činnosti', icon: <EventAvailable />, path: '/activities' },
      { text: 'Pracovní doba', icon: <Schedule />, path: '/working-hours' },
      { text: 'Výjimky', icon: <EventBusy />, path: '/exceptions' },
      { text: 'Administrace', icon: <AdminPanelSettings />, path: '/admin' },
      { text: 'Nastavení', icon: <Settings />, path: '/settings' },
    ],
  },
];

function RequireAdmin({ children }: { children: React.ReactNode }) {
  if (!isAdminRole(currentUserRole())) {
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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeMode = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
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
          <IconButton color="inherit" onClick={toggleTheme} sx={{ mr: 1 }} title="Toggle theme">
            {themeMode === 'light' ? '🌙' : '☀️'}
          </IconButton>
          <Button color="inherit" size="small" onClick={() => i18n.changeLanguage(i18n.language === 'cs' ? 'en' : i18n.language === 'en' ? 'sk' : 'cs')}
            sx={{ mr: 1, minWidth: 0, px: 1, fontSize: 12, textTransform: 'uppercase' }}>
            {i18n.language === 'cs' ? 'CZ' : i18n.language === 'en' ? 'EN' : 'SK'}
          </Button>
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
          {menuGroups
            .filter(group => !group.adminOnly || isAdminRole(currentUserRole()))
            .map((group, gi) => (
            <Box key={gi}>
              {group.label && sidebarOpen && (
                <Typography variant="caption" sx={{ px: 2, pt: gi > 0 ? 2 : 0, pb: 0.5, display: 'block', fontWeight: 700, color: '#999', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {group.label}
                </Typography>
              )}
              {group.label && !sidebarOpen && gi > 0 && (
                <Box sx={{ mx: 1.5, my: 1, borderTop: '1px solid #e0e0e0' }} />
              )}
              {group.items
                .filter(item => !item.adminOnly || isAdminRole(currentUserRole()))
                .map((item) => {
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
                        <ListItemText primary={item.text} primaryTypographyProps={{
                          sx: { fontWeight: isActive ? 600 : 400, fontSize: 14, whiteSpace: 'nowrap' },
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
  return (
    <GlobalErrorBoundary>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AccessibilityProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
            <Route path="/dotaznik" element={<Suspense fallback={<PageLoader />}><IntakeQuestionnaire /></Suspense>} />
            <Route path="/*" element={
              <AuthGuard>
                <Layout>
                  <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/patients" element={<PatientList />} />
                    <Route path="/patients/register" element={<PatientRegistrationPage />} />
                    <Route path="/patients/:id/edit" element={<PatientFormPage />} />
                    <Route path="/patients/:id" element={<PatientDetails />} />
                    <Route path="/measurements" element={<MeasurementsPage />} />
                    <Route path="/diagnostics/new" element={<DiagnosticForm />} />
                    <Route path="/documents" element={<DocumentsPage />} />
                    <Route path="/billing" element={<BillingPage />} />
                    <Route path="/cenik" element={<CenikPage />} />
                    <Route path="/injuries" element={<InjuriesPage />} />
                    <Route path="/rtp" element={<RtpPage />} />
                    <Route path="/ppe" element={<PreParticipationPage />} />
                    <Route path="/concussion" element={<ConcussionPage />} />
                    <Route path="/availability" element={<AvailabilityPage />} />
                    <Route path="/training-load" element={<TrainingLoadPage />} />
                    <Route path="/wellness" element={<WellnessPage />} />
                    <Route path="/ai-risk" element={<AiRiskPage />} />
                    <Route path="/wearables" element={<WearablesPage />} />
                    <Route path="/teams" element={<TeamsPage />} />
                    <Route path="/posudek" element={<PosudekPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/staff" element={<StaffPage />} />
                    <Route path="/cashier" element={<CashierPage />} />
                    <Route path="/clubs" element={<ClubsPage />} />
                    <Route path="/accounting-export" element={<RequireAdmin><AccountingExportPage /></RequireAdmin>} />
                    <Route path="/worker-schedule" element={<WorkerSchedulePage />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/intake-review" element={<RequireAdmin><IntakeReviewQueue /></RequireAdmin>} />
                    <Route path="/planovani" element={<BookingGridPage />} />
                    <Route path="/dnes" element={<BookingDayOverviewPage />} />
                    <Route path="/vyhrazeni" element={<BookingPartnerOrdersPage />} />
                    <Route path="/calendars" element={<RequireAdmin><BookingCalendarsPage /></RequireAdmin>} />
                    <Route path="/activities" element={<RequireAdmin><BookingActivitiesPage /></RequireAdmin>} />
                    <Route path="/working-hours" element={<RequireAdmin><BookingWorkingHoursPage /></RequireAdmin>} />
                    <Route path="/exceptions" element={<RequireAdmin><BookingExceptionsPage /></RequireAdmin>} />
                    <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
                    <Route path="/codebook" element={<CodebookPage />} />
                    <Route path="/system-health" element={<SystemHealthPage />} />
                    <Route path="/staff-management" element={<RequireAdmin><StaffManagementPage /></RequireAdmin>} />
                    <Route path="/email-templates" element={<EmailTemplatesPage />} />
                    <Route path="/audit-log" element={<AuditLogPage />} />
                    <Route path="/patient-import" element={<PatientImportPage />} />
                    <Route path="/data-export" element={<DataExportPage />} />
                    <Route path="/notification-settings" element={<NotificationSettingsPage />} />
                    <Route path="/backup-restore" element={<BackupRestorePage />} />
                    <Route path="/license-management" element={<LicenseManagementPage />} />
                    <Route path="/custom-fields" element={<CustomFieldsPage />} />
                    <Route path="/workflow-automation" element={<WorkflowAutomationPage />} />
                    <Route path="/report-scheduling" element={<ReportSchedulingPage />} />
                    <Route path="/multi-clinic" element={<MultiClinicPage />} />
                    <Route path="/api-keys" element={<ApiKeysPage />} />
                    <Route path="/patient-records/:id" element={<PatientRecordsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/client-intake" element={<ClientIntakePage />} />
                    <Route path="/gdpr" element={<GdprPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  </Suspense>
                </Layout>
              </AuthGuard>
            } />
          </Routes>
          <PatientDrawer />
          <UniversalSearch />
          <NetworkBanner />
          <Toaster position="top-right" />
        </BrowserRouter>
      </QueryClientProvider>
      </AccessibilityProvider>
    </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
