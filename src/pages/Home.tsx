/*
 * What `/` is for the signed-in person.
 *
 * The doctor's workspace for an account whose role is neither Owner nor
 * Administrator, and for anybody who chose "Lékařské rozhraní" in Můj účet;
 * the dashboard for everybody else. Decided from the role the server sent
 * with the sign-in and the workspace it sent with the account - both refreshed
 * with GET /api/v1/account - never from anything typed here.
 */
import { lazy, Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { opensDoctorWorkspace, usePreferences } from '../auth/preferences';

const DashboardPage = lazy(() => import('./Dashboard'));
const DoctorHomePage = lazy(() => import('./DoctorHome'));

function readRole(): string | null {
  try {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { role?: string };
    return user.role ?? null;
  } catch {
    return null;
  }
}

export default function Home() {
  const { workspace } = usePreferences();
  const doctor = opensDoctorWorkspace(readRole(), workspace);

  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress size={40} />
        </Box>
      }
    >
      {doctor ? <DoctorHomePage /> : <DashboardPage />}
    </Suspense>
  );
}
