/* ══════════════════════════════════════════════════════════════
   OBJEDNÁNÍ ONLINE  (route: /objednat)

   The clinic's public page and its booking in one flow. What the website says
   — who we are, how a visit goes, what to bring, the club offer, the FAQ — is
   here too, so a patient arriving from a search does not have to leave to
   find out what a "komplexní prohlídka" is before choosing one.

   ── What comes from where ──

   Services, prices, durations and the clinic's own notes: /api/public/booking/offer,
   the admin's own calendars. Nothing on this page lists a service the owner has
   not marked publicly bookable. The price list (/api/public/price-list) and the
   contacts (/api/public/clinic) come from the same settings. The marketing copy,
   the document PDFs, the FAQ and the partner names are in ./content.ts, which
   is the one file to edit for a sentence.

   ── One page that grows, not a wizard ──

   Choosing a činnost reveals the days; choosing a day reveals the times; the
   time is held from the moment it is clicked and the patient goes on to the
   registration (/dotaznik) with a minute's typing still ahead of them, rather
   than being told at the end that somebody else got there first.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress,
  Container, Link, Typography,
} from '@mui/material';
import {
  ArrowForwardOutlined, CheckOutlined, DescriptionOutlined, DirectionsOutlined, EmailOutlined,
  EventAvailableOutlined, ExpandMoreOutlined, GroupsOutlined, PhoneOutlined, PlaceOutlined,
  ScheduleOutlined, SportsScoreOutlined, StarOutlineOutlined, TrainOutlined,
} from '@mui/icons-material';
import {
  SlotGoneError, bookableOffer, freeDays, freeSlots, holdSlot, readPublicPriceList, rememberHeld,
} from '../../api/publicBooking';
import type { BookableActivity, BookableService, BookableSlot, PriceListCategory } from '../../api/publicBooking';
import { readPublicClinic } from '../../api/clinicSettings';
import type { PublicClinic } from '../../api/clinicSettings';
import PublicLayout from './PublicLayout';
import { BRAND, clinicDate, clinicTime, czk, mapsHref, telHref } from '../../components/public/brand';
import { scrollToSection } from '../../components/public/PublicHeader';
import { CLUB, DOCUMENTS, FAQ, GUIDES, HERO, HOW_IT_WORKS, PARTNERS, SITE } from './content';

/** How far ahead the day list asks. The calendar's own horizon still applies. */
const HORIZON_DAYS = 60;

const iso = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Minutes, declined the way Czech declines them: 1 minutu, 2-4 minuty, 5+ minut.
 * The number is the clinic's to choose, so every case is reachable.
 */
function minuteWord(minutes: number): string | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes === 1) return '1 minutu';
  if (minutes >= 2 && minutes <= 4) return `${minutes} minuty`;
  return `${minutes} minut`;
}

/** ", nebo nám zavolejte na 123" — or nothing at all when there is no number. */
function ringUs(clinic: PublicClinic | null, lead: string): string {
  const phone = clinic?.phone.trim() ?? '';
  return phone === '' ? '' : `${lead}${phone}`;
}

/** "1 600 Kč · 40 min" — whichever parts the clinic has set. */
function priceLine(priceCzk: number | null | undefined, durationMinutes: number | null | undefined): string {
  const parts: string[] = [];
  const price = czk(priceCzk);
  if (price !== null) parts.push(price);
  if (typeof durationMinutes === 'number' && durationMinutes > 0) parts.push(`${durationMinutes} min`);
  return parts.length > 0 ? parts.join(' · ') : 'Cena na dotaz';
}

/** The cheapest priced činnost of a service, for "od 1 600 Kč". */
function fromPrice(service: BookableService): string | null {
  const prices = service.activities
    .map((a) => a.priceCzk)
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
  if (prices.length === 0) return null;
  return `od ${czk(Math.min(...prices))}`;
}

const isPackage = (name: string): boolean => /balí[čc]/i.test(name);

type Chosen = { service: BookableService; activity: BookableActivity };

export default function PublicBooking() {
  const navigate = useNavigate();
  const location = useLocation();

  const [services, setServices] = useState<BookableService[] | null>(null);
  const [offerFailed, setOfferFailed] = useState(false);
  const [priceList, setPriceList] = useState<PriceListCategory[]>([]);

  /* The clinic's telephone, e-mail and address, from the admin's own settings.
     Null while loading, empty when nobody has filled it in — both mean "say
     nothing" rather than invent one. */
  const [clinic, setClinic] = useState<PublicClinic | null>(null);

  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [days, setDays] = useState<string[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<BookableSlot[] | null>(null);
  const [holding, setHolding] = useState<string | null>(null);
  const [complaint, setComplaint] = useState<string | null>(null);

  const bookingRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    bookableOffer()
      .then((offer) => { if (!cancelled) setServices(offer); })
      .catch(() => { if (!cancelled) setOfferFailed(true); });

    // Neither of these throws; a missing telephone number or a server without
    // the price list must not cost the patient the booking screen.
    void readPublicClinic().then((details) => { if (!cancelled) setClinic(details); });
    void readPublicPriceList().then((list) => { if (!cancelled) setPriceList(list); });

    return () => { cancelled = true; };
  }, []);

  /* A link into a section (/objednat#cenik) lands on it once the page has
     something to scroll to. */
  useEffect(() => {
    if (services === null || location.hash.length < 2) return;
    scrollToSection(location.hash.slice(1));
  }, [services, location.hash]);

  /* Days for the chosen činnost. Cleared first, so a slow answer for the
     previous choice can never land under the new one. */
  useEffect(() => {
    if (chosen === null) return undefined;

    let cancelled = false;
    setDays(null);
    setDay(null);
    setSlots(null);

    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + HORIZON_DAYS);

    freeDays(chosen.activity.calendarId, chosen.activity.id, iso(from), iso(to))
      .then((free) => { if (!cancelled) setDays(free); })
      .catch(() => { if (!cancelled) setDays([]); });

    return () => { cancelled = true; };
  }, [chosen]);

  useEffect(() => {
    if (chosen === null || day === null) return undefined;

    let cancelled = false;
    setSlots(null);

    freeSlots(chosen.activity.calendarId, chosen.activity.id, day)
      .then((free) => { if (!cancelled) setSlots(free); })
      .catch(() => { if (!cancelled) setSlots([]); });

    return () => { cancelled = true; };
  }, [chosen, day]);

  const choose = (service: BookableService, activity: BookableActivity): void => {
    setChosen({ service, activity });
    setComplaint(null);
    // The panel renders on the next paint; scroll once it exists.
    window.setTimeout(() => {
      const panel = bookingRef.current;
      if (panel !== null && typeof panel.scrollIntoView === 'function') {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 30);
  };

  /**
   * Hold the slot, then go to the registration. The hold happens BEFORE the
   * form: the time is theirs while they type, and a refusal comes now, while
   * they have typed nothing.
   */
  const take = async (slot: BookableSlot): Promise<void> => {
    if (chosen === null) return;

    setHolding(slot.startUtc);
    setComplaint(null);

    try {
      const held = await holdSlot(chosen.activity.calendarId, chosen.activity.id, slot.startUtc);

      rememberHeld({
        token: held.token,
        startUtc: held.startUtc,
        endUtc: held.endUtc,
        expiresAtUtc: held.expiresAtUtc,
        serviceName: chosen.service.name,
        activityName: chosen.activity.name,
        activityId: chosen.activity.id,
        calendarId: chosen.activity.calendarId,
        requiresReportByEmail: chosen.activity.requiresReportByEmail,
        requiresClubSharing: chosen.activity.requiresClubSharing,
        questionnaireRequirement: chosen.activity.questionnaireRequirement,
      });

      navigate('/dotaznik');
    } catch (error) {
      setHolding(null);

      if (error instanceof SlotGoneError) {
        setComplaint(error.message);
        // Ask again rather than leaving a dead time on screen.
        if (day !== null) {
          freeSlots(chosen.activity.calendarId, chosen.activity.id, day)
            .then(setSlots)
            .catch(() => setSlots([]));
        }
        return;
      }

      setComplaint('Termín se nepodařilo rezervovat. Zkuste to prosím znovu.');
    }
  };

  const nothingOffered = services !== null && services.length === 0;
  const phone = clinic?.phone.trim() ?? '';
  const email = clinic?.email.trim() ?? '';
  const address = clinic?.address.trim() ?? '';
  const hours = clinic?.openingHours?.trim() || SITE.hoursFallback;

  const stepNow: 2 | 3 = day === null ? 2 : 3;

  return (
    <PublicLayout clinic={clinic}>
      <Hero clinic={clinic} />

      <Container maxWidth="lg" sx={{ pb: { xs: chosen !== null ? 14 : 6, md: 10 } }}>
        {/* ── Služby ── */}
        <Section id="sluzby" eyebrow="Služby a ceny" title="Co potřebujete">
          {offerFailed && (
            <Alert severity="error">
              Nabídku se nepodařilo načíst. Zkuste to prosím za chvíli znovu{ringUs(clinic, ', nebo nám zavolejte na ')}.
            </Alert>
          )}

          {services === null && !offerFailed && <Waiting text="Načítáme nabídku…" />}

          {nothingOffered && (
            <Card>
              <Typography sx={{ fontWeight: 800, fontSize: 19, mb: 1 }}>
                Online objednávání právě není otevřené
              </Typography>
              <Typography variant="body2" sx={{ color: BRAND.muted }}>
                {phone !== ''
                  ? `Termín vám rádi domluvíme telefonicky na ${phone}.`
                  : 'Zkuste to prosím později.'}
              </Typography>
            </Card>
          )}

          {services !== null && services.length > 0 && (
            <Box sx={{ display: 'grid', gap: { xs: 3, md: 4 } }}>
              {services.map((service) => (
                <ServiceGroup
                  key={service.id}
                  service={service}
                  chosenId={chosen?.activity.id ?? null}
                  onChoose={(activity) => choose(service, activity)}
                />
              ))}
            </Box>
          )}
        </Section>

        {/* ── Rezervace: den a čas ── */}
        {chosen !== null && (
          <Box id="rezervace" ref={bookingRef} sx={{ scrollMarginTop: 84, mt: { xs: 3, md: 4 } }}>
            <Card accent>
              <Stepper current={stepNow} />

              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: BRAND.accentDark, textTransform: 'uppercase' }}>
                    Vybrané vyšetření
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 18 }}>{chosen.activity.name}</Typography>
                  <Typography variant="body2" sx={{ color: BRAND.muted }}>
                    {chosen.service.name} · {priceLine(chosen.activity.priceCzk, chosen.activity.durationMinutes)}
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { setChosen(null); scrollToSection('sluzby'); }}
                >
                  Změnit vyšetření
                </Button>
              </Box>

              {/* 2. Kdy */}
              <StepTitle number={2} title="Kdy vám to vyhovuje" done={day !== null} />

              {days === null && <Waiting text="Hledám volné termíny…" />}

              {days !== null && days.length === 0 && (
                <Typography variant="body2" sx={{ color: BRAND.muted }}>
                  V nejbližších {HORIZON_DAYS} dnech nemáme volno{ringUs(clinic, '. Zavolejte nám prosím na ')}.
                </Typography>
              )}

              {days !== null && days.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {days.map((free) => (
                    <Chip
                      key={free}
                      label={clinicDate(free)}
                      onClick={() => setDay(free)}
                      sx={{
                        fontWeight: 700,
                        py: 2.25,
                        cursor: 'pointer',
                        bgcolor: day === free ? BRAND.ink : BRAND.paper,
                        color: day === free ? BRAND.accent : 'inherit',
                        border: `1px solid ${day === free ? BRAND.ink : BRAND.line}`,
                        '&:hover': { bgcolor: day === free ? BRAND.ink : BRAND.accentWash },
                      }}
                    />
                  ))}
                </Box>
              )}

              {/* 3. V kolik */}
              {day !== null && (
                <Box sx={{ mt: 4 }}>
                  <StepTitle number={3} title="V kolik hodin" />

                  {complaint !== null && (
                    <Alert severity="warning" sx={{ mb: 2 }}>{complaint}</Alert>
                  )}

                  {slots === null && <Waiting text="Hledám volné časy…" />}

                  {slots !== null && slots.length === 0 && (
                    <Typography variant="body2" sx={{ color: BRAND.muted }}>
                      Na tento den už volno nemáme. Zkuste prosím jiný.
                    </Typography>
                  )}

                  {slots !== null && slots.length > 0 && (
                    <>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {slots.map((slot) => (
                          <Box
                            key={slot.startUtc}
                            component="button"
                            type="button"
                            disabled={holding !== null}
                            onClick={() => { void take(slot); }}
                            sx={{
                              minWidth: 84,
                              py: 1.1,
                              px: 1.5,
                              borderRadius: 999,
                              cursor: holding === null ? 'pointer' : 'progress',
                              fontFamily: 'inherit',
                              fontSize: 15,
                              fontWeight: 700,
                              bgcolor: holding === slot.startUtc ? BRAND.ink : BRAND.paper,
                              color: holding === slot.startUtc ? BRAND.accent : 'inherit',
                              border: `1px solid ${holding === slot.startUtc ? BRAND.ink : BRAND.line}`,
                              opacity: holding !== null && holding !== slot.startUtc ? 0.45 : 1,
                              transition: 'background-color 120ms ease, opacity 120ms ease',
                              '&:hover': { borderColor: holding === null ? BRAND.lineStrong : undefined },
                            }}
                          >
                            {clinicTime(slot.startUtc)}
                          </Box>
                        ))}
                      </Box>

                      {/* The clinic's own hold length, never a number written here. */}
                      {minuteWord(chosen.activity.holdMinutes) !== null && (
                        <Typography variant="caption" sx={{ color: BRAND.muted, display: 'block', mt: 2 }}>
                          Po výběru času vám termín podržíme{' '}
                          {minuteWord(chosen.activity.holdMinutes)}, než vyplníte registraci.
                          Dotazník vyplníte hned poté, z domova.
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
              )}
            </Card>
          </Box>
        )}

        {/* ── Jak to probíhá ── */}
        <Section id="jak-to-probiha" eyebrow="Jak to probíhá" title="Tři kroky k posudku">
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
            {HOW_IT_WORKS.map((step, index) => (
              <Card key={step.title}>
                <NumberBadge>{index + 1}</NumberBadge>
                <Typography sx={{ fontWeight: 800, fontSize: 17, mt: 1.5, mb: 0.5 }}>{step.title}</Typography>
                <Typography variant="body2" sx={{ color: BRAND.muted }}>{step.text}</Typography>
              </Card>
            ))}
          </Box>
        </Section>

        {/* ── Ceník ── only when the server publishes one */}
        {priceList.length > 0 && (
          <Section id="cenik" eyebrow="Ceník" title="Kompletní ceník služeb">
            <Box sx={{ display: 'grid', gap: 2 }}>
              {priceList.map((group) => (
                <Card key={group.category}>
                  <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 1.5 }}>{group.category}</Typography>
                  <Box sx={{ display: 'grid' }}>
                    {group.items.map((item, index) => (
                      <Box
                        key={item.code || `${group.category}-${index}`}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr auto', sm: '1fr auto auto' },
                          columnGap: 2,
                          rowGap: 0.25,
                          alignItems: 'baseline',
                          py: 1.25,
                          borderTop: index === 0 ? 'none' : `1px solid ${BRAND.line}`,
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 600 }}>{item.name}</Typography>
                          {item.description !== '' && (
                            <Typography variant="body2" sx={{ color: BRAND.muted }}>{item.description}</Typography>
                          )}
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{ color: BRAND.muted, display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}
                        >
                          {typeof item.durationMinutes === 'number' && item.durationMinutes > 0
                            ? `${item.durationMinutes} min`
                            : ''}
                        </Typography>
                        <Typography sx={{ fontWeight: 800, whiteSpace: 'nowrap', textAlign: 'right' }}>
                          {czk(item.priceCzk) ?? 'na dotaz'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Card>
              ))}
            </Box>
            <Typography variant="caption" sx={{ color: BRAND.muted, display: 'block', mt: 1.5 }}>
              Ceny jsou konečné, platí se na místě kartou nebo hotově.
            </Typography>
          </Section>
        )}

        {/* ── Co vzít s sebou ── */}
        <Section id="dokumenty" eyebrow="Dokumenty" title="Co vzít s sebou">
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' } }}>
            <Card>
              <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 1.5 }}>K vyšetření</Typography>
              <Box sx={{ display: 'grid', gap: 1.25 }}>
                {DOCUMENTS.map((doc) => <DocumentRow key={doc.url} doc={doc} />)}
              </Box>
            </Card>
            <Card>
              <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 1.5 }}>Doporučení před vyšetřením</Typography>
              <Box sx={{ display: 'grid', gap: 1.25 }}>
                {GUIDES.map((doc) => <DocumentRow key={doc.url} doc={doc} />)}
              </Box>
            </Card>
          </Box>
        </Section>

        {/* ── Kluby ── */}
        <Section id="klub" eyebrow={CLUB.eyebrow} title={CLUB.title}>
          <Card dark>
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' }, alignItems: 'center' }}>
              <Box>
                <Typography sx={{ color: BRAND.onInk, mb: 2 }}>{CLUB.text}</Typography>
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {CLUB.bullets.map((bullet) => (
                    <Box key={bullet} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <CheckOutlined sx={{ fontSize: 18, color: BRAND.accent }} />
                      <Typography sx={{ fontWeight: 600 }}>{bullet}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box sx={{ display: 'grid', gap: 1.25 }}>
                {email !== '' && (
                  <Button
                    variant="contained"
                    size="large"
                    href={`mailto:${email}?subject=${encodeURIComponent(CLUB.mailSubject)}`}
                    startIcon={<GroupsOutlined />}
                    sx={{ color: BRAND.ink }}
                  >
                    {CLUB.cta}
                  </Button>
                )}
                {phone !== '' && (
                  <Button
                    variant="outlined"
                    size="large"
                    href={telHref(phone)}
                    startIcon={<PhoneOutlined />}
                    sx={{ color: '#FFFFFF', borderColor: BRAND.onInkLine, '&:hover': { borderColor: '#FFFFFF', bgcolor: BRAND.onInkWash } }}
                  >
                    Zavolat {phone}
                  </Button>
                )}
                {email === '' && phone === '' && (
                  <Typography sx={{ color: BRAND.onInk }}>
                    Kontakt na klubovou nabídku najdete na webu kliniky.
                  </Typography>
                )}
              </Box>
            </Box>
          </Card>

          {PARTNERS.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: BRAND.muted, textTransform: 'uppercase', mb: 1.25 }}>
                Spolupracujeme s
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {PARTNERS.map((partner) => (
                  <Chip key={partner} label={partner} variant="outlined" sx={{ bgcolor: BRAND.paper, borderColor: BRAND.line }} />
                ))}
              </Box>
            </Box>
          )}
        </Section>

        {/* ── Kontakt ── */}
        <Section id="kontakt" eyebrow="Kontakt" title="Kde nás najdete">
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <Card>
              <Box sx={{ display: 'grid', gap: 1.5 }}>
                {phone !== '' && (
                  <ContactLine icon={<PhoneOutlined />} label="Telefon">
                    <Link href={telHref(phone)} sx={{ color: 'inherit', fontWeight: 700 }}>{phone}</Link>
                  </ContactLine>
                )}
                {email !== '' && (
                  <ContactLine icon={<EmailOutlined />} label="E-mail">
                    <Link href={`mailto:${email}`} sx={{ color: 'inherit', fontWeight: 700, overflowWrap: 'anywhere' }}>{email}</Link>
                  </ContactLine>
                )}
                {address !== '' && (
                  <ContactLine icon={<PlaceOutlined />} label="Adresa">
                    <Typography sx={{ fontWeight: 700 }}>{address}</Typography>
                  </ContactLine>
                )}
                <ContactLine icon={<ScheduleOutlined />} label="Ordinační hodiny">
                  <Typography sx={{ fontWeight: 700 }}>{hours}</Typography>
                </ContactLine>
                {SITE.transport !== '' && (
                  <ContactLine icon={<TrainOutlined />} label="Doprava">
                    <Typography variant="body2" sx={{ color: BRAND.muted }}>{SITE.transport}</Typography>
                  </ContactLine>
                )}
                {clinic !== null && phone === '' && email === '' && address === '' && (
                  <Typography variant="body2" sx={{ color: BRAND.muted }}>
                    Kontaktní údaje najdete na webu kliniky.
                  </Typography>
                )}
              </Box>
              {address !== '' && (
                <Button
                  variant="contained"
                  href={mapsHref(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<DirectionsOutlined />}
                  sx={{ mt: 2.5, color: BRAND.ink }}
                >
                  Navigovat
                </Button>
              )}
            </Card>

            <Card>
              <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 0.5 }}>Raději po telefonu?</Typography>
              <Typography variant="body2" sx={{ color: BRAND.muted, mb: 2 }}>
                Termín vám domluvíme i telefonicky nebo e-mailem. Online objednání je
                ale nejrychlejší: termín vidíte hned a dotazník vyplníte z domova.
              </Typography>
              <Button
                variant="outlined"
                onClick={() => scrollToSection('sluzby')}
                endIcon={<ArrowForwardOutlined />}
              >
                Vybrat vyšetření online
              </Button>
            </Card>
          </Box>
        </Section>

        {/* ── FAQ ── */}
        {FAQ.length > 0 && (
          <Section id="faq" eyebrow="Časté otázky" title="Na co se ptáte nejčastěji">
            <Box sx={{ display: 'grid', gap: 1 }}>
              {FAQ.map((item) => (
                <Accordion
                  key={item.q}
                  disableGutters
                  elevation={0}
                  square
                  sx={{
                    bgcolor: BRAND.paper,
                    border: `1px solid ${BRAND.line}`,
                    borderRadius: '14px !important',
                    '&::before': { display: 'none' },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ px: 2.5, minHeight: 56 }}>
                    <Typography sx={{ fontWeight: 700 }}>{item.q}</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 2.5, pt: 0, pb: 2.5 }}>
                    <Typography variant="body2" sx={{ color: BRAND.muted }}>{item.a}</Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          </Section>
        )}
      </Container>

      {/* Sticky summary on a phone: what is chosen and what comes next. */}
      {chosen !== null && (
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: (theme) => theme.zIndex.appBar,
            bgcolor: BRAND.ink,
            color: '#FFFFFF',
            px: 2,
            py: 1.5,
            gap: 1.5,
            alignItems: 'center',
            borderTop: `1px solid ${BRAND.onInkLine}`,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {chosen.activity.name}
            </Typography>
            <Typography sx={{ fontSize: 12.5, color: BRAND.onInk }}>
              {priceLine(chosen.activity.priceCzk, chosen.activity.durationMinutes)}
              {' · '}
              {day === null ? 'vyberte den' : `${clinicDate(day)} · vyberte čas`}
            </Typography>
          </Box>
          <Button
            size="small"
            variant="contained"
            onClick={() => bookingRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}
            sx={{ color: BRAND.ink, whiteSpace: 'nowrap' }}
          >
            {day === null ? 'Vybrat den' : 'Vybrat čas'}
          </Button>
        </Box>
      )}
    </PublicLayout>
  );
}

/* ── Pieces ── */

function Hero({ clinic }: { clinic: PublicClinic | null }) {
  const phone = clinic?.phone.trim() ?? '';
  return (
    <Box
      sx={{
        bgcolor: BRAND.ink,
        backgroundImage: 'radial-gradient(1200px 420px at 78% -20%, rgba(255,157,0,0.16), transparent 68%)',
        color: '#FFFFFF',
        pt: { xs: 6, md: 10 },
        pb: { xs: 7, md: 11 },
      }}
    >
      <Container maxWidth="lg">
        <Box sx={{ display: 'grid', gap: { xs: 4, md: 6 }, gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' }, alignItems: 'center' }}>
          <Box>
            <Typography sx={{ color: BRAND.accent, fontWeight: 800, fontSize: 12.5, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 2 }}>
              {HERO.eyebrow}
            </Typography>
            <Typography component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.025em', fontSize: { xs: 34, sm: 44, md: 54 }, lineHeight: 1.06, mb: 2 }}>
              {HERO.headline}
            </Typography>
            <Typography sx={{ color: BRAND.onInk, maxWidth: 560, fontSize: { xs: 15.5, md: 17.5 }, mb: 3.5 }}>
              {HERO.lead}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', mb: 3.5 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => scrollToSection('sluzby')}
                endIcon={<ArrowForwardOutlined />}
                sx={{ color: BRAND.ink }}
              >
                {HERO.primaryCta}
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => { if (!scrollToSection('cenik')) scrollToSection('sluzby'); }}
                sx={{ color: '#FFFFFF', borderColor: BRAND.onInkLine, '&:hover': { borderColor: '#FFFFFF', bgcolor: BRAND.onInkWash } }}
              >
                {HERO.secondaryCta}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {HERO.trust.map((point, index) => (
                <Trust
                  key={point}
                  icon={[<EventAvailableOutlined key="a" sx={{ fontSize: 15 }} />, <ScheduleOutlined key="b" sx={{ fontSize: 15 }} />, <SportsScoreOutlined key="c" sx={{ fontSize: 15 }} />][index % 3]}
                  label={point}
                />
              ))}
            </Box>
          </Box>

          <Box
            sx={{
              display: { xs: 'none', md: 'grid' },
              gap: 2,
              p: 3,
              borderRadius: 4,
              border: `1px solid ${BRAND.onInkLine}`,
              bgcolor: BRAND.onInkWash,
            }}
          >
            <Typography sx={{ fontWeight: 800, letterSpacing: '0.1em', fontSize: 12, color: BRAND.accent, textTransform: 'uppercase' }}>
              Jak to probíhá
            </Typography>
            {HOW_IT_WORKS.map((step, index) => (
              <Box key={step.title} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: BRAND.accent, color: BRAND.ink, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                  {index + 1}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{step.title}</Typography>
                  <Typography sx={{ color: BRAND.onInk, fontSize: 13.5 }}>{step.text}</Typography>
                </Box>
              </Box>
            ))}
            {phone !== '' && (
              <Typography sx={{ color: BRAND.onInk, fontSize: 13, mt: 0.5 }}>
                Nebo zavolejte:{' '}
                <Link href={telHref(phone)} sx={{ color: '#FFFFFF', fontWeight: 700 }}>{phone}</Link>
              </Typography>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

function ServiceGroup({
  service, chosenId, onChoose,
}: {
  service: BookableService;
  chosenId: string | null;
  onChoose: (activity: BookableActivity) => void;
}) {
  const from = useMemo(() => fromPrice(service), [service]);
  const pack = isPackage(service.name);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap', mb: 0.5 }}>
        <Typography component="h3" sx={{ fontWeight: 800, fontSize: { xs: 20, md: 22 }, letterSpacing: '-0.01em' }}>
          {service.name}
        </Typography>
        {pack && (
          <Chip
            size="small"
            icon={<StarOutlineOutlined sx={{ fontSize: '15px !important', color: `${BRAND.accentDark} !important` }} />}
            label="Zvýhodněná cena"
            sx={{ bgcolor: BRAND.accentWash, color: BRAND.accentDark, border: `1px solid ${BRAND.accentEdge}` }}
          />
        )}
        {from !== null && (
          <Typography sx={{ color: BRAND.muted, fontWeight: 600, ml: 'auto' }}>{from}</Typography>
        )}
      </Box>
      {service.description !== '' && (
        <Typography variant="body2" sx={{ color: BRAND.muted, mb: 2, maxWidth: 760 }}>{service.description}</Typography>
      )}

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' } }}>
        {service.activities.map((activity) => {
          const picked = chosenId === activity.id;
          return (
            <Box
              key={activity.id}
              onClick={() => onChoose(activity)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                p: 2.25,
                borderRadius: 3.5,
                cursor: 'pointer',
                bgcolor: picked ? BRAND.accentWash : BRAND.paper,
                border: `1px solid ${picked ? BRAND.accentEdge : BRAND.line}`,
                outline: picked ? `2px solid ${BRAND.accent}` : 'none',
                outlineOffset: -1,
                transition: 'border-color 120ms ease, background-color 120ms ease',
                '&:hover': { borderColor: picked ? BRAND.accentEdge : BRAND.lineStrong },
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 0.5 }}>{activity.name}</Typography>
              {activity.publicNote !== '' && (
                <Typography variant="body2" sx={{ color: BRAND.muted, mb: 1.5, flex: 1 }}>
                  {activity.publicNote}
                </Typography>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 'auto', pt: 1 }}>
                <Typography
                  sx={{
                    // typeof, not !== null: an older API omits the field, and
                    // undefined must read as "no price", never crash.
                    fontWeight: typeof activity.priceCzk === 'number' ? 800 : 500,
                    color: typeof activity.priceCzk === 'number' ? 'inherit' : BRAND.muted,
                    fontSize: 15,
                  }}
                >
                  {priceLine(activity.priceCzk, activity.durationMinutes)}
                </Typography>
                <Button
                  size="small"
                  variant={picked ? 'outlined' : 'contained'}
                  onClick={(event) => { event.stopPropagation(); onChoose(activity); }}
                  startIcon={picked ? <CheckOutlined sx={{ fontSize: 16 }} /> : undefined}
                  sx={{ color: BRAND.ink, whiteSpace: 'nowrap' }}
                  aria-label={`${picked ? 'Vybráno' : 'Objednat'}: ${activity.name}`}
                >
                  {picked ? 'Vybráno' : 'Objednat'}
                </Button>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function Stepper({ current }: { current: 2 | 3 }) {
  const steps = ['Vyšetření', 'Den', 'Čas'];
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 3 }}>
      {steps.map((name, index) => {
        const number = index + 1;
        const done = number < current;
        const active = number === current;
        return (
          <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                bgcolor: done ? BRAND.ink : active ? BRAND.accentWash : 'transparent',
                color: done ? BRAND.accent : active ? BRAND.accentDark : BRAND.muted,
                border: `1px solid ${done ? BRAND.ink : active ? BRAND.accentEdge : BRAND.line}`,
              }}
            >
              {done ? <CheckOutlined sx={{ fontSize: 14 }} /> : <span>{number}</span>}
              {name}
            </Box>
            {index < steps.length - 1 && <Box sx={{ width: 18, height: '1px', bgcolor: BRAND.line }} />}
          </Box>
        );
      })}
    </Box>
  );
}

function StepTitle({ number, title, done = false }: { number: number; title: string; done?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
      <NumberBadge small>{done ? <CheckOutlined sx={{ fontSize: 15 }} /> : number}</NumberBadge>
      <Typography sx={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em' }}>{title}</Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: BRAND.line }} />
    </Box>
  );
}

function NumberBadge({ children, small = false }: { children: ReactNode; small?: boolean }) {
  return (
    <Box
      sx={{
        width: small ? 28 : 34,
        height: small ? 28 : 34,
        borderRadius: small ? 1.5 : 2,
        bgcolor: BRAND.ink,
        color: BRAND.accent,
        display: 'grid',
        placeItems: 'center',
        fontSize: small ? 13 : 15,
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {children}
    </Box>
  );
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <Box component="section" id={id} sx={{ scrollMarginTop: 84, pt: { xs: 5, md: 7 } }}>
      <Typography sx={{ color: BRAND.accentDark, fontWeight: 800, fontSize: 12.5, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
        {eyebrow}
      </Typography>
      <Typography component="h2" sx={{ fontWeight: 800, fontSize: { xs: 26, md: 32 }, letterSpacing: '-0.02em', lineHeight: 1.15, mb: { xs: 2.5, md: 3 } }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Card({ children, accent = false, dark = false }: { children: ReactNode; accent?: boolean; dark?: boolean }) {
  return (
    <Box
      sx={{
        bgcolor: dark ? BRAND.ink : BRAND.paper,
        color: dark ? '#FFFFFF' : 'inherit',
        borderRadius: 4,
        border: `1px solid ${dark ? BRAND.ink : accent ? BRAND.accentEdge : BRAND.line}`,
        boxShadow: accent ? BRAND.shadow : 'none',
        p: { xs: 2.5, sm: 3.5 },
      }}
    >
      {children}
    </Box>
  );
}

function DocumentRow({ doc }: { doc: { title: string; when: string; url: string; note?: string; required?: boolean } }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        p: 1.75,
        borderRadius: 3,
        border: `1px solid ${doc.required ? BRAND.accentEdge : BRAND.line}`,
        bgcolor: doc.required ? BRAND.accentWash : 'transparent',
      }}
    >
      <DescriptionOutlined sx={{ color: doc.required ? BRAND.accentDark : BRAND.muted, mt: 0.25 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 700 }}>{doc.title}</Typography>
          {doc.required && (
            <Chip size="small" label="Povinné" sx={{ bgcolor: BRAND.ink, color: BRAND.accent, height: 20, fontSize: 11 }} />
          )}
        </Box>
        <Typography variant="body2" sx={{ color: BRAND.muted }}>{doc.when}</Typography>
        {doc.note && (
          <Typography variant="body2" sx={{ color: BRAND.accentDark, fontWeight: 600, mt: 0.5 }}>{doc.note}</Typography>
        )}
      </Box>
      <Button
        size="small"
        variant="outlined"
        href={doc.url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        aria-label={`Stáhnout PDF: ${doc.title}`}
      >
        PDF
      </Button>
    </Box>
  );
}

function ContactLine({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Box sx={{ color: BRAND.accentDark, mt: 0.25, '& svg': { fontSize: 20 } }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: BRAND.muted }}>
          {label}
        </Typography>
        {children}
      </Box>
    </Box>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: BRAND.muted }}>
      <CircularProgress size={18} sx={{ color: BRAND.accent }} />
      <Typography variant="body2">{text}</Typography>
    </Box>
  );
}

function Trust({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.5,
        py: 0.65,
        borderRadius: 999,
        border: `1px solid ${BRAND.onInkLine}`,
        bgcolor: BRAND.onInkWash,
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      {icon}
      {label}
    </Box>
  );
}
