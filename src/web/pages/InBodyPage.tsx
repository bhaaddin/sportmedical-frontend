/* /inbody — InBody 770 (artboard V-InBody) with everything the live page says: what the device
   measures, "u nás jako standard", the diagnostic precision, the parameters, no estimates, the four
   price cards (✔ / ✘ lists, amounts from the price list only; ordered online or by phone — the
   number is the clinic's own), preparation and contraindications, how it works, how it differs from
   a smart scale, how long it takes, the group discounts (discount tiers). Slots: src/site/slots/inbody.ts. */

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { usePriceList } from '../../api/priceList';
import type { PriceItem } from '../../api/priceList';
import { MediaSlot } from '../../site/MediaSlot';
import { SlotText, useSlotText } from '../../site/SlotText';
import { Eyebrow, SectionTitle, WebSection } from '../ui';
import { FONT_HEAD, MQ, W } from '../tokens';
import { BookButton, Bullets, CARD_SX, GroupDiscounts, InfoCards, PageSection, Paras, PriceRowList, SubTitle, gridOf } from './services/blocks';
import { PriceCard } from './services/PriceCard';
import { CATEGORY, categoryItems, matchItem } from './services/pricing';
import { ServiceHero } from './services/ServiceHero';
import {
  INBODY_CARDS, INBODY_CARD_PREFIX, INBODY_DURATION, INBODY_FEATURES, INBODY_HOW, INBODY_LINES, INBODY_LINE_PREFIX, INBODY_PARAMS, INBODY_PRECISE,
  INBODY_PRECISION, INBODY_PREP, INBODY_PRICE, INBODY_STANDARD, INBODY_VS,
} from './services/content/inbody';

const H3_SX = { m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 21, letterSpacing: '-0.02em', lineHeight: 1.2 } as const;

function TextCard({ children }: { children: ReactNode }) {
  return <Box component="article" sx={[{ p: { xs: '20px', md: '24px' }, display: 'flex', flexDirection: 'column', gap: '12px' }, CARD_SX as object, { borderRadius: '16px' }]}>{children}</Box>;
}

export default function InBodyPage() {
  const { data: prices } = usePriceList();
  const book = useSlotText('sluzby.shared.cta.book');
  const shown = new Set(INBODY_CARDS.map((card) => matchItem(prices, card.match)).filter((item): item is PriceItem => item !== null));
  const others = categoryItems(prices, CATEGORY.inbody).filter((item) => !shown.has(item));

  return (
    <>
      <ServiceHero page="inbody" />

      <PageSection title="inbody.features.title" tone="warm">
        <InfoCards prefix="inbody.features" count={INBODY_FEATURES.cards.length} minWidth={240} />
      </PageSection>

      <WebSection py={[48, 72]}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '28px', md: '44px' }, alignItems: 'center', [MQ.desktop]: { gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)' } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Eyebrow><SlotText slotKey="inbody.standard.eyebrow" /></Eyebrow>
            <SectionTitle size="md"><SlotText slotKey="inbody.standard.title" /></SectionTitle>
            <Paras prefix="inbody.standard" count={INBODY_STANDARD.paras.length} />
          </Box>
          <Box sx={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {INBODY_STANDARD.photos.map((_, index) => (
              <MediaSlot key={index} slotKey={`inbody.standard.photo${index + 1}`} sizes="(max-width: 767px) 50vw, 300px" sx={{ borderRadius: '14px', aspectRatio: '3 / 4', minHeight: 0 }} />
            ))}
          </Box>
        </Box>
      </WebSection>

      <WebSection tone="warm" py={[48, 72]}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '28px', md: '44px' }, alignItems: 'center', [MQ.desktop]: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SectionTitle size="md"><SlotText slotKey="inbody.precision.title" /></SectionTitle>
            <Paras prefix="inbody.precision" count={INBODY_PRECISION.paras.length} />
          </Box>
          <MediaSlot slotKey="inbody.precision.photo" sizes="(max-width: 1279px) 100vw, 600px" sx={{ borderRadius: '16px', aspectRatio: '4 / 3', minHeight: 0 }} />
        </Box>
      </WebSection>

      <PageSection title="inbody.params.title">
        <InfoCards prefix="inbody.params" count={INBODY_PARAMS.cards.length} minWidth={300} />
      </PageSection>

      <PageSection title="inbody.precise.title" tone="warm">
        <InfoCards prefix="inbody.precise" count={INBODY_PRECISE.cards.length} minWidth={280} numbered />
        <MediaSlot slotKey="inbody.precise.photo" sizes="(max-width: 1279px) 100vw, 1200px" sx={{ borderRadius: '16px', aspectRatio: '16 / 7', minHeight: 0 }} />
      </PageSection>

      <PageSection title="inbody.price.title">
        <Paras prefix="inbody.price" count={INBODY_PRICE.paras.length} />
        <Box sx={gridOf(320, 20)}>
          {INBODY_CARDS.map((card) => (
            <PriceCard key={card.id} card={card} prefix={INBODY_CARD_PREFIX} linePrefix={INBODY_LINE_PREFIX} lines={INBODY_LINES} prices={prices} />
          ))}
        </Box>
        {others.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <SlotText slotKey="inbody.price.more" as="h3" sx={{ ...H3_SX, fontSize: 20 }} />
            <PriceRowList items={others} />
          </Box>
        )}
        <BookButton text={book} />
      </PageSection>

      <PageSection title="inbody.prep.title" tone="warm">
        <Box sx={gridOf(300, 20)}>
          <TextCard>
            <SubTitle slotKey="inbody.prep.rules.title" />
            <Bullets prefix="inbody.prep.rules" count={INBODY_PREP.rules.items.length} />
          </TextCard>
          <TextCard>
            <SubTitle slotKey="inbody.prep.extra.title" />
            <Bullets prefix="inbody.prep.extra" count={INBODY_PREP.extra.items.length} />
          </TextCard>
          <TextCard>
            <SubTitle slotKey="inbody.prep.contra.title" />
            <Bullets prefix="inbody.prep.contra" count={INBODY_PREP.contra.items.length} />
          </TextCard>
        </Box>
        <Paras prefix="inbody.prep.closing" count={INBODY_PREP.closing.length} />
      </PageSection>

      <PageSection title="inbody.how.title">
        <Paras prefix="inbody.how" count={INBODY_HOW.paras.length} />
        <SubTitle slotKey="inbody.how.flow.title" />
        <Paras prefix="inbody.how.flow" count={INBODY_HOW.flow.length} />
        <SubTitle slotKey="inbody.how.features.title" />
        <Bullets prefix="inbody.how.features" count={INBODY_HOW.features.length} />
        <Paras prefix="inbody.how.closing" count={INBODY_HOW.closing.length} />
      </PageSection>

      <PageSection title="inbody.vs.title" tone="warm">
        <Paras prefix="inbody.vs" count={INBODY_VS.paras.length} />
      </PageSection>

      <PageSection title="inbody.duration.title">
        <Paras prefix="inbody.duration" count={INBODY_DURATION.paras.length} />
      </PageSection>

      <GroupDiscounts />
    </>
  );
}
