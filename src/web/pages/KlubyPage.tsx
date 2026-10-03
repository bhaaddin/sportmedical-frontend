/* /web/kluby — the club offer (artboard V-Kluby).

   What a club gets, how a block reservation works, the discount, "Mám odkaz od klubu" and the way to
   ask. The discount is shown ONLY from the published discount tiers (useDiscountTiers); without them
   the card says there is a favourable offer and shows no number. The minimum headcount is an editable
   text slot. "Mám odkaz od klubu" (id="mam-odkaz") takes the link the club sent — a whole address or just
   its token — and opens that club's registration, /klub/<token>. */

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Box } from '@mui/material';
import { formatPercent, topTier, useDiscountTiers } from '../../api/publicDiscounts';
import { SlotText, useSlotText } from '../../site/SlotText';
import { BENEFIT_COUNT, CLUB_GALLERY_COUNT, STEP_COUNT } from '../../site/slots/kluby';
import { CtaButton, Eyebrow, SectionTitle, WebSection } from '../ui';
import { FONT_HEAD, MQ, W } from '../tokens';
import { Card, CardGrid, CompanyHero, PhotoGrid, SectionHead, StepList, sectionStack } from './company/blocks';
import { clubLinkTarget } from './company/clubLink';
import { useContactDetails } from './company/contactData';

const capitalize = (text: string): string => (text === '' ? text : `${text[0].toUpperCase()}${text.slice(1)}`);
const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

function HeroButtons() {
  const inquiry = useSlotText('kluby.hero.cta.inquiry');
  const link = useSlotText('kluby.hero.cta.link');
  return (
    <>
      <CtaButton to="/web/kontakt#poptavka" height={52} fontSize={16} px={28} sx={{ width: { xs: '100%', sm: 'auto' } }}>{inquiry}</CtaButton>
      <CtaButton to="#mam-odkaz" variant="ghostDark" height={52} fontSize={16} px={26} sx={{ width: { xs: '100%', sm: 'auto' } }}>{link}</CtaButton>
    </>
  );
}

/* ── Conditions: the minimum, everywhere, the discount, weekends ── */

function TermCard({ value, titleKey, text }: { value: string; titleKey: string; text: string }) {
  return (
    <Card component="li" sx={{ gap: '7px' }}>
      <Box component="span" sx={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 28, color: W.orangeText, letterSpacing: '-0.03em' }}>{value}</Box>
      <SlotText slotKey={titleKey} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 17 }} />
      <Box component="p" sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: W.bodySoft }}>{text}</Box>
    </Card>
  );
}

function TermsSection() {
  const { data: tiers } = useDiscountTiers();
  const best = topTier(tiers);
  const minValue = useSlotText('kluby.terms.min.value');
  const minText = useSlotText('kluby.terms.min.text');
  const whereValue = useSlotText('kluby.terms.where.value');
  const whereText = useSlotText('kluby.terms.where.text');
  const priceFallback = useSlotText('kluby.terms.price.fallback');
  const priceText = useSlotText('kluby.terms.price.text');
  const from = useSlotText('kluby.tiers.from');
  const persons = useSlotText('kluby.tiers.persons');
  const weekendValue = useSlotText('kluby.terms.weekend.value');
  const weekendText = useSlotText('kluby.terms.weekend.text');

  // The discount and the headcount it starts at are the server's own figures; without them there is no number.
  const priceValue = best !== null ? formatPercent(best.percent) : priceFallback;
  const priceBody = best !== null ? `${capitalize(from)} ${best.minPersons} ${persons}. ${priceText}` : priceText;

  return (
    <WebSection py={[44, 64]} innerSx={sectionStack}>
      <SectionHead title="kluby.terms.title" />
      <CardGrid desktop={4} component="ul">
        <TermCard value={minValue} titleKey="kluby.terms.min.title" text={minText} />
        <TermCard value={whereValue} titleKey="kluby.terms.where.title" text={whereText} />
        <TermCard value={priceValue} titleKey="kluby.terms.price.title" text={priceBody} />
        <TermCard value={weekendValue} titleKey="kluby.terms.weekend.title" text={weekendText} />
      </CardGrid>
      {tiers.length > 0 && (
        <Box component="section" aria-labelledby="kluby-tiers" sx={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: 640 }}>
          <SlotText slotKey="kluby.tiers.title" as="h3" id="kluby-tiers" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 22 }} />
          <SlotText slotKey="kluby.tiers.lead" as="p" sx={{ m: 0, fontSize: 16, lineHeight: 1.6, color: W.bodySoft }} />
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, border: `1px solid ${W.lineStrong}`, borderRadius: '16px', overflow: 'hidden' }}>
            {tiers.map((tier, index) => (
              <Box
                key={tier.minPersons}
                component="li"
                sx={{ display: 'flex', justifyContent: 'space-between', gap: '16px', p: '15px 20px', minHeight: 44, borderTop: index > 0 ? `1px solid ${W.line}` : 'none' }}
              >
                <Box component="span" sx={{ fontSize: 16, fontWeight: 600 }}>{`${from} ${tier.minPersons} ${persons}`}</Box>
                <Box component="span" sx={{ fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{formatPercent(tier.percent)}</Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </WebSection>
  );
}

/* ── What the club gets ── */

function GainSection() {
  return (
    <WebSection tone="warm" py={[44, 64]} innerSx={sectionStack}>
      <SectionHead title="kluby.gain.title" />
      <CardGrid desktop={3} component="ul">
        {range(BENEFIT_COUNT).map((n) => (
          <Card key={n} component="li" sx={{ flexDirection: 'row', alignItems: 'flex-start', gap: '13px', p: { xs: '18px 20px', md: '20px 22px' } }}>
            <Box component="span" aria-hidden="true" sx={{ flex: '0 0 9px', width: 9, height: 9, borderRadius: '50%', bgcolor: W.orange, mt: '8px' }} />
            <SlotText slotKey={`kluby.gain.${n}`} sx={{ fontSize: 15, lineHeight: 1.6 }} />
          </Card>
        ))}
      </CardGrid>
    </WebSection>
  );
}

/* ── How it works ── */

function HowSection() {
  return (
    <WebSection py={[44, 64]} innerSx={sectionStack}>
      <SectionHead title="kluby.how.title" lead="kluby.how.lead" />
      <StepList count={STEP_COUNT} keyOf={(n, part) => `kluby.how.${n}.${part}`} />
      <PhotoGrid keys={range(CLUB_GALLERY_COUNT).map((n) => `kluby.how.photo${n}`)} desktop={3} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw" />
    </WebSection>
  );
}

/* ── "Mám odkaz od klubu" ── */

const goTo = (path: string): void => {
  window.location.assign(path);
};

/** `navigate` is the page change; the default is a real page load, because /klub/<token> belongs to the application bundle. */
export function ClubLinkSection({ navigate = goTo }: { navigate?: (path: string) => void }) {
  const [value, setValue] = useState('');
  const [failed, setFailed] = useState(false);
  const placeholder = useSlotText('kluby.link.placeholder');
  const button = useSlotText('kluby.link.button');
  const label = useSlotText('kluby.link.label');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = clubLinkTarget(value);
    if (target === null) {
      setFailed(true);
      return;
    }
    setFailed(false);
    navigate(target);
  };

  return (
    <WebSection tone="warm" id="mam-odkaz" py={[44, 64]} borderTop>
      <Box
        sx={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '28px', md: '36px' }, alignItems: 'center',
          [MQ.tablet]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
          [MQ.desktop]: { gridTemplateColumns: 'minmax(0, 1fr) 560px', gap: '56px' },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          <Eyebrow><SlotText slotKey="kluby.link.eyebrow" /></Eyebrow>
          <SectionTitle size="md"><SlotText slotKey="kluby.link.title" /></SectionTitle>
          <SlotText slotKey="kluby.link.text" as="p" sx={{ m: 0, fontSize: 17, lineHeight: 1.6, color: W.bodySoft, maxWidth: '52ch' }} />
        </Box>

        <Box
          component="form"
          noValidate
          onSubmit={submit}
          sx={{ bgcolor: W.white, border: `1px solid ${W.lineStrong}`, borderRadius: '18px', p: { xs: '20px', md: '28px' }, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}
        >
          <Box component="label" htmlFor="club-link-input" sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: W.muted }}>
            {label}
          </Box>
          <Box
            component="input"
            id="club-link-input"
            name="clubLink"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={value}
            placeholder={placeholder}
            aria-invalid={failed}
            aria-describedby={failed ? 'club-link-hint club-link-error' : 'club-link-hint'}
            onChange={(event: ChangeEvent<HTMLInputElement>) => { setValue(event.target.value); if (failed) setFailed(false); }}
            sx={{
              width: '100%', boxSizing: 'border-box', minHeight: 52, px: '16px', fontSize: 16, fontFamily: 'inherit', color: W.text, bgcolor: W.white,
              border: `1px solid ${failed ? '#B3261E' : '#CFC8BC'}`, borderRadius: '12px',
              '&:focus': { outline: `2px solid ${W.orange}`, outlineOffset: 1 },
              '&::placeholder': { color: W.muted },
            }}
          />
          <SlotText slotKey="kluby.link.hint" id="club-link-hint" sx={{ fontSize: 14, lineHeight: 1.5, color: W.bodySoft }} />
          {failed && <SlotText slotKey="kluby.link.error" id="club-link-error" sx={{ fontSize: 14, lineHeight: 1.5, color: '#B3261E', fontWeight: 600 }} />}
          <Box
            component="button"
            type="submit"
            sx={{
              mt: '4px', minHeight: 52, px: '28px', borderRadius: '26px', border: 0, cursor: 'pointer', bgcolor: W.orange, color: W.onOrange, fontFamily: FONT_HEAD,
              fontWeight: 700, fontSize: 16, '&:hover': { bgcolor: '#E5841F' }, '&:focus-visible': { outline: `2px solid ${W.text}`, outlineOffset: 2 },
            }}
          >
            {button}
          </Box>
        </Box>
      </Box>
    </WebSection>
  );
}

/* ── Enquiry ── */

function AskBand() {
  const contact = useContactDetails();
  const label = useSlotText('kluby.ask.cta.contact');
  return (
    <WebSection tone="ink" py={[48, 72]}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: '28px', md: '40px' }, justifyContent: 'space-between', alignItems: { md: 'center' } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <SlotText slotKey="kluby.ask.title" as="h2" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 'clamp(28px, 3.4vw, 40px)', letterSpacing: '-0.035em' }} />
          <SlotText slotKey="kluby.ask.text" as="p" sx={{ m: 0, fontSize: 17, lineHeight: 1.6, color: W.onInk, maxWidth: '54ch' }} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: '12px' }}>
          <CtaButton to="/web/kontakt#poptavka" height={54} fontSize={16} px={28} sx={{ width: { xs: '100%', sm: 'auto' } }}>{label}</CtaButton>
          <Box
            component="a"
            href={contact.phoneHref}
            sx={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 54, px: '26px', borderRadius: '27px', border: `1px solid ${W.inkBorder}`,
              color: W.white, fontWeight: 600, fontSize: 16, textDecoration: 'none', fontVariantNumeric: 'tabular-nums', '&:hover': { color: W.white, borderColor: W.onInkMuted },
            }}
          >
            {contact.phone}
          </Box>
        </Box>
      </Box>
    </WebSection>
  );
}

export default function KlubyPage() {
  return (
    <>
      <CompanyHero slots={{ eyebrow: 'kluby.hero.eyebrow', title: 'kluby.hero.title', lead: 'kluby.hero.lead', photo: 'kluby.hero.photo' }}>
        <HeroButtons />
      </CompanyHero>
      <TermsSection />
      <GainSection />
      <HowSection />
      <ClubLinkSection />
      <AskBand />
    </>
  );
}
