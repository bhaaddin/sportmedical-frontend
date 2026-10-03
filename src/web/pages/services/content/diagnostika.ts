/* Sportovní diagnostika (the hub) — wording of the live page
   https://sportmedical-diagnostics.cz/pages/sportovni-diagnostika, as published; Slovak words and
   obvious typos corrected; the stale "Již brzy dostupné" next to Vo2max is left out. The durations
   and the report contents come from the FAQ of /pages/contact. No amount in here. */

export const DIAG_HERO = {
  eyebrow: 'Služby',
  title: 'Sportovní diagnostika',
  lead:
    'S využitím nejmodernějších diagnostických technologií odhalíme vaši vnitřní sílu, kvalitu pohybu a reálnou výkonnost s přesností, která běžné metody nechává daleko za sebou. Diagnostika složení těla, biomechaniky, svalové rovnováhy, silových parametrů a VO₂max. Vše propojeno do jednoho uceleného systému, který vám dá jasná data pro lepší výkon, zdravější tělo a bezpečnější trénink.',
  photoCaption: 'ForceDecks měření',
} as const;

export interface DiagServiceDef {
  title: string;
  /** The sentence on the small service card. */
  text: string;
  /** The "key feature" line of the comparison card. */
  feature?: string;
  /** The description of the comparison card. */
  description: string;
  to: string;
  photoCaption: string;
}

export const DIAG_SERVICES_TITLE = 'Naše služby';

export const DIAG_SERVICES: readonly DiagServiceDef[] = [
  {
    title: 'Základní diagnostika',
    text: 'Nejpřesnější silová diagnostika na trhu. Měříme výbušnost, stabilitu i asymetrie s milisekundovou přesností. Získáte data, která odhalí nejen sílu samotnou, ale i její kvalitu, načasování a rovnováhu.',
    feature:
      'Nezahrnuje komplexní video-analýzu jednotlivých fází pohybu propojenou s naměřenými daty, identifikaci kompenzačních mechanismů, technických nedostatků a nesprávných pohybových vzorců',
    description:
      'Pokročilá diagnostika pohybového aparátu založená na měření odrazových a dopadových sil, asymetrií a reaktivity svalového systému pomocí nejpřesnějších silových platforem na trhu. Umožňuje objektivně vyhodnotit kvalitu pohybového projevu, identifikovat svalové a silové dysbalance a odhalit faktory, které mohou ovlivňovat výkon i riziko zranění.',
    to: '/diagnostika/zakladni',
    photoCaption: 'silové platformy ForceDecks',
  },
  {
    title: 'Komplexní diagnostika',
    text: 'Nejpřesnější silová diagnostika na trhu. Měříme výbušnost, stabilitu i asymetrie s milisekundovou přesností. Získáte data, která odhalí nejen sílu samotnou, ale i její kvalitu, načasování a rovnováhu.',
    feature:
      'Součástí vyšetření je komplexní video-analýza jednotlivých fází pohybu propojená s naměřenými daty, která umožňuje přesně identifikovat kompenzační mechanismy, technické nedostatky a nesprávné pohybové vzorce.',
    description:
      'Nejpokročilejší komplexní diagnostika pohybového aparátu s detailní video-analýzou pohybu propojenou s naměřenými daty. Kombinuje špičkovou analýzu odrazových a dopadových sil, asymetrií a reaktivity svalového systému s možností přesně sledovat, co se v jednotlivých fázích pohybu skutečně děje. Díky propojení objektivních dat s videozáznamem dokáže odhalit nejen svalové a silové dysbalance, ale také technické nedostatky, kompenzační mechanismy a nesprávné pohybové vzorce, které mohou negativně ovlivňovat výkon i riziko zranění. Jasný podklad pro efektivní nastavení tréninku, rehabilitace a prevenci přetížení.',
    to: '/diagnostika/komplexni',
    photoCaption: 'komplexní diagnostika s videoanalýzou',
  },
  {
    title: 'Vo2max analýza',
    text: 'Revoluční spiroergometrie nové generace, nejpřesnější měření VO₂max v laboratoři i v terénu, s výstupy na úrovni světového vrcholového sportu.',
    feature: 'Revoluční přenosná i stacionární spiroergometrická analýza',
    description:
      'Nejnovější a nejmodernější spiroergometrický systém na trhu, který zásadně mění možnosti testování. Umožňuje provádět vyšetření přímo v terénu a v podmínkách reálné aktivity sportovce, zároveň jej však lze plnohodnotně využít i jako stacionární zařízení v laboratoři. S maximální přesností měří spotřebu kyslíku, produkci oxidu uhličitého a ventilační parametry, čímž poskytuje nejvěrnější obraz o kardiopulmonální a metabolické kapacitě.',
    to: '/diagnostika/vo2max',
    photoCaption: 'spiroergometrie Cortex 21',
  },
  {
    title: 'Sestavení personalizovaného kompenzačního plánu',
    text: 'Cílený kompenzační program sestavený přesně podle výsledků ze sportovní diagnostiky.',
    description:
      'Kompenzační plán je sestaven na základě konkrétních výsledků z diagnostiky HumanTrak, ForceDecks nebo VO₂max, čímž přesně reaguje na zjištěné svalové dysbalance, asymetrie, funkční omezení nebo přetížení. Každý plán je proto zcela individuální, respektuje sportovní specializaci, úroveň zátěže i aktuální stav pohybového aparátu.',
    to: '/diagnostika/kompenzacni-plan',
    photoCaption: 'videoinstruovaný kompenzační plán',
  },
  {
    title: 'InBody 770',
    text: 'Standard naší diagnostiky. Bez příplatku. Bez kompromisů.',
    description:
      'Komplexní tělesná a metabolická analýza. InBody 770 detailně měří složení těla, svalové a tukové rozložení, rovnováhu tekutin i buněčnou vitalitu. Díky segmentální přesnosti odhaluje svalové dysbalance a poskytuje podklady pro zdravotní, výživová i tréninková doporučení.',
    to: '/inbody',
    photoCaption: 'přístroj InBody 770',
  },
];

export const DIAG_SERVICE_LINK = 'Detailní informace';

export const DIAG_KEY = {
  eyebrow: 'Data, která promění výkon',
  title: 'Nepracujeme s pocitem, ale s daty. Ne s odhadem, ale s přesností.',
  text:
    'Spojujeme to nejlepší z moderní biomechaniky, silové analýzy a fyziologického testování do jednoho precizního systému. Získáte hluboký vhled do fungování svého těla: přesnou analýzu tělesného složení včetně rozložení svalů a tuku, hodnocení svalových dysbalancí a asymetrií, detailní záznam pohybových vzorců a funkce jednotlivých kloubů v reálném čase, silový profil s důrazem na stabilitu a výbušnost, měření schopnosti těla efektivně využívat kyslík při zátěži (VO₂max) i další klíčové ukazatele trénovanosti. Tato služba vám umožní odhalit skryté asymetrie, přetížení i rezervy, které běžné přístupy nikdy nezachytí – a přetavit je v konkrétní kroky pro výkon, prevenci i zdravý pohyb.',
} as const;

export const DIAG_CUSTOM = {
  title: 'Sestavení individuálních balíčků na míru',
  text:
    'Jsme schopni zajistit komplexní sportovní diagnostiku přesně podle vašich potřeb a individuálního zájmu. Díky široké nabídce metod a špičkového vybavení si můžete vybrat z naší nabídky služeb to, co vám nejvíce vyhovuje – a sestavit si tak vlastní balíček, který odpovídá vašim cílům i očekáváním.',
  link: 'Potřebujete poradit?',
} as const;

export const DIAG_FEATURES = [
  'Komplexní 3D analýza pohybu',
  'Diagnostika (a)symetrií a kompenzačních mechanismů',
  'Detailní silové a rovnovážné profily',
  'Identifikace funkčních poruch, rizikových vzorců a skrytých rezerv',
  'Objektivní sledování vývoje',
] as const;

export const DIAG_TECH = {
  title: 'Vysoce citlivá analýza v milisekundovém rozlišení',
  subtitle: 'Základní i komplexní diagnostika',
  text:
    'Využívá extrémně citlivé silové platformy vybavené vysoce výkonnými tenzometrickými senzory, které zaznamenávají i ty nejmenší změny tlaku a síly v každé fázi pohybu. Systém měří silové vektory ve vertikální i horizontální ose s milisekundovým rozlišením a umožňuje oddělené snímání levé a pravé končetiny. Tato úroveň přesnosti umožňuje identifikovat časové zpoždění při odrazu, nesouměrné rozložení síly při dopadu, rozdíly v rychlosti generování síly mezi končetinami i další faktory ovlivňující efektivitu pohybu a sportovní výkon. Díky integraci pokročilých algoritmů systém automaticky rozpoznává jednotlivé fáze pohybu – od excentrické brzdy přes přechodovou fázi až po samotný koncentrický odraz – a vyhodnocuje klíčové parametry, jako je rychlost rozvoje síly (RFD), celková produkce síly, impuls, stabilita či asymetrie zatížení. Výsledky jsou okamžitě převáděny do přehledných metrik a vizualizací, které umožňují objektivně posoudit skutečný pohybový výkon v jeho celistvosti i detailu. Tato úroveň měření a zpracování dat umožňuje hodnotit nejen to, kolik síly je vyvinuto, ale také kdy, jak a za jakých podmínek vzniká. Právě díky tomu lze s vysokou přesností odhalovat silové dysbalance, pohybové nedostatky a faktory, které mohou ovlivňovat výkon, regeneraci i riziko vzniku zranění.',
  cards: [
    { title: 'Vysokorychlostní a vysoce citlivé měření sil', text: 'Extrémně citlivé zaznamenávání i těch nejmenších změn síly a tlaku s milisekundovým rozlišením ve vertikální i horizontální ose.' },
    { title: 'Nezávislé měření levé a pravé končetiny', text: 'Umožňuje přesně identifikovat asymetrie, silové dysbalance, rozdíly v zatížení a případná funkční omezení, která mohou ovlivňovat výkon i riziko vzniku zranění.' },
    { title: 'Automatická identifikace fází pohybu', text: 'Pokročilé algoritmy automaticky rozpoznávají jednotlivé fáze pohybu a umožňují jejich detailní časovou i silovou analýzu.' },
    {
      title: 'Detailně zpracovaná výstupní zpráva s doporučeními',
      text: 'Součástí diagnostiky je přehledně zpracovaná výstupní zpráva obsahující odbornou interpretaci výsledků, identifikaci klíčových zjištění a konkrétní doporučení pro další trénink, kompenzaci, rehabilitaci i prevenci.',
    },
    {
      title: 'Detailní videoanalýza biomechaniky pohybu',
      text: '(Součástí pouze Komplexní diagnostiky) Umožňuje ve všech fázích pohybu detailně analyzovat techniku provedení, koordinaci pohybu, stabilizaci, přenos sil i vznik kompenzačních mechanismů a přesně identifikuje biomechanické nedostatky, asymetrie a nesprávné pohybové vzorce ovlivňující výkon i riziko zranění.',
    },
    {
      title: 'Možnost vytvoření individuálního video kompenzačního plánu',
      text: '(volitelná doplňková služba) Na základě výsledků diagnostiky lze vytvořit individuální video kompenzační plán zaměřený na odstranění zjištěných asymetrií, dysbalancí, pohybových omezení a kompenzačních mechanismů.',
    },
  ],
} as const;

export interface VizDef {
  title: string;
  text: string;
  /** The longer explanation (the "detailed analysis" section of the live page); none where the live page repeats another. */
  long?: string;
  photoCaption: string;
}

export const DIAG_VIZ_TITLE = 'Od vizualizace ke změně. Diagnostika bez domněnek';

export const DIAG_VIZ: readonly VizDef[] = [
  {
    title: 'Detailní analýza jednotlivých fází pohybu',
    text: 'Zachycení trajektorie a rozsahu pohybu všech klíčových segmentů těla ve třech rovinách, včetně asymetrií a kompenzačních vzorců.',
    long: 'Systém umožňuje snímání klíčových anatomických bodů s milimetrovou přesností, což je základem pro detailní biomechanické vyhodnocení pohybu. Měří trajektorii, rozsah pohybu (ROM), rychlost i zrychlení, a zároveň hodnotí dynamickou stabilitu jednotlivých segmentů těla. Veškerá data jsou vizualizována v reálném čase přímo na obrazovce během testu, což umožňuje okamžitou zpětnou vazbu a efektivní rozhodování přímo v průběhu měření.',
    photoCaption: '3D analýza pohybu — fáze pohybu',
  },
  {
    title: 'Pokročilá analýza rovnováhy a posturální kontroly',
    text: 'Analýza schopnosti udržet stabilitu během statických i dynamických úloh, včetně odchylek od optimální osy a zatížení jednotlivých stran.',
    long: 'Měříme, jak tělo pracuje při udržování stability – ve statických i dynamických podmínkách. Kvantifikujeme trajektorii těžiště, odchylky v jednotlivých osách, kompenzační strategie i celkovou úroveň fungování rovnovážného systému.',
    photoCaption: 'analýza rovnováhy',
  },
  {
    title: 'Vizualizace v reálném čase',
    text: 'Okamžité zobrazení pohybových dat přímo na obrazovce během testu pro rychlou orientaci a efektivní zpětnou vazbu.',
    long: 'Pohybová data jsou snímána a zobrazována přímo na obrazovce v reálném čase, což zajišťuje okamžitou zpětnou vazbu. Sledují se rozsahy pohybu, rychlosti, zrychlení, trajektorie, dynamická stabilita, rozložení síly a časování.',
    photoCaption: 'vizualizace měření na obrazovce',
  },
  {
    title: 'Silová analýza s milisekundovou přesností',
    text: 'Zachycení vývoje síly, rychlosti a explozivity v čase – včetně reakčních časů, maximální síly a symetrie při zatížení.',
    photoCaption: 'silová analýza',
  },
  {
    title: 'Okamžitá a praktická využitelnost výstupů',
    text: 'Automaticky generované protokoly s jasně strukturovanými metrikami a interpretací, připravené k použití pro trénink, terapii i prevenci.',
    long: 'Měření probíhá s reálnou vizualizací výsledků přímo během záznamu, což umožňuje okamžitou orientaci v kvalitě a charakteru pohybu. Po dokončení testu jsou automaticky generovány podrobné reporty s foto-snímky a přesně definovanými metrikami. Výsledky jsou interpretovány přehledně a srozumitelně tak, aby byly ihned využitelné pro tréninková rozhodnutí, terapeutické intervence i preventivní opatření. Celý proces je navržen s důrazem na efektivitu, přesnost a praktickou použitelnost v reálném prostředí.',
    photoCaption: 'výstupní protokol',
  },
  {
    title: 'Objektivní sledování vývoje',
    text: 'Možnost porovnání výsledků napříč testováními, ideální pro dlouhodobé vedení sportovců, pacientů i rekreačních klientů.',
    long: 'Měření probíhá podle standardizovaných testovacích protokolů, které zajišťují spolehlivé opakování a objektivní srovnatelnost výsledků. Díky tomu je možné sledovat vývoj v čase a přesně vyhodnocovat účinnost zvolených intervencí. Výstupy jsou prezentovány v grafické podobě a doplněny jasně definovanými metrikami, které umožňují snadnou interpretaci změn. Tento přístup je ideální pro dlouhodobé vedení sportovců, pacientů nebo klientů v rámci kontinuální diagnostiky, tréninku či terapie.',
    photoCaption: 'sledování vývoje v čase',
  },
];

export const DIAG_VIZ_EXTRA_PHOTO = 'přehledná grafika výsledků';

/** The FAQ answers about the diagnostics (live Kontakt page): how long, what is in the report, how often. */
export const DIAG_FAQ = {
  duration: {
    title: 'Jak dlouho testování trvá a kdy obdržím výsledky?',
    paras: [
      'Délka diagnostiky se odvíjí od rozsahu objednané služby. Jednotlivé měření trvá 20–40 minut, komplexní diagnostika zahrnující více metod trvá 40–60 minut.',
      'Výsledky nejsou dostupné ihned – vyžadují detailní zpracování dat, jejich analýzu a odbornou interpretaci. Jakmile je zpráva kompletní, klient je kontaktován a je dohodnut termín konzultace s předáním výsledků.',
      'Každý klient obdrží kompletní výstupní dokumentaci s tabulkami, grafy, interpretací a doporučeními.',
    ],
  },
  report: {
    title: 'Co přesně se dozvím z výstupní zprávy?',
    rawTitle: 'Surová data a výstupy',
    raw: ['Měření obsahuje tabelární data a grafy se všemi sledovanými metrikami. U HumanTrak jsou k dispozici fotodokumentace a vizuální výstupy z klíčových pohybových fází.'],
    listTitle: 'Výstupní zpráva obsahuje',
    items: [
      'Aritmetické průměry z validních měření',
      'Souhrnný přehled s hodnocením „v normě“, „hraniční“ nebo „mimo normu“',
      'Jednotlivé metriky s porovnáním s normovými rozmezími',
      'Výkonnostní index (0–10 bodů)',
      'Konkrétní doporučení pro trénink, rehabilitaci a kompenzaci',
      'Video-kompenzační plán s detailním průvodcem cvičení',
    ],
    closing: ['Výstupní zpráva je komplexní funkční mapou vašeho těla s vědecky ověřeným podkladem pro další práci.'],
  },
  repeat: {
    title: 'Jak často je vhodné sportovní diagnostiku opakovat?',
    paras: [
      'Sportovní diagnostika má největší přínos, když na ni navazuje cílený kompenzační a tréninkový program. Doporučujeme provést kontrolní retest přibližně po 3 měsících od první analýzy.',
      'Tento interval představuje optimální dobu, během níž se projeví fyziologické adaptace, stabilizují nové pohybové stereotypy a lze objektivně vyhodnotit zlepšení.',
      'V případě výrazného funkčního problému je vhodné měření i dříve – po 6–8 týdnech. Opakované měření umožňuje sledovat vývoj, přesně měřit efekt intervencí a postupně zvyšovat tréninkové zatížení.',
      'Po úvodním období je vhodné pokračovat v diagnostice 2–3× ročně, zejména při změně tréninku nebo po rekonvalescenci.',
    ],
  },
} as const;

export const DIAG_PRICE = {
  title: 'Ceník služeb – sportovní diagnostika',
  text:
    'Níže najdete přehled typů zátěžových testů a dalších služeb, které lze vzájemně kombinovat a vytvořit tak individuální zvýhodněný balíček odpovídající Vašim individuálním potřebám a cílům. Ať už jste profesionální sportovec, rekreační nadšenec nebo aktivní člověk, kterému záleží na zdraví a pohybu, naše vyšetření vždy přizpůsobujeme Vašim individuálním potřebám. Využíváme technologie prověřené vrcholovým sportem a medicínou, díky nimž získáte přesná a srozumitelná data o své výkonnosti, metabolismu, síle i pohybové kvalitě – spolu s odbornou interpretací, která má skutečný přínos pro trénink, prevenci i dlouhodobý rozvoj.',
  more: 'Další služby z ceníku',
} as const;

export const DIAG_INFO = {
  title: 'Důležité pokyny a informace k vyšetření',
  docs: 'Důležité dokumenty a pokyny k vyšetřením',
  prices: 'Popis a ceník služeb',
} as const;

export const DIAG_BOOKING = {
  title: 'Rezervační systém',
  text: 'Rezervujte si termín vyšetření jednoduše online. Vyberte si den a čas, který Vám nejlépe vyhovuje. Konkrétní vyšetření nebo cenově zvýhodněný balíček zvolíte v dalším kroku v rezervačním systému.',
  button: 'Rezervace – sportovní diagnostika',
} as const;
