/* The frame of every /web page: skip link, sticky header, the page, the footer, and — on a
   phone only — the pinned "Objednat termín" bar so the primary action is always in thumb reach. */

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { useSiteContent } from '../api/siteContent';
import { PublicFooter } from '../components/public/PublicFooter';
import { BOOKING_PATH, PublicHeader } from '../components/public/PublicHeader';
import { usePublicClinic } from './data';
import { CtaButton } from './ui';
import { FONT_BODY, MQ, W } from './tokens';

export const MAIN_ID = 'web-main';

function StickyBookBar() {
  return (
    <Box
      sx={{
        display: 'none', [MQ.phoneOnly]: { display: 'block' }, position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
        bgcolor: W.ink, borderTop: `1px solid ${W.inkLine}`, px: '16px', pt: '10px', pb: 'max(10px, env(safe-area-inset-bottom))',
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

  return (
    <Box
      sx={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: W.white, color: W.text, fontFamily: FONT_BODY,
        // Room for the pinned bar on a phone, so the footer's last line is not hidden behind it.
        [MQ.phoneOnly]: { pb: '76px' },
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
