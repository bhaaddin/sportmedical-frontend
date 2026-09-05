/* ══════════════════════════════════════════════════════════════
   404 NOT FOUND PAGE
   ══════════════════════════════════════════════════════════════ */
import { Box, Typography, Button } from '@mui/material';
import { Home, ArrowBack } from '@mui/icons-material';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <Box sx={{
      minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', px: 3,
    }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Typography variant="h1" sx={{ fontWeight: 900, fontSize: '8rem', color: '#0D7377', lineHeight: 1 }}>
          404
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          Stránka nenalezena
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Požadovaná stránka neexistuje nebo byla přesunuta.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="contained" startIcon={<Home />} href="/"
            sx={{ bgcolor: '#0D7377', borderRadius: 2, px: 3 }}>
            Domů
          </Button>
          <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => window.history.back()}
            sx={{ borderRadius: 2 }}>
            Zpět
          </Button>
        </Box>
      </motion.div>
    </Box>
  );
}
