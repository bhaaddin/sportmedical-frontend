/* /faq — the clinic's frequently asked questions as an accordion.

   Every category title, every question and every answer is a slot (src/site/slots/otazky.ts), with the
   live site's wording as the default. Native <details>: keyboard and screen-reader friendly, and the
   answers are in the prerendered HTML. The page does not use the admin's FAQ list of the booking page:
   this one is edited text by text in "Média a texty". */

import { Box } from '@mui/material';
import { SlotText, useSlotText } from '../../site/SlotText';
import { FAQ_CATEGORIES, FAQ_ITEMS, faqCategoryKey, faqKey } from '../../site/slots/otazky';
import { BOOKING_PATH } from '../../components/public/PublicHeader';
import { ChevronDownIcon, CtaButton, PageHero, SectionTitle, WebSection } from '../ui';
import { FONT_HEAD, W } from '../tokens';
import { RichSlotText } from './company/richText';

function QuestionItem({ n }: { n: number }) {
  return (
    <Box
      component="details"
      sx={{ borderBottom: `1px solid ${W.line}`, '&[open] summary svg': { transform: 'rotate(180deg)' }, '&[open] summary': { color: W.orangeTextHover } }}
    >
      <Box
        component="summary"
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', minHeight: 56, py: '14px', cursor: 'pointer', listStyle: 'none',
          fontFamily: FONT_HEAD, fontWeight: 700, fontSize: { xs: 17, md: 18 }, lineHeight: 1.3, '&::-webkit-details-marker': { display: 'none' },
          '&:focus-visible': { outline: `2px solid ${W.orange}`, outlineOffset: 2 },
          '& svg': { flex: '0 0 auto', transition: 'transform .2s ease', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } },
        }}
      >
        <SlotText slotKey={faqKey(n, 'q')} />
        <ChevronDownIcon size={16} />
      </Box>
      <Box sx={{ pb: '22px' }}>
        <RichSlotText slotKey={faqKey(n, 'a')} headingTag="h3" />
      </Box>
    </Box>
  );
}

function MoreBand() {
  const contact = useSlotText('otazky.more.cta');
  const book = useSlotText('otazky.more.book');
  return (
    <WebSection tone="ink" py={[44, 64]}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: '24px', md: '40px' }, justifyContent: 'space-between', alignItems: { md: 'center' } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <SlotText slotKey="otazky.more.title" as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 'clamp(26px, 3.2vw, 36px)', letterSpacing: '-0.035em' }} />
          <SlotText slotKey="otazky.more.text" as="p" sx={{ m: 0, fontSize: 17, lineHeight: 1.6, color: W.onInk, maxWidth: '54ch' }} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: '12px' }}>
          <CtaButton to="/kontakt" height={54} fontSize={16} px={28} sx={{ width: { xs: '100%', sm: 'auto' } }}>{contact}</CtaButton>
          <CtaButton to={BOOKING_PATH} variant="ghostDark" height={54} fontSize={16} px={26} sx={{ width: { xs: '100%', sm: 'auto' } }}>{book}</CtaButton>
        </Box>
      </Box>
    </WebSection>
  );
}

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow={<SlotText slotKey="otazky.hero.eyebrow" />}
        title={<SlotText slotKey="otazky.hero.title" />}
        lead={<SlotText slotKey="otazky.hero.lead" />}
      />
      <WebSection py={[36, 64]} maxWidth={900} innerSx={{ display: 'flex', flexDirection: 'column', gap: { xs: '36px', md: '52px' } }}>
        {FAQ_CATEGORIES.map((category) => (
          <Box key={category.id} component="section" id={`faq-${category.id}`} sx={{ display: 'flex', flexDirection: 'column', gap: '12px', scrollMarginTop: '88px' }}>
            <SectionTitle size="md"><SlotText slotKey={faqCategoryKey(category.id)} /></SectionTitle>
            <Box sx={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${W.line}` }}>
              {FAQ_ITEMS.filter((item) => item.categoryId === category.id).map((item) => (
                <QuestionItem key={item.n} n={item.n} />
              ))}
            </Box>
          </Box>
        ))}
      </WebSection>
      <MoreBand />
    </>
  );
}
