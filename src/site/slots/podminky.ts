import type { SlotDef } from '../slotTypes';
import type { TextSection } from './textPage';
import { textPageSlots } from './textPage';

/*
 * Slots of the page /obchodni-podminky: terms for the provision of health services (ordering,
 * payment, cancellation, complaints).
 *
 * This is a BASIC TEXT written for the clinic, not a legal document approved by a lawyer: it must be
 * reviewed by the operator before regular operation. It replaces the shortened Shopify e-shop terms
 * (shipping, returns, product orders) that do not describe a clinic. Cancellation conditions are
 * not repeated here: they are the clinic's own written terms on the page "Storno a reklamace", so the
 * two cannot disagree. Prices are never typed — the price list is the only source. Every sentence is
 * an editable slot in Nastavení → Média a texty; "{telefon}", "{email}" and "{adresa}" come from the
 * clinic's own settings.
 */

export const PODMINKY_SECTIONS: readonly TextSection[] = [
  {
    id: 'poskytovatel',
    title: 'Poskytovatel a rozsah podmínek',
    text: `Poskytovatelem služeb je **SportMedical Diagnostics s.r.o.**, IČO 23351632, se sídlem Krátká 283, 252 65 Tursko. Služby poskytujeme na adrese {adresa}.

Tyto podmínky upravují objednání, poskytnutí, platbu a reklamaci služeb kliniky: sportovních lékařských prohlídek, sportovní diagnostiky (včetně spiroergometrie a VO₂max) a měření složení těla InBody. Objednáním služby s nimi vyslovujete souhlas.`,
  },
  {
    id: 'povaha',
    title: 'Povaha služeb',
    text: `Poskytujeme zdravotní a sportovně-diagnostické služby výhradně **na základě předchozí objednávky na konkrétní termín**. Nejde o prodej zboží: nic nezasíláme ani nedoručujeme. Výsledkem služby je vyšetření a podle jeho druhu lékařský posudek, zpráva nebo vyhodnocení měření.`,
  },
  {
    id: 'objednani',
    title: 'Objednání termínu',
    text: `Termín si můžete objednat online na našem webu, telefonicky na {telefon} nebo e-mailem na {email}. Objednávka je závazná, jakmile vám termín potvrdíme, nebo jakmile se vám zobrazí potvrzení rezervace.

- Při online objednání vás systém může požádat o dokončení registrace přes odkaz. Odkaz platí po omezenou dobu uvedenou u rezervace. Nedokončenou registraci a rezervaci po uplynutí této doby zrušíme a termín se uvolní pro další zájemce.
- Při objednání uvádějte pravdivé a úplné údaje. Za nesprávné údaje, které způsobí, že službu nelze poskytnout, neneseme odpovědnost.
- Termín můžeme výjimečně změnit nebo zrušit z provozních nebo zdravotních důvodů na naší straně. Domluvíme s vámi náhradní termín, případně vrátíme uhrazenou částku.`,
  },
  {
    id: 'priprava',
    title: 'Příprava a dokumenty',
    text: `Před vyšetřením vás informujeme o přípravě (například o jídle, oblečení nebo lécích) a o dokumentech, které je třeba přinést nebo vyplnit. Aktuální přehled najdete na stránce **Dokumenty** a v pokynech k objednanému termínu. Nesplnění přípravy nebo chybějící dokument může znamenat, že vyšetření nebude možné provést nebo dokončit.

Zdravotní dotazník a souhlas s poskytnutím zdravotních služeb vyplňujete pravdivě. Bez souhlasu s vyšetřením jej nelze provést. Souhlas můžete před vyšetřením i během něj odmítnout nebo odvolat.`,
  },
  {
    id: 'cena',
    title: 'Ceny a platba',
    text: `Cena služby je uvedena v **ceníku** na našem webu a platí v den objednání. Ceník je jediným závazným zdrojem cen; zobrazuje i případné skupinové slevy.

Platba probíhá podle zvoleného typu služby předem online, nebo na místě. U vybraných služeb můžeme požadovat platbu předem nebo zálohu jako potvrzení rezervace. Na požádání vystavíme fakturu na osobu nebo firmu. Doklad o platbě vám vydáme vždy.`,
  },
  {
    id: 'storno',
    title: 'Zrušení a změna termínu',
    text: `Podmínky zrušení nebo změny termínu, nedostavení se a náhradní termíny při onemocnění jsou na stránce **Storno a reklamace**. Jsou součástí těchto podmínek.`,
  },
  {
    id: 'pacient',
    title: 'Povinnosti pacienta',
    text: `Dostavte se včas a s doklady, které jsme vás požádali přinést. Při vyšetření dodržujte pokyny zdravotnického personálu. Informujte nás o změnách zdravotního stavu a o užívaných lécích, které mohou ovlivnit vyšetření. Pokud se necítíte zdráv nebo máte akutní potíže, termín včas zrušte; viz Storno a reklamace.`,
  },
  {
    id: 'reklamace',
    title: 'Reklamace a stížnosti',
    text: `Pokud jste se službou nebyli spokojeni nebo se domníváte, že nebyla poskytnuta řádně, napište nám na {email} nebo zavolejte na {telefon}. Uveďte jméno, datum služby a čeho se reklamace týká. Reklamaci vyřídíme bez zbytečného odkladu, nejpozději do 30 dnů.

Dále je podrobnější postup v části **Storno a reklamace**. Nevyřešíme-li spor s vámi jako spotřebitelem k vaší spokojenosti, můžete se obrátit na subjekt mimosoudního řešení spotřebitelských sporů, kterým je Česká obchodní inspekce (www.coi.cz). Právo obrátit se na soud tím není dotčeno.`,
  },
  {
    id: 'udaje',
    title: 'Ochrana osobních údajů',
    text: `Údaje o vás zpracováváme podle zásad uvedených na stránce **Ochrana osobních údajů**. Údaje pacientů neprodáváme ani nepředáváme obchodním nebo marketingovým partnerům.`,
  },
  {
    id: 'zaverecna',
    title: 'Závěrečná ustanovení',
    text: `Tyto podmínky se řídí právem České republiky. Dojde-li ke sporu, příslušný je soud podle obecných předpisů. Podmínky můžeme změnit; pro objednanou službu platí znění účinné v den objednání. Aktuální znění je vždy na této stránce.

Máte-li dotaz, napište nám na {email}.

Poslední aktualizace: 3. října 2026`,
  },
];

export const podminkySlots: SlotDef[] = textPageSlots({
  prefix: 'podminky',
  page: 'Obchodní podmínky',
  eyebrow: 'Právní informace',
  title: 'Obchodní podmínky',
  lead: 'Podmínky poskytování zdravotních služeb: objednání, platba, zrušení a reklamace.',
  sections: PODMINKY_SECTIONS,
});
