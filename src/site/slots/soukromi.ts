import type { SlotDef } from '../slotTypes';
import type { TextSection } from './textPage';
import { textPageSlots } from './textPage';

/*
 * Slots of the page /ochrana-osobnich-udaju: the privacy notice of a health service provider.
 *
 * This is a BASIC TEXT written for the clinic, not a legal document approved by a lawyer: it must be
 * reviewed by the operator before regular operation (the admin-only note on the page says so, and so
 * does the Etapa 3 report). It replaces the generic e-shop template of the old Shopify site, which
 * claimed that data are sold to marketing partners — a statement that is false for a clinic and must
 * never come back. Nothing here is a settings value hard-coded for convenience: every sentence is an
 * editable slot in Nastavení → Média a texty. The phone, e-mail and address are never typed:
 * "{telefon}", "{email}" and "{adresa}" are filled from the clinic's own settings.
 */

export const SOUKROMI_SECTIONS: readonly TextSection[] = [
  {
    id: 'spravce',
    title: 'Kdo je správcem vašich údajů',
    text: `Správcem osobních údajů je **SportMedical Diagnostics s.r.o.**, IČO 23351632, se sídlem Krátká 283, 252 65 Tursko (dále jen „klinika“, „my“). Zdravotní služby poskytujeme na adrese {adresa}.

Tento dokument vysvětluje, jaké údaje o vás zpracováváme, proč, na jakém právním základě, jak dlouho je uchováváme, komu je předáváme a jaká máte práva. Vztahuje se na pacienty, na zájemce o objednání a na návštěvníky našeho webu.`,
  },
  {
    id: 'udaje',
    title: 'Jaké údaje zpracováváme',
    text: `### Identifikační a kontaktní údaje
Jméno a příjmení, datum narození, pohlaví, rodné číslo nebo číslo pojištěnce a zdravotní pojišťovna, adresa trvalého pobytu, telefon a e-mail. U nezletilých také údaje o zákonném zástupci.

### Zdravotní údaje
Údaje o vašem zdravotním stavu, které nám sdělíte nebo které vzniknou při vyšetření: zdravotní dotazník, výsledky a záznamy z vyšetření (například klidové a zátěžové EKG, spirometrie, spiroergometrie a VO₂max, měření složení těla InBody, sportovní diagnostika), lékařské zprávy a posudky o zdravotní způsobilosti ke sportu. Je to zdravotnická dokumentace.

### Údaje o objednání a platbě
Termín a druh služby, historie objednávek a změn, doklady o platbě a faktury.

### Údaje o komunikaci
Zprávy, které nám pošlete e-mailem, telefonem nebo přes formulář, a záznam o tom, jak jsme je vyřídili.

### Technické údaje
Při používání webu a pacientského portálu běžné provozní záznamy (například čas přístupu a IP adresa) nezbytné pro bezpečnost a provoz. Neprovozujeme reklamní ani sledovací soubory cookie.`,
  },
  {
    id: 'ucely',
    title: 'Proč údaje zpracováváme a na jakém právním základě',
    text: `- **Poskytování zdravotních služeb a vedení zdravotnické dokumentace.** Právním základem je plnění smlouvy o poskytnutí služby (čl. 6 odst. 1 písm. b) GDPR), splnění právní povinnosti (čl. 6 odst. 1 písm. c) GDPR, zejména zákon č. 372/2011 Sb., o zdravotních službách) a u zdravotních údajů poskytování zdravotní péče (čl. 9 odst. 2 písm. h) GDPR).
- **Objednávání, platba a účetnictví.** Plnění smlouvy a splnění právních povinností (účetní a daňové předpisy).
- **Komunikace s vámi** o objednaném termínu a o vaší žádosti. Plnění smlouvy, případně náš oprávněný zájem odpovědět na dotaz (čl. 6 odst. 1 písm. f) GDPR).
- **Bezpečnost systému, ochrana práv a řešení reklamací či sporů.** Náš oprávněný zájem a plnění právních povinností.
- **Předání výsledků vašemu klubu, trenérovi nebo jiné osobě.** Jen na základě vašeho výslovného souhlasu, který můžete kdykoli odvolat.

Neprovádíme automatizované rozhodování ani profilování, které by mělo právní účinky na vás.`,
  },
  {
    id: 'nepredavame',
    title: 'Neprodáváme a nepředáváme údaje k reklamě',
    text: `**Vaše osobní údaje neprodáváme a nepředáváme je obchodním ani marketingovým partnerům.** Nepoužíváme je k cílené reklamě a nezveřejňujeme je. Zdravotní údaje vidí jen osoby, které se na vaší péči podílejí, v rozsahu nezbytném pro jejich práci.`,
  },
  {
    id: 'prijemci',
    title: 'Komu údaje předáváme',
    text: `Údaje předáváme jen tam, kde to ukládá zákon nebo kde je to nezbytné pro provoz služby, a vždy v nejmenším nutném rozsahu:

- **Orgány a instituce, pokud to stanoví zákon:** například zdravotní pojišťovny, správní orgány, soudy, orgány činné v trestním řízení.
- **Vámi určené osoby:** klub, trenér nebo jiný lékař, jen s vaším souhlasem nebo na vaši žádost.
- **Zpracovatelé, kteří pro nás zajišťují provoz technického systému** a jsou vázáni smlouvou o zpracování údajů:
  - poskytovatel cloudového hostingu aplikace (Render),
  - poskytovatel hostingu veřejného webu (Vercel),
  - poskytovatel databázové služby, ve které je uložena evidence pacientů,
  - poskytovatel úložiště fotografií a videí veřejného webu (Cloudinary); neukládá žádné zdravotní ani osobní údaje pacientů,
  - poskytovatel e-mailových služeb, jakmile bude zapojeno odesílání zpráv.

Pokud některý poskytovatel sídlí nebo zpracovává údaje mimo Evropskou unii, předáváme údaje jen se zárukami požadovanými GDPR (rozhodnutí o odpovídající úrovni ochrany nebo standardní smluvní doložky).`,
  },
  {
    id: 'doba',
    title: 'Jak dlouho údaje uchováváme',
    text: `- **Zdravotnická dokumentace:** po dobu stanovenou právními předpisy, u naší dokumentace 10 let od poslední poskytnuté služby. Do té doby ji nelze na žádost vymazat, i když o to požádáte.
- **Účetní a daňové doklady:** po dobu stanovenou účetními a daňovými předpisy, obvykle 10 let.
- **Dotazy a komunikace, které nevedly k poskytnutí služby:** jen po dobu nezbytnou k vyřízení a ochraně našich práv.
- **Nedokončená rychlá registrace:** pokud ji nedokončíte v časovém limitu, rezervace se zruší a termín se uvolní. Údaje z ní již nepoužíváme k jinému účelu.
- **Technické záznamy:** po dobu nezbytnou pro bezpečnost a provoz systému.

Po uplynutí doby údaje bezpečně vymažeme nebo anonymizujeme.`,
  },
  {
    id: 'zabezpeceni',
    title: 'Jak údaje chráníme',
    text: `Přístup k údajům mají jen oprávněné osoby podle své role. Přenos údajů mezi vaším zařízením a naším systémem je šifrovaný, přístupy se zaznamenávají a citlivé identifikátory (například rodné číslo) se nezobrazují v provozních záznamech ani v chybových hlášeních. Při porušení zabezpečení, které by pro vás představovalo riziko, splníme ohlašovací povinnosti podle GDPR.`,
  },
  {
    id: 'prava',
    title: 'Vaše práva',
    text: `Podle GDPR máte právo:

- na **přístup** k údajům, které o vás zpracováváme, a na kopii,
- na **opravu** nepřesných nebo neúplných údajů,
- na **výmaz** údajů, pokud pominul důvod zpracování a nebrání tomu zákonná povinnost uchovávat dokumentaci,
- na **omezení** zpracování,
- na **přenositelnost** údajů, které jste nám poskytli, tam, kde se na ně právo vztahuje,
- vznést **námitku** proti zpracování založenému na našem oprávněném zájmu,
- kdykoli **odvolat souhlas**, který jste nám dali; odvolání nemá vliv na zákonnost zpracování před jeho odvoláním,
- podat **stížnost** u dozorového úřadu: Úřad pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7, www.uoou.gov.cz.

Nahlížet do své zdravotnické dokumentace a pořizovat si z ní kopie můžete také podle zákona o zdravotních službách. Žádost nám pošlete na níže uvedený kontakt. Abychom údaje nevydali nesprávné osobě, můžeme vás požádat o ověření totožnosti. Odpovíme bez zbytečného odkladu, nejpozději do jednoho měsíce.`,
  },
  {
    id: 'kontakt',
    title: 'Kontakt',
    text: `S otázkami k ochraně osobních údajů a s uplatněním svých práv se na nás obraťte telefonicky na {telefon}, e-mailem na {email} nebo na adrese {adresa}.

Tyto zásady můžeme aktualizovat. Aktuální znění je vždy na této stránce.

Poslední aktualizace: 3. října 2026`,
  },
];

export const soukromiSlots: SlotDef[] = textPageSlots({
  prefix: 'soukromi',
  page: 'Ochrana osobních údajů',
  eyebrow: 'Právní informace',
  title: 'Ochrana osobních údajů',
  lead: 'Jak klinika zpracovává osobní a zdravotní údaje pacientů, na jakém základě a jaká máte práva.',
  sections: SOUKROMI_SECTIONS,
});
