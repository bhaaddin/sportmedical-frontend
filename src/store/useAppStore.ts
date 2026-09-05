/* ══════════════════════════════════════════════════════════════
   GLOBAL APP STORE (Zustand + persist)
   Replaces scattered localStorage reads for theme, sidebar,
   user role, and active module. Survives page refresh.
   ══════════════════════════════════════════════════════════════ */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type UserRole = 'SuperAdmin' | 'Admin' | 'Doctor' | 'Nurse' | 'Receptionist' | 'HeadPhysician';
export type AppModule = 'Calendar' | 'Billing' | 'Patients' | 'Settings' | 'Diagnostics' | 'Admin' | 'Reports' | 'Codebook' | 'Staff' | 'Inventory';

interface AppState {
  /* ── Theme ── */
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (t: ThemeMode) => void;

  /* ── Sidebar ── */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  /* ── User ── */
  currentUserRole: UserRole;
  currentUserName: string;
  currentUserEmail: string;
  setUser: (role: UserRole, name: string, email: string) => void;

  /* ── Active Module ── */
  activeModule: AppModule;
  setActiveModule: (m: AppModule) => void;

  /* ── Drawer (Patient context panel) ── */
  drawerOpen: boolean;
  drawerPatientId: string | null;
  openDrawer: (patientId: string) => void;
  closeDrawer: () => void;

  /* ── Pending diagnosis (drag-to-assign from Codebook) ── */
  pendingDiagnosis: { code: string; description: string } | null;
  setPendingDiagnosis: (d: { code: string; description: string } | null) => void;
  clearPendingDiagnosis: () => void;

  /* ── Calendar View State ── */
  calendarDate: string; // ISO date string (YYYY-MM-DD)
  setCalendarDate: (d: string) => void;
  calendarZoom: 'day' | 'week' | 'month';
  setCalendarZoom: (z: 'day' | 'week' | 'month') => void;

  /* ── Global Search ── */
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;

  /* ── System Maintenance ── */
  maintenanceMode: boolean;
  setMaintenanceMode: (v: boolean) => void;

  /* ── System Clock (synced across components) ── */
  systemClock: string;
  updateClock: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      /* ── Theme ── */
      theme: 'light',
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'light' ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', next);
          return { theme: next };
        }),
      setTheme: (t) => {
        document.documentElement.setAttribute('data-theme', t);
        set({ theme: t });
      },

      /* ── Sidebar ── */
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      /* ── User ── */
      currentUserRole: 'Admin',
      currentUserName: '',
      currentUserEmail: '',
      setUser: (role, name, email) => set({ currentUserRole: role, currentUserName: name, currentUserEmail: email }),

      /* ── Active Module ── */
      activeModule: 'Calendar',
      setActiveModule: (m) => set({ activeModule: m }),

      /* ── Drawer ── */
      drawerOpen: false,
      drawerPatientId: null,
      openDrawer: (patientId) => set({ drawerOpen: true, drawerPatientId: patientId }),
      closeDrawer: () => set({ drawerOpen: false, drawerPatientId: null }),

      /* ── Pending diagnosis ── */
      pendingDiagnosis: null,
      setPendingDiagnosis: (d) => set({ pendingDiagnosis: d }),
      clearPendingDiagnosis: () => set({ pendingDiagnosis: null }),

      /* ── Calendar View State ── */
      calendarDate: new Date().toISOString().split('T')[0],
      setCalendarDate: (d) => set({ calendarDate: d }),
      calendarZoom: 'week',
      setCalendarZoom: (z) => set({ calendarZoom: z }),

      /* ── Global Search ── */
      globalSearchQuery: '',
      setGlobalSearchQuery: (q) => set({ globalSearchQuery: q }),

      /* ── System Maintenance ── */
      maintenanceMode: false,
      setMaintenanceMode: (v) => set({ maintenanceMode: v }),

      /* ── System Clock ── */
      systemClock: new Date().toLocaleTimeString('cs-CZ'),
      updateClock: () => set({ systemClock: new Date().toLocaleTimeString('cs-CZ') }),
    }),
    {
      name: 'sportmedical-app-store',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        currentUserRole: state.currentUserRole,
        activeModule: state.activeModule,
        calendarDate: state.calendarDate,
        calendarZoom: state.calendarZoom,
        maintenanceMode: state.maintenanceMode,
      }),
    },
  ),
);
