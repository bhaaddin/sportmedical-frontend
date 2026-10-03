import type { SlotDef } from '../slotTypes';
import type { TextSection } from './textPage';
import { textPageSlots } from './textPage';

/*
 * Slots of the page /obchodni-podminky. The defaults are the live page "Podmínky služby"
 * (https://sportmedical-diagnostics.cz/policies/terms-of-service, captured 2026-10-03). That live text is
 * Shopify's generic e-shop template, and the capture is a condensed rendering of it: the section
 * structure and headings are exact, the body sentences are condensed. It does not fit a clinic that
 * sells appointment-based health services. It is shown as the live site shows it — NOT improved — and
 * it NEEDS A LEGAL REVIEW and a re-copy from the live page before it is relied on.
 */

export const PODMINKY_SECTIONS: readonly TextSection[] = [
  {
    id: 'prehled',
    title: 'Přehled',
    text: 'Vítejte v obchodě SportMedical Diagnostics s.r.o.! Výrazy „my", „nás" a „náš" označují obchod SportMedical Diagnostics s.r.o.. Obchod provozuje tento web a všechny související informace, obsah, funkce, nástroje, produkty a služby s cílem poskytnout zákazníkům přizpůsobený nákupní zážitek. SportMedical Diagnostics s.r.o. využívá službu Shopify. Níže uvedené Podmínky spolu se všemi zásadami, na které se zde odkazuje, popisují vaše práva a povinnosti při používání služeb. Pečlivě si přečtěte tyto Podmínky služby, protože obsahují důležité informace týkající se vašich zákonných práv. Návštěvou, interakcí nebo používáním našich služeb vyjadřujete svůj souhlas s těmito Podmínkami a našimi zásadami ochrany osobních údajů. Pokud nesouhlasíte, neměli byste naše Služby používat.',
  },
  {
    id: 's1',
    title: 'Oddíl 1 – Přístup a účet',
    text: 'Odsouhlasením těchto Podmínek potvrzujete, že jste dosáhli plnoletosti a že jste nám dali souhlas s tím, abychom umožnili nezletilým závislým osobám používat Služby. Chcete-li používat Služby, můžete být požádáni o poskytnutí určitých informací, například e-mailu nebo fakturačních a platebních údajů. Prohlašujete a zaručujete, že všechny informace, které uvedete, jsou správné, aktuální a úplné. Za bezpečnost svých přihlašovacích údajů k účtu a za všechny své aktivity na účtu nesete výhradní odpovědnost. Svůj účet nesmíte převést, prodat, postoupit ani poskytnout licenci jiné osobě.',
  },
  {
    id: 's2',
    title: 'Oddíl 2 – Naše produkty',
    text: 'Vynaložili jsme veškeré úsilí, aby se produkty zobrazily věrně. Barvy nebo vzhled se však mohou lišit v důsledku typu zařízení a jeho nastavení. Nezaručujeme, že vzhled nebo kvalita vámi zakoupených produktů bude odpovídat vašim očekáváním. Všechny popisy se mohou změnit bez předchozího upozornění. Vyhrazujeme si právo kdykoli ukončit prodej jakéhokoli produktu a omezit množství.',
  },
  {
    id: 's3',
    title: 'Oddíl 3 – Objednávky',
    text: 'Při zadávání objednávky činíte nabídku ke koupi. Obchod si vyhrazuje právo přijmout nebo odmítnout vaši objednávku z jakéhokoli důvodu. Objednávka není přijata, dokud obchod její přijetí nepotvrdí a obdrží vaši platbu. Před odesláním objednávky si ji pečlivě prohlédněte, protože po přijetí ji nemusíme moci zrušit. V případě nepřijetí se pokusíme vás informovat e-mailem, adresou nebo telefonicky. Vaše nákupy mohou být vráceny nebo vyměněny výhradně v souladu s našimi Zásadami vracení peněz. Prohlašujete a zaručujete, že vaše nákupy jsou určeny pro vaše osobní použití nebo použití v domácnosti, nikoli pro další prodej nebo vývoz.',
  },
  {
    id: 's4',
    title: 'Oddíl 4 – Ceny a fakturace',
    text: 'Ceny, slevy a propagační akce se mohou změnit bez předchozího upozornění. Cena účtovaná je cena platná v čase podání objednávky, uvedená v e-mailu s potvrzením. Pokud není uvedeno jinak, zveřejněné ceny nezahrnují daně, poštovné, manipulační nebo celní poplatky. Ceny se mohou lišit od cen v kamenných obchodech či v jiných online obchodech třetích stran. Čas od času můžeme nabízet propagační akce na Služby, které se řídí oddělenými podmínkami. Pokud dojde k rozporu, platí podmínky propagační akce. Souhlasíte s tím, že budete poskytovat aktuální, úplné a přesné informace o nákupu, platbě a účtu. Souhlasíte s bezodkladnou aktualizací údajů. Prohlašujete a zaručujete, že (i) údaje o kreditní kartě jsou pravdivé a úplné, (ii) jste oprávněni kartu použít, (iii) poplatky budou vydavatelem uznány a (iv) zaplatíte je.',
  },
  {
    id: 's5',
    title: 'Oddíl 5 – Doprava a doručení',
    text: 'Neneseme odpovědnost za zpoždění při dopravě a doručení. Všechny lhůty jsou odhadované a nejsou garantované. Nejsme zodpovědní za zpoždění způsobené přepravci, clem nebo vnějšími faktory. Po předání produktů přepravci přechází vlastnictví a riziko ztráty na vás.',
  },
  {
    id: 's6',
    title: 'Oddíl 6 – Duševní vlastnictví',
    text: 'Naše služby, včetně všech ochranných známek, textu, obrázků, grafiky, videa a zvuku a jejich vzoru, výběru a uspořádání, jsou vlastnictvím obchodu nebo jeho partnerů a jsou chráněny zákony o duševním vlastnictví. Tyto Podmínky vám umožňují používat Služby pouze pro osobní, nekomerční účely. Bez písemného souhlasu nesmíte reprodukovat, distribuovat, upravovat, veřejně vystavovat nebo přenášet jakýkoli materiál. Neoprávněné používání služeb může být porušením federálních a státních zákonů o duševním vlastnictví. Všechna nezmiňovaná práva si obchod vyhrazuje. Názvy, loga, názvy produktů a služeb, vzory a slogany obchodu jsou jeho ochrannými známkami. Tyto nesmíte používat bez písemného souhlasu.',
  },
  {
    id: 's7',
    title: 'Oddíl 7 – Volitelné nástroje',
    text: 'Můžete mít přístup k zákaznickým nástrojům nabízeným třetími stranami, které nesledujeme nebo nemáme pod kontrolou. Berete na vědomí a souhlasíte s tím, že poskytujeme přístup k těmto nástrojům „tak, jak jsou", bez záruk. Neneseme odpovědnost za jejich používání. Jakékoli použití volitelných nástrojů je zcela na vaše vlastní riziko a měli byste se seznámit s podmínkami externího poskytovatele. V budoucnu můžeme nabízet nové funkce, které se považují za součást Služeb.',
  },
  {
    id: 's8',
    title: 'Oddíl 8 – Odkazy třetích stran',
    text: 'Služby mohou obsahovat materiály a hypertextové odkazy na webové stránky třetích stran. Nejsme zodpovědní za zkoumání nebo hodnocení obsahu nebo správnosti těchto webů. Pokud se rozhodnete navštívit třetí strany, činíte tak na vlastní nebezpečí. Neneseme odpovědnost za jakoukoli škodu nebo újmu související s vaším přístupem na tyto webové stránky. Pečlivě si prostudujte zásady třetí strany a ujistěte se, že jim rozumíte. Stížnosti na produkty třetích stran směřujte přímo na ně.',
  },
  {
    id: 's9',
    title: 'Oddíl 9 – Vztah se společností Shopify',
    text: 'SportMedical Diagnostics s.r.o. je provozován na platformě Shopify. Veškeré prodeje probíhají přímo v obchodě, nikoli prostřednictvím Shopify. Používáním služeb berete na vědomí a souhlasíte s tím, že společnost Shopify nenese odpovědnost za jakýkoli aspekt prodeje či nákupu. Tímto výslovně zprošťujete společnost Shopify a její přidružené společnosti všech nároků.',
  },
  {
    id: 's10',
    title: 'Oddíl 10 – Zásady ochrany osobních údajů',
    text: 'Na všechny osobní údaje, které shromažďujeme prostřednictvím služeb, se vztahují naše Zásady ochrany osobních údajů. Hostitelem Služeb je Shopify, která shromažďuje a zpracovává osobní údaje o vašem přístupu. Informace budou předávány Shopify a třetím stranám, které se mohou nacházet v jiných zemích.',
  },
  {
    id: 's11',
    title: 'Oddíl 11 – Zpětná vazba',
    text: 'Pokud odešlete nápady, návrhy, recenze nebo jiný obsah, udělujete nám trvalou, celosvětovou, dále poskytovatelnou, bezplatnou licenci k jejich použití, reprodukci, úpravě a distribuci. Veškerá práva vyplývající z této licence můžeme využívat k provozu, vyhodnocení a zlepšování Služeb. Prohlašujete a zaručujete, že: (i) vlastníte veškerá potřebná práva k obsahu; (ii) zveřejnili jste veškeré kompenzace; a (iii) vaše zpětná vazba je v souladu s Podmínkami. Nejsme povinni zachovávat důvěrnost, vyplácet náhradu nebo reagovat. Můžeme monitorovat, upravovat nebo odstraňovat obsah, který považujeme za nevhodný. Souhlasíte s tím, že vaše zpětná vazba nebude porušovat žádná práva třetích stran.',
  },
  {
    id: 's12',
    title: 'Oddíl 12 – Chyby, nepřesnosti a opomenutí',
    text: 'Příležitostně se mohou objevit typografické chyby nebo nepřesnosti v popisech, cenách, promocích nebo dostupnosti. Vyhrazujeme si právo opravit jakékoli chyby a změnit informace bez upozornění.',
  },
  {
    id: 's13',
    title: 'Oddíl 13 – Zakázané způsoby použití',
    text: `Ke službám můžete přistupovat a používat je pouze pro zákonné účely. Nesmíte je používat přímo ani nepřímo:
- za nezákonným nebo zlovolným účelem
- k porušování mezinárodních nebo místních právních předpisů
- k porušování duševního vlastnictví
- k obtěžování nebo poškozování osob
- k předávání nepravdivých informací
- k odesílání reklam, spamu nebo řetězových dopisů
- k vydávání se za jinou osobu
- k omezování používání Služeb ostatními

Také souhlasíte s tím, že nebudete: (a) nahrávat nebo přenášet viry nebo škodlivý kód; (b) reprodukovat, duplikovat, kopírovat nebo prodávat Služby; (c) shromažďovat osobní údaje jiných osob; (d) rozesílat spam nebo phishing; (e) zasahovat do bezpečnostních prvků. Vyhrazujeme si právo kdykoli pozastavit, zakázat nebo zrušit váš účet bez upozornění, pokud porušíte Podmínky.`,
  },
  {
    id: 's14',
    title: 'Oddíl 14 – Ukončení',
    text: 'Tuto smlouvu nebo váš přístup ke službám můžeme kdykoli ukončit bez upozornění a vy musíte uhradit vše až do data ukončení. Určité oddíly zůstávají v platnosti po ukončení: Duševní vlastnictví, Zpětná vazba, Ukončení, Zřeknutí se záruk, Zřeknutí se odpovědnosti, Odškodnění a další.',
  },
  {
    id: 's15',
    title: 'Oddíl 15 – Zřeknutí se záruk',
    text: 'Informace prezentované ve službách jsou k dispozici pouze pro obecné informační účely. Nezaručujeme jejich přesnost či užitečnost. S VÝJIMKOU VÝSLOVNĚ UVEDENOU OBCHODEM, JSOU SLUŽBY poskytovány „BEZ JAKÝCHKOLIV PROHLÁŠENÍ, ZÁRUK A PODMÍNEK," včetně předpokládaných záruk prodejnosti nebo vhodnosti. NEZARUČUJEME, NEPROHLAŠUJEME ANI NERUČÍME ZA TO, ŽE POUŽÍVÁNÍ SLUŽEB BUDE NEPŘERUŠOVANÉ či bezchybné. Některé jurisdikce neumožňují odmítnutí záruk.',
  },
  {
    id: 's16',
    title: 'Oddíl 16 – Omezení odpovědnosti',
    text: 'V MAXIMÁLNÍM ROZSAHU STANOVENÉM ZÁKONEM NEBUDE OBCHOD ani Shopify V ŽÁDNÉM PŘÍPADĚ ODPOVĚDNÍ ZA JAKOUKOLI ÚJMU, ztrátu nebo nárok, ať už přímý či nepřímý. To zahrnuje ušlý zisk, ztrátu dat či následné škody vyplývající z používání Služeb nebo nákupů.',
  },
  {
    id: 's17',
    title: 'Oddíl 17 – Odškodnění',
    text: 'Souhlasíte s tím, že obchod a Shopify odškodníte, budete hájit a zbavíte odpovědnosti za ztráty, škody či nároky třetích stran. To zahrnuje nároky vyplývající z porušení Podmínek, porušení zákona nebo práv třetích stran. Budeme vás informovat o nároku. Můžeme vést obhajobu na vaše náklady. Budete spolupracovat na obraně.',
  },
  {
    id: 's18',
    title: 'Oddíl 18 – Oddělitelnost',
    text: 'Pokud bude některé ustanovení označeno za neplatné, bude takové ustanovení přesto vymahatelné v maximálním rozsahu povoleném zákonem a nevymahatelná část bude oddělena bez vlivu na ostatní.',
  },
  {
    id: 's19',
    title: 'Oddíl 19 – Zřeknutí se práva; úplná smlouva',
    text: 'Neuplatnění práva neznamená jeho zřeknutí. Tyto Podmínky služby a veškeré zásady na těchto stránkách představují úplnou smlouvu a ujednání mezi vámi a obchodem, nahrazující veškeré předchozí dohody. Jakékoli nejasnosti při výkladu nebude vykládáno v neprospěch strany, která je vypracovala.',
  },
  {
    id: 's20',
    title: 'Oddíl 20 – Postoupení',
    text: 'Bez našeho předchozího písemného souhlasu nesmíte delegovat, převádět ani postoupit tuto smlouvu. Tyto Podmínky a naše práva a povinnosti můžeme převést bez vašeho souhlasu.',
  },
  {
    id: 's21',
    title: 'Oddíl 21 – Rozhodné právo',
    text: 'Tyto Podmínky služby se řídí federálními a státními zákony jurisdikce, kde má obchod sídlo. Vy a obchod souhlasíte s místní příslušností těchto soudů.',
  },
  {
    id: 's22',
    title: 'Oddíl 22 – Nadpisy',
    text: 'Nadpisy jsou uvedeny pouze pro usnadnění a neovlivňují Podmínky.',
  },
  {
    id: 's23',
    title: 'Oddíl 23 – Změny podmínek služby',
    text: 'Aktuální verzi smluvních Podmínek si můžete kdykoli prohlédnout na této stránce. Vyhrazujeme si právo dle vlastního uvážení aktualizovat, měnit nebo nahradit Podmínky. Je vaší povinností pravidelně kontrolovat web na změny. Významné změny vám oznámíme. Vaše další používání služeb po zveřejnění změn znamená souhlas.',
  },
  {
    id: 's24',
    title: 'Oddíl 24 – Kontaktní údaje',
    text: 'Dotazy týkající se Podmínek služby zasílejte na: {email}',
  },
];

export const podminkySlots: SlotDef[] = textPageSlots({
  prefix: 'podminky',
  page: 'Obchodní podmínky',
  eyebrow: 'Právní informace',
  title: 'Obchodní podmínky',
  lead: 'Podmínky služby.',
  sections: PODMINKY_SECTIONS,
});
