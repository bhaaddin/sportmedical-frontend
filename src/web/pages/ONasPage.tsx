/* /web/o-nas — the clinic, the team, the equipment, the clubs it works for (artboard V-ONas).

   Sentences and photos are slots (src/site/slots/onas.ts). The equipment's names and descriptions are
   the landing's slots, so they are written once; the partner strip is the landing's marquee, fed by the
   partner list (logos are text until the admin uploads files). The team is placeholders until the clinic
   sends names and portraits. */

import { Box } from '@mui/material';
import { MediaSlot } from '../../site/MediaSlot';
import { SlotText, useSlotText } from '../../site/SlotText';
import { BOOKING_PATH } from '../../components/public/PublicHeader';
import { GEAR_COUNT, GALLERY_COUNT, TEAM_SIZE, VALUE_COUNT } from '../../site/slots/onas';
import { PartnerMarquee } from '../landing/PartnerMarquee';
import { CtaButton, Eyebrow, SectionTitle, WebSection } from '../ui';
import { FONT_HEAD, W } from '../tokens';
import { Card, CardGrid, CompanyHero, NumberedCard, PhotoGrid, SectionHead, sectionStack } from './company/blocks';

const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

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

function TeamSection() {
  return (
    <WebSection py={[44, 64]} innerSx={sectionStack}>
      <SectionHead title="onas.team.title" lead="onas.team.lead" />
      <CardGrid desktop={4} component="ul">
        {range(TEAM_SIZE).map((n) => (
          <Box key={n} component="li" sx={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
            <MediaSlot slotKey={`onas.team.${n}.photo`} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 25vw" />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <SlotText slotKey={`onas.team.${n}.name`} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 18 }} />
              <SlotText slotKey={`onas.team.${n}.role`} sx={{ fontSize: 15, color: W.bodySoft }} />
            </Box>
          </Box>
        ))}
      </CardGrid>
    </WebSection>
  );
}

function EquipmentSection() {
  return (
    <WebSection tone="warm" py={[44, 64]} innerSx={sectionStack}>
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
  return (
    <>
      <CompanyHero slots={{ eyebrow: 'onas.hero.eyebrow', title: 'onas.hero.title', lead: 'onas.hero.lead', photo: 'onas.hero.photo' }}>
        <HeroButtons />
      </CompanyHero>

      <WebSection py={[44, 64]} innerSx={sectionStack}>
        <SectionHead title="onas.values.title" />
        <CardGrid desktop={4} component="ul">
          {range(VALUE_COUNT).map((n) => (
            <NumberedCard key={n} n={n} titleKey={`onas.values.${n}.title`} textKey={`onas.values.${n}.text`} />
          ))}
        </CardGrid>
      </WebSection>

      <WebSection tone="warm" py={[44, 64]} innerSx={sectionStack}>
        <SectionHead title="onas.gallery.title" />
        <PhotoGrid keys={range(GALLERY_COUNT).map((n) => `onas.gallery.photo${n}`)} desktop={4} />
      </WebSection>

      <TeamSection />
      <EquipmentSection />

      <WebSection py={[44, 64]} pb={[28, 36]} innerSx={sectionStack}>
        <SectionHead title="onas.who.title" lead="onas.who.lead" />
      </WebSection>
      <PartnerMarquee />

      <MissionSection />
    </>
  );
}
