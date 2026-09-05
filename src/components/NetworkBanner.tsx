/* ══════════════════════════════════════════════════════════════
   NETWORK BANNER
   Shows amber banner when offline, green toast when restored.
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useState } from 'react';
import { Box, Typography, Snackbar, Alert } from '@mui/material';
import { WifiOff, CheckCircle } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export default function NetworkBanner() {
  const isOnline = useNetworkStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowRestored(true);
      setWasOffline(false);
      const t = setTimeout(() => setShowRestored(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline, wasOffline]);

  return (
    <>
      {/* Offline banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
          >
            <Box sx={{
              bgcolor: '#ED6C02', color: '#fff', px: 3, py: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
            }}>
              <WifiOff sx={{ fontSize: 18 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Jste offline — některé funkce mohou být nedostupné
              </Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restored toast */}
      <Snackbar open={showRestored} autoHideDuration={3000} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" icon={<CheckCircle />} sx={{ borderRadius: 2 }}>
          Připojení obnoveno
        </Alert>
      </Snackbar>
    </>
  );
}
