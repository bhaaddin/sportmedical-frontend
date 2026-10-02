/* ══════════════════════════════════════════════════════════════
   PUBLIC LAYOUT

   Header, page, footer — the frame every patient-facing page sits in, under
   the public theme (website identity: ink, white, orange; see
   components/public/brand.ts). The clinic's public details are read once here
   and handed to the footer; a page that already has them passes them in so
   nothing is fetched twice.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { readPublicClinic } from '../../api/clinicSettings';
import type { PublicClinic } from '../../api/clinicSettings';
import { BRAND, publicTheme } from '../../components/public/brand';
import { PublicHeader } from '../../components/public/PublicHeader';
import type { PublicHeaderProps } from '../../components/public/PublicHeader';
import { PublicFooter } from '../../components/public/PublicFooter';

export interface PublicLayoutProps extends PublicHeaderProps {
  children: ReactNode;
  /** Already-loaded clinic details; when omitted the layout reads them itself. */
  clinic?: PublicClinic | null;
  /** Leave the footer out (a short confirmation screen, a sign-in card). */
  noFooter?: boolean;
}

export default function PublicLayout({ children, clinic, noFooter = false, ...header }: PublicLayoutProps) {
  const [own, setOwn] = useState<PublicClinic | null>(null);
  const wantsOwn = clinic === undefined;

  useEffect(() => {
    if (!wantsOwn) return undefined;
    let alive = true;
    // Never throws — see readPublicClinic.
    void readPublicClinic().then((details) => { if (alive) setOwn(details); });
    return () => { alive = false; };
  }, [wantsOwn]);

  const details = wantsOwn ? own : clinic;

  return (
    <ThemeProvider theme={publicTheme}>
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: BRAND.page, color: BRAND.text }}>
        <PublicHeader {...header} />
        <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
        {!noFooter && <PublicFooter clinic={details ?? null} />}
      </Box>
    </ThemeProvider>
  );
}
