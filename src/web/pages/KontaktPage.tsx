/* /web/kontakt — where and when (artboard V-Kontakt).

   Phone, e-mail, address and opening hours are the clinic's own settings (GET /api/public/clinic) and
   fall back to the footer slots; the sentences around them are slots. The map is a plain link to
   Mapy.cz — no iframe, nothing loaded from a third party. There is no form that sends mail: the page
   shows the phone and the e-mail as links, and the enquiry of a club goes through them as well. */

import { Box } from '@mui/material';
import { MediaSlot } from '../../site/MediaSlot';
import { Lines, SlotText, useSlotText } from '../../site/SlotText';
import { ArrowIcon, CtaButton, WebSection } from '../ui';
import { BOOKING_PATH } from '../../components/public/PublicHeader';
import { FONT_HEAD, MQ, W } from '../tokens';
import { Card, CardGrid, CompanyHero, SectionHead, labelSx, sectionStack } from './company/blocks';
import { LegalLinks } from './company/TextPage';
import { SiteLink } from '../SiteLink';
import { mapyCzHref, useContactDetails } from './company/contactData';

const linkReset = { color: 'inherit', textDecoration: 'none', '&:hover': { color: W.orangeTextHover, textDecoration: 'underline' } } as const;

/* ── Phone / e-mail / address ── */

function ContactCards() {
  const contact = useContactDetails();
  const note = useSlotText('kontakt.address.note');
  // The clinic's own address may already say which building it is; then the note would repeat it.
  const showNote = note.trim() !== '' && !contact.addressLines.join(' ').toLowerCase().includes('greenline');

  return (
    <CardGrid desktop={3}>
      <Card>
        <SlotText slotKey="kontakt.phone.label" sx={labelSx} />
        <Box component="a" href={contact.phoneHref} sx={{ ...linkReset, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 25, display: 'flex', alignItems: 'center', minHeight: 44 }}>
          {contact.phone}
        </Box>
        <SlotText slotKey="kontakt.phone.note" sx={{ fontSize: 14, color: W.bodySoft }} />
      </Card>
      <Card>
        <SlotText slotKey="kontakt.email.label" sx={labelSx} />
        <Box component="a" href={`mailto:${contact.email}`} sx={{ ...linkReset, fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere', display: 'flex', alignItems: 'center', minHeight: 44 }}>
          {contact.email}
        </Box>
      </Card>
      <Card>
        <SlotText slotKey="kontakt.address.label" sx={labelSx} />
        <Box component="address" sx={{ fontStyle: 'normal', fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>
          {contact.addressLines.map((line) => (
            <Box key={line} component="span" sx={{ display: 'block' }}>{line}</Box>
          ))}
        </Box>
        {showNote && <SlotText slotKey="kontakt.address.note" sx={{ fontSize: 14, color: W.bodySoft }} />}
      </Card>
    </CardGrid>
  );
}

/* ── Map: an image the admin may upload + a plain link to Mapy.cz ── */

function MapBlock() {
  const contact = useContactDetails();
  const label = useSlotText('kontakt.map.cta');
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <MediaSlot slotKey="kontakt.map.image" sizes="(max-width: 1320px) 100vw, 1320px" sx={{ borderRadius: '16px', minHeight: { xs: 200, md: 260 } }} />
      <Box
        component="a"
        href={mapyCzHref(contact.addressOneLine)}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '10px', minHeight: 44, fontSize: 16, fontWeight: 700,
          color: W.orangeText, textDecoration: 'none', '&:hover': { color: W.orangeTextHover },
        }}
      >
        {label}
        <ArrowIcon />
        <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>(otevře se v novém okně)</Box>
      </Box>
    </Box>
  );
}

/* ── How to get here ── */

const WAYS = ['metro', 'bus', 'train', 'car', 'building'] as const;

/* ── Opening hours ── */

function HoursTable() {
  const { hours } = useContactDetails();
  const rows = hours.rows;
  if (rows.length === 0 && hours.notes.length === 0) return null;
  return (
    <Box sx={{ border: `1px solid ${W.lineStrong}`, borderRadius: '16px', bgcolor: W.white, overflow: 'hidden', maxWidth: 560 }}>
      {rows.map((row, index) => (
        <Box
          key={`${row.label}-${index}`}
          sx={{ display: 'flex', justifyContent: 'space-between', gap: '16px', p: '15px 20px', borderBottom: index < rows.length - 1 || hours.notes.length > 0 ? `1px solid ${W.line}` : 'none' }}
        >
          <Box component="span" sx={{ fontSize: 16, fontWeight: row.closed ? 400 : 600 }}>{row.label}</Box>
          <Box component="span" sx={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: row.closed ? W.mutedSoft : W.text }}>{row.value}</Box>
        </Box>
      ))}
      {rows.length === 0 && hours.notes.map((note) => (
        <Box key={note} sx={{ p: '15px 20px', fontSize: 16 }}>{note}</Box>
      ))}
    </Box>
  );
}

/* ── Enquiry band ── */

function AskBand() {
  const contact = useContactDetails();
  const call = useSlotText('kontakt.ask.cta.call');
  const mail = useSlotText('kontakt.ask.cta.mail');
  return (
    <WebSection tone="ink" id="poptavka" py={[48, 72]}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: '28px', md: '40px' }, justifyContent: 'space-between', alignItems: { md: 'center' } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <SlotText slotKey="kontakt.ask.title" as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 'clamp(28px, 3.4vw, 40px)', letterSpacing: '-0.035em' }} />
          <SlotText slotKey="kontakt.ask.text" as="p" sx={{ m: 0, fontSize: 17, lineHeight: 1.6, color: W.onInk, maxWidth: '56ch' }} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: { xs: 'stretch', md: 'flex-end' }, minWidth: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: '12px' }}>
            <Box
              component="a"
              href={contact.phoneHref}
              sx={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: 54, px: '28px', borderRadius: '27px', bgcolor: W.orange, color: W.onOrange,
                fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 16, textDecoration: 'none', '&:hover': { color: W.onOrange },
              }}
            >
              {call} <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{contact.phone}</Box>
            </Box>
            <Box
              component="a"
              href={`mailto:${contact.email}`}
              sx={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 54, px: '26px', borderRadius: '27px', border: `1px solid ${W.inkBorder}`,
                color: W.white, fontWeight: 600, fontSize: 16, textDecoration: 'none', '&:hover': { color: W.white, borderColor: W.onInkMuted },
              }}
            >
              {mail}
            </Box>
          </Box>
          <ClubsLink />
        </Box>
      </Box>
    </WebSection>
  );
}

function ClubsLink() {
  const label = useSlotText('kontakt.ask.cta.clubs');
  return <CtaButton to="/kluby" variant="ghostDark" height={44} px={0} fontSize={15} arrow sx={{ border: 'none', justifyContent: 'flex-start', '&:hover': { boxShadow: 'none', transform: 'none', color: W.orange } }}>{label}</CtaButton>;
}

/* ── Useful links (live page: prices, documents, patient zone) and the FAQ ── */

const USEFUL = [
  { id: 'prices', to: '/cenik' },
  { id: 'documents', to: '/dokumenty' },
  { id: 'portal', to: '/portal/prihlaseni' },
  { id: 'faq', to: '/faq' },
] as const;

function UsefulLinks() {
  return (
    <WebSection py={[44, 64]} innerSx={sectionStack}>
      <SectionHead title="kontakt.links.title" />
      <CardGrid desktop={4} component="ul">
        {USEFUL.map((link) => (
          <Card key={link.id} component="li" sx={{ p: 0 }}>
            <Box
              component={SiteLink}
              to={link.to}
              sx={{ display: 'flex', flexDirection: 'column', gap: '8px', p: { xs: '20px', md: '24px' }, height: '100%', minHeight: 44, color: 'inherit', textDecoration: 'none', '&:hover h3': { color: W.orangeTextHover } }}
            >
              <SlotText slotKey={`kontakt.links.${link.id}.title`} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 17 }} />
              <SlotText slotKey={`kontakt.links.${link.id}.text`} as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.bodySoft }} />
            </Box>
          </Card>
        ))}
      </CardGrid>
      <LegalLinks titleKey="kontakt.legal.title" />
    </WebSection>
  );
}

/* ── Billing details ── */

const BILLING = ['name', 'ico', 'seat', 'site'] as const;

export default function KontaktPage() {
  return (
    <>
      <CompanyHero slots={{ eyebrow: 'kontakt.hero.eyebrow', title: 'kontakt.hero.title', lead: 'kontakt.hero.lead', photo: 'kontakt.hero.photo' }}>
        <HeroButtons />
      </CompanyHero>

      <WebSection py={[44, 64]} innerSx={sectionStack}>
        <ContactCards />
        <MapBlock />
      </WebSection>

      <WebSection tone="warm" py={[44, 64]} innerSx={sectionStack}>
        <SectionHead title="kontakt.way.title" />
        <CardGrid desktop={3} component="ul">
          {WAYS.map((way) => (
            <Card key={way} component="li">
              <SlotText slotKey={`kontakt.way.${way}.title`} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 17 }} />
              <SlotText slotKey={`kontakt.way.${way}.text`} as="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.bodySoft }} />
            </Card>
          ))}
        </CardGrid>
      </WebSection>

      <WebSection py={[44, 64]} innerSx={sectionStack}>
        <SectionHead title="kontakt.hours.title" />
        <HoursTable />
        <SlotText slotKey="kontakt.hours.note" as="p" sx={{ m: 0, fontSize: 15, color: W.bodySoft }} />
      </WebSection>

      <AskBand />

      <UsefulLinks />

      <WebSection tone="warm" py={[44, 64]} innerSx={sectionStack}>
        <SectionHead title="kontakt.billing.title" />
        <Box
          component="dl"
          sx={{
            m: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '20px 16px',
            [MQ.tablet]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
            [MQ.desktop]: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {BILLING.map((field) => (
            <BillingField key={field} field={field} />
          ))}
          <CompanyEntries />
        </Box>
      </WebSection>
    </>
  );
}

/** DIČ, bank account and data box: the clinic's own entries — each one is shown only when it is filled in. */
function CompanyEntries() {
  const { company } = useContactDetails();
  const entries = [
    { key: 'dic', value: company.dic },
    { key: 'bank', value: company.bankAccount },
    { key: 'databox', value: company.dataBox },
  ].filter((entry) => entry.value !== '');
  return (
    <>
      {entries.map((entry) => (
        <Box key={entry.key} sx={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <SlotText slotKey={`kontakt.billing.${entry.key}.label`} as="dt" sx={{ ...labelSx, letterSpacing: '0.07em' }} />
          <Box component="dd" sx={{ m: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{entry.value}</Box>
        </Box>
      ))}
    </>
  );
}

function BillingField({ field }: { field: (typeof BILLING)[number] }) {
  const value = useSlotText(`kontakt.billing.${field}.value`);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
      <SlotText slotKey={`kontakt.billing.${field}.label`} as="dt" sx={{ ...labelSx, letterSpacing: '0.07em' }} />
      <Box component="dd" sx={{ m: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
        <Lines text={value} />
      </Box>
    </Box>
  );
}

function HeroButtons() {
  const book = useSlotText('kontakt.hero.cta.book');
  const prices = useSlotText('kontakt.hero.cta.prices');
  return (
    <>
      <CtaButton to={BOOKING_PATH} height={52} fontSize={16} px={28} sx={{ width: { xs: '100%', sm: 'auto' } }}>{book}</CtaButton>
      <CtaButton to="/cenik" variant="ghostDark" height={52} fontSize={16} px={26} sx={{ width: { xs: '100%', sm: 'auto' } }}>{prices}</CtaButton>
    </>
  );
}
