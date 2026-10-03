import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';

/*
 * Slots of the page /o-nas (artboard V-ONas). The text is the live page "O nás"
 * (https://sportmedical-diagnostics.cz/pages/o-nas-1, captured 2026-10-03), in its order: the new view of
 * sports medicine, the guarantee and its three pillars, diagnostics without borders. The live page has no
 * team, no history and no list of values — none is invented; the gallery and the equipment photos are
 * grey placeholders until the clinic sends pictures. The equipment names and descriptions are the landing's
 * own slots (`landing.equipment.*`), so each is edited in one place; the partners come from the partner list.
 */

const HERO = 'O nás › Úvod';
const INTRO = 'O nás › SportMedical Diagnostics';
const GUARANTEE = 'O nás › Záruka špičkové úrovně';
const NOLIMIT = 'O nás › Diagnostika bez hranic';
const GALLERY = 'O nás › Galerie kliniky';
const GEAR = 'O nás › Vybavení (fotky)';
const WHO = 'O nás › Partneři';
const MISSION = 'O nás › Ambice';

const PILLARS: readonly (readonly [string, string])[] = [
  ['Kvalita a individuální přístup', 'Každé vyšetření probíhá s důrazem na detail, přesnost a potřeby konkrétního klienta. Každý sportovec, klient i sportovní klub je pro nás samostatným projektem, kterému věnujeme maximální péči – od vstupního rozhovoru až po konkrétní a prakticky využitelná doporučení.'],
  ['Nejmodernější diagnostické a analytické technologie', 'Pracujeme s vysoce pokročilými systémy nejnovější generace, které umožňují zachytit a vyhodnotit funkční, silové i pohybové parametry na úrovni detailu, která byla ještě donedávna prakticky nedostupná. Díky tomu dokážeme s mimořádnou přesností analyzovat jemné asymetrie, skryté dysbalance i komplexní reakce organismu na zátěž – vždy v kontextu celkového fungování těla.'],
  ['Komplexní pohled v souvislostech', 'Nesoustředíme se pouze na jednotlivá čísla nebo izolované výsledky. Propojujeme reakce organismu, pohybové vzorce, silové a svalové vztahy, asymetrie i kompenzační mechanismy do jednoho smysluplného a srozumitelného celku, který přináší jasnou hodnotu pro sportovní výkon, prevenci i dlouhodobé zdraví.'],
];

const GALLERY_ITEMS: readonly (readonly [string, string])[] = [
  ['Ordinace', 'ordinace kliniky'],
  ['Laboratoř', 'laboratoř a diagnostické pracoviště'],
  ['Přístroje', 'přístroje na měření'],
  ['Tým', 'tým při práci'],
];

const GEAR_ITEMS: readonly (readonly [string, string])[] = [
  ['InBody 770', 'analyzátor InBody 770'],
  ['ForceDecks', 'silové desky ForceDecks'],
  ['HumanTrak', '3D analýza pohybu HumanTrak'],
  ['Cortex 21', 'mobilní VO₂max analýza Cortex 21'],
];

export const PILLAR_COUNT = PILLARS.length;
export const GALLERY_COUNT = GALLERY_ITEMS.length;
export const GEAR_COUNT = GEAR_ITEMS.length;

export const onasSlots: SlotDef[] = [
  textSlot('onas.hero.eyebrow', 'Úvod — nadpis nad titulkem', HERO, 'O nás'),
  textSlot('onas.hero.title', 'Úvod — titulek stránky', HERO, 'Nový pohled na sportovní medicínu a diagnostiku'),
  textSlot(
    'onas.hero.lead',
    'Úvod — úvodní odstavec',
    HERO,
    'SportMedical Diagnostics s.r.o. je moderní soukromé zdravotnické zařízení zaměřené na tělovýchovné lékařství a vysoce specializovanou sportovní diagnostiku.',
    { multiline: true },
  ),
  textSlot('onas.hero.cta.book', 'Úvod — hlavní tlačítko', HERO, 'Objednat termín'),
  textSlot('onas.hero.cta.prices', 'Úvod — druhé tlačítko', HERO, 'Ceník'),
  mediaSlot('onas.hero.photo', 'Úvod — foto (bannerový obrázek)', HERO, 'banner — SportMedical Diagnostics', '1600 × 1000 px', '16 / 10'),

  textSlot('onas.intro.title', 'SportMedical Diagnostics — titulek sekce', INTRO, 'SportMedical Diagnostics'),
  textSlot(
    'onas.intro.1',
    'SportMedical Diagnostics — odstavec 1',
    INTRO,
    'Naším cílem je poskytovat služby na nejvyšší možné úrovni – odborně, individuálně a s maximální precizností. Propojujeme medicínu, moderní technologie a sportovní vědu do jednoho funkčního celku, který přináší reálný přínos profesionálním i rekreačním sportovcům, trenérům i široké veřejnosti.',
    { multiline: true },
  ),
  textSlot(
    'onas.intro.2',
    'SportMedical Diagnostics — odstavec 2',
    INTRO,
    'Věříme, že špičkový výkon ani dlouhodobé zdraví nejsou otázkou náhody. Jsou výsledkem hlubokého porozumění tomu, jak tělo skutečně funguje – kde jsou jeho silné stránky, kde vznikají limity, jaké rezervy zůstávají nevyužité a kde se mohou skrývat budoucí rizika.',
    { multiline: true },
  ),
  mediaSlot('onas.intro.photo', 'SportMedical Diagnostics — foto (zátěžový test)', INTRO, 'zátěžový test na ergometru', '1200 × 900 px', '4 / 3'),

  textSlot('onas.guarantee.eyebrow', 'Záruka — nadpis nad titulkem', GUARANTEE, 'Záruka špičkové úrovně'),
  textSlot('onas.guarantee.title', 'Záruka — titulek sekce', GUARANTEE, 'Odbornost, která stojí za výsledky'),
  textSlot(
    'onas.guarantee.text',
    'Záruka — odstavec',
    GUARANTEE,
    'Naše diagnostika je založena na důslednosti, individuálním přístupu a využití nejmodernějších přístrojů a technologií. Každému klientovi věnujeme maximální pozornost a získaná data nejen měříme, ale především je odborně interpretujeme a zasazujeme do širších souvislostí. Právě tento přístup nám umožňuje vytvořit jasný, ucelený a srozumitelný obraz o fungování lidského těla.',
    { multiline: true },
  ),
  textSlot('onas.guarantee.pillars', 'Záruka — věta před pilíři', GUARANTEE, 'Proto stavíme na třech klíčových pilířích:'),
  ...PILLARS.flatMap(([title, text], index): SlotDef[] => [
    textSlot(`onas.pillar.${index + 1}.title`, `Pilíř ${index + 1} — název`, GUARANTEE, title),
    textSlot(`onas.pillar.${index + 1}.text`, `Pilíř ${index + 1} — popis`, GUARANTEE, text, { multiline: true }),
  ]),
  mediaSlot('onas.guarantee.graphic', 'Záruka — grafika', GUARANTEE, 'grafika — pilíře kvality', '1600 × 640 px', '5 / 2'),

  textSlot('onas.nolimit.title', 'Diagnostika bez hranic — titulek sekce', NOLIMIT, 'Sportovní diagnostika bez hranic'),
  textSlot(
    'onas.nolimit.1',
    'Diagnostika bez hranic — odstavec 1',
    NOLIMIT,
    'Součástí naší filozofie a technologického standardu je také terénní diagnostika, na kterou se specializujeme. Kompletní přístrojové a technické zázemí dokážeme přenést i mimo naše pracoviště – přímo do prostředí sportovních klubů, organizací nebo firem, aniž by došlo k jakémukoli omezení kvality, přesnosti či rozsahu vyšetření.',
    { multiline: true },
  ),
  textSlot(
    'onas.nolimit.2',
    'Diagnostika bez hranic — odstavec 2',
    NOLIMIT,
    'Tento přístup jasně odráží naši úroveň, důraz na detail a schopnost zachovat nejvyšší diagnostický standard bez kompromisů, bez ohledu na prostředí, ve kterém pracujeme.',
    { multiline: true },
  ),
  textSlot('onas.nolimit.cta', 'Diagnostika bez hranic — odkaz na kluby', NOLIMIT, 'Nabídka pro sportovní kluby'),

  textSlot('onas.gallery.title', 'Galerie — titulek sekce', GALLERY, 'Klinika uvnitř'),
  ...GALLERY_ITEMS.map(([label, caption], index) =>
    mediaSlot(`onas.gallery.photo${index + 1}`, `Galerie — fotka ${index + 1} (${label})`, GALLERY, `galerie kliniky — ${caption}`, '1200 × 900 px', '4 / 3'),
  ),

  textSlot('onas.gear.title', 'Vybavení — titulek sekce (názvy a popisy přístrojů jsou v „Úvodní stránka › Vybavení“)', GEAR, 'Na čem měříme'),
  ...GEAR_ITEMS.map(([label, caption], index) =>
    mediaSlot(`onas.gear.${index + 1}.photo`, `Přístroj ${index + 1} — fotka (${label})`, GEAR, caption, '1200 × 900 px', '4 / 3'),
  ),

  textSlot('onas.who.title', 'Partneři — titulek sekce', WHO, 'Naši partneři'),
  textSlot('onas.who.lead', 'Partneři — úvod', WHO, 'Pomáháme klubům zlepšovat péči o sportovce.', { multiline: true }),
  textSlot('onas.who.cta', 'Partneři — odkaz na všechny partnery', WHO, 'Všichni partneři'),

  textSlot('onas.mission.eyebrow', 'Ambice — nadpis nad titulkem', MISSION, 'Naše ambice'),
  textSlot('onas.mission.title', 'Ambice — titulek', MISSION, 'Etalon kvality ve sportovní medicíně'),
  textSlot(
    'onas.mission.text',
    'Ambice — text',
    MISSION,
    'Naší ambicí je stát se etalonem kvality v oblasti sportovní medicíny a diagnostiky v České republice.',
    { multiline: true },
  ),
  textSlot('onas.mission.cta.book', 'Ambice — hlavní tlačítko', MISSION, 'Objednat termín'),
  textSlot('onas.mission.cta.contact', 'Ambice — druhé tlačítko', MISSION, 'Kontakt'),
];
