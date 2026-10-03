/* ══════════════════════════════════════════════════════════════
   THE FOUR DETAIL PAGES OF SPORTOVNÍ DIAGNOSTIKA

   /diagnostika/zakladni, /komplexni, /vo2max, /kompenzacni-plan — one page each on the live site
   (sportmedical-diagnostics.cz/pages/zakladni-diagnostika, komplexni-diagnostika, vo2max-analyza,
   vidoeo-kompenzacne-plany), plus what the FAQ of /pages/contact adds about the compensation plan.
   Wording as published; Slovak words and obvious typos corrected; the stale "Již brzy dostupné",
   the stale opening hours and the old contact data are NOT copied.

   A page is a hero, a list of sections (prose, cards, or pairs of columns), the price card(s) of its own
   service (found in the price list by name — the amounts are never here), the group discounts and links
   to the other pages. The page component and the registry both read the same spec.
   ══════════════════════════════════════════════════════════════ */

import type { SlotDef } from '../../../../site/slotTypes';
import { mediaSlot, textSlot } from '../../../../site/slotTypes';
import { cardSlots, heroSlots, listSlots, paraSlots, photoSlot } from '../slotFactory';
import type { CardDefaults, HeroDefaults } from '../slotFactory';

export type DetailSection =
  | {
      kind: 'prose';
      id: string;
      title: string;
      sub?: string;
      paras: readonly string[];
      bullets?: readonly string[];
      photo?: { caption: string; video?: boolean };
      tone?: 'white' | 'warm';
    }
  | {
      kind: 'cards';
      id: string;
      title: string;
      lead?: string;
      cards: readonly CardDefaults[];
      numbered?: boolean;
      photo?: { caption: string };
      tone?: 'white' | 'warm';
    }
  | {
      kind: 'duo';
      id: string;
      title: string;
      lead?: string;
      items: readonly { title: string; paras: readonly string[]; photoCaption: string }[];
      tone?: 'white' | 'warm';
    };

export interface DetailSpec {
  page: 'diagzakladni' | 'diagkomplexni' | 'diagvo2max' | 'diagkompenzacni';
  /** Group of the admin list: "Základní diagnostika". */
  name: string;
  hero: HeroDefaults;
  sections: readonly DetailSection[];
  /** Ids of the cards of src/web/pages/services/content/diagCards.ts the page shows with the price. */
  cardIds: readonly string[];
  priceTitle: string;
  moreTitle: string;
}

/** The admin keys of a spec — the same ones its page draws. */
export function detailSlots(spec: DetailSpec): SlotDef[] {
  const { page, name } = spec;
  const out: SlotDef[] = [...heroSlots(page, `${name} › Hero`, spec.hero)];
  for (const section of spec.sections) {
    const group = `${name} › ${section.title}`;
    const prefix = `${page}.${section.id}`;
    out.push(textSlot(`${prefix}.title`, `${section.title} — titulek sekce`, group, section.title));
    if (section.kind === 'prose') {
      if (section.sub !== undefined) out.push(textSlot(`${prefix}.sub`, `${section.title} — podtitulek`, group, section.sub));
      out.push(...paraSlots(prefix, group, section.title, section.paras));
      if (section.bullets !== undefined) out.push(...listSlots(prefix, group, section.title, section.bullets));
      if (section.photo !== undefined) {
        out.push(mediaSlot(`${prefix}.photo`, `${section.title} — ${section.photo.video === true ? 'video' : 'foto'}`, group, section.photo.caption, '1200 × 900 px', '4 / 3', section.photo.video === true ? 'video' : 'image'));
      }
    } else if (section.kind === 'cards') {
      if (section.lead !== undefined) out.push(textSlot(`${prefix}.lead`, `${section.title} — úvod`, group, section.lead, { multiline: true }));
      out.push(...cardSlots(prefix, group, 'Položka', section.cards));
      if (section.photo !== undefined) out.push(photoSlot(`${prefix}.photo`, `${section.title} — foto`, group, section.photo.caption));
    } else {
      if (section.lead !== undefined) out.push(textSlot(`${prefix}.lead`, `${section.title} — úvod`, group, section.lead, { multiline: true }));
      section.items.forEach((item, index) => {
        out.push(textSlot(`${prefix}.${index + 1}.title`, `${item.title} — titulek`, group, item.title));
        out.push(...paraSlots(`${prefix}.${index + 1}`, group, item.title, item.paras));
        out.push(photoSlot(`${prefix}.${index + 1}.photo`, `${item.title} — foto`, group, item.photoCaption));
      });
    }
  }
  out.push(textSlot(`${page}.price.title`, 'Cena a objednání — titulek sekce', `${name} › Cena a objednání`, spec.priceTitle));
  out.push(textSlot(`${page}.more.title`, 'Další služby — titulek sekce', `${name} › Další služby`, spec.moreTitle));
  return out;
}

const MORE = 'Další služby sportovní diagnostiky';
const PRICE = 'Cena a objednání';

export const DIAG_ZAKLADNI: DetailSpec = {
  page: 'diagzakladni',
  name: 'Základní diagnostika',
  hero: {
    eyebrow: 'Sportovní diagnostika',
    title: 'Základní diagnostika',
    lead: 'Objektivní hodnocení pohybu založené na přesně naměřených datech. Poskytuje základní hodnocení pohybových parametrů, svalových asymetrií, silových deficitů a dalších klíčových parametrů pohybu bez synchronizované video-biomechanické analýzy.',
    photoCaption: 'vysoce citlivé silové platformy',
  },
  cardIds: ['zd'],
  priceTitle: PRICE,
  moreTitle: MORE,
  sections: [
    {
      kind: 'prose',
      id: 'about',
      title: 'O vyšetření',
      paras: [
        'Základní diagnostika je založena výhradně na objektivním měření pomocí vysoce citlivých silových platforem, které poskytují přesná data o průběhu pohybu s milisekundovou přesností.',
        'Služba je dostupná v diagnostickém centru i formou mobilního měření přímo ve sportovních klubech.',
      ],
      bullets: [
        'Základní analýza jednotlivých fází pohybu',
        'Automatická detekce všech fází pohybu',
        'Milisekundová přesnost měření',
        'Detailní identifikace asymetrií a silových deficitů',
        'Interpretace výsledků s jasným praktickým významem',
      ],
      photo: { caption: 'silová platforma při měření' },
    },
    {
      kind: 'cards',
      id: 'content',
      title: 'Obsah Základní diagnostiky',
      tone: 'warm',
      cards: [
        {
          title: 'Milisekundová přesnost měření',
          text: 'Přesné zachycení silových a časových parametrů v jednotlivých fázích pohybu.',
          more: 'Vysoce citlivé silové platformy zaznamenávají i velmi rychlé změny síly v krátkých časových úsecích.',
        },
        {
          title: 'Základní analýza jednotlivých fází pohybu',
          text: 'Objektivní hodnocení jednotlivých fází pohybu založené výhradně na naměřených silových a časových datech bez synchronizované video-analýzy.',
          more: 'Pokročilé algoritmy automaticky vyhodnocují naměřená data a umožňují samostatné časové i silové posouzení jednotlivých fází pohybu bez subjektivního zásahu vyšetřujícího.',
        },
        {
          title: 'Analýza pohybové dynamiky a stability',
          text: 'Objektivní hodnocení síly, výkonu, výbušnosti, reaktivity a kontroly pohybu.',
          more: 'Hodnotí, jak rychle a efektivně sportovec vytváří a absorbuje sílu. Výsledky nejsou propojeny s obrazovým záznamem.',
        },
        {
          title: 'Balanční testy',
          text: 'Hodnocení rovnováhy, posturální kontroly a rozložení zatížení bez vizuální analýzy pohybu.',
          more: 'Balanční testy sledují pohyb centra tlaku, rozsah a rychlost jeho vychylování, stabilitu opory i rozložení zatížení mezi pravou a levou končetinou.',
        },
        {
          title: 'Balistické testy',
          text: 'Analýza výbušnosti, reaktivní síly, odrazu, dopadu a tlumení zatížení.',
          more: 'Testy hodnotí výšku výskoku, dobu kontaktu se zemí, impulz, výkon, rychlost rozvoje síly a reaktivitu.',
        },
        {
          title: 'Izometrické testy síly',
          text: 'Objektivní měření maximální síly a rychlosti jejího rozvoje.',
          more: 'Izometrické testy umožňují posoudit maximální svalovou sílu, schopnost rychle ji vytvořit a rozdíly mezi jednotlivými končetinami.',
        },
      ],
    },
    {
      kind: 'cards',
      id: 'expect',
      title: 'Co můžete očekávat',
      cards: [
        { title: 'Testování přizpůsobené Vašemu sportu', text: 'Testovací protokoly jsou cíleně voleny s ohledem na konkrétní sport, typ zátěže, výkonnostní úroveň a cíl vyšetření.' },
        {
          title: 'Základní posouzení asymetrií a silových deficitů',
          text: 'Naměřené výsledky umožňují základní objektivní posouzení rozdílů mezi končetinami bez synchronizované video-biomechanické analýzy.',
        },
        { title: 'Objektivní hodnocení naměřených dat', text: 'Vysoce citlivé silové platformy poskytují přesná data o síle, výkonu, výbušnosti, stabilitě a reaktivitě.' },
        { title: 'Prakticky využitelné výsledky', text: 'Výsledky poskytují objektivní podklad pro cílenější nastavení tréninku a rehabilitace.' },
      ],
    },
  ],
};

export const DIAG_KOMPLEXNI: DetailSpec = {
  page: 'diagkomplexni',
  name: 'Komplexní diagnostika',
  hero: {
    eyebrow: 'Sportovní diagnostika',
    title: 'Komplexní diagnostika',
    lead: 'Objektivní data propojená s detailní video-biomechanickou analýzou. Každá naměřená hodnota je synchronizována s konkrétní fází pohybu, což umožňuje přesně odhalit a vysvětlit příčinu každé odchylky.',
    photoCaption: 'komplexní diagnostika s videoanalýzou',
  },
  cardIds: ['kd'],
  priceTitle: PRICE,
  moreTitle: MORE,
  sections: [
    {
      kind: 'cards',
      id: 'features',
      title: 'Klíčové vlastnosti',
      cards: [
        {
          title: 'Komplexní video-analýza jednotlivých fází pohybu',
          text: 'Propojuje video-analýzu jednotlivých fází pohybu s naměřenými daty, která umožňuje přesně identifikovat kompenzační mechanismy, technické nedostatky a nesprávné pohybové vzorce.',
        },
        {
          title: 'Automatická detekce všech fází pohybu',
          text: 'Pokročilé algoritmy automaticky rozlišují jednotlivé fáze pohybu a umožňují jejich samostatné časové i silové vyhodnocení bez subjektivního zásahu vyšetřujícího.',
        },
        {
          title: 'Milisekundová přesnost měření',
          text: 'Systém zachycuje každý kontakt, odraz i dopad s extrémně vysokým časovým rozlišením, čímž umožňuje přesné hodnocení dynamiky výkonu a změn síly v reálném čase.',
        },
        { title: 'Detailní identifikace asymetrií a silových deficitů', text: 'Přesně měříme rozdíly v síle, stabilitě a reaktivních schopnostech mezi levou a pravou končetinou.' },
        {
          title: 'Interpretace výsledků s jasným praktickým významem',
          text: 'Naměřená data jsou ihned převedena do přehledných metrik a vizualizací, které zachycují kvalitu síly, načasování a dynamiku pohybu.',
        },
      ],
    },
    {
      kind: 'duo',
      id: 'pillars',
      title: 'Dva neoddělitelné pilíře',
      lead: 'Komplexní diagnostika je založena na propojení dvou neoddělitelných částí.',
      tone: 'warm',
      items: [
        {
          title: 'Silové platformy',
          paras: [
            'Vysoce citlivé silové platformy poskytující objektivní data o kvalitě a průběhu každého pohybu.',
            'První část tvoří vysoce citlivé silové platformy poskytující objektivní data o průběhu pohybu.',
            'Silové platformy umožňují objektivně hodnotit výbušnost, maximální i explozivní sílu, výkon, stabilitu, dynamickou rovnováhu, koordinaci, reaktivitu a asymetrie mezi končetinami.',
            'Stejnou úroveň diagnostiky poskytujeme formou mobilního měření přímo ve sportovních klubech a fyzioterapeutických zařízeních.',
          ],
          photoCaption: 'silové platformy',
        },
        {
          title: 'Video-biomechanická analýza',
          paras: [
            'Detailní video-biomechanická analýza propojující objektivní silová data s obrazem pohybu pro přesnou interpretaci každého naměřeného výsledku.',
            'Detailní video-biomechanická analýza představuje druhý neoddělitelný pilíř komplexní diagnostiky a její vizuální dimenzi.',
            'Systém během testu automaticky identifikuje klíčové momenty i jednotlivé fáze pohybu, které je možné okamžitě přehrávat, zpomalovat a detailně analyzovat.',
            'Dlouhodobý dohled nad biomechanikou: videozáznamy se automaticky ukládají do profilu pacienta, čímž vzniká přehledná a dlouhodobá databáze jeho pohybových záznamů.',
          ],
          photoCaption: 'video-biomechanická analýza',
        },
      ],
    },
    {
      kind: 'prose',
      id: 'interpretation',
      title: 'Interpretace výsledků',
      paras: [
        'Přehledné vizuální zpracování umožňuje společně analyzovat Váš pohyb a srozumitelně vysvětlit všechny naměřené hodnoty.',
        'Pokročilé algoritmy automaticky zpracovávají výsledky měření do intuitivního vizuálního rozhraní.',
        'Silová data, která jsou sama o sobě pro běžného člověka často těžko interpretovatelná, tak získávají konkrétní vizuální kontext.',
      ],
      photo: { caption: 'vizuální zpracování výsledků' },
    },
    {
      kind: 'prose',
      id: 'plan',
      title: 'Video-instruktážní kompenzační plán na míru',
      tone: 'warm',
      paras: [
        'Vytvořený na základě výsledků Komplexní diagnostiky přesně podle Vašich individuálních diagnostických nálezů.',
        'Na základě výsledků Komplexní diagnostiky pro Vás můžeme vypracovat individuální video-instruktážní kompenzační plán, který bude přesně vycházet z Vašich objektivně naměřených výsledků.',
        'Součástí plánu je profesionální video-instruktáž každého cviku doplněná o podrobný popis vysvětlující klíčové body pohybu.',
        'Plán je detailně rozpracován do přesné struktury zahrnující počet sérií, opakování, dobu provádění jednotlivých cviků i délku odpočinku.',
      ],
      photo: { caption: 'kompenzační plán na míru' },
    },
    {
      kind: 'cards',
      id: 'expect',
      title: 'Co můžete od Komplexní diagnostiky očekávat',
      photo: { caption: 'konzultace nad výsledky' },
      cards: [
        { title: 'Propojení objektivních dat s videoanalýzou', text: 'Každá naměřená hodnota je synchronizována s obrazovým záznamem konkrétní fáze pohybu.' },
        { title: 'Detailní odhalení příčin odchylek', text: 'Propojení dat s video-biomechanickou analýzou umožňuje přesněji identifikovat asymetrie a silové deficity.' },
        { title: 'Testování přizpůsobené Vašim potřebám', text: 'Testovací protokol volíme podle Vašeho sportu, výkonnostní úrovně, typu zatížení i cíle vyšetření.' },
        { title: 'Přesně cílená doporučení', text: 'Výsledky poskytují komplexní podklad pro individuální nastavení tréninku a rehabilitace.' },
      ],
    },
    {
      kind: 'cards',
      id: 'content',
      title: 'Obsah Komplexní diagnostiky',
      tone: 'warm',
      cards: [
        {
          title: 'Milisekundová přesnost měření',
          text: 'Přesné zachycení průběhu silového působení v každé fázi pohybu.',
          more: 'Díky vysoké vzorkovací frekvenci dokážou silové platformy zaznamenat i velmi rychlé změny síly v krátkých časových úsecích.',
        },
        {
          title: 'Synchronizovaná video-biomechanická analýza',
          text: 'Propojení obrazového záznamu s naměřenými silovými daty v reálném čase.',
          more: 'Každá naměřená hodnota je časově synchronizována s konkrétní fází pohybu. Obrazový záznam lze samostatně přehrávat a procházet snímek po snímku.',
        },
        {
          title: 'Komplexní analýza pohybové dynamiky a stability',
          text: 'Detailní hodnocení síly, výkonu, výbušnosti, reaktivity a kontroly pohybu.',
          more: 'Analýza sleduje, jak rychle a efektivně sportovec vytváří, přenáší a absorbuje sílu v jednotlivých fázích pohybu.',
        },
        {
          title: 'Balanční testy',
          text: 'Hodnocení rovnováhy, posturální kontroly a rozložení zatížení doplněné o vizuální analýzu pohybu.',
          more: 'Balanční testy sledují pohyb centra tlaku, rozsah a rychlost jeho vychylování, stabilitu opory.',
        },
        {
          title: 'Balistické testy',
          text: 'Analýza výbušnosti, reaktivní síly, odrazu, dopadu a tlumení zatížení.',
          more: 'Testy hodnotí výšku výskoku, dobu kontaktu se zemí, impulz, výkon, rychlost rozvoje síly a reaktivitu.',
        },
        {
          title: 'Izometrické testy síly',
          text: 'Objektivní měření maximální síly a rychlosti jejího rozvoje.',
          more: 'Izometrické testy umožňují přesně posoudit maximální svalovou sílu a schopnost rychle ji vytvořit.',
        },
      ],
    },
  ],
};

export const DIAG_VO2MAX: DetailSpec = {
  page: 'diagvo2max',
  name: 'Vo2max analýza',
  hero: {
    eyebrow: 'Sportovní diagnostika',
    title: 'Vo2max analýza',
    lead: 'Nejpřesnější měření VO₂max v laboratoři i v terénu, s výstupy na úrovni světového vrcholového sportu.',
    photoCaption: 'spiroergometrie Cortex 21',
  },
  cardIds: ['vo2max', 'kd-vo2'],
  priceTitle: PRICE,
  moreTitle: MORE,
  sections: [
    {
      kind: 'cards',
      id: 'features',
      title: 'Co vyšetření nabízí',
      cards: [
        {
          title: 'Absolutní přesnost měření',
          text: 'Špičková technologie spiroergometrie nové generace, která s maximální přesností zaznamenává VO₂, VCO₂, ventilační parametry i metabolické ukazatele.',
        },
        { title: 'Laboratorní i terénní využití', text: 'Možnost testování přímo v podmínkách skutečné aktivity nebo v plně vybavené laboratoři přímo u nás.' },
        {
          title: 'Okamžité a přehledné výstupy',
          text: 'Profesionální grafy, přesně definované tréninkové zóny a přehledné protokoly, které okamžitě využijete pro svůj trénink i výkonový rozvoj.',
        },
        {
          title: 'Technologie pro špičkový sport i medicínu',
          text: 'Standard, který dosud využívala jen elita. Možnost hodnotit vytrvalost, efektivitu metabolismu i kardiopulmonální kapacitu na úrovni světového vrcholového sportu a moderní medicíny – nyní dostupné i pro vás.',
        },
      ],
    },
    {
      kind: 'prose',
      id: 'cortex',
      title: 'Vidíme to, co oko nepostřehne. Měříme tam, kde jiní odhadují.',
      tone: 'warm',
      paras: [
        'Nabízíme průlomovou a inovativní službu spiroergometrické diagnostiky, která překonává dosavadní limity.',
        'Přístroj spojuje osvědčenou spolehlivost předchozích generací s revolučními inovacemi zaměřenými na nejpřesnější měření VO₂max a metabolických parametrů.',
      ],
      photo: { caption: 'Cortex 21' },
    },
    {
      kind: 'cards',
      id: 'functions',
      title: 'Klíčové funkce Cortex 21',
      cards: [
        {
          title: 'Komplexní analýza dýchání a energetického výdeje',
          text: 'Vysoce přesné měření spotřeby kyslíku (VO₂), produkce oxidu uhličitého a ventilačních údajů v reálném čase.',
        },
        {
          title: 'Přesné určení individuálních zátěžových prahů',
          text: 'Cortex poskytuje sofistikované algoritmy pro stanovení ventilačních a metabolických prahů (VT1, VT2).',
        },
        {
          title: 'Detailní hodnocení efektivity dýchání při zátěži',
          text: 'Vyšetření posuzuje efektivitu dýchání a zda ventilace odpovídá potřebám organismu.',
        },
        {
          title: 'Prevence zranění a efektivita tréninku',
          text: 'Kontinuální sběr dat v průběhu celé zátěže umožňuje systému Cortex 21 komplexně vyhodnotit kardiopulmonální a ventilační odpověď organismu.',
        },
      ],
    },
  ],
};

export const DIAG_KOMPENZACNI: DetailSpec = {
  page: 'diagkompenzacni',
  name: 'Kompenzační plán',
  hero: {
    eyebrow: 'Sportovní diagnostika',
    title: 'Sestavení individuálního kompenzačního plánu s video-instruktáží',
    lead: 'Výbušnost, stabilita, symetrie. Data, která běžnému oku uniknou – přesně změřena v každé milisekundě.',
    photoCaption: 'kompenzační plán s video-instruktáží',
  },
  cardIds: ['plan'],
  priceTitle: PRICE,
  moreTitle: MORE,
  sections: [
    {
      kind: 'prose',
      id: 'checks',
      title: 'Co plán obsahuje',
      paras: [],
      bullets: [
        'Individuální kompenzační plán na míru',
        'Video instruktáž ke každému cviku',
        'Cílená práce na slabých místech',
        'Přizpůsobeno individuálním možnostem a dostupnosti pomůcek',
      ],
    },
    {
      kind: 'prose',
      id: 'from',
      title: 'Od přesné diagnostiky k cílené nápravě',
      sub: 'Jak proměňujeme diagnostická data v přesný kompenzační plán',
      tone: 'warm',
      paras: [
        'Kompenzační video-instruktážní plán představuje precizně strukturovaný systém cílených cviků vycházející z vašich skutečných diagnostických výsledků – včetně zjištěných svalových dysbalancí, asymetrií, omezení pohybových vzorců a případných silových či stabilizačních deficitů.',
      ],
      photo: { caption: 'od diagnostiky k plánu' },
    },
    {
      kind: 'prose',
      id: 'structure',
      title: 'Jasná struktura, precizní provedení a optimální řízení zátěže',
      paras: [
        'Každý cvik v plánu je doplněn o profesionální videoinstruktáž a popis, který vysvětluje klíčové body pohybu, techniky a způsobu provedení cviku.',
        'Plán s definovanými sériemi, opakováními a pauzami.',
      ],
      photo: { caption: 'ukázka videoinstruktáže cviku', video: true },
    },
    {
      kind: 'prose',
      id: 'app',
      title: 'Jedna aplikace pro kompletní přehled vašich dat, výsledků i kompenzačních plánů',
      tone: 'warm',
      paras: [
        'Jakmile je váš individuální kompenzační plán kompletně sestaven, obdržíte jej přímo na e-mail uvedený při registraci.',
        'Plán je přizpůsoben vybavení a prostředí klienta (domácí vybavení nebo studio) a je dostupný přes mobilní aplikaci pro iOS a Android.',
      ],
      photo: { caption: 'mobilní aplikace s plánem' },
    },
    {
      kind: 'prose',
      id: 'tech',
      title: 'Když technologie mění pravidla hry',
      paras: [],
      bullets: [
        'Plán vycházející z naměřených diagnostických dat',
        'Videoinstruktáž cviků s popisem klíčových bodů techniky',
        'Přesná struktura plánu',
        'Kompenzace přetížených a slabých oblastí podle získaných dat',
      ],
      photo: { caption: 'kompenzační plán v praxi' },
    },
    {
      kind: 'prose',
      id: 'faq',
      title: 'Struktura plánu',
      tone: 'warm',
      paras: [
        'Na základě výsledků sportovní diagnostiky vypracováváme individuálně sestavený video-instruovaný kompenzační plán reagující na konkrétní nálezy.',
        'Každý plán trvá 3 měsíce a poté je automaticky uzavřen. Po uplynutí doby je klient pozván na kontrolní retest, který ověří dosažený efekt.',
      ],
      bullets: [
        'Konkrétní kompenzační cvičení odpovídající zjištěným problémům',
        'Počet sérií, opakování, čas trvání a odpočinky',
        'Instruktážní videa s detailním vysvětlením pohybu',
        'Komentář k provedení a cíl kompenzace',
      ],
    },
  ],
};

export const DETAIL_SPECS = [DIAG_ZAKLADNI, DIAG_KOMPLEXNI, DIAG_VO2MAX, DIAG_KOMPENZACNI] as const;
