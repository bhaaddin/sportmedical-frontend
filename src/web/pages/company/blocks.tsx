/* ══════════════════════════════════════════════════════════════
   BUILDING BLOCKS OF THE COMPANY PAGES (Dokumenty, Kontakt, O nás, Pro kluby)

   Built on src/web/ui.tsx so the four pages keep the landing's rhythm: a dark
   hero with a photo, white and warm bands, a title in Archivo 800, cards with a
   hairline border, numbered blocks. Every text is a slot; nothing here is a price,
   a number of people or a sentence.
   ══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { MediaSlot } from '../../../site/MediaSlot';
import { SlotText } from '../../../site/SlotText';
import { Eyebrow, SectionTitle, WebSection } from '../../ui';
import { FONT_HEAD, MQ, W } from '../../tokens';

const asArray = (sx: SxProps<Theme> | undefined) => (Array.isArray(sx) ? sx : sx !== undefined ? [sx] : []);

/* ── Hero: eyebrow, the page's only H1, a lead, buttons, a photo ── */

export interface CompanyHeroSlots {
  eyebrow: string;
  title: string;
  lead: string;
  photo: string;
}

export function CompanyHero({ slots, children }: { slots: CompanyHeroSlots; children?: ReactNode }) {
  return (
    <WebSection
      tone="ink"
      py={[48, 72]}
      sx={{ borderBottom: `1px solid ${W.inkLine}` }}
      innerSx={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '32px', md: '40px', lg: '52px' }, alignItems: 'center',
        [MQ.tablet]: { gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)' },
        [MQ.desktop]: { gridTemplateColumns: 'minmax(0, 1fr) 520px' },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '22px', minWidth: 0 }}>
        <Eyebrow onInk rule><SlotText slotKey={slots.eyebrow} /></Eyebrow>
        <SlotText
          slotKey={slots.title}
          as="h1"
          sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 'clamp(34px, 4.6vw, 56px)', lineHeight: 1.04, letterSpacing: '-0.04em', overflowWrap: 'break-word' }}
        />
        <SlotText slotKey={slots.lead} as="p" sx={{ m: 0, fontSize: { xs: 17, md: 18 }, lineHeight: 1.6, color: W.onInk, maxWidth: '56ch' }} />
        {children !== undefined && (
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: '12px', pt: '4px' }}>{children}</Box>
        )}
      </Box>
      <MediaSlot slotKey={slots.photo} tone="dark" eager sizes="(max-width: 767px) 100vw, 520px" sx={{ borderRadius: '18px' }} />
    </WebSection>
  );
}

/* ── Section head: an H2 (and an optional lead) ── */

export function SectionHead({ title, lead, onInk = false, eyebrow }: { title: string; lead?: string; onInk?: boolean; eyebrow?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
      {eyebrow !== undefined && <Eyebrow onInk={onInk}><SlotText slotKey={eyebrow} /></Eyebrow>}
      <SectionTitle size="md"><SlotText slotKey={title} /></SectionTitle>
      {lead !== undefined && (
        <SlotText slotKey={lead} as="p" sx={{ m: 0, fontSize: 17, lineHeight: 1.6, color: onInk ? W.onInk : W.bodySoft, maxWidth: '62ch' }} />
      )}
    </Box>
  );
}

/** A section's column of stuff under its head; the same gap everywhere. */
export const sectionStack = { display: 'flex', flexDirection: 'column', gap: { xs: '26px', md: '32px' } } as const;

/** Responsive card grid: one column on a phone, two on an iPad, `desktop` on a desktop. */
export function CardGrid({ desktop = 3, children, sx, component = 'div' }: { desktop?: 2 | 3 | 4; children: ReactNode; sx?: SxProps<Theme>; component?: 'div' | 'ul' | 'ol' }) {
  return (
    <Box
      component={component}
      sx={[
        {
          listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '14px', md: '18px' },
          [MQ.tablet]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
          [MQ.desktop]: { gridTemplateColumns: `repeat(${desktop}, minmax(0, 1fr))` },
        },
        ...asArray(sx),
      ]}
    >
      {children}
    </Box>
  );
}

/* ── Cards ── */

export const cardSx = {
  bgcolor: W.white, border: `1px solid ${W.lineStrong}`, borderRadius: '16px', p: { xs: '20px', md: '24px' }, minWidth: 0,
  display: 'flex', flexDirection: 'column', gap: '10px',
  // A hover is a hover only where there is a pointer; a phone does not get a stuck "hovered" card.
  '@media (hover: hover)': { transition: 'border-color .14s ease', [MQ.reduceMotion]: { transition: 'none' }, '&:hover': { borderColor: '#D6CFC3' } },
} as const;

export function Card({ children, component = 'div', sx }: { children: ReactNode; component?: 'div' | 'li'; sx?: SxProps<Theme> }) {
  return <Box component={component} sx={[cardSx, ...asArray(sx)]}>{children}</Box>;
}

/** A small uppercase label over a value (Telefon, IČO, …). */
export const labelSx = { fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: W.muted } as const;

/** "01 / Odborný tým / popis" — a numbered card. */
export function NumberedCard({ n, titleKey, textKey }: { n: number; titleKey: string; textKey: string }) {
  return (
    <Card component="li">
      <Box component="span" aria-hidden="true" sx={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 14, color: W.orangeText }}>{String(n).padStart(2, '0')}</Box>
      <SlotText slotKey={titleKey} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 18 }} />
      <SlotText slotKey={textKey} as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.bodySoft }} />
    </Card>
  );
}

/** The four "Jak to funguje" steps: a 3 px orange rule over a big numeral, as on the landing. */
export function StepList({ count, keyOf }: { count: number; keyOf: (n: number, part: 'title' | 'text') => string }) {
  return (
    <CardGrid component="ol" desktop={4} sx={{ gap: { xs: '26px', md: '28px' } }}>
      {Array.from({ length: count }, (_, index) => index + 1).map((n) => (
        <Box key={n} component="li" sx={{ display: 'flex', flexDirection: 'column', gap: '10px', pt: '18px', borderTop: `3px solid ${W.orange}`, minWidth: 0 }}>
          <Box component="span" aria-hidden="true" sx={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 32, letterSpacing: '-0.03em', color: W.numeral }}>{String(n).padStart(2, '0')}</Box>
          <SlotText slotKey={keyOf(n, 'title')} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 19 }} />
          <SlotText slotKey={keyOf(n, 'text')} as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.bodySoft }} />
        </Box>
      ))}
    </CardGrid>
  );
}

/** A row of photos: one column on a phone, two on an iPad, `desktop` on a desktop. They are placeholders until uploaded. */
export function PhotoGrid({ keys, desktop = 4, sizes }: { keys: string[]; desktop?: 2 | 3 | 4; sizes?: string }) {
  return (
    <CardGrid desktop={desktop}>
      {keys.map((key) => (
        <MediaSlot key={key} slotKey={key} sizes={sizes ?? '(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 25vw'} />
      ))}
    </CardGrid>
  );
}
