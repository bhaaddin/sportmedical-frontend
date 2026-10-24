/* ══════════════════════════════════════════════════════════════
   404 NOT FOUND PAGE (route `*`, also what a screen without the permission answers)

   A shelf page like every other (docs/ui-shelf-system.md): the header says what happened and offers the way back - a real
   link to the overview ("/prehled"), so it also works in a new tab - and "Kam dál" offers the few places people usually
   want instead, plus what this person opened last. Nothing here asks the server for anything.
   ══════════════════════════════════════════════════════════════ */
import { Box, Button } from '@mui/material';
import { ArrowBack, CalendarMonth, Groups, Home, Search, Today } from '@mui/icons-material';
import { openUniversalSearch } from '../components/UniversalSearch';
import { usePermission } from '../auth/usePermission';
import { ActionCard, PageFrame, RecentAndPinned, Shelf, TARGET_SX } from '../ui/shelf';

export default function NotFound() {
  const maySeePatients = usePermission('patients.view');
  return (
    <PageFrame
      title="Stránka nenalezena"
      purpose="Požadovaná stránka neexistuje nebo byla přesunuta."
      primaryAction={{ label: 'Zpět na přehled', icon: <Home />, to: '/prehled' }}
      actions={
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => window.history.back()} sx={TARGET_SX}>
          Zpět
        </Button>
      }
    >
      <Box data-layout="not-found" sx={{ display: 'contents' }}>
        <Shelf id="next" title="Kam dál" layout="grid" minCardWidth={220} stagger={false}>
          <ActionCard primary icon={<Search />} title="Hledat" description="Pacienta, klub, fakturu i stránku (Ctrl K)" onClick={openUniversalSearch} />
          <ActionCard icon={<Today />} title="Dnešní přehled" description="Čekárna, zpoždění a den po kalendářích" to="/dnes" />
          <ActionCard icon={<CalendarMonth />} title="Kalendář" description="Plánování a objednávky" to="/planovani" />
          {maySeePatients && <ActionCard icon={<Groups />} title="Pacienti" description="Kartotéka kliniky" to="/patients" />}
        </Shelf>
        <RecentAndPinned dense hideWhenEmpty limit={6} title="Naposledy otevřené" hint="Kam jste se naposledy vraceli" />
      </Box>
    </PageFrame>
  );
}
