/* /diagnostika — sports diagnostics (artboard V-Diagnostika) with everything the live page says:
   the five services (what each measures, with a link to its own page), the key message, made-to-measure packages,
   the technology (milliseconds, six technical cards), "od vizualizace ke změně", how long
   it takes / what the report contains / how often to repeat, the price cards (✔ / ✘ lists, amounts
   from the price list only), the group discounts (discount tiers) and the booking. Every sentence
   is a slot of src/site/slots/diagnostika.ts, drawn from the same arrays. */

import { Box } from '@mui/material';
import { usePriceList } from '../../api/priceList';
import type { PriceItem } from '../../api/priceList';
import { MediaSlot } from '../../site/MediaSlot';
import { SlotText, useSlotText } from '../../site/SlotText';
import { ArrowLink, CtaButton, Eyebrow, SectionTitle, WebSection } from '../ui';
import { BOOKING_PATH } from '../../components/public/PublicHeader';
import { FONT_HEAD, MQ, W } from '../tokens';
import { Bullets, CARD_SX, GroupDiscounts, InfoCards, PackageNote, PageSection, Paras, PriceRowList, SubTitle, gridOf } from './services/blocks';
import { PriceCard } from './services/PriceCard';
import { CATEGORY, categoryItems, matchItem } from './services/pricing';
import { ServiceHero } from './services/ServiceHero';
import { DIAG_CARDS, DIAG_CARD_PREFIX, DIAG_LINES, DIAG_LINE_PREFIX, DIAG_PRICE_SECTION_IDS, cardById } from './services/content/diagCards';
import { DIAG_FAQ, DIAG_FEATURES, DIAG_SERVICES, DIAG_TECH, DIAG_VIZ } from './services/content/diagnostika';

const H3_SX = { m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 21, letterSpacing: '-0.02em', lineHeight: 1.2 } as const;

function ServiceCard({ index }: { index: number }) {
  const n = index + 1;
  const service = DIAG_SERVICES[index];
  const link = useSlotText('diagnostika.services.link');
  const prefix = `diagnostika.service.${n}`;
  return (
    <Box component="article" sx={[{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }, CARD_SX as object, { borderRadius: '16px' }]}>
      <MediaSlot slotKey={`${prefix}.photo`} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 45vw, 400px" sx={{ borderRadius: 0, aspectRatio: '3 / 2', minHeight: 0 }} />
      <Box sx={{ p: { xs: '22px 20px', md: '24px' }, display: 'flex', flexDirection: 'column', gap: '12px', flex: '1 1 auto' }}>
        <SlotText slotKey={`${prefix}.title`} as="h3" sx={H3_SX} />
        <SlotText slotKey={`${prefix}.text`} as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.body, fontWeight: 600 }} />
        {service.feature !== undefined && (
          <SlotText slotKey={`${prefix}.feature`} as="p" sx={{ m: 0, fontSize: 14, lineHeight: 1.6, color: W.orangeText, fontWeight: 600 }} />
        )}
        <SlotText slotKey={`${prefix}.description`} as="p" sx={{ m: 0, fontSize: 14, lineHeight: 1.65, color: W.bodySoft }} />
        <Box sx={{ mt: 'auto', pt: '4px' }}>
          <ArrowLink to={service.to}>{link}</ArrowLink>
        </Box>
      </Box>
    </Box>
  );
}

function VizItem({ index }: { index: number }) {
  const n = index + 1;
  const viz = DIAG_VIZ[index];
  const prefix = `diagnostika.viz.${n}`;
  return (
    <Box component="article" sx={[{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }, CARD_SX as object, { borderRadius: '16px' }]}>
      <MediaSlot slotKey={`${prefix}.photo`} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 45vw, 400px" sx={{ borderRadius: 0, aspectRatio: '4 / 3', minHeight: 0 }} />
      <Box sx={{ p: '20px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SlotText slotKey={`${prefix}.title`} as="h3" sx={{ ...H3_SX, fontSize: 18 }} />
        <SlotText slotKey={`${prefix}.text`} as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.body, fontWeight: 600 }} />
        {viz.long !== undefined && <SlotText slotKey={`${prefix}.long`} as="p" sx={{ m: 0, fontSize: 14, lineHeight: 1.65, color: W.bodySoft }} />}
      </Box>
    </Box>
  );
}

export default function DiagnostikaPage() {
  const { data: prices } = usePriceList();
  const customLink = useSlotText('diagnostika.custom.link');
  const docsLink = useSlotText('diagnostika.info.docs');
  const pricesLink = useSlotText('diagnostika.info.prices');
  const bookText = useSlotText('diagnostika.booking.button');

  const shown = new Set(
    DIAG_CARDS.map((card) => matchItem(prices, card.match)).filter((item): item is PriceItem => item !== null),
  );
  const others = [...categoryItems(prices, CATEGORY.diagnostika), ...categoryItems(prices, CATEGORY.balicky)].filter((item) => !shown.has(item));

  return (
    <>
      <ServiceHero page="diagnostika" />

      <PageSection title="diagnostika.services.title">
        <Box sx={gridOf(300, 20)}>
          {DIAG_SERVICES.map((service, index) => (
            <ServiceCard key={service.title} index={index} />
          ))}
        </Box>
      </PageSection>

      <WebSection tone="warm" py={[48, 72]} innerSx={{ display: 'flex', flexDirection: 'column', gap: { xs: '22px', md: '28px' } }}>
        <Eyebrow><SlotText slotKey="diagnostika.key.eyebrow" /></Eyebrow>
        <SectionTitle size="md"><SlotText slotKey="diagnostika.key.title" /></SectionTitle>
        <SlotText slotKey="diagnostika.key.text" as="p" sx={{ m: 0, fontSize: 17, lineHeight: 1.7, color: W.body, maxWidth: '78ch' }} />
        <Bullets prefix="diagnostika.features" count={DIAG_FEATURES.length} minWidth={300} />
      </WebSection>

      <PageSection title="diagnostika.custom.title">
        <SlotText slotKey="diagnostika.custom.text" as="p" sx={{ m: 0, fontSize: 17, lineHeight: 1.65, color: W.body, maxWidth: '70ch' }} />
        <ArrowLink to="/kontakt">{customLink}</ArrowLink>
      </PageSection>

      <PageSection title="diagnostika.tech.title" tone="warm">
        <SubTitle slotKey="diagnostika.tech.subtitle" tone="accent" />
        <SlotText slotKey="diagnostika.tech.text" as="p" sx={{ m: 0, fontSize: 16, lineHeight: 1.7, color: W.body, maxWidth: '78ch' }} />
        <InfoCards prefix="diagnostika.tech" count={DIAG_TECH.cards.length} minWidth={280} />
      </PageSection>

      <PageSection title="diagnostika.viz.title">
        <Box sx={gridOf(300, 20)}>
          {DIAG_VIZ.map((viz, index) => (
            <VizItem key={viz.title} index={index} />
          ))}
        </Box>
        <MediaSlot slotKey="diagnostika.viz.photo7" sizes="(max-width: 1279px) 100vw, 1200px" sx={{ borderRadius: '16px', aspectRatio: '16 / 7', minHeight: 0 }} />
      </PageSection>

      <PageSection title="diagnostika.faq.duration.title" tone="warm">
        <Paras prefix="diagnostika.faq.duration" count={DIAG_FAQ.duration.paras.length} />
        <SlotText slotKey="diagnostika.faq.report.title" as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: { xs: 24, md: 30 }, letterSpacing: '-0.03em', pt: '12px' }} />
        <SubTitle slotKey="diagnostika.faq.report.rawtitle" />
        <Paras prefix="diagnostika.faq.report.raw" count={DIAG_FAQ.report.raw.length} />
        <SubTitle slotKey="diagnostika.faq.report.listtitle" />
        <Bullets prefix="diagnostika.faq.report" count={DIAG_FAQ.report.items.length} />
        <Paras prefix="diagnostika.faq.report.closing" count={DIAG_FAQ.report.closing.length} />
        <SlotText slotKey="diagnostika.faq.repeat.title" as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: { xs: 24, md: 30 }, letterSpacing: '-0.03em', pt: '12px' }} />
        <Paras prefix="diagnostika.faq.repeat" count={DIAG_FAQ.repeat.paras.length} />
      </PageSection>

      <PageSection title="diagnostika.price.title" lead="diagnostika.price.text">
        <Box sx={gridOf(320, 20)}>
          {DIAG_PRICE_SECTION_IDS.map((id) => (
            <PriceCard key={id} card={cardById(id)} prefix={DIAG_CARD_PREFIX} linePrefix={DIAG_LINE_PREFIX} lines={DIAG_LINES} prices={prices} />
          ))}
        </Box>
        {others.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <SlotText slotKey="diagnostika.price.more" as="h3" sx={{ ...H3_SX, fontSize: 20 }} />
            <PriceRowList items={others} />
          </Box>
        )}
        <PackageNote />
      </PageSection>

      <GroupDiscounts />

      <PageSection title="diagnostika.info.title" tone="warm">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 28px' }}>
          <ArrowLink to="/dokumenty">{docsLink}</ArrowLink>
          <ArrowLink to="/cenik">{pricesLink}</ArrowLink>
        </Box>
      </PageSection>

      <WebSection py={[44, 64]} innerSx={{ display: 'grid', gap: '18px', maxWidth: 760 }}>
        <SlotText slotKey="diagnostika.booking.title" as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: { xs: 26, md: 32 }, letterSpacing: '-0.03em' }} />
        <SlotText slotKey="diagnostika.booking.text" as="p" sx={{ m: 0, fontSize: 16, lineHeight: 1.65, color: W.body }} />
        <Box sx={{ display: 'flex', [MQ.phoneOnly]: { '& a': { width: '100%' } } }}>
          <CtaButton to={BOOKING_PATH} height={50} fontSize={16} px={28}>{bookText}</CtaButton>
        </Box>
      </WebSection>
    </>
  );
}
