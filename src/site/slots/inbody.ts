import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';
import { cardSlots, gallerySlots, heroSlots, listSlots, paraSlots, photoSlot } from '../../web/pages/services/slotFactory';
import { cardSlotDefs, lineSlotDefs } from '../../web/pages/services/content/cards';
import {
  INBODY_CARDS, INBODY_CARD_PREFIX, INBODY_DURATION, INBODY_FEATURES, INBODY_HERO, INBODY_HOW, INBODY_LINES, INBODY_LINE_PREFIX, INBODY_PARAMS,
  INBODY_PRECISE, INBODY_PRECISION, INBODY_PREP, INBODY_PRICE, INBODY_STANDARD, INBODY_VS,
} from '../../web/pages/services/content/inbody';

/*
 * InBody 770 (/inbody). Defaults: the wording of the live page sportmedical-diagnostics.cz/pages/inbody
 * as published (Slovak words and typos corrected; the page's stale contact block is not copied) and the
 * InBody answers of the live FAQ. Prices are NOT here: they come from the price list; the group
 * discounts come from the discount tiers.
 */

const HERO = 'InBody › Hero';
const FEATURES = 'InBody › Co přístroj měří';
const STANDARD = 'InBody › U nás jako standard';
const PRECISION = 'InBody › Diagnostická přesnost';
const PARAMS = 'InBody › Komplexní parametry';
const PRECISE = 'InBody › Bez kompromisů, bez odhadů';
const PRICE = 'InBody › Ceník — karty služeb';
const PREP = 'InBody › Příprava a průběh měření';

export const inbodySlots: SlotDef[] = [
  ...heroSlots('inbody', HERO, INBODY_HERO),

  textSlot('inbody.features.title', 'Co měří — titulek sekce', FEATURES, INBODY_FEATURES.title),
  ...cardSlots('inbody.features', FEATURES, 'Parametr', INBODY_FEATURES.cards),

  textSlot('inbody.standard.eyebrow', 'U nás jako standard — nadpis nad titulkem', STANDARD, INBODY_STANDARD.eyebrow),
  textSlot('inbody.standard.title', 'U nás jako standard — titulek sekce', STANDARD, INBODY_STANDARD.title),
  ...paraSlots('inbody.standard', STANDARD, 'U nás jako standard', INBODY_STANDARD.paras),
  ...gallerySlots('inbody.standard', STANDARD, 'U nás jako standard', INBODY_STANDARD.photos),

  textSlot('inbody.precision.title', 'Diagnostická přesnost — titulek sekce', PRECISION, INBODY_PRECISION.title),
  ...paraSlots('inbody.precision', PRECISION, 'Diagnostická přesnost', INBODY_PRECISION.paras),
  photoSlot('inbody.precision.photo', 'Diagnostická přesnost — foto', PRECISION, INBODY_PRECISION.photo),

  textSlot('inbody.params.title', 'Komplexní parametry — titulek sekce', PARAMS, INBODY_PARAMS.title),
  ...cardSlots('inbody.params', PARAMS, 'Parametr', INBODY_PARAMS.cards),

  textSlot('inbody.precise.title', 'Bez kompromisů — titulek sekce', PRECISE, INBODY_PRECISE.title),
  ...cardSlots('inbody.precise', PRECISE, 'Vlastnost', INBODY_PRECISE.cards),
  photoSlot('inbody.precise.photo', 'Bez kompromisů — foto', PRECISE, INBODY_PRECISE.photo),

  textSlot('inbody.price.title', 'Ceník — titulek sekce', PRICE, INBODY_PRICE.title),
  ...paraSlots('inbody.price', PRICE, 'Ceník', INBODY_PRICE.paras),
  textSlot('inbody.price.more', 'Ceník — titulek dalších služeb z ceníku', PRICE, INBODY_PRICE.more),
  ...cardSlotDefs(INBODY_CARD_PREFIX, PRICE, INBODY_CARDS),
  ...lineSlotDefs(INBODY_LINE_PREFIX, PRICE, INBODY_LINES),

  textSlot('inbody.prep.title', 'Příprava — titulek sekce', PREP, INBODY_PREP.title),
  textSlot('inbody.prep.rules.title', 'Příprava — zásady: titulek', PREP, INBODY_PREP.rules.title),
  ...listSlots('inbody.prep.rules', PREP, 'Příprava — zásady', INBODY_PREP.rules.items),
  textSlot('inbody.prep.extra.title', 'Příprava — doplňková doporučení: titulek', PREP, INBODY_PREP.extra.title),
  ...listSlots('inbody.prep.extra', PREP, 'Příprava — doplňková doporučení', INBODY_PREP.extra.items),
  textSlot('inbody.prep.contra.title', 'Příprava — kontraindikace: titulek', PREP, INBODY_PREP.contra.title),
  ...listSlots('inbody.prep.contra', PREP, 'Příprava — kontraindikace', INBODY_PREP.contra.items),
  ...paraSlots('inbody.prep.closing', PREP, 'Příprava — závěr', INBODY_PREP.closing),

  textSlot('inbody.how.title', 'Jak InBody funguje — titulek sekce', PREP, INBODY_HOW.title),
  ...paraSlots('inbody.how', PREP, 'Jak InBody funguje', INBODY_HOW.paras),
  textSlot('inbody.how.flow.title', 'Jak vyšetření probíhá — titulek', PREP, INBODY_HOW.flowTitle),
  ...paraSlots('inbody.how.flow', PREP, 'Jak vyšetření probíhá', INBODY_HOW.flow),
  textSlot('inbody.how.features.title', 'Hlavní vlastnosti — titulek', PREP, INBODY_HOW.featuresTitle),
  ...listSlots('inbody.how.features', PREP, 'Hlavní vlastnosti', INBODY_HOW.features),
  ...paraSlots('inbody.how.closing', PREP, 'Jak InBody funguje — závěr', INBODY_HOW.closing),

  textSlot('inbody.vs.title', 'InBody a chytré váhy — titulek sekce', PREP, INBODY_VS.title),
  ...paraSlots('inbody.vs', PREP, 'InBody a chytré váhy', INBODY_VS.paras),

  textSlot('inbody.duration.title', 'Délka měření a výsledky — titulek sekce', PREP, INBODY_DURATION.title),
  ...paraSlots('inbody.duration', PREP, 'Délka měření a výsledky', INBODY_DURATION.paras),
];
