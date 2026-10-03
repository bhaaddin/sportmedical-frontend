import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';
import { cardSlots, heroSlots, paraSlots } from '../../web/pages/services/slotFactory';
import {
  ALL_DEVICES, VYBAVENI_HERO, VYBAVENI_MAIN_TITLE, VYBAVENI_TECH_CLOSING, VYBAVENI_TECH_TITLE,
} from '../../web/pages/services/content/vybaveni';

/*
 * Vybavení (/vybaveni): the devices of the clinic. Defaults: the wording of the live site
 * (sportmedical-diagnostics.cz/pages/sportovni-lekarske-prohlidky, "Nejmodernější diagnostické
 * vybavení", and the "Naše technologie" answer of the FAQ), as published; Slovak words corrected.
 * The page draws the same device list (src/web/pages/services/content/vybaveni.ts).
 */

const HERO = 'Vybavení › Hero';
const MAIN = 'Vybavení › Nejmodernější diagnostické vybavení';
const TECH = 'Vybavení › Naše technologie';

const MAIN_IDS = new Set(['antropometrie', 'ekg', 'ergometr', 'spirometrie', 'spiroergometrie']);

const deviceSlots = ALL_DEVICES.flatMap((device): SlotDef[] => {
  const group = MAIN_IDS.has(device.id) ? MAIN : TECH;
  const prefix = `vybaveni.dev.${device.id}`;
  return [
    textSlot(`${prefix}.title`, `${device.title} — název`, group, device.title),
    mediaSlot(`${prefix}.photo`, `${device.title} — foto`, group, device.photoCaption, '1200 × 900 px', '4 / 3'),
    ...paraSlots(prefix, group, `${device.title} — úvod`, device.intro),
    ...(device.sub !== undefined ? [textSlot(`${prefix}.sub`, `${device.title} — podtitulek`, group, device.sub)] : []),
    ...device.groups.flatMap((entry, index): SlotDef[] => [
      ...(entry.heading !== undefined ? [textSlot(`${prefix}.g${index + 1}.heading`, `${device.title} — skupina ${index + 1}: titulek`, group, entry.heading)] : []),
      ...cardSlots(`${prefix}.g${index + 1}`, group, `${device.title} — skupina ${index + 1}, výhoda`, entry.items),
    ]),
  ];
});

export const vybaveniSlots: SlotDef[] = [
  ...heroSlots('vybaveni', HERO, VYBAVENI_HERO),
  textSlot('vybaveni.main.title', 'Vybavení pro prohlídky — titulek sekce', MAIN, VYBAVENI_MAIN_TITLE),
  textSlot('vybaveni.tech.title', 'Naše technologie — titulek sekce', TECH, VYBAVENI_TECH_TITLE),
  ...paraSlots('vybaveni.tech.closing', TECH, 'Naše technologie — závěr', VYBAVENI_TECH_CLOSING),
  ...deviceSlots,
];
