/* /web/dokumenty — documents to download (artboard V-Dokumenty).

   Every document is a row: title, one line of explanation, the format of the file. The title, the text
   and the address of the file are slots, so the clinic swaps a PDF by pasting a new link in "Média a
   texty". A document with no address yet is shown as "Připravujeme" — never as a dead link. */

import { Box } from '@mui/material';
import { SlotText, useSlotText } from '../../site/SlotText';
import { DOCUMENT_ENTRIES, documentKey } from '../../site/slots/dokumenty';
import type { DocumentEntry, DocumentSection } from '../../site/slots/dokumenty';
import { SiteLink } from '../SiteLink';
import { CtaButton, WebSection } from '../ui';
import { FONT_HEAD, W } from '../tokens';
import { CompanyHero, SectionHead, sectionStack } from './company/blocks';

/** "PDF", "XLSX" … from the end of the address, whatever follows the file name (?v=…, #page=2). */
export function fileFormat(url: string): string {
  const path = url.trim().split(/[?#]/)[0];
  const match = /\.([A-Za-z0-9]{2,5})$/.exec(path);
  return match === null ? 'Soubor' : match[1].toUpperCase();
}

/** Only an http(s) address is a usable link; anything else (a typo, "javascript:") counts as "not there yet". */
export function usableFileUrl(url: string): string | null {
  const text = url.trim();
  return /^https?:\/\/\S+$/i.test(text) ? text : null;
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

const rowSx = {
  display: 'flex', alignItems: 'center', gap: '16px', p: { xs: '16px', md: '18px 20px' }, minHeight: 44, bgcolor: W.white,
  border: `1px solid ${W.lineStrong}`, borderRadius: '14px', textDecoration: 'none', color: W.text, minWidth: 0,
} as const;

function DocumentRow({ entry }: { entry: DocumentEntry }) {
  const title = useSlotText(documentKey(entry, 'title'));
  const text = useSlotText(documentKey(entry, 'text'));
  const address = useSlotText(entry.to === undefined ? documentKey(entry, 'url') : 'dokumenty.soon.label');
  const soon = useSlotText('dokumenty.soon.label');

  const fileUrl = entry.to === undefined ? usableFileUrl(address) : null;
  const available = entry.to !== undefined || fileUrl !== null;

  const body = (
    <>
      <Box component="span" aria-hidden="true" sx={{ flex: '0 0 44px', height: 44, borderRadius: '11px', bgcolor: '#F3EEE6', color: W.orangeText, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FileIcon />
      </Box>
      <Box component="span" sx={{ flex: '999 1 160px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <Box component="span" sx={{ fontSize: 16, fontWeight: 600, color: W.text }}>{title}</Box>
        <Box component="span" sx={{ fontSize: 14, lineHeight: 1.5, color: W.bodySoft }}>{text}</Box>
      </Box>
      <Box
        component="span"
        sx={{
          flex: '0 0 auto', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', color: available ? W.muted : W.orangeText,
          ...(available ? {} : { bgcolor: W.warm, border: `1px solid ${W.lineStrong}`, borderRadius: '999px', px: '12px', py: '4px', letterSpacing: 0 }),
        }}
      >
        {entry.to !== undefined ? 'Stránka' : fileUrl !== null ? fileFormat(fileUrl) : soon}
      </Box>
    </>
  );

  const hover = { '@media (hover: hover)': { transition: 'border-color .14s ease', '&:hover': { borderColor: '#D6CFC3', bgcolor: W.warm } } };

  if (entry.to !== undefined) {
    return <Box component={SiteLink} to={entry.to} sx={[rowSx, hover]}>{body}</Box>;
  }
  if (fileUrl !== null) {
    return (
      <Box component="a" href={fileUrl} target="_blank" rel="noopener noreferrer" sx={[rowSx, hover]}>
        {body}
        <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>(otevře se v novém okně)</Box>
      </Box>
    );
  }
  // Not published yet: not a link, so nobody lands on a 404.
  return <Box sx={[rowSx, { bgcolor: W.warm }]}>{body}</Box>;
}

function DocumentSectionBlock({ section, tone }: { section: DocumentSection; tone: 'white' | 'warm' }) {
  const entries = DOCUMENT_ENTRIES.filter((entry) => entry.section === section);
  return (
    <WebSection tone={tone} py={[44, 64]} innerSx={sectionStack}>
      <SectionHead title={`dokumenty.${section}.title`} />
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: '11px' }}>
        {entries.map((entry) => (
          <Box key={entry.id} component="li" sx={{ position: 'relative' }}>
            <DocumentRow entry={entry} />
          </Box>
        ))}
      </Box>
    </WebSection>
  );
}

export default function DokumentyPage() {
  return (
    <>
      <CompanyHero slots={{ eyebrow: 'dokumenty.hero.eyebrow', title: 'dokumenty.hero.title', lead: 'dokumenty.hero.lead', photo: 'dokumenty.hero.photo' }} />
      <DocumentSectionBlock section="required" tone="white" />
      <DocumentSectionBlock section="guides" tone="warm" />
      <WebSection tone="warm" py={[36, 48]} borderTop>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: '18px', alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between' }}>
          <SlotText slotKey="dokumenty.portal.text" as="p" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 600, fontSize: 18, lineHeight: 1.45, maxWidth: '60ch' }} />
          <PortalButton />
        </Box>
      </WebSection>
    </>
  );
}

function PortalButton() {
  const label = useSlotText('dokumenty.portal.cta');
  return <CtaButton to="/portal/prihlaseni" height={50} fontSize={16} sx={{ alignSelf: { xs: 'stretch', md: 'auto' } }}>{label}</CtaButton>;
}
