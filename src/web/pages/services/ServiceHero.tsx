/* The first band of every service page (artboards V-Sluzby … V-Cenik): eyebrow, the page's H1, a
   lead, the booking button and a photo slot beside the text. Phone: one column, photo under the
   text. iPad: two columns. Desktop: text + a wide photo. */

import type { CSSProperties } from 'react';
import { Box } from '@mui/material';
import { MediaSlot } from '../../../site/MediaSlot';
import { SlotText, useSlotText } from '../../../site/SlotText';
import { BOOKING_PATH } from '../../../components/public/PublicHeader';
import { FIT_WIDE } from '../../../components/public/kit';
import { CtaButton, Eyebrow, WebSection } from '../../ui';
import { FONT_HEAD, MQ, W } from '../../tokens';

export interface ServiceHeroProps {
  /** Slot prefix of the page: 'prohlidky' → prohlidky.hero.eyebrow / title / lead / photo. */
  page: string;
  /** The second button ("Ceník") is left out on the price list itself. */
  priceButton?: boolean;
  /** A board page (the price list): the band is a slim row on a tablet and up, so the board under it has the room. */
  compact?: boolean;
}

export function ServiceHero({ page, priceButton = true, compact = false }: ServiceHeroProps) {
  const book = useSlotText('sluzby.shared.cta.book');
  const prices = useSlotText('sluzby.shared.cta.prices');
  return (
    <WebSection tone="ink" py={compact ? [44, 18] : [44, 68]} sx={{ borderBottom: `1px solid ${W.inkLine}`, flex: '0 0 auto' }}>
      <Box
        sx={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '32px', md: '44px' }, alignItems: 'center',
          [MQ.tablet]: { gridTemplateColumns: compact ? 'minmax(0, 1fr) clamp(180px, 22vw, 360px)' : 'minmax(0, 1.15fr) minmax(0, 1fr)' },
          [MQ.desktop]: { gridTemplateColumns: compact ? 'minmax(0, 1fr) clamp(240px, 22vw, 420px)' : 'minmax(0, 1fr) clamp(460px, 28vw, 760px)' },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? { xs: '20px', md: '10px' } : '20px', minWidth: 0 }}>
          <Box className="sm-hero-up" style={{ '--d': 0.05 } as CSSProperties}>
            <Eyebrow onInk rule><SlotText slotKey={`${page}.hero.eyebrow`} /></Eyebrow>
          </Box>
          <SlotText
            slotKey={`${page}.hero.title`}
            as="h1"
            split="kinetic"
            delay={0.12}
            sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: compact ? 'clamp(30px, 3vw, 44px)' : 'clamp(34px, 4.6vw, 56px)', lineHeight: 1.04, letterSpacing: '-0.035em' }}
          />
          <Box className="sm-hero-up" style={{ '--d': 0 } as CSSProperties}>
            <SlotText slotKey={`${page}.hero.lead`} as="p" sx={{ m: 0, fontSize: { xs: 17, md: 18 }, lineHeight: 1.6, color: W.onInk, maxWidth: compact ? 'min(100%, 90ch)' : '56ch' }} />
          </Box>
          <Box className="sm-hero-up" style={{ '--d': 0.12 } as CSSProperties} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: '12px', pt: '4px', ...(compact ? { [FIT_WIDE]: { display: 'none' } } : {}) }}>
            <CtaButton to={BOOKING_PATH} height={52} px={28} fontSize={16} sx={{ width: { xs: '100%', sm: 'auto' } }}>{book}</CtaButton>
            {priceButton && (
              <CtaButton to="/cenik" variant="ghostDark" height={52} px={26} fontSize={16} sx={{ width: { xs: '100%', sm: 'auto' } }}>{prices}</CtaButton>
            )}
          </Box>
        </Box>
        <Box className="sm-hero-frame" sx={{ minWidth: 0, borderRadius: '18px', overflow: 'hidden' }}>
        <MediaSlot
          slotKey={`${page}.hero.photo`}
          tone="dark"
          eager
          sizes="(max-width: 767px) 100vw, (max-width: 1279px) 45vw, min(28vw, 760px)"
          sx={{ borderRadius: '18px', aspectRatio: '4 / 3', minHeight: 0, [MQ.tablet]: { aspectRatio: 'auto', height: compact ? 110 : 300 }, [MQ.desktop]: { height: compact ? 130 : 'clamp(320px, 20vw, 460px)' } }}
        />
        </Box>
      </Box>
    </WebSection>
  );
}
