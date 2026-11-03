/*
 * The routes of "Pohybová analýza", one lazy chunk: the shell mounts `/pohyb/*` only while the flag is on (StaffApp), and
 * every page below is loaded when it is first opened.
 */
import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { usePermission } from '../auth/usePermission';
import NotFound from '../pages/NotFound';

const HomePage = lazy(() => import('./pages/HomePage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const ClipPage = lazy(() => import('./pages/ClipPage'));
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

function Admin() {
  return usePermission('settings.clinic.manage') ? <AdminPage /> : <NotFound />;
}
function Staff({ children }: { children: React.ReactNode }) {
  return usePermission('patients.view') ? <>{children}</> : <NotFound />;
}

export default function MovementRoutes() {
  return (
    <Routes>
      <Route index element={<Staff><HomePage /></Staff>} />
      <Route path="nahrat" element={<Staff><UploadPage /></Staff>} />
      <Route path="klip/:clipId" element={<Staff><ClipPage /></Staff>} />
      <Route path="pacient/:patientId" element={<Staff><TimelinePage /></Staff>} />
      <Route path="spravce" element={<Admin />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
