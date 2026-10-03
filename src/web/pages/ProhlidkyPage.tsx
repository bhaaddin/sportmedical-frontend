/* /prohlidky — the sports medical examinations (artboard V-Prohlidky), with everything the live
   site says about them: the three examinations (what is included, for whom), the comparison table,
   the required documents, preparation / duration / contraindications / validity, the combined
   packages, mobile tests for clubs, the equipment (a link), the price cards with ✔ / ✘ lists, the
   group discounts. Every sentence is a slot (src/site/slots/prohlidky.ts, same arrays); amounts come
   from the price list only; the discounts come from the discount tiers. */

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { usePriceList } from '../../api/priceList';
import type { PriceCategory, PriceItem } from '../../api/priceList';
import { MediaSlot } from '../../site/MediaSlot';
import { SlotText, useSlotText } from '../../site/SlotText';
import { ArrowLink, CtaButton, Eyebrow, SectionTitle, WebSection } from '../ui';
import { BOOKING_PATH } from '../../components/public/PublicHeader';
import { FONT_HEAD, MQ, W } from '../tokens';
import {
  BookButton, Bullets, CARD_SX, GroupDiscounts, PackageNote, PageSection, Paras, PriceRowList, PriceTag, SubTitle, gridOf,
} from './services/blocks';
import { PriceCard } from './services/PriceCard';
import { CATEGORY, categoryItems, findItem, matchItem } from './services/pricing';
import { ServiceHero } from './services/ServiceHero';
import { DIAG_CARD_PREFIX, DIAG_LINES, DIAG_LINE_PREFIX, PACKAGE_CARD_IDS, cardById } from './services/content/diagCards';
import {
  CMP, CMP_ROWS, DOCS, DURATION, EXAMS, EXAM_CARDS, EXAM_CARD_PREFIX, EXAM_LINES, EXAM_LINE_PREFIX, INSTRUCTIONS, MOBILE, PACKAGES, PREP,
  PRICE_SECTION, VALIDITY, WHEN_NOT,
} from './services/content/prohlidky';

const H3_SX = { m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 21, letterSpacing: '-0.02em', lineHeight: 1.2 } as const;

function ExamCard({ index, item }: { index: number; item: PriceItem | null }) {
  const n = index + 1;
  const exam = EXAMS[index];
  const book = useSlotText('sluzby.shared.cta.book');
  const prefix = `prohlidky.exam.${n}`;
  return (
    <Box component="article" sx={[{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }, CARD_SX as object, { borderRadius: '16px' }]}>
      <MediaSlot slotKey={`${prefix}.photo`} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 45vw, 400px" sx={{ borderRadius: 0, aspectRatio: '3 / 2', minHeight: 0 }} />
      <Box sx={{ p: { xs: '22px 20px', md: '24px' }, display: 'flex', flexDirection: 'column', gap: '14px', flex: '1 1 auto' }}>
        <SlotText slotKey={`${prefix}.title`} as="h3" sx={H3_SX} />
        <Box component="p" sx={{ m: 0 }}><PriceTag item={item} size={28} /></Box>
        <SlotText slotKey={`${prefix}.text`} as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.body }} />
        <Bullets prefix={prefix} count={exam.bullets.length} />
        <SlotText slotKey={`${prefix}.more`} as="p" sx={{ m: 0, fontSize: 14, lineHeight: 1.65, color: W.bodySoft }} />
        <CtaButton to={BOOKING_PATH} height={46} fontSize={15} variant="ghostLight" sx={{ mt: 'auto', width: '100%' }}>{book}</CtaButton>
      </Box>
    </Box>
  );
}

function Cell({ value, slotKey }: { value: boolean | string; slotKey: string }) {
  const yes = value === true;
  const no = value === false;
  return (
    <Box component="td" sx={{ p: '12px 14px', borderTop: `1px solid ${W.line}`, fontSize: 15, lineHeight: 1.5, verticalAlign: 'top', minWidth: 150 }}>
      <SlotText
        slotKey={slotKey}
        sx={yes ? { fontWeight: 700, color: '#1E6B34' } : no ? { color: W.muted } : undefined}
      />
    </Box>
  );
}

function ComparisonTable({ items }: { items: (PriceItem | null)[] }) {
  const label = useSlotText('prohlidky.cmp.caption');
  const headSx = { p: '14px', textAlign: 'left', fontSize: 14, fontWeight: 700, lineHeight: 1.4, verticalAlign: 'bottom', bgcolor: W.warm, minWidth: 150 } as const;
  return (
    <Box
      role="region"
      aria-label={label}
      tabIndex={0}
      sx={{ overflowX: 'auto', border: `1px solid ${W.lineStrong}`, borderRadius: '14px', bgcolor: W.white, WebkitOverflowScrolling: 'touch' }}
    >
      <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
        <Box component="thead">
          <Box component="tr">
            {CMP.heads.map((_, index) => (
              <Box key={index} component="th" scope="col" sx={headSx}>
                <SlotText slotKey={`prohlidky.cmp.h${index}`} />
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {CMP_ROWS.map((row, rowIndex) => (
            <Box key={rowIndex} component="tr">
              <Box component="th" scope="row" sx={{ p: '12px 14px', borderTop: `1px solid ${W.line}`, textAlign: 'left', fontSize: 15, fontWeight: 600, lineHeight: 1.45, verticalAlign: 'top', minWidth: 190 }}>
                <SlotText slotKey={`prohlidky.cmp.r${rowIndex + 1}.label`} />
              </Box>
              {row.cells.map((cell, cellIndex) => (
                <Cell
                  key={cellIndex}
                  value={cell}
                  slotKey={typeof cell === 'string' ? `prohlidky.cmp.r${rowIndex + 1}.c${cellIndex + 1}` : cell ? 'prohlidky.cmp.yes' : 'prohlidky.cmp.no'}
                />
              ))}
            </Box>
          ))}
          <Box component="tr">
            <Box component="th" scope="row" sx={{ p: '14px', borderTop: `1px solid ${W.lineStrong}`, textAlign: 'left', fontSize: 15, fontWeight: 700 }}>
              <SlotText slotKey="prohlidky.cmp.price" />
            </Box>
            {items.map((item, index) => (
              <Box key={index} component="td" sx={{ p: '14px', borderTop: `1px solid ${W.lineStrong}` }}>
                <PriceTag item={item} size={20} />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function TextCard({ children }: { children: ReactNode }) {
  return <Box component="article" sx={[{ p: { xs: '20px', md: '24px' }, display: 'flex', flexDirection: 'column', gap: '12px' }, CARD_SX as object, { borderRadius: '16px' }]}>{children}</Box>;
}

export default function ProhlidkyPage() {
  const { data: prices } = usePriceList();
  const docsLink = useSlotText('sluzby.shared.docs.link');
  const book = useSlotText('sluzby.shared.cta.book');
  const clubsLink = useSlotText('prohlidky.mobile.link');
  const equipmentLink = useSlotText('prohlidky.equipment.link');
  const examItems = EXAMS.map((exam) => findItem(prices, exam.pattern));
  const shown = new Set(examItems.filter((item): item is PriceItem => item !== null));
  const others = categoryItems(prices, CATEGORY.prohlidky).filter((item) => !shown.has(item) && !packageRows(prices).has(item));

  return (
    <>
      <ServiceHero page="prohlidky" />

      <PageSection title="prohlidky.exams.title" lead="prohlidky.exams.lead">
        <Box sx={gridOf(300, 20)}>
          {EXAMS.map((exam, index) => (
            <ExamCard key={exam.title} index={index} item={examItems[index]} />
          ))}
        </Box>
      </PageSection>

      <PageSection title="prohlidky.cmp.title" lead="prohlidky.cmp.lead" tone="warm">
        <ComparisonTable items={examItems} />
      </PageSection>

      <PageSection title="prohlidky.docs.title">
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, ...(gridOf(300, 20) as object) }}>
          {DOCS.map((doc, index) => (
            <Box key={doc.title} component="li" sx={{ display: 'flex' }}>
              <TextCard>
                <SlotText slotKey={`prohlidky.docs.${index + 1}.title`} as="h3" sx={{ ...H3_SX, fontSize: 18 }} />
                <Paras prefix={`prohlidky.docs.${index + 1}`} count={doc.paras.length} sx={{ fontSize: 15, color: W.bodySoft }} />
              </TextCard>
            </Box>
          ))}
        </Box>
        <ArrowLink to="/dokumenty">{docsLink}</ArrowLink>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: 760 }}>
          <SlotText slotKey="prohlidky.instr.title" as="h3" sx={{ ...H3_SX, fontSize: 20 }} />
          <SlotText slotKey="prohlidky.instr.subtitle" as="p" sx={{ m: 0, fontSize: 16, fontWeight: 700, color: W.text }} />
          <SlotText slotKey="prohlidky.instr.text" as="p" sx={{ m: 0, fontSize: 16, lineHeight: 1.65, color: W.body }} />
        </Box>
      </PageSection>

      <PageSection title="prohlidky.prep.title" tone="warm">
        <Box sx={gridOf(300, 20)}>
          <TextCard>
            <SubTitle slotKey="prohlidky.prep.before.title" />
            <Paras prefix="prohlidky.prep.before" count={PREP.before.paras.length} sx={{ fontSize: 15 }} />
          </TextCard>
          <TextCard>
            <SubTitle slotKey="prohlidky.prep.bring.title" />
            <Bullets prefix="prohlidky.prep.bring" count={PREP.bring.items.length} />
          </TextCard>
          <TextCard>
            <SubTitle slotKey="prohlidky.prep.closing.title" />
            <Paras prefix="prohlidky.prep.closing" count={PREP.closing.paras.length} sx={{ fontSize: 15 }} />
          </TextCard>
        </Box>
      </PageSection>

      <PageSection title="prohlidky.duration.title">
        <Box sx={gridOf(320, 20)}>
          <TextCard>
            <SubTitle slotKey="prohlidky.duration.ergo.title" />
            <Paras prefix="prohlidky.duration.ergo" count={DURATION.ergo.paras.length} sx={{ fontSize: 15 }} />
          </TextCard>
          <TextCard>
            <SubTitle slotKey="prohlidky.duration.spiro.title" />
            <Paras prefix="prohlidky.duration.spiro" count={DURATION.spiro.paras.length} sx={{ fontSize: 15 }} />
          </TextCard>
        </Box>
      </PageSection>

      <PageSection title="prohlidky.whennot.title" tone="warm">
        <Bullets prefix="prohlidky.whennot" count={WHEN_NOT.items.length} minWidth={300} />
        <Paras prefix="prohlidky.whennot" count={WHEN_NOT.paras.length} />
        <SubTitle slotKey="prohlidky.whennot.legal.title" />
        <Paras prefix="prohlidky.whennot.legal" count={WHEN_NOT.legal.length} />
      </PageSection>

      <PageSection title="prohlidky.validity.title">
        <Paras prefix="prohlidky.validity" count={VALIDITY.paras.length} />
      </PageSection>

      <PageSection title="prohlidky.packages.title" tone="warm">
        <Paras prefix="prohlidky.packages" count={PACKAGES.paras.length} />
        <PackageNote />
        <Box sx={gridOf(320, 20)}>
          {PACKAGE_CARD_IDS.map((id) => (
            <PriceCard key={id} card={cardById(id)} prefix={DIAG_CARD_PREFIX} linePrefix={DIAG_LINE_PREFIX} lines={DIAG_LINES} prices={prices} />
          ))}
        </Box>
      </PageSection>

      <WebSection py={[48, 72]}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '28px', md: '44px' }, alignItems: 'center', [MQ.tablet]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Eyebrow><SlotText slotKey="prohlidky.mobile.eyebrow" /></Eyebrow>
            <SectionTitle size="md"><SlotText slotKey="prohlidky.mobile.title" /></SectionTitle>
            <Paras prefix="prohlidky.mobile" count={MOBILE.paras.length} />
            <ArrowLink to="/kluby">{clubsLink}</ArrowLink>
          </Box>
          <MediaSlot slotKey="prohlidky.mobile.photo" sizes="(max-width: 767px) 100vw, 45vw" sx={{ borderRadius: '16px', aspectRatio: '3 / 2', minHeight: 0 }} />
        </Box>
      </WebSection>

      <PageSection title="prohlidky.equipment.title" tone="warm">
        <ArrowLink to="/vybaveni">{equipmentLink}</ArrowLink>
      </PageSection>

      <PageSection title="prohlidky.price.title">
        <Paras prefix="prohlidky.price" count={PRICE_SECTION.paras.length} />
        <Box sx={gridOf(320, 20)}>
          {EXAM_CARDS.map((card) => (
            <PriceCard key={card.id} card={card} prefix={EXAM_CARD_PREFIX} linePrefix={EXAM_LINE_PREFIX} lines={EXAM_LINES} prices={prices} />
          ))}
        </Box>
        {others.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <SlotText slotKey="prohlidky.price.more" as="h3" sx={{ ...H3_SX, fontSize: 20 }} />
            <PriceRowList items={others} />
          </Box>
        )}
        <BookButton text={book} />
      </PageSection>

      <GroupDiscounts />
    </>
  );
}

/** The rows the package cards of this page already show (so they are not listed twice). */
function packageRows(prices: PriceCategory[]): Set<PriceItem> {
  const rows = new Set<PriceItem>();
  for (const id of PACKAGE_CARD_IDS) {
    const item = matchItem(prices, cardById(id).match);
    if (item !== null) rows.add(item);
  }
  return rows;
}
