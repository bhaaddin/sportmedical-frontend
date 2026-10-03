/* The remaining sections of the landing: equipment, "Jak to probíhá", the club offer,
   the philosophy quote. Texts are slots; the discount figure is the public discount tiers'
   (hidden when the server does not publish any). */

import { Box } from '@mui/material';
import { formatPercent, topTier, useDiscountTiers } from '../../api/publicDiscounts';
import { MediaSlot } from '../../site/MediaSlot';
import { SlotText, useSlotText } from '../../site/SlotText';
import { ArrowLink, CtaButton, Eyebrow, SectionTitle, WebSection } from '../ui';
import { FONT_HEAD, MQ, W } from '../tokens';

/* ── Equipment ── */

const EQUIPMENT = [1, 2, 3, 4] as const;

export function EquipmentSection() {
  return (
    <WebSection tone="warm" py={[48, 76]} borderTop innerSx={{ display: 'flex', flexDirection: 'column', gap: { xs: '26px', md: '34px' } }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Eyebrow><SlotText slotKey="landing.equipment.eyebrow" /></Eyebrow>
        <SectionTitle size="md"><SlotText slotKey="landing.equipment.title" /></SectionTitle>
      </Box>
      <Box
        component="ul"
        sx={{
          listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '1px',
          bgcolor: W.lineStrong, border: `1px solid ${W.lineStrong}`, borderRadius: '18px', overflow: 'hidden',
        }}
      >
        {EQUIPMENT.map((n) => (
          <Box
            key={n}
            component="li"
            sx={{
              bgcolor: W.white, p: { xs: '24px 22px', md: '28px 26px' }, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: { xs: 0, md: 180 },
              '@media (hover: hover)': {
                transition: 'background-color .2s ease, color .2s ease', [MQ.reduceMotion]: { transition: 'none' },
                '&:hover': { bgcolor: '#15181C', color: W.white, '& .pp': { color: W.onInk } },
              },
            }}
          >
            <SlotText slotKey={`landing.equipment.${n}.name`} sx={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 21, letterSpacing: '-0.02em' }} />
            <SlotText slotKey={`landing.equipment.${n}.text`} sx={{ fontSize: 15, lineHeight: 1.6, color: W.bodySoft }} />
          </Box>
        ))}
      </Box>
    </WebSection>
  );
}

/* ── How it works ── */

const STEPS = [1, 2, 3, 4] as const;

export function StepsSection() {
  return (
    <WebSection id="jak-to-probiha" py={[48, 80]}>
      <Box
        sx={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '32px', md: '40px', lg: '56px' }, alignItems: 'start',
          [MQ.desktop]: { gridTemplateColumns: '320px minmax(0, 1fr)' },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          <Eyebrow><SlotText slotKey="landing.steps.eyebrow" /></Eyebrow>
          <SectionTitle size="md"><SlotText slotKey="landing.steps.title" /></SectionTitle>
          <SlotText slotKey="landing.steps.lead" as="p" sx={{ m: 0, fontSize: 17, lineHeight: 1.6, color: W.bodySoft, maxWidth: '44ch' }} />
        </Box>
        <Box
          component="ol"
          sx={{
            listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '28px',
            [MQ.tablet]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {STEPS.map((n) => (
            <Box key={n} component="li" sx={{ display: 'flex', flexDirection: 'column', gap: '11px', pt: '20px', borderTop: `3px solid ${W.orange}`, minWidth: 0 }}>
              <Box component="span" aria-hidden="true" sx={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 32, letterSpacing: '-0.03em', color: W.numeral }}>{`0${n}`}</Box>
              <SlotText slotKey={`landing.steps.${n}.title`} sx={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 19 }} />
              <SlotText slotKey={`landing.steps.${n}.text`} sx={{ fontSize: 15, lineHeight: 1.6, color: W.bodySoft }} />
            </Box>
          ))}
        </Box>
      </Box>
    </WebSection>
  );
}

/* ── Club offer ── */

function Stat({ value, label, first }: { value: string; label: string; first: boolean }) {
  return (
    <Box sx={{ minWidth: 0, py: '22px', pr: '16px', pl: first ? 0 : '16px', borderLeft: first ? 'none' : `1px solid ${W.inkLine}`, display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <Box component="span" sx={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: { xs: 28, md: 32 }, color: W.orange, letterSpacing: '-0.03em' }}>{value}</Box>
      <Box component="span" sx={{ fontSize: 14, color: W.onInk }}>{label}</Box>
    </Box>
  );
}

export function ClubSection() {
  const { data: tiers } = useDiscountTiers();
  const best = topTier(tiers);
  const stat1Value = useSlotText('landing.club.stat1.value');
  const stat1Label = useSlotText('landing.club.stat1.label');
  const stat3Value = useSlotText('landing.club.stat3.value');
  const stat3Label = useSlotText('landing.club.stat3.label');
  const inquiry = useSlotText('landing.club.cta.inquiry');
  const link = useSlotText('landing.club.cta.link');

  const stats = [
    { value: stat1Value, label: stat1Label },
    // The discount is the server's own figure; without it the number is simply not shown.
    ...(best !== null ? [{ value: formatPercent(best.percent), label: `od ${best.minPersons} osob` }] : []),
    { value: stat3Value, label: stat3Label },
  ].filter((stat) => stat.value.trim() !== '');

  return (
    <WebSection tone="ink" id="kluby" py={[52, 80]}>
      <Box
        sx={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '32px', md: '40px', lg: '52px' }, alignItems: 'center',
          [MQ.tablet]: { gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)' },
          [MQ.desktop]: { gridTemplateColumns: 'minmax(0, 1fr) 420px' },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '22px', minWidth: 0 }}>
          <Eyebrow onInk><SlotText slotKey="landing.club.eyebrow" /></Eyebrow>
          <SectionTitle size="xl"><SlotText slotKey="landing.club.title" /></SectionTitle>
          <SlotText slotKey="landing.club.text" as="p" sx={{ m: 0, fontSize: 17, lineHeight: 1.6, color: W.onInk, maxWidth: '52ch' }} />
          {stats.length > 0 && (
            <Box
              sx={{
                display: 'grid', gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`, borderTop: `1px solid ${W.inkLine}`, mt: '6px',
              }}
            >
              {stats.map((stat, index) => (
                <Stat key={stat.label} value={stat.value} label={stat.label} first={index === 0} />
              ))}
            </Box>
          )}
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: '13px', pt: '8px' }}>
            <CtaButton to="/kluby" height={54} px={28} fontSize={16} sx={{ width: { xs: '100%', sm: 'auto' } }}>{inquiry}</CtaButton>
            <CtaButton to="/kluby#mam-odkaz" variant="ghostDark" height={54} px={26} fontSize={16} sx={{ width: { xs: '100%', sm: 'auto' } }}>{link}</CtaButton>
          </Box>
        </Box>
        <MediaSlot
          slotKey="landing.club.photo"
          tone="dark"
          sizes="(max-width: 767px) 100vw, 420px"
          sx={{ borderRadius: '20px', aspectRatio: '7 / 6', [MQ.desktop]: { aspectRatio: 'auto', height: 380 } }}
        />
      </Box>
    </WebSection>
  );
}

/* ── Philosophy ── */

export function PhilosophySection() {
  const link = useSlotText('landing.philosophy.link');
  return (
    <WebSection py={[48, 76]} borderTop maxWidth={900} innerSx={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center', textAlign: 'center' }}>
      <Eyebrow><SlotText slotKey="landing.philosophy.eyebrow" /></Eyebrow>
      <SlotText
        slotKey="landing.philosophy.quote"
        as="blockquote"
        sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 'clamp(20px, 2.6vw, 29px)', lineHeight: 1.38, letterSpacing: '-0.02em' }}
      />
      <ArrowLink to="/o-nas" sx={{ alignSelf: 'center' }}>{link}</ArrowLink>
    </WebSection>
  );
}
