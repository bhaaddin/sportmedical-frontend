import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';
import { gallerySlots, heroSlots } from '../../web/pages/services/slotFactory';

/*
 * Slots of the page /web/sluzby — and the texts that the five service pages (Služby, Prohlídky,
 * Diagnostika, InBody, Ceník) share: the two hero buttons and the group-discount block.
 *
 * Defaults are the texts and [FOTO: …] captions of the artboard V-Sluzby, and for the
 * descriptions what the clinic's website says. No price, no discount figure: those come from the
 * price list and from the discount tiers.
 */

const HERO = 'Služby › Hero';
const BLOCKS = 'Služby › Tři okruhy';
const GALLERY = 'Služby › Fotogalerie vybavení';
const SHARED = 'Služby › Společné texty (všechny stránky služeb)';

const service = (n: 1 | 2 | 3, title: string, text: string, photoCaption: string): SlotDef[] => [
  textSlot(`sluzby.service${n}.title`, `Služba ${n} — název`, BLOCKS, title),
  textSlot(`sluzby.service${n}.text`, `Služba ${n} — popis`, BLOCKS, text, { multiline: true }),
  textSlot(`sluzby.service${n}.link`, `Služba ${n} — tlačítko`, BLOCKS, 'Detail a objednání'),
  mediaSlot(`sluzby.service${n}.photo`, `Služba ${n} — foto`, BLOCKS, photoCaption, '1200 × 800 px', '3 / 2'),
];

export const sluzbySlots: SlotDef[] = [
  ...heroSlots('sluzby', HERO, {
    eyebrow: 'Služby',
    title: 'Tři okruhy, jedna klinika',
    lead: 'Lékařské prohlídky pro potvrzení, že můžete sportovat. Diagnostika pro to, abyste sportovali líp. InBody pro přesný obraz těla v čase.',
    photoCaption: 'tým v ordinaci',
  }),

  textSlot('sluzby.blocks.title', 'Tři okruhy — titulek sekce', BLOCKS, 'Co u nás absolvujete'),
  ...service(1, 'Sportovní lékařské prohlídky', 'Posouzení zdravotní způsobilosti ke sportu. Dvoufázově: vyšetření a vyhodnocení.', 'lékařská prohlídka'),
  ...service(2, 'Sportovní diagnostika', 'Výkon, reakce na zátěž, asymetrie a dysbalance. ForceDecks, HumanTrak, VO₂max.', 'zátěžový test'),
  ...service(3, 'InBody 770', 'Detailní složení těla — svalová hmota, tuk, voda a rovnováha mezi segmenty.', 'přístroj InBody 770'),

  // The equipment cards come from the landing's slots (landing.equipment.*); these are the photos under them.
  ...gallerySlots('sluzby.gallery', GALLERY, 'Vybavení', ['InBody 770', 'ForceDecks', 'HumanTrak', 'ergometr']),

  /* ── Shared by the five service pages ── */
  textSlot('sluzby.shared.cta.book', 'Hero — hlavní tlačítko (všechny stránky služeb)', SHARED, 'Objednat termín'),
  textSlot('sluzby.shared.cta.prices', 'Hero — druhé tlačítko (všechny stránky služeb)', SHARED, 'Ceník'),
  textSlot('sluzby.shared.docs.link', 'Odkaz na dokumenty ke stažení', SHARED, 'Dokumenty ke stažení'),
  textSlot('sluzby.shared.discount.title', 'Skupinové slevy — titulek (zobrazí se, jen když server hladiny zveřejní)', SHARED, 'Čím větší skupina, tím výhodnější podmínky'),
  textSlot('sluzby.shared.discount.per', 'Skupinové slevy — popisek pod procentem', SHARED, 'na osobu'),
  textSlot('sluzby.shared.discount.note', 'Skupinové slevy — poznámka pod kartami', SHARED, 'Sleva se dopočítá automaticky podle počtu objednaných osob.'),
  textSlot('sluzby.shared.club.value', 'Karta pro kluby — hlavní řádek', SHARED, 'individuálně'),
  textSlot('sluzby.shared.club.label', 'Karta pro kluby — název', SHARED, 'Kluby a organizace'),
  textSlot('sluzby.shared.club.note', 'Karta pro kluby — popisek', SHARED, 'zvláštní nabídka'),
];
