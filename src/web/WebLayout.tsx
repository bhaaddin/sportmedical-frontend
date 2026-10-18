/* The frame of every /web page: skip link, sticky header, the page, the footer, and — on a
   phone only — the pinned "Objednat termín" bar so the primary action is always in thumb reach. */

import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { useSiteContent } from '../api/siteContent';
import { PublicFooter, PublicFooterBar } from '../components/public/PublicFooter';
import { FIT_NARROW, FitContext } from '../components/public/kit';
import { BOOKING_PATH, PublicHeader } from '../components/public/PublicHeader';
import { usePublicClinic } from './data';
import { CtaButton } from './ui';
import { FONT_BODY, MQ, W } from './tokens';
import { findWebRoute } from './routes';

export const MAIN_ID = 'web-main';

function StickyBookBar({ fit = false }: { fit?: boolean }) {
  return (
    <Box
      sx={{
        display: 'none', [MQ.phoneOnly]: { display: 'block' }, position: fit ? 'static' : 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, flex: '0 0 auto',
        bgcolor: W.ink, borderTop: `1px solid ${W.inkLine}`, pl: 'max(16px, env(safe-area-inset-left))', pr: 'max(16px, env(safe-area-inset-right))', pt: '10px', pb: 'max(10px, env(safe-area-inset-bottom))',
        boxShadow: '0 -10px 30px rgba(0,0,0,0.25)',
      }}
    >
      <CtaButton to={BOOKING_PATH} height={52} fontSize={16} arrow sx={{ width: '100%' }}>Objednat termín</CtaButton>
    </Box>
  );
}

export function WebLayout({ children }: { children: ReactNode }) {
  const clinic = usePublicClinic();
  const { data: content } = useSiteContent();
  const { pathname } = useLocation();
  const fit = findWebRoute(pathname)?.fit === true;

  if (fit) {
    /* A board page: one screen high, the document never scrolls. The footer closes the page's own scrolling region on a phone and
       is a slim bar from an iPad up; the booking bar is a row at the bottom of the screen, not an overlay. */
    return (
      <Box
        sx={{
          height: '100vh', '@supports (height: 100dvh)': { height: '100dvh' }, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          bgcolor: W.white, color: W.text, fontFamily: FONT_BODY,
        }}
      >
        <Box
          component="a"
          href={`#${MAIN_ID}`}
          sx={{
            position: 'absolute', left: '-9999px', top: 0, zIndex: 100, bgcolor: W.orange, color: W.onOrange, px: '16px', py: '12px', fontWeight: 700,
            '&:focus': { left: 8, top: 8 },
          }}
        >
          Přeskočit na obsah
        </Box>
        <PublicHeader />
        <FitContext.Provider value={{ footer: <PublicFooter clinic={clinic} content={content} /> }}>
          <Box component="main" id={MAIN_ID} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {children}
          </Box>
        </FitContext.Provider>
        <Box sx={{ display: 'contents', [FIT_NARROW]: { display: 'none' } }}><PublicFooterBar clinic={clinic} content={content} /></Box>
        <StickyBookBar fit />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh', '@supports (height: 100dvh)': { minHeight: '100dvh' }, display: 'flex', flexDirection: 'column', bgcolor: W.white, color: W.text, fontFamily: FONT_BODY,
        // Room for the pinned bar on a phone (10 + 52 px plus whatever the home-indicator inset adds), so the footer's last line is not hidden behind it.
        [MQ.phoneOnly]: { pb: 'calc(62px + max(10px, env(safe-area-inset-bottom)))' },
      }}
    >
      <Box
        component="a"
        href={`#${MAIN_ID}`}
        sx={{
          position: 'absolute', left: '-9999px', top: 0, zIndex: 100, bgcolor: W.orange, color: W.onOrange, px: '16px', py: '12px', fontWeight: 700,
          '&:focus': { left: 8, top: 8 },
        }}
      >
        Přeskočit na obsah
      </Box>
      <PublicHeader />
      <Box component="main" id={MAIN_ID} sx={{ flex: 1 }}>
        {children}
      </Box>
      <PublicFooter clinic={clinic} content={content} />
      <StickyBookBar />
    </Box>
  );
}
