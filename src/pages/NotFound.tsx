/* ══════════════════════════════════════════════════════════════
   404 NOT FOUND PAGE

   One centred card on every width; the way back is a 44 px button that is a
   real link to the overview ("/"), so it also works when opened in a new tab.
   ══════════════════════════════════════════════════════════════ */
import { Box, Typography, Button, Stack } from '@mui/material';
import { Home, ArrowBack } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { SectionLabel, SoftCard } from '../components/ui';

export default function NotFound() {
  return (
    <Box sx={{
      minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: { xs: 0, sm: 2 },
    }}>
      <SoftCard data-layout="not-found" sx={{ maxWidth: 480, width: '100%', textAlign: 'center', p: { xs: 3, sm: 5 } }}>
        <SectionLabel sx={{ color: 'primary.main', opacity: 1, mb: 1.5 }}>Chyba 404</SectionLabel>
        <Typography variant="h1" component="h1" sx={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          Stránka nenalezena
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 1, mb: 3.5 }}>
          Požadovaná stránka neexistuje nebo byla přesunuta.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<Home />}
            component={RouterLink}
            to="/prehled"
            sx={{ minHeight: 44 }}
          >
            Zpět na přehled
          </Button>
          <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => window.history.back()} sx={{ minHeight: 44 }}>
            Zpět
          </Button>
        </Stack>
      </SoftCard>
    </Box>
  );
}
