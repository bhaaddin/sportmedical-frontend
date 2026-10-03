/* The three numbered service blocks, deliberately asymmetric (V-Web2): a wide text column
   and a narrow tall photo, the photo on the right, left, right. Under the text, price rows
   that react to hover; the amounts are the price list's, matched by NAME — never typed here.

   Phone: one column, block after block (text, rows, link, photo). iPad: two columns.
   Desktop: block 01 hangs its number in a left gutter; 02 puts the photo first. */

import { Box } from '@mui/material';
import { pickRows, usePriceList } from '../../api/priceList';
import type { RowSpec } from '../../api/priceList';
import { MediaSlot } from '../../site/MediaSlot';
import { SlotText, useSlotText } from '../../site/SlotText';
import { ArrowLink, CtaButton, Eyebrow, PriceRow, SectionTitle, WebSection } from '../ui';
import { FONT_HEAD, MQ, W } from '../tokens';
import { FALLBACK_ROWS, ROW_SPECS } from './rows';

interface BlockDef {
  n: 1 | 2 | 3;
  to: string;
  spec: RowSpec;
  fallback: readonly string[];
  /** 'a' = number in the left gutter on desktop; 'b' = photo first; 'c' = plain. */
  layout: 'a' | 'b' | 'c';
}

const BLOCKS: BlockDef[] = [
  { n: 1, to: '/prohlidky', spec: ROW_SPECS.prohlidky, fallback: FALLBACK_ROWS.prohlidky, layout: 'a' },
  { n: 2, to: '/diagnostika', spec: ROW_SPECS.diagnostika, fallback: FALLBACK_ROWS.diagnostika, layout: 'b' },
  { n: 3, to: '/inbody', spec: ROW_SPECS.inbody, fallback: FALLBACK_ROWS.inbody, layout: 'c' },
];

function ServiceBlock({ def }: { def: BlockDef }) {
  const { data: prices } = usePriceList();
  const rows = pickRows(prices, def.spec);
  const prefix = `landing.service${def.n}`;
  const num = `0${def.n}`;
  const linkText = useSlotText(`${prefix}.link`);
  const photoFirst = def.layout === 'b';

  return (
    <Box
      component="article"
      sx={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '28px', md: '44px' }, alignItems: 'stretch',
        pt: { xs: '28px', md: '40px' }, borderTop: `2px solid ${W.text}`,
        [MQ.tablet]: { gridTemplateColumns: photoFirst ? 'minmax(0, 1fr) minmax(0, 1.5fr)' : 'minmax(0, 1.5fr) minmax(0, 1fr)' },
        [MQ.desktop]: { gridTemplateColumns: photoFirst ? '300px minmax(0, 1fr)' : 'minmax(0, 1fr) 300px' },
        '@media (hover: hover)': { transition: 'border-color .2s ease', '&:hover': { borderColor: '#C9C1B4' } },
      }}
    >
      <Box
        sx={{
          display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, order: photoFirst ? 2 : 1, position: 'relative',
          ...(def.layout === 'a' ? { [MQ.desktop]: { pl: '108px' } } : {}),
          [MQ.phoneOnly]: { order: 1 },
        }}
      >
        <Box
          component="span"
          sx={{
            fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 15, color: W.orangeText,
            ...(def.layout === 'a' ? { [MQ.desktop]: { position: 'absolute', left: 0, top: '6px' } } : {}),
          }}
        >
          {num}
        </Box>
        <SlotText
          slotKey={`${prefix}.title`}
          as="h3"
          sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 'clamp(26px, 3vw, 34px)', letterSpacing: '-0.03em', lineHeight: 1.1 }}
        />
        <SlotText slotKey={`${prefix}.text`} as="p" sx={{ m: 0, fontSize: 17, lineHeight: 1.65, color: W.body, maxWidth: '60ch' }} />
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {rows.length > 0
            ? rows.map((item, index) => (
                <PriceRow key={item.code || item.name} to={def.to} name={item.name} item={item} last={index === rows.length - 1} />
              ))
            : def.fallback.map((name, index) => (
                <PriceRow key={name} to={def.to} name={name} item={null} last={index === def.fallback.length - 1} />
              ))}
        </Box>
        <ArrowLink to={def.to}>{linkText}</ArrowLink>
      </Box>
      <Box sx={{ minWidth: 0, order: photoFirst ? 1 : 2, [MQ.phoneOnly]: { order: 2 } }}>
        <MediaSlot
          slotKey={`${prefix}.photo`}
          sizes="(max-width: 767px) 100vw, (max-width: 1279px) 40vw, 300px"
          sx={{
            aspectRatio: '4 / 3', minHeight: 0,
            [MQ.tablet]: { aspectRatio: 'auto', height: '100%', minHeight: 300 },
          }}
        />
      </Box>
    </Box>
  );
}

export function ServiceBlocks() {
  const allPrices = useSlotText('landing.services.allprices');
  return (
    <WebSection id="sluzby" py={[56, 84]} innerSx={{ display: 'flex', flexDirection: 'column', gap: { xs: '36px', md: '52px' } }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '24px 36px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: 720 }}>
          <Eyebrow><SlotText slotKey="landing.services.eyebrow" /></Eyebrow>
          <SectionTitle><SlotText slotKey="landing.services.title" /></SectionTitle>
        </Box>
        <CtaButton to="/cenik" variant="ghostLight" height={50} fontSize={16} arrow>{allPrices}</CtaButton>
      </Box>
      {BLOCKS.map((def) => (
        <ServiceBlock key={def.n} def={def} />
      ))}
    </WebSection>
  );
}
