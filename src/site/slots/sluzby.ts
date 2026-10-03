import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';
import { heroSlots, listSlots, paraSlots } from '../../web/pages/services/slotFactory';
import { PKG_NOTE } from '../../web/pages/services/content/shared';

/*
 * Slots of the page /sluzby — and the texts that the service pages (Služby, Prohlídky, Diagnostika,
 * InBody, Ceník, Vybavení and the four diagnostics detail pages) share: the hero buttons, the card
 * labels and the group-discount block.
 *
 * Defaults are the wording of the live site (sportmedical-diagnostics.cz: the "Služby" page, the home
 * page's service areas, the discount block, the packages note of "Rezervační systém"). No price, no
 * discount figure: those come from the price list and from the discount tiers.
 */

const HERO = 'Služby › Hero';
const BLOCKS = 'Služby › Tři okruhy';
const MORE = 'Služby › Jednorázová vyšetření, balíčky, skupiny';
const SHARED = 'Služby › Společné texty (všechny stránky služeb)';

const service = (n: 1 | 2 | 3, title: string, text: string, photoCaption: string): SlotDef[] => [
  textSlot(`sluzby.service${n}.title`, `Služba ${n} — název`, BLOCKS, title),
  textSlot(`sluzby.service${n}.text`, `Služba ${n} — popis`, BLOCKS, text, { multiline: true }),
  textSlot(`sluzby.service${n}.link`, `Služba ${n} — tlačítko`, BLOCKS, 'Detailní informace'),
  mediaSlot(`sluzby.service${n}.photo`, `Služba ${n} — foto`, BLOCKS, photoCaption, '1200 × 800 px', '3 / 2'),
];

export const SLUZBY_SLOGANS = [
  'Komplexní zdravotní péče, prevence a rehabilitace',
  'Odborný lékařský tým a nejmodernější vybavení',
  'Pohodlná online rezervace a rychlé termíny',
  'Možnost realizace sportovních a diagnostických prohlídek přímo v klubu',
] as const;

export const SLUZBY_SINGLE = [
  'Chcete si ověřit zdravotní způsobilost, změřit kondici nebo si vyzkoušet konkrétní typ testu? Nabízíme všechny služby i samostatně.',
  'Základní InBody měření je zahrnuto v každém zátěžovém testu zdarma.',
] as const;
export const SLUZBY_PACKAGES = ['Chcete ušetřit a získat více? Spojte více služeb do výhodného balíčku.'] as const;
export const SLUZBY_GROUPS = [
  'Plánujete testování více osob nebo celého týmu?',
  'Pro větší skupiny připravujeme cenovou nabídku na míru, včetně přizpůsobení rozsahu, lokace a typu vyšetření.',
] as const;

export const sluzbySlots: SlotDef[] = [
  ...heroSlots('sluzby', HERO, {
    eyebrow: 'Ceník vyšetření a diagnostiky',
    title: 'Služby',
    lead: 'Vyberte si vyšetření přesně podle svých potřeb – nabízíme samostatné služby, výhodné balíčky, ale také individuální řešení pro kluby, týmy a skupiny.',
    photoCaption: 'tým v ordinaci',
  }),
  ...listSlots('sluzby.slogans', HERO, 'Heslo', SLUZBY_SLOGANS),

  textSlot('sluzby.blocks.title', 'Tři okruhy — titulek sekce', BLOCKS, 'Sportovní lékařské prohlídky, sportovní diagnostika, InBody 770'),
  ...service(
    1,
    'Sportovní lékařské prohlídky',
    'Provádíme sportovně-lékařská vyšetření zaměřená na posouzení zdravotního stavu, s důrazem na funkci kardiopulmonálního aparátu, toleranci fyzické zátěže a bezpečnost sportovní činnosti.',
    'lékařská prohlídka',
  ),
  ...service(
    2,
    'Sportovní diagnostika',
    'S využitím nejmodernějších diagnostických technologií odhalíme vaši vnitřní sílu, kvalitu pohybu a reálnou výkonnost s přesností, která běžné metody nechává daleko za sebou.',
    'sportovní diagnostika',
  ),
  ...service(
    3,
    'InBody 770',
    'V rámci našich služeb využíváme špičkový analyzátor tělesného složení InBody 770, který poskytuje detailní a přesné informace o složení těla a distribuci tělesných tekutin.',
    'přístroj InBody 770',
  ),

  textSlot('sluzby.single.title', 'Jednorázová vyšetření — titulek', MORE, 'Jednorázová vyšetření (bez balíčku)'),
  ...paraSlots('sluzby.single', MORE, 'Jednorázová vyšetření', SLUZBY_SINGLE),
  textSlot('sluzby.packages.title', 'Zvýhodněné balíčky — titulek', MORE, 'Zvýhodněné balíčky'),
  ...paraSlots('sluzby.packages', MORE, 'Zvýhodněné balíčky', SLUZBY_PACKAGES),
  textSlot('sluzby.groups.title', 'Skupiny, kluby a školy — titulek', MORE, 'Individuální nabídky pro skupiny, kluby a školy'),
  ...paraSlots('sluzby.groups', MORE, 'Skupiny, kluby a školy', SLUZBY_GROUPS),
  textSlot('sluzby.groups.link', 'Skupiny, kluby a školy — odkaz na stránku Kluby', MORE, 'Nabídka pro sportovní kluby'),
  textSlot('sluzby.equipment.title', 'Vybavení — titulek', MORE, 'Nejmodernější diagnostické vybavení'),
  textSlot('sluzby.equipment.link', 'Vybavení — odkaz na stránku Vybavení', MORE, 'Přístroje, na kterých vyšetřujeme'),

  /* ── Shared by the service pages ── */
  textSlot('sluzby.shared.cta.book', 'Hero — hlavní tlačítko (všechny stránky služeb)', SHARED, 'Objednat termín'),
  textSlot('sluzby.shared.cta.prices', 'Hero — druhé tlačítko (všechny stránky služeb)', SHARED, 'Ceník'),
  textSlot('sluzby.shared.cta.phone', 'Karta služby — objednání telefonem (číslo je z nastavení kliniky)', SHARED, 'Objednání telefonicky nebo zprávou'),
  textSlot('sluzby.shared.docs.link', 'Odkaz na dokumenty ke stažení', SHARED, 'Dokumenty ke stažení'),
  textSlot('sluzby.shared.badge.popular', 'Karta služby — štítek', SHARED, 'Oblíbené'),
  textSlot('sluzby.shared.card.included', 'Karta služby — nadpis seznamu „zahrnuje“', SHARED, 'Zahrnuje'),
  textSlot('sluzby.shared.card.excluded', 'Karta služby — nadpis seznamu „nezahrnuje“', SHARED, 'Nezahrnuje'),
  textSlot('sluzby.shared.card.more', 'Karta služby — odkaz na rozbalení řádku', SHARED, 'bližší informace'),
  textSlot('sluzby.shared.discount.title', 'Skupinové slevy — titulek (zobrazí se, jen když server hladiny zveřejní)', SHARED, 'Čím větší skupina, tím výhodnější podmínky'),
  textSlot('sluzby.shared.discount.per', 'Skupinové slevy — popisek pod procentem', SHARED, '/ osoba'),
  textSlot('sluzby.shared.discount.note', 'Skupinové slevy — poznámka pod kartami', SHARED, 'Výše slevy závisí na počtu osob. Větší skupiny = výhodnější cena za osobu.'),
  textSlot('sluzby.shared.club.value', 'Karta pro kluby — hlavní řádek', SHARED, 'speciální cenová nabídka'),
  textSlot('sluzby.shared.club.label', 'Karta pro kluby — název', SHARED, 'Sportovní kluby/organizace'),
  textSlot('sluzby.shared.pkgnote.title', 'Objednávka balíčku — titulek', SHARED, PKG_NOTE.title),
  ...paraSlots('sluzby.shared.pkgnote', SHARED, 'Objednávka balíčku', PKG_NOTE.paras),
  ...listSlots('sluzby.shared.pkgnote', SHARED, 'Objednávka balíčku', PKG_NOTE.items),
];
