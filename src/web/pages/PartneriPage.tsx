/* /partneri — the partner clubs as cards.

   The cards are the admin's partner list ("Média a texty" → Partneři) when it has entries, otherwise the
   nine clubs of the live home page (src/site/defaults.ts, which usePartners falls back to). A logo is text
   (the club's name) until the admin uploads a file. A card links to the club's own website when it has one;
   the sentences around the cards are slots. */

import { Box } from '@mui/material';
import { usePartners } from '../../api/siteContent';
import type { SitePartner } from '../../api/siteContent';
import { SlotText, useSlotText } from '../../site/SlotText';
import { cloudinaryWidth } from '../../site/cloudinary';
import { ArrowIcon, CtaButton, Eyebrow, PageHero, SectionTitle, WebSection } from '../ui';
import { FONT_HEAD, W } from '../tokens';
import { CardGrid, cardSx } from './company/blocks';

/** Only an http(s) address is a usable link. */
const safeUrl = (url: string): string | null => (/^https?:\/\/\S+$/i.test(url.trim()) ? url.trim() : null);

function PartnerCard({ partner }: { partner: SitePartner }) {
  const cta = useSlotText('partneri.card.cta');
  const url = safeUrl(partner.url);
  return (
    <Box component="li" sx={[cardSx, { gap: '12px' }]}>
      <Box sx={{ minHeight: 56, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${W.line}`, pb: '12px' }}>
        {partner.logoUrl !== undefined ? (
          <Box component="img" src={cloudinaryWidth(partner.logoUrl, 320)} alt="" loading="lazy" decoding="async" sx={{ maxWidth: '100%', maxHeight: 48, objectFit: 'contain' }} />
        ) : (
          partner.sport !== '' && (
            <Box component="span" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: W.muted }}>{partner.sport}</Box>
          )
        )}
      </Box>
      <Box component="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 19, lineHeight: 1.25 }}>{partner.name}</Box>
      {partner.logoUrl !== undefined && partner.sport !== '' && (
        <Box component="span" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: W.muted }}>{partner.sport}</Box>
      )}
      {partner.description !== '' && (
        <Box component="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.bodySoft }}>{partner.description}</Box>
      )}
      {url !== null && (
        <Box
          component="a"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            mt: 'auto', pt: '4px', display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: 44, fontSize: 15, fontWeight: 700, color: W.orangeText,
            textDecoration: 'none', '&:hover': { color: W.orangeTextHover },
          }}
        >
          {cta}
          <ArrowIcon size={15} />
          <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{`(${partner.name}, otevře se v novém okně)`}</Box>
        </Box>
      )}
    </Box>
  );
}

function JoinBand() {
  const contact = useSlotText('partneri.join.cta');
  const clubs = useSlotText('partneri.join.clubs');
  return (
    <WebSection tone="ink" py={[48, 72]}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: 720 }}>
        <Eyebrow onInk rule><SlotText slotKey="partneri.hero.eyebrow" /></Eyebrow>
        <SectionTitle size="md"><SlotText slotKey="partneri.join.title" /></SectionTitle>
        <Box component="ul" sx={{ m: 0, pl: '22px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 17, lineHeight: 1.55, color: W.onInk }}>
          {[1, 2, 3].map((n) => (
            <li key={n}><SlotText slotKey={`partneri.join.${n}`} /></li>
          ))}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: '12px', pt: '6px' }}>
          <CtaButton to="/kontakt#poptavka" height={54} fontSize={16} px={28} sx={{ width: { xs: '100%', sm: 'auto' } }}>{contact}</CtaButton>
          <CtaButton to="/kluby" variant="ghostDark" height={54} fontSize={16} px={26} sx={{ width: { xs: '100%', sm: 'auto' } }}>{clubs}</CtaButton>
        </Box>
      </Box>
    </WebSection>
  );
}

export default function PartneriPage() {
  const partners = usePartners();
  return (
    <>
      <PageHero
        eyebrow={<SlotText slotKey="partneri.hero.eyebrow" />}
        title={<SlotText slotKey="partneri.hero.title" />}
        lead={<SlotText slotKey="partneri.hero.lead" />}
      />
      <WebSection py={[40, 64]} innerSx={{ display: 'flex', flexDirection: 'column', gap: { xs: '26px', md: '34px' } }}>
        <SectionTitle size="md"><SlotText slotKey="partneri.list.title" /></SectionTitle>
        <CardGrid desktop={3} component="ul">
          {partners.map((partner) => (
            <PartnerCard key={partner.id} partner={partner} />
          ))}
        </CardGrid>
      </WebSection>
      <JoinBand />
    </>
  );
}
