/* ══════════════════════════════════════════════════════════════
   404 NOT FOUND PAGE
   ══════════════════════════════════════════════════════════════ */
import { Box, Typography, Button, Stack } from '@mui/material';
import { Home, ArrowBack } from '@mui/icons-material';
import { SoftCard } from '../components/ui';

export default function NotFound() {
  return (
    <Box sx={{
      minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2,
    }}>
      <SoftCard sx={{ maxWidth: 440, width: '100%', textAlign: 'center', p: { xs: 3, sm: 5 } }}>
        <Typography sx={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: 'primary.main' }}>
          404
        </Typography>
        <Typography variant="h5" sx={{ mt: 1.5, mb: 0.5 }}>
          Stránka nenalezena
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Požadovaná stránka neexistuje nebo byla přesunuta.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
          <Button variant="contained" startIcon={<Home />} href="/">
            Domů
          </Button>
          <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => window.history.back()}>
            Zpět
          </Button>
        </Stack>
      </SoftCard>
    </Box>
  );
}
