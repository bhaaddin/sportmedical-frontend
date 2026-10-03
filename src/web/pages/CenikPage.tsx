/* /cenik — the whole price list (artboard V-Cenik), rendered live from the price list: every
   category and every row as the admin keeps them (the description of the row under its name, the list
   price crossed out when the list has one), grouped by category, hover rows, "—" for a price nobody has
   set. Under it the notes of the live price list (InBody in the stress tests, payment, required
   documents, validity of the posudek, packages) and the group discounts (the discount tiers; the
   club card stays). If the list cannot be loaded the page says so and offers "Zkusit znovu" — never an
   empty screen. */

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { usePriceList } from '../../api/priceList';
import type { PriceCategory } from '../../api/priceList';
import { SlotText, useSlotText } from '../../site/SlotText';
import { CENIK_DOCS } from '../../site/slots/cenik';
import { ArrowLink, WebSection } from '../ui';
import { FONT_HEAD, MQ, W } from '../tokens';
import { BookButton, Bullets, CARD_SX, GroupDiscounts, PackageNote, PriceRowList, SubTitle } from './services/blocks';
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

function NoteCard({ children }: { children: ReactNode }) {
  return <Box component="article" sx={[{ p: { xs: '20px', md: '24px' }, display: 'flex', flexDirection: 'column', gap: '10px' }, CARD_SX as object, { borderRadius: '16px' }]}>{children}</Box>;
}

export default function CenikPage() {
  const query = usePriceList();
  const book = useSlotText('cenik.book.cta');
  const retry = useSlotText('cenik.error.retry');
  const clubs = useSlotText('cenik.nav.clubs');
  const docsLink = useSlotText('cenik.note.docs.link');
  const contactLink = useSlotText('cenik.note.contact.link');
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
            <PriceRowList items={group.items} fallback={group.names} showDescription />
          </Box>
        ))}

        <BookButton text={book} />
      </WebSection>

      <WebSection tone="warm" py={[44, 64]} borderTop innerSx={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <SlotText slotKey="cenik.notes.title" as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: { xs: 22, md: 26 }, letterSpacing: '-0.02em' }} />
        <SlotText slotKey="cenik.note.inbody" as="p" sx={{ m: 0, fontSize: 16, lineHeight: 1.6, color: W.body, maxWidth: '70ch' }} />
        <Box sx={{ display: 'grid', gap: '18px', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))' }}>
          <NoteCard>
            <SubTitle slotKey="cenik.note.pay.title" />
            <SlotText slotKey="cenik.note.pay" as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.65, color: W.bodySoft }} />
          </NoteCard>
          <NoteCard>
            <SubTitle slotKey="cenik.note.docs.title" />
            <Bullets prefix="cenik.note.docs" count={CENIK_DOCS.length} />
            <SlotText slotKey="cenik.note.docs.text" as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.65, color: W.bodySoft }} />
            <ArrowLink to="/dokumenty">{docsLink}</ArrowLink>
          </NoteCard>
          <NoteCard>
            <SubTitle slotKey="cenik.note.validity.title" />
            <SlotText slotKey="cenik.note.validity" as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.65, color: W.bodySoft }} />
          </NoteCard>
        </Box>
        <PackageNote />
        <ArrowLink to="/kontakt">{contactLink}</ArrowLink>
      </WebSection>

      <GroupDiscounts alwaysShowClub id={CLUBS_ID} />
    </>
  );
}
