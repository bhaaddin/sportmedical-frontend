import type { SlotDef } from '../slotTypes';
import { mediaSlot, textSlot } from '../slotTypes';

/*
 * Slots of the page /web/kontakt (artboard V-Kontakt). The phone, e-mail, address and opening hours
 * come from the clinic's own settings (GET /api/public/clinic) and, when the clinic has none, from the
 * shared `site.footer.*` slots — they are NOT repeated here. These are the sentences around them.
 * Defaults are the clinic's published website (page /pages/contact and /policies/contact-information, checked
 * 2026-10-03). DIČ, bank account and data box have a label here and NO value: they appear only when the
 * clinic has entered them in its settings.
 */

const HERO = 'Kontakt › Úvod';
const CARDS = 'Kontakt › Telefon, e-mail, adresa';
const MAP = 'Kontakt › Mapa';
const WAY = 'Kontakt › Jak se k nám dostanete';
const HOURS = 'Kontakt › Otevírací doba';
const ASK = 'Kontakt › Dotaz a poptávka';
const BILL = 'Kontakt › Fakturační údaje';
const LINKS = 'Kontakt › Užitečné odkazy';

export const kontaktSlots: SlotDef[] = [
  textSlot('kontakt.hero.eyebrow', 'Úvod — nadpis nad titulkem', HERO, 'Klinika sportovní medicíny a diagnostiky'),
  textSlot('kontakt.hero.title', 'Úvod — titulek stránky', HERO, 'Kontakt'),
  textSlot(
    'kontakt.hero.lead',
    'Úvod — úvodní odstavec',
    HERO,
    'Objednejte se na vyšetření rychle a pohodlně prostřednictvím našeho online rezervačního systému, kde si můžete vybrat ze všech nabízených služeb.',
    { multiline: true },
  ),
  textSlot('kontakt.hero.cta.book', 'Úvod — hlavní tlačítko', HERO, 'Objednat termín'),
  textSlot('kontakt.hero.cta.prices', 'Úvod — druhé tlačítko', HERO, 'Ceník'),
  mediaSlot('kontakt.hero.photo', 'Úvod — foto', HERO, 'budova GreenLine zvenku', '1600 × 1000 px', '16 / 10'),

  textSlot('kontakt.phone.label', 'Telefon — štítek', CARDS, 'Telefon'),
  textSlot('kontakt.phone.note', 'Telefon — poznámka', CARDS, 'Provoz podle objednání'),
  textSlot('kontakt.email.label', 'E-mail — štítek', CARDS, 'E-mail'),
  textSlot('kontakt.address.label', 'Adresa — štítek', CARDS, 'Adresa'),
  textSlot('kontakt.address.note', 'Adresa — poznámka (zobrazí se, když adresa z nastavení kliniky nezmiňuje budovu)', CARDS, 'Budova GreenLine, 5. patro'),

  mediaSlot('kontakt.map.image', 'Mapa — obrázek (snímek mapy, volitelné)', MAP, 'Jihlavská 1558/21, Praha 4 — Michle', '1600 × 640 px', '5 / 2'),
  textSlot('kontakt.map.cta', 'Mapa — tlačítko (otevře Mapy.cz v novém okně)', MAP, 'Otevřít na Mapy.cz'),

  textSlot('kontakt.way.title', 'Jak se k nám dostanete — titulek sekce', WAY, 'Jak se k nám dostanete'),
  textSlot('kontakt.way.metro.title', 'Metro — název', WAY, 'Metro'),
  textSlot('kontakt.way.metro.text', 'Metro — popis', WAY, 'Stanice linky C Kačerov'),
  textSlot('kontakt.way.bus.title', 'Autobus — název', WAY, 'Autobus'),
  textSlot('kontakt.way.bus.text', 'Autobus — popis', WAY, 'Zastávky Lísek a Kačerov'),
  textSlot('kontakt.way.train.title', 'Vlak — název', WAY, 'Vlak'),
  textSlot('kontakt.way.train.text', 'Vlak — popis', WAY, 'Zastávka Praha-Kačerov'),
  textSlot('kontakt.way.car.title', 'Autem — název', WAY, 'Autem'),
  textSlot('kontakt.way.car.text', 'Autem — popis', WAY, 'Snadný přístup na hlavní tahy – Magistrálu a Jižní spojku'),
  textSlot('kontakt.way.building.title', 'V budově — název', WAY, 'V budově'),
  textSlot('kontakt.way.building.text', 'V budově — popis', WAY, 'Budova GreenLine (5. patro LM Clinic), stanice metra Kačerov'),

  textSlot('kontakt.hours.title', 'Otevírací doba — titulek sekce', HOURS, 'Otevírací doba'),
  textSlot('kontakt.hours.note', 'Otevírací doba — poznámka pod tabulkou', HOURS, 'Provozní doba: provoz podle objednání', { multiline: true }),

  textSlot('kontakt.ask.title', 'Dotaz — titulek', ASK, 'Máte dotaz?'),
  textSlot(
    'kontakt.ask.text',
    'Dotaz — text',
    ASK,
    'Zavolejte nebo napište. Termín na vyšetření si vyberete v našem online rezervačním systému.',
    { multiline: true },
  ),
  textSlot('kontakt.ask.cta.call', 'Dotaz — tlačítko „Zavolat“', ASK, 'Zavolat'),
  textSlot('kontakt.ask.cta.mail', 'Dotaz — tlačítko „Napsat“', ASK, 'Napsat e-mail'),
  textSlot('kontakt.ask.cta.clubs', 'Dotaz — odkaz pro kluby', ASK, 'Poptávka pro kluby'),

  textSlot('kontakt.billing.title', 'Fakturační údaje — titulek sekce', BILL, 'Fakturační údaje'),
  textSlot('kontakt.billing.name.label', 'Název — štítek', BILL, 'Název'),
  textSlot('kontakt.billing.name.value', 'Název — hodnota', BILL, 'SportMedical Diagnostics s.r.o.'),
  textSlot('kontakt.billing.ico.label', 'IČO — štítek', BILL, 'IČO'),
  textSlot('kontakt.billing.ico.value', 'IČO — hodnota', BILL, '23351632'),
  textSlot('kontakt.billing.seat.label', 'Sídlo — štítek', BILL, 'Sídlo'),
  textSlot('kontakt.billing.seat.value', 'Sídlo — hodnota', BILL, 'Krátká 283\n252 65 Tursko', { multiline: true }),
  textSlot('kontakt.billing.site.label', 'Provozovna — štítek', BILL, 'Adresa provozovny (místo poskytování zdravotních služeb)'),
  textSlot('kontakt.billing.site.value', 'Provozovna — hodnota', BILL, 'Budova GreenLine, 5. patro\nJihlavská 1558/21\n140 00 Praha 4 – Michle', { multiline: true }),
  textSlot('kontakt.billing.dic.label', 'DIČ — štítek (hodnota se bere z nastavení kliniky a zobrazí se, jen když je vyplněná)', BILL, 'DIČ'),
  textSlot('kontakt.billing.bank.label', 'Bankovní účet — štítek (hodnota z nastavení kliniky, zobrazí se, jen když je vyplněná)', BILL, 'Bankovní účet'),
  textSlot('kontakt.billing.databox.label', 'Datová schránka — štítek (hodnota z nastavení kliniky, zobrazí se, jen když je vyplněná)', BILL, 'Datová schránka'),

  textSlot('kontakt.links.title', 'Užitečné odkazy — titulek sekce', LINKS, 'Užitečné odkazy'),
  textSlot('kontakt.links.prices.title', 'Odkaz Ceník — název', LINKS, 'Přehled cen a služeb'),
  textSlot('kontakt.links.prices.text', 'Odkaz Ceník — popis', LINKS, 'Kompletní přehled poskytovaných služeb včetně aktuálních cen a popisu jednotlivých vyšetření.', { multiline: true }),
  textSlot('kontakt.links.documents.title', 'Odkaz Dokumenty — název', LINKS, 'Důležité dokumenty a pokyny k vyšetřením'),
  textSlot('kontakt.links.documents.text', 'Odkaz Dokumenty — popis', LINKS, 'Potřebné dokumenty ke sportovní lékařské prohlídce a informace k jednotlivým vyšetřením.', { multiline: true }),
  textSlot('kontakt.links.portal.title', 'Odkaz Portál — název', LINKS, 'Pacientská zóna'),
  textSlot('kontakt.links.portal.text', 'Odkaz Portál — popis', LINKS, 'Bezpečná komunikace s lékařem.', { multiline: true }),
  textSlot('kontakt.links.faq.title', 'Odkaz Časté otázky — název', LINKS, 'Často kladené otázky'),
  textSlot('kontakt.links.faq.text', 'Odkaz Časté otázky — popis', LINKS, 'Příprava na test, délka vyšetření, platnost posudku, diagnostika a InBody.', { multiline: true }),
  textSlot('kontakt.legal.title', 'Právní informace — nadpis řádku odkazů', LINKS, 'Právní informace'),
];
