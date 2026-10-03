/* /web/cenik — the whole price list (artboard V-Cenik), rendered live from the price list: every
   category and every row as the admin keeps them, grouped by category, hover rows, "—" for a price
   nobody has set. The group-discount block appears only when the server publishes tiers. If the list
   cannot be loaded the page says so and offers "Zkusit znovu" — never an empty screen. */

import { Box } from '@mui/material';
import { usePriceList } from '../../api/priceList';
import type { PriceCategory } from '../../api/priceList';
import { SlotText, useSlotText } from '../../site/SlotText';
import { BOOKING_PATH } from '../../components/public/PublicHeader';
import { CtaButton, WebSection } from '../ui';
import { FONT_HEAD, MQ, W } from '../tokens';
import { GroupDiscounts, PriceRowList } from './services/blocks';
import { FALLBACK_CATEGORIES, categorySlug } from './services/pricing';
import { ServiceHero } from './services/ServiceHero';

const CLUBS_ID = 'kluby-a-skupiny';

function Chip({ href, children }: { href: string; children: string }) {
  return (
    <Box
      component="a"
      href={href}
      sx={{
        display: 'inline-flex', alignItems: 'center', minHeight: 44, px: '18px', border: `1px solid ${W.lineStrong}`, borderRadius: '22px', bgcolor: W.white,
        fontSize: 14, fontWeight: 600, textDecoration: 'none', color: W.text, whiteSpace: 'nowrap',
        '@media (hover: hover)': { transition: 'background-color .14s ease', [MQ.reduceMotion]: { transition: 'none' }, '&:hover': { bgcolor: W.warm } },
      }}
    >
      {children}
    </Box>
  );
}

export default function CenikPage() {
  const query = usePriceList();
  const book = useSlotText('cenik.book.cta');
  const retry = useSlotText('cenik.error.retry');
  const clubs = useSlotText('cenik.nav.clubs');
  const live = query.data;

  // What the page lists: the API's categories; only while it has said nothing, the three service names with dashes.
  const categories: { category: string; items: PriceCategory['items']; names: readonly string[] }[] =
    live.length > 0
      ? live.map((group) => ({ category: group.category, items: group.items, names: [] }))
      : FALLBACK_CATEGORIES.map((group) => ({ category: group.category, items: [], names: group.names }));

  return (
    <>
      <ServiceHero page="cenik" priceButton={false} />

      <WebSection py={[44, 72]} innerSx={{ display: 'flex', flexDirection: 'column', gap: { xs: '28px', md: '36px' } }}>
        {live.length === 0 && query.isError && (
          <Box
            role="alert"
            sx={{ display: 'flex', flexWrap: 'wrap', gap: '12px 20px', alignItems: 'center', p: '16px 20px', borderRadius: '14px', bgcolor: W.warm, border: `1px solid ${W.lineStrong}` }}
          >
            <SlotText slotKey="cenik.error.text" as="p" sx={{ m: 0, flex: '1 1 260px', fontSize: 15, lineHeight: 1.5 }} />
            <Box
              component="button"
              type="button"
              onClick={() => { void query.refetch(); }}
              sx={{
                minHeight: 44, px: '22px', borderRadius: '22px', border: 0, bgcolor: W.orange, color: W.onOrange, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}
            >
              {retry}
            </Box>
          </Box>
        )}

        <Box component="nav" aria-label="Kategorie ceníku" sx={{ display: 'flex', flexWrap: 'wrap', gap: '9px' }}>
          {categories.map((group) => (
            <Chip key={group.category} href={`#${categorySlug(group.category)}`}>{group.category}</Chip>
          ))}
          <Chip href={`#${CLUBS_ID}`}>{clubs}</Chip>
        </Box>

        {categories.map((group) => (
          <Box key={group.category} component="section" aria-labelledby={categorySlug(group.category)} sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Box
              component="h2"
              id={categorySlug(group.category)}
              sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: { xs: 22, md: 26 }, letterSpacing: '-0.02em', scrollMarginTop: '96px' }}
            >
              {group.category}
            </Box>
            <PriceRowList items={group.items} fallback={group.names} />
          </Box>
        ))}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'flex-start' }}>
          <SlotText slotKey="cenik.note" as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.bodySoft, maxWidth: '70ch' }} />
          <CtaButton to={BOOKING_PATH} height={50} fontSize={16} px={28} sx={{ width: { xs: '100%', sm: 'auto' } }}>{book}</CtaButton>
        </Box>
      </WebSection>

      <GroupDiscounts alwaysShowClub id={CLUBS_ID} />
    </>
  );
}
