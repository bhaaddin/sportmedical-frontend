import type { SlotDef } from '../slotTypes';
import { textSlot } from '../slotTypes';

/*
 * Slots of the page /faq. Every question and every answer is its own slot, so the clinic edits one
 * sentence without touching the rest. Defaults are the live FAQ of https://sportmedical-diagnostics.cz
 * (page /pages/contact, "FAQ SEKCE", captured 2026-10-03), in the order of the live page; only evident
 * typos were corrected (the Slovak leaks). The live page has no categories — the three below only
 * group the live questions that belong together.
 *
 * Answer markup (see src/web/pages/company/richText.tsx): a blank line starts a paragraph, "### " a
 * small heading, "- " a list item, **bold**.
 */

const HERO = 'Často kladené otázky › Úvod';

export interface FaqEntry { q: string; a: string }
export interface FaqCategory { id: string; title: string; items: readonly FaqEntry[] }

export const FAQ_CATEGORIES: readonly FaqCategory[] = [
  {
    id: 'testy',
    title: 'Zátěžové testy a sportovní prohlídky',
    items: [
      {
        q: 'Příprava na zátěžový test: co je důležité vědět a mít sebou?',
        a: `### Co je důležité vědět před testem
Dostavte se ideálně 10–15 minut před plánovaným začátkem vyšetření. Nepřicházejte zcela nalačno, avšak vyhněte se těžkým jídlům alespoň dvě hodiny před testem. Ideální je lehká snídaně nebo svačina, například ovoce, jogurt či ovesné vločky.

Nepijte kávu, silný čaj ani energetické nápoje, jelikož mohou ovlivnit srdeční frekvenci. Vyhněte se intenzivní fyzické zátěži alespoň 24 hodin před testem. Pokud se necítíte dobře, kontaktujte nás s dostatečným předstihem.

### Co je potřeba mít s sebou
- Výpis ze zdravotní dokumentace (vystaví praktický lékař)
- Vyplněný zdravotní dotazník (doporučujeme vytisknout předem)
- Formulář souhlasu se zpracováním osobních údajů (GDPR)
- Sportovní oblečení a obuv (čisté, funkční, pevná obuv s čistou podrážkou)
- Ručník a toaletní potřeby (pokud plánujete využít sprchu)

### Závěrečné doporučení
Důkladná příprava má přímý vliv na přesnost měření. Dbejte na uvedené pokyny a v případě nejasností nás kontaktujte předem.`,
      },
      {
        q: 'Co je to zátěžový test a pro koho je určený?',
        a: `Ergometrické vyšetření je diagnostická metoda určená k objektivnímu hodnocení kardiovaskulární a metabolické reakce organismu na řízenou fyzickou zátěž. Vyšetření se provádí na bicyklovém ergometru nebo běžeckém pásu s postupným zvyšováním intenzity zátěže.

### Sledované parametry
Během testu se monitorují elektrokardiografická aktivita (EKG), srdeční frekvence, arteriální krevní tlak, tolerance zátěže a subjektivní vnímání námahy.

### Co vyšetření umožňuje
- Objektivní posouzení funkční kapacity srdce a cévního systému
- Včasné odhalení skrytých kardiovaskulárních obtíží
- Určení bezpečné úrovně fyzické zátěže
- Vyhodnocení trénovanosti a adaptačních schopností
- Ověření účinnosti léčby či tréninkového programu

### Pro koho je ergometrické vyšetření určeno
- Výkonnostní a vrcholoví sportovci
- Rekreační sportovci a osoby začínající s tréninkem
- Pacienti po infarktu či kardiovaskulárních operacích
- Jednotlivci usilující o kontrolu kondice
- Uchazeči o přijetí na sportovní školy
- Sportovci žádající o potvrzení zdravotní způsobilosti`,
      },
      {
        q: 'Proč je zátěžový test důležitý?',
        a: `Umožňuje odhalit poruchy, které se v klidových podmínkách neprojeví – ischemii myokardu, arytmie či kolísání krevního tlaku. Poskytuje přesné, měřitelné údaje o aktuální úrovni fyzické zdatnosti. Na základě výsledků lze nastavit individuálně vhodnou intenzitu pohybové aktivity.

Test přispívá k prevenci kardiovaskulárních příhod a umožňuje sledovat fyzickou zdatnost v čase. Výsledky podporují aktivní životní styl a jsou základem individualizovaných doporučení v oblasti pohybu a prevence.

Zátěžový test má univerzální uplatnění v kardiologii, interní medicíně, pneumologii a tělovýchovném lékařství.`,
      },
      {
        q: 'Jaký je hlavní rozdíl mezi základním a spiroergometrickým vyšetřením?',
        a: `### Základní ergometrické vyšetření
Pacient šlape na bicyklovém ergometru nebo běží na pásu s postupným zvyšováním zátěže. Sledují se elektrokardiografický signál, srdeční frekvence, krevní tlak a subjektivní vnímání námahy. Cílem je zjistit, zda srdce zvládá zátěž bez ischemie či arytmií.

Test trvá přibližně 10–15 minut a je ideální pro preventivní kontroly a osoby začínající se sportem. Je bezpečný, neinvazivní a časově nenáročný.

### Spiroergometrické vyšetření
Rozšiřuje klasickou ergometrii o analýzu dýchání a výměny plynů. Klient má nasazenou dýchací masku napojenou na analyzátor dechových plynů. Sleduje se spotřeba kyslíku (VO₂), výdej oxidu uhličitého (VCO₂), dechová frekvence, ventilace a respirační kvocient.

Umožňuje přesně stanovit aerobní a anaerobní práh – moment, kdy tělo přechází ze spalování tuků na sacharidy. Trvá 30–40 minut a poskytuje detailní funkční mapování organismu.

### Rozdíly a výběr
Ergometrie poskytuje přehled o reakci srdce, spiroergometrie přináší hlubokou analýzu dechových objemů, výměny plynů a metabolické účinnosti. Obě metody se vzájemně doplňují.`,
      },
      {
        q: 'Jak dlouho trvá celé vyšetření?',
        a: `### Ergometrické vyšetření
Celé vyšetření trvá přibližně 45–50 minut. Příprava zahrnuje registraci, vyplnění dokumentů (5–10 minut), zátěžová fáze probíhá na ergometru či běžeckém pásu (cca 20 minut) a závěrečná část obsahuje lékařskou interpretaci výsledků (cca 20 minut).

### Spiroergometrické vyšetření
Trvá přibližně 65–70 minut. Úvodní část zahrnuje přípravu přístrojů a nasazení dýchací masky (10 minut), zátěžová fáze trvá 25–30 minut a závěrečné hodnocení s analýzou parametrů trvá 25–30 minut.

Obě vyšetření probíhají pod odborným lékařským dohledem a jsou zcela bezpečná.`,
      },
      {
        q: 'V jakých případech není možné absolvovat zátěžový test?',
        a: `### Situace, kdy test nelze provést
- Akutní onemocnění (horečka, infekce)
- Krátká doba od dobrání antibiotik nebo kortikoidů (alespoň 7 dní)
- Probíhající péče bez ukončené terapie
- Nepotvrzená způsobilost ke sportovní činnosti
- Nestabilní srdeční onemocnění
- Nekompenzované respirační obtíže
- Závažné metabolické poruchy
- Neurologické stavy vylučující bezpečnou zátěž

V těchto případech je test odložen. Doporučujeme konzultaci s ošetřujícím lékařem nebo s odborným týmem.

### Právní rámec
Lékař vychází ze zákona č. 373/2011 Sb., vyhlášky č. 391/2013 Sb. o zdravotní způsobilosti ke sportu a zákona č. 372/2011 Sb. o zdravotních službách. Bezpečnost klienta je absolutní prioritou.`,
      },
      {
        q: 'Jak dlouho jsou zdravotní prohlídky platné?',
        a: `Lékařský posudek o zdravotní způsobilosti ke sportu je platný nejdéle 12 měsíců od data vystavení. Lékař však může určit kratší dobu, pokud to vyžaduje zdravotní stav.

U sportů s vyšším rizikem mohou příslušné organizace vyžadovat zkrácené intervaly kontrol. Platnost se neprodlužuje automaticky – po uplynutí doby je nutné absolvovat nové vyšetření.

Podle § 4 odst. 3 vyhlášky č. 391/2013 Sb. platí, že „platnost lékařského posudku je nejdéle 1 rok".`,
      },
      {
        q: 'Je zátěžový test vhodný i pro rekreační sportovce, nebo pouze pro závodní?',
        a: `Ano – zátěžový test je určen všem, kdo berou pohyb a zdraví vážně, bez ohledu na věk či sportovní ambice. Největší přínos často přináší rekreačně aktivním osobám, které chtějí zlepšit kondici nebo bezpečně začít se sportem.

Test pomáhá zhodnotit kondici, odhalit skryté potíže, zjistit reagibilitu organismu, nastavit bezpečný trénink a zajistit, že pohyb přináší pouze benefit.

Vyšetření je vhodné pro začátečníky, pacienty po onemocnění, lidi všech věkových kategorií, kteří investují do zdraví. Znalost vlastního těla je základem zdravého tréninku.`,
      },
    ],
  },
  {
    id: 'diagnostika',
    title: 'Sportovní diagnostika a balíčky',
    items: [
      {
        q: 'Nabízíte kombinované balíčky?',
        a: `Ano. Nabízíme kombinované balíčky, které spojují zátěžová vyšetření se Sportovní Diagnostikou a měřením InBody 770.

Klient si může zvolit, zda doplní zátěžový test o individuální měření (HumanTrak, ForceDecks, VO₂max) nebo o komplexní diagnostiku zahrnující více technologií.

### Nabízené kombinace
- Zátěžový test + sportovní diagnostika
- Zátěžový test + komplexní InBody měření
- Zátěžový test + komplexní diagnostika + InBody

Spojením těchto služeb získáte komplexní obraz – funkční, výkonnostní i fyziologická data.`,
      },
      {
        q: 'Co je sportovní diagnostika a jaké přístroje využíváme?',
        a: `### Naše technologie
HumanTrak – 3D optická analýza pohybu s přesností na milimetry. Zachycuje držení těla, rozsahy pohybu, svalové disbalance a kompenzační mechanismy.

ForceDecks – systém silových desek měřící sílu, výbušnost, reakční schopnosti a asymetrie. Analyzuje odrazovou a dopadovou sílu.

Cortex 21 – mobilní VO₂max analýza měřící spotřebu kyslíku, výdej oxidu uhličitého a ventilační parametry přímo při výkonu.

InBody 770 – lékařsky certifikované měření složení těla s analýzou svalů, tuku, vody a buněčné vitality pro každý segment těla.

Propojení všech systémů poskytuje ucelený funkční obraz vašeho těla.`,
      },
      {
        q: 'Co zahrnuje sportovní diagnostika a proč je důležitá?',
        a: `Sportovní diagnostika je detailní analýza pohybového systému zaměřená na identifikaci svalových disbalancí, rozsahových omezení, asymetrií a kompenzačních mechanismů.

Sleduje „jak" tělo výkon vytváří, nikoli pouze výsledek. Zaměřuje se na kvalitu pohybu, rovnováhu sil a efektivitu přenosu energie.

### Rozsah vyšetření
- Svalová diagnostika – rozsahy pohybu, kompenzační mechanismy
- Silová diagnostika – schopnost vyvinout sílu a tlumit dopad
- Reakční schopnosti – rychlost aktivace, koordinace segmentů
- Posturální stabilita – schopnost udržet rovnováhu

Umožňuje nastavit efektivní a bezpečný trénink, zabránit přetížení a optimalizovat výkon.`,
      },
      {
        q: 'Jak dlouho testování trvá a kdy obdržím výsledky?',
        a: `Délka diagnostiky se odvíjí od rozsahu objednané služby. Jednotlivé měření trvá 20–40 minut, komplexní diagnostika zahrnující více metod trvá 40–60 minut.

Výsledky nejsou dostupné ihned – vyžadují detailní zpracování dat, jejich analýzu a odbornou interpretaci. Jakmile je zpráva kompletní, klient je kontaktován a je dohodnut termín konzultace s předáním výsledků.

Každý klient obdrží kompletní výstupní dokumentaci s tabulkami, grafy, interpretací a doporučeními.`,
      },
      {
        q: 'Co přesně se dozvím z výstupní zprávy?',
        a: `### Surová data a výstupy
Měření obsahuje tabelární data a grafy se všemi sledovanými metrikami. U HumanTrak jsou k dispozici fotodokumentace a vizuální výstupy z klíčových pohybových fází.

### Výstupní zpráva obsahuje
- Aritmetické průměry z validních měření
- Souhrnný přehled s hodnocením „v normě", „hraniční" nebo „mimo normu"
- Jednotlivé metriky s porovnáním s normovými rozmezími
- Výkonnostní index (0–10 bodů)
- Konkrétní doporučení pro trénink, rehabilitaci a kompenzaci
- Video-kompenzační plán s detailním průvodcem cvičení

Výstupní zpráva je komplexní funkční mapou vašeho těla s vědecky ověřeným podkladem pro další práci.`,
      },
      {
        q: 'Jaký je přínos diagnostiky pro prevenci zranění a optimalizaci výkonu?',
        a: `Sportovní diagnostika je nástrojem moderní medicíny a sportovní vědy, který umožňuje objektivně měřit, kvantifikovat a analyzovat složky výkonu.

### Prevence zranění
HumanTrak odhaluje posturální odchylky, asymetrie, ztrátu rozsahu pohybu a aktivní kompenzační mechanismy. ForceDecks měří schopnost absorbovat dopad, čas stabilizace a jednostranné zatížení. Tato data umožňují vytvořit cílený preventivní plán.

### Optimalizace výkonu
ForceDecks určuje efektivitu přeměny síly na výkon, sekvenci odrazu a kvalitu přenosu sil. VO₂max poskytuje informace o metabolické efektivitě a umožňuje nastavit tréninkové zóny přesně podle individuální kapacity.

### Kontrola vývoje
Opakované testování poskytuje jasné srovnání vývoje v čase. Tento přístup je mnohem přesnější než subjektivní hodnocení.

### Individuální přístup
Každý profil vychází z anatomie, svalové struktury, pohybových stereotypů a aktuální kondice. Trénink je nejen efektivní, ale i bezpečný.

Diagnostika propojuje výkonnost, zdraví a regeneraci do jednoho logického celku, kde výkon roste bez rizika zranění.`,
      },
      {
        q: 'Nabízíte i možnost vypracování kompenzačních plánů?',
        a: `Ano. Na základě výsledků sportovní diagnostiky nabízíme vypracování individuálně sestaveného video-instruovaného kompenzačního plánu reagujícího na konkrétní nálezy.

### Struktura plánu
- Konkrétní kompenzační cvičení odpovídající zjištěným problémům
- Počet sérií, opakování, čas trvání a odpočinky
- Instruktážní videa s detailním vysvětlením pohybu
- Komentář k provedení a cíl kompenzace

Plán je přizpůsoben vybavení a prostředí klienta (domácí vybavení nebo studio) a je dostupný přes mobilní aplikaci pro iOS a Android.

Každý plán trvá 3 měsíce a poté je automaticky uzavřen. Po uplynutí doby je klient pozván na kontrolní retest, který ověří dosažený efekt.`,
      },
      {
        q: 'Jak často je vhodné sportovní diagnostiku opakovat?',
        a: `Sportovní diagnostika má největší přínos, když na ni navazuje cílený kompenzační a tréninkový program. Doporučujeme provést kontrolní retest přibližně po 3 měsících od první analýzy.

Tento interval představuje optimální dobu, během níž se projeví fyziologické adaptace, stabilizují nové pohybové stereotypy a lze objektivně vyhodnotit zlepšení.

V případě výrazného funkčního problému je vhodné měření i dříve – po 6–8 týdnech. Opakované měření umožňuje sledovat vývoj, přesně měřit efekt intervencí a postupně zvyšovat tréninkové zatížení.

Po úvodním období je vhodné pokračovat v diagnostice 2–3× ročně, zejména při změně tréninku nebo po rekonvalescenci.`,
      },
    ],
  },
  {
    id: 'inbody',
    title: 'InBody 770',
    items: [
      {
        q: 'Co je InBody 770 měření a jak funguje?',
        a: `InBody 770 je zařízení lékařské třídy pro komplexní analýzu tělesného složení a stavu tekutin. Základem je technologie DSM-BIA – přímá segmentální vícefrekvenční bioimpedanční analýza.

### Jak vyšetření probíhá
Měření trvá přibližně 60 sekund. Klient stojí bosý na měřicí destičce a drží elektrody v rukou – bez injekcí, bez nepohodlí, neinvazivně.

### Hlavní vlastnosti
- Segmentální analýza pěti součástí těla
- Detailní analýza intracelulární a extracelulární vody a poměru ECW/TBW
- Více než 50 parametrů: složení těla, voda, minerály, bazální metabolismus, fázový úhel
- Klinická přesnost bez empirických odhadů
- Okamžitý, přehledný výstup s grafy a interpretací

InBody 770 je lékařsky certifikované, používáno ve špičkových nemocnicích a výzkumných centrech.`,
      },
      {
        q: 'V čem je InBody jiné než běžné chytré váhy?',
        a: `### Hlavní rozdíly
Běžné váhy používají jednoduchou metodu odhadující podíl tuku podle věku a pohlaví. InBody 770 používá DSM-BIA – měří skutečnou elektrickou impedanci na šesti frekvencích v pěti segmentech těla. Výsledky nejsou odhady, ale reálné fyziologické měřování.

Běžné váhy vidí tělo jako celek. InBody 770 měří každou část samostatně – odhaluje svalové nerovnováhy, asymetrie, přetížení konkrétní části.

Běžné váhy zobrazují pouze „tělesnou vodu". InBody 770 rozlišuje intracelulární a extracelulární vodu a určuje poměr ECW/TBW – zásadní ukazatel rovnováhy tekutin a zdraví.

InBody 770 je lékařsky validováno, používáno v nemocnicích a výzkumných centrech. Běžné váhy vycházejí z algoritmických odhadů se chybovostí až 20–30 procent.

InBody poskytuje 50+ parametrů (složení, hydratace, viscerální tuk, fázový úhel, metabolický věk). Běžné váhy nabízejí 4–5 údajů bez kontextu nebo interpretace.`,
      },
      {
        q: 'Jak se správně připravit na měření InBody?',
        a: `### Zásady přípravy
- Neměřte se ihned po jídle (2 hodiny po jídle)
- Dodržujte stejné podmínky při opakovaných měřeních (stejná denní doba, režim stravy, spánku, aktivity)
- Vyhněte se nadměrné konzumaci tekutin před testem
- Použijte toaletu před měřením
- Vyhněte se fyzické zátěži alespoň 2 hodiny před testem
- Neměřte se po sprše, koupeli, sauně nebo silném pocení
- Ženy: měření mimo období menstruace

### Doplňková doporučení
- Nepoužívejte krémy ani oleje na ruce a nohy
- Odstraňte všechny kovové předměty (šperky, hodinky, piercingy)
- Vyhněte se alkoholu a kofeinu alespoň 24 hodin před měřením
- Během testu zůstaňte v klidu bez pohybu

### Kontraindikace
- Osoby s kardiostimulátorem (konzultace s lékařem)
- Těhotné ženy v 1. trimestru (měření po konzultaci)
- Osoby s otevřenými ranami či kovovými implantáty (může ovlivnit přesnost)

Přesnost závisí na konzistentní přípravě a klidových podmínkách.`,
      },
      {
        q: 'Jak dlouho měření trvá a kdy dostanu výsledky?',
        a: `Měření InBody 770 je rychlé a komfortní. Celý proces včetně přípravy a interpretace trvá přibližně 5 minut.

Samotná analýza těla probíhá pouhých 60 sekund. Během této doby přístroj provádí vícefrekvenční měření pěti tělesných segmentů a zachycuje 50+ parametrů tělesného složení, hydratace a metabolismu.

Výsledky obdržíte okamžitě po dokončení měření – ve formě tištěného reportu s tabulkami, grafy a interpretací hodnot. Není potřeba čekat – diagnostický výstup je generován automaticky a následně interpretován odborným personálem.`,
      },
    ],
  },
];

/** Question numbers run through the categories, so a slot key never changes when a question is moved. */
export const FAQ_ITEMS: readonly { n: number; categoryId: string; entry: FaqEntry }[] = FAQ_CATEGORIES
  .flatMap((category) => category.items.map((entry) => ({ categoryId: category.id, entry })))
  .map((item, index) => ({ n: index + 1, ...item }));

export const faqKey = (n: number, part: 'q' | 'a'): string => `otazky.q.${String(n).padStart(2, '0')}.${part}`;
export const faqCategoryKey = (id: string): string => `otazky.cat.${id}.title`;

export const otazkySlots: SlotDef[] = [
  textSlot('otazky.hero.eyebrow', 'Úvod — nadpis nad titulkem', HERO, 'Pomoc a informace'),
  textSlot('otazky.hero.title', 'Úvod — titulek stránky', HERO, 'Často kladené otázky'),
  textSlot('otazky.hero.lead', 'Úvod — úvodní odstavec', HERO, 'Příprava na test, délka vyšetření, platnost posudku, diagnostika a InBody.', { multiline: true }),
  ...FAQ_CATEGORIES.flatMap((category): SlotDef[] => {
    const group = `Často kladené otázky › ${category.title}`;
    return [
      textSlot(faqCategoryKey(category.id), `Kategorie — ${category.title}`, group, category.title),
      ...FAQ_ITEMS.filter((item) => item.categoryId === category.id).flatMap((item): SlotDef[] => [
        textSlot(faqKey(item.n, 'q'), `Otázka ${item.n}`, group, item.entry.q),
        textSlot(faqKey(item.n, 'a'), `Odpověď ${item.n}`, group, item.entry.a, { multiline: true }),
      ]),
    ];
  }),
  textSlot('otazky.more.title', 'Nenašli jste odpověď — titulek', 'Často kladené otázky › Nenašli jste odpověď', 'Nenašli jste, co hledáte?'),
  textSlot('otazky.more.text', 'Nenašli jste odpověď — text', 'Často kladené otázky › Nenašli jste odpověď', 'Napište nám nebo zavolejte, rádi poradíme.', { multiline: true }),
  textSlot('otazky.more.cta', 'Nenašli jste odpověď — tlačítko (vede na Kontakt)', 'Často kladené otázky › Nenašli jste odpověď', 'Kontakt'),
  textSlot('otazky.more.book', 'Nenašli jste odpověď — druhé tlačítko (vede na rezervaci)', 'Často kladené otázky › Nenašli jste odpověď', 'Objednat termín'),
];
