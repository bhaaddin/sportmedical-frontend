/* /web/prohlidky — the sports medical examinations (artboard V-Prohlidky): the three packages side
   by side (what is included, for whom, how long, the price from the price list), the other variants
   of the category, what to prepare, how the visit runs, the group discounts. Phone: one column of
   cards; iPad: two; desktop: three. */

import { Box } from '@mui/material';
import { formatCzk, usePriceList } from '../../api/priceList';
import type { PriceItem } from '../../api/priceList';
import { SlotText, useSlotText } from '../../site/SlotText';
import { BOOKING_PATH } from '../../components/public/PublicHeader';
import { ArrowLink, CtaButton } from '../ui';
import { FONT_HEAD, W } from '../tokens';
import { CARD_SX, GroupDiscounts, InfoCards, PageSection, PhotoGallery, PriceRowList, gridOf } from './services/blocks';
import { CATEGORY, ITEM, categoryItems, findItem } from './services/pricing';
import { ServiceHero } from './services/ServiceHero';

const PACKAGES = [
  { n: 1, pattern: ITEM.zakladni },
  { n: 2, pattern: ITEM.komplexni },
  { n: 3, pattern: ITEM.spiro },
] as const;

function PackageCard({ n, item }: { n: 1 | 2 | 3; item: PriceItem | null }) {
  const book = useSlotText('sluzby.shared.cta.book');
  const price = formatCzk(item?.priceCzk);
  const prefix = `prohlidky.pkg.${n}`;
  const labelSx = { m: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: W.muted } as const;
  const valueSx = { m: 0, fontSize: 15, lineHeight: 1.6, color: W.body } as const;
  return (
    <Box component="article" sx={[{ p: { xs: '22px 20px', md: '24px' }, display: 'flex', flexDirection: 'column', gap: '16px' }, CARD_SX as object, { borderRadius: '16px' }]}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SlotText slotKey={`${prefix}.title`} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 21, letterSpacing: '-0.02em', lineHeight: 1.2 }} />
        <Box component="p" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 28, fontVariantNumeric: 'tabular-nums', ...(price === null ? { color: W.muted } : {}) }}>
          {price ?? '—'}
        </Box>
      </Box>
      <Box component="dl" sx={{ m: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SlotText slotKey="prohlidky.cmp.label.what" as="dt" sx={labelSx} />
          <SlotText slotKey={`${prefix}.what`} as="dd" sx={valueSx} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SlotText slotKey="prohlidky.cmp.label.for" as="dt" sx={labelSx} />
          <SlotText slotKey={`${prefix}.for`} as="dd" sx={valueSx} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <SlotText slotKey="prohlidky.cmp.label.duration" as="dt" sx={labelSx} />
          <SlotText slotKey={`${prefix}.duration`} as="dd" sx={{ ...valueSx, fontWeight: 600, color: W.text }} />
        </Box>
      </Box>
      <CtaButton to={BOOKING_PATH} height={46} fontSize={15} variant="ghostLight" sx={{ mt: 'auto', width: '100%' }}>{book}</CtaButton>
    </Box>
  );
}

export default function ProhlidkyPage() {
  const { data: prices } = usePriceList();
  const docs = useSlotText('sluzby.shared.docs.link');
  const own = categoryItems(prices, CATEGORY.prohlidky);
  const shown = new Set(PACKAGES.map((pkg) => findItem(prices, pkg.pattern)).filter((item): item is PriceItem => item !== null));
  const others = own.filter((item) => !shown.has(item));

  return (
    <>
      <ServiceHero page="prohlidky" />

      <PageSection title="prohlidky.cmp.title" lead="prohlidky.cmp.lead">
        <Box sx={gridOf(300, 20)}>
          {PACKAGES.map((pkg) => (
            <PackageCard key={pkg.n} n={pkg.n} item={findItem(prices, pkg.pattern)} />
          ))}
        </Box>
        {others.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <SlotText slotKey="prohlidky.cmp.more" as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 20 }} />
            <PriceRowList items={others} />
          </Box>
        )}
      </PageSection>

      <PageSection title="prohlidky.info.title" tone="warm">
        <InfoCards prefix="prohlidky.info" count={4} numbered />
        <ArrowLink to="/dokumenty">{docs}</ArrowLink>
      </PageSection>

      <PageSection title="prohlidky.flow.title" lead="prohlidky.flow.lead">
        <PhotoGallery prefix="prohlidky.flow" count={4} label="Fotografie z průběhu vyšetření" />
      </PageSection>

      <GroupDiscounts />
    </>
  );
}
