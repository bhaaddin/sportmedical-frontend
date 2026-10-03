/* /web/diagnostika — sports diagnostics (artboard V-Diagnostika): the main examinations as cards
   (VO₂max and the compensation plan carry their price from the price list, the devices sold only
   in a package say so), the price rows of the category and of the combined packages, what the client
   receives, a photo gallery, the group discounts. */

import { Box } from '@mui/material';
import { formatCzk, usePriceList } from '../../api/priceList';
import type { PriceItem } from '../../api/priceList';
import { SlotText, useSlotText } from '../../site/SlotText';
import { BOOKING_PATH } from '../../components/public/PublicHeader';
import { CtaButton } from '../ui';
import { FONT_HEAD, W } from '../tokens';
import { CARD_SX, GroupDiscounts, InfoCards, PageSection, PhotoGallery, PriceRowList, gridOf } from './services/blocks';
import { CATEGORY, ITEM, categoryItems, categoryName, findItem } from './services/pricing';
import { ServiceHero } from './services/ServiceHero';
import { FALLBACK_ROWS } from '../landing/rows';

/** The four cards of "Hlavní vyšetření": which price-list item carries the price, or null = "v balíčku". */
const MAIN_CARDS: { n: 1 | 2 | 3 | 4; pattern: RegExp | null }[] = [
  { n: 1, pattern: ITEM.vo2max },
  { n: 2, pattern: null },
  { n: 3, pattern: null },
  { n: 4, pattern: ITEM.kompenzacniPlan },
];

function MainCard({ n, item, priced }: { n: 1 | 2 | 3 | 4; item: PriceItem | null; priced: boolean }) {
  const inPackage = useSlotText('diagnostika.main.inpackage');
  const price = formatCzk(item?.priceCzk);
  const prefix = `diagnostika.main.${n}`;
  return (
    <Box component="article" sx={[{ p: '22px', display: 'flex', flexDirection: 'column', gap: '10px' }, CARD_SX as object, { borderRadius: '16px' }]}>
      <SlotText slotKey={`${prefix}.title`} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 19, lineHeight: 1.25 }} />
      <SlotText slotKey={`${prefix}.text`} as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.bodySoft, flex: '1 1 auto' }} />
      <Box
        component="p"
        sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 20, fontVariantNumeric: 'tabular-nums', ...(priced && price === null ? { color: W.muted } : {}) }}
      >
        {priced ? price ?? '—' : inPackage}
      </Box>
    </Box>
  );
}

export default function DiagnostikaPage() {
  const { data: prices } = usePriceList();
  const own = categoryItems(prices, CATEGORY.diagnostika);
  const combos = categoryItems(prices, CATEGORY.balicky);
  const comboName = categoryName(prices, CATEGORY.balicky);
  const book = useSlotText('sluzby.shared.cta.book');

  return (
    <>
      <ServiceHero page="diagnostika" />

      <PageSection title="diagnostika.main.title" tone="warm">
        <Box sx={gridOf(260)}>
          {MAIN_CARDS.map((card) => (
            <MainCard key={card.n} n={card.n} priced={card.pattern !== null} item={card.pattern === null ? null : findItem(prices, card.pattern)} />
          ))}
        </Box>
      </PageSection>

      <PageSection title="diagnostika.pkg.title" lead="diagnostika.pkg.lead">
        <PriceRowList items={own} fallback={FALLBACK_ROWS.diagnostika} />
        {combos.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {comboName !== null && <Box component="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 20 }}>{comboName}</Box>}
            <PriceRowList items={combos} />
          </Box>
        )}
        <Box sx={{ display: 'flex' }}>
          <CtaButton to={BOOKING_PATH} height={50} fontSize={16} px={28} sx={{ width: { xs: '100%', sm: 'auto' } }}>{book}</CtaButton>
        </Box>
      </PageSection>

      <PageSection title="diagnostika.get.title" tone="warm">
        <InfoCards prefix="diagnostika.get" count={3} minWidth={280} />
        <PhotoGallery prefix="diagnostika.get" count={4} label="Fotografie z diagnostiky" />
      </PageSection>

      <GroupDiscounts />
    </>
  );
}
