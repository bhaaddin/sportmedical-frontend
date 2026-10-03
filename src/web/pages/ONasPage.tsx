/* /o-nas — the clinic, its three pillars, diagnostics without borders (artboard V-ONas).

   The text is the live site's page "O nás" (src/site/slots/onas.ts), every sentence a slot. There is no team
   and no history on the live page, so none is shown; the gallery and the equipment photos are grey
   placeholders until the clinic sends pictures. The equipment's names and descriptions are the landing's
   slots, so they are written once; the partner strip is the landing's marquee, fed by the partner list. */

import { Box } from '@mui/material';
import { MediaSlot } from '../../site/MediaSlot';
import { SlotText, useSlotText } from '../../site/SlotText';
import { BOOKING_PATH } from '../../components/public/PublicHeader';
import { GEAR_COUNT, GALLERY_COUNT, PILLAR_COUNT } from '../../site/slots/onas';
import { PartnerMarquee } from '../landing/PartnerMarquee';
import { ArrowLink, CtaButton, Eyebrow, SectionTitle, WebSection } from '../ui';
import { FONT_HEAD, MQ, W } from '../tokens';
import { Card, CardGrid, CompanyHero, NumberedCard, PhotoGrid, SectionHead, sectionStack } from './company/blocks';

const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

const bodyText = { m: 0, fontSize: { xs: 16, md: 17 }, lineHeight: 1.7, color: W.body, maxWidth: '62ch' } as const;

function HeroButtons() {
  const book = useSlotText('onas.hero.cta.book');
  const prices = useSlotText('onas.hero.cta.prices');
  return (
    <>
      <CtaButton to={BOOKING_PATH} height={52} fontSize={16} px={28} sx={{ width: { xs: '100%', sm: 'auto' } }}>{book}</CtaButton>
      <CtaButton to="/cenik" variant="ghostDark" height={52} fontSize={16} px={26} sx={{ width: { xs: '100%', sm: 'auto' } }}>{prices}</CtaButton>
    </>
  );
}

function IntroSection() {
  return (
    <WebSection py={[44, 72]}>
      <Box
        sx={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '28px', md: '40px' }, alignItems: 'center',
          [MQ.tablet]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
          [MQ.desktop]: { gridTemplateColumns: 'minmax(0, 1fr) 520px', gap: '56px' },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
          <SectionTitle size="md"><SlotText slotKey="onas.intro.title" /></SectionTitle>
          <SlotText slotKey="onas.intro.1" as="p" sx={bodyText} />
          <SlotText slotKey="onas.intro.2" as="p" sx={bodyText} />
        </Box>
        <MediaSlot slotKey="onas.intro.photo" sizes="(max-width: 767px) 100vw, 520px" sx={{ borderRadius: '18px' }} />
      </Box>
    </WebSection>
  );
}

function GuaranteeSection() {
  return (
    <WebSection tone="warm" py={[44, 72]} innerSx={sectionStack}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
        <Eyebrow><SlotText slotKey="onas.guarantee.eyebrow" /></Eyebrow>
        <SectionTitle size="md"><SlotText slotKey="onas.guarantee.title" /></SectionTitle>
        <SlotText slotKey="onas.guarantee.text" as="p" sx={{ ...bodyText, maxWidth: '70ch' }} />
        <SlotText slotKey="onas.guarantee.pillars" as="p" sx={{ ...bodyText, fontWeight: 600, color: W.text }} />
      </Box>
      <CardGrid desktop={3} component="ul">
        {range(PILLAR_COUNT).map((n) => (
          <NumberedCard key={n} n={n} titleKey={`onas.pillar.${n}.title`} textKey={`onas.pillar.${n}.text`} />
        ))}
      </CardGrid>
      <MediaSlot slotKey="onas.guarantee.graphic" sizes="(max-width: 1320px) 100vw, 1320px" sx={{ borderRadius: '16px', minHeight: { xs: 160, md: 220 } }} />
    </WebSection>
  );
}

function NoLimitSection() {
  const clubs = useSlotText('onas.nolimit.cta');
  return (
    <WebSection py={[44, 72]} maxWidth={900} innerSx={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <SectionTitle size="md"><SlotText slotKey="onas.nolimit.title" /></SectionTitle>
      <SlotText slotKey="onas.nolimit.1" as="p" sx={bodyText} />
      <SlotText slotKey="onas.nolimit.2" as="p" sx={bodyText} />
      <ArrowLink to="/kluby">{clubs}</ArrowLink>
    </WebSection>
  );
}

function EquipmentSection() {
  return (
    <WebSection py={[44, 64]} innerSx={sectionStack}>
      <SectionHead title="onas.gear.title" />
      <CardGrid desktop={4} component="ul">
        {range(GEAR_COUNT).map((n) => (
          <Card key={n} component="li" sx={{ p: '14px 14px 22px', gap: '14px' }}>
            <MediaSlot slotKey={`onas.gear.${n}.photo`} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 25vw" sx={{ borderRadius: '10px', minHeight: 180 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px', px: '8px' }}>
              <SlotText slotKey={`landing.equipment.${n}.name`} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }} />
              <SlotText slotKey={`landing.equipment.${n}.text`} as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.bodySoft }} />
            </Box>
          </Card>
        ))}
      </CardGrid>
    </WebSection>
  );
}

function MissionSection() {
  const book = useSlotText('onas.mission.cta.book');
  const contact = useSlotText('onas.mission.cta.contact');
  return (
    <WebSection tone="ink" py={[52, 80]} maxWidth={900} innerSx={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <Eyebrow onInk rule><SlotText slotKey="onas.mission.eyebrow" /></Eyebrow>
      <SectionTitle size="md"><SlotText slotKey="onas.mission.title" /></SectionTitle>
      <SlotText slotKey="onas.mission.text" as="p" sx={{ m: 0, fontSize: { xs: 17, md: 19 }, lineHeight: 1.65, color: W.onInk, maxWidth: '62ch' }} />
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: '12px', pt: '6px' }}>
        <CtaButton to={BOOKING_PATH} height={54} fontSize={16} px={28} sx={{ width: { xs: '100%', sm: 'auto' } }}>{book}</CtaButton>
        <CtaButton to="/kontakt" variant="ghostDark" height={54} fontSize={16} px={26} sx={{ width: { xs: '100%', sm: 'auto' } }}>{contact}</CtaButton>
      </Box>
    </WebSection>
  );
}

export default function ONasPage() {
  const partners = useSlotText('onas.who.cta');
  return (
    <>
      <CompanyHero slots={{ eyebrow: 'onas.hero.eyebrow', title: 'onas.hero.title', lead: 'onas.hero.lead', photo: 'onas.hero.photo' }}>
        <HeroButtons />
      </CompanyHero>

      <IntroSection />
      <GuaranteeSection />
      <NoLimitSection />

      <WebSection tone="warm" py={[44, 64]} innerSx={sectionStack}>
        <SectionHead title="onas.gallery.title" />
        <PhotoGrid keys={range(GALLERY_COUNT).map((n) => `onas.gallery.photo${n}`)} desktop={4} />
      </WebSection>

      <EquipmentSection />

      <WebSection tone="warm" py={[44, 64]} pb={[28, 36]} innerSx={sectionStack}>
        <SectionHead title="onas.who.title" lead="onas.who.lead" />
        <ArrowLink to="/partneri">{partners}</ArrowLink>
      </WebSection>
      <PartnerMarquee />

      <MissionSection />
    </>
  );
}
