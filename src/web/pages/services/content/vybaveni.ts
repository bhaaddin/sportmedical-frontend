/* Vybavení — the devices of the live site: "Nejmodernější diagnostické vybavení" of
   /pages/sportovni-lekarske-prohlidky (five devices, as published; Slovak words corrected) and
   "Naše technologie" of the FAQ of /pages/contact (ForceDecks, HumanTrak, Cortex 21). */

export interface DeviceItem {
  title: string;
  text: string;
}

export interface DeviceGroup {
  heading?: string;
  items: readonly DeviceItem[];
}

export interface DeviceDef {
  id: string;
  title: string;
  photoCaption: string;
  intro: readonly string[];
  /** A line under the intro ("Hlavní výhody a charakteristika použitých přístrojů"). */
  sub?: string;
  groups: readonly DeviceGroup[];
}

export const VYBAVENI_HERO = {
  eyebrow: 'Služby',
  title: 'Vybavení',
  lead: 'Vyšetření probíhají pod odborným dohledem specializovaných lékařů a s využitím nejmodernějších diagnostických přístrojů.',
  photoCaption: 'diagnostické pracoviště',
} as const;

export const VYBAVENI_MAIN_TITLE = 'Nejmodernější diagnostické vybavení';
export const VYBAVENI_TECH_TITLE = 'Naše technologie';
export const VYBAVENI_TECH_CLOSING = ['Spojení všech systémů poskytuje ucelený funkční obraz vašeho těla.'];

export const MAIN_DEVICES: readonly DeviceDef[] = [
  {
    id: 'antropometrie',
    title: '1. Antropometrie',
    photoCaption: 'InBody 770 a výškoměr SECA',
    intro: [
      'Používáme kombinaci prémiového bioelektrického analyzátoru InBody 770 a ultrazvukového výškoměru SECA, abychom získali komplexní a velmi přesné antropometrické údaje, které jsou zásadní pro objektivní posouzení tělesné stavby, diagnostiku funkční kapacity organismu při zátěžových testech a optimalizaci výkonových a zdravotních plánů.',
    ],
    sub: 'Hlavní výhody a charakteristika použitých přístrojů',
    groups: [
      {
        heading: 'InBody 770 – špičkový tělesný analyzátor',
        items: [
          {
            title: 'Segmentální analýza tělesného složení',
            text: 'poskytuje detailní rozdělení svalové a tukové hmoty pro každou část těla (pravá/levá ruka, trup, pravá/levá noha), což umožňuje odhalit disproporce a sledovat adaptace na tréninku.',
          },
          {
            title: 'Multifrekvenční bioimpedanční měření',
            text: 'využívá 6 proudů o různých frekvencích, které umožňují přesně stanovit množství tělesné vody, svalové hmoty a tukové tkáně v jednotlivých segmentech těla, a to bez nutnosti odhadů založených na věku či pohlaví.',
          },
          {
            title: 'Detailní výstupy tělesných parametrů',
            text: 'zahrnuje celkovou tělesnou vodu, vnitrobuněčnou a mimobuněčnou vodu (ECW/TBW), viscerální tuk, BMI, WHR a další metriky, které poskytují komplexní přehled o stavu organismu.',
          },
        ],
      },
      {
        heading: 'SECA ultrazvukový výškoměr',
        items: [
          { title: 'Ultrazvukové měření výšky', text: 'poskytuje vysoce přesné, bezkontaktní určení výšky s minimálním rizikem chyb při měření.' },
        ],
      },
    ],
  },
  {
    id: 'ekg',
    title: '2. Podtlakové EKG',
    photoCaption: 'podtlakové EKG elektrody',
    intro: [
      'Podtlakové EKG elektrody představují absolutní špičku v oblasti neinvazivní kardiologické diagnostiky. Díky stabilnímu podtlakovému uchycení zajišťují maximální a spolehlivý kontakt s pokožkou, čímž výrazně zvyšují kvalitu, přesnost i reprodukovatelnost záznamu srdeční aktivity. Tento sofistikovaný systém umožňuje vysoce přesné vyšetření jak v klidových podmínkách, tak při vyšších stupních fyzické zátěže, a to při zachování maximálního komfortu pro vyšetřovaného.',
    ],
    groups: [
      {
        heading: 'Hlavní výhody',
        items: [
          {
            title: 'Výjimečná kvalita signálu',
            text: 'Podtlakový systém zajišťuje stabilní a rovnoměrný kontakt s pokožkou, čímž minimalizuje rušení a umožňuje mimořádně přesný záznam EKG křivky.',
          },
          {
            title: 'Stabilita i při pohybu',
            text: 'Elektrody pevně drží i během dynamické zátěže, což je klíčové pro spolehlivé hodnocení při zátěžových vyšetřeních.',
          },
          {
            title: 'Vyšší komfort pro pacienta',
            text: 'Bez nutnosti použití lepicích samolepek, s minimálním podrážděním pokožky a maximálním komfortem i při delším vyšetření.',
          },
          {
            title: 'Standard špičkové klinické diagnostiky',
            text: 'Technologie používaná ve špičkových kardiologických a sportovně-medicínských centrech zajišťuje nejvyšší úroveň přesnosti a bezpečnosti vyšetření.',
          },
        ],
      },
    ],
  },
  {
    id: 'ergometr',
    title: '3. Lode Excalibur Sport',
    photoCaption: 'ergometr Lode Excalibur Sport',
    intro: [
      'Lode Excalibur Sport je zlatý standard v ergometrii, uznávaný celosvětově v oblasti sportovní medicíny, výkonové diagnostiky a výzkumu. Jedná se o nejmodernější a nejpřesnější ergometr, který poskytuje výjimečnou flexibilitu při nastavení polohy, extrémní rozsah zátěže a perfektní výsledky vyšetření pro všechny úrovně sportovců – od rekreačních až po elitní profily.',
    ],
    groups: [
      {
        heading: 'Hlavní výhody a charakteristiky',
        items: [
          {
            title: 'Maximální možnost nastavení pozice',
            text: 'Elektronicky nastavitelné sedlo i řídítka umožňují přesné vertikální i horizontální nastavení polohy pro optimální biomechaniku a maximální přenos výkonu. Součástí jsou také nastavitelné pedály s možností použití cyklistických treter.',
          },
          {
            title: 'Extrémní rozsah výkonu',
            text: 'Ergometr podporuje zátěž od nízkých 10 W až do 3000 W, což umožňuje testovat i nejsilnější cyklisty při anaerobní a vysokointenzivní zátěži.',
          },
          {
            title: 'Univerzální využití',
            text: 'Lze provádět širokou škálu testů – od nízké zátěže až po Wingate sprint testy, izokinetické testy, vysokointenzivní protokoly a komplexní CPET protokoly.',
          },
          {
            title: 'Přesnost a stabilita',
            text: 'Pokročilý elektromagnetický brzdný systém poskytuje výjimečnou přesnost zátěže v čase, což zaručuje reprodukovatelné a spolehlivé výsledky.',
          },
          {
            title: 'Komfort a bezpečnost',
            text: 'Ergonomická konstrukce, nízká hlučnost a robustní design zabezpečují maximální stabilitu i při extrémních výkonech a delších testech.',
          },
        ],
      },
    ],
  },
  {
    id: 'spirometrie',
    title: '4. Základní funkční vyšetření plic',
    photoCaption: 'spirometr PureFlow',
    intro: [
      'Využíváme moderní spirometrický systém založený na pokročilé ultrazvukové technologii PureFlow, který poskytuje vysoce přesné, spolehlivé a reprodukovatelné měření plicních funkcí pro klinickou diagnostiku i sportovní medicínu.',
    ],
    groups: [
      {
        heading: 'Hlavní charakteristiky a výhody SpiroSonic systémů',
        items: [
          {
            title: 'Ultrazvuková PureFlow technologie',
            text: 'měření průtoku a objemu pomocí vícecestného ultrazvukového snímání bez pohyblivých částí, což zaručuje vysokou přesnost a stabilitu výsledků.',
          },
          {
            title: 'Jednorázové náustky s integrovaným filtrem',
            text: 'zajišťují maximální hygienu a bezpečnost vyšetření, účinně zabraňují přenosu bakterií a kontaminaci mezi jednotlivými pacienty.',
          },
          {
            title: 'Minimální odpor dýchání',
            text: 'nízký odpor vzduchu při měření zvyšuje komfort pacienta a je vhodný i pro děti, seniory a osoby s oslabenou plicní funkcí.',
          },
          { title: 'Autokalibrace a jednoduché použití', text: 'zařízení provádí automatické kalibrace před měřením, což zajišťuje konzistentní výsledky.' },
          {
            title: 'Široký rozsah diagnostických parametrů',
            text: 'měření standardních spirometrických ukazatelů jako FEV₁, FVC, PEF, MMEF a dalších, která umožňují detailní posouzení ventilace a plicních funkcí.',
          },
          {
            title: 'Vhodné pro širokou škálu pacientů',
            text: 'použití je možné v klinickém prostředí, při preventivních prohlídkách i v terénu, díky přenosným a intuitivním modelům.',
          },
        ],
      },
    ],
  },
  {
    id: 'spiroergometrie',
    title: '5. Spiroergometrie',
    photoCaption: 'spiroergometrický systém',
    intro: [
      'Používáme nejmodernější generaci spiroergometrického systému, který integruje mobilní i stacionární kardiopulmonální výkonové testy v jednom zařízení, a otevírá tak nové možnosti přesného hodnocení respiračních a metabolických funkcí při zátěži i v klidu. Je navržen pro dynamickou diagnostiku výkonu, s vysokou přesností měření dýchacích plynů a maximální flexibilitou použití – od laboratoře až po terénní testy.',
    ],
    groups: [
      {
        heading: 'Hlavní přínosy a možnosti vyšetření',
        items: [
          {
            title: 'Přesné stanovení aerobní a anaerobní kapacity',
            text: 'Umožňuje objektivně posoudit úroveň kondice, efektivitu využití kyslíku a celkovou výkonnost organismu.',
          },
          {
            title: 'Vyhodnocení ventilačních a metabolických parametrů',
            text: 'Měření spotřeby kyslíku (VO₂), produkce oxidu uhličitého, dechových objemů a ventilace poskytuje detailní pohled na funkci dýchacího a kardiovaskulárního systému při zátěži.',
          },
          {
            title: 'Stanovení individuálních tréninkových zón',
            text: 'Na základě naměřených hodnot lze přesně určit aerobní a anaerobní prahy a nastavit cílené tréninkové zóny pro optimalizaci výkonu i bezpečný rozvoj kondice.',
          },
          {
            title: 'Vysoká přesnost a reprodukovatelnost výsledků',
            text: 'Moderní technologie zajišťuje stabilní a spolehlivé měření i při vysokých intenzitách zátěže, což je zásadní pro sportovní i klinickou diagnostiku.',
          },
          {
            title: 'Možnost terénního testování',
            text: 'Díky mobilnímu řešení lze vyšetření provádět nejen v laboratorních podmínkách, ale i přímo v tréninkovém prostředí, což umožňuje získat data odpovídající reálnému výkonu sportovce.',
          },
        ],
      },
    ],
  },
];

export const TECH_DEVICES: readonly DeviceDef[] = [
  {
    id: 'humantrak',
    title: 'HumanTrak',
    photoCaption: 'HumanTrak — 3D analýza pohybu',
    intro: ['3D optická analýza pohybu s přesností na milimetry. Zachycuje držení těla, rozsahy pohybu, svalové disbalance a kompenzační mechanismy.'],
    groups: [],
  },
  {
    id: 'forcedecks',
    title: 'ForceDecks',
    photoCaption: 'ForceDecks — silové desky',
    intro: ['Systém silových desek měřící sílu, výbušnost, reakční schopnosti a asymetrie. Analyzuje odrazovou a dopadovou sílu.'],
    groups: [],
  },
  {
    id: 'cortex',
    title: 'Cortex 21',
    photoCaption: 'Cortex 21 — mobilní VO₂max analýza',
    intro: ['Mobilní VO₂max analýza měřící spotřebu kyslíku, výdej oxidu uhličitého a ventilační parametry přímo při výkonu.'],
    groups: [],
  },
];

export const ALL_DEVICES: readonly DeviceDef[] = [...MAIN_DEVICES, ...TECH_DEVICES];
