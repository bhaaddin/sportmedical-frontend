/* ══════════════════════════════════════════════════════════════
   NETWORK BANNER
   Two different troubles, one strip across the top:
     - this computer is offline (the browser says so), or
     - the computer is online and the SERVER does not answer - the API is
       restarting or down. The client keeps asking in the background
       (api/connection.ts) and this says so, then says when it came back.
   ══════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material';
import { WifiOff, CheckCircle, CloudOff } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { connection } from '../api/connection';

export const SERVER_UNREACHABLE_TEXT = 'Server je nedostupný — zkouším znovu';
export const OFFLINE_TEXT = 'Jste offline — některé funkce mohou být nedostupné';

export default function NetworkBanner() {
  const isOnline = useNetworkStatus();
  const serverState = useSyncExternalStore(connection.subscribe, connection.getState, connection.getState);
  const serverDown = isOnline && serverState === 'unreachable';
  const troubled = !isOnline || serverDown;

  const wasTroubled = useRef(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (troubled) {
      wasTroubled.current = true;
      return undefined;
    }
    if (!wasTroubled.current) return undefined;

    wasTroubled.current = false;
    setShowRestored(true);
    const t = setTimeout(() => setShowRestored(false), 3000);
    return () => clearTimeout(t);
  }, [troubled]);

  return (
    <>
      <AnimatePresence>
        {troubled && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
          >
            <Box
              role="alert"
              sx={{
                bgcolor: serverDown ? '#C62828' : '#ED6C02', color: '#fff', px: 3, py: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
              }}
            >
              {serverDown ? <CloudOff sx={{ fontSize: 18 }} /> : <WifiOff sx={{ fontSize: 18 }} />}
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {serverDown ? SERVER_UNREACHABLE_TEXT : OFFLINE_TEXT}
              </Typography>
              {serverDown && <CircularProgress size={14} sx={{ color: '#fff', ml: 1 }} />}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      <Snackbar open={showRestored} autoHideDuration={3000} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" icon={<CheckCircle />} sx={{ borderRadius: 2 }}>
          Připojení obnoveno
        </Alert>
      </Snackbar>
    </>
  );
}
