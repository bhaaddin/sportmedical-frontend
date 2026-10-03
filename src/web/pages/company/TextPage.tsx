/* ══════════════════════════════════════════════════════════════
   TEXT PAGE — Obchodní podmínky, Ochrana osobních údajů, Storno a reklamace

   One block for the three pages, so they read the same: a dark head (eyebrow, the only H1, a lead), the
   sections as H2 + text (every title and every body a slot), a contents list when the text is long, the
   clinic's contact details (from its settings — never typed here) and a quiet row to the other
   information pages. The legal wording is the clinic's; this block only lays it out. The note
   "Znění k právní kontrole provozovatelem" is a slot for the administrator and is NOT rendered here.
   ══════════════════════════════════════════════════════════════ */

import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { Lines, SlotText, useSlotText } from '../../../site/SlotText';
import { LEGAL_LINKS } from '../../../site/slots/spolecne';
import { sectionKey } from '../../../site/slots/textPage';
import type { TextSection } from '../../../site/slots/textPage';
import { SiteLink } from '../../SiteLink';
import { PageHero, SectionTitle, WebSection } from '../../ui';
import { FONT_HEAD, W } from '../../tokens';
import { labelSx } from './blocks';
import { useContactDetails } from './contactData';
import { RichSlotText } from './richText';

/** More than this many sections and the page opens with a list of them. */
const TOC_FROM = 6;

const linkReset = { color: 'inherit', textDecoration: 'none', '&:hover': { color: W.orangeTextHover, textDecoration: 'underline' } } as const;

/** The small row of the other information pages; the page itself is left out. */
export function LegalLinks({ exclude, titleKey }: { exclude?: string; titleKey?: string }) {
  return (
    <Box component="nav" aria-label="Další informace" sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {titleKey !== undefined && <SlotText slotKey={titleKey} sx={labelSx} />}
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: '0 24px' }}>
        {LEGAL_LINKS.filter((link) => link.to !== exclude).map((link) => (
          <li key={link.to}>
            <Box component={SiteLink} to={link.to} sx={{ ...linkReset, display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 15, fontWeight: 600 }}>
              <SlotText slotKey={link.key} />
            </Box>
          </li>
        ))}
      </Box>
    </Box>
  );
}

function ContactBlock({ prefix }: { prefix: string }) {
  const contact = useContactDetails();
  const company = useSlotText('kontakt.billing.name.value');
  const icoLabel = useSlotText('kontakt.billing.ico.label');
  const ico = useSlotText('kontakt.billing.ico.value');
  const seatLabel = useSlotText('kontakt.billing.seat.label');
  const seat = useSlotText('kontakt.billing.seat.value');
  const phoneLabel = useSlotText('kontakt.phone.label');
  const emailLabel = useSlotText('kontakt.email.label');
  const addressLabel = useSlotText('kontakt.address.label');

  const rows: { label: string; value: ReactNode }[] = [
    { label: phoneLabel, value: <Box component="a" href={contact.phoneHref} sx={linkReset}>{contact.phone}</Box> },
    { label: emailLabel, value: <Box component="a" href={`mailto:${contact.email}`} sx={linkReset}>{contact.email}</Box> },
    { label: addressLabel, value: contact.addressLines.join(', ') },
    { label: seatLabel, value: <Lines text={seat} /> },
    { label: icoLabel, value: ico },
  ];

  return (
    <WebSection tone="warm" py={[40, 56]} borderTop maxWidth={860} innerSx={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionTitle size="md"><SlotText slotKey={`${prefix}.contact.title`} /></SectionTitle>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <Box component="strong" sx={{ fontFamily: FONT_HEAD, fontSize: 18 }}>{company}</Box>
        <SlotText slotKey={`${prefix}.contact.lead`} sx={{ fontSize: 15, color: W.bodySoft }} />
      </Box>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '14px 24px', '@media (min-width: 768px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } }}>
        {rows.map((row) => (
          <Box key={row.label} sx={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <Box component="dt" sx={labelSx}>{row.label}</Box>
            <Box component="dd" sx={{ m: 0, fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>{row.value}</Box>
          </Box>
        ))}
      </Box>
    </WebSection>
  );
}

export interface TextPageProps {
  prefix: string;
  sections: readonly TextSection[];
  /** The path of this page, so it is left out of the row of other pages. */
  path: string;
}

export function TextPage({ prefix, sections, path }: TextPageProps) {
  const contact = useContactDetails();
  const tokens = { email: contact.email, telefon: contact.phone, adresa: contact.addressOneLine };
  const tocTitle = `${prefix}.toc.title`;

  return (
    <>
      <PageHero
        eyebrow={<SlotText slotKey={`${prefix}.hero.eyebrow`} />}
        title={<SlotText slotKey={`${prefix}.hero.title`} />}
        lead={<SlotText slotKey={`${prefix}.hero.lead`} />}
      />

      <WebSection py={[40, 64]} maxWidth={860} innerSx={{ display: 'flex', flexDirection: 'column', gap: { xs: '32px', md: '44px' } }}>
        {sections.length >= TOC_FROM && (
          <Box component="nav" aria-label="Obsah" sx={{ display: 'flex', flexDirection: 'column', gap: '8px', pb: '8px', borderBottom: `1px solid ${W.line}` }}>
            <SlotText slotKey={tocTitle} sx={labelSx} />
            <Box component="ol" sx={{ m: 0, pl: '22px', columns: { xs: 1, md: 2 }, columnGap: '32px', fontSize: 15, lineHeight: 1.5 }}>
              {sections.map((section) => (
                <li key={section.id}>
                  <Box component="a" href={`#${prefix}-${section.id}`} sx={{ ...linkReset, display: 'inline-flex', alignItems: 'center', minHeight: 32 }}>
                    <SlotText slotKey={sectionKey(prefix, section.id, 'title')} />
                  </Box>
                </li>
              ))}
            </Box>
          </Box>
        )}
        {sections.map((section) => (
          <Box key={section.id} component="section" id={`${prefix}-${section.id}`} sx={{ display: 'flex', flexDirection: 'column', gap: '14px', scrollMarginTop: '88px' }}>
            <SlotText slotKey={sectionKey(prefix, section.id, 'title')} as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 'clamp(22px, 2.6vw, 28px)', letterSpacing: '-0.025em', lineHeight: 1.15 }} />
            <RichSlotText slotKey={sectionKey(prefix, section.id, 'text')} tokens={tokens} />
          </Box>
        ))}
      </WebSection>

      <ContactBlock prefix={prefix} />

      <WebSection py={[24, 32]} borderTop maxWidth={860}>
        <LegalLinks exclude={path} titleKey={`${prefix}.more.title`} />
      </WebSection>
    </>
  );
}
