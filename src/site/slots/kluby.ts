import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';

/*
 * Slots of the page /web/kluby (artboard V-Kluby). The discount is never written here: it is shown
 * from the published discount tiers, or not at all. The minimum headcount ("30+") is an editable
 * text — it is the clinic's own condition and may change.
 * Defaults are the clinic's website (checked 2026-10-03) and the artboard.
 */

const HERO = 'Pro kluby › Úvod';
const TERMS = 'Pro kluby › Podmínky výjezdu';
const TIERS = 'Pro kluby › Sleva podle počtu osob';
const GAIN = 'Pro kluby › Co z toho klub má';
const HOW = 'Pro kluby › Jak to proběhne';
const LINK = 'Pro kluby › Mám odkaz od klubu';
const ASK = 'Pro kluby › Nezávazná poptávka';

const BENEFITS = [
  'Testování přímo ve vašem klubu, bez přesunu sportovců',
  'Vysoká kapacita během jednoho dne',
  'Špičkové diagnostické technologie u vás na místě',
  'Zachování přesnosti a kvality jako na klinice',
  'Minimální časová zátěž pro rodiče',
  'Kompletní zdravotní servis pro celý tým',
] as const;

const STEPS: readonly (readonly [string, string])[] = [
  ['Poptávka', 'Napíšete nám počet sportovců a představu o termínu.'],
  ['Nabídka a termín', 'Pošleme cenu podle počtu osob a domluvíme den.'],
  ['Jeden odkaz pro tým', 'Dostanete odkaz, který rozešlete sportovcům. Každý si vybere svůj čas sám.'],
  ['Výjezd a výsledky', 'Přijedeme, otestujeme, výsledky má každý sportovec ve svém portálu.'],
];

export const BENEFIT_COUNT = BENEFITS.length;
export const STEP_COUNT = STEPS.length;
export const CLUB_GALLERY_COUNT = 3;

export const klubySlots: SlotDef[] = [
  textSlot('kluby.hero.eyebrow', 'Úvod — nadpis nad titulkem', HERO, 'Mobilní testování'),
  textSlot('kluby.hero.title', 'Úvod — titulek stránky', HERO, 'Přijedeme za vámi do klubu'),
  textSlot(
    'kluby.hero.lead',
    'Úvod — úvodní odstavec',
    HERO,
    'Realizujeme mobilní testování po celé České republice. Sportovci se nikam nepřesouvají, rodiče neztrácejí čas a vy dostanete výsledky za celý tým.',
    { multiline: true },
  ),
  textSlot('kluby.hero.cta.inquiry', 'Úvod — hlavní tlačítko (vede na kontakt)', HERO, 'Nezávazná poptávka'),
  textSlot('kluby.hero.cta.link', 'Úvod — druhé tlačítko (vede na „Mám odkaz od klubu“)', HERO, 'Mám odkaz od klubu'),
  mediaSlot('kluby.hero.photo', 'Úvod — foto', HERO, 'testování v klubu', '1600 × 1000 px', '16 / 10'),

  textSlot('kluby.terms.title', 'Podmínky výjezdu — titulek sekce', TERMS, 'Podmínky výjezdu'),
  textSlot('kluby.terms.min.value', 'Minimální počet — velké číslo', TERMS, '30+'),
  textSlot('kluby.terms.min.title', 'Minimální počet — název', TERMS, 'Minimální počet'),
  textSlot('kluby.terms.min.text', 'Minimální počet — popis', TERMS, 'Podmínkou výjezdu je minimální počet sportovců.'),
  textSlot('kluby.terms.where.value', 'Kamkoliv — velký údaj', TERMS, 'ČR'),
  textSlot('kluby.terms.where.title', 'Kamkoliv — název', TERMS, 'Kamkoliv'),
  textSlot('kluby.terms.where.text', 'Kamkoliv — popis', TERMS, 'Vyjíždíme po celé České republice.'),
  textSlot('kluby.terms.price.fallback', 'Zvýhodněná cena — velký údaj, dokud server žádné slevy nezveřejňuje', TERMS, 'Sleva'),
  textSlot('kluby.terms.price.title', 'Zvýhodněná cena — název', TERMS, 'Zvýhodněná cena'),
  textSlot('kluby.terms.price.text', 'Zvýhodněná cena — popis (před něj se doplní „Od N osob.“, když jsou hladiny známé)', TERMS, 'Zvýhodněná cenová nabídka podle velikosti skupiny, kluby mají navíc individuální podmínky.'),
  textSlot('kluby.terms.weekend.value', 'I o víkendu — velký údaj', TERMS, 'So'),
  textSlot('kluby.terms.weekend.title', 'I o víkendu — název', TERMS, 'I o víkendu'),
  textSlot('kluby.terms.weekend.text', 'I o víkendu — popis', TERMS, 'Termíny podle potřeb klubu, včetně víkendů.'),

  textSlot('kluby.tiers.title', 'Sleva podle počtu osob — titulek (zobrazí se jen při zveřejněných hladinách)', TIERS, 'Sleva podle počtu osob'),
  textSlot('kluby.tiers.lead', 'Sleva podle počtu osob — úvod', TIERS, 'Čím větší skupina, tím nižší cena za osobu. Přesnou cenu spočítáme v nabídce.', { multiline: true }),
  textSlot('kluby.tiers.from', 'Sleva podle počtu osob — předložka před počtem („od 10 osob“)', TIERS, 'od'),
  textSlot('kluby.tiers.persons', 'Sleva podle počtu osob — slovo za počtem', TIERS, 'osob'),

  textSlot('kluby.gain.title', 'Co z toho klub má — titulek sekce', GAIN, 'Co z toho klub má'),
  ...BENEFITS.map((text, index) => textSlot(`kluby.gain.${index + 1}`, `Přínos ${index + 1}`, GAIN, text)),

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
  textSlot('kluby.ask.text', 'Poptávka — text', ASK, 'Napište nám počet sportovců a přibližný termín. Ozveme se do jednoho pracovního dne s cenou.', { multiline: true }),
  textSlot('kluby.ask.cta.contact', 'Poptávka — hlavní tlačítko (vede na kontakt)', ASK, 'Poslat poptávku'),
];
