/* ══════════════════════════════════════════════════════════════
   A DETAIL PAGE OF SPORTOVNÍ DIAGNOSTIKA (/diagnostika/zakladni, /komplexni, /vo2max, /kompenzacni-plan)

   Hero, the sections of its spec (prose, cards, two columns), the price card(s) of its own service
   (amount from the price list, found by name; "—" when unknown) with the "Objednat termín" button,
   the group discounts (discount tiers) and links to the hub and to the other diagnostics pages.
   ══════════════════════════════════════════════════════════════ */

import { Box } from '@mui/material';
import { usePriceList } from '../../../api/priceList';
import { MediaSlot } from '../../../site/MediaSlot';
import { SlotText } from '../../../site/SlotText';
import { ArrowLink, WebSection } from '../../ui';
import { FONT_HEAD, MQ, W } from '../../tokens';
import { Bullets, CARD_SX, GroupDiscounts, InfoCards, PageSection, Paras, gridOf } from './blocks';
import { PriceCard } from './PriceCard';
import { ServiceHero } from './ServiceHero';
import { DIAG_CARD_PREFIX, DIAG_LINES, DIAG_LINE_PREFIX, cardById } from './content/diagCards';
import type { DetailSection, DetailSpec } from './content/details';

const OTHERS = [
  { to: '/diagnostika/zakladni', key: 'diagnostika.service.1.title', page: 'diagzakladni' },
  { to: '/diagnostika/komplexni', key: 'diagnostika.service.2.title', page: 'diagkomplexni' },
  { to: '/diagnostika/vo2max', key: 'diagnostika.service.3.title', page: 'diagvo2max' },
  { to: '/diagnostika/kompenzacni-plan', key: 'diagnostika.service.4.title', page: 'diagkompenzacni' },
] as const;

function Section({ page, section }: { page: string; section: DetailSection }) {
  const prefix = `${page}.${section.id}`;
  const tone = section.tone ?? 'white';
  if (section.kind === 'prose') {
    const hasPhoto = section.photo !== undefined;
    return (
      <PageSection title={`${prefix}.title`} tone={tone}>
        <Box
          sx={{
            display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '22px', md: '40px' }, alignItems: 'start',
            ...(hasPhoto ? { [MQ.desktop]: { gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)' } } : {}),
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
            {section.sub !== undefined && <SlotText slotKey={`${prefix}.sub`} as="p" sx={{ m: 0, fontSize: 18, fontWeight: 700, color: W.orangeText }} />}
            <Paras prefix={prefix} count={section.paras.length} />
            {section.bullets !== undefined && <Bullets prefix={prefix} count={section.bullets.length} />}
          </Box>
          {hasPhoto && <MediaSlot slotKey={`${prefix}.photo`} sizes="(max-width: 1279px) 100vw, 500px" sx={{ borderRadius: '16px', aspectRatio: '4 / 3', minHeight: 0 }} />}
        </Box>
      </PageSection>
    );
  }
  if (section.kind === 'cards') {
    return (
      <PageSection title={`${prefix}.title`} lead={section.lead !== undefined ? `${prefix}.lead` : undefined} tone={tone}>
        <InfoCards prefix={prefix} count={section.cards.length} more={section.cards.some((card) => card.more !== undefined)} numbered={section.numbered} minWidth={280} />
        {section.photo !== undefined && (
          <MediaSlot slotKey={`${prefix}.photo`} sizes="(max-width: 1279px) 100vw, 1200px" sx={{ borderRadius: '16px', aspectRatio: '16 / 7', minHeight: 0 }} />
        )}
      </PageSection>
    );
  }
  return (
    <PageSection title={`${prefix}.title`} lead={section.lead !== undefined ? `${prefix}.lead` : undefined} tone={tone}>
      <Box sx={gridOf(420, 24)}>
        {section.items.map((item, index) => (
          <Box key={item.title} component="article" sx={[{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }, CARD_SX as object, { borderRadius: '16px' }]}>
            <MediaSlot slotKey={`${prefix}.${index + 1}.photo`} sizes="(max-width: 1279px) 100vw, 600px" sx={{ borderRadius: 0, aspectRatio: '16 / 9', minHeight: 0 }} />
            <Box sx={{ p: { xs: '20px', md: '24px' }, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <SlotText slotKey={`${prefix}.${index + 1}.title`} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 21, letterSpacing: '-0.02em' }} />
              <Paras prefix={`${prefix}.${index + 1}`} count={item.paras.length} sx={{ fontSize: 15 }} />
            </Box>
          </Box>
        ))}
      </Box>
    </PageSection>
  );
}

export function DetailPage({ spec }: { spec: DetailSpec }) {
  const { data: prices } = usePriceList();
  return (
    <>
      <ServiceHero page={spec.page} />

      {spec.sections.map((section) => (
        <Section key={section.id} page={spec.page} section={section} />
      ))}

      <PageSection title={`${spec.page}.price.title`} tone="warm">
        <Box sx={gridOf(340, 20)}>
          {spec.cardIds.map((id) => (
            <PriceCard key={id} card={cardById(id)} prefix={DIAG_CARD_PREFIX} linePrefix={DIAG_LINE_PREFIX} lines={DIAG_LINES} prices={prices} />
          ))}
        </Box>
      </PageSection>

      <GroupDiscounts />

      <WebSection py={[40, 56]} innerSx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SlotText slotKey={`${spec.page}.more.title`} as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: { xs: 24, md: 28 }, letterSpacing: '-0.025em' }} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0 28px' }}>
          <ArrowLink to="/diagnostika"><SlotText slotKey="diagnostika.hero.title" /></ArrowLink>
          {OTHERS.filter((other) => other.page !== spec.page).map((other) => (
            <ArrowLink key={other.to} to={other.to}><SlotText slotKey={other.key} /></ArrowLink>
          ))}
        </Box>
      </WebSection>
    </>
  );
}
