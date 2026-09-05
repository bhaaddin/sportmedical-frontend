/* ══════════════════════════════════════════════════════════════
   APP SHELL — Zone A/B/C/D Layout Architecture
   Zone A: Sticky header (glassmorphism, 64px)
   Zone B: Left sidebar (260px / 64px collapsed)
   Zone C: Main viewport (flexible, scrollable)
   Zone D: Slide-over drawer (420px, non-modal)
   ══════════════════════════════════════════════════════════════ */
import { type ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Science, Dashboard, People, Assessment, Settings, LocalHospital,
  Logout, Notifications, CalendarMonth, Receipt, Inventory2, Description,
  MonitorHeart, AdminPanelSettings, AttachMoney, Warning, FitnessCenter,
  Flag, MedicalServices, Psychology, EventAvailable, Watch, Group, Book,
  Menu, ChevronLeft, Search, Moon, Sun, KeyboardArrowDown, Schedule,
} from '@mui/icons-material';
import { useAppStore } from '../store/useAppStore';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

/* ── Navigation items ── */
const menuItems = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/' },
  { text: 'Kalendář', icon: <CalendarMonth />, path: '/calendar' },
  { text: 'Pacienti', icon: <People />, path: '/patients' },
  { text: 'Měření', icon: <MonitorHeart />, path: '/measurements' },
  { text: 'Diagnostics', icon: <Science />, path: '/diagnostics/new' },
  { text: 'Dokumenty', icon: <Description />, path: '/documents' },
  { text: 'Fakturace', icon: <Receipt />, path: '/billing' },
  { text: 'Ceník', icon: <AttachMoney />, path: '/cenik' },
  { text: 'Poranění', icon: <Warning />, path: '/injuries' },
  { text: 'Návrat do hry', icon: <Flag />, path: '/rtp' },
  { text: 'PPE Prohlídka', icon: <MedicalServices />, path: '/ppe' },
  { text: 'Otřes mozku', icon: <Psychology />, path: '/concussion' },
  { text: 'Dostupnost', icon: <EventAvailable />, path: '/availability' },
  { text: 'Tréninkové zatížení', icon: <FitnessCenter />, path: '/training-load' },
  { text: 'Wellness', icon: <FitnessCenter />, path: '/wellness' },
  { text: 'AI Riziko', icon: <Psychology />, path: '/ai-risk' },
  { text: 'Wearables', icon: <Watch />, path: '/wearables' },
  { text: 'Týmy', icon: <Group />, path: '/teams' },
  { text: 'Posudky', icon: <Description />, path: '/posudek' },
  { text: 'Sklad', icon: <Inventory2 />, path: '/inventory' },
  { text: 'Zaměstnanci', icon: <People />, path: '/staff' },
  { text: 'Rezervace (admin)', icon: <CalendarMonth />, path: '/booking-management' },
  { text: 'Rozvrh pracovníků', icon: <Schedule />, path: '/worker-schedule' },
  { text: 'Reporty', icon: <Assessment />, path: '/reports' },
  { text: 'Číselník (ICD-10)', icon: <Book />, path: '/codebook' },
  { text: 'Monitoring', icon: <MonitorHeart />, path: '/system-health' },
  { text: 'Administrace', icon: <AdminPanelSettings />, path: '/admin' },
  { text: 'Nastavení', icon: <Settings />, path: '/settings' },
];

/* ══════════════════════════════════════════════════════════════
   ZONE A — HEADER (Sticky, Glassmorphism, 64px)
   ══════════════════════════════════════════════════════════════ */
interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  onToggleTheme: () => void;
  themeMode: 'light' | 'dark';
}

function Header({ onToggleSidebar, sidebarCollapsed, onToggleTheme, themeMode }: HeaderProps) {
  const [clock, setClock] = useState(format(new Date(), 'HH:mm:ss', { locale: cs }));
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  /* Live system clock — updates every second */
  useEffect(() => {
    const id = setInterval(() => setClock(format(new Date(), 'HH:mm:ss', { locale: cs })), 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <header className="app-shell__header" role="banner">
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="btn btn--ghost"
        style={{ minWidth: 36, minHeight: 36, padding: 4 }}
        aria-label={sidebarCollapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel'}
        data-tooltip={sidebarCollapsed ? 'Rozbalit' : 'Sbalit'}
      >
        {sidebarCollapsed ? <Menu /> : <ChevronLeft />}
      </button>

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LocalHospital sx={{ color: 'var(--color-primary)', fontSize: 28 }} />
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text-primary)' }}>
          SportMedical
        </span>
      </div>

      {/* Global search bar */}
      <div className="search-input" style={{ flex: '0 1 360px', marginLeft: 'auto' }}>
        <Search sx={{ fontSize: 18, color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          placeholder="Hledat pacienty, kódy, faktury..."
          aria-label="Globální vyhledávání"
        />
        <kbd style={{
          fontSize: 11, padding: '1px 5px', borderRadius: 4,
          border: '1px solid var(--color-border)', color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-family)',
        }}>
          Ctrl+K
        </kbd>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* System clock — tabular nums for perfect alignment */}
      <div
        className="tabular-nums"
        style={{
          fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
        }}
        aria-label={`Aktuální čas: ${clock}`}
      >
        {clock}
      </div>

      {/* Theme toggle */}
      <button
        onClick={onToggleTheme}
        className="btn btn--ghost"
        style={{ minWidth: 36, minHeight: 36, padding: 4 }}
        aria-label={themeMode === 'light' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim'}
        data-tooltip={themeMode === 'light' ? 'Tmavý režim' : 'Světlý režim'}
      >
        {themeMode === 'light' ? <Moon sx={{ fontSize: 20 }} /> : <Sun sx={{ fontSize: 20 }} />}
      </button>

      {/* Notifications */}
      <button
        className="btn btn--ghost"
        style={{ minWidth: 36, minHeight: 36, padding: 4, position: 'relative' }}
        aria-label="Notifikace"
        data-tooltip="Notifikace"
      >
        <Notifications sx={{ fontSize: 20 }} />
        <span style={{
          position: 'absolute', top: 4, right: 4, width: 8, height: 8,
          borderRadius: '50%', background: 'var(--color-critical)',
          border: '2px solid var(--color-bg-paper)',
        }} />
      </button>

      {/* User avatar + menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}
          className="btn btn--ghost"
          style={{
            minWidth: 40, minHeight: 40, padding: 0, borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}
          aria-label="Uživatelský menu"
          aria-expanded={!!anchorEl}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--color-primary)', color: 'var(--contrast-text-on-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700,
          }}>
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <KeyboardArrowDown sx={{ fontSize: 16, ml: 0.5 }} />
        </button>

        {/* Dropdown */}
        {anchorEl && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 999 }}
              onClick={() => setAnchorEl(null)}
            />
            <div className="dropdown" style={{ top: '100%', right: 0, marginTop: 8, zIndex: 1000 }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {user.firstName} {user.lastName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {user.email}
                </div>
              </div>
              <button className="dropdown__item" onClick={() => { setAnchorEl(null); window.location.href = '/settings'; }}>
                <Settings sx={{ fontSize: 18 }} /> Nastavení
              </button>
              <div className="dropdown__separator" />
              <button className="dropdown__item" onClick={handleLogout} style={{ color: 'var(--color-critical)' }}>
                <Logout sx={{ fontSize: 18 }} /> Odhlásit se
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════
   ZONE B — SIDEBAR (260px / 64px collapsed, icon-only mode)
   ══════════════════════════════════════════════════════════════ */
interface SidebarProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

function Sidebar({ collapsed, onNavigate }: SidebarProps) {
  const location = useLocation();

  return (
    <nav
      className={`app-shell__sidebar ${collapsed ? 'app-shell__sidebar--collapsed' : ''}`}
      role="navigation"
      aria-label="Hlavní navigace"
    >
      <div style={{ padding: collapsed ? '8px 4px' : '8px 12px' }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`sidebar-item ${isActive ? 'sidebar-item--active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: collapsed ? 0 : 12,
                padding: collapsed ? '10px 0' : '10px 12px',
                borderRadius: 'var(--radius-md)',
                marginBottom: 2,
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                transition: 'all var(--transition-fast)',
                justifyContent: collapsed ? 'center' : 'flex-start',
                position: 'relative',
                minHeight: 38,
              }}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.text : undefined}
              data-tooltip={collapsed ? item.text : undefined}
            >
              {isActive && (
                <div style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 20, borderRadius: '0 2px 2px 0',
                  background: 'var(--color-primary)',
                }} />
              )}
              <span style={{ minWidth: 20, display: 'flex', justifyContent: 'center' }}>
                {item.icon}
              </span>
              {!collapsed && (
                <span className="sidebar-label" style={{ whiteSpace: 'nowrap' }}>
                  {item.text}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════════════
   ZONE D — SLIDE-OVER DRAWER (420px, non-modal)
   ══════════════════════════════════════════════════════════════ */
interface DrawerOverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

function DrawerOverlay({ open, onClose, children, width = 420 }: DrawerOverlayProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <div
      className={`app-shell__drawer-overlay ${open ? 'app-shell__drawer-overlay--open' : ''}`}
      aria-hidden={!open}
    >
      {/* Backdrop (click to close) */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: open ? 'rgba(0,0,0,0.2)' : 'transparent',
          transition: 'background var(--transition-normal)',
          pointerEvents: open ? 'auto' : 'none',
        }}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`app-shell__drawer ${open ? 'app-shell__drawer--open' : ''}`}
        style={{ width }}
        role="dialog"
        aria-label="Kontextový panel"
      >
        {children}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   APP SHELL — Main Export
   ══════════════════════════════════════════════════════════════ */
interface AppShellProps {
  children: ReactNode;
  drawer?: ReactNode;
  drawerOpen?: boolean;
  onDrawerClose?: () => void;
  drawerWidth?: number;
}

export default function AppShell({ children, drawer, drawerOpen = false, onDrawerClose, drawerWidth = 420 }: AppShellProps) {
  const themeMode = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  const handleSidebarNav = useCallback(() => {
    /* Optional: auto-collapse sidebar on mobile after navigation */
  }, []);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Přeskočit na hlavní obsah
      </a>

      <div className={`app-shell ${sidebarCollapsed ? 'app-shell--sidebar-collapsed' : ''}`}>
        {/* Zone A: Header */}
        <Header
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          onToggleTheme={toggleTheme}
          themeMode={themeMode}
        />

        {/* Zone B: Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} onNavigate={handleSidebarNav} />

        {/* Zone C: Main Viewport */}
        <main
          id="main-content"
          className="app-shell__main"
          role="main"
          aria-label="Hlavní obsah"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>

      {/* Zone D: Slide-Over Drawer */}
      <DrawerOverlay open={drawerOpen} onClose={onDrawerClose || (() => {})} width={drawerWidth}>
        {drawer}
      </DrawerOverlay>
    </>
  );
}

/* Re-export sub-components for direct use */
export { Header, Sidebar, DrawerOverlay };
