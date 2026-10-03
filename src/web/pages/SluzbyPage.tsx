/* /sluzby — the overview of the services (artboard V-Sluzby), with what the live "Služby" page says:
   the four slogans, a card per service with its photo, a sentence and the first rows of its price
   list (amounts from the price list, "—" when unknown), single examinations, packages (the rows of
   the price list's package category), offers for groups and clubs, a link to the equipment page and
   the group discounts (from the discount tiers). */

import { Box } from '@mui/material';
import { pickRows, usePriceList } from '../../api/priceList';
import type { RowSpec } from '../../api/priceList';
import { MediaSlot } from '../../site/MediaSlot';
import { SlotText, useSlotText } from '../../site/SlotText';
import { SLUZBY_GROUPS, SLUZBY_PACKAGES, SLUZBY_SINGLE, SLUZBY_SLOGANS } from '../../site/slots/sluzby';
import { BOOKING_PATH } from '../../components/public/PublicHeader';
import { FALLBACK_ROWS, ROW_SPECS } from '../landing/rows';
import { ArrowLink, CtaButton, SectionTitle, WebSection } from '../ui';
import { FONT_HEAD, W } from '../tokens';
import { BookButton, Bullets, CARD_SX, GroupDiscounts, PageSection, Paras, PriceRowList, gridOf } from './services/blocks';
import { CATEGORY, categoryItems } from './services/pricing';
import { ServiceHero } from './services/ServiceHero';

interface ServiceDef {
  n: 1 | 2 | 3;
  to: string;
  spec: RowSpec;
  fallback: readonly string[];
}

const SERVICES: ServiceDef[] = [
  { n: 1, to: '/prohlidky', spec: ROW_SPECS.prohlidky, fallback: FALLBACK_ROWS.prohlidky },
  { n: 2, to: '/diagnostika', spec: ROW_SPECS.diagnostika, fallback: FALLBACK_ROWS.diagnostika },
  { n: 3, to: '/inbody', spec: ROW_SPECS.inbody, fallback: FALLBACK_ROWS.inbody },
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
  const { data: prices } = usePriceList();
  const book = useSlotText('sluzby.shared.cta.book');
  const groupsLink = useSlotText('sluzby.groups.link');
  const equipmentLink = useSlotText('sluzby.equipment.link');
  const combos = categoryItems(prices, CATEGORY.balicky);

  return (
    <>
      <ServiceHero page="sluzby" />

      <WebSection tone="warm" py={[28, 36]} sx={{ borderBottom: `1px solid ${W.line}` }}>
        <Bullets prefix="sluzby.slogans" count={SLUZBY_SLOGANS.length} minWidth={260} />
      </WebSection>

      <WebSection py={[48, 72]} innerSx={{ display: 'flex', flexDirection: 'column', gap: { xs: '24px', md: '32px' } }}>
        <SectionTitle size="md"><SlotText slotKey="sluzby.blocks.title" /></SectionTitle>
        <Box sx={gridOf(300, 20)}>
          {SERVICES.map((def) => (
            <ServiceCard key={def.n} def={def} />
          ))}
        </Box>
        <BookButton text={book} />
      </WebSection>

      <PageSection tone="warm">
        <Box sx={gridOf(300, 24)}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SlotText slotKey="sluzby.single.title" as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: { xs: 24, md: 28 }, letterSpacing: '-0.025em' }} />
            <Paras prefix="sluzby.single" count={SLUZBY_SINGLE.length} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SlotText slotKey="sluzby.packages.title" as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: { xs: 24, md: 28 }, letterSpacing: '-0.025em' }} />
            <Paras prefix="sluzby.packages" count={SLUZBY_PACKAGES.length} />
            <PriceRowList items={combos} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SlotText slotKey="sluzby.groups.title" as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: { xs: 24, md: 28 }, letterSpacing: '-0.025em' }} />
            <Paras prefix="sluzby.groups" count={SLUZBY_GROUPS.length} />
            <ArrowLink to="/kluby">{groupsLink}</ArrowLink>
          </Box>
        </Box>
      </PageSection>

      <PageSection title="sluzby.equipment.title">
        <ArrowLink to="/vybaveni">{equipmentLink}</ArrowLink>
      </PageSection>

      <GroupDiscounts />
    </>
  );
}

