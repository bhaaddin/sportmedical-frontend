import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import { Toaster } from 'react-hot-toast';
import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { loginUrl } from './components/shell/loginRedirect';
import { PageLoader, StaffShellPlaceholder } from './components/shell/PageLoader';
import { buildTheme, type ThemeMode } from './theme';
import {
  ThemePrefsContext,
  readStoredAccent,
  readStoredMode,
  ACCENT_STORAGE_KEY,
  MODE_STORAGE_KEY,
} from './themePrefs';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import { KeyboardShortcuts } from './components/KeyboardShortcuts';
import NetworkBanner from './components/NetworkBanner';
import { startPrefetching } from './prefetchRoutes';

/* ── Lazy-loaded routes (code-split per page) ── */
/* The signed-in staff portal (shell + menu + every staff screen) is one chunk behind the sign-in guard. */
const StaffApp = lazy(() => import('./StaffApp'));
const Login = lazy(() => import('./pages/Login'));
const IntakeQuestionnaire = lazy(() => import('./pages/public/IntakeQuestionnaire'));
const PublicBooking = lazy(() => import('./pages/public/PublicBooking'));
const ManageBooking = lazy(() => import('./pages/public/ManageBooking'));
const PatientPortal = lazy(() => import('./pages/public/PatientPortal'));
const PatientSignIn = lazy(() => import('./pages/public/PatientSignIn'));
const ClubRegistration = lazy(() => import('./pages/public/ClubRegistration'));
const ClubOrderForm = lazy(() => import('./pages/public/ClubOrderForm'));
const FeedbackPage = lazy(() => import('./pages/public/FeedbackPage'));


/** Fetches the next likely screen's script in idle time and when a link is pointed at (src/prefetchRoutes.ts). Draws nothing. */
function Prefetcher() {
  const { pathname } = useLocation();
  useEffect(() => (import.meta.env.MODE === 'test' ? undefined : startPrefetching(pathname)), [pathname]);
  return null;
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
            <Route path="/klub-objednavka/:token" element={<Suspense fallback={<PageLoader />}><ClubOrderForm /></Suspense>} />
            <Route path="/hodnoceni/:token" element={<Suspense fallback={<PageLoader />}><FeedbackPage /></Suspense>} />
            {/* Patient portal. Anonymous like the links above: the personal access
                token IS the identity, resolving to one patient's own dashboard. */}
            <Route path="/portal/prihlaseni" element={<Suspense fallback={<PageLoader />}><PatientSignIn /></Suspense>} />
            <Route path="/portal/:token" element={<Suspense fallback={<PageLoader />}><PatientPortal /></Suspense>} />
            <Route path="/portal" element={<Suspense fallback={<PageLoader />}><PatientPortal /></Suspense>} />
            <Route path="/*" element={
              <AuthGuard>
                <Suspense fallback={<StaffShellPlaceholder />}>
                  <StaffApp />
                </Suspense>
              </AuthGuard>
            } />
          </Routes>
          <Prefetcher />
          <NetworkBanner />
          <Toaster position="top-right" />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
    </ThemePrefsContext.Provider>
    </GlobalErrorBoundary>
  );
}
