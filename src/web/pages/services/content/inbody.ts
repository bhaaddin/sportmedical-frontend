/* InBody 770 — wording of the live page https://sportmedical-diagnostics.cz/pages/inbody (as published;
   Slovak words and the typos of the source corrected; the page's stale contact block is left out) and
   the InBody answers of the FAQ of /pages/contact. No amount: prices come from the price list. */

import type { CardDef, LineLibrary } from './cards';

export const INBODY_HERO = {
  eyebrow: 'Služby',
  title: 'InBody 770',
  lead: 'Poznejte své tělo do posledního detailu',
  photoCaption: 'přístroj InBody 770',
} as const;

export const INBODY_FEATURES = {
  title: 'Co InBody 770 měří',
  cards: [
    { title: 'ECW/TBW', text: 'Poměr mimobuněčné a celkové tělesné vody.' },
    {
      title: 'Segmentální fázový úhel',
      text: 'Fázový úhel odráží buněčné zdraví a stav membrán. InBody 770 jej měří segmentálně, což umožňuje hodnotit svalovou kondici, asymetrie i regeneraci po úrazech.',
    },
    {
      title: 'Viscerální tuková plocha (VFA)',
      text: 'Tento parametr má vysokou vypovídací hodnotu v oblasti metabolického zdraví a rizika civilizačních onemocnění, i při normálním BMI.',
    },
    { title: 'Svalová rovnováha a asymetrie', text: 'InBody 770 umožňuje detailně porovnat svalovou hmotu mezi jednotlivými končetinami i stranami těla.' },
    {
      title: 'Bez odhadů, pouze měřená data',
      text: 'InBody 770 nepoužívá empirické odhady – všechna data jsou měřena přímo a individuálně, což zajišťuje vysokou věrohodnost a diagnostickou hodnotu.',
    },
  ],
} as const;

export const INBODY_STANDARD = {
  eyebrow: 'U nás jako standard',
  title: 'To nejlepší z tělesné analýzy',
  paras: [
    'V rámci našich služeb využíváme špičkový analyzátor tělesného složení InBody 770, který poskytuje detailní a přesné informace o složení těla a distribuci tělesných tekutin.',
    'Klientům poskytujeme dvě samostatné výsledkové zprávy: jednu zaměřenou na tělesné složení a druhou na analýzu tělesné vody.',
    'Měření je zcela neinvazivní, trvá méně než 60 sekund a představuje hodnotný základ pro tvorbu individualizovaných tréninkových, výživových či terapeutických plánů.',
    'Impedance 6 různých frekvencí na každém z 5 segmentů těla.',
  ],
  photos: ['přístroj InBody 770 — celkový pohled', 'výsledkový list InBody 770'],
} as const;

export const INBODY_PRECISION = {
  title: 'Diagnostická přesnost, které můžete věřit',
  paras: [
    'InBody 770 díky své technologické vyspělosti patří mezi nejpokročilejší bioimpedanční přístroje určené pro odbornou diagnostiku v oblasti zdraví, výkonu i prevence.',
    'Na rozdíl od běžných zařízení pracuje s multifrekvenční analýzou (6 různých frekvencí) v rozsahu 5–1000 kHz, provádí segmentální měření pěti částí těla a využívá 8bodový dotykový systém s palcovými elektrodami.',
    'Přístroj umožňuje detailní hodnocení poměru mimobuněčné a celkové vody (ECW/TBW), segmentálního fázového úhlu i rizika sarkopenie.',
  ],
  photo: 'měření na InBody 770',
} as const;

export const INBODY_PARAMS = {
  title: 'Komplexní parametry',
  cards: [
    {
      title: 'Komplexní analýza tělesné vody ECW/TBW',
      text: 'Umožňuje sledovat změny v rovnováze intracelulárních a extracelulárních tekutin, které mohou být ovlivněny zraněním, stárnutím, obezitou či dalšími faktory. Poskytuje podrobný přehled o jejich rozložení v jednotlivých segmentech těla.',
    },
    {
      title: 'Segmentální fázový úhel (ukazatel buněčného zdraví)',
      text: 'Fázový úhel je silný indikátor stavu buněk a celkové vitality. Vyšší fázový úhel značí silné a funkční buněčné membrány, zatímco nižší hodnota může indikovat oslabení buněk, často spojené s podvýživou nebo zdravotními problémy.',
    },
    {
      title: 'Hodnocení sarkopenie',
      text: 'InBody 770 umožňuje posouzení rizika sarkopenie na základě analýzy množství kosterní svaloviny v končetinách (SMI – Skeletal Muscle Index). Měření pomáhá včas odhalit svalový úbytek spojený s věkem, inaktivitou nebo chronickým onemocněním.',
    },
    {
      title: 'Komplexní analýza svalové hmoty',
      text: 'InBody 770 detailně měří množství a rozložení svalové hmoty v jednotlivých segmentech těla. Díky tomu lze snadno odhalit nerovnováhy mezi pravou a levou stranou či horními a dolními končetinami.',
    },
  ],
} as const;

export const INBODY_PRECISE = {
  title: 'Bez kompromisů. Bez odhadů. Jen přesná data',
  photo: 'výstup InBody 770 — přesná data',
  cards: [
    {
      title: 'Žádný empirický odhad',
      text: 'Běžné bioimpedanční přístroje využívají empirický odhad, jako je tělesný typ, věk či pohlaví, pro úpravu svých výsledků. InBody používá pouze impedance přímo získané z měření každého člověka, aby poskytovalo přesné výsledky.',
    },
    {
      title: 'Přímé segmentové impedance (DSM-BIA)',
      text: 'Běžné bioimpedanční přístroje měří tělo jako jeden válec. Přístroje InBody používají metodu přímé segmentové bioelektrické impedance (DSM-BIA), patentovanou technologii, která přesně změří tělo jako 5 samostatných válců, tzn. čtyři končetiny a trup.',
    },
    {
      title: 'Multifrekvenční technologie',
      text: 'InBody 770 využívá multifrekvenční technologii, která umožňuje přesné rozlišení mezi intracelulární a extracelulární vodou. Díky průniku vysokofrekvenčních proudů skrze buněčné membrány dokáže spolehlivě měřit hydrataci jednotlivých tělesných segmentů. Zařízení pracuje současně s šesti frekvencemi (1, 5, 50, 250, 500, 1000 kHz), což zajišťuje maximální přesnost a diagnostickou spolehlivost výsledků.',
    },
    {
      title: '8bodový dotykový systém s palcovou elektrodou',
      text: 'Tento systém odděluje jednotlivé segmenty těla (pravá/levá horní končetina, pravá/levá dolní končetina a trup) a eliminuje chyby způsobené nesprávným držením elektrod. Palcové elektrody navíc stabilizují kontakt a zajišťují konzistentní elektrické propojení, což je zásadní pro přesné sledování změn v tělesném složení v čase.',
    },
    {
      title: 'Analýza svalové a tukové hmoty',
      text: 'InBody 770 poskytuje podrobný rozklad svalové a tukové tkáně v jednotlivých segmentech těla (končetiny, trup), čímž umožňuje přesně sledovat disproporce, asymetrie i celkovou tělesnou rovnováhu.',
    },
    {
      title: 'Analýza obezity',
      text: 'InBody 770 přesně měří procento tělesného tuku, viscerální tuk i BMI, což umožňuje objektivně posoudit míru a typ obezity. Na rozdíl od běžných metod zohledňuje skutečné složení těla, nikoli pouze váhu.',
    },
    {
      title: 'Segmentální analýza svalové a tukové hmoty',
      text: 'InBody 770 rozděluje tělo na pět segmentů (pravá/levá horní končetina, pravá/levá dolní končetina a trup) a samostatně analyzuje množství svalové a tukové hmoty v každé části.',
    },
    {
      title: 'Analýza složení těla',
      text: 'Základní přehled o poměru svalové hmoty, tukové tkáně, kostní hmoty a tělesné vody. InBody 770 poskytuje přesná data o vnitřním složení těla.',
    },
  ],
} as const;

/* ── Price cards ── */

export const INBODY_PRICE = {
  title: 'Ceník služeb – tělesná analýza InBody 770',
  paras: [
    'Tato nabídka je určena klientům, kteří chtějí využít tělesnou analýzu InBody 770 samostatně – s možností volby mezi jednorázovým měřením nebo cenově zvýhodněným balíčkem opakovaných vyšetření.',
    'Pokud hledáte komplexnější přístup, nabízíme také individuální balíčky, které kombinují komplexní InBody analýzu se zátěžovým testem nebo sportovní diagnostikou – v jednom cíleném vyšetření.',
    'Všechny výkony provádíme s důrazem na odbornost, přesnost a individuální přístup. Vyberte si přesně to, co aktuálně potřebujete.',
  ],
  more: 'Další služby z ceníku',
} as const;

export const INBODY_CARD_PREFIX = 'inbody.card';
export const INBODY_LINE_PREFIX = 'inbody.line';

const NOT_BASIC = 'Není součástí základního InBody měření. Pokud o ni máte zájem, můžete si vybrat službu InBody komplexní měření + odborná konzultace, která tuto možnost zahrnuje a ';

export const INBODY_LINES: LineLibrary = {
  composition: {
    name: 'Tělesné složení (hmotnost, tuk, svaly, BMI)',
    text: 'Nabízí přehledné vyhodnocení klíčových parametrů tělesného složení, jako je celková hmotnost, procento tělesného tuku, svalová hmota a BMI. Výsledky jsou vhodné pro rychlou orientaci, bez doplňující interpretace a vizuálního zobrazení.',
  },
  segmental: {
    name: 'Segmentální analýza svalové hmoty a tuku',
    text: 'InBody 770 umožňuje detailní rozbor složení těla podle jednotlivých segmentů – levá a pravá paže, trup, levá a pravá noha. Tento přístup odhaluje nerovnoměrné rozložení svalové hmoty, tukové tkáně a možné asymetrie mezi pravou a levou stranou těla nebo mezi horními a dolními končetinami. Díky tomu lze přesně identifikovat svalové dysbalance, přetížené oblasti nebo nedostatečně rozvinuté segmenty, což je klíčové pro efektivní trénink, regeneraci i prevenci zranění.',
  },
  metabolism: {
    name: 'Metabolismus a voda (BMR, TBW, WHR, ECW/TBW, ICW/ECW)',
    text: 'Tato část analýzy hodnotí bazální metabolismus (BMR) – tedy množství energie, které tělo potřebuje pro svůj základní chod v klidu – a celkovou tělesnou vodu (TBW), včetně jejího rozložení mezi vnitrobuněčný (ICW) a mimobuněčný (ECW) prostor. Poměr ECW/TBW odhaluje rovnováhu tekutin a případnou retenci vody, zatímco WHR (poměr pasu a boků) slouží k posouzení distribuce tuku a rizika kardiometabolických onemocnění. Díky těmto ukazatelům lze přesně posoudit hydrataci, regeneraci a metabolickou aktivitu organismu, což je klíčové pro nastavení efektivního výživového i tréninkového plánu.',
  },
  health: {
    name: 'Zdravotní ukazatele (viscerální tuk, fázový úhel, minerály, SMI, nutriční indexy)',
    text: 'Tato část analýzy se zaměřuje na hlubší zdravotní a výživové parametry, které odrážejí celkový stav organismu i kvalitu tělesných tkání. Viscerální tuk ukazuje množství tuku uloženého v oblasti břicha, jehož nadbytek zvyšuje riziko metabolických a kardiovaskulárních onemocnění. Fázový úhel je klíčovým ukazatelem buněčné vitality, regenerace a celkové kondice organismu. Minerální složka odráží stav kosterního systému, zatímco SMI (Skeletal Muscle Index) vyjadřuje množství kosterní svaloviny v poměru k tělesné výšce. Nutriční indexy umožňují zhodnotit výživový stav, rovnováhu živin a dlouhodobou udržitelnost výkonnosti. Tyto ukazatele společně poskytují komplexní pohled na zdraví, regeneraci a funkční připravenost těla.',
  },
  growth: {
    name: 'Růstová křivka (pro děti a mládež)',
    text: 'InBody 770 umožňuje sledovat růst a tělesný vývoj dětí a dospívajících prostřednictvím grafu vývoje („Growth Graph“), který porovnává jejich výsledky s věkovými a pohlavními referenčními normami. Zobrazuje procentuální zastoupení tělesného tuku, množství svalové hmoty a celkovou hmotnost ve vztahu k věku, čímž pomáhá posoudit, zda je růst a složení těla přiměřené biologickému vývoji. Tento nástroj umožňuje sledovat změny v čase, vyhodnotit efekt tréninku, výživy nebo zdravotních zásahů a podporuje zdravý, vyvážený vývoj dítěte či mladého sportovce.',
  },
  graph: {
    name: 'Rozšířená interpretace a grafické znázornění výsledků',
    text: 'Součástí komplexního měření je přehledná grafická interpretace všech klíčových parametrů – od složení těla, rozložení svalové a tukové hmoty, až po rovnováhu tělesných tekutin a metabolické ukazatele. Výsledky jsou zpracovány do srozumitelných vizuálních grafů a diagramů, které umožňují snadno pochopit aktuální stav tělesné kompozice a sledovat její změny v čase.',
  },
  nutrition: {
    name: 'Komplexní přehled výživy, metabolismu a energetické rovnováhy',
    text: 'Součástí služby je podrobný přehled principů výživy a fungování metabolismu, který pomáhá porozumět tomu, jak tělo získává, využívá a ukládá energii. Materiál vysvětluje roli makroživin (bílkoviny, sacharidy, tuky), význam mikroživin, vitamínů a minerálů, i vliv hydratace a hormonální rovnováhy na výkon, regeneraci a složení těla. Cílem je, aby klient lépe porozuměl energetické bilanci, metabolismu a vztahu mezi výživou a fyzickou výkonností, a dokázal tak efektivněji pracovat s vlastním tělem i tréninkovým režimem.',
  },
  muscle: {
    name: 'Komplexní přehled svalové a tukové hmoty',
    text: 'Tento materiál poskytuje ucelený pohled na fungování svalové a tukové tkáně – dvou klíčových složek, které určují výkonnost, metabolismus i celkové zdraví. Vysvětluje, jak svalová hmota vzniká, obnovuje se a proč je zásadní nejen pro sílu, ale i pro energetický výdej, hormonální rovnováhu a prevenci přetížení. Objasňuje také, jak tuková tkáň funguje jako zdroj energie, jaký je rozdíl mezi podkožním a viscerálním tukem a proč nadbytek vnitřního tuku zvyšuje riziko zánětů či hormonální nerovnováhy. Materiál přibližuje, jak trénink, výživa a regenerace ovlivňují poměr i kvalitu těchto tkání a jak s nimi efektivně pracovat pro lepší výkon, zdraví a regeneraci.',
  },
  consult: {
    name: 'Odborná konzultace',
    text: 'Konzultace navazuje na výsledky analýzy InBody 770 a slouží k podrobnému vysvětlení a interpretaci všech naměřených hodnot. Specialista objasní význam jednotlivých parametrů – svalová hmota, tělesný tuk, poměr vody, bazální metabolismus, fázový úhel či viscerální tuk – a jejich vzájemné souvislosti. Na základě výsledků poskytne doporučení pro úpravu výživy, tréninku a regenerace, aby bylo možné efektivně ovlivnit složení těla, zlepšit výkonnost a podpořit dlouhodobé zdraví.',
  },
  'x-graph': { name: 'Rozšířená interpretace a grafické znázornění výsledků', text: `${NOT_BASIC}nabízí detailní grafické zpracování výsledků spolu s jejich odbornou interpretací.` },
  'x-nutrition': { name: 'Komplexní přehled výživy, metabolismu a energetické rovnováhy', text: `${NOT_BASIC}poskytuje podrobné informace o fungování výživy, metabolismu a energetické rovnováhy organismu.` },
  'x-muscle': { name: 'Komplexní přehled svalové a tukové hmoty', text: `${NOT_BASIC}poskytuje detailní informace o fungování svalové a tukové tkáně, jejich vzájemném vztahu a vlivu na výkon, metabolismus a zdraví.` },
  'x-consult': { name: 'Odborná konzultace', text: `${NOT_BASIC}nabízí detailní rozbor výsledků s odborným výkladem a individuálním doporučením.` },
  'x-plan': {
    name: 'Personalizovaný výživový plán',
    text: 'Není součástí základního InBody měření. Jedná se o rozšířenou diagnostiku, která je dostupná pouze v rámci komplexního InBody vyšetření.',
  },
  // Výživový plán
  'n-analysis': {
    name: 'Komplexní nutriční analýza',
    text: 'Výživový plán vychází z kompletní analýzy tělesného složení, metabolismu a energetické bilance. Na základě měření InBody 770 a individuálních vstupních údajů jsou přesně určeny parametry bazálního metabolismu, podíl svalové a tukové hmoty, hydratace i fázový úhel, které odrážejí aktuální fyziologický stav organismu. Díky tomu lze přesně stanovit reálné energetické potřeby těla, zvolit optimální poměr makroživin a vytvořit nutriční strategii odpovídající výkonu, regeneraci a cíli klienta.',
  },
  'n-plan': {
    name: 'Individuální výživový plán',
    text: 'Výživový plán je vytvořen na míru konkrétním potřebám a cílům klienta, s ohledem na tělesné složení, tréninkový režim i denní rytmus. Obsahuje přesně stanovený denní příjem energie, makroživin i mikronutrientů, přizpůsobený vašim cílům – redukci hmotnosti, zvýšení výkonu, regeneraci či celkovému zdraví. Cílem je optimalizovat výživu tak, aby byla efektivní, udržitelná a podporovala výkon, regeneraci i dlouhodobou rovnováhu organismu.',
  },
  'n-menu': {
    name: 'Strukturovaný jídelníček podle dne',
    text: 'Jídelníček je přehledně rozpracován na jednotlivé dny, s jasně stanoveným počtem jídel, jejich načasováním a skladbou podle denního rytmu klienta. Každý den obsahuje konkrétní potraviny, množství a kombinace, které odpovídají stanovenému energetickému příjmu a makroživinám. Díky této struktuře je plán praktický, snadno aplikovatelný a dlouhodobě udržitelný, a zároveň zaručuje, že tělo dostává přesně to, co potřebuje – ve správný čas a ve správném poměru.',
  },
  'n-prefs': {
    name: 'Respektování individuálních preferencí',
    text: 'Výživový plán je vždy plně přizpůsoben osobním preferencím, životnímu stylu a stravovacím zvyklostem klienta, aby byl přirozený, efektivní a dlouhodobě udržitelný. Zohledňuje potravinové intolerance, alergie, vegetariánství i další specifické výživové směry, stejně jako pracovní rytmus, typ sportovní zátěže či individuální chuťové preference. Cílem je vytvořit výživový systém, který respektuje tělo i psychiku klienta, poskytuje potřebnou flexibilitu a zároveň zachovává odbornou přesnost a účinnost.',
  },
  'n-consult': { name: 'Odborná konzultace', text: 'Osobní vysvětlení principů jídelníčku, možnost úprav podle tolerance, chutí a průběžných výsledků.' },
  'n-revision': {
    name: 'Možnost následné revize plánu',
    text: 'Průběžné přenastavení jídelníčku po několika týdnech podle vývoje hmotnosti, výkonu nebo cílovaných parametrů (např. BMR, svalová hmota).',
  },
  'n-two': {
    name: '2 měření InBody v ceně',
    text: 'Součástí služby jsou dvě kontrolní měření InBody v průběhu plánu – pro sledování změn tělesného složení a efektivity nastavené výživy.',
  },
  // Balíček 5 měření
  'b-price': {
    name: 'Zvýhodněná cena oproti jednotlivým měřením',
    text: 'Balíček nabízí výhodnější cenu a současně vyšší diagnostickou hodnotu díky možnosti dlouhodobého sledování a vyhodnocování dat.',
  },
  'b-detail': { name: 'Detailní rozbor složení těla při každém měření' },
  'b-trend': {
    name: 'Sledování trendů a skutečného progresu',
    text: 'Pět opakovaných měření umožňuje vidět reálné změny, potvrdit efekt tréninku, výživy nebo regenerace.',
  },
};

export const INBODY_CARDS: readonly CardDef[] = [
  {
    id: 'basic',
    title: 'Základní InBody měření',
    match: { any: /^zakladni inbody/ },
    inc: ['composition', 'segmental', 'metabolism', 'health', 'growth'],
    exc: ['x-graph', 'x-nutrition', 'x-muscle', 'x-consult', 'x-plan'],
    cta: 'phone',
  },
  {
    id: 'complex',
    title: 'InBody komplexní měření + odborná konzultace',
    badge: true,
    match: { any: /^inbody komplexni/ },
    inc: ['composition', 'segmental', 'metabolism', 'health', 'growth', 'graph', 'nutrition', 'muscle', 'consult'],
    exc: ['x-plan'],
    cta: 'phone',
  },
  {
    id: 'plan',
    title: 'Sestavení personalizovaného výživového plánu',
    badge: true,
    match: { any: /vyzivov\w* plan/ },
    inc: ['n-analysis', 'n-plan', 'n-menu', 'n-prefs', 'n-consult', 'n-revision', 'n-two'],
    exc: [],
    cta: 'phone',
  },
  {
    id: 'pack5',
    title: 'Zvýhodněný balíček 5 měření (základní)',
    badge: true,
    match: { any: /balicek 5 mereni/ },
    inc: ['b-price', 'b-detail', 'b-trend'],
    exc: [],
    cta: 'phone',
  },
];

/* ── Preparation, how it works, duration (the FAQ of the live Kontakt page) ── */

export const INBODY_PREP = {
  title: 'Jak se správně připravit na měření InBody?',
  rules: {
    title: 'Zásady přípravy',
    items: [
      'Neměřte se ihned po jídle (2 hodiny po jídle)',
      'Dodržujte stejné podmínky při opakovaných měřeních (stejná denní doba, režim stravy, spánku, aktivity)',
      'Vyhněte se nadměrné konzumaci tekutin před testem',
      'Použijte toaletu před měřením',
      'Vyhněte se fyzické zátěži alespoň 2 hodiny před testem',
      'Neměřte se po sprše, koupeli, sauně nebo silném pocení',
      'Ženy: měření mimo období menstruace',
    ],
  },
  extra: {
    title: 'Doplňková doporučení',
    items: [
      'Nepoužívejte krémy ani oleje na ruce a nohy',
      'Odstraňte všechny kovové předměty (šperky, hodinky, piercingy)',
      'Vyhněte se alkoholu a kofeinu alespoň 24 hodin před měřením',
      'Během testu zůstaňte v klidu bez pohybu',
    ],
  },
  contra: {
    title: 'Kontraindikace',
    items: [
      'Osoby s kardiostimulátorem (konzultace s lékařem)',
      'Těhotné ženy v 1. trimestru (měření po konzultaci)',
      'Osoby s otevřenými ranami či kovovými implantáty (může ovlivnit přesnost)',
    ],
  },
  closing: ['Přesnost závisí na konzistentní přípravě a klidových podmínkách.'],
} as const;

export const INBODY_HOW = {
  title: 'Co je InBody 770 měření a jak funguje?',
  paras: [
    'InBody 770 je zařízení lékařské třídy pro komplexní analýzu tělesného složení a stavu tekutin. Základem je technologie DSM-BIA – přímá segmentální vícefrekvenční bioimpedanční analýza.',
  ],
  flowTitle: 'Jak vyšetření probíhá',
  flow: ['Měření trvá přibližně 60 sekund. Klient stojí bosý na měřicí destičce a drží elektrody v rukou – bez injekcí, bez nepohodlí, neinvazivně.'],
  featuresTitle: 'Hlavní vlastnosti',
  features: [
    'Segmentální analýza pěti součástí těla',
    'Detailní analýza intracelulární a extracelulární vody a poměru ECW/TBW',
    'Více než 50 parametrů: složení těla, voda, minerály, bazální metabolismus, fázový úhel',
    'Klinická přesnost bez empirických odhadů',
    'Okamžitý, přehledný výstup s grafy a interpretací',
  ],
  closing: ['InBody 770 je lékařsky certifikované, používáno ve špičkových nemocnicích a výzkumných centrech.'],
} as const;

export const INBODY_VS = {
  title: 'V čem je InBody jiné než běžné chytré váhy?',
  paras: [
    'Běžné váhy používají jednoduchou metodu odhadující podíl tuku podle věku a pohlaví. InBody 770 používá DSM-BIA – měří skutečnou elektrickou impedanci na šesti frekvencích v pěti segmentech těla. Výsledky nejsou odhady, ale reálné fyziologické měřování.',
    'Běžné váhy vidí tělo jako celek. InBody 770 měří každou část samostatně – odhaluje svalové nerovnováhy, asymetrie, přetížení konkrétní části.',
    'Běžné váhy zobrazují pouze „tělesnou vodu“. InBody 770 rozlišuje intracelulární a extracelulární vodu a určuje poměr ECW/TBW – zásadní ukazatel rovnováhy tekutin a zdraví.',
    'InBody 770 je lékařsky validováno, používáno v nemocnicích a výzkumných centrech. Běžné váhy vycházejí z algoritmických odhadů s chybovostí až 20–30 procent.',
  ],
} as const;

export const INBODY_DURATION = {
  title: 'Jak dlouho měření trvá a kdy dostanu výsledky?',
  paras: [
    'Měření InBody 770 je rychlé a komfortní. Celý proces včetně přípravy a interpretace trvá přibližně 5 minut.',
    'Samotná analýza těla probíhá pouhých 60 sekund. Během této doby přístroj provádí vícefrekvenční měření pěti tělesných segmentů a zachycuje 50+ parametrů tělesného složení, hydratace a metabolismu.',
    'Výsledky obdržíte okamžitě po dokončení měření – ve formě tištěného reportu s tabulkami, grafy a interpretací hodnot. Není potřeba čekat – diagnostický výstup je generován automaticky a následně interpretován odborným personálem.',
  ],
} as const;
