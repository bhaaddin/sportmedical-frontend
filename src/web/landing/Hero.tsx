/* The first screen of /web: eyebrow, huge headline, lead, two buttons, a photo carousel
   (three media slots) and the strip of four advantages. Layout: phone one column with a
   shorter carousel; iPad two columns; desktop text + a 400 px carousel (V-Web2). */

import { Box } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { lowestPrice, formatCzk, usePriceList } from '../../api/priceList';
import { useSlotText, SlotText } from '../../site/SlotText';
import { MediaSlot } from '../../site/MediaSlot';
import { WebSection, Eyebrow, CtaButton } from '../ui';
import { FONT_HEAD, MQ, W } from '../tokens';
import { BOOKING_PATH } from '../../components/public/PublicHeader';

const fade3 = keyframes`
  0%, 26% { opacity: 1 }
  33%, 93% { opacity: 0 }
  100% { opacity: 1 }
`;
const dot3 = keyframes`
  0%, 26% { background: #F0912E; width: 28px }
  33%, 93% { background: #4A505A; width: 9px }
  100% { background: #F0912E; width: 28px }
`;

const SLIDES = [
  { key: 'landing.hero.photo1', bg: '#1C2026', delay: '0s' },
  { key: 'landing.hero.photo2', bg: '#20242A', delay: '-5s' },
  { key: 'landing.hero.photo3', bg: '#181C21', delay: '-10s' },
] as const;

export function HeroCarousel() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
      <Box
        role="group"
        aria-label="Fotografie z kliniky"
        sx={{ position: 'relative', height: { xs: 240, sm: 340, md: 380, lg: 420 }, borderRadius: '20px', overflow: 'hidden', bgcolor: '#16191E' }}
      >
        {SLIDES.map((slide, index) => (
          <Box
            key={slide.key}
            sx={{
              position: 'absolute', inset: 0, animation: `${fade3} 15s infinite`, animationDelay: slide.delay,
              [MQ.reduceMotion]: { animation: 'none', ...(index > 0 ? { display: 'none' } : {}) },
            }}
          >
            <MediaSlot
              slotKey={slide.key}
              tone="dark"
              badge={`0${index + 1} / 03`}
              eager={index === 0}
              placeholderBackground={slide.bg}
              sizes="(max-width: 767px) 100vw, 400px"
              sx={{ height: '100%', minHeight: 0, borderRadius: 0, aspectRatio: 'auto' }}
            />
          </Box>
        ))}
      </Box>
      <Box aria-hidden="true" sx={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
        {SLIDES.map((slide, index) => (
          <Box
            key={slide.key}
            sx={{
              height: 9, borderRadius: '5px', width: index === 0 ? 28 : 9, bgcolor: index === 0 ? W.orange : '#4A505A',
              animation: `${dot3} 15s infinite`, animationDelay: slide.delay,
              [MQ.reduceMotion]: { animation: 'none' },
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

function Advantage({ n, first, last }: { n: 1 | 2 | 3 | 4; first: boolean; last: boolean }) {
  return (
    <Box
      sx={{
        minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px', py: '26px',
        // Phone: stacked, separated by a line above. iPad 2×2. Desktop: four columns with lines between.
        borderTop: first ? 'none' : `1px solid ${W.inkLine}`,
        [MQ.tablet]: {
          borderTop: n > 2 ? `1px solid ${W.inkLine}` : 'none',
          borderLeft: n % 2 === 0 ? `1px solid ${W.inkLine}` : 'none',
          pl: n % 2 === 0 ? '28px' : 0, pr: n % 2 === 0 ? 0 : '28px',
        },
        [MQ.desktop]: {
          borderTop: 'none', borderLeft: first ? 'none' : `1px solid ${W.inkLine}`, pl: first ? 0 : '28px', pr: last ? 0 : '28px',
        },
      }}
    >
      <SlotText slotKey={`landing.adv.${n}.title`} sx={{ fontSize: 15, fontWeight: 600 }} />
      <SlotText slotKey={`landing.adv.${n}.text`} sx={{ fontSize: 14, color: W.onInkMuted }} />
    </Box>
  );
}

export function Hero() {
  const { data: prices } = usePriceList();
  const secondary = useSlotText('landing.hero.cta.secondary');
  const lowest = formatCzk(lowestPrice(prices));
  const primary = useSlotText('landing.hero.cta.primary');

  return (
    <WebSection tone="ink" pt={[36, 72]} pb={[0, 0]} component="section" innerSx={{ maxWidth: 1320 }} sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '32px', sm: '40px', lg: '56px' }, alignItems: 'end',
          [MQ.tablet]: { gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)' },
          [MQ.desktop]: { gridTemplateColumns: 'minmax(0, 1fr) 400px' },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: '20px', md: '26px' }, minWidth: 0, pb: { xs: 0, sm: '56px', lg: '72px' } }}>
          <Eyebrow onInk rule sx={{ fontSize: { xs: 11, md: 12 } }}>
            <SlotText slotKey="landing.hero.eyebrow" />
          </Eyebrow>
          <SlotText
            slotKey="landing.hero.headline"
            as="h1"
            accentLast
            accent={W.orange}
            sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 'clamp(44px, 6.4vw, 88px)', lineHeight: 0.94, letterSpacing: '-0.045em' }}
          />
          <SlotText slotKey="landing.hero.lead" as="p" sx={{ m: 0, fontSize: { xs: 17, md: 19 }, lineHeight: 1.55, color: W.onInk, maxWidth: '48ch' }} />
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: '13px', pt: '6px' }}>
            <CtaButton to={BOOKING_PATH} arrow sx={{ width: { xs: '100%', sm: 'auto' } }}>{primary}</CtaButton>
            <CtaButton to="/cenik" variant="ghostDark" sx={{ width: { xs: '100%', sm: 'auto' } }}>
              {lowest !== null ? `${secondary} od ${lowest}` : secondary}
            </CtaButton>
          </Box>
        </Box>
        <Box sx={{ pb: { xs: '8px', sm: '56px' } }}>
          <HeroCarousel />
        </Box>
      </Box>

      <Box sx={{ borderTop: `1px solid ${W.inkLine}`, display: 'grid', gridTemplateColumns: '1fr', [MQ.tablet]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }, [MQ.desktop]: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' } }}>
        <Advantage n={1} first last={false} />
        <Advantage n={2} first={false} last={false} />
        <Advantage n={3} first={false} last={false} />
        <Advantage n={4} first={false} last />
      </Box>
    </WebSection>
  );
}
