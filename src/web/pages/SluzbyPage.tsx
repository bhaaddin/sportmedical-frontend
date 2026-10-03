/* /web/sluzby — the overview of the three services as blocks (artboard V-Sluzby): a card per
   service with its photo, a sentence and the first rows of its price list (hover rows, amounts
   from the price list, "—" when unknown), then the equipment, a photo gallery, the group discounts. */

import { Box } from '@mui/material';
import { pickRows, usePriceList } from '../../api/priceList';
import type { RowSpec } from '../../api/priceList';
import { MediaSlot } from '../../site/MediaSlot';
import { SlotText, useSlotText } from '../../site/SlotText';
import { BOOKING_PATH } from '../../components/public/PublicHeader';
import { EquipmentSection } from '../landing/sections';
import { FALLBACK_ROWS, ROW_SPECS } from '../landing/rows';
import { CtaButton, SectionTitle, WebSection } from '../ui';
import { FONT_HEAD, W } from '../tokens';
import { CARD_SX, GroupDiscounts, PhotoGallery, PriceRowList, gridOf } from './services/blocks';
import { ServiceHero } from './services/ServiceHero';

interface ServiceDef {
  n: 1 | 2 | 3;
  to: string;
  spec: RowSpec;
  fallback: readonly string[];
}

const SERVICES: ServiceDef[] = [
  { n: 1, to: '/web/prohlidky', spec: ROW_SPECS.prohlidky, fallback: FALLBACK_ROWS.prohlidky },
  { n: 2, to: '/web/diagnostika', spec: ROW_SPECS.diagnostika, fallback: FALLBACK_ROWS.diagnostika },
  { n: 3, to: '/web/inbody', spec: ROW_SPECS.inbody, fallback: FALLBACK_ROWS.inbody },
];

function ServiceCard({ def }: { def: ServiceDef }) {
  const { data: prices } = usePriceList();
  const rows = pickRows(prices, def.spec);
  const prefix = `sluzby.service${def.n}`;
  const link = useSlotText(`${prefix}.link`);
  return (
    <Box component="article" sx={[{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }, CARD_SX as object, { borderRadius: '16px' }]}>
      <MediaSlot
        slotKey={`${prefix}.photo`}
        sizes="(max-width: 767px) 100vw, (max-width: 1279px) 45vw, 400px"
        sx={{ borderRadius: 0, aspectRatio: '3 / 2', minHeight: 0 }}
      />
      <Box sx={{ p: { xs: '20px', md: '22px' }, display: 'flex', flexDirection: 'column', gap: '14px', flex: '1 1 auto' }}>
        <SlotText slotKey={`${prefix}.title`} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 21, letterSpacing: '-0.02em', lineHeight: 1.2 }} />
        <SlotText slotKey={`${prefix}.text`} as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.bodySoft }} />
        <Box sx={{ mt: 'auto', pt: '4px' }}>
          <PriceRowList items={rows} fallback={def.fallback} to={def.to} showDuration={false} />
        </Box>
        <CtaButton to={def.to} height={46} fontSize={15} sx={{ width: '100%' }}>{link}</CtaButton>
      </Box>
    </Box>
  );
}

export default function SluzbyPage() {
  const book = useSlotText('sluzby.shared.cta.book');
  return (
    <>
      <ServiceHero page="sluzby" />

      <WebSection tone="warm" py={[48, 72]} innerSx={{ display: 'flex', flexDirection: 'column', gap: { xs: '24px', md: '32px' } }}>
        <SectionTitle size="md"><SlotText slotKey="sluzby.blocks.title" /></SectionTitle>
        <Box sx={gridOf(300, 20)}>
          {SERVICES.map((def) => (
            <ServiceCard key={def.n} def={def} />
          ))}
        </Box>
        <Box sx={{ display: 'flex' }}>
          <CtaButton to={BOOKING_PATH} height={50} fontSize={16} px={28} sx={{ width: { xs: '100%', sm: 'auto' } }}>{book}</CtaButton>
        </Box>
      </WebSection>

      <EquipmentSection />
      <WebSection py={[40, 56]}>
        <PhotoGallery prefix="sluzby.gallery" count={4} label="Fotografie vybavení" />
      </WebSection>

      <GroupDiscounts />
    </>
  );
}
