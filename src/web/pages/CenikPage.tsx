/* /cenik — the whole price list (artboard V-Cenik) as a BOARD: one screen, the document does not scroll. A chip row
   filters it ("Vše", a category, the notes, "Kluby a skupiny") and the panes under it — one per category, then the notes
   of the price list and the group discounts — each scroll inside themselves. Every category and every row is rendered
   live from the price list as the admin keeps it (the description of the row under its name, the list price crossed
   out when the list has one, hover rows, "—" for a price nobody has set); the notes (InBody in the stress tests,
   payment, required documents, validity of the posudek, packages) and the discount tiers sit in their own panes, the
   club card stays. If the list cannot be loaded the page says so and offers "Zkusit znovu" — never an empty screen.
   On a phone the panes stack and the region between the header and the booking bar scrolls. */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { usePriceList } from '../../api/priceList';
import type { PriceCategory } from '../../api/priceList';
import { SlotText, useSlotText } from '../../site/SlotText';
import { CENIK_DOCS } from '../../site/slots/cenik';
import { FIT_WIDE, Pane, PublicMain } from '../../components/public/kit';
import { ArrowLink } from '../ui';
import { FONT_HEAD, SITE_MAX, W } from '../tokens';
import { BookButton, Bullets, CARD_SX, DiscountCards, PackageNote, PriceRowList, SubTitle } from './services/blocks';
import { FALLBACK_CATEGORIES, categorySlug } from './services/pricing';
import { ServiceHero } from './services/ServiceHero';

const CLUBS_ID = 'kluby-a-skupiny';
const NOTES_ID = 'poznamky-k-cenikum';
const ALL = 'vse';

function Chip({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      sx={{
        display: 'inline-flex', alignItems: 'center', minHeight: 44, px: '18px', border: `1px solid ${selected ? W.text : W.lineStrong}`, borderRadius: '22px',
        bgcolor: selected ? W.text : W.white, color: selected ? W.white : W.text, fontFamily: 'inherit', cursor: 'pointer',
        fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
        '@media (hover: hover)': { transition: 'background-color .14s ease', '@media (prefers-reduced-motion: reduce)': { transition: 'none' }, '&:hover': { bgcolor: selected ? W.text : W.warm } },
      }}
    >
      {children}
    </Box>
  );
}

function NoteCard({ children }: { children: ReactNode }) {
  return <Box component="article" sx={[{ p: { xs: '20px', md: '24px' }, display: 'flex', flexDirection: 'column', gap: '10px' }, CARD_SX as object, { borderRadius: '16px' }]}>{children}</Box>;
}

/** One section of the board: it never splits across two columns. */
const sectionSx = { display: 'flex', flexDirection: 'column', gap: '14px', breakInside: 'avoid', mb: '28px' } as const;

const paneTitleSx = { m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: { xs: 22, md: 24 }, letterSpacing: '-0.02em' } as const;

export default function CenikPage() {
  const query = usePriceList();
  const book = useSlotText('cenik.book.cta');
  const retry = useSlotText('cenik.error.retry');
  const clubs = useSlotText('cenik.nav.clubs');
  const notesTitle = useSlotText('cenik.notes.title');
  const docsLink = useSlotText('cenik.note.docs.link');
  const contactLink = useSlotText('cenik.note.contact.link');
  const live = query.data;

  // What the page lists: the API's categories; only while it has said nothing, the three service names with dashes.
  const categories: { category: string; items: PriceCategory['items']; names: readonly string[] }[] =
    live.length > 0
      ? live.map((group) => ({ category: group.category, items: group.items, names: [] }))
      : FALLBACK_CATEGORIES.map((group) => ({ category: group.category, items: [], names: group.names }));

  // The prerendered page shows everything; an address with #category (or #kluby-a-skupiny) opens that pane after hydration.
  const [filter, setFilter] = useState<string>(ALL);
  useEffect(() => {
    const target = decodeURIComponent(window.location.hash.slice(1));
    if (target !== '') setFilter(target);
  }, []);
  const known = [ALL, NOTES_ID, CLUBS_ID, ...categories.map((group) => categorySlug(group.category))];
  const shown = known.includes(filter) ? filter : ALL;
  const all = shown === ALL;

  /* The selection flows into columns of at least 360 px inside ONE pane, so a wide screen shows the whole list side by side and a
     narrow one a single column; the pane scrolls when it is longer than the screen, the document never does. */
  const sections: ReactNode[] = [];
  for (const group of categories) {
    const slug = categorySlug(group.category);
    if (!all && shown !== slug) continue;
    sections.push(
      <Box key={slug} component="section" aria-labelledby={slug} sx={sectionSx}>
        <Box component="h2" id={slug} sx={paneTitleSx}>{group.category}</Box>
        <PriceRowList items={group.items} fallback={group.names} showDescription />
      </Box>,
    );
  }
  if (all || shown === NOTES_ID) {
    sections.push(
      <Box key={NOTES_ID} component="section" aria-labelledby={NOTES_ID} sx={sectionSx}>
        <SlotText slotKey="cenik.notes.title" as="h2" sx={paneTitleSx} />
        <SlotText slotKey="cenik.note.inbody" as="p" sx={{ m: 0, fontSize: 16, lineHeight: 1.6, color: W.body, maxWidth: '70ch' }} />
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
        <PackageNote />
        <ArrowLink to="/kontakt">{contactLink}</ArrowLink>
      </Box>,
    );
  }
  if (all || shown === CLUBS_ID) {
    sections.push(
      <Box key={CLUBS_ID} component="section" id={CLUBS_ID} sx={{ ...sectionSx, p: '18px', borderRadius: '16px', bgcolor: W.warm }}>
        <DiscountCards />
      </Box>,
    );
  }

  const head = (
    <>
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

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px 20px' }}>
        {/* Two rows are reserved on a tablet and up: the labels are the admin's and a web font changes their width, so the board under the
            chips must not jump when a chip wraps to a second row. */}
        <Box component="nav" aria-label="Kategorie ceníku" sx={{ display: 'flex', flexWrap: 'wrap', gap: '9px', alignContent: 'flex-start', [FIT_WIDE]: { minHeight: '97px' } }}>
          <Chip selected={all} onSelect={() => setFilter(ALL)}>Vše</Chip>
          {categories.map((group) => (
            <Chip key={group.category} selected={shown === categorySlug(group.category)} onSelect={() => setFilter(categorySlug(group.category))}>{group.category}</Chip>
          ))}
          <Chip selected={shown === NOTES_ID} onSelect={() => setFilter(NOTES_ID)}>{notesTitle}</Chip>
          <Chip selected={shown === CLUBS_ID} onSelect={() => setFilter(CLUBS_ID)}>{clubs}</Chip>
        </Box>
      </Box>
    </>
  );

  return (
    <PublicMain
      maxWidth={SITE_MAX}
      siteGutters
      workspace
      band={<ServiceHero page="cenik" priceButton={false} compact />}
      head={head}
      gap={2}
      columns="minmax(0, 1fr)"
      sx={{ pt: { xs: '28px', md: '18px' } }}
    >
      <Pane>
        <Box sx={{ columnWidth: '360px', columnGap: '32px', [FIT_WIDE]: { mb: '-28px' } }}>{sections}</Box>
        <BookButton text={book} />
      </Pane>
    </PublicMain>
  );
}
