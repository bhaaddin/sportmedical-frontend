/* The strip of partner clubs: a smoothly scrolling marquee (V-Web2). Names — and, once the admin
   has uploaded them, logos — come from the site content; the ten defaults show until then.
   Reduced motion: no scrolling, the strip becomes a horizontally scrollable row. */

import { Box } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { useSiteContent } from '../../api/siteContent';
import type { SitePartner } from '../../api/siteContent';
import { SlotText } from '../../site/SlotText';
import { cloudinaryWidth } from '../../site/cloudinary';
import { GUTTER, MAX_WIDTH, MQ, W } from '../tokens';

const jede = keyframes`
  from { transform: translateX(0) }
  to { transform: translateX(-50%) }
`;

/** Seconds a single chip takes to pass; the whole loop scales with the number of chips. */
const SECONDS_PER_CHIP = 4.75;
const MIN_CHIPS = 10;

function Chip({ partner, hidden }: { partner: SitePartner; hidden: boolean }) {
  const inner = (
    <>
      {partner.sport !== '' && (
        <Box component="span" sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: W.muted }}>
          {partner.sport}
        </Box>
      )}
      {partner.logoUrl !== undefined ? (
        <Box component="img" src={cloudinaryWidth(partner.logoUrl, 320)} alt={hidden ? '' : partner.name} loading="lazy" decoding="async" sx={{ maxWidth: '100%', maxHeight: 40, objectFit: 'contain' }} />
      ) : (
        <Box component="span" sx={{ fontSize: 15, fontWeight: 600, textAlign: 'center', color: W.text }}>{partner.name}</Box>
      )}
    </>
  );
  const sx = {
    flex: '0 0 auto', width: 210, height: 92, border: `1px solid ${W.lineStrong}`, borderRadius: '14px', bgcolor: W.white, display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', p: '10px', textDecoration: 'none',
  } as const;
  return partner.url !== '' ? (
    <Box component="a" href={partner.url} target="_blank" rel="noopener noreferrer" tabIndex={hidden ? -1 : undefined} sx={sx}>{inner}</Box>
  ) : (
    <Box sx={sx}>{inner}</Box>
  );
}

export function PartnerMarquee() {
  const { data: content } = useSiteContent();
  const partners = content?.partners ?? [];
  if (partners.length === 0) return null;

  // Enough chips in one group to be wider than any screen, so the loop never shows a gap.
  const copies = Math.max(1, Math.ceil(MIN_CHIPS / partners.length));
  const group = Array.from({ length: copies }, () => partners).flat();
  const seconds = Math.max(24, Math.round(group.length * SECONDS_PER_CHIP));

  return (
    <Box component="section" aria-label="Partneři" sx={{ bgcolor: W.warm, pt: { xs: '40px', md: '56px' }, pb: { xs: '44px', md: '60px' }, overflow: 'hidden' }}>
      <Box sx={{ maxWidth: MAX_WIDTH, mx: 'auto', px: GUTTER, mb: '28px' }}>
        <SlotText slotKey="landing.partners.eyebrow" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: W.muted }} />
      </Box>
      <Box sx={{ [MQ.reduceMotion]: { overflowX: 'auto', px: GUTTER } }}>
        <Box
          sx={{
            display: 'flex', width: 'max-content', animation: `${jede} ${seconds}s linear infinite`,
            '@media (hover: hover)': { '&:hover': { animationPlayState: 'paused' } },
            '&:focus-within': { animationPlayState: 'paused' },
            [MQ.reduceMotion]: { animation: 'none' },
          }}
        >
          <Box sx={{ display: 'flex', gap: '14px', pr: '14px' }}>
            {group.map((partner, index) => <Chip key={`${partner.id}-${index}`} partner={partner} hidden={false} />)}
          </Box>
          <Box aria-hidden="true" sx={{ display: 'flex', gap: '14px', pr: '14px', [MQ.reduceMotion]: { display: 'none' } }}>
            {group.map((partner, index) => <Chip key={`${partner.id}-${index}`} partner={partner} hidden />)}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
