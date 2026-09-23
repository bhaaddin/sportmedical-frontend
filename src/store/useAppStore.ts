/* ══════════════════════════════════════════════════════════════
   GLOBAL APP STORE (Zustand + persist)
   The light/dark theme choice. Survives page refresh.
   ══════════════════════════════════════════════════════════════ */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppState {
  theme: ThemeMode;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'light' ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', next);
          return { theme: next };
        }),
    }),
    {
      name: 'sportmedical-app-store',
      /* Version 0 also saved sidebar, role, module, calendar and maintenance
         fields that nothing read. Migrating keeps the theme and drops them. */
      version: 1,
      migrate: (persisted) => ({
        theme: (persisted as { theme?: ThemeMode } | null)?.theme ?? 'light',
      }),
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);
