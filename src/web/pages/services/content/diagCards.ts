/* ══════════════════════════════════════════════════════════════
   THE PRICE CARDS OF SPORTOVNÍ DIAGNOSTIKA AND OF THE COMBINED PACKAGES

   Wording: the live site (sportmedical-diagnostics.cz/pages/sportovni-diagnostika, "Ceník služeb –
   sportovní diagnostika" and the "Zvýhodněné balíčky" cards of the examinations page), copied as
   published; Slovak leaks and obvious typos corrected (see the report). NO AMOUNT is in here: each
   card finds its price-list row by the NAME of the service (`match`).
   Used by /diagnostika (all of them), /prohlidky (the four packages with an examination) and by
   the four detail pages (the card of their own service).
   ══════════════════════════════════════════════════════════════ */

import { PART } from './cards';
import type { CardDef, LineLibrary } from './cards';

/** Slot prefixes: `diagnostika.card.<id>.*` and `diagnostika.line.<id>.*`. */
export const DIAG_CARD_PREFIX = 'diagnostika.card';
export const DIAG_LINE_PREFIX = 'diagnostika.line';

const PLAN_NOT_INCLUDED =
  'Není součástí tohoto balíčku. Službu je však možné samostatně objednat v ceníku. Zahrnuje detailně zpracovaný video-instruovaný kompenzační program s instruktážními videi, počty sérií, opakování a přesnými doporučeními pro správné provedení cviků.';
const APP_NOT_INCLUDED =
  'Tato služba není součástí tohoto balíčku. Společně s video-instruovaným kompenzačním plánem ji lze vybrat a objednat jako samostatnou službu v ceníku. Umožňuje doručení individuálního kompenzačního plánu přímo do mobilní aplikace, včetně přehledného přístupu k videím a průběžnému sledování pokroku.';

const VO2MAX_TEXT =
  'VO₂max test je zlatým standardem v hodnocení fyzické výkonnosti a aerobní kapacity a nabízí přesné a vědecky podložené měření skutečného maxima, kterého je vaše tělo schopné dosáhnout při zátěži. Test sleduje množství kyslíku, které organismus dokáže efektivně využít při postupně se zvyšující intenzitě, což je klíčový ukazatel trénovanosti, vytrvalosti a celkového metabolického zdraví. Nejde jen o číslo – VO₂max vypovídá o schopnosti transportu a využití kyslíku, efektivitě kardiovaskulárního systému i o výkonových rezervách, na kterých lze dále stavět. Je to nástroj pro sportovce, kteří chtějí objektivně poznat své limity, i pro jednotlivce, kteří chtějí cíleně zlepšit kondici a sledovat odezvu těla na trénink. Tento typ zátěžového testu poskytuje jasný obraz o tom, kde se právě nacházíte – a kam se můžete posunout. VO₂max test není jen pro profesionály – je pro každého, kdo to myslí vážně.';

export const DIAG_LINES: LineLibrary = {
  // Základní / Komplexní diagnostika
  tests: {
    name: 'Přesně definované testy, přizpůsobené sportovní specializaci pro maximální přesnost diagnostiky',
    text: 'Diagnostické testy jsou vždy voleny individuálně podle typu sportu a jeho specifických nároků na pohybový aparát. Každý test je pečlivě zvolen tak, aby přesně hodnotil klíčové pohybové vzorce, stabilitu, kontrolu segmentů, rotaci či dynamiku pohybu odpovídající dané sportovní specializaci. Tento přístup zajišťuje maximální přesnost diagnostiky, vysokou relevanci výsledků a umožňuje cílené nastavení kompenzačních či tréninkových doporučení.',
  },
  overview: {
    name: 'Výsledkový přehled s odborným vysvětlením jednotlivých testů',
    text: 'Klient obdrží kompletní přehled všech naměřených hodnot ze všech provedených diagnostických testů. Součástí výstupní zprávy je také srozumitelné odborné vysvětlení všech sledovaných metrik, díky kterému klient porozumí tomu, co jednotlivé parametry vyjadřují, proč jsou důležité a jak souvisejí s výkonem, stabilitou, efektivitou pohybu i prevencí zranění. Výsledkem není pouze soubor naměřených hodnot, ale komplexní interpretace, která umožňuje jejich správné pochopení a efektivní využití při tréninku, kompenzaci i rehabilitaci.',
  },
  report: {
    name: 'Detailně zpracovaná výstupní zpráva s hodnocením všech metrik podle norem a odborným doporučením',
    text: 'Výstupní zpráva poskytuje komplexní přehled o všech sledovaných metrikách. Všechny parametry jsou hodnoceny podle věkových a sportovních norem, od odrazové síly přes rychlost reakce až po stabilitu a tlumení dopadu. Každá metrika je detailně vyhodnocena s uvedením, zda se nachází v normě, hraničním pásmu či mimo normu. Součástí zprávy je i odborné doporučení zaměřené na optimalizaci výkonu, korekci zjištěných nerovnováh a prevenci přetížení nebo zranění.',
  },
  inbody: {
    name: 'InBody 770 – základní tělesná analýza zahrnutá v ceně',
    text: 'Součástí služby je základní měření na přístroji InBody 770, které poskytuje detailní přehled o složení těla – podílu svalové hmoty, tělesného tuku, vody i rovnováze mezi jednotlivými segmenty. Tato analýza doplňuje silově-dynamickou diagnostiku o důležité informace o tělesné kompozici, které pomáhají přesněji interpretovat výkonové výsledky a identifikovat případné disproporce.',
  },
  video: {
    name: 'Komplexní video-biomechanická analýza všech fází pohybu propojená s naměřenými daty',
    text: 'Zahrnuje synchronizovanou video-biomechanickou analýzu všech fází pohybu propojenou s objektivními naměřenými daty. Umožňuje přesně identifikovat kompenzační mechanismy, technické nedostatky, nesprávné pohybové vzorce i příčiny zjištěných asymetrií a dalších odchylek.',
  },
  'x-vo2': {
    name: 'Vo2max',
    text: 'Diagnostické vyšetření metabolických plynů není součástí tohoto balíčku. Je nutné buď zvolit v ceníku samostatnou VO₂max diagnostiku, nebo vybrat balíček Komplexní sportovní diagnostika s VO₂max.',
  },
  'x-plan': { name: 'Videoinstruovaný kompenzační plán na míru', text: PLAN_NOT_INCLUDED },
  'x-app': { name: 'Odeslání kompenzačního plánu přímo do mobilní aplikace', text: APP_NOT_INCLUDED },

  // Vo2max
  'v-test': {
    name: 'Test prováděný na běhátku nebo ergometru podle typu sportu',
    text: 'Typ zátěžového testu je volen individuálně podle sportovní specializace – pro běžecké disciplíny se využívá běhátko, pro cyklisty nebo silové sportovce ergometr. Během testu je zaznamenávána kardiovaskulární, respirační a metabolická odezva organismu na postupně rostoucí zátěž. Tento přístup umožňuje objektivně stanovit úroveň aerobní kapacity, vytrvalostní výkonnost a schopnost organismu hospodařit s kyslíkem v reálných podmínkách sportovního zatížení.',
  },
  'v-vent': {
    name: 'Ventilace plic a výměny plynů (VO₂ a VCO₂)',
    text: 'V reálném čase se sleduje ventilace plic a výměna plynů – tedy množství kyslíku, které organismus při zátěži využívá (VO₂), a množství oxidu uhličitého, které vydýchává (VCO₂). Tato analýza umožňuje přesně zhodnotit, jak efektivně tělo dýchá, přijímá kyslík a odvádí odpadní plyny, a tím ukazuje, jak jsou plíce a svaly schopny spolupracovat při fyzické zátěži. Výsledky poskytují podrobný přehled o dechové ekonomice, ventilačních limitech a metabolické účinnosti, což pomáhá určit, kdy se organismus přepíná z aerobního do anaerobního režimu. Díky tomu lze přesně stanovit aerobní a anaerobní prahy, vyhodnotit úroveň kondice a optimalizovat tréninkové zatížení.',
  },
  'v-max': {
    name: 'Maximální spotřeba kyslíku (VO₂max)',
    text: VO2MAX_TEXT,
  },
  'v-thr': {
    name: 'Ventilační a metabolické prahy (aerobní a anaerobní)',
    text: 'Přesné stanovení aerobního (VT1) a anaerobního (VT2) prahu, tedy okamžiků, kdy organismus přechází z převážně aerobního do anaerobního způsobu tvorby energie. Při nižší intenzitě zátěže svaly využívají kyslík k efektivnímu spalování tuků a sacharidů, tělo pracuje úsporně, stabilně a bez hromadění únavových látek. S rostoucí intenzitou však přísun kyslíku přestává stačit pokrýt rostoucí energetické nároky a organismus začne část energie vytvářet bez přítomnosti kyslíku (anaerobně). V této fázi se zvyšuje tvorba laktátu, který se hromadí ve svalech, narušuje jejich acidobazickou rovnováhu a postupně omezuje schopnost udržet výkon. Vyhodnocením ventilačních a metabolických křivek (VO₂, VCO₂, ventilace, respirační kvocient) lékař přesně určí, v jakých tepových a výkonových zónách tělo funguje nejefektivněji, a kdy už dochází k přetížení nebo ztrátě ekonomiky pohybu.',
  },
  'v-rq': {
    name: 'Respirační kvocient (RQ)',
    text: 'Respirační kvocient (RQ) vyjadřuje poměr mezi množstvím vydýchaného oxidu uhličitého (VCO₂) a spotřebovaného kyslíku (VO₂). Ukazuje, z jakých zdrojů tělo při zátěži čerpá energii – zda převážně z tuků nebo sacharidů. Při nižší intenzitě výkonu je RQ nižší, což znamená, že organismus spaluje hlavně tuky za dostatečného přísunu kyslíku. S rostoucí zátěží se hodnota RQ zvyšuje, protože tělo přechází na rychlejší, ale méně efektivní využívání sacharidů. Při velmi vysoké intenzitě, kdy kyslík už nestačí, se RQ blíží hodnotě 1,0 – v této fázi převažuje anaerobní metabolismus a dochází ke zvýšené tvorbě laktátu. Měření RQ poskytuje lékaři přesný přehled o energetickém metabolismu, dýchací účinnosti a schopnosti organismu přizpůsobit se zátěži, což umožňuje stanovit optimální intenzitu tréninku a rozvíjet vytrvalost i výkon.',
  },
  'v-o2hr': {
    name: 'O₂/HR – kyslíkový puls',
    text: 'Kyslíkový puls (O₂/HR) udává, kolik kyslíku organismus využije při jednom srdečním stahu. Tento parametr kombinuje údaje o spotřebě kyslíku (VO₂) a srdeční frekvenci (HR) a představuje tak ukazatel efektivity srdečně-cévního systému. Vyšší hodnota O₂/HR znamená, že srdce dokáže při každém úderu dopravit do svalů více kyslíku, což svědčí o dobré výkonnosti a účinném srdečním výdeji. Naopak nižší hodnoty mohou signalizovat omezenou srdeční kapacitu, nedostatečnou adaptaci na zátěž nebo sníženou schopnost transportu kyslíku. Sledování kyslíkového pulsu během zátěže umožňuje lékaři posoudit, jak se srdeční činnost přizpůsobuje rostoucí intenzitě výkonu, a spolu s hodnotami VO₂max a ventilačními prahy tak tvoří důležitý ukazatel kardiovaskulární účinnosti a tréninkové adaptace.',
  },
  'v-report': {
    name: 'Detailně zpracovaná výstupní zpráva s doporučením',
    text: 'Výstupní zpráva obsahuje podrobné vyhodnocení všech naměřených dat včetně ventilace, spotřeby kyslíku (VO₂), výdeje oxidu uhličitého (VCO₂) a stanovení aerobního i anaerobního prahu. Na základě těchto hodnot jsou přesně určeny tréninkové zóny a úrovně zátěže, při kterých organismus efektivně hospodaří s energií. Součástí zprávy je i odborné doporučení pro řízení tréninku, regeneraci a optimalizaci výkonnosti v souladu s individuální fyziologií sportovce.',
  },
  'x-ekg': {
    name: 'Klidové a zátěžové EKG',
    text: 'Klidové a zátěžové EKG představují medicínskou součást tělovýchovného a zátěžového vyšetření, nikoliv běžnou sportovní diagnostickou službu. Pokud potřebujete i tato měření, zvolte službu Spiroergometrické vyšetření, kterou naleznete v sekci Zátěžové testy.',
  },
  'x-diag': {
    name: 'Základní, komplexní diagnostika',
    text: 'Tato služba je zaměřena výhradně na analýzu VO₂max a dalších parametrů získaných z měření metabolických plynů. Nezahrnuje základní ani komplexní sportovní diagnostiku zaměřenou na hodnocení síly, explozivity, stability, asymetrií a kvality pohybu. VO₂max diagnostiku lze objednat buď samostatně, nebo ji zvolit jako součást podrobnějšího vyšetření v rámci balíčku Komplexní sportovní diagnostika s VO₂max, který propojuje obě vyšetření do jednoho uceleného diagnostického programu.',
  },

  // Kompenzační plán
  'p-video': {
    name: 'Videoinstruktáž každého cviku s přesným popisem klíčových bodů provedení',
    text: 'Každý cvik v plánu je doplněn o profesionální videoinstruktáž a popis, který vysvětluje klíčové body pohybu, techniky a způsobu provedení cviku. Instruktáž zdůrazňuje správnou biomechaniku pohybu s cílem zajistit, aby bylo provedení přesné, efektivní a v souladu s cíleným kompenzačním účinkem. Díky tomu klient přesně rozumí tomu, jak cvik provádět správně a jak dosáhnout maximálního efektu bez rizika chybného zatížení.',
  },
  'p-struct': {
    name: 'Přesná struktura plánu – série, opakování, pauzy i kombinace cviků (supersérie)',
    text: 'Každý kompenzační plán je detailně rozpracován do přesné struktury, která zahrnuje počet sérií, opakování, čas provádění jednotlivých cviků, délku odpočinku mezi sériemi i mezi jednotlivými cviky. Součástí mohou být také kombinace více cviků do supersérií pro zvýšení efektivity a plynulosti cvičení. Takto nastavený systém umožňuje kontrolovat intenzitu, objem a načasování zátěže a zaručuje, že každý trénink probíhá v optimálním rytmu a s maximální účinností. Díky tomu má klient jasně daný plán i strukturu, podle které může bezpečně a efektivně cvičit bez nutnosti dalšího dohledávání informací.',
  },
  'p-focus': {
    name: 'Zaměření na kompenzaci, stabilitu a prevenci přetížení',
    text: 'Cvičení v plánu jsou cíleně navržena tak, aby vyrovnávala zjištěné svalové a pohybové dysbalance, zlepšovala stabilitu, koordinaci a kontrolu pohybu. Hlavním cílem je obnovit funkční rovnováhu pohybového aparátu, snížit nadměrné zatížení jednotlivých struktur a předcházet přetížení či opakovaným zraněním. Tento přístup podporuje nejen kompenzaci oslabených segmentů, ale také dlouhodobou udržitelnost výkonu a správné pohybové návyky.',
  },
  'p-custom': {
    name: 'Plně personalizovaný plán podle dostupných pomůcek a vybavení',
    text: 'Každý kompenzační plán je sestaven s ohledem na reálné možnosti klienta a dostupnost tréninkových pomůcek. Plány máme připravené ve verzích pro cvičení s gumami, BOSU, jednoručkami, stroji i s vlastní vahou, takže vždy přesně odpovídají vybavení, které má klient k dispozici. Díky tomu lze plán okamžitě aplikovat v domácím prostředí, posilovně i klubovém tréninku – bez potřeby jakéhokoli dalšího přizpůsobování nebo improvizace.',
  },
  'p-freq': {
    name: 'Optimalizace tréninkové frekvence a týdenního rozvrhu jednotek',
    text: 'Frekvence tréninkových jednotek je přesně stanovena na základě diagnostických výsledků a individuálních potřeb klienta. Určuje, kolikrát týdně má být kompenzační plán absolvován, aby bylo dosaženo optimálního efektu. Podle potřeby může být režim nastaven buď na konkrétní dny v týdnu, nebo jako volnější s libovolným rozložením podle časových možností klienta. Frekvence zároveň zohledňuje tréninkový režim, fázi regenerace i závodní období, aby byl plán maximálně funkční a dlouhodobě udržitelný. Tento systém zajišťuje rovnoměrné zatížení, dostatečný prostor pro regeneraci a optimální kontinuitu kompenzačního procesu.',
  },
  'p-app': {
    name: 'Odeslání kompenzačního plánu přímo do mobilní aplikace',
    text: 'Hotový kompenzační plán je odeslán přímo do mobilní aplikace, kde klient vidí kompletní videoinstruovaný program včetně popisů všech cviků, technických bodů a doporučení pro provedení. Každý cvik je doplněn o video i textový návod, takže klient přesně ví, jak cvičit, v jakém pořadí a s jakou intenzitou. Díky tomu může svůj kompenzační plán realizovat kdykoliv a kdekoliv, bez nutnosti papírových materiálů nebo složitého vyhledávání jednotlivých cviků.',
  },
  'p-valid': {
    name: 'Platnost plánu: 3 měsíce, následně doporučujeme kontrolní retest',
    text: 'Každý kompenzační plán je koncipován na období tří měsíců, což představuje optimální dobu, během které se mohou projevit fyziologické změny a reálný progres. Po této době doporučujeme provést kontrolní retest, který umožní vyhodnotit dosažené výsledky, zhodnotit efektivitu plánu a případně upravit jeho strukturu podle aktuálního stavu klienta. Tento cyklus zajišťuje, že kompenzační proces zůstává přesný, cílený a dlouhodobě efektivní.',
  },

  // Balíčky
  zdfull: { name: 'Základní diagnostika – plný diagnostický rozsah', text: 'Služba je poskytována v plném diagnostickém rozsahu odpovídajícím standardu základní diagnostiky.' },
  kdfull: { name: 'Komplexní diagnostika – plný diagnostický rozsah', text: 'Služba je poskytována v plném diagnostickém rozsahu odpovídajícím standardu komplexní diagnostiky.' },
  kpfull: { name: 'Komplexní sportovní prohlídka – plný diagnostický rozsah', text: 'Služba je poskytována v plném diagnostickém rozsahu odpovídajícím standardu komplexní sportovní prohlídky.' },
  spfull: { name: 'Spiroergometrické vyšetření – plný diagnostický rozsah', text: 'Služba je poskytována v plném diagnostickém rozsahu, který plně odpovídá standardu spiroergometrického vyšetření.' },
  vo2full: {
    name: 'Vo2max – plný diagnostický rozsah',
    text: 'Komplexní analýza výměny dýchacích plynů umožňující stanovení VO₂max, ventilačních prahů, individuálních tréninkových zón, energetického metabolismu a dalších klíčových ukazatelů aerobní výkonnosti a reakce organismu na zátěž.',
  },
  vo2in: { name: 'Vo2max analýza', text: VO2MAX_TEXT },
  ekg: {
    name: 'Klidové a zátěžové EKG a krevní tlaky',
    text: 'Součástí služby je kompletní měření srdeční činnosti a krevního tlaku v klidu i při fyzické zátěži. Tato část vyšetření umožňuje sledovat reakci kardiovaskulárního systému na zátěž, posoudit adaptaci srdce, krevního oběhu a regulaci tlaku během výkonu. Získaná data poskytují lékaři přesný přehled o funkční kapacitě srdce, úrovni trénovanosti a bezpečnosti sportovní zátěže.',
  },
  'x-vo2pkg': { name: 'Vo2max analýza', text: 'Diagnostické vyšetření metabolických plynů není součástí tohoto balíčku. Pokud jej požadujete, je nutné zvolit jiný balíček.' },
  'x-video': {
    name: 'NEZAHRNUJE komplexní video-biomechanickou analýzu',
    text: 'Nezahrnuje komplexní video-analýzu, identifikaci kompenzačních mechanismů, technických nedostatků a nesprávných pohybových vzorců. Pokud jej požadujete, je nutné zvolit jiný balíček.',
  },
  'x-video2': {
    name: 'NEZAHRNUJE komplexní video-biomechanickou analýzu',
    text: 'Nezahrnuje komplexní video-analýzu, identifikaci kompenzačních mechanismů, technických nedostatků a nesprávných pohybových vzorců. Nutné zvolit balíček Komplexní diagnostika + spiroergometrické vyšetření.',
  },
};

export const DIAG_CARDS: readonly CardDef[] = [
  {
    id: 'zd',
    title: 'Základní diagnostika',
    intro:
      'Základní vyšetření zaměřené na hodnocení síly, explozivity, výkonu, stability, koordinace, asymetrií mezi končetinami, kvality pohybu, kontroly odrazu a dopadu, neuromuskulární výkonnosti a klíčových ukazatelů ovlivňujících sportovní výkon. Základní hodnocení ovlivňující sportovní výkon, prevenci zranění i bezpečný návrat ke sportu po úrazu. Nezahrnuje komplexní video-analýzu jednotlivých fází pohybu.',
    note:
      'NEZAHRNUJE komplexní video-biomechanickou analýzu všech fází pohybu propojenou s naměřenými daty. Nezahrnuje komplexní video-analýzu, identifikaci kompenzačních mechanismů, technických nedostatků a nesprávných pohybových vzorců. Nutné zvolit Komplexní diagnostiku.',
    match: { single: /^zakladni diagnostika/ },
    inc: ['tests', 'overview', 'report', 'inbody'],
    exc: ['x-vo2', 'x-plan', 'x-app'],
  },
  {
    id: 'kd',
    title: 'Komplexní diagnostika',
    badge: true,
    intro:
      'Komplexní vyšetření zaměřené na hodnocení síly, explozivity, výkonu, stability, koordinace, asymetrií mezi končetinami, kvality pohybu, kontroly odrazu a dopadu, neuromuskulární výkonnosti a klíčových ukazatelů ovlivňujících sportovní výkon. Díky synchronizovanému videozáznamu propojenému s naměřenými daty získává vyšetření skutečně komplexní charakter. Umožňuje přesně zobrazit, co se děje v každém okamžiku pohybu, a současně vysvětlit, proč byly naměřeny konkrétní hodnoty. Díky propojení objektivních dat s obrazem lze detailně analyzovat techniku provedení, práci jednotlivých segmentů těla, vznik asymetrií, kompenzačních mechanismů i biomechanických nedostatků. Výsledky tak nejsou pouze souborem čísel, ale získávají jasný vizuální kontext, který umožňuje přesně pochopit příčinu zjištěných odchylek a navrhnout cílenou korekci pohybu.',
    match: { single: /^komplexni diagnostika/ },
    inc: ['video', 'tests', 'overview', 'report', 'inbody'],
    exc: ['x-vo2', 'x-plan', 'x-app'],
  },
  {
    id: 'kd-vo2',
    title: 'Komplexní diagnostika + Vo2max analýza',
    badge: true,
    match: { combo: [PART.komplexniDiagnostika, PART.vo2max] },
    inc: ['kdfull', 'video', 'vo2full', 'inbody'],
    exc: ['x-plan', 'x-app'],
  },
  {
    id: 'vo2max',
    title: 'Vo2max',
    intro:
      'Vyšetření sleduje kompletní metabolickou odezvu organismu na fyzickou zátěž prostřednictvím měření spotřeby kyslíku (VO₂), výdeje oxidu uhličitého (VCO₂), ventilace plic a respiračního kvocientu (RQ). Analýza umožňuje přesné určení aerobního a anaerobního prahu (VT1, VT2), hodnocení efektivity využívání energie z tuků a sacharidů a stanovení maximální spotřeby kyslíku (VO₂max) – klíčového ukazatele kardiorespirační zdatnosti. Na základě těchto dat lze přesně určit individuální výkonnostní zóny, optimalizovat tréninkový proces a sledovat změny výkonnosti v čase.',
    match: { single: /^vo2max/ },
    inc: ['v-test', 'v-vent', 'v-max', 'v-thr', 'v-rq', 'v-o2hr', 'v-report'],
    exc: ['x-ekg', 'x-diag'],
  },
  {
    id: 'plan',
    title: 'Sestavení individuálního videoinstruovaného kompenzačního plánu',
    badge: true,
    intro:
      'Personalizovaný plán vycházející z naměřených diagnostických dat. Kompenzační plán je sestaven na základě konkrétních výsledků z diagnostiky HumanTrak, ForceDecks nebo VO₂max, čímž přesně reaguje na zjištěné svalové dysbalance, asymetrie, funkční omezení nebo přetížení. Každý plán je proto zcela individuální, respektuje sportovní specializaci, úroveň zátěže i aktuální stav pohybového aparátu. Cílem je vytvořit efektivní program, který navazuje na diagnostické výstupy a podporuje rovnováhu, výkon i dlouhodobou prevenci zranění.',
    match: { single: /kompenza\w* plan/ },
    inc: ['p-video', 'p-struct', 'p-focus', 'p-custom', 'p-freq', 'p-app', 'p-valid'],
    exc: [],
    cta: 'phone',
  },
  // Packages with an examination (also drawn on /prohlidky)
  {
    id: 'kp-zd',
    title: 'Komplexní sportovní prohlídka + Základní diagnostika',
    match: { combo: [PART.komplexniProhlidka, PART.zakladniDiagnostika] },
    inc: ['kpfull', 'zdfull', 'inbody', 'ekg'],
    exc: ['x-vo2pkg', 'x-video'],
  },
  {
    id: 'kp-kd',
    title: 'Komplexní sportovní prohlídka + Komplexní diagnostika',
    badge: true,
    match: { combo: [PART.komplexniProhlidka, PART.komplexniDiagnostika] },
    inc: ['kpfull', 'kdfull', 'inbody', 'ekg', 'video'],
    exc: ['x-vo2pkg'],
  },
  {
    id: 'sp-zd',
    title: 'Spiroergometrické vyšetření + Základní diagnostika',
    match: { combo: [PART.spiro, PART.zakladniDiagnostika] },
    inc: ['spfull', 'zdfull', 'vo2in', 'inbody', 'ekg'],
    exc: ['x-video2'],
  },
  {
    id: 'sp-kd',
    title: 'Spiroergometrické vyšetření + Komplexní diagnostika',
    badge: true,
    match: { combo: [PART.spiro, PART.komplexniDiagnostika] },
    inc: ['spfull', 'kdfull', 'vo2in', 'inbody', 'ekg', 'video'],
    exc: [],
  },
];

export const cardById = (id: string): CardDef => {
  const card = DIAG_CARDS.find((entry) => entry.id === id);
  if (card === undefined) throw new Error(`Unknown diagnostics card: ${id}`);
  return card;
};

/** The order of the "ceník" section of /diagnostika. */
export const DIAG_PRICE_SECTION_IDS = ['zd', 'kd', 'kd-vo2', 'vo2max', 'plan', 'kp-zd', 'kp-kd', 'sp-zd', 'sp-kd'] as const;
/** The packages /prohlidky draws. */
export const PACKAGE_CARD_IDS = ['kp-zd', 'kp-kd', 'sp-zd', 'sp-kd'] as const;
