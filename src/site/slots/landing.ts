import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';

/*
 * Úvodní stránka (/). The wording is the live home page of https://sportmedical-diagnostics.cz (captured
 * 2026-10-03, docs/etapa3/live-site/pages/home.md): the four slogans, the three service areas, the three
 * booking cards, the club offer with its mobile-testing statements, the partner statements. The
 * [FOTO: …] captions are the artboard V-Web2's. Where the live home page has no sentence (the service
 * descriptions, the equipment) the wording is taken from the clinic's other live pages (FAQ, o-nas).
 * Numbers that could change (prices, the club discount, the minimum headcount) are NOT here: they come from
 * the price list, the discount tiers and the club terms. The live "rating" line is not on the home page and
 * is not shown.
 */

const HERO = 'Úvodní stránka › Hero';
const ADV = 'Úvodní stránka › Čtyři výhody';
const SERV = 'Úvodní stránka › Služby';
const BOOK = 'Úvodní stránka › Online rezervace';
const EQ = 'Úvodní stránka › Vybavení';
const STEPS = 'Úvodní stránka › Jak to probíhá';
const CLUB = 'Úvodní stránka › Pro kluby';
const OTHER = 'Úvodní stránka › Partneři a filozofie';

const heroPhoto = (n: 1 | 2 | 3, caption: string): SlotDef =>
  mediaSlot(`landing.hero.photo${n}`, `Hero — fotka ${n} z 3`, HERO, caption, '1600 × 1200 px', '4 / 3');

export const landingSlots: SlotDef[] = [
  /* ── Hero ── */
  textSlot('landing.hero.eyebrow', 'Hero — nadpis nad titulkem', HERO, 'Klinika sportovní medicíny · Praha 4'),
  textSlot('landing.hero.headline', 'Hero — hlavní titulek (poslední řádek je oranžový)', HERO, 'Sportovní lékařské\nprohlídky\na diagnostika', { multiline: true }),
  textSlot(
    'landing.hero.lead',
    'Hero — úvodní odstavec',
    HERO,
    'Klinika sportovní medicíny a diagnostiky. Prohlídky, sportovní diagnostika a InBody 770 pro profesionální i rekreační sportovce, trenéry i širokou veřejnost.',
    { multiline: true },
  ),
  textSlot('landing.hero.cta.primary', 'Hero — hlavní tlačítko', HERO, 'Objednat termín'),
  textSlot('landing.hero.cta.secondary', 'Hero — druhé tlačítko (za ním se doplní „od <nejnižší cena>“)', HERO, 'Ceník'),
  heroPhoto(1, 'spiroergometrie na ergometru'),
  heroPhoto(2, 'měření na InBody 770'),
  heroPhoto(3, 'testování v klubu'),

  /* ── Four slogans of the live hero (each split into a title and a continuation) ── */
  textSlot('landing.adv.1.title', 'Heslo 1 — první část', ADV, 'Komplexní zdravotní péče'),
  textSlot('landing.adv.1.text', 'Heslo 1 — pokračování', ADV, 'prevence a rehabilitace'),
  textSlot('landing.adv.2.title', 'Heslo 2 — první část', ADV, 'Odborný lékařský tým'),
  textSlot('landing.adv.2.text', 'Heslo 2 — pokračování', ADV, 'a nejmodernější vybavení'),
  textSlot('landing.adv.3.title', 'Heslo 3 — první část', ADV, 'Pohodlná online rezervace'),
  textSlot('landing.adv.3.text', 'Heslo 3 — pokračování', ADV, 'a rychlé termíny'),
  textSlot('landing.adv.4.title', 'Heslo 4 — první část', ADV, 'Sportovní a diagnostické prohlídky'),
  textSlot('landing.adv.4.text', 'Heslo 4 — pokračování', ADV, 'Možnost realizace přímo v klubu'),

  /* ── Services ── */
  textSlot('landing.services.eyebrow', 'Služby — nadpis nad titulkem', SERV, 'Služby'),
  textSlot('landing.services.title', 'Služby — titulek sekce', SERV, 'Tři okruhy,\njedna klinika', { multiline: true }),
  textSlot('landing.services.allprices', 'Služby — tlačítko na celý ceník', SERV, 'Celý ceník'),

  textSlot('landing.service1.title', 'Služba 01 — název', SERV, 'Sportovní lékařské prohlídky'),
  textSlot(
    'landing.service1.text',
    'Služba 01 — popis',
    SERV,
    'Sportovně-lékařská vyšetření zaměřená na posouzení zdravotního stavu, s důrazem na funkci kardiopulmonárního aparátu, toleranci fyzické zátěže a bezpečnost sportovní činnosti. Výstupem je odborný lékařský posudek.',
    { multiline: true },
  ),
  textSlot('landing.service1.link', 'Služba 01 — odkaz', SERV, 'Detailní informace'),
  mediaSlot('landing.service1.photo', 'Služba 01 — foto', SERV, 'lékař při prohlídce', '1200 × 1500 px', '4 / 5'),

  textSlot('landing.service2.title', 'Služba 02 — název', SERV, 'Sportovní diagnostika'),
  textSlot(
    'landing.service2.text',
    'Služba 02 — popis',
    SERV,
    'Detailní analýza pohybového systému zaměřená na identifikaci svalových disbalancí, rozsahových omezení, asymetrií a kompenzačních mechanismů. Sleduje „jak" tělo výkon vytváří, nikoli pouze výsledek.',
    { multiline: true },
  ),
  textSlot('landing.service2.link', 'Služba 02 — odkaz', SERV, 'Detailní informace'),
  mediaSlot('landing.service2.photo', 'Služba 02 — foto', SERV, 'ForceDecks — výskok na silových deskách', '1200 × 1500 px', '4 / 5'),

  textSlot('landing.service3.title', 'Služba 03 — název', SERV, 'InBody 770'),
  textSlot(
    'landing.service3.text',
    'Služba 03 — popis',
    SERV,
    'Zařízení lékařské třídy pro komplexní analýzu tělesného složení a stavu tekutin. Měření trvá přibližně 60 sekund, je neinvazivní a bez nepohodlí.',
    { multiline: true },
  ),
  textSlot('landing.service3.link', 'Služba 03 — odkaz', SERV, 'Detailní informace'),
  mediaSlot('landing.service3.photo', 'Služba 03 — foto', SERV, 'analyzátor InBody 770', '1200 × 1500 px', '4 / 5'),

  /* ── Booking cards ── */
  textSlot('landing.booking.eyebrow', 'Rezervace — nadpis nad titulkem', BOOK, 'Pohodlná online rezervace'),
  textSlot('landing.booking.title', 'Rezervace — titulek sekce', BOOK, 'Rychlé termíny'),
  textSlot('landing.booking.card1', 'Rezervace — karta 1', BOOK, 'Sportovní prohlídky'),
  textSlot('landing.booking.card2', 'Rezervace — karta 2', BOOK, 'Sportovní diagnostika'),
  textSlot('landing.booking.card3', 'Rezervace — karta 3', BOOK, 'Výživové poradenství'),
  textSlot('landing.booking.cta', 'Rezervace — tlačítko na kartě', BOOK, 'Objednat termín'),

  /* ── Equipment (the wording of the live FAQ) ── */
  textSlot('landing.equipment.eyebrow', 'Vybavení — nadpis nad titulkem', EQ, 'Vybavení'),
  textSlot('landing.equipment.title', 'Vybavení — titulek', EQ, 'Na čem měříme'),
  textSlot('landing.equipment.1.name', 'Přístroj 1 — název', EQ, 'InBody 770'),
  textSlot('landing.equipment.1.text', 'Přístroj 1 — popis', EQ, 'Lékařsky certifikované měření složení těla s analýzou svalů, tuku, vody a buněčné vitality pro každý segment těla.'),
  textSlot('landing.equipment.2.name', 'Přístroj 2 — název', EQ, 'ForceDecks'),
  textSlot('landing.equipment.2.text', 'Přístroj 2 — popis', EQ, 'Systém silových desek měřící sílu, výbušnost, reakční schopnosti a asymetrie. Analyzuje odrazovou a dopadovou sílu.'),
  textSlot('landing.equipment.3.name', 'Přístroj 3 — název', EQ, 'HumanTrak'),
  textSlot('landing.equipment.3.text', 'Přístroj 3 — popis', EQ, '3D optická analýza pohybu s přesností na milimetry. Zachycuje držení těla, rozsahy pohybu, svalové disbalance a kompenzační mechanismy.'),
  textSlot('landing.equipment.4.name', 'Přístroj 4 — název', EQ, 'Cortex 21'),
  textSlot('landing.equipment.4.text', 'Přístroj 4 — popis', EQ, 'Mobilní VO₂max analýza měřící spotřebu kyslíku, výdej oxidu uhličitého a ventilační parametry přímo při výkonu.'),

  /* ── How it works ── */
  textSlot('landing.steps.eyebrow', 'Jak to probíhá — nadpis nad titulkem', STEPS, 'Jak to probíhá'),
  textSlot('landing.steps.title', 'Jak to probíhá — titulek', STEPS, 'Od objednání\nk výsledkům', { multiline: true }),
  textSlot('landing.steps.lead', 'Jak to probíhá — úvod', STEPS, 'Pohodlná online rezervace a rychlé termíny. Dokumenty si připravíte předem z pohodlí domova.', { multiline: true }),
  textSlot('landing.steps.1.title', 'Krok 1 — titulek', STEPS, 'Vyberete termín'),
  textSlot('landing.steps.1.text', 'Krok 1 — popis', STEPS, 'Služby vyšetřujeme výhradně na základě předchozí objednávky na konkrétní termín.'),
  textSlot('landing.steps.2.title', 'Krok 2 — titulek', STEPS, 'Připravíte dokumenty'),
  textSlot('landing.steps.2.text', 'Krok 2 — popis', STEPS, 'Zdravotní dotazník a souhlasy vyplňte předem z pohodlí domova, výpis vystaví praktický lékař.'),
  textSlot('landing.steps.3.title', 'Krok 3 — titulek', STEPS, 'Přijdete na vyšetření'),
  textSlot('landing.steps.3.text', 'Krok 3 — popis', STEPS, 'Dostavte se ideálně 10–15 minut před začátkem. Budova GreenLine, 5. patro, Jihlavská 1558/21, Praha 4.'),
  textSlot('landing.steps.4.title', 'Krok 4 — titulek', STEPS, 'Výsledky a doporučení'),
  textSlot('landing.steps.4.text', 'Krok 4 — popis', STEPS, 'Každý klient obdrží výstupní dokumentaci s tabulkami, grafy, interpretací a doporučeními.'),

  /* ── Club offer (the statements of the live home page) ── */
  textSlot('landing.club.eyebrow', 'Pro kluby — nadpis nad titulkem', CLUB, 'Pro sportovní kluby'),
  textSlot('landing.club.title', 'Pro kluby — titulek', CLUB, 'Nabídka pro\nsportovní kluby', { multiline: true }),
  textSlot(
    'landing.club.text',
    'Pro kluby — odstavec',
    CLUB,
    'Realizujeme mobilní testování po celé České republice. Zvýhodněná cenová nabídka a individuální podmínky spolupráce. Flexibilní termíny podle potřeb klubu - včetně víkendů.',
    { multiline: true },
  ),
  textSlot('landing.club.stat1.label', 'Pro kluby — popis čísla 1 (číslo = minimum sportovců z nastavení; bez minima se nezobrazí nic)', CLUB, 'sportovců minimálně'),
  textSlot('landing.club.stat3.value', 'Pro kluby — údaj 3', CLUB, 'ČR'),
  textSlot('landing.club.stat3.label', 'Pro kluby — popis údaje 3', CLUB, 'po celé České republice'),
  textSlot('landing.club.cta.inquiry', 'Pro kluby — hlavní tlačítko (vede na stránku Kluby)', CLUB, 'Bližší informace o službě'),
  textSlot('landing.club.cta.link', 'Pro kluby — tlačítko „Mám odkaz od klubu“', CLUB, 'Mám odkaz od klubu'),
  textSlot('landing.club.mobile', 'Pro kluby — nadpis seznamu mobilního testování (seznam je ze stránky Kluby)', CLUB, 'Mobilní testování'),
  mediaSlot('landing.club.photo', 'Pro kluby — foto', CLUB, 'testování v tělocvičně klubu', '1400 × 1200 px', '7 / 6'),

  /* ── Partners and philosophy ── */
  textSlot('landing.partners.eyebrow', 'Partneři — nadpis pásu', OTHER, 'Pomáháme klubům zlepšovat péči o sportovce'),
  textSlot('landing.partners.title', 'Partneři — titulek', OTHER, 'Staňte se i Vy našimi spokojenými partnery'),
  textSlot('landing.partners.1', 'Partneři — řádek 1', OTHER, 'Zajistíme kompletní zdravotní servis pro Vaše sportovce'),
  textSlot('landing.partners.2', 'Partneři — řádek 2', OTHER, 'Dlouhodobá spolupráce na kterou se můžete spolehnout'),
  textSlot('landing.partners.cta', 'Partneři — odkaz na stránku Partneři', OTHER, 'Všichni partneři'),
  textSlot('landing.philosophy.eyebrow', 'Filozofie — nadpis nad citátem', OTHER, 'Naše filozofie'),
  textSlot(
    'landing.philosophy.quote',
    'Filozofie — citát',
    OTHER,
    'Naším cílem je poskytovat služby na nejvyšší možné úrovni – odborně, individuálně a s maximální precizností.',
    { multiline: true },
  ),
  textSlot('landing.philosophy.link', 'Filozofie — odkaz', OTHER, 'Více o nás'),
];
