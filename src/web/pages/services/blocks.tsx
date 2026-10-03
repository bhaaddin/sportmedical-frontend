/* ══════════════════════════════════════════════════════════════
   BUILDING BLOCKS OF THE SERVICE PAGES

   Each one is a section of the artboards V-Sluzby … V-Cenik, made of the shared pieces in
   src/web/ui.tsx. Texts are slots (keys given by the page), photos are media slots, prices
   come from the price list and the group discounts from the public discount tiers — nothing
   here is a sentence or an amount the clinic could change.
   ══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { formatPercent, useDiscountTiers } from '../../../api/publicDiscounts';
import type { DiscountTier } from '../../../api/publicDiscounts';
import type { PriceItem } from '../../../api/priceList';
import { MediaSlot } from '../../../site/MediaSlot';
import { SlotText } from '../../../site/SlotText';
import { BOOKING_PATH } from '../../../components/public/PublicHeader';
import { SiteLink } from '../../SiteLink';
import { PriceRow, SectionTitle, WebSection } from '../../ui';
import { FONT_HEAD, MQ, W } from '../../tokens';

/* ── Card look (the artboards' ".karta") ── */

export const CARD_SX: SxProps<Theme> = {
  bgcolor: W.white, border: `1px solid ${W.lineStrong}`, borderRadius: '14px', minWidth: 0,
  // Lift only where there is a hover (a phone must not stay "hovered" after a tap).
  '@media (hover: hover)': {
    transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
    [MQ.reduceMotion]: { transition: 'none' },
    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 14px 32px rgba(16,20,26,.13)', borderColor: W.phBorder, [MQ.reduceMotion]: { transform: 'none' } },
  },
};

/** An auto-fit grid: one column on a phone, two on an iPad, as many as fit on a desktop. */
export const gridOf = (min: number, gap = 18): SxProps<Theme> => ({
  display: 'grid', gap: `${gap}px`, gridTemplateColumns: `repeat(auto-fit, minmax(min(${min}px, 100%), 1fr))`,
});

/* ── A section: band, title (+ lead), content ── */

export interface PageSectionProps {
  /** Slot key of the section's H2. */
  title?: string;
  /** Slot key of the paragraph under it. */
  lead?: string;
  tone?: 'white' | 'warm';
  id?: string;
  children: ReactNode;
  borderTop?: boolean;
}

export function PageSection({ title, lead, tone = 'white', id, children, borderTop = false }: PageSectionProps) {
  return (
    <WebSection tone={tone} id={id} py={[48, 72]} borderTop={borderTop} innerSx={{ display: 'flex', flexDirection: 'column', gap: { xs: '24px', md: '32px' } }}>
      {(title !== undefined || lead !== undefined) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {title !== undefined && <SectionTitle size="md"><SlotText slotKey={title} /></SectionTitle>}
          {lead !== undefined && <SlotText slotKey={lead} as="p" sx={{ m: 0, fontSize: 16, lineHeight: 1.6, color: W.bodySoft, maxWidth: '70ch' }} />}
        </Box>
      )}
      {children}
    </WebSection>
  );
}

/* ── Cards of a title and a sentence (optionally numbered 01, 02 …) ── */

export function InfoCards({ prefix, count, numbered = false, minWidth = 260 }: { prefix: string; count: number; numbered?: boolean; minWidth?: number }) {
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, ...(gridOf(minWidth) as object) }}>
      {Array.from({ length: count }, (_, index) => index + 1).map((n) => (
        <Box key={n} component="li" sx={[{ p: '20px 22px', display: 'flex', flexDirection: 'column', gap: '8px' }, CARD_SX as object]}>
          {numbered && (
            <Box component="span" aria-hidden="true" sx={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 14, color: W.orangeText }}>{`0${n}`}</Box>
          )}
          <SlotText slotKey={`${prefix}.${n}.title`} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 17, lineHeight: 1.25 }} />
          <SlotText slotKey={`${prefix}.${n}.text`} as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.bodySoft }} />
        </Box>
      ))}
    </Box>
  );
}

/* ── A gallery of photo slots (static: no rotation, nothing moves) ── */

export function PhotoGallery({ prefix, count, label }: { prefix: string; count: number; label: string }) {
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{
        display: 'grid', gap: '14px', gridTemplateColumns: 'minmax(0, 1fr)',
        [MQ.tablet]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
        [MQ.desktop]: { gridTemplateColumns: `repeat(${Math.min(count, 4)}, minmax(0, 1fr))` },
      }}
    >
      {Array.from({ length: count }, (_, index) => index + 1).map((n) => (
        <MediaSlot
          key={n}
          slotKey={`${prefix}.photo${n}`}
          sizes="(max-width: 767px) 100vw, (max-width: 1279px) 45vw, 300px"
          sx={{ aspectRatio: '4 / 3', minHeight: 0 }}
        />
      ))}
    </Box>
  );
}

/* ── A list of price rows (hover rows, name · minutes · price; "—" when the price is unknown) ── */

export function PriceRowList({
  items, fallback, to = BOOKING_PATH, showDuration = true,
}: { items: PriceItem[]; fallback?: readonly string[]; to?: string; showDuration?: boolean }) {
  const rows: { key: string; name: string; item: PriceItem | null }[] =
    items.length > 0
      ? items.map((item) => ({ key: item.code || item.name, name: item.name, item }))
      : (fallback ?? []).map((name) => ({ key: name, name, item: null }));
  if (rows.length === 0) return null;
  return (
    <Box component="div" role="list" sx={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((row, index) => (
        <Box key={row.key} role="listitem" sx={{ display: 'flex', flexDirection: 'column' }}>
          <PriceRow to={to} name={row.name} item={row.item} last={index === rows.length - 1} showDuration={showDuration} />
        </Box>
      ))}
    </Box>
  );
}

/* ── Group discounts ── */

/** "4–5 osob", "10 a více osob": the tier's range, up to the next tier. */
export function tierRange(tiers: DiscountTier[], index: number): string {
  const tier = tiers[index];
  const next = tiers[index + 1];
  if (next === undefined) return `${tier.minPersons} a více osob`;
  const last = next.minPersons - 1;
  return last <= tier.minPersons ? `${tier.minPersons} osob` : `${tier.minPersons}–${last} osob`;
}

/**
 * "Čím větší skupina, tím výhodnější podmínky": one card per tier the server publishes, then the
 * club card. With no tiers the whole block is hidden (`alwaysShowClub` keeps just the club card —
 * the price list page, where the "Kluby" chip points at it).
 */
export function GroupDiscounts({ alwaysShowClub = false, id }: { alwaysShowClub?: boolean; id?: string }) {
  const { data: tiers } = useDiscountTiers();
  const hasTiers = tiers.length > 0;
  if (!hasTiers && !alwaysShowClub) return null;
  return (
    <WebSection tone="warm" id={id} py={[44, 64]} borderTop innerSx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SlotText slotKey="sluzby.shared.discount.title" as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: { xs: 22, md: 26 }, letterSpacing: '-0.02em' }} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
        {tiers.map((tier, index) => (
          <Box key={tier.minPersons} sx={[{ flex: '1 1 180px', p: '18px 20px', display: 'flex', flexDirection: 'column', gap: '5px' }, CARD_SX as object]}>
            <Box component="span" sx={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 26, color: W.orangeText }}>{formatPercent(tier.percent)}</Box>
            <Box component="span" sx={{ fontSize: 15, fontWeight: 600 }}>{tierRange(tiers, index)}</Box>
            <SlotText slotKey="sluzby.shared.discount.per" sx={{ fontSize: 13, color: W.muted }} />
          </Box>
        ))}
        <Box
          component={SiteLink}
          to="/kluby"
          sx={[
            { flex: '1 1 180px', p: '18px 20px', display: 'flex', flexDirection: 'column', gap: '5px', textDecoration: 'none', color: W.text, minHeight: 44 },
            CARD_SX as object,
          ]}
        >
          <SlotText slotKey="sluzby.shared.club.value" sx={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 26, color: W.orangeText }} />
          <SlotText slotKey="sluzby.shared.club.label" sx={{ fontSize: 15, fontWeight: 600 }} />
          <SlotText slotKey="sluzby.shared.club.note" sx={{ fontSize: 13, color: W.muted }} />
        </Box>
      </Box>
      {hasTiers && <SlotText slotKey="sluzby.shared.discount.note" as="p" sx={{ m: 0, fontSize: 14, color: W.muted }} />}
    </WebSection>
  );
}
