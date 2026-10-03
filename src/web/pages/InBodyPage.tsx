/* /web/inbody — InBody 770 (artboard V-InBody): what the device measures, the variants as price rows
   (amounts from the price list, "—" when unknown), why the package of five measurements, how to
   prepare, the group discounts. */

import { Box } from '@mui/material';
import { usePriceList } from '../../api/priceList';
import { SlotText, useSlotText } from '../../site/SlotText';
import { BOOKING_PATH } from '../../components/public/PublicHeader';
import { FALLBACK_ROWS } from '../landing/rows';
import { ArrowLink, CtaButton } from '../ui';
import { W } from '../tokens';
import { GroupDiscounts, InfoCards, PageSection, PhotoGallery, PriceRowList } from './services/blocks';
import { CATEGORY, categoryItems } from './services/pricing';
import { ServiceHero } from './services/ServiceHero';

export default function InBodyPage() {
  const { data: prices } = usePriceList();
  const book = useSlotText('sluzby.shared.cta.book');
  const prepLink = useSlotText('inbody.prep.link');
  const variants = categoryItems(prices, CATEGORY.inbody);

  return (
    <>
      <ServiceHero page="inbody" />

      <PageSection title="inbody.measures.title" lead="inbody.measures.lead" tone="warm">
        <InfoCards prefix="inbody.measures" count={4} />
      </PageSection>

      <PageSection title="inbody.variants.title" lead="inbody.variants.lead">
        <PriceRowList items={variants} fallback={FALLBACK_ROWS.inbody} />
        <SlotText slotKey="inbody.variants.note" as="p" sx={{ m: 0, fontSize: 15, color: W.bodySoft, maxWidth: '70ch' }} />
        <Box sx={{ display: 'flex' }}>
          <CtaButton to={BOOKING_PATH} height={50} fontSize={16} px={28} sx={{ width: { xs: '100%', sm: 'auto' } }}>{book}</CtaButton>
        </Box>
      </PageSection>

      <PageSection title="inbody.why.title" tone="warm">
        <InfoCards prefix="inbody.why" count={4} />
        <PhotoGallery prefix="inbody.why" count={3} label="Fotografie z měření InBody" />
      </PageSection>

      <PageSection title="inbody.prep.title">
        <SlotText slotKey="inbody.prep.text" as="p" sx={{ m: 0, fontSize: 17, lineHeight: 1.65, color: W.body, maxWidth: '64ch' }} />
        <ArrowLink to="/web/dokumenty">{prepLink}</ArrowLink>
      </PageSection>

      <GroupDiscounts />
    </>
  );
}
