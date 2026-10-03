/* The first band of every service page (artboards V-Sluzby … V-Cenik): eyebrow, the page's H1, a
   lead, the booking button and a photo slot beside the text. Phone: one column, photo under the
   text. iPad: two columns. Desktop: text + a wide photo. */

import { Box } from '@mui/material';
import { MediaSlot } from '../../../site/MediaSlot';
import { SlotText, useSlotText } from '../../../site/SlotText';
import { BOOKING_PATH } from '../../../components/public/PublicHeader';
import { CtaButton, Eyebrow, WebSection } from '../../ui';
import { FONT_HEAD, MQ, W } from '../../tokens';

export interface ServiceHeroProps {
  /** Slot prefix of the page: 'prohlidky' → prohlidky.hero.eyebrow / title / lead / photo. */
  page: string;
  /** The second button ("Ceník") is left out on the price list itself. */
  priceButton?: boolean;
}

export function ServiceHero({ page, priceButton = true }: ServiceHeroProps) {
  const book = useSlotText('sluzby.shared.cta.book');
  const prices = useSlotText('sluzby.shared.cta.prices');
  return (
    <WebSection tone="ink" py={[44, 68]} sx={{ borderBottom: `1px solid ${W.inkLine}` }}>
      <Box
        sx={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '32px', md: '44px' }, alignItems: 'center',
          [MQ.tablet]: { gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)' },
          [MQ.desktop]: { gridTemplateColumns: 'minmax(0, 1fr) 460px' },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          <Eyebrow onInk rule><SlotText slotKey={`${page}.hero.eyebrow`} /></Eyebrow>
          <SlotText
            slotKey={`${page}.hero.title`}
            as="h1"
            sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 'clamp(34px, 4.6vw, 56px)', lineHeight: 1.04, letterSpacing: '-0.035em' }}
          />
          <SlotText slotKey={`${page}.hero.lead`} as="p" sx={{ m: 0, fontSize: { xs: 17, md: 18 }, lineHeight: 1.6, color: W.onInk, maxWidth: '56ch' }} />
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: '12px', pt: '4px' }}>
            <CtaButton to={BOOKING_PATH} height={52} px={28} fontSize={16} sx={{ width: { xs: '100%', sm: 'auto' } }}>{book}</CtaButton>
            {priceButton && (
              <CtaButton to="/web/cenik" variant="ghostDark" height={52} px={26} fontSize={16} sx={{ width: { xs: '100%', sm: 'auto' } }}>{prices}</CtaButton>
            )}
          </Box>
        </Box>
        <MediaSlot
          slotKey={`${page}.hero.photo`}
          tone="dark"
          eager
          sizes="(max-width: 767px) 100vw, (max-width: 1279px) 45vw, 460px"
          sx={{ borderRadius: '18px', aspectRatio: '4 / 3', minHeight: 0, [MQ.tablet]: { aspectRatio: 'auto', height: 300 }, [MQ.desktop]: { height: 320 } }}
        />
      </Box>
    </WebSection>
  );
}
