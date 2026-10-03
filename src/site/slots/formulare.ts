import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* ══════════════════════════════════════════════════════════════
   TEXTS OF THE PATIENT-FACING FORMS

   Everything a patient reads on /objednat, the completion link, the club link and
   the portal that is the clinic's to word: consent wording, the GDPR notice, helper
   sentences that state a rule of the clinic, the "nothing is open" messages.

   The wording below is what the forms showed before it became editable, so nothing
   changes until the admin writes something else in "Média a texty".

   LEGAL CONSENTS: the clinic may re-word them here, but the REQUIREMENT (the consent to
   the examination cannot be skipped; the marketing consent is never required) stays in
   code. Placeholders in {braces} are filled in by the form; a text without them is fine.
   ══════════════════════════════════════════════════════════════ */

const STATUTORY = 'Formuláře › Souhlasy a GDPR';
const CONSENTS = 'Formuláře › Souhlasy (jednotlivé)';
const FINISH = 'Formuláře › Dokončení registrace';
const BOOKING = 'Formuláře › Online objednání';
const LINKS = 'Formuláře › Odkazy a klubová registrace';
const PORTAL = 'Formuláře › Portál pacienta';

export const formulareSlots: SlotDef[] = [
  /* ── The notice about what the law already covers ── */
  textSlot('formulare.consent.statutory.heading', 'Poučení — nadpis rámečku', STATUTORY,
    'CO DĚLÁME ZE ZÁKONA — NEPTÁME SE NA TO'),
  textSlot('formulare.consent.statutory.text', 'Poučení — co ordinace dělá ze zákona (doba archivace, právní základ)', STATUTORY,
    'Vedeme zdravotnickou dokumentaci, vyhodnocujeme výsledky a archivujeme je 10 let od poslední služby. Vyplývá to ze zákona č. 372/2011 Sb. a z nařízení GDPR, čl. 9(2)(h) — nejde o volbu, kterou bychom vám mohli nabídnout.',
    { multiline: true }),
  textSlot('formulare.consent.rights.text', 'Poučení — práva pacienta a odvolání souhlasu (místo {email} se doplní e-mail ordinace)', STATUTORY,
    'Máte právo na přístup, opravu i výmaz svých údajů a na stížnost u ÚOOÚ. Souhlasy níže můžete kdykoli odvolat na {email}.',
    { multiline: true }),

  /* ── The individual consents. {activity} = činnost, {service} = služba ── */
  textSlot('formulare.consent.treatment.title.activity', 'Provedení výkonu — název (po výběru termínu; {activity})', CONSENTS,
    'Provedení: {activity}'),
  textSlot('formulare.consent.treatment.title.generic', 'Provedení výkonu — název (bez vybraného termínu)', CONSENTS,
    'Poskytnutí zdravotní služby'),
  textSlot('formulare.consent.treatment.detail.activity', 'Provedení výkonu — znění souhlasu (po výběru termínu; {activity}, {service})', CONSENTS,
    'Souhlasím s provedením činnosti {activity} ({service}) a se zpracováním údajů o zdravotním stavu, které si vyžádá.',
    { multiline: true }),
  textSlot('formulare.consent.treatment.detail.generic', 'Provedení výkonu — znění souhlasu (bez vybraného termínu)', CONSENTS,
    'Souhlasím s poskytnutím zdravotní služby, kterou si objednám, a se zpracováním údajů o zdravotním stavu, které si vyžádá.',
    { multiline: true }),
  textSlot('formulare.consent.treatment.error', 'Provedení výkonu — hláška, když není zaškrtnuto', CONSENTS,
    'Bez souhlasu s poskytnutím zdravotních služeb nelze dotazník odeslat.'),

  textSlot('formulare.consent.report.title', 'Zpráva e-mailem — název', CONSENTS, 'Lékařská zpráva e-mailem'),
  textSlot('formulare.consent.report.detail.required', 'Zpráva e-mailem — znění, když ji činnost vyžaduje ({activity})', CONSENTS,
    'Zprávu z činnosti {activity} předáváme elektronicky na uvedený e-mail. Bez tohoto souhlasu ji nelze objednat.',
    { multiline: true }),
  textSlot('formulare.consent.report.detail.optional', 'Zpráva e-mailem — znění, když je dobrovolná', CONSENTS,
    'Souhlasím, aby mi byla lékařská zpráva zaslána elektronicky na uvedený e-mail. Bez souhlasu si ji vyzvednete na recepci.',
    { multiline: true }),
  textSlot('formulare.consent.report.error', 'Zpráva e-mailem — hláška, když chybí povinný souhlas', CONSENTS,
    'U této činnosti posíláme lékařskou zprávu e-mailem, bez tohoto souhlasu ji nelze objednat.'),

  textSlot('formulare.consent.club.title', 'Sdílení s klubem — název', CONSENTS, 'Sdílení výsledků s klubem'),
  textSlot('formulare.consent.club.detail.required', 'Sdílení s klubem — znění, když ho činnost vyžaduje ({activity})', CONSENTS,
    'Činnost {activity} objednáváme se sdílením výsledků s vaším klubem. Bez tohoto souhlasu ji nelze objednat.',
    { multiline: true }),
  textSlot('formulare.consent.club.detail.optional', 'Sdílení s klubem — znění, když je dobrovolné', CONSENTS,
    'Souhlasím se sdílením výsledků s mým sportovním klubem. Jde o předání údajů někomu mimo ordinaci, takže bez vašeho souhlasu je nesdílíme.',
    { multiline: true }),
  textSlot('formulare.consent.club.error', 'Sdílení s klubem — hláška, když chybí povinný souhlas', CONSENTS,
    'Tuto činnost objednáváme se sdílením výsledků s klubem, bez tohoto souhlasu ji nelze objednat.'),

  textSlot('formulare.form.questionnaire.error', 'Povinný dotazník — hláška', CONSENTS,
    'U této činnosti je zdravotní dotazník povinný. Vyplňte ho prosím.'),
  textSlot('formulare.form.privacy-line', 'Řádek u tlačítka Odeslat registraci', CONSENTS,
    'Údaje putují šifrovaně a vidí je jen naše ordinace.'),

  /* ── After the form is sent ── */
  textSlot('formulare.finish.review.email', 'Odesláno — údaje ověří recepce, potvrzení e-mailem přijde', FINISH,
    'Vaše údaje ověří naše recepce, abychom vás nezaložili dvakrát. Ozveme se vám na uvedený e-mail.',
    { multiline: true }),
  textSlot('formulare.finish.review.no-email', 'Odesláno — údaje ověří recepce, e-mail nepřijde', FINISH,
    'Vaše údaje ověří naše recepce, abychom vás nezaložili dvakrát, a pak se vám ozveme. Poznamenejte si prosím číslo žádosti.',
    { multiline: true }),
  textSlot('formulare.finish.saved.email', 'Odesláno — uloženo, potvrzení e-mailem přijde', FINISH,
    'Vaše údaje máme uložené a potvrzení jsme vám poslali e-mailem.',
    { multiline: true }),
  textSlot('formulare.finish.saved.no-email', 'Odesláno — uloženo, e-mail nepřijde', FINISH,
    'Vaše údaje máme uložené. Potvrzení máte na této obrazovce — poznamenejte si prosím číslo žádosti.',
    { multiline: true }),
  textSlot('formulare.finish.documents.intro', 'Dokumenty k návštěvě — úvodní věta', FINISH,
    'Tyto dokumenty ordinace pro vaši činnost vyžaduje.'),

  /* ── Online booking ── */
  textSlot('formulare.booking.call-us', 'Věta před telefonním číslem ordinace (doplní se číslo)', BOOKING,
    'Zavolejte nám prosím na'),
  textSlot('formulare.booking.closed.title', 'Objednávání je vypnuté — nadpis', BOOKING,
    'Online objednávání právě není otevřené'),
  textSlot('formulare.booking.closed.with-phone', 'Objednávání je vypnuté — věta s telefonem ({phone})', BOOKING,
    'Termín vám rádi domluvíme telefonicky na {phone}.'),
  textSlot('formulare.booking.closed.no-phone', 'Objednávání je vypnuté — věta bez telefonu', BOOKING,
    'Zkuste to prosím později.'),
  textSlot('formulare.booking.pick-time', 'Pod cenou — nápověda před výběrem času', BOOKING,
    'Vyberte čas v kalendáři. Dotazník a souhlasy vyplníte hned v dalším kroku.',
    { multiline: true }),
  textSlot('formulare.booking.no-slots', 'Žádný volný termín (za větou se doplní telefon; {days} = počet dnů, které se prohledávají)', BOOKING,
    'V nejbližších {days} dnech nemáme volno'),

  /* ── Expired / used links, club link ── */
  textSlot('formulare.link.expired', 'Odkaz vypršel — vysvětlení', LINKS,
    'Tento odkaz už vypršel. Rezervace byla zrušena, zavolejte nám prosím nebo si vyberte nový termín.',
    { multiline: true }),
  textSlot('formulare.link.invalid', 'Odkaz neplatí nebo byl použit — vysvětlení', LINKS,
    'Tento odkaz už není platný nebo byl použit. Zavolejte nám prosím nebo si vyberte nový termín.',
    { multiline: true }),
  textSlot('formulare.club.closed', 'Klubový odkaz — vypršel', LINKS,
    'Tento odkaz už nepřijímá registrace. Ozvěte se prosím svému klubu.'),
  textSlot('formulare.club.full', 'Klubový odkaz — všechna místa obsazená', LINKS,
    'Všechna místa jsou obsazená. Ozvěte se prosím svému klubu.'),
  textSlot('formulare.feedback.sub', 'Hodnocení návštěvy — podtitulek', LINKS,
    'Zabere to půl minuty. Hodnocení je soukromé — čte ho jen ordinace.'),

  /* ── Portal ── */
  textSlot('formulare.portal.signin.sub', 'Přihlášení do portálu — podtitulek', PORTAL,
    'Vaše termíny, výsledky a dokumenty na jednom místě.'),
  textSlot('formulare.portal.signin.no-password', 'Přihlášení — nemáte heslo', PORTAL,
    'Nemáte heslo? Přístup vám vydá ordinace — nebo si ho nastavte z odkazu, který jste dostali.',
    { multiline: true }),
  textSlot('formulare.portal.signin.forgot', 'Přihlášení — zapomenuté heslo', PORTAL,
    'Zapomněli jste heslo? Ozvěte se ordinaci — heslo vám smaže a pošle nový odkaz.',
    { multiline: true }),
  textSlot('formulare.portal.help', 'Portál — „Potřebujete pomoc?“ (věta nad kontakty)', PORTAL,
    'Co tu nejde vyřídit — jiný termín, dotaz k vyšetření — domluvíte přímo s ordinací.',
    { multiline: true }),
];
