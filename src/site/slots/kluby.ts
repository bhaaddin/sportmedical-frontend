import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';

/*
 * Slots of the page /kluby (artboard V-Kluby) — the one page of the club offer. It merges the club block of the
 * live home page, the live page "Mobilní testování" and the club block of the live exams page
 * (captured 2026-10-03); there is no separate /mobilni-testovani page.
 *
 * NO NUMBER IS WRITTEN HERE. The minimum headcount is the clinic's setting (Nastavení › Kluby, public
 * GET /api/public/club-terms): the page shows the card and the sentence "{pocet}" only when the server
 * publishes a minimum, otherwise it says nothing about one. The discount is shown from the published
 * discount tiers, or not at all. The live pages' own numbers (a headcount, group-discount scales, old
 * package prices) are deliberately not copied.
 */

const HERO = 'Pro kluby › Úvod';
const TERMS = 'Pro kluby › Podmínky spolupráce';
const TIERS = 'Pro kluby › Sleva podle počtu osob';
const GAIN = 'Pro kluby › Mobilní testování';
const MOBILE = 'Pro kluby › Mobilní zátěžové testy';
const EXAMS = 'Pro kluby › Typy vyšetření';
const HOW = 'Pro kluby › Jak to proběhne';
const LINK = 'Pro kluby › Mám odkaz od klubu';
const ASK = 'Pro kluby › Nezávazná poptávka';

/** The six statements under "Mobilní testování" on the live home page. */
const BENEFITS = [
  'Testování přímo ve Vašem klubu',
  'Bez nutnosti přesunu sportovců',
  'Špičkové diagnostické technologie přímo u vás',
  'Vysoká kapacita testování během jednoho dne',
  'Zachování maximální přesnosti a kvality testování',
  'Minimální časová zátěž pro rodiče',
] as const;

/** The four examination types of the live page "Mobilní testování" (descriptions as published, no prices). */
const EXAM_TYPES: readonly (readonly [string, string])[] = [
  ['Základní sportovní prohlídka', 'Klidové EKG + základní vyšetření plic. Bez zátěžového testování a bez spiroergometrie. Vhodné zejména pro malé děti.'],
  ['Komplexní sportovní prohlídka', 'Klidové + zátěžové EKG + základní vyšetření plic. Hodnocení reakce srdce na zátěž bez analýzy respiračních plynů. Vhodné pro širokou veřejnost i výkonnostní sportovce.'],
  ['Spiroergometrické vyšetření', 'Nejkomplexnější zátěžové vyšetření. Detailní analýza kardiopulmonární a metabolické odezvy (srdce, plíce, metabolismus), VO₂max, ventilační a metabolické prahy a tréninkové zóny. Vhodné pro vrcholové a náročné sportovce.'],
  ['Komplexní balíčky', 'Sportovně-lékařské vyšetření v kombinaci se sportovní diagnostikou. Hodnocení zdravotního stavu, výkonu, reakce na zátěž, asymetrií a dysbalancí. Dvoufázový proces (diagnostika + vyhodnocení) a cenově výhodné balíčky.'],
];

const STEPS: readonly (readonly [string, string])[] = [
  ['Poptávka', 'Napíšete nám počet sportovců a představu o termínu.'],
  ['Nabídka a termín', 'Pošleme cenovou nabídku a domluvíme den.'],
  ['Jeden odkaz pro tým', 'Dostanete odkaz, který rozešlete sportovcům. Každý si vybere svůj čas sám.'],
  ['Výjezd a výsledky', 'Přijedeme a otestujeme; výsledky dostane každý sportovec zvlášť.'],
];

export const BENEFIT_COUNT = BENEFITS.length;
export const EXAM_TYPE_COUNT = EXAM_TYPES.length;
export const STEP_COUNT = STEPS.length;
export const CLUB_GALLERY_COUNT = 3;

export const klubySlots: SlotDef[] = [
  textSlot('kluby.hero.eyebrow', 'Úvod — nadpis nad titulkem', HERO, 'Mobilní testování'),
  textSlot('kluby.hero.title', 'Úvod — titulek stránky', HERO, 'Nabídka pro sportovní kluby'),
  textSlot(
    'kluby.hero.lead',
    'Úvod — úvodní odstavec',
    HERO,
    'Realizujeme mobilní testování po celé České republice. Sportovně-lékařské prohlídky a diagnostiku provádíme přímo ve Vašem klubu, v prostředí, na které jsou sportovci zvyklí, bez nutnosti cestování.',
    { multiline: true },
  ),
  textSlot('kluby.hero.cta.inquiry', 'Úvod — hlavní tlačítko (vede na kontakt)', HERO, 'Nezávazná poptávka'),
  textSlot('kluby.hero.cta.link', 'Úvod — druhé tlačítko (vede na „Mám odkaz od klubu“)', HERO, 'Mám odkaz od klubu'),
  mediaSlot('kluby.hero.photo', 'Úvod — foto', HERO, 'testování v klubu', '1600 × 1000 px', '16 / 10'),

  textSlot('kluby.terms.title', 'Podmínky spolupráce — titulek sekce', TERMS, 'Podmínky spolupráce'),
  textSlot('kluby.terms.min.title', 'Minimální počet — název (karta se ukáže, jen když je minimum v nastavení)', TERMS, 'Minimální počet sportovců'),
  textSlot('kluby.terms.min.text', 'Minimální počet — věta („{pocet}“ nahradí číslo z nastavení; věta se ukáže, jen když je minimum zadané)', TERMS, 'Podmínkou výjezdu je minimálně {pocet} sportovců.'),
  textSlot('kluby.terms.where.value', 'Po celé ČR — velký údaj', TERMS, 'ČR'),
  textSlot('kluby.terms.where.title', 'Po celé ČR — název', TERMS, 'Po celé republice'),
  textSlot('kluby.terms.where.text', 'Po celé ČR — popis', TERMS, 'Realizujeme mobilní testování po celé České republice'),
  textSlot('kluby.terms.price.fallback', 'Zvýhodněná cena — velký údaj, dokud server žádné slevy nezveřejňuje', TERMS, 'Sleva'),
  textSlot('kluby.terms.price.title', 'Zvýhodněná cena — název', TERMS, 'Zvýhodněná cena'),
  textSlot('kluby.terms.price.text', 'Zvýhodněná cena — popis (před něj se doplní „Od N osob.“, když jsou hladiny známé)', TERMS, 'Zvýhodněná cenová nabídka a individuální podmínky spolupráce'),
  textSlot('kluby.terms.weekend.value', 'Termíny — velký údaj', TERMS, 'Víkend'),
  textSlot('kluby.terms.weekend.title', 'Termíny — název', TERMS, 'Flexibilní termíny'),
  textSlot('kluby.terms.weekend.text', 'Termíny — popis', TERMS, 'Flexibilní termíny podle potřeb klubu - včetně víkendů'),

  textSlot('kluby.tiers.title', 'Sleva podle počtu osob — titulek (zobrazí se jen při zveřejněných hladinách)', TIERS, 'Sleva podle počtu osob'),
  textSlot('kluby.tiers.lead', 'Sleva podle počtu osob — úvod', TIERS, 'Výše slevy závisí na počtu osob. Větší skupiny = výhodnější cena za osobu.', { multiline: true }),
  textSlot('kluby.tiers.from', 'Sleva podle počtu osob — předložka před počtem („od 10 osob“)', TIERS, 'od'),
  textSlot('kluby.tiers.persons', 'Sleva podle počtu osob — slovo za počtem', TIERS, 'osob'),

  textSlot('kluby.gain.title', 'Mobilní testování — titulek sekce', GAIN, 'Mobilní testování'),
  ...BENEFITS.map((text, index) => textSlot(`kluby.gain.${index + 1}`, `Přínos ${index + 1}`, GAIN, text)),

  textSlot('kluby.mobile.title', 'Mobilní zátěžové testy — titulek sekce', MOBILE, 'Mobilní zátěžové testy pro sportovní kluby'),
  textSlot('kluby.mobile.badge', 'Mobilní zátěžové testy — štítek', MOBILE, 'Nabídka pouze pro kluby'),
  textSlot(
    'kluby.mobile.text',
    'Mobilní zátěžové testy — text',
    MOBILE,
    `Nabízíme možnost realizace sportovně-lékařských prohlídek přímo ve Vašem klubu. Díky mobilnímu diagnostickému vybavení provádíme vyšetření přímo v klubovém prostředí, na které jsou sportovci zvyklí, bez nutnosti cestování.

Tento model šetří čas klubu, sportovcům i rodičům, kteří tak nemusí přizpůsobovat svůj pracovní program, celkovou organizaci ani řešit nedostatek volných termínů u sportovního lékaře ve Vašem okolí.

Vyšetření jsme schopni zajistit i v rámci Středočeského kraje.`,
    { multiline: true },
  ),

  textSlot('kluby.exams.title', 'Typy vyšetření — titulek sekce', EXAMS, 'Typy vyšetření'),
  textSlot(
    'kluby.exams.lead',
    'Typy vyšetření — úvod',
    EXAMS,
    'Provádíme sportovně-lékařská vyšetření zaměřená na posouzení zdravotního stavu, s důrazem na funkci kardiopulmonárního aparátu, toleranci fyzické zátěže a bezpečnost sportovní činnosti. Vyšetření probíhají pod odborným dohledem specializovaných lékařů a s využitím nejmodernějších diagnostických přístrojů. Výstupem je odborný lékařský posudek.',
    { multiline: true },
  ),
  ...EXAM_TYPES.flatMap(([title, text], index): SlotDef[] => [
    textSlot(`kluby.exams.${index + 1}.title`, `Typ vyšetření ${index + 1} — název`, EXAMS, title),
    textSlot(`kluby.exams.${index + 1}.text`, `Typ vyšetření ${index + 1} — popis`, EXAMS, text, { multiline: true }),
  ]),
  textSlot('kluby.exams.prices', 'Typy vyšetření — odkaz na ceník', EXAMS, 'Ceník vyšetření'),

  textSlot('kluby.how.title', 'Jak to funguje — titulek sekce', HOW, 'Jak to funguje'),
  textSlot('kluby.how.lead', 'Jak to funguje — úvod', HOW, 'Od poptávky k výsledkům: termín a rozsah si domluvíme podle potřeb klubu.', { multiline: true }),
  ...STEPS.flatMap(([title, text], index): SlotDef[] => [
    textSlot(`kluby.how.${index + 1}.title`, `Krok ${index + 1} — název`, HOW, title),
    textSlot(`kluby.how.${index + 1}.text`, `Krok ${index + 1} — popis`, HOW, text),
  ]),
  mediaSlot('kluby.how.photo1', 'Z výjezdů — fotka 1 (příjezd)', HOW, 'galerie z výjezdů — příjezd', '1200 × 900 px', '4 / 3'),
  mediaSlot('kluby.how.photo2', 'Z výjezdů — fotka 2 (testování)', HOW, 'galerie z výjezdů — testování v tělocvičně', '1200 × 900 px', '4 / 3'),
  mediaSlot('kluby.how.photo3', 'Z výjezdů — fotka 3 (vyhodnocení)', HOW, 'galerie z výjezdů — vyhodnocení s trenérem', '1200 × 900 px', '4 / 3'),

  textSlot('kluby.link.eyebrow', 'Mám odkaz — nadpis nad titulkem', LINK, 'Pro sportovce klubu'),
  textSlot('kluby.link.title', 'Mám odkaz — titulek', LINK, 'Mám odkaz od klubu'),
  textSlot(
    'kluby.link.text',
    'Mám odkaz — vysvětlení',
    LINK,
    'Váš klub objednal testování pro celý tým a poslal vám odkaz. Vložte ho sem, otevře se registrace a vybere si v ní termín a vyplníte, co je potřeba.',
    { multiline: true },
  ),
  textSlot('kluby.link.label', 'Mám odkaz — popisek pole', LINK, 'Odkaz od klubu'),
  textSlot('kluby.link.hint', 'Mám odkaz — nápověda pod polem', LINK, 'Stačí zkopírovat celý odkaz ze zprávy od klubu, nebo jen jeho poslední část za „/klub/“.'),
  textSlot('kluby.link.placeholder', 'Mám odkaz — text v prázdném poli', LINK, 'Vložte odkaz nebo kód od klubu'),
  textSlot('kluby.link.button', 'Mám odkaz — tlačítko', LINK, 'Pokračovat k registraci'),
  textSlot('kluby.link.error', 'Mám odkaz — hláška, když odkaz nedává smysl', LINK, 'Tomuhle odkazu nerozumíme. Zkopírujte ho celý ze zprávy od klubu, nebo se zeptejte trenéra.', { multiline: true }),

  textSlot('kluby.ask.title', 'Poptávka — titulek', ASK, 'Nezávazná poptávka'),
  textSlot('kluby.ask.text', 'Poptávka — text', ASK, 'Napište nám počet sportovců a přibližný termín. Zvýhodněná cenová nabídka a individuální podmínky spolupráce.', { multiline: true }),
  textSlot('kluby.ask.cta.contact', 'Poptávka — hlavní tlačítko (vede na kontakt)', ASK, 'Poslat poptávku'),
];
