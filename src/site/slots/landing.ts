import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';

/*
 * Úvodní stránka (/web). Defaults are the texts and the [FOTO: …] captions of the
 * artboard V-Web2. Numbers that could change (prices, the club discount) are NOT here:
 * they come from the price list and from the discount tiers.
 */

const HERO = 'Úvodní stránka › Hero';
const ADV = 'Úvodní stránka › Čtyři výhody';
const SERV = 'Úvodní stránka › Služby';
const EQ = 'Úvodní stránka › Vybavení';
const STEPS = 'Úvodní stránka › Jak to probíhá';
const CLUB = 'Úvodní stránka › Pro kluby';
const OTHER = 'Úvodní stránka › Partneři a filozofie';

const heroPhoto = (n: 1 | 2 | 3, caption: string): SlotDef =>
  mediaSlot(`landing.hero.photo${n}`, `Hero — fotka ${n} z 3`, HERO, caption, '1600 × 1200 px', '4 / 3');

export const landingSlots: SlotDef[] = [
  /* ── Hero ── */
  textSlot('landing.hero.eyebrow', 'Hero — nadpis nad titulkem', HERO, 'Klinika sportovní medicíny · Praha 4'),
  textSlot('landing.hero.headline', 'Hero — hlavní titulek (poslední řádek je oranžový)', HERO, 'Výkon,\nkterý se dá\nzměřit', { multiline: true }),
  textSlot(
    'landing.hero.lead',
    'Hero — úvodní odstavec',
    HERO,
    'Sportovní lékařské prohlídky, zátěžová diagnostika a analýza složení těla. Špičkoví lékaři, přístroje InBody 770, ForceDecks a HumanTrak — a termín, který si vyberete online za dvě minuty.',
    { multiline: true },
  ),
  textSlot('landing.hero.cta.primary', 'Hero — hlavní tlačítko', HERO, 'Objednat termín'),
  textSlot('landing.hero.cta.secondary', 'Hero — druhé tlačítko (za ním se doplní „od <nejnižší cena>“)', HERO, 'Ceník'),
  heroPhoto(1, 'spiroergometrie na ergometru'),
  heroPhoto(2, 'měření na InBody 770'),
  heroPhoto(3, 'testování v klubu'),

  /* ── Four advantages ── */
  textSlot('landing.adv.1.title', 'Výhoda 1 — titulek', ADV, 'Komplexní péče a prevence'),
  textSlot('landing.adv.1.text', 'Výhoda 1 — popis', ADV, 'Prohlídky, diagnostika i rehabilitace'),
  textSlot('landing.adv.2.title', 'Výhoda 2 — titulek', ADV, 'Odborný lékařský tým'),
  textSlot('landing.adv.2.text', 'Výhoda 2 — popis', ADV, 'A nejmodernější vybavení'),
  textSlot('landing.adv.3.title', 'Výhoda 3 — titulek', ADV, 'Rezervace online'),
  textSlot('landing.adv.3.text', 'Výhoda 3 — popis', ADV, 'Rychlé termíny, bez telefonování'),
  textSlot('landing.adv.4.title', 'Výhoda 4 — titulek', ADV, 'Testování přímo v klubu'),
  textSlot('landing.adv.4.text', 'Výhoda 4 — popis', ADV, 'Po celé ČR, od 30 sportovců'),

  /* ── Services ── */
  textSlot('landing.services.eyebrow', 'Služby — nadpis nad titulkem', SERV, 'Služby'),
  textSlot('landing.services.title', 'Služby — titulek sekce', SERV, 'Tři okruhy,\njedna klinika', { multiline: true }),
  textSlot('landing.services.allprices', 'Služby — tlačítko na celý ceník', SERV, 'Celý ceník'),

  textSlot('landing.service1.title', 'Služba 01 — název', SERV, 'Sportovní lékařské prohlídky'),
  textSlot(
    'landing.service1.text',
    'Služba 01 — popis',
    SERV,
    'Posouzení zdravotní způsobilosti ke sportu. Dvoufázově — vyšetření a pak vyhodnocení s lékařem, který vám výsledky vysvětlí. Základní měření InBody 770 je v ceně každé varianty.',
    { multiline: true },
  ),
  textSlot('landing.service1.link', 'Služba 01 — odkaz', SERV, 'Detail prohlídek'),
  mediaSlot('landing.service1.photo', 'Služba 01 — foto', SERV, 'lékař při prohlídce', '1200 × 1500 px', '4 / 5'),

  textSlot('landing.service2.title', 'Služba 02 — název', SERV, 'Sportovní diagnostika'),
  textSlot(
    'landing.service2.text',
    'Služba 02 — popis',
    SERV,
    'Výkon, reakce na zátěž, asymetrie a dysbalance. Silové desky ForceDecks, 3D analýza pohybu HumanTrak a spiroergometrie s VO₂max. Výstupem jsou čísla, podle kterých se dá upravit trénink.',
    { multiline: true },
  ),
  textSlot('landing.service2.link', 'Služba 02 — odkaz', SERV, 'Všechny balíčky'),
  mediaSlot('landing.service2.photo', 'Služba 02 — foto', SERV, 'ForceDecks — výskok na silových deskách', '1200 × 1500 px', '4 / 5'),

  textSlot('landing.service3.title', 'Služba 03 — název', SERV, 'InBody 770'),
  textSlot(
    'landing.service3.text',
    'Služba 03 — popis',
    SERV,
    'Přesný obraz těla místo čísla na váze. Svalová hmota, tuk, voda a rovnováha mezi jednotlivými segmenty. U zátěžových testů je základní měření bez příplatku.',
    { multiline: true },
  ),
  textSlot('landing.service3.link', 'Služba 03 — odkaz', SERV, 'Co měření ukáže'),
  mediaSlot('landing.service3.photo', 'Služba 03 — foto', SERV, 'analyzátor InBody 770', '1200 × 1500 px', '4 / 5'),

  /* ── Equipment ── */
  textSlot('landing.equipment.eyebrow', 'Vybavení — nadpis nad titulkem', EQ, 'Vybavení'),
  textSlot('landing.equipment.title', 'Vybavení — titulek', EQ, 'Na čem měříme'),
  textSlot('landing.equipment.1.name', 'Přístroj 1 — název', EQ, 'InBody 770'),
  textSlot('landing.equipment.1.text', 'Přístroj 1 — popis', EQ, 'Analýza složení těla po segmentech. Standard u všech zátěžových testů, bez příplatku.'),
  textSlot('landing.equipment.2.name', 'Přístroj 2 — název', EQ, 'ForceDecks'),
  textSlot('landing.equipment.2.text', 'Přístroj 2 — popis', EQ, 'Silové desky. Izometrické testy síly, výskoky, stranové asymetrie a dynamika pohybu.'),
  textSlot('landing.equipment.3.name', 'Přístroj 3 — název', EQ, 'HumanTrak'),
  textSlot('landing.equipment.3.text', 'Přístroj 3 — popis', EQ, '3D analýza pohybu. Rozsahy kloubů, kvalita provedení a kompenzační vzorce.'),
  textSlot('landing.equipment.4.name', 'Přístroj 4 — název', EQ, 'Spiroergometrie'),
  textSlot('landing.equipment.4.text', 'Přístroj 4 — popis', EQ, 'Výměna plynů při zátěži. VO₂max, anaerobní práh a tepové zóny pro trénink.'),

  /* ── How it works ── */
  textSlot('landing.steps.eyebrow', 'Jak to probíhá — nadpis nad titulkem', STEPS, 'Jak to probíhá'),
  textSlot('landing.steps.title', 'Jak to probíhá — titulek', STEPS, 'Od objednání\nk výsledkům', { multiline: true }),
  textSlot('landing.steps.lead', 'Jak to probíhá — úvod', STEPS, 'Celé objednání zvládnete za minutu. Papírování vyřídíte z domova, na klinice se jen vyšetříte.', { multiline: true }),
  textSlot('landing.steps.1.title', 'Krok 1 — titulek', STEPS, 'Vyberete termín'),
  textSlot('landing.steps.1.text', 'Krok 1 — popis', STEPS, 'Volné časy vidíte hned. Potvrzení přijde SMS i e-mailem.'),
  textSlot('landing.steps.2.title', 'Krok 2 — titulek', STEPS, 'Vyplníte dotazník'),
  textSlot('landing.steps.2.text', 'Krok 2 — popis', STEPS, 'Z domova přes odkaz, včetně výpisu od praktického lékaře.'),
  textSlot('landing.steps.3.title', 'Krok 3 — titulek', STEPS, 'Přijdete na vyšetření'),
  textSlot('landing.steps.3.text', 'Krok 3 — popis', STEPS, 'GreenLine, 5. patro, Jihlavská 1558/21, Praha 4.'),
  textSlot('landing.steps.4.title', 'Krok 4 — titulek', STEPS, 'Výsledky v portálu'),
  textSlot('landing.steps.4.text', 'Krok 4 — popis', STEPS, 'Posudek, naměřené hodnoty i doporučení lékaře navždy u vás.'),

  /* ── Club offer ── */
  textSlot('landing.club.eyebrow', 'Pro kluby — nadpis nad titulkem', CLUB, 'Pro sportovní kluby'),
  textSlot('landing.club.title', 'Pro kluby — titulek', CLUB, 'Mobilní testování\npřímo u vás', { multiline: true }),
  textSlot(
    'landing.club.text',
    'Pro kluby — odstavec',
    CLUB,
    'Vyjíždíme po celé České republice. Sportovci se nikam nepřesouvají, rodiče neztrácejí čas a vy dostanete výsledky za celý tým v jednom přehledu.',
    { multiline: true },
  ),
  textSlot('landing.club.stat1.value', 'Pro kluby — číslo 1 (minimum sportovců)', CLUB, '30+'),
  textSlot('landing.club.stat1.label', 'Pro kluby — popis čísla 1', CLUB, 'sportovců minimálně'),
  textSlot('landing.club.stat3.value', 'Pro kluby — číslo 3', CLUB, '1'),
  textSlot('landing.club.stat3.label', 'Pro kluby — popis čísla 3', CLUB, 'odkaz pro celý tým'),
  textSlot('landing.club.cta.inquiry', 'Pro kluby — tlačítko poptávky', CLUB, 'Nezávazná poptávka'),
  textSlot('landing.club.cta.link', 'Pro kluby — tlačítko „Mám odkaz od klubu“', CLUB, 'Mám odkaz od klubu'),
  mediaSlot('landing.club.photo', 'Pro kluby — foto', CLUB, 'testování v tělocvičně klubu', '1400 × 1200 px', '7 / 6'),

  /* ── Partners and philosophy ── */
  textSlot('landing.partners.eyebrow', 'Partneři — nadpis pásu', OTHER, 'Spolupracujeme s kluby po celé ČR'),
  textSlot('landing.philosophy.eyebrow', 'Filozofie — nadpis nad citátem', OTHER, 'Naše filozofie'),
  textSlot(
    'landing.philosophy.quote',
    'Filozofie — citát',
    OTHER,
    'Poskytovat služby na nejvyšší odborné úrovni — proto stavíme na zkušenostech špičkových lékařů a laborantů, nejmodernějších diagnostických technologiích a individuálním přístupu, který klientům přináší skutečnou a měřitelnou přidanou hodnotu.',
    { multiline: true },
  ),
  textSlot('landing.philosophy.link', 'Filozofie — odkaz', OTHER, 'Více o nás'),
];
