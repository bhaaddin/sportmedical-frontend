/* ══════════════════════════════════════════════════════════════
   NETWORK BANNER
   Two different troubles, one strip across the top:
     - this computer is offline (the browser says so), or
     - the computer is online and the SERVER does not answer - the API is
       restarting or down. The client keeps asking in the background
       (api/connection.ts) and this says so, then says when it came back.
   ══════════════════════════════════════════════════════════════ */
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Box, Typography, Snackbar, Alert, CircularProgress } from '@mui/material';
import { WifiOff, CheckCircle, CloudOff } from '@mui/icons-material';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { connection } from '../api/connection';

export const SERVER_UNREACHABLE_TEXT = 'Server je nedostupný — zkouším znovu';
/** After a quarter of an hour unused the server sleeps; the first answer takes up to a minute. The client keeps asking. */
export const SERVER_WAKING_HINT = 'Po delší nečinnosti se server probouzí – může to trvat až minutu, počkejte prosím.';
export const OFFLINE_TEXT ='Jste offline — některé funkce mohou být nedostupné';

/* The strip slides in with the animation library, which is fetched the first time the strip is needed (not with the
   page). If it cannot be fetched - which is exactly what an offline browser means - the strip appears without the slide. */
function PlainSlide({ show, children }: { show: boolean; children: ReactNode }) {
  return show ? <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>{children}</div> : null;
}
const Slide = lazy(() => import('./NetworkBannerSlide').catch(() => ({ default: PlainSlide })));

export default function NetworkBanner() {
  const isOnline = useNetworkStatus();
  const serverState = useSyncExternalStore(connection.subscribe, connection.getState, connection.getState);
  const serverDown = isOnline && serverState === 'unreachable';
  const troubled = !isOnline || serverDown;

  const wasTroubled = useRef(false);
  const [showRestored, setShowRestored] = useState(false);
  /* Once the strip has been needed it stays mounted, so it can slide out again. */
  const [needed, setNeeded] = useState(false);
  if (troubled && !needed) setNeeded(true);

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
      {(troubled || needed) && (
        <Suspense fallback={null}>
          <Slide show={troubled}>
            <Box
              role="alert"
              sx={{
                bgcolor: serverDown ? 'error.main' : 'warning.main', color: serverDown ? 'error.contrastText' : 'warning.contrastText', px: 3, py: 1,
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 1, rowGap: 0.25,
              }}
            >
              {serverDown ? <CloudOff sx={{ fontSize: 18 }} /> : <WifiOff sx={{ fontSize: 18 }} />}
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {serverDown ? SERVER_UNREACHABLE_TEXT : OFFLINE_TEXT}
              </Typography>
              {serverDown && <CircularProgress size={14} sx={{ color: 'inherit', ml: 1 }} />}
              {serverDown && (
                <Typography variant="caption" data-testid="server-waking-hint" sx={{ width: '100%', textAlign: 'center', opacity: 0.9, lineHeight: 1.3 }}>
                  {SERVER_WAKING_HINT}
                </Typography>
              )}
            </Box>
          </Slide>
        </Suspense>
      )}

      <Snackbar open={showRestored} autoHideDuration={3000} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" icon={<CheckCircle />} sx={{ borderRadius: 2 }}>
          Připojení obnoveno
        </Alert>
      </Snackbar>
    </>
  );
}
