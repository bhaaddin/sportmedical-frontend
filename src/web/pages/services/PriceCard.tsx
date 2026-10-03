/* ══════════════════════════════════════════════════════════════
   A PRICE CARD OF THE LIVE SITE ("CENÍK SLUŽEB" cards)

   Title, the amount from the price list (list price crossed out when the list has one), what the
   service includes (✔) and does not include (✘), each line optionally with an expandable
   "bližší informace" text, and the booking button. Wording is slots: the card's own
   (`<prefix>.title`, `.intro`, `.note`) and one pair per line (`<linePrefix>.<lineId>.name`,
   `.text`). The lines are shared between cards by id, so a sentence that three packages repeat is
   one slot the admin edits once. Which price row the card shows is found by NAME (`match`).
   ══════════════════════════════════════════════════════════════ */

import { Box } from '@mui/material';
import type { PriceCategory } from '../../../api/priceList';
import { SlotText, useSlotText } from '../../../site/SlotText';
import { BOOKING_PATH } from '../../../components/public/PublicHeader';
import { telHref } from '../../../components/public/brand';
import { usePublicClinic } from '../../data';
import { CtaButton } from '../../ui';
import { FONT_HEAD, W } from '../../tokens';
import { CARD_SX, PriceTag } from './blocks';
import { matchItem } from './pricing';
import type { CardDef, LineDef, LineLibrary } from './content/cards';

function Mark({ included }: { included: boolean }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        flex: '0 0 auto', width: 22, height: 22, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mt: '1px',
        bgcolor: included ? '#E6F2E8' : '#F4E7E5', color: included ? '#1E6B34' : '#9B2D20',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {included ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
      </svg>
    </Box>
  );
}

function Line({ linePrefix, id, line, included, more }: { linePrefix: string; id: string; line: LineDef | undefined; included: boolean; more: string }) {
  const nameKey = `${linePrefix}.${id}.name`;
  const hasText = line?.text !== undefined;
  const head = (
    <Box sx={{ display: 'flex', gap: '10px', alignItems: 'flex-start', minWidth: 0 }}>
      <Mark included={included} />
      <SlotText slotKey={nameKey} sx={{ fontSize: 15, lineHeight: 1.45, fontWeight: 600, color: included ? W.text : W.body }} />
    </Box>
  );
  if (!hasText) return <Box component="li" sx={{ py: '3px' }}>{head}</Box>;
  return (
    <Box component="li" sx={{ py: '2px' }}>
      <Box
        component="details"
        sx={{
          '& > summary': { listStyle: 'none', cursor: 'pointer', minHeight: 36, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', py: '3px' },
          '& > summary::-webkit-details-marker': { display: 'none' },
          '&[open] > summary .more': { color: W.orangeTextHover },
        }}
      >
        <Box component="summary">
          {head}
          <Box component="span" className="more" sx={{ fontSize: 13, fontWeight: 600, color: W.orangeText, textDecoration: 'underline', textUnderlineOffset: '3px' }}>{more}</Box>
        </Box>
        <SlotText slotKey={`${linePrefix}.${id}.text`} as="p" sx={{ m: '4px 0 8px 32px', fontSize: 14, lineHeight: 1.6, color: W.bodySoft }} />
      </Box>
    </Box>
  );
}

export interface PriceCardProps {
  card: CardDef;
  /** Slot prefix of the card texts: `<prefix>.<id>.title`. */
  prefix: string;
  /** Slot prefix of the lines: `<linePrefix>.<lineId>.name`. */
  linePrefix: string;
  lines: LineLibrary;
  prices: PriceCategory[];
}

export function PriceCard({ card, prefix, linePrefix, lines, prices }: PriceCardProps) {
  const item = matchItem(prices, card.match);
  const popular = useSlotText('sluzby.shared.badge.popular');
  const includes = useSlotText('sluzby.shared.card.included');
  const excludes = useSlotText('sluzby.shared.card.excluded');
  const more = useSlotText('sluzby.shared.card.more');
  const book = useSlotText('sluzby.shared.cta.book');
  const clinic = usePublicClinic();
  const slotPhone = useSlotText('site.footer.phone');
  const phone = clinic.phone.trim() !== '' ? clinic.phone.trim() : slotPhone;
  const key = `${prefix}.${card.id}`;
  const listSx = { listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: '2px' } as const;
  const headSx = { m: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: W.muted } as const;
  return (
    <Box component="article" sx={[{ p: { xs: '22px 20px', md: '24px' }, display: 'flex', flexDirection: 'column', gap: '16px' }, CARD_SX as object, { borderRadius: '16px' }]}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {card.badge === true && (
          <Box component="span" sx={{ alignSelf: 'flex-start', px: '10px', py: '3px', borderRadius: '12px', bgcolor: W.orange, color: W.onOrange, fontSize: 12, fontWeight: 700 }}>{popular}</Box>
        )}
        <SlotText slotKey={`${key}.title`} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 21, letterSpacing: '-0.02em', lineHeight: 1.2 }} />
        <Box component="p" sx={{ m: 0 }}><PriceTag item={item} size={28} /></Box>
      </Box>
      {card.intro !== undefined && <SlotText slotKey={`${key}.intro`} as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.bodySoft }} />}
      {card.inc.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Box component="h4" sx={headSx}>{includes}</Box>
          <Box component="ul" sx={listSx}>
            {card.inc.map((id) => <Line key={id} linePrefix={linePrefix} id={id} line={lines[id]} included more={more} />)}
          </Box>
        </Box>
      )}
      {card.exc.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Box component="h4" sx={headSx}>{excludes}</Box>
          <Box component="ul" sx={listSx}>
            {card.exc.map((id) => <Line key={id} linePrefix={linePrefix} id={id} line={lines[id]} included={false} more={more} />)}
          </Box>
        </Box>
      )}
      {card.note !== undefined && <SlotText slotKey={`${key}.note`} as="p" sx={{ m: 0, fontSize: 14, lineHeight: 1.55, color: W.bodySoft }} />}
      <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <CtaButton to={BOOKING_PATH} height={46} fontSize={15} variant="ghostLight" sx={{ width: '100%' }}>{book}</CtaButton>
        {card.cta === 'phone' && (
          <Box sx={{ fontSize: 14, color: W.bodySoft, display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
            <SlotText slotKey="sluzby.shared.cta.phone" />
            {phone !== '' && (
              <Box component="a" href={telHref(phone)} sx={{ color: W.orangeText, fontWeight: 700, textDecoration: 'none', minHeight: 24, '&:hover': { color: W.orangeTextHover } }}>{phone}</Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
