import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';

/*
 * Slots of the page /web/o-nas (artboard V-ONas). The equipment names and descriptions are the
 * landing's own slots (`landing.equipment.*`) and the philosophy quote is `landing.philosophy.quote`,
 * so each sentence is edited in one place; the partners come from the partner list.
 * Defaults are the clinic's website and the artboard. Team names are placeholders until the clinic
 * supplies them.
 */

const HERO = 'O nás › Úvod';
const VALUES = 'O nás › Čím se řídíme';
const GALLERY = 'O nás › Galerie kliniky';
const TEAM = 'O nás › Tým';
const GEAR = 'O nás › Vybavení (fotky)';
const WHO = 'O nás › Komu sloužíme';
const MISSION = 'O nás › Mise';

const VALUE_ITEMS: readonly (readonly [string, string])[] = [
  ['Odborný tým', 'Lékaři a laboranti se zkušeností se sportovci na všech úrovních.'],
  ['Moderní technologie', 'InBody 770, ForceDecks, HumanTrak, spiroergometrie.'],
  ['Individuální přístup', 'Výsledky se vysvětlují, ne jen vytisknou.'],
  ['Měřitelný přínos', 'Čísla, se kterými se dá pracovat v tréninku.'],
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
  ['Spiroergometrie', 'spiroergometrie na ergometru'],
];

export const TEAM_SIZE = 4;
export const VALUE_COUNT = VALUE_ITEMS.length;
export const GALLERY_COUNT = GALLERY_ITEMS.length;
export const GEAR_COUNT = GEAR_ITEMS.length;

export const onasSlots: SlotDef[] = [
  textSlot('onas.hero.eyebrow', 'Úvod — nadpis nad titulkem', HERO, 'O nás'),
  textSlot('onas.hero.title', 'Úvod — titulek stránky', HERO, 'Měřitelná přidaná hodnota'),
  textSlot(
    'onas.hero.lead',
    'Úvod — úvodní odstavec',
    HERO,
    'Naší filozofií je poskytovat služby na nejvyšší odborné úrovni. Stavíme na zkušenostech špičkových lékařů a laborantů, nejmodernějších technologiích a individuálním přístupu.',
    { multiline: true },
  ),
  textSlot('onas.hero.cta.book', 'Úvod — hlavní tlačítko', HERO, 'Objednat termín'),
  textSlot('onas.hero.cta.prices', 'Úvod — druhé tlačítko', HERO, 'Ceník'),
  mediaSlot('onas.hero.photo', 'Úvod — foto', HERO, 'tým kliniky', '1600 × 1000 px', '16 / 10'),

  textSlot('onas.values.title', 'Čím se řídíme — titulek sekce', VALUES, 'Čím se řídíme'),
  ...VALUE_ITEMS.flatMap(([title, text], index): SlotDef[] => [
    textSlot(`onas.values.${index + 1}.title`, `Zásada ${index + 1} — název`, VALUES, title),
    textSlot(`onas.values.${index + 1}.text`, `Zásada ${index + 1} — popis`, VALUES, text),
  ]),

  textSlot('onas.gallery.title', 'Galerie — titulek sekce', GALLERY, 'Klinika uvnitř'),
  ...GALLERY_ITEMS.map(([label, caption], index) =>
    mediaSlot(`onas.gallery.photo${index + 1}`, `Galerie — fotka ${index + 1} (${label})`, GALLERY, `galerie kliniky — ${caption}`, '1200 × 900 px', '4 / 3'),
  ),

  textSlot('onas.team.title', 'Tým — titulek sekce', TEAM, 'Tým kliniky'),
  textSlot('onas.team.lead', 'Tým — úvod', TEAM, 'Za každým výsledkem stojí lékař nebo laborant, který vám ho vysvětlí.', { multiline: true }),
  ...Array.from({ length: TEAM_SIZE }, (_, index) => index + 1).flatMap((n): SlotDef[] => [
    mediaSlot(`onas.team.${n}.photo`, `Člen týmu ${n} — fotka`, TEAM, `portrét — člen týmu ${n}`, '1000 × 1250 px', '4 / 5'),
    textSlot(`onas.team.${n}.name`, `Člen týmu ${n} — jméno`, TEAM, '[Jméno a příjmení]'),
    textSlot(`onas.team.${n}.role`, `Člen týmu ${n} — funkce`, TEAM, '[Funkce]'),
  ]),

  textSlot('onas.gear.title', 'Vybavení — titulek sekce (názvy a popisy přístrojů jsou v „Úvodní stránka › Vybavení“)', GEAR, 'Na čem měříme'),
  ...GEAR_ITEMS.map(([label, caption], index) =>
    mediaSlot(`onas.gear.${index + 1}.photo`, `Přístroj ${index + 1} — fotka (${label})`, GEAR, caption, '1200 × 900 px', '4 / 3'),
  ),

  textSlot('onas.who.title', 'Komu sloužíme — titulek sekce', WHO, 'Komu sloužíme'),
  textSlot('onas.who.lead', 'Komu sloužíme — úvod', WHO, 'Od dětských akademií po reprezentaci.', { multiline: true }),

  textSlot('onas.mission.eyebrow', 'Mise — nadpis nad titulkem', MISSION, 'Naše mise'),
  textSlot('onas.mission.title', 'Mise — titulek', MISSION, 'Nový pohled na sportovní medicínu a diagnostiku'),
  textSlot(
    'onas.mission.text',
    'Mise — text',
    MISSION,
    'Propojujeme medicínu, moderní technologie a sportovní vědu do funkčního přístupu, který přináší užitek sportovcům i široké veřejnosti. Špičkový výkon ani dlouhodobé zdraví nejsou otázkou náhody — vznikají tam, kde víme, jak tělo skutečně funguje: v čem je silné, kde má limity a kde skrývá rezervy.',
    { multiline: true },
  ),
  textSlot('onas.mission.cta.book', 'Mise — hlavní tlačítko', MISSION, 'Objednat termín'),
  textSlot('onas.mission.cta.contact', 'Mise — druhé tlačítko', MISSION, 'Kontakt'),
];
