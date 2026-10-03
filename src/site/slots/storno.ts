import type { SlotDef } from '../slotTypes';
import type { TextSection } from './textPage';
import { textPageSlots } from './textPage';

/*
 * Slots of the page /storno-a-reklamace. The defaults are the clinic's own written terms, "Zásady vrácení
 * peněz a storno podmínky", as published at https://sportmedical-diagnostics.cz/policies/refund-policy
 * (captured 2026-10-03). The e-mail and the phone are not typed: "{email}" and "{telefon}" are the
 * clinic's own settings. LEGAL TEXT — the wording belongs to the operator and needs a legal review.
 */

export const STORNO_SECTIONS: readonly TextSection[] = [
  {
    id: 'charakter',
    title: 'Charakter poskytovaných služeb',
    text: 'SportMedical Diagnostics s.r.o. poskytuje zdravotní a sportovně-diagnostické služby výhradně **na základě předchozí objednávky na konkrétní termín**. Neprodáváme zboží, nezasíláme produkty a neposkytujeme služby formou doručování.',
  },
  {
    id: 'platba',
    title: 'Objednání a platba',
    text: `Služby mohou být hrazeny:
- předem online (rezervace s platbou nebo zálohou),
- nebo na místě dle zvoleného typu služby.

U vybraných služeb může být požadována **platba předem nebo záloha** jako potvrzení rezervace termínu.`,
  },
  {
    id: 'storno',
    title: 'Zrušení nebo změna termínu (storno podmínky)',
    text: `### Zrušení nebo změna termínu zdarma
Rezervovaný termín je možné **bezplatně zrušit nebo změnit**, pokud je tato skutečnost oznámena **nejpozději 24 hodin před začátkem objednané služby**.

Zrušení nebo změnu termínu lze provést:
- e-mailem: **{email}**
- telefonicky: **{telefon}**

### Zrušení méně než 24 hodin před termínem / nedostavení se
Pokud:
- je služba **uhrazena předem** (nebo byla složena záloha),
- klient **zruší termín méně než 24 hodin před jeho začátkem**, nebo
- se na objednaný termín **nedostaví** (tzv. no-show),

**zaniká nárok na vrácení uhrazené částky nebo zálohy**.

Uhrazená částka slouží jako **kompenzace rezervované kapacity, personálního zajištění a přípravy vyšetření**, které již nebylo možné obsadit jiným klientem.`,
  },
  {
    id: 'vyjimky',
    title: 'Výjimky – akutní onemocnění nebo závažné důvody',
    text: `V případě, že se klient nemůže dostavit z důvodu **akutního onemocnění nebo jiné závažné objektivní překážky**, může požádat o **individuální posouzení situace**.

Na základě individuálního posouzení může být nabídnuto zejména:
- **jednorázové bezplatné přeobjednání termínu**, nebo
- jiné řešení dle dohody.

Na toto řešení **nevzniká automatický právní nárok** a je posuzováno individuálně.`,
  },
  {
    id: 'nedokonceni',
    title: 'Nedokončení nebo částečné využití služby',
    text: `Pokud klient:
- z vlastní vůle službu **předčasně ukončí**, nebo
- nevyužije část objednané služby,

nevzniká automaticky nárok na vrácení poměrné části ceny, pokud není výslovně dohodnuto jinak.`,
  },
  {
    id: 'reklamace',
    title: 'Reklamace služeb',
    text: `V případě výhrad k průběhu nebo kvalitě poskytnuté služby nás prosím kontaktujte bez zbytečného odkladu na:
**{email}**

Reklamace jsou posuzovány individuálně s ohledem na povahu služby.`,
  },
  {
    id: 'odstoupeni',
    title: 'Právo spotřebitele na odstoupení od smlouvy',
    text: `U smluv uzavřených na dálku má spotřebitel obecně právo odstoupit od smlouvy do 14 dnů.
Toto právo se však **nevztahuje na služby poskytované na konkrétní termín** a na zdravotní služby v rozsahu stanoveném platnými právními předpisy.

Výše uvedené storno podmínky tím nejsou dotčeny.`,
  },
];

export const stornoSlots: SlotDef[] = textPageSlots({
  prefix: 'storno',
  page: 'Storno a reklamace',
  eyebrow: 'Platné pro poskytování služeb',
  title: 'Storno a reklamace',
  lead: 'Zásady vrácení peněz a storno podmínky.',
  sections: STORNO_SECTIONS,
});
