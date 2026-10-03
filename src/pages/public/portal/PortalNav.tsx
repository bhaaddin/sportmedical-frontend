/* ══════════════════════════════════════════════════════════════
   PORTAL NAV  (artboards V-Portal / V-Vysledky: Přehled · Výsledky · Dokumenty · Termíny)

   A sub-bar under the site header. The first two switch the page's view, the
   last two jump to a block of the overview. On a phone the items scroll inside
   their own row (every target ≥ 44 px) and the patient's name drops out.
   ══════════════════════════════════════════════════════════════ */

import { Box } from '@mui/material';
import { BRAND } from '../../../components/public/brand';
import { GUTTERS } from '../../../components/public/kit';

export type PortalView = 'prehled' | 'vysledky';

export interface PortalNavProps {
  view: PortalView;
  /** Switch to a view; with an anchor, scroll to that block of the overview afterwards. */
  go: (view: PortalView, anchor?: 'dokumenty' | 'terminy') => void;
  name?: string;
}

function Item({ active, onClick, children }: { active?: boolean; onClick: () => void; children: string }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      sx={{
        minHeight: 48, px: 1.75, border: 0, bgcolor: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15,
        fontWeight: active ? 700 : 500, color: active ? BRAND.text : '#5C6067', whiteSpace: 'nowrap',
        borderBottom: `3px solid ${active ? BRAND.accent : 'transparent'}`,
        '&:hover': { color: BRAND.text },
      }}
    >
      {children}
    </Box>
  );
}

export default function PortalNav({ view, go, name }: PortalNavProps) {
  return (
    <Box sx={{ bgcolor: BRAND.paper, borderBottom: `1px solid ${BRAND.line}` }}>
      <Box sx={{ maxWidth: 1240, mx: 'auto', px: GUTTERS, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box
          component="nav"
          aria-label="Portál"
          sx={{ display: 'flex', overflowX: 'auto', mx: { xs: -1, md: 0 }, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
        >
          <Item active={view === 'prehled'} onClick={() => go('prehled')}>Přehled</Item>
          <Item active={view === 'vysledky'} onClick={() => go('vysledky')}>Výsledky</Item>
          <Item onClick={() => go('prehled', 'dokumenty')}>Dokumenty</Item>
          <Item onClick={() => go('prehled', 'terminy')}>Termíny</Item>
        </Box>
        {name !== undefined && name !== '' && (
          <Box component="span" sx={{ display: { xs: 'none', md: 'block' }, fontSize: 15, color: '#5C6067', whiteSpace: 'nowrap' }}>{name}</Box>
        )}
      </Box>
    </Box>
  );
}
