import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
}

interface Breadcrumb {
  label: string;
  path?: string;
}

interface UIState {
  sidebarCollapsed: boolean;
  sidebarHovered: boolean;
  toggleSidebar: () => void;
  setSidebarHovered: (hovered: boolean) => void;

  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  modals: Record<string, boolean>;
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
  toggleModal: (id: string) => void;

  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  loadingStates: Record<string, boolean>;
  setLoading: (key: string, loading: boolean) => void;
  isLoading: (key: string) => boolean;

  searchOpen: boolean;
  searchQuery: string;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;

  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (breadcrumbs: Breadcrumb[]) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      sidebarHovered: false,
      toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarHovered: (hovered) => set({ sidebarHovered: hovered }),

      theme: 'system',
      setTheme: (theme) => {
        set({ theme });
        if (theme === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else if (theme === 'light') {
          document.documentElement.removeAttribute('data-theme');
        } else {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
          } else {
            document.documentElement.removeAttribute('data-theme');
          }
        }
      },

      modals: {},
      openModal: (id) => set(state => ({ modals: { ...state.modals, [id]: true } })),
      closeModal: (id) => set(state => ({ modals: { ...state.modals, [id]: false } })),
      toggleModal: (id) => set(state => ({ modals: { ...state.modals, [id]: !state.modals[id] } })),

      notifications: [],
      addNotification: (notification) => set(state => ({
        notifications: [notification, ...state.notifications],
      })),
      removeNotification: (id) => set(state => ({
        notifications: state.notifications.filter(n => n.id !== id),
      })),
      clearNotifications: () => set({ notifications: [] }),

      loadingStates: {},
      setLoading: (key, loading) => set(state => ({
        loadingStates: { ...state.loadingStates, [key]: loading },
      })),
      isLoading: (key) => get().loadingStates[key] || false,

      searchOpen: false,
      searchQuery: '',
      setSearchOpen: (open) => set({ searchOpen: open }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      toasts: [],
      addToast: (toast) => set(state => ({
        toasts: [...state.toasts, { ...toast, id: Date.now().toString() }],
      })),
      removeToast: (id) => set(state => ({
        toasts: state.toasts.filter(t => t.id !== id),
      })),

      breadcrumbs: [],
      setBreadcrumbs: (breadcrumbs) => set({ breadcrumbs }),
    }),
    {
      name: 'ui-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);
