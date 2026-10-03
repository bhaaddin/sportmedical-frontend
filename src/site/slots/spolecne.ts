import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/* Header and footer — shared by every public page. Contact data comes from the clinic's own
   settings (GET /api/public/clinic); these texts are what is shown when it has none.
   The company line carries only what the live website publishes (name, IČO, seat). DIČ, bank account
   and the data box are NOT here: they are the clinic's own settings and appear only when filled in. */

const FOOT = 'Společné › Zápatí';
const LEGAL = 'Společné › Právní odkazy v zápatí';

/** The small legal row of the footer, and the "more information" rows of the legal pages and of Kontakt. */
export const LEGAL_LINKS = [
  { key: 'site.legal.podminky', to: '/obchodni-podminky' },
  { key: 'site.legal.soukromi', to: '/ochrana-osobnich-udaju' },
  { key: 'site.legal.storno', to: '/storno-a-reklamace' },
  { key: 'site.legal.faq', to: '/faq' },
  { key: 'site.legal.partneri', to: '/partneri' },
] as const;

export const spolecneSlots: SlotDef[] = [
  textSlot('site.footer.address', 'Zápatí — adresa (když ji klinika nemá v nastavení)', FOOT, 'Budova GreenLine, 5. patro\nJihlavská 1558/21\n140 00 Praha 4 — Michle', { multiline: true }),
  textSlot('site.footer.phone', 'Zápatí — telefon (když ho klinika nemá v nastavení)', FOOT, '+420 606 785 271'),
  textSlot('site.footer.email', 'Zápatí — e-mail (když ho klinika nemá v nastavení)', FOOT, 'recepce@sportmedical-diagnostics.cz'),
  textSlot('site.footer.hours', 'Zápatí — provozní doba (když ji klinika nemá v nastavení)', FOOT, 'Po–Pá 8:00–18:00\nSo 8:00–18:00\nNe zavřeno\nprovoz podle objednání', { multiline: true }),
  textSlot('site.footer.legal', 'Zápatí — řádek se společností', FOOT, 'SportMedical Diagnostics s.r.o. · IČO 23351632 · Krátká 283, 252 65 Tursko'),

  textSlot('site.legal.podminky', 'Právní odkaz — Obchodní podmínky', LEGAL, 'Obchodní podmínky'),
  textSlot('site.legal.soukromi', 'Právní odkaz — Ochrana osobních údajů', LEGAL, 'Ochrana osobních údajů'),
  textSlot('site.legal.storno', 'Právní odkaz — Storno a reklamace', LEGAL, 'Storno a reklamace'),
  textSlot('site.legal.faq', 'Právní odkaz — Časté otázky', LEGAL, 'Časté otázky'),
  textSlot('site.legal.partneri', 'Právní odkaz — Partneři', LEGAL, 'Partneři'),
];
